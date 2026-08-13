-- =====================================================================================
-- Migración 0001 — extensiones y helpers
-- =====================================================================================
-- Fuentes normativas: PART 8 §8.2.1 (nanoid), §8.2.4 (extensiones), §8.2.6 (privilegios
-- por defecto), §8.3.6 (mod_actions inmutable, has_active_restriction), §8.5 (reglas
-- uniformes de las funciones), §8.6 (config FTS public.es + f_unaccent);
-- spine §0.5-R6 (constantes de rate limit en UNA función), §0.5-R13 (FTS definido una vez);
-- PART 11 §11.6.2 (valores de rate limit por tier T0/T1/T2);
-- PART 9/10 §10.9 (dos cortinas: la de base de datos es la que tiene que aguantar),
-- §10.14 (kill switches en app_settings, leídos al tope de cada RPC de escritura).
--
-- Esta migración no crea NINGUNA tabla, así que no hay `enable row level security` acá
-- (tenet 1 aplica desde 0002 en adelante). Sí fija el piso de privilegios para todo lo
-- que venga después y deja escritos los helpers que las RPC de 0011/0012 reutilizan.
--
-- Nota de orden: varias funciones de guardia leen tablas que todavía no existen
-- (`profiles` → 0004, `user_restrictions` → 0008, `app_settings` → 0009). Por eso están
-- escritas en plpgsql: el validador de plpgsql sólo revisa sintaxis y resuelve los
-- nombres de tabla en tiempo de ejecución. En `language sql` fallarían al crearse.
-- =====================================================================================


-- -------------------------------------------------------------------------------------
-- 1. Extensiones (PART 8 §8.2.4)
-- -------------------------------------------------------------------------------------
-- Supabase instala las extensiones en el esquema `extensions`, nunca en `public`; todo
-- el resto del esquema las referencia calificadas (`extensions.citext`,
-- `extensions.unaccent`, `extensions.gen_random_bytes`) para no depender del search_path.
-- pg_trgm queda deliberadamente afuera del MVP (§0.5-R21); pgtap sólo en dev/CI.

create schema if not exists extensions;

create extension if not exists pgcrypto with schema extensions;   -- gen_random_bytes → nanoid
create extension if not exists citext   with schema extensions;   -- handles únicos case-insensitive
create extension if not exists unaccent with schema extensions;   -- diccionario FTS es (§8.6)


-- -------------------------------------------------------------------------------------
-- 2. Privilegios por defecto: negar primero, otorgar por objeto (PART 8 §8.2.6)
-- -------------------------------------------------------------------------------------
-- Supabase otorga acceso amplio a anon/authenticated sobre `public` por defecto. Esto lo
-- revierte ANTES de que exista cualquier objeto, así "me olvidé de cerrarlo" se vuelve
-- imposible por construcción: el modo de falla pasa a ser un 42501 visible en desarrollo
-- en vez de una filtración silenciosa en producción. Cada objeto legible recibe después
-- su GRANT explícito (matriz en §8.3.9).
--
-- Advertencia documentada: estas tres sentencias revocan de anon/authenticated, no de
-- PUBLIC. Como las funciones nacen con EXECUTE para PUBLIC y ambos roles son miembros de
-- PUBLIC, cada función de este esquema lleva además su `revoke all ... from public`
-- explícito (regla 2 de §8.5). Las dos capas son necesarias, no redundantes.

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;


-- -------------------------------------------------------------------------------------
-- 3. public.nanoid() — identidad pública (PART 8 §8.2.1, tenet 3)
-- -------------------------------------------------------------------------------------
-- Código verbatim de §8.2.1. Alfabeto de 31 caracteres sin ambiguos (0/1/i/l/o) por D7;
-- 31^10 ≈ 8,2 × 10^14 combinaciones. El sesgo del módulo (256 mod 31 = 8) es
-- cosméticamente imperfecto y criptográficamente irrelevante: esto son localizadores,
-- no secretos. La colisión la resuelve el UNIQUE de cada tabla más un reintento dentro
-- de la RPC que crea la fila.
--
-- Sin `security definer` ni `set search_path` a propósito: es una función pura de
-- utilidad que sólo llama a `extensions.gen_random_bytes` (calificado) y a funciones de
-- pg_catalog (que se resuelven antes que cualquier esquema del search_path). Se usa como
-- DEFAULT de columna, y esos DEFAULT se evalúan dentro de las RPC SECURITY DEFINER
-- (dueño `postgres`), que sí tienen EXECUTE.

create or replace function public.nanoid(size int default 10)
returns text
language sql
volatile
as $$
  select string_agg(
    substr('23456789abcdefghjkmnpqrstuvwxyz',
           (get_byte(extensions.gen_random_bytes(1), 0) % 31) + 1, 1), '')
  from generate_series(1, size);
$$;

comment on function public.nanoid(int) is
  'Genera un identificador público de `size` caracteres (default 10) sobre el alfabeto de 31 símbolos 23456789abcdefghjkmnpqrstuvwxyz (sin 0/1/i/l/o). Es la identidad pública de posts, comments, resources e invites (PART 8 §8.2.1, tenet 3): los ids bigint internos nunca salen del servidor. Sin grants: se invoca sólo desde DEFAULT de columna y desde funciones SECURITY DEFINER.';

revoke all on function public.nanoid(int) from public, anon, authenticated;


-- -------------------------------------------------------------------------------------
-- 4. Búsqueda de texto completo en castellano (PART 8 §8.6, §0.5-R13)
-- -------------------------------------------------------------------------------------
-- Wrapper IMMUTABLE de unaccent: `extensions.unaccent(text)` es STABLE (resuelve el
-- diccionario en tiempo de ejecución), lo que lo descalifica para índices de expresión.
-- Pasarle el regdictionary fijo lo vuelve legítimamente IMMUTABLE. Verbatim de §8.6.
-- Sin `set search_path`: el literal 'extensions.unaccent'::regdictionary se resuelve a un
-- OID en tiempo de parseo, así que la función ya es inmune al search_path, y una cláusula
-- SET impediría que el planificador la inlinee dentro de los índices de expresión.

create or replace function public.f_unaccent(p_text text)
returns text
language sql immutable parallel safe
as $$ select extensions.unaccent('extensions.unaccent'::regdictionary, p_text) $$;

comment on function public.f_unaccent(text) is
  'Quita acentos de forma IMMUTABLE, apta para índices de expresión (PART 8 §8.6, §0.5-R13). Alimenta el typeahead: `create index on public.materias (f_unaccent(lower(nombre)) text_pattern_ops)` hace que "algebra" prefije "Álgebra" sin pg_trgm. Sin grants: la superficie de consulta son las funciones search_* (SECURITY DEFINER) de 0011.';

revoke all on function public.f_unaccent(text) from public, anon, authenticated;

-- Configuración de búsqueda `public.es`: stemming castellano + unaccent aplicados en el
-- mismo pipeline al vector almacenado y a la consulta, así 'práctico' y 'practico'
-- impactan idéntico (los estudiantes escriben sin tildes en el celular).
-- Caveat de mantenimiento: si esta configuración o el diccionario unaccent cambian alguna
-- vez, los tsvector ya almacenados NO se recalculan solos; esa migración futura tiene que
-- reescribir las columnas (`update ... set nombre = nombre` por tabla) y reindexar.

create text search configuration public.es (copy = pg_catalog.spanish);

alter text search configuration public.es
  alter mapping for hword, hword_part, word
  with extensions.unaccent, spanish_stem;

comment on text search configuration public.es is
  'Configuración FTS única del proyecto (PART 8 §8.6, §0.5-R13): copia de pg_catalog.spanish con unaccent antepuesto al stemmer para hword, hword_part y word. La usan las columnas generadas `search` de posts, materias, carreras y resources (pesos: título/nombre = A, cuerpo/descripción = C). Cambiarla obliga a reescribir y reindexar esos tsvector.';


-- -------------------------------------------------------------------------------------
-- 5. Funciones de trigger genéricas (PART 8 §8.5.1, §8.3.6)
-- -------------------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Trigger BEFORE UPDATE genérico: sella `updated_at` con now(). En el MVP lo usa sólo `profiles` (PART 8 §8.5.1); cualquier tabla futura con updated_at lo reutiliza. Sin grants: el permiso de EXECUTE de una función de trigger se verifica al crear el trigger (dueño postgres), no al dispararse.';

revoke all on function public.set_updated_at() from public, anon, authenticated;


create or replace function public.raise_immutable()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- PART 8 §8.3.6 describe esta guardia como `raise exception 'MOD_ACTIONS_IMMUTABLE'`,
  -- pero el contrato de errores (lib/errors.ts) sólo admite códigos de RPC_ERROR_CODES:
  -- se levanta NOT_ALLOWED y el detalle forense viaja en DETAIL, que nunca llega a la
  -- pantalla del estudiante. Esta excepción no debería dispararse jamás en operación
  -- normal: ningún rol de la aplicación tiene UPDATE/DELETE sobre mod_actions. Es el
  -- cinturón además de los tirantes, porque esa tabla es el registro de rendición de
  -- cuentas de la moderación (D14.10).
  raise exception 'NOT_ALLOWED'
    using detail = 'mod_actions es un registro inmutable (PART 8 §8.3.6): no admite UPDATE ni DELETE. Las correcciones son filas nuevas.';
end;
$$;

comment on function public.raise_immutable() is
  'Función de trigger que aborta toda modificación de la fila. La consume el trigger `mod_actions_immutable` (BEFORE UPDATE OR DELETE, migración 0008) para hacer del log de moderación un registro append-only (PART 8 §8.3.6, PART 9 §10.12). Levanta NOT_ALLOWED con el motivo real en DETAIL. Sin grants: función de trigger.';

revoke all on function public.raise_immutable() from public, anon, authenticated;


-- -------------------------------------------------------------------------------------
-- 6. Tiers de antigüedad y constantes de rate limit (§0.5-R6, PART 11 §11.6.2)
-- -------------------------------------------------------------------------------------

create or replace function public.account_tier(p_created_at timestamptz)
returns text
language sql
stable
parallel safe
as $$
  select case
           when p_created_at is null                          then 'T0'
           when p_created_at > now() - interval '48 hours'    then 'T0'
           when p_created_at > now() - interval '30 days'     then 'T1'
           else                                                    'T2'
         end;
$$;

comment on function public.account_tier(timestamptz) is
  'Devuelve el tier de antigüedad de una cuenta a partir de `profiles.created_at` (PART 11 §11.6.2): T0 = nueva (<48 h), T1 = reciente (48 h a 30 d), T2 = establecida (>30 d). Un created_at nulo se trata como T0 (el caso más restrictivo). Es la única definición de los umbrales: las RPC de escritura la llaman y con ese tier consultan public.rate_limits(). T0 existe porque casi todas las olas de spam salen de cuentas frescas.';

revoke all on function public.account_tier(timestamptz) from public, anon, authenticated;


create or replace function public.rate_limits()
returns table (accion text, tier text, ventana interval, limite int)
language sql
immutable
parallel safe
as $$
  select v.accion, v.tier, v.ventana, v.limite
  from (values
    -- accion        tier      ventana                  limite
    -- Publicaciones por hora y por día (PART 11 §11.6.2)
    ('posts'::text,     'T0'::text, interval '1 hour',    1::int),
    ('posts',           'T0',       interval '1 day',     3),
    ('posts',           'T1',       interval '1 hour',    4),
    ('posts',           'T1',       interval '1 day',    10),
    ('posts',           'T2',       interval '1 hour',    8),
    ('posts',           'T2',       interval '1 day',    20),

    -- Comentarios por hora y por día
    ('comments',        'T0',       interval '1 hour',    6),
    ('comments',        'T0',       interval '1 day',    20),
    ('comments',        'T1',       interval '1 hour',   20),
    ('comments',        'T1',       interval '1 day',    80),
    ('comments',        'T2',       interval '1 hour',   40),
    ('comments',        'T2',       interval '1 day',   150),

    -- Votos por hora (los tres toggle_*_vote comparten esta cuota)
    ('votes',           'T0',       interval '1 hour',   20),
    ('votes',           'T1',       interval '1 hour',   60),
    ('votes',           'T2',       interval '1 hour',  120),

    -- Reportes por día
    ('reports',         'T0',       interval '1 day',     5),
    ('reports',         'T1',       interval '1 day',    15),
    ('reports',         'T2',       interval '1 day',    25),

    -- Subidas de recursos por día (T0 = 1: alcanza para el primer apunte)
    ('uploads',         'T0',       interval '1 day',     1),
    ('uploads',         'T1',       interval '1 day',     5),
    ('uploads',         'T2',       interval '1 day',    10),

    -- Descargas por hora y por día: generosas para humanos, hostiles para scrapers.
    -- PART 11 §11.6.2 no fija estos números aunque PART 14 §14.5 los delegue en él;
    -- valores de arranque, tuneables con una migración de una línea como el resto.
    ('downloads',       'T0',       interval '1 hour',   10),
    ('downloads',       'T0',       interval '1 day',    30),
    ('downloads',       'T1',       interval '1 hour',   30),
    ('downloads',       'T1',       interval '1 day',   100),
    ('downloads',       'T2',       interval '1 hour',   60),
    ('downloads',       'T2',       interval '1 day',   200),

    -- Invitaciones creadas por mes (T0 = 0: una cuenta nueva no invita a nadie)
    ('invites',         'T0',       interval '30 days',   0),
    ('invites',         'T1',       interval '30 days',   5),
    ('invites',         'T2',       interval '30 days',  10),

    -- Cambio de seudónimo: 1 cada 90 días, igual para todos los tiers (D3).
    -- `rename_handle` lo aplica leyendo profiles.handle_changed_at, no contando filas.
    ('rename',          'T0',       interval '90 days',   1),
    ('rename',          'T1',       interval '90 days',   1),
    ('rename',          'T2',       interval '90 days',   1)
  ) as v(accion, tier, ventana, limite);
$$;

comment on function public.rate_limits() is
  $doc$Única fuente de las constantes de rate limit (§0.5-R6; valores de PART 11 §11.6.2). Forma: una fila por (accion, tier, ventana) con `limite` = cantidad máxima de acciones permitidas dentro de esa ventana. accion ∈ (posts, comments, votes, reports, uploads, downloads, invites, rename); tier ∈ (T0, T1, T2) según public.account_tier(profiles.created_at); ventana es un interval listo para restar de now(). No hay tabla de contadores (§8.3.8): cada RPC de escritura cuenta filas recientes por los índices (author_id, created_at) / (user_id, created_at), y las filas borradas siguen contando, así borrar contenido no resetea un límite. Uso típico dentro de una RPC:
  for r in select ventana, limite from public.rate_limits() where accion = 'posts' and tier = v_tier loop
    select count(*) into v_n from public.posts where author_id = v_uid and created_at > now() - r.ventana;
    if v_n >= r.limite then raise exception 'RATE_LIMIT'; end if;
  end loop;
Una combinación inexistente devuelve cero filas: el bucle no aplica ningún límite. Tunear es una migración de una línea, no una cacería de configuración. La cortina por IP del proxy es best-effort; la que tiene que aguantar es ésta (D14.9, PART 9 §10.9).$doc$;

revoke all on function public.rate_limits() from public, anon, authenticated;


-- -------------------------------------------------------------------------------------
-- 7. Helpers de guardia reutilizados por las RPC (PART 8 §8.5, §8.3.6)
-- -------------------------------------------------------------------------------------
-- Los cuatro son SECURITY DEFINER con search_path fijado (`public, pg_temp` — el footgun
-- clásico de escalada de privilegios en Supabase) y sin ningún grant: se invocan sólo
-- desde otras funciones SECURITY DEFINER, propiedad de `postgres`. Ningún rol de la
-- aplicación puede llamarlos ni leer, por esa vía, tablas que su RLS le niega.

create or replace function public.app_setting(p_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_value jsonb;
begin
  select s.value into v_value
  from public.app_settings s
  where s.key = p_key;

  return v_value;   -- null cuando la clave no existe: el llamador trata "sin fila" como apagado
end;
$$;

comment on function public.app_setting(text) is
  'Lee un flag de app_settings (migración 0009) saltando la RLS admin-only de esa tabla, para que las RPC puedan consultar los kill switches en su paso de guardia (PART 9 §10.14: read_only, signups_paused, uploads_paused; PART 11 §11.6.5: pausa de publicación para cuentas T0). Devuelve el jsonb crudo, o null si la clave no está cargada — el llamador debe interpretar "sin fila" como interruptor apagado y levantar KILL_SWITCH cuando corresponda. Deliberadamente NO se chequea dentro de assert_can_write(): qué switch aplica depende de la acción.';

revoke all on function public.app_setting(text) from public, anon, authenticated;


create or replace function public.current_profile()
returns table (
  id                uuid,
  handle            text,
  handle_changed_at timestamptz,
  carrera_id        bigint,
  ingreso_year      smallint,
  karma             int,
  notif_respuestas  boolean,
  role              text,
  status            text,
  invited_with      bigint,
  created_at        timestamptz,
  updated_at        timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return;   -- sin sesión: cero filas, nunca una excepción (quien necesite el error usa assert_can_write)
  end if;

  return query
    select p.id, p.handle::text, p.handle_changed_at, p.carrera_id, p.ingreso_year,
           p.karma, p.notif_respuestas, p.role, p.status, p.invited_with,
           p.created_at, p.updated_at
    from public.profiles p
    where p.id = v_uid;
end;
$$;

comment on function public.current_profile() is
  'Devuelve la fila de public.profiles del auth.uid() actual, o cero filas si no hay sesión o el perfil todavía no existe. Espeja todas las columnas de la tabla (PART 8 §8.3.2) con `handle` casteado a text; no puede declararse `returns setof public.profiles` porque en la migración 0001 esa tabla aún no existe. Es el atajo de las RPC para leer estado propio (status, role, created_at para el tier) sin repetir el join contra auth.uid(). Sin grants: el cliente lee su propio perfil por la política RLS de self-read, no por acá.';

revoke all on function public.current_profile() from public, anon, authenticated;


create or replace function public.has_active_restriction(p_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_active boolean;
begin
  select exists (
    select 1
    from public.user_restrictions r
    where r.user_id = p_user_id
      and r.revoked_at is null
      and (r.until is null or r.until > now())
  ) into v_active;

  return coalesce(v_active, false);
end;
$$;

comment on function public.has_active_restriction(uuid) is
  'Predicado central de restricciones (PART 8 §8.3.6): true si el usuario tiene una fila en user_restrictions con revoked_at nulo y (until nulo = permanente, o until futuro). Centraliza la definición de "restricción activa" para que suspensiones y bans se evalúen igual en toda la base. profiles.status espeja la peor restricción vigente para chequeos baratos y para la vista pública, pero la verdad está acá. Sin grants: lo llaman assert_can_write() y las RPC de moderación.';

revoke all on function public.has_active_restriction(uuid) from public, anon, authenticated;


create or replace function public.assert_can_write()
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_status text;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select p.status into v_status
  from public.profiles p
  where p.id = v_uid;

  -- Sin fila de perfil, o con el perfil todavía en 'nuevo': el onboarding no terminó,
  -- así que no puede publicar (PART 8 §8.3.2 — handle_new_user crea la fila en 'nuevo'
  -- y complete_onboarding la pasa a 'activo').
  if v_status is null or v_status = 'nuevo' then
    raise exception 'NOT_ONBOARDED';
  end if;

  -- Suspendida, baneada o eliminada: la sesión puede seguir viva, la escritura no.
  -- 'eliminado' entra acá para que las sesiones de una cuenta borrada mueran en el acto
  -- mientras el cron de admin termina de eliminar la fila de auth (§8.5.2).
  if v_status in ('suspendido', 'baneado', 'eliminado') then
    raise exception 'RESTRICTED';
  end if;

  -- Segunda vuelta contra la fuente de verdad: profiles.status es un espejo que puede
  -- ir atrasado hasta que el job nocturno re-deriva las suspensiones vencidas.
  if public.has_active_restriction(v_uid) then
    raise exception 'RESTRICTED';
  end if;

  return v_uid;
end;
$$;

comment on function public.assert_can_write() is
  'Guardia estándar del paso 1 de toda RPC de escritura (PART 8 §8.5, regla 3). Levanta NOT_AUTHENTICATED si no hay sesión, NOT_ONBOARDED si no hay perfil o sigue en status nuevo, y RESTRICTED si el perfil está suspendido/baneado/eliminado o tiene una restricción activa. Si pasa, devuelve el uuid del autor, así la RPC lo usa directo: `v_uid := public.assert_can_write();` (o `perform public.assert_can_write();` si no lo necesita). No cubre rate limits (ver public.rate_limits()) ni kill switches (ver public.app_setting()): ésos dependen de la acción concreta.';

revoke all on function public.assert_can_write() from public, anon, authenticated;
