-- ============================================================================
-- 0011a — RPC de identidad, contenido, votos y búsqueda
-- PART 8 §8.5.2 (identidad), §8.5.3 (contenido + búsqueda), §8.5.4 (votos).
--
-- Este archivo no crea tablas: la RLS de cada tabla ya quedó habilitada en
-- 0002–0009. Acá viven las funciones que SON la superficie de escritura
-- (tenet 6: "writes are functions, not table grants") — las tablas de contenido
-- no otorgan INSERT/UPDATE a ningún rol de la app.
--
-- Reglas uniformes, verificadas por el meta-test pgTAP sobre pg_proc:
--   1. `security definer` + `set search_path = public, pg_temp` en TODAS.
--   2. `revoke execute ... from public, anon` y luego `grant execute ... to
--      authenticated`; `anon` solo en las funciones de búsqueda (son lecturas
--      públicas sobre las vistas _public) y en el escritor de telemetría.
--   3. Primer paso de toda escritura: `assert_can_write()` (migración 0001),
--      que resuelve `auth.uid()`, carga el perfil y aborta con
--      NOT_AUTHENTICATED / NOT_ONBOARDED / RESTRICTED. Dos excepciones
--      deliberadas, explicadas en su lugar: `complete_onboarding` (el llamante
--      todavía es `nuevo`) y `delete_account` (una cuenta suspendida o baneada
--      conserva el derecho a borrarse — PART 9 §9.9, Ley 25.326).
--   4. Límites de tasa contando filas recientes por los índices
--      (author_id, created_at) / (user_id, created_at) — sin tabla de
--      contadores (§0.5-R6). Las filas borradas siguen contando.
--   5. Errores: `raise exception '<CODE>'` con códigos de RPC_ERROR_CODES
--      (lib/errors.ts). Ningún mensaje crudo de Postgres llega a la pantalla.
--
-- Anonimato: `author_id` se guarda siempre (moderación, límites, legal); lo que
-- nunca sale es la unión autor ↔ contenido anónimo, que solo las vistas _public
-- y estas funciones definer pueden mirar (D5, D14.5).
-- ============================================================================


-- ============================================================================
-- 0. Helpers internos
-- ============================================================================

create or replace function public.rate_limit_for(
  p_action             text,
  p_account_created_at timestamptz
)
returns int
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_tier    text;
  v_accion  text;
  v_sufijo  text;
  v_ventana interval;
  v_limite  int;
begin
  -- Tramos por antigüedad de cuenta (PART 11 §11.6.2):
  --   T0 nueva (<48 h) · T1 reciente (48 h–30 d) · T2 establecida (>30 d).
  -- Se delega en public.account_tier() (0001), que es la ÚNICA definición de los
  -- umbrales y además trata un created_at nulo como T0 (el caso más restrictivo).
  v_tier := public.account_tier(p_account_created_at);

  -- Los VALORES viven en `rate_limits()` (migración 0001) para que tunearlos sea
  -- una migración de una línea (§0.5-R6). Esa función devuelve un CONJUNTO de
  -- filas (accion, tier, ventana, limite) — no un jsonb —, así que se consulta
  -- con un SELECT ... FROM y no con una asignación escalar.
  -- La clave que reciben las RPC es '<accion>_<ventana>' ('posts_hour',
  -- 'reports_day', 'invites_month'); acá se parte en sus dos mitades para
  -- casarla contra la tabla de constantes.
  v_accion := split_part(p_action, '_', 1);
  v_sufijo := substr(p_action, length(v_accion) + 2);
  v_ventana := case v_sufijo
                 when 'hour'  then interval '1 hour'
                 when 'day'   then interval '1 day'
                 when 'month' then interval '30 days'
               end;

  if v_ventana is not null then
    select r.limite
      into v_limite
      from public.rate_limits() r
     where r.accion = v_accion
       and r.tier   = v_tier
       and r.ventana = v_ventana;

    if v_limite is not null then
      return v_limite;
    end if;
  end if;

  -- Respaldo con los valores de PART 11 §11.6.2, por si una clave todavía no
  -- está cargada en rate_limits(): el límite se aplica igual, solo que deja de
  -- ser tuneable desde un solo lugar.
  return case p_action
    when 'posts_hour'     then case v_tier when 'T0' then   1 when 'T1' then   4 else   8 end
    when 'posts_day'      then case v_tier when 'T0' then   3 when 'T1' then  10 else  20 end
    when 'comments_hour'  then case v_tier when 'T0' then   6 when 'T1' then  20 else  40 end
    when 'comments_day'   then case v_tier when 'T0' then  20 when 'T1' then  80 else 150 end
    when 'votes_hour'     then case v_tier when 'T0' then  20 when 'T1' then  60 else 120 end
    when 'reports_day'    then case v_tier when 'T0' then   5 when 'T1' then  15 else  25 end
    when 'uploads_day'    then case v_tier when 'T0' then   1 when 'T1' then   5 else  10 end
    when 'invites_month'  then case v_tier when 'T0' then   0 when 'T1' then   5 else  10 end
    -- Descargas: PART 11 §11.6.2 no fija un número (PART 14 §14.6 solo pide
    -- "generoso para humanos, hostil para scrapers"). El valor vigente es el de
    -- rate_limits(); esto es solo la red de contención.
    when 'downloads_hour' then case v_tier when 'T0' then  10 when 'T1' then  30 else  60 end
    else 0
  end;
end;
$$;

comment on function public.rate_limit_for(text, timestamptz) is
  'Límite de tasa para una acción según el tramo de antigüedad de la cuenta (PART 11 §11.6.2). Lee las constantes de rate_limits() (0001) y cae a los valores del plan si la clave no está.';

-- Sin grant a authenticated: es un helper interno. Las RPC que lo usan son SECURITY
-- DEFINER y corren como el dueño, así que no necesitan el privilegio; exponerlo dejaría
-- sondear los límites de tasa por tramo desde el cliente.
revoke execute on function public.rate_limit_for(text, timestamptz) from public, anon, authenticated;


create or replace function public.assert_handle_ok(
  p_handle     text,
  p_profile_id uuid
)
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_handle text := btrim(coalesce(p_handle, ''));
begin
  -- Forma del seudónimo (PART 9 §9.4.1, §0.5-R8): 3–24 de [A-Za-z0-9_],
  -- al menos una letra, sin puntos, guiones, espacios ni Unicode.
  if v_handle !~ '^[a-zA-Z0-9_]{3,24}$' or v_handle !~ '[a-zA-Z]' then
    raise exception 'HANDLE_INVALID';
  end if;

  -- Prefijos que el sistema se reserva para sí mismo: los asigna
  -- `handle_new_user` (estudiante_) y `delete_account` (usuario_eliminado_).
  if left(lower(v_handle), 11) = 'estudiante_'
     or left(lower(v_handle), 18) = 'usuario_eliminado_' then
    raise exception 'HANDLE_RESERVED';
  end if;

  -- Blocklist (PART 9 §9.4.2): coincidencia exacta (citext) y coincidencia
  -- normalizada — minúsculas, sin guiones bajos, con el mapeo leet
  -- 0→o 1→l 3→e 4→a 5→s 7→t @→a — para atrapar `m0derador`, `M_o_d`, `an0nimo`.
  -- Nota: con `search_path = public, pg_temp` los operadores de citext (que
  -- viven en el esquema `extensions`) no son visibles, y un `=` pelado
  -- degradaría en silencio a comparación de texto sensible a mayúsculas; por
  -- eso se nombra el operador explícitamente.
  if exists (
    select 1
      from public.handle_blocklist b
     where b.handle operator(extensions.=) v_handle::extensions.citext
        or translate(lower(replace(b.handle::text, '_', '')), '013457@', 'oleasta')
         = translate(lower(replace(v_handle, '_', '')), '013457@', 'oleasta')
  ) then
    raise exception 'HANDLE_RESERVED';
  end if;

  -- Cuarentena de 90 días sobre seudónimos liberados (PART 9 §9.5): nadie
  -- hereda la reputación de un nombre recién soltado. El dueño original sí
  -- puede recuperarlo.
  if exists (
    select 1
      from public.handle_history h
     where h.old_handle operator(extensions.=) v_handle::extensions.citext
       and h.changed_at > now() - interval '90 days'
       and h.profile_id is distinct from p_profile_id
  ) then
    raise exception 'HANDLE_TAKEN';
  end if;
end;
$$;

comment on function public.assert_handle_ok(text, uuid) is
  'Valida forma, prefijos reservados, blocklist normalizada y cuarentena de 90 días de un seudónimo. La unicidad no se chequea acá: la garantiza el índice único citext de profiles.handle (HANDLE_TAKEN al insertar).';

-- Sin grant a authenticated, a propósito: exponerlo permitiría sondear la blocklist
-- normalizada y la cuarentena de 90 días de handle_history distinguiendo
-- HANDLE_RESERVED de HANDLE_TAKEN sin intentar el rename. Lo llaman
-- complete_onboarding y rename_handle, que son SECURITY DEFINER y corren como dueño.
revoke execute on function public.assert_handle_ok(text, uuid) from public, anon, authenticated;


-- ============================================================================
-- 1. IDENTIDAD — PART 8 §8.5.2
-- ============================================================================

create or replace function public.complete_onboarding(
  p_handle       text,
  p_carrera_id   bigint   default null,
  p_ingreso_year smallint default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_status text;
  v_handle text := btrim(coalesce(p_handle, ''));
begin
  -- No usa assert_can_write() a propósito: el llamante está en `nuevo` y ese
  -- helper (correctamente) rechaza a los no-onboardeados. El guard equivalente
  -- se hace acá a mano.
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select p.status into v_status
    from public.profiles p
   where p.id = v_uid
     for update;

  if not found or v_status = 'eliminado' then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if v_status in ('suspendido', 'baneado') then
    raise exception 'RESTRICTED';
  end if;
  if v_status <> 'nuevo' then
    -- Ya tiene perfil terminado: el seudónimo se cambia con rename_handle.
    raise exception 'NOT_ALLOWED';
  end if;

  perform public.assert_handle_ok(v_handle, v_uid);

  if p_carrera_id is not null
     and not exists (select 1 from public.carreras c where c.id = p_carrera_id) then
    raise exception 'INVALID_INPUT';
  end if;

  if p_ingreso_year is not null and p_ingreso_year not between 2000 and 2100 then
    raise exception 'INVALID_INPUT';
  end if;

  -- La primera elección de seudónimo es gratis: NO se toca handle_changed_at,
  -- así el cooldown de 90 días empieza recién en el primer rename real (§8.5.2).
  begin
    update public.profiles
       set handle       = v_handle,
           carrera_id   = p_carrera_id,
           ingreso_year = p_ingreso_year,
           status       = 'activo',
           updated_at   = now()
     where id = v_uid;
  exception when unique_violation then
    raise exception 'HANDLE_TAKEN';
  end;

  -- El auto-follow de las materias del año (PART 6 §6.1 S4) NO se hace acá: la
  -- firma de §8.5.2 no recibe la lista y el usuario la edita antes de mandar;
  -- `materia_follows` es la única tabla escribible por policy (§8.3.4), así que
  -- la Server Action inserta las filas elegidas directamente.
end;
$$;

comment on function public.complete_onboarding(text, bigint, smallint) is
  'Cierra el alta: fija el seudónimo real, carrera e ingreso opcionales y pasa el perfil de nuevo a activo (PART 8 §8.5.2).';

revoke execute on function public.complete_onboarding(text, bigint, smallint) from public, anon;
grant execute on function public.complete_onboarding(text, bigint, smallint) to authenticated;


create or replace function public.rename_handle(p_handle text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid        uuid := auth.uid();
  v_old_handle text;
  v_changed_at timestamptz;
  v_handle     text := btrim(coalesce(p_handle, ''));
begin
  perform public.assert_can_write();

  select p.handle::text, p.handle_changed_at
    into v_old_handle, v_changed_at
    from public.profiles p
   where p.id = v_uid
     for update;

  if not found then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  if v_handle = v_old_handle then
    raise exception 'INVALID_INPUT';
  end if;

  -- Cooldown de 90 días (D3). El primer rename es libre: handle_changed_at nulo.
  if v_changed_at is not null and v_changed_at >= now() - interval '90 days' then
    raise exception 'HANDLE_COOLDOWN';
  end if;

  perform public.assert_handle_ok(v_handle, v_uid);

  begin
    update public.profiles
       set handle            = v_handle,
           handle_changed_at = now(),
           updated_at        = now()
     where id = v_uid;
  exception when unique_violation then
    raise exception 'HANDLE_TAKEN';
  end;

  -- Ledger interno de renombres: cuarentena de 90 días del nombre liberado y
  -- forense de moderación. Nunca es historial público (C4).
  insert into public.handle_history (profile_id, old_handle)
  values (v_uid, v_old_handle);
end;
$$;

comment on function public.rename_handle(text) is
  'Cambia el seudónimo respetando el cooldown de 90 días, la blocklist y la cuarentena de nombres liberados; deja la fila en handle_history (PART 8 §8.5.2, PART 9 §9.5).';

revoke execute on function public.rename_handle(text) from public, anon;
grant execute on function public.rename_handle(text) to authenticated;


create or replace function public.delete_account(p_mode text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid        uuid := auth.uid();
  v_status     text;
  v_old_handle text;
  v_new_handle text;
begin
  -- No usa assert_can_write() a propósito: una cuenta suspendida o baneada
  -- conserva el derecho a borrarse (PART 9 §9.9, Ley 25.326). Solo se exige
  -- sesión válida y que la cuenta no esté ya eliminada.
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  if p_mode is null or p_mode not in ('borrar', 'conservar') then
    raise exception 'INVALID_INPUT';
  end if;

  select p.status, p.handle::text
    into v_status, v_old_handle
    from public.profiles p
   where p.id = v_uid
     for update;

  if not found then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if v_status = 'eliminado' then
    raise exception 'NOT_ALLOWED';
  end if;

  if p_mode = 'borrar' then
    -- "Borrar mis publicaciones" (§8.7): todo lo escrito pasa a
    -- eliminado_autor y los cuerpos se vacían en el acto. Los archivos de los
    -- recursos los destruye el purgado a los 30 días.

    -- Primero los contadores del hilo ajeno: hay que contar los comentarios
    -- vivos ANTES de darlos de baja.
    update public.posts p
       set comments_count = greatest(p.comments_count - x.n, 0)
      from (
        select c.post_id, count(*)::int as n
          from public.comments c
         where c.author_id = v_uid
           and c.status = 'activo'
         group by c.post_id
      ) x
     where p.id = x.post_id;

    update public.posts
       set status = 'eliminado_autor',
           title  = null,
           body   = null
     where author_id = v_uid
       and status = 'activo';

    update public.comments
       set status = 'eliminado_autor',
           body   = null
     where author_id = v_uid
       and status = 'activo';

    -- Recursos: la metadata (título/descripción) se conserva — hace falta para
    -- el contexto "recurso eliminado" y para el historial de duplicados (§8.7).
    update public.resources
       set status = 'eliminado_autor'
     where author_id = v_uid
       and status in ('borrador', 'activo', 'pendiente');

    -- Votos EMITIDOS por la persona: se borran, y se descuenta el score que
    -- habían sumado. Los votos RECIBIDOS siguen la suerte del contenido.
    update public.posts p
       set score = greatest(p.score - 1, 0)
      from public.post_votes v
     where v.post_id = p.id and v.user_id = v_uid;
    delete from public.post_votes where user_id = v_uid;

    update public.comments c
       set score = greatest(c.score - 1, 0)
      from public.comment_votes v
     where v.comment_id = c.id and v.user_id = v_uid;
    delete from public.comment_votes where user_id = v_uid;

    update public.resources r
       set score = greatest(r.score - 1, 0)
      from public.resource_votes v
     where v.resource_id = r.id and v.user_id = v_uid;
    delete from public.resource_votes where user_id = v_uid;
  end if;

  -- Datos de preferencia: se van siempre, en los dos modos (§8.3.4, §8.7).
  delete from public.materia_follows where user_id = v_uid;
  delete from public.notifications   where user_id = v_uid;

  -- El seudónimo liberado entra en cuarentena como en cualquier rename: nadie
  -- hereda la reputación de una cuenta que se fue.
  insert into public.handle_history (profile_id, old_handle)
  values (v_uid, v_old_handle);

  -- Anonimización en el lugar: la fila sobrevive porque es destino de FKs
  -- (mod_actions, anon_aliases, contenido). El UUID queda apuntando a nadie.
  begin
    v_new_handle := 'usuario_eliminado_' || public.nanoid(4);
    update public.profiles
       set handle            = v_new_handle,
           handle_changed_at = now(),
           carrera_id        = null,
           ingreso_year      = null,
           karma             = 0,
           invited_with      = null,
           status            = 'eliminado',
           updated_at        = now()
     where id = v_uid;
  exception when unique_violation then
    -- Colisión de nanoid(4): un reintento alcanza.
    v_new_handle := 'usuario_eliminado_' || public.nanoid(4);
    update public.profiles
       set handle            = v_new_handle,
           handle_changed_at = now(),
           carrera_id        = null,
           ingreso_year      = null,
           karma             = 0,
           invited_with      = null,
           status            = 'eliminado',
           updated_at        = now()
     where id = v_uid;
  end;

  -- La fila de auth.users la borra el cron admin dentro de las 24 h (D5): eso
  -- es API de Auth, no SQL nuestro. La sesión muere antes igual, porque toda
  -- RPC y el proxy rechazan status = 'eliminado'.
end;
$$;

comment on function public.delete_account(text) is
  'Baja de cuenta con las dos opciones de D3: p_mode = borrar (todo el contenido pasa a eliminado_autor con los cuerpos vaciados) o conservar (el contenido queda atribuido al cascarón anonimizado). PART 8 §8.5.2 + §8.7.';

revoke execute on function public.delete_account(text) from public, anon;
grant execute on function public.delete_account(text) to authenticated;


-- ============================================================================
-- 2. CONTENIDO — PART 8 §8.5.3
-- ============================================================================

create or replace function public.create_post(
  p_body          text,
  p_title         text    default null,
  p_materia_slug  text    default null,
  p_kind          text    default 'texto',
  p_anonymous     boolean default false
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid        uuid := auth.uid();
  v_created_at timestamptz;
  v_carrera_id bigint;
  v_materia_id bigint;
  v_body       text := btrim(coalesce(p_body, ''));
  v_title      text := nullif(btrim(coalesce(p_title, '')), '');
  v_kind       text := coalesce(nullif(btrim(coalesce(p_kind, '')), ''), 'texto');
  v_anon       boolean := coalesce(p_anonymous, false);
  v_post_id    bigint;
  v_public_id  text;
begin
  perform public.assert_can_write();

  -- Kill switch de publicación (§0.5-R22, PART 10 §10.14): freno de mano ante una
  -- ola de abuso, sin deploy. Se lee acá y no en assert_can_write() porque qué
  -- interruptor aplica depende de la acción.
  if coalesce(public.app_setting('publicaciones_pausadas'), 'false'::jsonb) = 'true'::jsonb then
    raise exception 'KILL_SWITCH';
  end if;

  select p.created_at, p.carrera_id
    into v_created_at, v_carrera_id
    from public.profiles p
   where p.id = v_uid;

  if not found then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  if char_length(v_body) < 1 or char_length(v_body) > 10000 then
    raise exception 'INVALID_INPUT';
  end if;
  if v_title is not null and char_length(v_title) > 120 then
    raise exception 'INVALID_INPUT';
  end if;
  if v_kind not in ('texto', 'pregunta') then
    raise exception 'INVALID_INPUT';
  end if;

  -- La materia se resuelve por slug: el bigint interno nunca viaja (D14.7).
  if p_materia_slug is not null and btrim(p_materia_slug) <> '' then
    select m.id into v_materia_id
      from public.materias m
     where m.slug = btrim(p_materia_slug);
    if not found then
      raise exception 'TARGET_NOT_FOUND';
    end if;
  end if;

  -- Límites por ventana, contando filas recientes (§0.5-R6). Los posts
  -- borrados siguen contando: el índice (author_id, created_at) no es parcial.
  if (select count(*) from public.posts
       where author_id = v_uid and created_at > now() - interval '1 hour')
     >= public.rate_limit_for('posts_hour', v_created_at) then
    raise exception 'RATE_LIMIT';
  end if;
  if (select count(*) from public.posts
       where author_id = v_uid and created_at > now() - interval '24 hours')
     >= public.rate_limit_for('posts_day', v_created_at) then
    raise exception 'RATE_LIMIT';
  end if;

  -- carrera_id es la foto de la cohorte del autor al momento de crear
  -- (§0.5-R3): se toma siempre, también en anónimo — es dato grueso, no
  -- identificante, y es lo que permite servir "posts de mi carrera".
  begin
    insert into public.posts (public_id, author_id, materia_id, carrera_id,
                              kind, title, body, is_anonymous)
    values (public.nanoid(), v_uid, v_materia_id, v_carrera_id,
            v_kind, v_title, v_body, v_anon)
    returning id, public_id into v_post_id, v_public_id;
  exception when unique_violation then
    -- Colisión de nanoid (31^10 combinaciones): un reintento y listo (§8.2.1).
    insert into public.posts (public_id, author_id, materia_id, carrera_id,
                              kind, title, body, is_anonymous)
    values (public.nanoid(), v_uid, v_materia_id, v_carrera_id,
            v_kind, v_title, v_body, v_anon)
    returning id, public_id into v_post_id, v_public_id;
  end;

  -- alias_num = 0 queda reservado al autor del post anónimo: se muestra como
  -- "Anónimo (autor)" en su propio hilo (§8.3.4, PART 9 §9.6.2).
  if v_anon then
    insert into public.anon_aliases (post_id, author_id, alias_num)
    values (v_post_id, v_uid, 0);
  end if;

  return v_public_id;
end;
$$;

comment on function public.create_post(text, text, text, text, boolean) is
  'Crea una publicación: valida estado, restricciones y límites de tasa, resuelve la materia por slug, congela la carrera del autor y asigna el alias 0 si es anónima. Devuelve el public_id (PART 8 §8.5.3).';

revoke execute on function public.create_post(text, text, text, text, boolean) from public, anon;
grant execute on function public.create_post(text, text, text, text, boolean) to authenticated;


create or replace function public.create_comment(
  p_post_public_id   text,
  p_parent_public_id text    default null,
  p_body             text    default null,
  p_anonymous        boolean default false
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid          uuid := auth.uid();
  v_created_at   timestamptz;
  v_handle       text;
  v_body         text := btrim(coalesce(p_body, ''));
  v_anon         boolean := coalesce(p_anonymous, false);
  v_post_id      bigint;
  v_post_author  uuid;
  v_post_locked  timestamptz;
  v_parent_id    bigint;
  v_parent_autor uuid;
  v_depth        smallint := 1;
  v_alias        smallint;
  v_comment_id   bigint;
  v_public_id    text;
  v_recipient    uuid;
  v_type         text;
  v_group_key    text;
  v_actor        text;
  v_pref         boolean;
  v_recip_status text;
  v_notif_id     bigint;
begin
  perform public.assert_can_write();

  -- Mismo kill switch que create_post: 'publicaciones_pausadas' corta TODA creación
  -- de contenido, publicaciones y comentarios (0009).
  if coalesce(public.app_setting('publicaciones_pausadas'), 'false'::jsonb) = 'true'::jsonb then
    raise exception 'KILL_SWITCH';
  end if;

  select p.created_at, p.handle::text
    into v_created_at, v_handle
    from public.profiles p
   where p.id = v_uid;

  if not found then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  if char_length(v_body) < 1 or char_length(v_body) > 5000 then
    raise exception 'INVALID_INPUT';
  end if;

  select p.id, p.author_id, p.locked_at
    into v_post_id, v_post_author, v_post_locked
    from public.posts p
   where p.public_id = p_post_public_id
     and p.status = 'activo';

  if not found then
    raise exception 'TARGET_NOT_FOUND';
  end if;

  -- Hilo bloqueado por moderación (§0.5-R5): el contenido queda, los
  -- comentarios nuevos no.
  if v_post_locked is not null then
    raise exception 'THREAD_LOCKED';
  end if;

  -- Profundidad máxima 2 (D2: un solo nivel de respuesta). El CHECK de la
  -- tabla no puede leer la fila padre, así que la consistencia se valida acá.
  if p_parent_public_id is not null and btrim(p_parent_public_id) <> '' then
    select c.id, c.author_id, c.depth
      into v_parent_id, v_parent_autor, v_depth
      from public.comments c
     where c.public_id = btrim(p_parent_public_id)
       and c.post_id = v_post_id
       and c.status = 'activo';

    if not found then
      raise exception 'TARGET_NOT_FOUND';
    end if;
    if v_depth <> 1 then
      raise exception 'DEPTH_EXCEEDED';
    end if;
    v_depth := 2;
  end if;

  if (select count(*) from public.comments
       where author_id = v_uid and created_at > now() - interval '1 hour')
     >= public.rate_limit_for('comments_hour', v_created_at) then
    raise exception 'RATE_LIMIT';
  end if;
  if (select count(*) from public.comments
       where author_id = v_uid and created_at > now() - interval '24 hours')
     >= public.rate_limit_for('comments_day', v_created_at) then
    raise exception 'RATE_LIMIT';
  end if;

  -- Alias por hilo: se reutiliza el que ya tenga esta persona en este post
  -- (incluido el 0 del autor anónimo del post) o se asigna el siguiente.
  -- El advisory lock por post evita dos "Anónimo 2" en una carrera; el UNIQUE
  -- (post_id, alias_num) lo hace estructuralmente imposible igual.
  if v_anon then
    perform pg_advisory_xact_lock(v_post_id);

    select a.alias_num into v_alias
      from public.anon_aliases a
     where a.post_id = v_post_id
       and a.author_id = v_uid;

    if not found then
      select coalesce(max(a.alias_num), 0) + 1 into v_alias
        from public.anon_aliases a
       where a.post_id = v_post_id;

      insert into public.anon_aliases (post_id, author_id, alias_num)
      values (v_post_id, v_uid, v_alias);
    end if;
  end if;

  begin
    insert into public.comments (public_id, post_id, parent_id, depth,
                                 author_id, body, is_anonymous)
    values (public.nanoid(), v_post_id, v_parent_id, v_depth,
            v_uid, v_body, v_anon)
    returning id, public_id into v_comment_id, v_public_id;
  exception when unique_violation then
    insert into public.comments (public_id, post_id, parent_id, depth,
                                 author_id, body, is_anonymous)
    values (public.nanoid(), v_post_id, v_parent_id, v_depth,
            v_uid, v_body, v_anon)
    returning id, public_id into v_comment_id, v_public_id;
  end;

  -- Contador cacheado + bump del hilo. Solo los comentarios mueven
  -- last_activity_at; votos, ediciones y moderación no (PART 12 §12.3).
  update public.posts
     set comments_count   = comments_count + 1,
         last_activity_at = now()
   where id = v_post_id;

  -- ------------------------------------------------------------------------
  -- Notificación (PART 12 "Notifications", §0.5-R14)
  -- ------------------------------------------------------------------------
  if v_parent_id is null then
    v_recipient := v_post_author;
    v_type      := 'respuesta_post';
    v_group_key := 'respuesta_post:' || v_post_id;
  else
    v_recipient := v_parent_autor;
    v_type      := 'respuesta_comentario';
    v_group_key := 'respuesta_comentario:' || v_parent_id;
  end if;

  -- Nunca se avisa a uno mismo. La comparación es por author_id interno, así
  -- que también funciona cuando alguien se responde a sí mismo en anónimo.
  if v_recipient is not null and v_recipient <> v_uid then
    select p.notif_respuestas, p.status
      into v_pref, v_recip_status
      from public.profiles p
     where p.id = v_recipient;

    -- Prefs v1: un solo booleano cubre los dos tipos de respuesta. Las
    -- decisiones de moderación son siempre-on y no pasan por acá.
    if found and coalesce(v_pref, true) and v_recip_status <> 'eliminado' then
      -- actor_display se precomputa con la MISMA lógica con la que el hilo se
      -- renderiza: el handle real de un actor anónimo no entra jamás en la
      -- fila, así que ningún bug ni export posterior puede sacarlo.
      if v_anon then
        v_actor := case when v_alias = 0
                        then 'Anónimo (autor)'
                        else 'Anónimo ' || v_alias end;
      else
        v_actor := v_handle;
      end if;

      -- Agrupación: un evento nuevo sobre un group_key que ya tiene aviso SIN
      -- LEER actualiza esa fila en lugar de insertar otra. Una vez leída, el
      -- grupo queda sellado y el siguiente evento abre fila nueva.
      update public.notifications n
         set group_count = n.group_count + 1,
             comment_id  = v_comment_id,
             created_at  = now()
       where n.user_id = v_recipient
         and n.group_key = v_group_key
         and n.read_at is null
      returning n.id into v_notif_id;

      -- Se conserva el actor_display original (el primero): la copy arma
      -- "Fulano y N más" con group_count, y la columna (≤40 chars) no da para
      -- dos handles de 24.
      if v_notif_id is null then
        insert into public.notifications (user_id, type, post_id, comment_id,
                                          actor_display, group_key)
        values (v_recipient, v_type, v_post_id, v_comment_id,
                left(v_actor, 40), v_group_key);
      end if;
    end if;
  end if;

  return v_public_id;
end;
$$;

comment on function public.create_comment(text, text, text, boolean) is
  'Crea un comentario: exige post activo y sin bloquear, valida profundidad ≤ 2, asigna o reutiliza el alias anónimo del hilo, actualiza comments_count y last_activity_at y escribe la notificación de respuesta (PART 8 §8.5.3).';

revoke execute on function public.create_comment(text, text, text, boolean) from public, anon;
grant execute on function public.create_comment(text, text, text, boolean) to authenticated;


create or replace function public.update_own_post(
  p_public_id text,
  p_body      text,
  p_title     text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid        uuid := auth.uid();
  v_id         bigint;
  v_author     uuid;
  v_created_at timestamptz;
  v_body       text := btrim(coalesce(p_body, ''));
  v_title      text := nullif(btrim(coalesce(p_title, '')), '');
begin
  perform public.assert_can_write();

  select p.id, p.author_id, p.created_at
    into v_id, v_author, v_created_at
    from public.posts p
   where p.public_id = p_public_id
     and p.status = 'activo';

  if not found then
    raise exception 'TARGET_NOT_FOUND';
  end if;
  if v_author <> v_uid then
    raise exception 'NOT_ALLOWED';
  end if;

  -- Ventana de edición: 24 h para publicaciones (PART 16 §16.4). Las
  -- respuestas se cuelgan de lo que se escribió; reescribir un post viejo
  -- invalida el hilo que ya le contestó.
  if v_created_at < now() - interval '24 hours' then
    raise exception 'NOT_ALLOWED';
  end if;

  if char_length(v_body) < 1 or char_length(v_body) > 10000 then
    raise exception 'INVALID_INPUT';
  end if;
  if v_title is not null and char_length(v_title) > 120 then
    raise exception 'INVALID_INPUT';
  end if;

  update public.posts
     set body      = v_body,
         title     = v_title,
         edited_at = now()
   where id = v_id;
end;
$$;

comment on function public.update_own_post(text, text, text) is
  'Edita una publicación propia dentro de la ventana de 24 h y marca edited_at. Sin historial de versiones en MVP (PART 8 §8.5.3, PART 16 §16.4).';

revoke execute on function public.update_own_post(text, text, text) from public, anon;
grant execute on function public.update_own_post(text, text, text) to authenticated;


create or replace function public.update_own_comment(
  p_public_id text,
  p_body      text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid        uuid := auth.uid();
  v_id         bigint;
  v_author     uuid;
  v_created_at timestamptz;
  v_body       text := btrim(coalesce(p_body, ''));
begin
  perform public.assert_can_write();

  select c.id, c.author_id, c.created_at
    into v_id, v_author, v_created_at
    from public.comments c
   where c.public_id = p_public_id
     and c.status = 'activo';

  if not found then
    raise exception 'TARGET_NOT_FOUND';
  end if;
  if v_author <> v_uid then
    raise exception 'NOT_ALLOWED';
  end if;

  -- Ventana de edición: 1 h para comentarios (PART 16 §16.4).
  if v_created_at < now() - interval '1 hour' then
    raise exception 'NOT_ALLOWED';
  end if;

  if char_length(v_body) < 1 or char_length(v_body) > 5000 then
    raise exception 'INVALID_INPUT';
  end if;

  update public.comments
     set body      = v_body,
         edited_at = now()
   where id = v_id;
end;
$$;

comment on function public.update_own_comment(text, text) is
  'Edita un comentario propio dentro de la ventana de 1 h y marca edited_at (PART 8 §8.5.3, PART 16 §16.4).';

revoke execute on function public.update_own_comment(text, text) from public, anon;
grant execute on function public.update_own_comment(text, text) to authenticated;


create or replace function public.delete_own_post(p_public_id text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_id     bigint;
  v_author uuid;
begin
  perform public.assert_can_write();

  select p.id, p.author_id
    into v_id, v_author
    from public.posts p
   where p.public_id = p_public_id
     and p.status = 'activo';

  if not found then
    raise exception 'TARGET_NOT_FOUND';
  end if;
  if v_author <> v_uid then
    raise exception 'NOT_ALLOWED';
  end if;

  -- Borrado blando + vaciado inmediato del cuerpo (§8.7). La fila queda porque
  -- el hilo tiene que seguir teniendo estructura; el borrado físico es del
  -- job de retención, nunca de un pedido en línea.
  update public.posts
     set status = 'eliminado_autor',
         title  = null,
         body   = null
   where id = v_id;
end;
$$;

comment on function public.delete_own_post(text) is
  'Borrado blando de una publicación propia: status eliminado_autor y título/cuerpo vaciados en el acto (PART 8 §8.5.3, §8.7).';

revoke execute on function public.delete_own_post(text) from public, anon;
grant execute on function public.delete_own_post(text) to authenticated;


create or replace function public.delete_own_comment(p_public_id text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid     uuid := auth.uid();
  v_id      bigint;
  v_post_id bigint;
  v_author  uuid;
begin
  perform public.assert_can_write();

  select c.id, c.post_id, c.author_id
    into v_id, v_post_id, v_author
    from public.comments c
   where c.public_id = p_public_id
     and c.status = 'activo';

  if not found then
    raise exception 'TARGET_NOT_FOUND';
  end if;
  if v_author <> v_uid then
    raise exception 'NOT_ALLOWED';
  end if;

  -- Queda la lápida: la fila sobrevive para que las respuestas conserven
  -- contexto ("Comentario eliminado"), con el cuerpo vaciado (§8.7).
  update public.comments
     set status = 'eliminado_autor',
         body   = null
   where id = v_id;

  update public.posts
     set comments_count = greatest(comments_count - 1, 0)
   where id = v_post_id;
end;
$$;

comment on function public.delete_own_comment(text) is
  'Borrado blando de un comentario propio: lápida visible, cuerpo vaciado y comments_count del post ajustado (PART 8 §8.5.3, §8.7).';

revoke execute on function public.delete_own_comment(text) from public, anon;
grant execute on function public.delete_own_comment(text) to authenticated;


create or replace function public.delete_own_resource(p_public_id text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_id     bigint;
  v_author uuid;
begin
  perform public.assert_can_write();

  select r.id, r.author_id
    into v_id, v_author
    from public.resources r
   where r.public_id = p_public_id
     and r.status in ('borrador', 'activo', 'pendiente');

  if not found then
    raise exception 'TARGET_NOT_FOUND';
  end if;
  if v_author <> v_uid then
    raise exception 'NOT_ALLOWED';
  end if;

  -- A diferencia de posts y comentarios, acá la metadata se conserva: hace
  -- falta para el contexto "recurso eliminado" y para el historial de
  -- duplicados. Los objetos en R2 los destruye el purgado a los 30 días (§8.7).
  update public.resources
     set status = 'eliminado_autor'
   where id = v_id;
end;
$$;

comment on function public.delete_own_resource(text) is
  'Borrado blando de un recurso propio: status eliminado_autor, metadata conservada, archivos destruidos por el job de retención a los 30 días (PART 8 §8.5.3, §8.7).';

revoke execute on function public.delete_own_resource(text) from public, anon;
grant execute on function public.delete_own_resource(text) to authenticated;


create or replace function public.request_upload(
  p_materia_slug text,
  p_tipo         text,
  p_anio         smallint default null,
  p_title        text     default null,
  p_description  text     default null,
  p_anonymous    boolean  default false
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid        uuid := auth.uid();
  v_created_at timestamptz;
  v_materia_id bigint;
  v_title      text := btrim(coalesce(p_title, ''));
  v_desc       text := nullif(btrim(coalesce(p_description, '')), '');
  v_used       bigint;
  v_public_id  text;
  v_quota      constant bigint := 104857600;  -- 100 MB de por vida (§0.5-R12)
begin
  perform public.assert_can_write();

  select p.created_at into v_created_at
    from public.profiles p
   where p.id = v_uid;

  if not found then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  -- Kill-switch de subidas (PART 10 §10.14). La clave puede no existir todavía
  -- en app_settings: ausencia = apagado.
  if coalesce(
       (select s.value = to_jsonb(true)
          from public.app_settings s
         where s.key = 'subidas_pausadas'),
       false) then
    raise exception 'KILL_SWITCH';
  end if;

  select m.id into v_materia_id
    from public.materias m
   where m.slug = btrim(coalesce(p_materia_slug, ''));
  if not found then
    raise exception 'TARGET_NOT_FOUND';
  end if;

  if p_tipo is null
     or p_tipo not in ('resumen', 'apunte', 'parcial', 'final', 'guia', 'otro') then
    raise exception 'INVALID_INPUT';
  end if;
  if p_anio is not null and p_anio not between 2000 and 2100 then
    raise exception 'INVALID_INPUT';
  end if;
  -- Mínimo 8 caracteres: fuerza títulos descriptivos, la diferencia entre una
  -- estantería usable y una pila de "apunte.pdf" (§0.5-R12).
  if char_length(v_title) < 8 or char_length(v_title) > 120 then
    raise exception 'INVALID_INPUT';
  end if;
  if v_desc is not null and char_length(v_desc) > 2000 then
    raise exception 'INVALID_INPUT';
  end if;

  if (select count(*) from public.resources
       where author_id = v_uid and created_at > now() - interval '24 hours')
     >= public.rate_limit_for('uploads_day', v_created_at) then
    raise exception 'RATE_LIMIT';
  end if;

  -- Cuota de 100 MB de por vida, medida sobre resource_files.size_bytes de
  -- todo lo que la persona subió alguna vez (incluidos archivos reemplazados o
  -- de recursos borrados): es cupo de subida, no de almacenamiento vivo.
  select coalesce(sum(f.size_bytes), 0) into v_used
    from public.resource_files f
    join public.resources r on r.id = f.resource_id
   where r.author_id = v_uid;

  if v_used >= v_quota then
    raise exception 'QUOTA_EXCEEDED';
  end if;

  begin
    insert into public.resources (public_id, materia_id, author_id, tipo, anio,
                                  title, description, is_anonymous, status)
    values (public.nanoid(), v_materia_id, v_uid, p_tipo, p_anio,
            v_title, v_desc, coalesce(p_anonymous, false), 'borrador')
    returning public_id into v_public_id;
  exception when unique_violation then
    insert into public.resources (public_id, materia_id, author_id, tipo, anio,
                                  title, description, is_anonymous, status)
    values (public.nanoid(), v_materia_id, v_uid, p_tipo, p_anio,
            v_title, v_desc, coalesce(p_anonymous, false), 'borrador')
    returning public_id into v_public_id;
  end;

  return v_public_id;
end;
$$;

comment on function public.request_upload(text, text, smallint, text, text, boolean) is
  'Primera fase de la subida: valida metadata, límite diario y cuota de 100 MB, inserta el recurso en borrador y devuelve su public_id para que la Server Action firme las URLs de cuarentena (PART 8 §8.5.3, PART 14 §14.3).';

revoke execute on function public.request_upload(text, text, smallint, text, text, boolean) from public, anon;
grant execute on function public.request_upload(text, text, smallint, text, text, boolean) to authenticated;


create or replace function public.finalize_upload(
  p_resource_public_id text,
  p_files              jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid       uuid := auth.uid();
  v_id        bigint;
  v_author    uuid;
  v_status    text;
  v_file      jsonb;
  v_count     int;
  v_pos       smallint := 0;
  v_new_bytes bigint := 0;
  v_used      bigint;
  v_size      bigint;
  v_path      text;
  v_name      text;
  v_mime      text;
  v_sha       text;
  v_quota     constant bigint := 104857600;  -- 100 MB de por vida (§0.5-R12)
begin
  perform public.assert_can_write();

  -- 'subidas_pausadas' corta request_upload Y finalize_upload (0009): si no cortara
  -- acá, un borrador ya creado seguiría publicándose con las subidas pausadas.
  if coalesce(public.app_setting('subidas_pausadas'), 'false'::jsonb) = 'true'::jsonb then
    raise exception 'KILL_SWITCH';
  end if;

  select r.id, r.author_id, r.status
    into v_id, v_author, v_status
    from public.resources r
   where r.public_id = p_resource_public_id;

  if not found then
    raise exception 'TARGET_NOT_FOUND';
  end if;
  if v_author <> v_uid then
    raise exception 'NOT_ALLOWED';
  end if;
  if v_status <> 'borrador' then
    raise exception 'NOT_ALLOWED';
  end if;

  if p_files is null or jsonb_typeof(p_files) <> 'array' then
    raise exception 'INVALID_INPUT';
  end if;

  select count(*) into v_count from jsonb_array_elements(p_files);
  if v_count < 1 or v_count > 3 then
    raise exception 'INVALID_INPUT';
  end if;

  -- Pasada 1: validar cada archivo y acumular bytes. La lista la arma el
  -- servidor DESPUÉS de olfatear magic numbers, limpiar EXIF y mover el objeto
  -- de la cuarentena a su clave final (PART 14 §14.3); acá se revalida todo lo
  -- que la base puede revalidar sola.
  for v_file in select value from jsonb_array_elements(p_files) loop
    v_path := btrim(coalesce(v_file ->> 'storage_path', ''));
    v_name := btrim(coalesce(v_file ->> 'original_name', ''));
    v_mime := btrim(coalesce(v_file ->> 'mime', ''));
    v_sha  := nullif(btrim(coalesce(v_file ->> 'sha256', '')), '');

    if char_length(v_path) < 1 or char_length(v_path) > 300 then
      raise exception 'INVALID_INPUT';
    end if;
    -- La clave final siempre cuelga del recurso: r/{public_id}/{file}.{ext}
    -- (§0.5-R12). Impide que un cliente pegue el archivo de otro recurso.
    if v_path not like ('r/' || p_resource_public_id || '/%') then
      raise exception 'INVALID_INPUT';
    end if;
    if char_length(v_name) < 1 or char_length(v_name) > 200 then
      raise exception 'INVALID_INPUT';
    end if;
    if v_mime not in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp') then
      raise exception 'INVALID_INPUT';
    end if;
    if v_sha is not null and v_sha !~ '^[a-f0-9]{64}$' then
      raise exception 'INVALID_INPUT';
    end if;

    -- coalesce: si la clave falta, jsonb_typeof devuelve NULL y la comparación
    -- sola no dispararía nada.
    if coalesce(jsonb_typeof(v_file -> 'size_bytes'), 'null') <> 'number' then
      raise exception 'INVALID_INPUT';
    end if;
    v_size := (v_file ->> 'size_bytes')::bigint;
    if v_size < 1 or v_size > 10485760 then
      raise exception 'INVALID_INPUT';
    end if;

    v_new_bytes := v_new_bytes + v_size;
  end loop;

  select coalesce(sum(f.size_bytes), 0) into v_used
    from public.resource_files f
    join public.resources r on r.id = f.resource_id
   where r.author_id = v_uid;

  if v_used + v_new_bytes > v_quota then
    raise exception 'QUOTA_EXCEEDED';
  end if;

  -- Pasada 2: insertar. `position` sale del orden del array (1..3), que es el
  -- orden en que el usuario eligió los archivos.
  for v_file in select value from jsonb_array_elements(p_files) loop
    v_pos := (v_pos + 1)::smallint;

    insert into public.resource_files (resource_id, storage_path, original_name,
                                       mime, size_bytes, sha256, position)
    values (v_id,
            btrim(v_file ->> 'storage_path'),
            btrim(v_file ->> 'original_name'),
            btrim(v_file ->> 'mime'),
            (v_file ->> 'size_bytes')::int,
            nullif(btrim(coalesce(v_file ->> 'sha256', '')), ''),
            v_pos);
  end loop;

  -- Publicación inmediata: publish-first con moderación por reporte
  -- (PART 11 §11.7.1). `pendiente` existe pero no se usa en MVP.
  update public.resources
     set status = 'activo'
   where id = v_id;
end;
$$;

comment on function public.finalize_upload(text, jsonb) is
  'Segunda fase de la subida: valida tamaños, mimes, claves de objeto y cuota, inserta las filas de resource_files y pasa el recurso de borrador a activo. p_files es un array de {storage_path, original_name, mime, size_bytes, sha256?} y su orden fija position (PART 8 §8.5.3, PART 14 §14.3).';

revoke execute on function public.finalize_upload(text, jsonb) from public, anon;
grant execute on function public.finalize_upload(text, jsonb) to authenticated;


create or replace function public.register_download(p_resource_public_id text)
returns table (
  storage_path  text,
  original_name text,
  mime          text,
  size_bytes    int
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid        uuid := auth.uid();
  v_created_at timestamptz;
  v_id         bigint;
  v_first      boolean;
begin
  perform public.assert_can_write();

  select p.created_at into v_created_at
    from public.profiles p
   where p.id = v_uid;

  if not found then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select r.id into v_id
    from public.resources r
   where r.public_id = p_resource_public_id
     and r.status = 'activo';

  if not found then
    raise exception 'TARGET_NOT_FOUND';
  end if;

  -- Límite por hora contando el log efímero: generoso para humanos, molesto
  -- para scrapers (PART 14 §14.6). El log entero vive 7 días (§0.5-R9).
  if (select count(*) from public.download_log d
       where d.user_id = v_uid and d.created_at > now() - interval '1 hour')
     >= public.rate_limit_for('downloads_hour', v_created_at) then
    raise exception 'RATE_LIMIT';
  end if;

  -- Dedup por usuario-día: downloads_count cuenta días-usuario distintos, así
  -- que ni el doble clic ni el inflado deliberado lo mueven (§0.5-R9). El día
  -- es el día de Buenos Aires, que es el día del estudiante.
  v_first := not exists (
    select 1
      from public.download_log d
     where d.resource_id = v_id
       and d.user_id = v_uid
       and (d.created_at at time zone 'America/Argentina/Buenos_Aires')::date
         = (now() at time zone 'America/Argentina/Buenos_Aires')::date
  );

  insert into public.download_log (resource_id, user_id)
  values (v_id, v_uid);

  if v_first then
    update public.resources
       set downloads_count = downloads_count + 1
     where id = v_id;
  end if;

  -- Devuelve las claves de objeto vivas para que la ruta de descarga firme la
  -- URL de 120 s. `storage_path` es interno (no está en resource_files_public),
  -- y esta función definer es su única salida autorizada (PART 14 §14.6).
  return query
    select f.storage_path, f.original_name, f.mime, f.size_bytes
      from public.resource_files f
     where f.resource_id = v_id
       and f.replaced_at is null
     order by f.position;
end;
$$;

comment on function public.register_download(text) is
  'Autoriza una descarga: aplica el límite horario, registra la fila en download_log, incrementa downloads_count solo en la primera descarga del usuario para ese recurso en el día y devuelve las claves de objeto para firmar la URL de 120 s (PART 8 §8.5.3, §0.5-R9).';

revoke execute on function public.register_download(text) from public, anon;
grant execute on function public.register_download(text) to authenticated;


-- ============================================================================
-- 3. VOTOS — PART 8 §8.5.4
--
-- Up-only (D2: no hay downvotes), así que la existencia de la fila ES el voto.
-- Los votos mueven `score` del contenido y NADA MÁS: nunca tocan karma
-- (§0.5-R7). El karma lo recalcula entero el job nocturno, que es justamente lo
-- que hace que el karma de contenido anónimo no sea correlacionable (C5).
-- ============================================================================

create or replace function public.toggle_post_vote(p_public_id text)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid        uuid := auth.uid();
  v_created_at timestamptz;
  v_id         bigint;
  v_author     uuid;
  v_score      int;
begin
  perform public.assert_can_write();

  select p.created_at into v_created_at
    from public.profiles p
   where p.id = v_uid;

  if not found then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select p.id, p.author_id
    into v_id, v_author
    from public.posts p
   where p.public_id = p_public_id
     and p.status = 'activo';

  if not found then
    raise exception 'TARGET_NOT_FOUND';
  end if;

  -- Auto-voto: bloqueado estructuralmente, también en contenido anónimo (la
  -- autoría existe internamente aunque no se muestre) — PART 11 §11.6.3.
  if v_author = v_uid then
    raise exception 'SELF_VOTE';
  end if;

  delete from public.post_votes
   where post_id = v_id and user_id = v_uid;

  if found then
    update public.posts
       set score = greatest(score - 1, 0)
     where id = v_id
    returning score into v_score;
    return v_score;
  end if;

  if (select count(*) from public.post_votes    where user_id = v_uid and created_at > now() - interval '1 hour')
   + (select count(*) from public.comment_votes where user_id = v_uid and created_at > now() - interval '1 hour')
   + (select count(*) from public.resource_votes where user_id = v_uid and created_at > now() - interval '1 hour')
     >= public.rate_limit_for('votes_hour', v_created_at) then
    raise exception 'RATE_LIMIT';
  end if;

  insert into public.post_votes (post_id, user_id)
  values (v_id, v_uid)
  on conflict do nothing;

  if found then
    update public.posts
       set score = score + 1
     where id = v_id
    returning score into v_score;
  else
    -- Otra transacción insertó el mismo voto: el score ya está bien.
    select p.score into v_score from public.posts p where p.id = v_id;
  end if;

  return v_score;
end;
$$;

comment on function public.toggle_post_vote(text) is
  'Alterna el voto positivo del usuario sobre una publicación y ajusta score ±1 en la misma transacción. Rechaza el auto-voto. Nunca toca karma (§0.5-R7). Devuelve el score nuevo.';

revoke execute on function public.toggle_post_vote(text) from public, anon;
grant execute on function public.toggle_post_vote(text) to authenticated;


create or replace function public.toggle_comment_vote(p_public_id text)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid        uuid := auth.uid();
  v_created_at timestamptz;
  v_id         bigint;
  v_author     uuid;
  v_score      int;
begin
  perform public.assert_can_write();

  select p.created_at into v_created_at
    from public.profiles p
   where p.id = v_uid;

  if not found then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select c.id, c.author_id
    into v_id, v_author
    from public.comments c
   where c.public_id = p_public_id
     and c.status = 'activo';

  if not found then
    raise exception 'TARGET_NOT_FOUND';
  end if;

  if v_author = v_uid then
    raise exception 'SELF_VOTE';
  end if;

  delete from public.comment_votes
   where comment_id = v_id and user_id = v_uid;

  if found then
    update public.comments
       set score = greatest(score - 1, 0)
     where id = v_id
    returning score into v_score;
    return v_score;
  end if;

  if (select count(*) from public.post_votes    where user_id = v_uid and created_at > now() - interval '1 hour')
   + (select count(*) from public.comment_votes where user_id = v_uid and created_at > now() - interval '1 hour')
   + (select count(*) from public.resource_votes where user_id = v_uid and created_at > now() - interval '1 hour')
     >= public.rate_limit_for('votes_hour', v_created_at) then
    raise exception 'RATE_LIMIT';
  end if;

  insert into public.comment_votes (comment_id, user_id)
  values (v_id, v_uid)
  on conflict do nothing;

  if found then
    update public.comments
       set score = score + 1
     where id = v_id
    returning score into v_score;
  else
    select c.score into v_score from public.comments c where c.id = v_id;
  end if;

  return v_score;
end;
$$;

comment on function public.toggle_comment_vote(text) is
  'Alterna el voto positivo del usuario sobre un comentario y ajusta score ±1. Rechaza el auto-voto. Nunca toca karma (§0.5-R7). Devuelve el score nuevo.';

revoke execute on function public.toggle_comment_vote(text) from public, anon;
grant execute on function public.toggle_comment_vote(text) to authenticated;


create or replace function public.toggle_resource_vote(p_public_id text)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid        uuid := auth.uid();
  v_created_at timestamptz;
  v_id         bigint;
  v_author     uuid;
  v_score      int;
begin
  perform public.assert_can_write();

  select p.created_at into v_created_at
    from public.profiles p
   where p.id = v_uid;

  if not found then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select r.id, r.author_id
    into v_id, v_author
    from public.resources r
   where r.public_id = p_public_id
     and r.status = 'activo';

  if not found then
    raise exception 'TARGET_NOT_FOUND';
  end if;

  if v_author = v_uid then
    raise exception 'SELF_VOTE';
  end if;

  delete from public.resource_votes
   where resource_id = v_id and user_id = v_uid;

  if found then
    update public.resources
       set score = greatest(score - 1, 0)
     where id = v_id
    returning score into v_score;
    return v_score;
  end if;

  if (select count(*) from public.post_votes    where user_id = v_uid and created_at > now() - interval '1 hour')
   + (select count(*) from public.comment_votes where user_id = v_uid and created_at > now() - interval '1 hour')
   + (select count(*) from public.resource_votes where user_id = v_uid and created_at > now() - interval '1 hour')
     >= public.rate_limit_for('votes_hour', v_created_at) then
    raise exception 'RATE_LIMIT';
  end if;

  insert into public.resource_votes (resource_id, user_id)
  values (v_id, v_uid)
  on conflict do nothing;

  if found then
    update public.resources
       set score = score + 1
     where id = v_id
    returning score into v_score;
  else
    select r.score into v_score from public.resources r where r.id = v_id;
  end if;

  return v_score;
end;
$$;

comment on function public.toggle_resource_vote(text) is
  'Alterna el voto positivo del usuario sobre un recurso y ajusta score ±1. Rechaza el auto-voto. Nunca toca karma (§0.5-R7). Devuelve el score nuevo.';

revoke execute on function public.toggle_resource_vote(text) from public, anon;
grant execute on function public.toggle_resource_vote(text) to authenticated;


-- ============================================================================
-- 4. BÚSQUEDA — PART 8 §8.5.3 + PART 13
--
-- STABLE y sobre las vistas _public: no pueden exponer nada que las vistas no
-- expongan ya (D14.5 se aplica a los resultados de búsqueda sin excepciones).
-- Parsing: `websearch_to_tsquery` siempre — acepta lo que el estudiante escriba
-- sin tirar errores de sintaxis y regala semántica tipo Google (§13.3).
-- Paginación por keyset sobre (rank, id): nunca OFFSET (§12.4).
-- ============================================================================

create or replace function public.search_posts(
  p_query        text,
  p_materia_slug text             default null,
  p_desde        int              default null,
  p_hasta        int              default null,
  p_limit        int              default 10,
  p_cursor_rank  double precision default null,
  p_cursor_id    bigint           default null
)
returns table (
  id               bigint,
  public_id        text,
  materia_id       bigint,
  carrera_id       bigint,
  kind             text,
  title            text,
  body             text,
  is_anonymous     boolean,
  author_handle    text,
  score            int,
  comments_count   int,
  created_at       timestamptz,
  last_activity_at timestamptz,
  rank             double precision
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_q          tsquery;
  v_limit      int := least(greatest(coalesce(p_limit, 10), 1), 50);
  v_materia_id bigint;
begin
  v_q := websearch_to_tsquery('public.es', left(btrim(coalesce(p_query, '')), 100));
  if v_q is null or v_q::text = '' then
    return;  -- consulta vacía o solo stopwords: cero resultados sin tocar el índice
  end if;

  if p_materia_slug is not null and btrim(p_materia_slug) <> '' then
    select m.id into v_materia_id
      from public.materias m
     where m.slug = btrim(p_materia_slug);
    if not found then
      return;
    end if;
  end if;

  -- rank = ts_rank_cd normalizado por longitud (1 + log(doc length)) con un
  -- empujón de recencia acotado: nuevo ×1.5, un año ×1.02, diez años ×1.0. La
  -- recencia desempata, nunca filtra — es la forma matemática de la promesa
  -- del archivo (§13.4, §13.10).
  return query
    select s.id, s.public_id, s.materia_id, s.carrera_id, s.kind, s.title,
           s.body, s.is_anonymous, s.author_handle, s.score, s.comments_count,
           s.created_at, s.last_activity_at, s.rank
      from (
        select p.id, p.public_id, p.materia_id, p.carrera_id, p.kind, p.title,
               p.body, p.is_anonymous, p.author_handle, p.score,
               p.comments_count, p.created_at, p.last_activity_at,
               (ts_rank_cd(p.search, v_q, 1)
                * (1 + 0.5 * exp(-extract(epoch from (now() - p.created_at))::double precision
                                 / 86400 / 120))
               )::double precision as rank
          from public.posts_public p
         where p.search @@ v_q
           and (v_materia_id is null or p.materia_id = v_materia_id)
           and (p_desde is null
                or extract(year from (p.created_at at time zone 'America/Argentina/Buenos_Aires'))::int >= p_desde)
           and (p_hasta is null
                or extract(year from (p.created_at at time zone 'America/Argentina/Buenos_Aires'))::int <= p_hasta)
      ) s
     where p_cursor_rank is null
        or p_cursor_id is null
        or (s.rank, s.id) < (p_cursor_rank, p_cursor_id)
     order by s.rank desc, s.id desc
     limit v_limit;
end;
$$;

comment on function public.search_posts(text, text, int, int, int, double precision, bigint) is
  'Busca publicaciones activas sobre posts_public con ts_rank_cd y empujón de recencia acotado; filtros opcionales por materia y rango de años; paginación keyset por (rank, id) (PART 8 §8.5.3, PART 13 §13.4).';

revoke execute on function public.search_posts(text, text, int, int, int, double precision, bigint) from public, anon;
grant execute on function public.search_posts(text, text, int, int, int, double precision, bigint) to anon, authenticated;


create or replace function public.search_resources(
  p_query        text,
  p_materia_slug text             default null,
  p_desde        int              default null,
  p_hasta        int              default null,
  p_limit        int              default 5,
  p_cursor_rank  double precision default null,
  p_cursor_id    bigint           default null
)
returns table (
  id              bigint,
  public_id       text,
  materia_id      bigint,
  tipo            text,
  anio            smallint,
  title           text,
  description     text,
  is_anonymous    boolean,
  author_handle   text,
  score           int,
  downloads_count int,
  created_at      timestamptz,
  rank            double precision
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_q          tsquery;
  v_limit      int := least(greatest(coalesce(p_limit, 5), 1), 50);
  v_materia_id bigint;
begin
  v_q := websearch_to_tsquery('public.es', left(btrim(coalesce(p_query, '')), 100));
  if v_q is null or v_q::text = '' then
    return;
  end if;

  if p_materia_slug is not null and btrim(p_materia_slug) <> '' then
    select m.id into v_materia_id
      from public.materias m
     where m.slug = btrim(p_materia_slug);
    if not found then
      return;
    end if;
  end if;

  -- Las descargas son un prior de calidad chico y amortiguado en log: un
  -- resumen con 300 descargas le gana a un casi-duplicado con 2, pero la
  -- popularidad no puede enterrar una coincidencia de texto mejor (§13.4).
  return query
    select s.id, s.public_id, s.materia_id, s.tipo, s.anio, s.title,
           s.description, s.is_anonymous, s.author_handle, s.score,
           s.downloads_count, s.created_at, s.rank
      from (
        select r.id, r.public_id, r.materia_id, r.tipo, r.anio, r.title,
               r.description, r.is_anonymous, r.author_handle, r.score,
               r.downloads_count, r.created_at,
               (ts_rank_cd(r.search, v_q, 1)
                * (1 + 0.2 * ln(1 + r.downloads_count::double precision))
               )::double precision as rank
          from public.resources_public r
         where r.search @@ v_q
           and (v_materia_id is null or r.materia_id = v_materia_id)
           and (p_desde is null
                or extract(year from (r.created_at at time zone 'America/Argentina/Buenos_Aires'))::int >= p_desde)
           and (p_hasta is null
                or extract(year from (r.created_at at time zone 'America/Argentina/Buenos_Aires'))::int <= p_hasta)
      ) s
     where p_cursor_rank is null
        or p_cursor_id is null
        or (s.rank, s.id) < (p_cursor_rank, p_cursor_id)
     order by s.rank desc, s.id desc
     limit v_limit;
end;
$$;

comment on function public.search_resources(text, text, int, int, int, double precision, bigint) is
  'Busca recursos activos sobre resources_public con ts_rank_cd y prior de descargas amortiguado en log; filtros por materia y rango de años; paginación keyset por (rank, id) (PART 8 §8.5.3, PART 13 §13.4).';

revoke execute on function public.search_resources(text, text, int, int, int, double precision, bigint) from public, anon;
grant execute on function public.search_resources(text, text, int, int, int, double precision, bigint) to anon, authenticated;


create or replace function public.search_catalog(
  p_query text,
  p_limit int default 8
)
returns table (
  kind   text,
  id     bigint,
  slug   text,
  nombre text,
  rank   double precision
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_q     tsquery;
  v_limit int := least(greatest(coalesce(p_limit, 8), 1), 25);
begin
  v_q := websearch_to_tsquery('public.es', left(btrim(coalesce(p_query, '')), 100));
  if v_q is null or v_q::text = '' then
    return;
  end if;

  -- Catálogo = materias + carreras, coincidencia de texto pura (sin recencia:
  -- una materia no es más relevante por ser nueva). La precedencia de grupo
  -- reemplaza cualquier mezcla numérica entre tipos (§13.4): materias primero,
  -- después carreras. Las materias matchean también por `aliases` — "consti"
  -- encuentra Derecho Constitucional porque el vector las lleva en peso B.
  return query
    select c.kind, c.id, c.slug, c.nombre, c.rank
      from (
        select 'materia'::text as kind, m.id, m.slug, m.nombre,
               ts_rank_cd(m.search, v_q, 1)::double precision as rank,
               1 as orden
          from public.materias m
         where m.search @@ v_q
        union all
        select 'carrera'::text, ca.id, ca.slug, ca.nombre,
               ts_rank_cd(ca.search, v_q, 1)::double precision,
               2
          from public.carreras ca
         where ca.search @@ v_q
      ) c
     order by c.orden, c.rank desc, c.nombre
     limit v_limit;
end;
$$;

comment on function public.search_catalog(text, int) is
  'Busca en el catálogo (materias por nombre/aliases/descripción y carreras por nombre) con precedencia de grupo: materias antes que carreras (PART 8 §8.5.3, PART 13 §13.4).';

revoke execute on function public.search_catalog(text, int) from public, anon;
grant execute on function public.search_catalog(text, int) to anon, authenticated;


create or replace function public.log_search_query(
  p_query         text,
  p_results_total int default 0
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_norm  text;
  v_total int := greatest(coalesce(p_results_total, 0), 0);
begin
  -- Escritor chico y aparte porque las search_* son STABLE y no escriben nada.
  -- Registra CONSULTAS, jamás personas: sin user_id, sin sesión, sin IP, sin
  -- ninguna vinculación (§0.5-R10, PART 13 §13.8). Es la radar de contenido
  -- faltante: la lista rankeada de lo que los estudiantes buscan y no está.
  v_norm := lower(btrim(regexp_replace(
              public.f_unaccent(coalesce(p_query, '')), '\s+', ' ', 'g')));

  if v_norm = '' then
    return;
  end if;

  -- Guardia de privacidad: la gente pega mails y números de DNI/legajo en los
  -- buscadores. Eso no se almacena ni aun sin vincular.
  if v_norm like '%@%' or v_norm ~ '[0-9]{7,}' then
    v_norm := '[redacted]';
  end if;

  v_norm := left(v_norm, 100);

  insert into public.search_queries (day, query_norm, results_total, zero_results, count)
  values (current_date, v_norm, v_total, v_total = 0, 1)
      on conflict (day, query_norm) do update
     set count         = search_queries.count + 1,
         results_total = excluded.results_total,
         zero_results  = excluded.zero_results;
end;
$$;

comment on function public.log_search_query(text, int) is
  'Registra telemetría de búsqueda en search_queries: consulta normalizada (minúsculas, sin acentos, ≤100 chars), total de resultados y bandera de cero resultados. Redacta consultas con @ o 7+ dígitos seguidos. Sin vinculación con el usuario, nunca (PART 13 §13.8, §0.5-R10).';

revoke execute on function public.log_search_query(text, int) from public, anon;
grant execute on function public.log_search_query(text, int) to anon, authenticated;


-- ============================================================================
-- 6. ANALÍTICA, LISTA DE ESPERA E INVITACIONES — PART 24 §24.2-§24.4, §0.5-R18/R22
--
-- Estos cinco objetos los exige el plan pero PART 8 §8.5 no los enumeró en su
-- inventario de RPC, aunque §8.3.7 los da por existentes al describir el camino de
-- escritura de `events` ("increments via track_event"), de `waitlist` ("inserts via
-- la función SECURITY DEFINER que llama la Server Action del formulario público") y
-- la validación previa del código de invitación de §0.5-R18. Sin ellos, tres tablas
-- del esquema quedan sin ningún camino de escritura. Ver docs/decisions.md.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- track_event — el ÚNICO camino de escritura de public.events
--
-- Contadores agregados por día. La tabla no puede reconstruir la conducta de nadie:
-- ese es su objetivo de diseño, no una limitación (PART 24 §24.1). Las dos allowlists
-- de acá son la garantía estructural de cardinalidad acotada: 14 eventos por pocos
-- valores de dim por 365 días son decenas de miles de filas al año, kilobytes.
-- Un dim libre serían millones de filas y un registro de conducta encubierto.
-- Por eso dim NUNCA lleva un id de usuario, un id de materia, ni texto libre
-- (el único almacén sancionado de texto de búsqueda es search_queries, §0.5-R10).
--
-- Ejecutable por anon: los eventos de visitante deslogueado (busqueda) también cuentan.
-- ----------------------------------------------------------------------------
create or replace function public.track_event(
  p_name text,
  p_dim  text default ''
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  -- El catálogo cerrado de PART 24 §24.3, más los tres agregados que escribe el cron
  -- nocturno (wau, mau, retorno_semanal) y el latido del keepalive (§21.5).
  -- Agregar un evento exige migración nueva Y una línea en docs/decisions.md.
  v_names constant text[] := array[
    'registro_completado', 'invitacion_usada', 'post_creado', 'post_anonimo',
    'comentario_creado', 'voto_emitido', 'recurso_subido', 'recurso_descargado',
    'busqueda', 'busqueda_sin_resultados', 'materia_seguida', 'reporte_creado',
    'cuenta_eliminada', 'dau', 'wau', 'mau', 'retorno_semanal', 'cron_heartbeat'
  ];
  v_dim   text := coalesce(p_dim, '');
  v_ok    boolean;
  -- El día se calcula en hora argentina, no en UTC: si no, todo lo que pasa entre
  -- las 21 y la medianoche cae en el día siguiente y las métricas diarias mienten.
  v_day   date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  if p_name is null or not (p_name = any (v_names)) then
    raise exception 'INVALID_INPUT';
  end if;

  -- Allowlist de dim por evento. Vacío = el evento no lleva dim.
  v_ok := case p_name
    when 'post_creado'         then v_dim in ('texto', 'pregunta')
    when 'comentario_creado'   then v_dim in ('anonimo', 'firmado')
    when 'voto_emitido'        then v_dim in ('post', 'comentario', 'recurso')
    when 'recurso_subido'      then v_dim in ('resumen','apunte','parcial','final','guia','otro')
    when 'recurso_descargado'  then v_dim in ('resumen','apunte','parcial','final','guia','otro')
    when 'reporte_creado'      then v_dim in ('spam','acoso','amenazas','datos_personales',
                                              'ataque_persona','suplantacion','contenido_ilegal',
                                              'compraventa','infraccion_autor','contenido_sexual',
                                              'manipulacion','otro')
    when 'cuenta_eliminada'    then v_dim in ('borrar', 'conservar')
    -- retorno_semanal lleva la cohorte 'cohorte-YYYY-WW' (PART 24 §24.4): forma
    -- acotada y verificable, no texto libre.
    when 'retorno_semanal'     then v_dim ~ '^cohorte-[0-9]{4}-[0-9]{2}$'
    else v_dim = ''
  end;

  if not v_ok then
    raise exception 'INVALID_INPUT';
  end if;

  insert into public.events (name, day, dim, count)
  values (p_name, v_day, v_dim, 1)
  on conflict (name, day, dim) do update
    set count = public.events.count + 1;
end;
$fn$;

comment on function public.track_event(text, text) is
  'Único camino de escritura de public.events (PART 24 §24.2). Incrementa el contador agregado del día en hora argentina. Valida el nombre contra el catálogo cerrado de PART 24 §24.3 y el dim contra la allowlist por evento: esa validación ES la garantía de cardinalidad acotada y de que la tabla no pueda convertirse en un log de conducta. Levanta INVALID_INPUT ante nombre o dim fuera de catálogo, para que el error aparezca en desarrollo; en producción el llamador lo traga, porque una analítica fallida jamás puede voltear la acción del usuario.';

revoke execute on function public.track_event(text, text) from public;
grant execute on function public.track_event(text, text) to anon, authenticated;


-- ----------------------------------------------------------------------------
-- touch_last_seen — DAU exacto sin ningún historial por usuario (PART 24 §24.4)
--
-- En cualquier request autenticado: si last_seen_day quedó atrás, se pisa con hoy y
-- se incrementa el contador dau. El valor de ayer se DESTRUYE al actualizar, así
-- que la conducta pasada es irreconstruible incluso para nosotros. WAU y MAU salen
-- del cron nocturno contando sobre esta misma columna.
-- ----------------------------------------------------------------------------
create or replace function public.touch_last_seen()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_uid uuid := auth.uid();
  v_day date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_hit boolean := false;
begin
  if v_uid is null then
    return;
  end if;

  update public.profiles p
     set last_seen_day = v_day
   where p.id = v_uid
     and (p.last_seen_day is null or p.last_seen_day < v_day)
  returning true into v_hit;

  if coalesce(v_hit, false) then
    perform public.track_event('dau');
  end if;
end;
$fn$;

comment on function public.touch_last_seen() is
  'Marca el día de actividad del usuario e incrementa DAU una sola vez por día (PART 24 §24.4). Sobrescribe en el lugar: no hay historial por usuario en ninguna parte del esquema. Sin sesión no hace nada.';

revoke execute on function public.touch_last_seen() from public, anon;
grant execute on function public.touch_last_seen() to authenticated;


-- ----------------------------------------------------------------------------
-- check_invite — validación previa del código, ANTES de crear la cuenta (§0.5-R18)
--
-- Quien todavía no tiene cuenta es anon, y anon no tiene ni tendrá select sobre
-- invites (un grant ahí dejaría enumerar códigos). Esta función definer es la única
-- forma de darle al estudiante un error amable en el formulario en vez de un signup
-- que aborta entero. NO consume el código: el consumo atómico ocurre en el trigger
-- handle_new_user (0004), que es el que sostiene la garantía de no reutilización.
-- ----------------------------------------------------------------------------
create or replace function public.check_invite(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_code text := lower(btrim(coalesce(p_code, '')));
  v_row  public.invites%rowtype;
begin
  if v_code !~ '^[a-z0-9]{8}$' then
    return jsonb_build_object('valid', false, 'reason', 'formato');
  end if;

  select * into v_row from public.invites i where i.code = v_code;

  if not found then
    return jsonb_build_object('valid', false, 'reason', 'inexistente');
  end if;
  if v_row.revoked_at is not null then
    return jsonb_build_object('valid', false, 'reason', 'revocada');
  end if;
  if v_row.expires_at is not null and v_row.expires_at <= now() then
    return jsonb_build_object('valid', false, 'reason', 'vencida');
  end if;
  if v_row.uses >= v_row.max_uses then
    return jsonb_build_object('valid', false, 'reason', 'agotada');
  end if;

  return jsonb_build_object('valid', true);
end;
$fn$;

comment on function public.check_invite(text) is
  'Valida un código de invitación en modo lectura, sin consumirlo (§0.5-R18). Devuelve {"valid": bool, "reason": text} con reason en (formato, inexistente, revocada, vencida, agotada) para que el formulario muestre copy útil. Ejecutable por anon a propósito: quien se registra todavía no tiene cuenta. No revela quién creó la invitación ni cuántos usos quedan, y enumerar códigos exigiría adivinar 8 caracteres de un alfabeto de 31.';

revoke execute on function public.check_invite(text) from public;
grant execute on function public.check_invite(text) to anon, authenticated;


-- ----------------------------------------------------------------------------
-- join_waitlist — el único camino de escritura de public.waitlist (§0.5-R22)
--
-- waitlist tiene RLS con cero políticas y cero grants: es PII pura y su postura es
-- de máximo encierro. Esta función es la única puerta, y es idempotente: reenviar el
-- mismo mail no crea filas ni revela si ya estaba, para no confirmarle una dirección
-- a un tercero que la pruebe.
-- ----------------------------------------------------------------------------
create or replace function public.join_waitlist(
  p_email  text,
  p_source text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_email  text := lower(btrim(coalesce(p_email, '')));
  v_source text := nullif(btrim(coalesce(p_source, '')), '');
begin
  -- Validación deliberadamente laxa: la forma exacta de un mail no se valida con una
  -- expresión regular, se valida mandándole un mail. Esto solo descarta basura evidente.
  if char_length(v_email) < 6
     or char_length(v_email) > 254
     or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then
    raise exception 'INVALID_INPUT';
  end if;

  if v_source is not null and char_length(v_source) > 60 then
    v_source := left(v_source, 60);
  end if;

  insert into public.waitlist (email, source)
  values (v_email::extensions.citext, v_source)
  on conflict (email) do nothing;
end;
$fn$;

comment on function public.join_waitlist(text, text) is
  'Único camino de escritura de public.waitlist (§0.5-R22): guarda un mail para avisar cuando abra el registro. Idempotente y silenciosa ante duplicados. Ejecutable por anon, porque el formulario vive en /registro antes de que exista cuenta. Las lecturas y exportaciones siguen siendo solo del lado servicio.';

revoke execute on function public.join_waitlist(text, text) from public;
grant execute on function public.join_waitlist(text, text) to anon, authenticated;


-- ----------------------------------------------------------------------------
-- materia_follower_count — el conteo público de seguidores de una materia
--
-- PART 8 §8.3.4 pide dos cosas que se contradicen entre sí: que materia_follows solo
-- exponga las filas propias (user_id = auth.uid()) y que la página de materia muestre
-- "128 seguidores" con un count(*) barato. Con esa política, un count(*) desde la app
-- devuelve 0 o 1. Se resuelve con esta función definer en vez de con una columna
-- cacheada: las vistas de página de materia son mucho más raras que las filas de feed,
-- el índice (materia_id) ya existe, y una columna cacheada agregaría otro contador que
-- reconciliar todas las noches.
-- ----------------------------------------------------------------------------
create or replace function public.materia_follower_count(p_materia_id bigint)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select count(*)::int
    from public.materia_follows f
   where f.materia_id = p_materia_id;
$fn$;

comment on function public.materia_follower_count(bigint) is
  'Conteo público de seguidores de una materia. Existe porque la política de materia_follows solo deja ver las filas propias (§8.3.4) y un count(*) desde la app daría 0 o 1. Devuelve un agregado y nada más: no hay forma de saber QUIÉN sigue una materia.';

revoke execute on function public.materia_follower_count(bigint) from public;
grant execute on function public.materia_follower_count(bigint) to anon, authenticated;
