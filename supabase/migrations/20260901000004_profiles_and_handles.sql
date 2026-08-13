-- =============================================================================
-- 0004 — Identidad: profiles, handle_history, handle_blocklist
-- PART 8 §8.3.2 + §8.5.1 (triggers) + §8.3.7 (consumo de invitación, §0.5-R18)
-- =============================================================================
-- Contenido de esta migración:
--   1. public.profiles              — la identidad seudónima (D3). PK = auth.users.id, SIN FK.
--   2. public.handle_history        — libro interno de renombrados (cuarentena 90 días, §0.5-R8).
--   3. public.handle_blocklist      — seudónimos reservados (§0.5-R8, PART 9 §9.4.2).
--   4. FK diferida invites.created_by → profiles.id (el paso en dos tiempos de §8.10.1)
--      y la política de lectura de invites para admins, que recién ahora es escribible
--      porque necesita consultar profiles.role.
--   5. Trigger set_updated_at sobre profiles.
--   6. Trigger handle_new_user sobre auth.users: consume la invitación y crea el perfil.
--
-- Dependencias: 0001 (public.nanoid, public.set_updated_at, public.app_setting, extensions.citext),
--               0002 (public.carreras), 0003 (public.invites).
-- Tenets aplicados: 1 (RLS en todas las tablas), 3 (identidad pública = handle, nunca la PK
--               interna), 6 (las escrituras son funciones, no grants), 8 (created_at siempre),
--               10 (el esquema se documenta en el esquema).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. profiles
-- -----------------------------------------------------------------------------
-- La PK es el UUID de auth.users pero NO lleva FK a propósito (§8.3.2): al borrar la
-- cuenta se destruye la fila de auth mientras el perfil sobrevive como cáscara
-- anonimizada (D3), y una FK en cualquiera de las dos direcciones lo impediría.
-- La integridad de sincronización la sostienen el trigger handle_new_user (alta) y
-- la RPC delete_account (baja, 0011).
-- Email, contraseña y datos de recuperación viven SOLO en auth.users: nunca acá.

create table public.profiles (
  id                uuid primary key,                       -- = auth.users.id, sin FK por diseño
  handle            extensions.citext not null unique
                    constraint profiles_handle_check
                    check (handle::text ~ '^[a-zA-Z0-9_]{3,24}$' and handle::text ~ '[a-zA-Z]'),
  handle_changed_at timestamptz null,                       -- null = nunca renombró (la primera elección es gratis)
  carrera_id        bigint null references public.carreras(id) on delete set null,
  ingreso_year      smallint null
                    constraint profiles_ingreso_year_check
                    check (ingreso_year between 2000 and 2100),
  karma             int not null default 0,
  notif_respuestas  boolean not null default true,          -- prefs v1: el único interruptor de notificaciones (§0.5-R14)
  last_seen_day     date null,                              -- PART 24 §24.4: DAU/WAU/MAU sin log por usuario
  role              text not null default 'user'
                    constraint profiles_role_check
                    check (role in ('user','mod','admin')),
  status            text not null default 'nuevo'
                    constraint profiles_status_check
                    check (status in ('nuevo','activo','suspendido','baneado','eliminado')),
  invited_with      bigint null references public.invites(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.profiles is
  'Identidad seudónima de cada cuenta (D3). La PK es el UUID de auth.users pero no hay FK: al eliminar la cuenta se destruye la fila de auth y el perfil queda como cáscara anonimizada. Nunca se borra físicamente. Ningún dato de contacto (email, contraseña, recuperación) vive acá: eso es exclusivo de auth.users.';

comment on column public.profiles.id is
  'UUID de auth.users. Sin FK a propósito (§8.3.2). Es el destino de todos los author_id/user_id del esquema, siempre ON DELETE RESTRICT, seguro porque las filas de profiles nunca se borran.';
comment on column public.profiles.handle is
  'Seudónimo público, único. citext: unicidad y búsqueda case-insensitive, display conservando las mayúsculas que el estudiante tipeó. Regla §0.5-R8 / PART 9 §9.4.1: 3 a 24 caracteres [A-Za-z0-9_] con al menos una letra. Sin puntos, guiones, espacios ni no-ASCII (los handles viven en /u/[handle] y el Unicode habilita homoglifos).';
comment on column public.profiles.handle_changed_at is
  'Momento del último renombrado. NULL = nunca renombró; la primera elección en el onboarding no la setea (es gratis). rename_handle mide contra esta columna el cooldown de 90 días (HANDLE_COOLDOWN).';
comment on column public.profiles.carrera_id is
  'Carrera declarada por el estudiante, opcional. ON DELETE SET NULL: una corrección del catálogo nunca puede romper un perfil. Junto con ingreso_year forma la cohorte (D1) que alimenta el feed "Mis materias".';
comment on column public.profiles.ingreso_year is
  'Año de ingreso declarado, opcional. Dato de cohorte, no de identidad: no se muestra con precisión de fecha en ningún lado.';
comment on column public.profiles.karma is
  'Suma de upvotes recibidos en posts, comentarios y recursos. Los votos NUNCA la tocan en el momento: reconcile_counters la recalcula entera todas las noches (§0.5-R7). Ese batch diario es justamente lo que impide correlacionar el karma de contenido anónimo con su autor (C5).';
comment on column public.profiles.last_seen_day is
  'Único dato de actividad que guardamos por persona (PART 24 §24.4): la fecha del último día que usó el sitio, sobrescrita en el lugar. El valor de ayer se destruye al actualizar, así que la conducta pasada es irreconstruible incluso para nosotros. Alimenta DAU (se incrementa el evento al avanzar el día), WAU/MAU en el cron nocturno y las cohortes de retorno semanal del portón de D11. Declarado en la Política de Privacidad. NO existe en el DDL de PART 8 §8.3.2: es un requisito de PART 24 que esa parte no absorbió; ver docs/decisions.md.';

comment on column public.profiles.notif_respuestas is
  'Preferencia de notificaciones v1, la única (§0.5-R14): en false silencia respuesta_post y respuesta_comentario. decision_mod y reporte_resuelto son siempre-activas, no desactivables.';
comment on column public.profiles.role is
  'user | mod | admin. Solo admin cambia roles, gestiona invitaciones en volumen y toca los kill-switches.';
comment on column public.profiles.status is
  'nuevo (registrado, sin onboarding) | activo | suspendido | baneado | eliminado. Las RPC de contenido exigen activo, así que una cuenta a medio onboardear no puede publicar. Las suspensiones vencidas las devuelve a activo el job nocturno.';
comment on column public.profiles.invited_with is
  'Invitación consumida en el registro (la setea handle_new_user). Da el árbol de invitaciones para forense de abuso sin necesidad de una tabla de redenciones. Se pone en NULL al anonimizar la cuenta (§8.7).';
comment on column public.profiles.updated_at is
  'Lo mantiene el trigger set_updated_at. Marca cualquier mutación del perfil, no solo el renombrado.';

-- Índices (§8.3.2). PK y unique handle son implícitos.
create index profiles_carrera_id_idx on public.profiles (carrera_id);
create index profiles_role_idx       on public.profiles (role)   where role <> 'user';
create index profiles_status_nuevo_idx on public.profiles (status) where status = 'nuevo';

comment on index public.profiles_role_idx is
  'Parcial: lista de moderadores y admins. En una tabla donde el 99,9% es role = ''user'', el índice pesa nada.';
comment on index public.profiles_status_nuevo_idx is
  'Parcial: limpieza de altas abandonadas (status = ''nuevo'' con más de 30 días, §8.7) y chequeo de onboarding.';

-- RLS (tenet 1). Solo lectura de la propia fila: el resto del mundo lee profiles_public (0010).
alter table public.profiles enable row level security;

create policy profiles_select_self on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()));

comment on policy profiles_select_self on public.profiles is
  'Única política de la tabla: cada cuenta lee su propia fila (para /ajustes y para los guards del servidor). No hay política de insert/update/delete para ningún rol: toda mutación pasa por las RPC SECURITY DEFINER (tenet 6). auth.uid() va envuelto en un subselect para que el planner lo evalúe una sola vez.';

-- Grants explícitos (§8.2.6: deny first, grant per object; matriz §8.3.9).
-- anon no recibe nada: los perfiles públicos se leen por la vista profiles_public.
grant select on table public.profiles to authenticated;


-- -----------------------------------------------------------------------------
-- 2. handle_history
-- -----------------------------------------------------------------------------

create table public.handle_history (
  id          bigint generated always as identity primary key,
  profile_id  uuid not null references public.profiles(id) on delete restrict,
  old_handle  extensions.citext not null,
  changed_at  timestamptz not null default now()   -- hace también de created_at (tenet 8)
);

comment on table public.handle_history is
  'Libro interno de renombrados (§0.5-R8). Sirve para dos cosas: (a) mantener un handle liberado en cuarentena 90 días antes de que otra persona pueda reclamarlo, y (b) darle forense de renombrados a moderación. NO es historial público de nombres: eso no existe en el producto (C4).';

comment on column public.handle_history.profile_id is
  'Quién liberó el handle. ON DELETE RESTRICT y sin riesgo: las filas de profiles nunca se borran, las cáscaras persisten.';
comment on column public.handle_history.old_handle is
  'El seudónimo liberado, citext. rename_handle y complete_onboarding rechazan cualquier handle presente acá con changed_at > now() - 90 días, salvo que la fila sea del propio solicitante (volver al nombre anterior siempre se puede).';
comment on column public.handle_history.changed_at is
  'Momento de la liberación. Hace de created_at (tenet 8) y es contra lo que se mide la cuarentena.';

create index handle_history_old_handle_idx on public.handle_history (old_handle);
create index handle_history_profile_id_changed_at_idx on public.handle_history (profile_id, changed_at desc);

comment on index public.handle_history_old_handle_idx is 'Consulta de cuarentena: ¿este handle estuvo en uso hace menos de 90 días?';
comment on index public.handle_history_profile_id_changed_at_idx is 'Forense: la línea de tiempo de nombres de una cuenta.';

-- RLS habilitada, CERO políticas y CERO grants a propósito (§8.3.2, §8.3.9):
-- la tabla es alcanzable únicamente desde funciones SECURITY DEFINER (complete_onboarding,
-- rename_handle) y desde herramientas service-side. Sin política no hay fila visible:
-- eso es el diseño, no un olvido (tenet 1).
alter table public.handle_history enable row level security;
revoke all on table public.handle_history from anon, authenticated;


-- -----------------------------------------------------------------------------
-- 3. handle_blocklist
-- -----------------------------------------------------------------------------

create table public.handle_blocklist (
  handle     extensions.citext primary key,
  created_at timestamptz not null default now()
);

comment on table public.handle_blocklist is
  'Seudónimos reservados y de alto riesgo de abuso (§0.5-R8, PART 9 §9.4.2). La consultan complete_onboarding y rename_handle, que además rechazan los prefijos reservados (usuario_eliminado_, estudiante_) — los prefijos no viven acá porque el sistema mismo tiene que poder asignarlos. El matcheo normalizado (minúsculas, sin guiones bajos, leet 0→o/1→l/3→e/4→a/5→s/7→t) lo hace la RPC contra esta misma lista: la tabla guarda la forma canónica y nada más.';

comment on column public.handle_blocklist.handle is
  'Forma canónica del seudónimo bloqueado. citext, así que bloquea todas las variantes de mayúsculas de una sola fila.';

-- RLS habilitada, cero políticas y cero grants: se lee solo dentro de las RPC de identidad.
alter table public.handle_blocklist enable row level security;
revoke all on table public.handle_blocklist from anon, authenticated;

-- Semilla de nombres reservados.
-- ÚNICA excepción a "las migraciones no traen datos" (§8.10.2): esto es CONFIGURACIÓN del
-- sistema, no contenido. Un handle reservado es parte de las reglas del producto igual que
-- un CHECK; si viviera en el seed de catálogo, un entorno sin seed permitiría registrar
-- @moderador. La lista se amplía con nuevas migraciones forward-only, nunca desde la app.
-- Categorías (PART 9 §9.4.2): suplantación de autoridad, colisión con el estado "Anónimo",
-- institución (D10), estados de sistema y palabras de ruta.
insert into public.handle_blocklist (handle) values
  ('moderador'),
  ('admin'),
  ('mod'),
  ('uca'),
  ('ucanet'),
  ('anonimo'),
  ('anónimo'),
  ('equipo'),
  ('soporte'),
  ('ayuda'),
  ('staff'),
  ('oficial'),
  ('root'),
  ('sistema'),
  ('api'),
  ('null'),
  ('undefined')
on conflict (handle) do nothing;


-- -----------------------------------------------------------------------------
-- 4. La FK que faltaba: invites.created_by → profiles.id
-- -----------------------------------------------------------------------------
-- El paso en dos tiempos documentado en §8.10.1: profiles.invited_with apunta a invites,
-- así que invites se crea primero (0003) sin su FK a profiles, y la FK se agrega acá,
-- una vez que profiles existe. ON DELETE RESTRICT porque las cáscaras de perfil persisten.

alter table public.invites
  add constraint invites_created_by_fkey
  foreign key (created_by) references public.profiles(id) on delete restrict;

comment on constraint invites_created_by_fkey on public.invites is
  'Cierre del ciclo profiles ⇄ invites (§8.10.1). RESTRICT: una invitación siempre resuelve a un perfil, aunque ese perfil sea una cáscara eliminada.';

-- Y ahora sí la política de lectura de invites para admins: recién es escribible porque
-- necesita consultar profiles.role. La política de "mis propias invitaciones"
-- (`select_own`, created_by = auth.uid()) vive en 0003, que no dependía de nada.
-- El nombre `select_admin` y esta forma son los que 0003 dejó anunciados en su encabezado.
-- El subselect sobre profiles se evalúa con la RLS del usuario: la política
-- profiles_select_self le deja ver exactamente su propia fila, que es la que hace falta.
-- Sin recursión posible: ninguna política de profiles mira invites.
create policy select_admin on public.invites
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'admin'
    )
  );

comment on policy select_admin on public.invites is
  'Los admins ven todas las invitaciones (el árbol de invitaciones es forense de abuso, PART 11). Los mods ven solo las suyas, por la política select_own de 0003. La creación sigue siendo exclusiva de la RPC create_invite.';

-- El `grant select on public.invites to authenticated` que esta política necesita para valer
-- algo ya lo dio 0003 junto con select_own. No se repite: los grants de una tabla viven en la
-- migración que la crea.


-- -----------------------------------------------------------------------------
-- 5. Trigger set_updated_at sobre profiles (§8.5.1)
-- -----------------------------------------------------------------------------

create trigger set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

comment on trigger set_updated_at on public.profiles is
  'Mantiene updated_at en cada UPDATE. La función genérica se define en 0001.';


-- -----------------------------------------------------------------------------
-- 6. handle_new_user: alta de perfil + consumo atómico de la invitación
-- -----------------------------------------------------------------------------
-- Es el único código de todo el esquema que toca el schema auth (tenet 9: las superficies
-- propias de Supabase quedan aisladas y marcadas).
--
-- Qué hace, en orden:
--   a. Lee el código de invitación de new.raw_user_meta_data->>'invite_code' (lo manda la
--      Server Action de signup en auth.signUp({ options: { data: { invite_code } } })).
--   b. Si hay código: lo consume ATÓMICAMENTE con el UPDATE ... RETURNING de §8.3.7. Un solo
--      statement valida (no revocada, no vencida, con usos disponibles) y descuenta a la vez,
--      así que dos registros simultáneos con el último uso disponible no pueden pasar los dos:
--      el segundo no encuentra fila y aborta. Cero filas ⇒ INVITE_INVALID (§0.5-R18).
--   c. Si NO hay código: el registro está gated por invitación (D3), así que por defecto
--      falla igual, con el mismo INVITE_INVALID.
--
-- KILL-SWITCH DE REGISTRO ABIERTO (la decisión que este archivo tuvo que tomar):
--   public.app_setting('registro_abierto') = jsonb true habilita el alta SIN invitación.
--   Existe porque el portón por invitación es una etapa del producto, no una propiedad
--   permanente: D11 abre el registro cuando la beta pasa su gate de retención, y ese día
--   no puede depender de un deploy ni de una migración (§0.5-R22, PART 10 §10.14: los
--   kill-switches viven en app_settings y se prenden desde el panel de admin).
--   La clave la siembra 0009 en 'false', y el helper app_setting() de 0001 devuelve null
--   si no existe: ausente o false significan lo mismo, portón cerrado. El default seguro
--   es siempre exigir invitación.
--   El interruptor solo levanta la EXIGENCIA de código; un código provisto pero inválido
--   sigue fallando, con el registro abierto o cerrado. Ignorar en silencio un código mal
--   tipeado sería peor: rompe el árbol de invitaciones y deja al estudiante sin enterarse
--   de que su código no se aplicó.
--   Es un interruptor distinto de 'publicaciones_pausadas' y 'subidas_pausadas' (0009):
--   esos cortan escrituras ya autenticadas; este solo decide si hace falta invitación.
--
-- Si algo levanta excepción acá, la transacción del signup se cae entera: no queda ni la
-- fila de auth.users ni un perfil huérfano. Esa atomicidad es el punto de hacerlo en trigger.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_code      text;
  v_invite_id bigint;
begin
  v_code := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'invite_code', '')), '');

  if v_code is not null then
    -- Consumo atómico (§8.3.7 / §0.5-R18). El lower() acompaña al CHECK de invites.code,
    -- que solo admite minúsculas: un código pegado en mayúsculas sigue siendo válido.
    update public.invites
       set uses = uses + 1
     where code = lower(v_code)
       and revoked_at is null
       and (expires_at is null or expires_at > now())
       and uses < max_uses
    returning id into v_invite_id;

    if v_invite_id is null then
      raise exception 'INVITE_INVALID';
    end if;
  else
    -- Sin código: solo pasa si el kill-switch de registro abierto está prendido.
    -- app_setting() (0001) devuelve null cuando la clave no está cargada; null y false
    -- se tratan igual: portón cerrado.
    if coalesce(public.app_setting('registro_abierto'), 'false'::jsonb) <> 'true'::jsonb then
      raise exception 'INVITE_INVALID';
    end if;
  end if;

  -- Perfil con handle placeholder: 'estudiante_' + nanoid(6) (el guion bajo es lo que hace
  -- que satisfaga el CHECK del handle). complete_onboarding (0011) lo reemplaza por el
  -- seudónimo real y pasa status de 'nuevo' a 'activo'.
  -- Colisión de nanoid: la resuelven el UNIQUE más un único reintento (§8.2.1).
  begin
    insert into public.profiles (id, handle, status, invited_with)
    values (new.id, 'estudiante_' || public.nanoid(6), 'nuevo', v_invite_id);
  exception when unique_violation then
    insert into public.profiles (id, handle, status, invited_with)
    values (new.id, 'estudiante_' || public.nanoid(6), 'nuevo', v_invite_id);
  end;

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Trigger de alta de cuenta (§8.5.1): consume la invitación de raw_user_meta_data->>''invite_code'' con el UPDATE ... RETURNING atómico de §0.5-R18 e inserta la fila de profiles con handle placeholder estudiante_<nanoid(6)> y status ''nuevo''. Sin código válido levanta INVITE_INVALID, que aborta el signup entero — salvo que el kill-switch app_setting(''registro_abierto'') esté en true, único caso en que se admite un alta sin invitación. Único objeto del esquema que toca auth.';

-- Función de trigger: no la ejecuta nadie por RPC. Los permisos de EXECUTE se chequean al
-- crear el trigger, no al dispararlo, así que revocar todo no la rompe.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Alta atómica: la invitación se consume y el perfil se crea dentro de la misma transacción
-- que crea el usuario de auth. Si algo falla, no queda ni el usuario ni el perfil.
-- (Sin COMMENT ON TRIGGER: comentar un trigger exige ser dueño de la tabla, y auth.users
-- pertenece a supabase_auth_admin. La documentación de este objeto vive en el COMMENT de
-- la función, que sí es nuestra.)
create trigger handle_new_user
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
