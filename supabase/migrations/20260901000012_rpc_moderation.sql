-- =====================================================================================
-- 0011b — RPC de reportes, apelaciones, moderación e invitaciones
-- =====================================================================================
-- PART 8 §8.5.4 (create_report / create_appeal) y §8.5.5 completo, más create_invite.
-- Vocabulario de acciones y escalera de sanciones: PART 11 §11.3.1, §11.5.1, §11.6.2.
--
-- Esta migración no crea tablas: el DDL, la RLS y las políticas de `reports`,
-- `mod_actions`, `user_restrictions` y `appeals` viven en 0008; `notifications`,
-- `app_settings` y `events` en 0009; `invites` en 0003. Acá sólo hay funciones.
--
-- Reglas uniformes (PART 8 §8.5, BUILD-CONTRACT §5), sin excepción en este archivo:
--   1. `security definer` con `set search_path = public, pg_temp` pineado.
--   2. `revoke execute ... from public, anon;` + `grant execute ... to authenticated;`
--      explícito por función (las tablas base no tienen ningún grant de escritura).
--   3. Primer paso: resolver `auth.uid()` y cargar el perfil del que llama.
--   4. Errores con códigos estables de RPC_ERROR_CODES (lib/errors.ts). Ningún mensaje
--      crudo de Postgres llega a la pantalla de un estudiante.
--   5. Toda acción de moderación escribe exactamente una fila en `mod_actions`, con
--      `target_kind` y `target_public_id` snapshotteados en el momento de la acción
--      (la fila de auditoría sobrevive a la purga del contenido — §8.3.6).
--
-- Autorización: `create_report` y `create_appeal` son para cualquier cuenta; todas las
-- demás exigen `profiles.role in ('mod','admin')` y `profiles.status = 'activo'`.
-- El chequeo de rol se hace inline con una lectura directa de `public.profiles` (esta
-- función es SECURITY DEFINER, así que no depende de ninguna política): así el archivo
-- no depende de helpers definidos en migraciones que se escriben en paralelo.
--
-- Identidad pública de cada tipo de target (`target_public_id`):
--   post / comment / resource -> `public_id` (nanoid 10)
--   profile                   -> `handle` (la identidad pública de un perfil es su
--                                seudónimo, D7 `/u/[handle]`; no hay `public_id`)
-- =====================================================================================


-- =====================================================================================
-- §8.5.4 — Reportes y apelaciones (cualquier cuenta)
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- create_report — reporte de usuario contra exactamente un target
-- -------------------------------------------------------------------------------------
create or replace function public.create_report(
  p_target_kind      text,
  p_target_public_id text,
  p_categoria        text,
  p_detalle          text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid         uuid := auth.uid();
  v_status      text;
  v_created_at  timestamptz;
  v_tier        text;
  v_limit       int;
  v_used        int;
  v_detalle     text := nullif(btrim(coalesce(p_detalle, '')), '');
  v_post_id     bigint;
  v_comment_id  bigint;
  v_resource_id bigint;
  v_profile_id  uuid;
  v_author_id   uuid;
  v_report_id   bigint;
begin
  -- 1. Identidad y estado del denunciante ---------------------------------------------
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select pr.status, pr.created_at
    into v_status, v_created_at
  from public.profiles pr
  where pr.id = v_uid;

  if v_status is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if v_status = 'nuevo' then
    raise exception 'NOT_ONBOARDED';
  end if;
  if v_status = 'eliminado' then
    raise exception 'NOT_ALLOWED';
  end if;
  -- Una cuenta suspendida o baneada no participa: tampoco reporta (PART 11 §11.5.1).
  if v_status in ('suspendido', 'baneado') then
    raise exception 'RESTRICTED';
  end if;
  if exists (
    select 1
    from public.user_restrictions r
    where r.user_id = v_uid
      and r.revoked_at is null
      and r.starts_at <= now()
      and (r.until is null or r.until > now())
  ) then
    raise exception 'RESTRICTED';
  end if;

  -- 2. Kill switch de modo lectura (PART 10 §10.14) ------------------------------------
  if coalesce(
       (select s.value from public.app_settings s where s.key = 'sitio_solo_lectura'),
       'false'::jsonb
     ) = 'true'::jsonb then
    raise exception 'KILL_SWITCH';
  end if;

  -- 3. Validación de entrada (las 12 categorías de PART 11 §11.3.1, verbatim) ----------
  if p_categoria is null or p_categoria not in (
       'spam', 'acoso', 'amenazas', 'datos_personales', 'ataque_persona',
       'suplantacion', 'contenido_ilegal', 'compraventa', 'infraccion_autor',
       'contenido_sexual', 'manipulacion', 'otro'
     ) then
    raise exception 'INVALID_INPUT';
  end if;
  -- El detalle es obligatorio donde el reporte es inaccionable sin él (§11.3.2).
  if p_categoria in ('infraccion_autor', 'suplantacion', 'otro') and v_detalle is null then
    raise exception 'INVALID_INPUT';
  end if;
  if v_detalle is not null and char_length(v_detalle) > 1000 then
    raise exception 'INVALID_INPUT';
  end if;
  if p_target_public_id is null or btrim(p_target_public_id) = '' then
    raise exception 'INVALID_INPUT';
  end if;

  -- 4. Resolución del target a exactamente una columna FK (tenet 2) ---------------------
  -- No se filtra por status: un reporte contra contenido ya removido se acepta y se
  -- cierra después como `resuelto_duplicado` (§11.3.3), que es el diseño del auto-close.
  case p_target_kind
    when 'post' then
      select p.id, p.author_id into v_post_id, v_author_id
      from public.posts p
      where p.public_id = p_target_public_id;
    when 'comment' then
      select c.id, c.author_id into v_comment_id, v_author_id
      from public.comments c
      where c.public_id = p_target_public_id;
    when 'resource' then
      select r.id, r.author_id into v_resource_id, v_author_id
      from public.resources r
      where r.public_id = p_target_public_id;
    when 'profile' then
      select pr.id, pr.id into v_profile_id, v_author_id
      from public.profiles pr
      -- `operator(extensions.=)` explícito: con `search_path = public, pg_temp`
      -- los operadores de citext (que viven en `extensions`) no son visibles y
      -- un `=` pelado degradaría en silencio a comparación de texto sensible a
      -- mayúsculas — el handle dejaría de resolverse case-insensitive.
      where pr.handle operator(extensions.=) p_target_public_id::extensions.citext
        and pr.status <> 'eliminado';
    else
      raise exception 'INVALID_INPUT';
  end case;

  if v_author_id is null then
    raise exception 'TARGET_NOT_FOUND';
  end if;
  -- Reportarse a uno mismo sólo genera ruido en la cola.
  if v_author_id = v_uid then
    raise exception 'NOT_ALLOWED';
  end if;

  -- 5. Rate limit: reportes/día por tramo de antigüedad de cuenta -----------------------
  -- NOTA DE COORDINACIÓN (§0.5-R6): los valores son los de PART 11 §11.6.2 (T0 5 / T1 15
  -- / T2 25) y deberían leerse de `public.rate_limits()` (migración 0001). Se copian acá
  -- porque la firma de esa función no está fijada por PART 8 y este archivo se escribe en
  -- paralelo; reemplazar por la llamada compartida en cuanto 0001 esté fijada.
  v_tier := case
              when v_created_at > now() - interval '48 hours' then 'T0'
              when v_created_at > now() - interval '30 days'  then 'T1'
              else 'T2'
            end;
  v_limit := case v_tier when 'T0' then 5 when 'T1' then 15 else 25 end;

  select count(*)
    into v_used
  from public.reports r
  where r.reporter_id = v_uid
    and r.created_at > now() - interval '24 hours';

  if v_used >= v_limit then
    raise exception 'RATE_LIMIT';
  end if;

  -- 6. Alta del reporte -----------------------------------------------------------------
  -- `on conflict do nothing` sin arbiter: los únicos índices únicos de `reports` aparte
  -- de la PK son los parciales de dedup (reporter_id, <target>) — un choque ahí significa
  -- exactamente "ya reportaste esto" (§11.3.3).
  insert into public.reports (
    reporter_id, post_id, comment_id, resource_id, profile_id, categoria, detalle
  )
  values (
    v_uid, v_post_id, v_comment_id, v_resource_id, v_profile_id, p_categoria, v_detalle
  )
  on conflict do nothing
  returning id into v_report_id;

  if v_report_id is null then
    raise exception 'DUPLICATE_REPORT';
  end if;
end;
$$;

revoke execute on function public.create_report(text, text, text, text) from public, anon;
grant execute on function public.create_report(text, text, text, text) to authenticated;

comment on function public.create_report(text, text, text, text) is
  'Reporte de usuario contra exactamente un target (post/comment/resource/profile). '
  'Resuelve `p_target_public_id` (public_id, o handle para perfiles) a una sola columna FK; '
  'exige detalle en infraccion_autor/suplantacion/otro; aplica el límite diario de PART 11 '
  '§11.6.2; el choque contra el índice único parcial se traduce a DUPLICATE_REPORT.';


-- -------------------------------------------------------------------------------------
-- create_appeal — una apelación por acción de moderación, hecha por su destinatario
-- -------------------------------------------------------------------------------------
create or replace function public.create_appeal(
  p_mod_action_id bigint,
  p_body          text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid         uuid := auth.uid();
  v_status      text;
  v_body        text := btrim(coalesce(p_body, ''));
  v_action      text;
  v_action_at   timestamptz;
  v_post_id     bigint;
  v_comment_id  bigint;
  v_resource_id bigint;
  v_profile_id  uuid;
  v_target      uuid;
  v_appeal_id   bigint;
begin
  -- 1. Identidad. Una cuenta suspendida o baneada SÍ puede apelar: la restricción corta
  --    la participación, no el debido proceso (PART 11 §11.5.2).
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select pr.status into v_status
  from public.profiles pr
  where pr.id = v_uid;

  if v_status is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if v_status = 'eliminado' then
    raise exception 'NOT_ALLOWED';
  end if;

  if coalesce(
       (select s.value from public.app_settings s where s.key = 'sitio_solo_lectura'),
       'false'::jsonb
     ) = 'true'::jsonb then
    raise exception 'KILL_SWITCH';
  end if;

  -- 2. Validación de entrada (columna: between 1 and 2000) ------------------------------
  if p_mod_action_id is null then
    raise exception 'INVALID_INPUT';
  end if;
  if char_length(v_body) < 1 or char_length(v_body) > 2000 then
    raise exception 'INVALID_INPUT';
  end if;

  -- 3. La acción apelada ----------------------------------------------------------------
  select a.action, a.created_at, a.post_id, a.comment_id, a.resource_id, a.profile_id
    into v_action, v_action_at, v_post_id, v_comment_id, v_resource_id, v_profile_id
  from public.mod_actions a
  where a.id = p_mod_action_id;

  if v_action is null then
    raise exception 'TARGET_NOT_FOUND';
  end if;

  -- Sólo se apelan sanciones. `revelar_autor` en particular no es apelable: responder a
  -- una apelación sobre esa fila le confirmaría al autor anónimo que fue revelado
  -- (§11.4.2). Tampoco se apelan las reversiones ni los cierres de reporte.
  if v_action not in ('remover', 'advertir', 'suspender', 'banear', 'retiro_legal', 'bloquear_hilo') then
    raise exception 'NOT_ALLOWED';
  end if;

  -- Ventana de 30 días (§11.5.2). No hay código propio en RPC_ERROR_CODES: NOT_ALLOWED.
  if v_action_at < now() - interval '30 days' then
    raise exception 'NOT_ALLOWED';
  end if;

  -- 4. El que llama tiene que ser el destinatario de la acción --------------------------
  --    (la autoría se verifica contra el target; `appeals` no guarda al apelante).
  if v_profile_id is not null then
    v_target := v_profile_id;
  elsif v_post_id is not null then
    select p.author_id into v_target from public.posts p where p.id = v_post_id;
  elsif v_comment_id is not null then
    select c.author_id into v_target from public.comments c where c.id = v_comment_id;
  elsif v_resource_id is not null then
    select r.author_id into v_target from public.resources r where r.id = v_resource_id;
  end if;

  if v_target is null or v_target <> v_uid then
    raise exception 'NOT_ALLOWED';
  end if;

  -- 5. Alta de la apelación: UNIQUE (mod_action_id) => una por acción --------------------
  insert into public.appeals (mod_action_id, body)
  values (p_mod_action_id, v_body)
  on conflict do nothing
  returning id into v_appeal_id;

  if v_appeal_id is null then
    raise exception 'DUPLICATE_APPEAL';
  end if;
end;
$$;

revoke execute on function public.create_appeal(bigint, text) from public, anon;
grant execute on function public.create_appeal(bigint, text) to authenticated;

comment on function public.create_appeal(bigint, text) is
  'Apelación estructurada de /apelacion (§0.5-R15): verifica que quien llama sea el '
  'destinatario de la acción (autor del contenido, o el perfil sancionado), que la acción '
  'sea apelable y esté dentro de los 30 días, e inserta una sola apelación por acción '
  '(DUPLICATE_APPEAL si ya existe). Las cuentas suspendidas o baneadas pueden apelar.';


-- =====================================================================================
-- §8.5.5 — RPC de moderación (todas exigen role in ('mod','admin'))
-- =====================================================================================
-- Nota sobre el kill switch: las funciones de moderación NO consultan `sitio_solo_lectura`. El
-- modo lectura congela la participación de la comunidad, no la capacidad del equipo de
-- contener un incidente (PART 10 §10.14 usa el modo solo-lectura justamente durante incidentes).
--
-- Nota sobre PART 11 §11.8.3: la política reserva `banear` y las determinaciones de
-- derechos de autor a admin. PART 8 §8.5.5 exige uniformemente role in ('mod','admin')
-- y el esquema no tiene columna `mod_stage`, así que la distinción se aplica en el panel
-- y en el acuerdo de moderación, no acá. Se documenta la tensión a propósito.

-- -------------------------------------------------------------------------------------
-- mod_remove_post — status -> eliminado_mod (el cuerpo se conserva como evidencia, §8.7)
-- -------------------------------------------------------------------------------------
create or replace function public.mod_remove_post(
  p_public_id text,
  p_motivo    text,
  p_notas     text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor        uuid := auth.uid();
  v_role         text;
  v_actor_status text;
  v_motivo       text := btrim(coalesce(p_motivo, ''));
  v_notas        text := nullif(btrim(coalesce(p_notas, '')), '');
  v_post_id      bigint;
  v_author_id    uuid;
  v_status       text;
  v_action_id    bigint;
begin
  if v_actor is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select pr.role, pr.status into v_role, v_actor_status
  from public.profiles pr where pr.id = v_actor;
  if v_role is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if v_role not in ('mod', 'admin') or v_actor_status <> 'activo' then
    raise exception 'NOT_ALLOWED';
  end if;

  if char_length(v_motivo) < 3 or char_length(v_motivo) > 500 then
    raise exception 'INVALID_INPUT';
  end if;
  if v_notas is not null and char_length(v_notas) > 2000 then
    raise exception 'INVALID_INPUT';
  end if;

  select p.id, p.author_id, p.status into v_post_id, v_author_id, v_status
  from public.posts p
  where p.public_id = p_public_id;

  if v_post_id is null or v_status <> 'activo' then
    raise exception 'TARGET_NOT_FOUND';
  end if;

  update public.posts
     set status = 'eliminado_mod'
   where id = v_post_id;

  insert into public.mod_actions (
    actor_id, action, post_id, target_kind, target_public_id, motivo_publico, notas_internas
  )
  values (v_actor, 'remover', v_post_id, 'post', p_public_id, v_motivo, v_notas)
  returning id into v_action_id;

  -- La moderación de tu contenido nunca es anónima para vos (D3). No se notifica al
  -- moderador cuando actúa sobre su propio contenido (PART 12: nada auto-causado).
  if v_author_id <> v_actor then
    insert into public.notifications (user_id, type, post_id, mod_action_id, actor_display)
    values (v_author_id, 'decision_mod', v_post_id, v_action_id, 'Moderación');
  end if;
end;
$$;

revoke execute on function public.mod_remove_post(text, text, text) from public, anon;
grant execute on function public.mod_remove_post(text, text, text) to authenticated;

comment on function public.mod_remove_post(text, text, text) is
  'Remoción por moderación de una publicación activa: status -> eliminado_mod (el cuerpo '
  'se conserva como evidencia para apelación/auditoría, §8.7), fila `remover` en '
  'mod_actions y notificación decision_mod al autor con el motivo público.';


-- -------------------------------------------------------------------------------------
-- mod_remove_comment
-- -------------------------------------------------------------------------------------
create or replace function public.mod_remove_comment(
  p_public_id text,
  p_motivo    text,
  p_notas     text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor        uuid := auth.uid();
  v_role         text;
  v_actor_status text;
  v_motivo       text := btrim(coalesce(p_motivo, ''));
  v_notas        text := nullif(btrim(coalesce(p_notas, '')), '');
  v_comment_id   bigint;
  v_post_id      bigint;
  v_author_id    uuid;
  v_status       text;
  v_action_id    bigint;
begin
  if v_actor is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select pr.role, pr.status into v_role, v_actor_status
  from public.profiles pr where pr.id = v_actor;
  if v_role is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if v_role not in ('mod', 'admin') or v_actor_status <> 'activo' then
    raise exception 'NOT_ALLOWED';
  end if;

  if char_length(v_motivo) < 3 or char_length(v_motivo) > 500 then
    raise exception 'INVALID_INPUT';
  end if;
  if v_notas is not null and char_length(v_notas) > 2000 then
    raise exception 'INVALID_INPUT';
  end if;

  select c.id, c.post_id, c.author_id, c.status
    into v_comment_id, v_post_id, v_author_id, v_status
  from public.comments c
  where c.public_id = p_public_id;

  if v_comment_id is null or v_status <> 'activo' then
    raise exception 'TARGET_NOT_FOUND';
  end if;

  update public.comments
     set status = 'eliminado_mod'
   where id = v_comment_id;

  -- El contador cachea comentarios vivos (mismo criterio que delete_own_comment, §8.5.3);
  -- el recuento nocturno lo reconcilia igual (§8.2.5).
  update public.posts
     set comments_count = greatest(comments_count - 1, 0)
   where id = v_post_id;

  insert into public.mod_actions (
    actor_id, action, comment_id, target_kind, target_public_id, motivo_publico, notas_internas
  )
  values (v_actor, 'remover', v_comment_id, 'comment', p_public_id, v_motivo, v_notas)
  returning id into v_action_id;

  if v_author_id <> v_actor then
    insert into public.notifications (
      user_id, type, post_id, comment_id, mod_action_id, actor_display
    )
    values (v_author_id, 'decision_mod', v_post_id, v_comment_id, v_action_id, 'Moderación');
  end if;
end;
$$;

revoke execute on function public.mod_remove_comment(text, text, text) from public, anon;
grant execute on function public.mod_remove_comment(text, text, text) to authenticated;

comment on function public.mod_remove_comment(text, text, text) is
  'Remoción por moderación de un comentario activo: status -> eliminado_mod (queda la '
  'lápida en el hilo), decrementa posts.comments_count, escribe `remover` en mod_actions '
  'y notifica decision_mod al autor.';


-- -------------------------------------------------------------------------------------
-- mod_remove_resource
-- -------------------------------------------------------------------------------------
create or replace function public.mod_remove_resource(
  p_public_id text,
  p_motivo    text,
  p_notas     text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor        uuid := auth.uid();
  v_role         text;
  v_actor_status text;
  v_motivo       text := btrim(coalesce(p_motivo, ''));
  v_notas        text := nullif(btrim(coalesce(p_notas, '')), '');
  v_resource_id  bigint;
  v_author_id    uuid;
  v_status       text;
  v_action_id    bigint;
begin
  if v_actor is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select pr.role, pr.status into v_role, v_actor_status
  from public.profiles pr where pr.id = v_actor;
  if v_role is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if v_role not in ('mod', 'admin') or v_actor_status <> 'activo' then
    raise exception 'NOT_ALLOWED';
  end if;

  if char_length(v_motivo) < 3 or char_length(v_motivo) > 500 then
    raise exception 'INVALID_INPUT';
  end if;
  if v_notas is not null and char_length(v_notas) > 2000 then
    raise exception 'INVALID_INPUT';
  end if;

  -- Se remueve lo publicado; los borradores los limpia la purga de 24 h (§8.7).
  select r.id, r.author_id, r.status into v_resource_id, v_author_id, v_status
  from public.resources r
  where r.public_id = p_public_id;

  if v_resource_id is null or v_status not in ('activo', 'pendiente') then
    raise exception 'TARGET_NOT_FOUND';
  end if;

  -- Los objetos en R2 los destruye la purga 30 días después del borrado lógico (§8.7).
  update public.resources
     set status = 'eliminado_mod'
   where id = v_resource_id;

  insert into public.mod_actions (
    actor_id, action, resource_id, target_kind, target_public_id, motivo_publico, notas_internas
  )
  values (v_actor, 'remover', v_resource_id, 'resource', p_public_id, v_motivo, v_notas)
  returning id into v_action_id;

  if v_author_id <> v_actor then
    insert into public.notifications (user_id, type, mod_action_id, actor_display)
    values (v_author_id, 'decision_mod', v_action_id, 'Moderación');
  end if;
end;
$$;

revoke execute on function public.mod_remove_resource(text, text, text) from public, anon;
grant execute on function public.mod_remove_resource(text, text, text) to authenticated;

comment on function public.mod_remove_resource(text, text, text) is
  'Remoción por moderación de un recurso publicado: status -> eliminado_mod (los archivos '
  'en R2 los destruye la purga a los 30 días, §8.7), fila `remover` en mod_actions y '
  'notificación decision_mod al autor.';


-- -------------------------------------------------------------------------------------
-- mod_restore_post / mod_restore_comment / mod_restore_resource
-- Sólo desde `eliminado_mod`: los borrados por el autor no son restaurables por el equipo.
-- -------------------------------------------------------------------------------------
create or replace function public.mod_restore_post(
  p_public_id text,
  p_motivo    text,
  p_notas     text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor        uuid := auth.uid();
  v_role         text;
  v_actor_status text;
  v_motivo       text := btrim(coalesce(p_motivo, ''));
  v_notas        text := nullif(btrim(coalesce(p_notas, '')), '');
  v_post_id      bigint;
  v_author_id    uuid;
  v_action_id    bigint;
begin
  if v_actor is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select pr.role, pr.status into v_role, v_actor_status
  from public.profiles pr where pr.id = v_actor;
  if v_role is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if v_role not in ('mod', 'admin') or v_actor_status <> 'activo' then
    raise exception 'NOT_ALLOWED';
  end if;

  if char_length(v_motivo) < 3 or char_length(v_motivo) > 500 then
    raise exception 'INVALID_INPUT';
  end if;
  if v_notas is not null and char_length(v_notas) > 2000 then
    raise exception 'INVALID_INPUT';
  end if;

  -- `body is not null` protege el CHECK posts_body_required: un post con el cuerpo
  -- vaciado (borrado de cuenta) no puede volver a `activo`.
  select p.id, p.author_id into v_post_id, v_author_id
  from public.posts p
  where p.public_id = p_public_id
    and p.status = 'eliminado_mod'
    and p.body is not null;

  if v_post_id is null then
    raise exception 'TARGET_NOT_FOUND';
  end if;

  update public.posts
     set status = 'activo'
   where id = v_post_id;

  insert into public.mod_actions (
    actor_id, action, post_id, target_kind, target_public_id, motivo_publico, notas_internas
  )
  values (v_actor, 'restaurar', v_post_id, 'post', p_public_id, v_motivo, v_notas)
  returning id into v_action_id;

  if v_author_id <> v_actor then
    insert into public.notifications (user_id, type, post_id, mod_action_id, actor_display)
    values (v_author_id, 'decision_mod', v_post_id, v_action_id, 'Moderación');
  end if;
end;
$$;

revoke execute on function public.mod_restore_post(text, text, text) from public, anon;
grant execute on function public.mod_restore_post(text, text, text) to authenticated;

comment on function public.mod_restore_post(text, text, text) is
  'Restauración de una publicación removida por moderación (eliminado_mod -> activo). No '
  'restaura borrados del autor ni publicaciones con el cuerpo ya vaciado. Escribe '
  '`restaurar` en mod_actions y notifica al autor.';


create or replace function public.mod_restore_comment(
  p_public_id text,
  p_motivo    text,
  p_notas     text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor        uuid := auth.uid();
  v_role         text;
  v_actor_status text;
  v_motivo       text := btrim(coalesce(p_motivo, ''));
  v_notas        text := nullif(btrim(coalesce(p_notas, '')), '');
  v_comment_id   bigint;
  v_post_id      bigint;
  v_author_id    uuid;
  v_action_id    bigint;
begin
  if v_actor is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select pr.role, pr.status into v_role, v_actor_status
  from public.profiles pr where pr.id = v_actor;
  if v_role is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if v_role not in ('mod', 'admin') or v_actor_status <> 'activo' then
    raise exception 'NOT_ALLOWED';
  end if;

  if char_length(v_motivo) < 3 or char_length(v_motivo) > 500 then
    raise exception 'INVALID_INPUT';
  end if;
  if v_notas is not null and char_length(v_notas) > 2000 then
    raise exception 'INVALID_INPUT';
  end if;

  select c.id, c.post_id, c.author_id into v_comment_id, v_post_id, v_author_id
  from public.comments c
  where c.public_id = p_public_id
    and c.status = 'eliminado_mod'
    and c.body is not null;

  if v_comment_id is null then
    raise exception 'TARGET_NOT_FOUND';
  end if;

  update public.comments
     set status = 'activo'
   where id = v_comment_id;

  update public.posts
     set comments_count = comments_count + 1
   where id = v_post_id;

  insert into public.mod_actions (
    actor_id, action, comment_id, target_kind, target_public_id, motivo_publico, notas_internas
  )
  values (v_actor, 'restaurar', v_comment_id, 'comment', p_public_id, v_motivo, v_notas)
  returning id into v_action_id;

  if v_author_id <> v_actor then
    insert into public.notifications (
      user_id, type, post_id, comment_id, mod_action_id, actor_display
    )
    values (v_author_id, 'decision_mod', v_post_id, v_comment_id, v_action_id, 'Moderación');
  end if;
end;
$$;

revoke execute on function public.mod_restore_comment(text, text, text) from public, anon;
grant execute on function public.mod_restore_comment(text, text, text) to authenticated;

comment on function public.mod_restore_comment(text, text, text) is
  'Restauración de un comentario removido por moderación (eliminado_mod -> activo); '
  'vuelve a sumar al contador del post, escribe `restaurar` y notifica al autor.';


create or replace function public.mod_restore_resource(
  p_public_id text,
  p_motivo    text,
  p_notas     text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor        uuid := auth.uid();
  v_role         text;
  v_actor_status text;
  v_motivo       text := btrim(coalesce(p_motivo, ''));
  v_notas        text := nullif(btrim(coalesce(p_notas, '')), '');
  v_resource_id  bigint;
  v_author_id    uuid;
  v_action_id    bigint;
begin
  if v_actor is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select pr.role, pr.status into v_role, v_actor_status
  from public.profiles pr where pr.id = v_actor;
  if v_role is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if v_role not in ('mod', 'admin') or v_actor_status <> 'activo' then
    raise exception 'NOT_ALLOWED';
  end if;

  if char_length(v_motivo) < 3 or char_length(v_motivo) > 500 then
    raise exception 'INVALID_INPUT';
  end if;
  if v_notas is not null and char_length(v_notas) > 2000 then
    raise exception 'INVALID_INPUT';
  end if;

  -- `retirado_legal` no se restaura por esta vía: los archivos ya fueron destruidos y el
  -- levantamiento de un retiro legal es una decisión con su propio expediente.
  select r.id, r.author_id into v_resource_id, v_author_id
  from public.resources r
  where r.public_id = p_public_id
    and r.status = 'eliminado_mod';

  if v_resource_id is null then
    raise exception 'TARGET_NOT_FOUND';
  end if;

  update public.resources
     set status = 'activo'
   where id = v_resource_id;

  insert into public.mod_actions (
    actor_id, action, resource_id, target_kind, target_public_id, motivo_publico, notas_internas
  )
  values (v_actor, 'restaurar', v_resource_id, 'resource', p_public_id, v_motivo, v_notas)
  returning id into v_action_id;

  if v_author_id <> v_actor then
    insert into public.notifications (user_id, type, mod_action_id, actor_display)
    values (v_author_id, 'decision_mod', v_action_id, 'Moderación');
  end if;
end;
$$;

revoke execute on function public.mod_restore_resource(text, text, text) from public, anon;
grant execute on function public.mod_restore_resource(text, text, text) to authenticated;

comment on function public.mod_restore_resource(text, text, text) is
  'Restauración de un recurso removido por moderación (eliminado_mod -> activo). No aplica '
  'a `retirado_legal`. Escribe `restaurar` en mod_actions y notifica al autor.';


-- -------------------------------------------------------------------------------------
-- mod_legal_takedown_resource — retiro por reclamo legal (Ley 11.723 / datos personales)
-- -------------------------------------------------------------------------------------
create or replace function public.mod_legal_takedown_resource(
  p_public_id text,
  p_motivo    text,
  p_notas     text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor        uuid := auth.uid();
  v_role         text;
  v_actor_status text;
  v_motivo       text := btrim(coalesce(p_motivo, ''));
  v_notas        text := nullif(btrim(coalesce(p_notas, '')), '');
  v_resource_id  bigint;
  v_author_id    uuid;
  v_status       text;
  v_action_id    bigint;
begin
  if v_actor is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select pr.role, pr.status into v_role, v_actor_status
  from public.profiles pr where pr.id = v_actor;
  if v_role is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if v_role not in ('mod', 'admin') or v_actor_status <> 'activo' then
    raise exception 'NOT_ALLOWED';
  end if;

  if char_length(v_motivo) < 3 or char_length(v_motivo) > 500 then
    raise exception 'INVALID_INPUT';
  end if;
  if v_notas is not null and char_length(v_notas) > 2000 then
    raise exception 'INVALID_INPUT';
  end if;

  -- El retiro legal alcanza a cualquier estado salvo uno ya retirado: aunque el recurso
  -- ya esté removido, el retiro legal cambia el destino de los archivos (destrucción
  -- inmediata) y la pista de auditoría (§8.2.2, §8.7).
  select r.id, r.author_id, r.status into v_resource_id, v_author_id, v_status
  from public.resources r
  where r.public_id = p_public_id;

  if v_resource_id is null or v_status = 'retirado_legal' then
    raise exception 'TARGET_NOT_FOUND';
  end if;

  update public.resources
     set status = 'retirado_legal'
   where id = v_resource_id;

  insert into public.mod_actions (
    actor_id, action, resource_id, target_kind, target_public_id, motivo_publico, notas_internas
  )
  values (v_actor, 'retiro_legal', v_resource_id, 'resource', p_public_id, v_motivo, v_notas)
  returning id into v_action_id;

  if v_author_id <> v_actor then
    insert into public.notifications (user_id, type, mod_action_id, actor_display)
    values (v_author_id, 'decision_mod', v_action_id, 'Moderación');
  end if;
end;
$$;

revoke execute on function public.mod_legal_takedown_resource(text, text, text) from public, anon;
grant execute on function public.mod_legal_takedown_resource(text, text, text) to authenticated;

comment on function public.mod_legal_takedown_resource(text, text, text) is
  'Retiro legal de un recurso (PART 11 §11.7.2): status -> retirado_legal — distinto de la '
  'remoción ordinaria porque dispara destrucción inmediata de archivos y su propia pista '
  'de auditoría —, acción `retiro_legal` y notificación al autor con el motivo público.';


-- -------------------------------------------------------------------------------------
-- mod_warn_user — advertencia: notificación y strike, sin restricción
-- -------------------------------------------------------------------------------------
create or replace function public.mod_warn_user(
  p_handle text,
  p_motivo text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor        uuid := auth.uid();
  v_role         text;
  v_actor_status text;
  v_motivo       text := btrim(coalesce(p_motivo, ''));
  v_target       uuid;
  v_handle       text;
  v_action_id    bigint;
begin
  if v_actor is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select pr.role, pr.status into v_role, v_actor_status
  from public.profiles pr where pr.id = v_actor;
  if v_role is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if v_role not in ('mod', 'admin') or v_actor_status <> 'activo' then
    raise exception 'NOT_ALLOWED';
  end if;

  if char_length(v_motivo) < 3 or char_length(v_motivo) > 500 then
    raise exception 'INVALID_INPUT';
  end if;

  -- `operator(extensions.=)` explícito: ver la nota de create_report — bajo
  -- `search_path = public, pg_temp` un `=` pelado compararía como text (case
  -- sensitive) en vez de como citext.
  select pr.id, pr.handle::text into v_target, v_handle
  from public.profiles pr
  where pr.handle operator(extensions.=) p_handle::extensions.citext
    and pr.status <> 'eliminado';

  if v_target is null then
    raise exception 'TARGET_NOT_FOUND';
  end if;
  if v_target = v_actor then
    raise exception 'NOT_ALLOWED';
  end if;

  insert into public.mod_actions (
    actor_id, action, profile_id, target_kind, target_public_id, motivo_publico
  )
  values (v_actor, 'advertir', v_target, 'profile', v_handle, v_motivo)
  returning id into v_action_id;

  insert into public.notifications (user_id, type, mod_action_id, actor_display)
  values (v_target, 'decision_mod', v_action_id, 'Moderación');
end;
$$;

revoke execute on function public.mod_warn_user(text, text) from public, anon;
grant execute on function public.mod_warn_user(text, text) to authenticated;

comment on function public.mod_warn_user(text, text) is
  'Advertencia a una cuenta (PART 11 §11.5.1): sólo fila `advertir` en mod_actions más la '
  'notificación decision_mod. No crea restricción ni toca profiles.status.';


-- -------------------------------------------------------------------------------------
-- mod_restrict_user — suspensión o ban; escribe user_restrictions y espeja profiles.status
-- -------------------------------------------------------------------------------------
create or replace function public.mod_restrict_user(
  p_handle text,
  p_tipo   text,
  p_until  timestamptz,
  p_motivo text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor         uuid := auth.uid();
  v_role          text;
  v_actor_status  text;
  v_motivo        text := btrim(coalesce(p_motivo, ''));
  v_target        uuid;
  v_handle        text;
  v_target_status text;
  v_new_status    text;
  v_action_id     bigint;
begin
  if v_actor is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select pr.role, pr.status into v_role, v_actor_status
  from public.profiles pr where pr.id = v_actor;
  if v_role is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if v_role not in ('mod', 'admin') or v_actor_status <> 'activo' then
    raise exception 'NOT_ALLOWED';
  end if;

  if p_tipo is null or p_tipo not in ('suspension', 'ban') then
    raise exception 'INVALID_INPUT';
  end if;
  if char_length(v_motivo) < 3 or char_length(v_motivo) > 500 then
    raise exception 'INVALID_INPUT';
  end if;
  -- La duración no vive en el nombre de la acción sino en `until` (§8.3.6): una suspensión
  -- necesita fecha futura (7 o 30 días en la escalera) y un ban es permanente (until null).
  if p_tipo = 'suspension' and (p_until is null or p_until <= now()) then
    raise exception 'INVALID_INPUT';
  end if;
  if p_tipo = 'ban' and p_until is not null then
    raise exception 'INVALID_INPUT';
  end if;

  -- `operator(extensions.=)` explícito: ver la nota de create_report.
  select pr.id, pr.handle::text, pr.status into v_target, v_handle, v_target_status
  from public.profiles pr
  where pr.handle operator(extensions.=) p_handle::extensions.citext
    and pr.status <> 'eliminado';

  if v_target is null then
    raise exception 'TARGET_NOT_FOUND';
  end if;
  if v_target = v_actor then
    raise exception 'NOT_ALLOWED';
  end if;

  insert into public.user_restrictions (user_id, tipo, motivo, created_by, until)
  values (v_target, p_tipo, v_motivo, v_actor, p_until);

  -- Espejo de la peor restricción activa en profiles.status (§8.3.6). Se recalcula en vez
  -- de asignarse a ciegas para que una suspensión posterior no degrade un ban vigente.
  select case
           when exists (
             select 1 from public.user_restrictions r
             where r.user_id = v_target and r.tipo = 'ban'
               and r.revoked_at is null and r.starts_at <= now()
               and (r.until is null or r.until > now())
           ) then 'baneado'
           when exists (
             select 1 from public.user_restrictions r
             where r.user_id = v_target and r.tipo = 'suspension'
               and r.revoked_at is null and r.starts_at <= now()
               and (r.until is null or r.until > now())
           ) then 'suspendido'
           else v_target_status
         end
    into v_new_status;

  update public.profiles
     set status = v_new_status
   where id = v_target
     and status <> v_new_status;

  insert into public.mod_actions (
    actor_id, action, profile_id, target_kind, target_public_id, motivo_publico
  )
  values (
    v_actor,
    case p_tipo when 'ban' then 'banear' else 'suspender' end,
    v_target, 'profile', v_handle, v_motivo
  )
  returning id into v_action_id;

  insert into public.notifications (user_id, type, mod_action_id, actor_display)
  values (v_target, 'decision_mod', v_action_id, 'Moderación');
end;
$$;

revoke execute on function public.mod_restrict_user(text, text, timestamptz, text) from public, anon;
grant execute on function public.mod_restrict_user(text, text, timestamptz, text) to authenticated;

comment on function public.mod_restrict_user(text, text, timestamptz, text) is
  'Suspensión (until obligatorio y futuro) o ban (until null = permanente): inserta en '
  'user_restrictions, espeja la peor restricción activa en profiles.status, escribe '
  '`suspender`/`banear` en mod_actions y notifica decision_mod al sancionado.';


-- -------------------------------------------------------------------------------------
-- mod_revoke_restriction — levantar una restricción y re-derivar profiles.status
-- -------------------------------------------------------------------------------------
create or replace function public.mod_revoke_restriction(
  p_restriction_id bigint
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor         uuid := auth.uid();
  v_role          text;
  v_actor_status  text;
  v_target        uuid;
  v_handle        text;
  v_target_status text;
  v_new_status    text;
  v_action_id     bigint;
begin
  if v_actor is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select pr.role, pr.status into v_role, v_actor_status
  from public.profiles pr where pr.id = v_actor;
  if v_role is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if v_role not in ('mod', 'admin') or v_actor_status <> 'activo' then
    raise exception 'NOT_ALLOWED';
  end if;

  if p_restriction_id is null then
    raise exception 'INVALID_INPUT';
  end if;

  select r.user_id into v_target
  from public.user_restrictions r
  where r.id = p_restriction_id
    and r.revoked_at is null;

  if v_target is null then
    raise exception 'TARGET_NOT_FOUND';
  end if;

  update public.user_restrictions
     set revoked_at = now(),
         revoked_by = v_actor
   where id = p_restriction_id;

  select pr.handle::text, pr.status into v_handle, v_target_status
  from public.profiles pr
  where pr.id = v_target;

  -- Re-derivación del espejo. Nunca se resucita un perfil `eliminado`, y `nuevo` no se
  -- recupera (una cuenta sancionada antes de completar el onboarding vuelve como activa;
  -- caso de borde aceptado y reconciliado igual por el job nocturno, §8.5.6).
  select case
           when exists (
             select 1 from public.user_restrictions r
             where r.user_id = v_target and r.tipo = 'ban'
               and r.revoked_at is null and r.starts_at <= now()
               and (r.until is null or r.until > now())
           ) then 'baneado'
           when exists (
             select 1 from public.user_restrictions r
             where r.user_id = v_target and r.tipo = 'suspension'
               and r.revoked_at is null and r.starts_at <= now()
               and (r.until is null or r.until > now())
           ) then 'suspendido'
           else 'activo'
         end
    into v_new_status;

  if v_target_status in ('suspendido', 'baneado') then
    update public.profiles
       set status = v_new_status
     where id = v_target
       and status <> v_new_status;
  end if;

  -- El vocabulario cerrado tiene un solo verbo de reversión de restricciones.
  insert into public.mod_actions (
    actor_id, action, profile_id, target_kind, target_public_id, motivo_publico, notas_internas
  )
  values (
    v_actor, 'desbanear', v_target, 'profile', v_handle,
    'Se levantó la restricción sobre tu cuenta.',
    'Restricción #' || p_restriction_id::text || ' revocada.'
  )
  returning id into v_action_id;

  insert into public.notifications (user_id, type, mod_action_id, actor_display)
  values (v_target, 'decision_mod', v_action_id, 'Moderación');
end;
$$;

revoke execute on function public.mod_revoke_restriction(bigint) from public, anon;
grant execute on function public.mod_revoke_restriction(bigint) to authenticated;

comment on function public.mod_revoke_restriction(bigint) is
  'Revoca una restricción vigente (revoked_at/revoked_by), re-deriva profiles.status a '
  'partir de las restricciones que queden activas, escribe `desbanear` — único verbo de '
  'reversión de restricciones del vocabulario cerrado — y notifica al usuario.';


-- -------------------------------------------------------------------------------------
-- mod_lock_thread — cierre de hilo (§0.5-R5, §11.6.4)
-- -------------------------------------------------------------------------------------
create or replace function public.mod_lock_thread(
  p_public_id text,
  p_motivo    text,
  p_notas     text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor        uuid := auth.uid();
  v_role         text;
  v_actor_status text;
  v_motivo       text := btrim(coalesce(p_motivo, ''));
  v_notas        text := nullif(btrim(coalesce(p_notas, '')), '');
  v_post_id      bigint;
  v_status       text;
begin
  if v_actor is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select pr.role, pr.status into v_role, v_actor_status
  from public.profiles pr where pr.id = v_actor;
  if v_role is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if v_role not in ('mod', 'admin') or v_actor_status <> 'activo' then
    raise exception 'NOT_ALLOWED';
  end if;

  if char_length(v_motivo) < 3 or char_length(v_motivo) > 500 then
    raise exception 'INVALID_INPUT';
  end if;
  if v_notas is not null and char_length(v_notas) > 2000 then
    raise exception 'INVALID_INPUT';
  end if;

  select p.id, p.status into v_post_id, v_status
  from public.posts p
  where p.public_id = p_public_id;

  if v_post_id is null or v_status <> 'activo' then
    raise exception 'TARGET_NOT_FOUND';
  end if;

  -- Idempotente: si ya estaba bloqueado se conserva la marca original (no hay desbloqueo
  -- en el vocabulario del MVP) pero igual se audita la intención con su motivo.
  update public.posts
     set locked_at = coalesce(locked_at, now())
   where id = v_post_id;

  insert into public.mod_actions (
    actor_id, action, post_id, target_kind, target_public_id, motivo_publico, notas_internas
  )
  values (v_actor, 'bloquear_hilo', v_post_id, 'post', p_public_id, v_motivo, v_notas);
end;
$$;

revoke execute on function public.mod_lock_thread(text, text, text) from public, anon;
grant execute on function public.mod_lock_thread(text, text, text) to authenticated;

comment on function public.mod_lock_thread(text, text, text) is
  'Cierra un hilo: setea posts.locked_at (create_comment rechaza con THREAD_LOCKED) y '
  'escribe `bloquear_hilo`. El contenido queda visible; es una herramienta de hilo, no una '
  'sanción a la cuenta, así que no emite notificación al autor.';


-- -------------------------------------------------------------------------------------
-- mod_reveal_author — el "Ver autor" auditado (§11.4.2, §0.5-R5)
-- -------------------------------------------------------------------------------------
create or replace function public.mod_reveal_author(
  p_target_kind      text,
  p_target_public_id text,
  p_motivo           text,
  p_notas            text default null
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor        uuid := auth.uid();
  v_role         text;
  v_actor_status text;
  v_motivo       text := btrim(coalesce(p_motivo, ''));
  v_notas        text := nullif(btrim(coalesce(p_notas, '')), '');
  v_post_id      bigint;
  v_comment_id   bigint;
  v_resource_id  bigint;
  v_author_id    uuid;
  v_handle       text;
begin
  if v_actor is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select pr.role, pr.status into v_role, v_actor_status
  from public.profiles pr where pr.id = v_actor;
  if v_role is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if v_role not in ('mod', 'admin') or v_actor_status <> 'activo' then
    raise exception 'NOT_ALLOWED';
  end if;

  -- El motivo es obligatorio justamente porque esta fila ES la auditoría del poder.
  if char_length(v_motivo) < 3 or char_length(v_motivo) > 500 then
    raise exception 'INVALID_INPUT';
  end if;
  if v_notas is not null and char_length(v_notas) > 2000 then
    raise exception 'INVALID_INPUT';
  end if;
  if p_target_public_id is null or btrim(p_target_public_id) = '' then
    raise exception 'INVALID_INPUT';
  end if;

  -- Un perfil no tiene autoría oculta que revelar.
  case p_target_kind
    when 'post' then
      select p.id, p.author_id into v_post_id, v_author_id
      from public.posts p where p.public_id = p_target_public_id;
    when 'comment' then
      select c.id, c.author_id into v_comment_id, v_author_id
      from public.comments c where c.public_id = p_target_public_id;
    when 'resource' then
      select r.id, r.author_id into v_resource_id, v_author_id
      from public.resources r where r.public_id = p_target_public_id;
    else
      raise exception 'INVALID_INPUT';
  end case;

  if v_author_id is null then
    raise exception 'TARGET_NOT_FOUND';
  end if;

  select pr.handle::text into v_handle
  from public.profiles pr
  where pr.id = v_author_id;

  -- La fila es el log de auditoría: no hay tabla de revelaciones (§0.5-R5). Se escribe
  -- antes de devolver el handle, así una revelación nunca queda sin registro.
  insert into public.mod_actions (
    actor_id, action, post_id, comment_id, resource_id,
    target_kind, target_public_id, motivo_publico, notas_internas
  )
  values (
    v_actor, 'revelar_autor', v_post_id, v_comment_id, v_resource_id,
    p_target_kind, p_target_public_id, v_motivo, v_notas
  );

  -- No se notifica al autor: la revelación es interna y su control es la revisión mensual
  -- del log (§11.4.2), no un aviso que confirmaría al autor anónimo que fue mirado.
  return v_handle;
end;
$$;

revoke execute on function public.mod_reveal_author(text, text, text, text) from public, anon;
grant execute on function public.mod_reveal_author(text, text, text, text) to authenticated;

comment on function public.mod_reveal_author(text, text, text, text) is
  'Lectura auditada de la autoría de un contenido (el "Ver autor" del panel, §11.4.2): '
  'devuelve el handle del autor y escribe la fila `revelar_autor`, que ES la auditoría — no '
  'hay tabla de revelaciones (§0.5-R5). Motivo obligatorio; no admite target `profile`.';


-- -------------------------------------------------------------------------------------
-- mod_resolve_report — cierre de un item de la cola + aviso al denunciante
-- -------------------------------------------------------------------------------------
create or replace function public.mod_resolve_report(
  p_report_id  bigint,
  p_resolution text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor        uuid := auth.uid();
  v_role         text;
  v_actor_status text;
  v_reporter     uuid;
  v_status       text;
  v_post_id      bigint;
  v_comment_id   bigint;
  v_resource_id  bigint;
  v_profile_id   uuid;
  v_kind         text;
  v_target_pid   text;
  v_motivo       text;
  v_action       text;
  v_action_id    bigint;
begin
  if v_actor is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select pr.role, pr.status into v_role, v_actor_status
  from public.profiles pr where pr.id = v_actor;
  if v_role is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if v_role not in ('mod', 'admin') or v_actor_status <> 'activo' then
    raise exception 'NOT_ALLOWED';
  end if;

  if p_resolution is null or p_resolution not in ('resuelto', 'desestimado', 'resuelto_duplicado') then
    raise exception 'INVALID_INPUT';
  end if;

  select r.reporter_id, r.status, r.post_id, r.comment_id, r.resource_id, r.profile_id
    into v_reporter, v_status, v_post_id, v_comment_id, v_resource_id, v_profile_id
  from public.reports r
  where r.id = p_report_id;

  if v_reporter is null or v_status not in ('abierto', 'en_revision') then
    raise exception 'TARGET_NOT_FOUND';
  end if;

  -- Snapshot del target para la fila de auditoría.
  if v_post_id is not null then
    select 'post', p.public_id into v_kind, v_target_pid
    from public.posts p where p.id = v_post_id;
  elsif v_comment_id is not null then
    select 'comment', c.public_id into v_kind, v_target_pid
    from public.comments c where c.id = v_comment_id;
  elsif v_resource_id is not null then
    select 'resource', r.public_id into v_kind, v_target_pid
    from public.resources r where r.id = v_resource_id;
  elsif v_profile_id is not null then
    select 'profile', pr.handle::text into v_kind, v_target_pid
    from public.profiles pr where pr.id = v_profile_id;
  end if;

  if v_target_pid is null then
    raise exception 'TARGET_NOT_FOUND';
  end if;

  update public.reports
     set status      = p_resolution,
         resolved_by = v_actor,
         resolved_at = now()
   where id = p_report_id;

  -- La firma de PART 8 no lleva motivo: el texto público es el copy normativo de §11.3.4,
  -- neutro y sin revelar la sanción (las sanciones son entre la plataforma y la cuenta).
  v_action := case when p_resolution = 'desestimado' then 'desestimar_reporte' else 'resolver_reporte' end;
  v_motivo := case p_resolution
                when 'resuelto' then
                  'Revisamos el contenido reportado y tomamos una acción según las Reglas de la comunidad.'
                when 'desestimado' then
                  'Revisamos el contenido reportado y no encontramos un incumplimiento de las Reglas.'
                else
                  'El contenido reportado ya había sido revisado. Cerramos el reporte como duplicado.'
              end;

  insert into public.mod_actions (
    actor_id, action, post_id, comment_id, resource_id, profile_id, report_id,
    target_kind, target_public_id, motivo_publico
  )
  values (
    v_actor, v_action, v_post_id, v_comment_id, v_resource_id, v_profile_id, p_report_id,
    v_kind, v_target_pid, v_motivo
  )
  returning id into v_action_id;

  -- Todo reporte termina en exactamente un aviso al denunciante (§11.3.4). Sin refs al
  -- contenido: el denunciante recibe el resultado, no un enlace de vuelta.
  if v_reporter <> v_actor then
    insert into public.notifications (user_id, type, mod_action_id, actor_display)
    values (v_reporter, 'reporte_resuelto', v_action_id, 'Moderación');
  end if;
end;
$$;

revoke execute on function public.mod_resolve_report(bigint, text) from public, anon;
grant execute on function public.mod_resolve_report(bigint, text) to authenticated;

comment on function public.mod_resolve_report(bigint, text) is
  'Cierra un reporte abierto o en revisión (resuelto / desestimado / resuelto_duplicado), '
  'sella resolved_by y resolved_at, escribe `resolver_reporte` o `desestimar_reporte` con '
  'report_id y el target snapshotteado, y emite la notificación reporte_resuelto al '
  'denunciante con el copy neutro de §11.3.4.';


-- -------------------------------------------------------------------------------------
-- mod_review_appeal — revisión de apelación por alguien distinto del actor original
-- -------------------------------------------------------------------------------------
create or replace function public.mod_review_appeal(
  p_appeal_id  bigint,
  p_resolucion text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor         uuid := auth.uid();
  v_role          text;
  v_actor_status  text;
  v_appeal_status text;
  v_orig_action   bigint;
  v_orig_actor    uuid;
  v_post_id       bigint;
  v_comment_id    bigint;
  v_resource_id   bigint;
  v_profile_id    uuid;
  v_kind          text;
  v_target_pid    text;
  v_appellant     uuid;
  v_motivo        text;
  v_action        text;
  v_action_id     bigint;
begin
  if v_actor is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select pr.role, pr.status into v_role, v_actor_status
  from public.profiles pr where pr.id = v_actor;
  if v_role is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if v_role not in ('mod', 'admin') or v_actor_status <> 'activo' then
    raise exception 'NOT_ALLOWED';
  end if;

  if p_resolucion is null or p_resolucion not in ('aceptada', 'rechazada') then
    raise exception 'INVALID_INPUT';
  end if;

  select ap.status, ap.mod_action_id, a.actor_id,
         a.post_id, a.comment_id, a.resource_id, a.profile_id,
         a.target_kind, a.target_public_id
    into v_appeal_status, v_orig_action, v_orig_actor,
         v_post_id, v_comment_id, v_resource_id, v_profile_id,
         v_kind, v_target_pid
  from public.appeals ap
  join public.mod_actions a on a.id = ap.mod_action_id
  where ap.id = p_appeal_id;

  if v_appeal_status is null or v_appeal_status <> 'pendiente' then
    raise exception 'TARGET_NOT_FOUND';
  end if;

  -- La revisa alguien distinto de quien decidió (PART 11 §11.5.2). Es la regla que hace
  -- que la apelación sea algo más que un segundo "no" de la misma persona.
  if v_orig_actor = v_actor then
    raise exception 'NOT_ALLOWED';
  end if;

  update public.appeals
     set status      = p_resolucion,
         reviewed_by = v_actor
   where id = p_appeal_id;

  -- Destinatario de la acción original = apelante (puede ser null si el contenido ya se
  -- purgó: en ese caso queda la auditoría sin notificación).
  if v_profile_id is not null then
    v_appellant := v_profile_id;
  elsif v_post_id is not null then
    select p.author_id into v_appellant from public.posts p where p.id = v_post_id;
  elsif v_comment_id is not null then
    select c.author_id into v_appellant from public.comments c where c.id = v_comment_id;
  elsif v_resource_id is not null then
    select r.author_id into v_appellant from public.resources r where r.id = v_resource_id;
  end if;

  -- Vocabulario cerrado: `restaurar` es el verbo de reversión que PART 11 §11.5.1 asocia
  -- explícitamente a "appeal upheld"; `desestimar_reporte` es el de cierre sin acción. La
  -- reversión material (restaurar el contenido, revocar la restricción) es una llamada
  -- explícita aparte — esta función registra la decisión, no la ejecuta.
  v_action := case when p_resolucion = 'aceptada' then 'restaurar' else 'desestimar_reporte' end;
  v_motivo := case when p_resolucion = 'aceptada'
                   then 'Revisamos tu apelación y dimos marcha atrás con la decisión.'
                   else 'Revisamos tu apelación y la decisión se mantiene. Esta apelación es definitiva.'
              end;

  -- El FK del target se copia de la acción original; si el contenido fue purgado el FK ya
  -- es null y sólo sobreviven target_kind/target_public_id, que es justamente para lo que
  -- están (§8.3.6). report_id queda null: los cierres de reporte se cuentan aparte.
  insert into public.mod_actions (
    actor_id, action, post_id, comment_id, resource_id, profile_id,
    target_kind, target_public_id, motivo_publico, notas_internas
  )
  values (
    v_actor, v_action, v_post_id, v_comment_id, v_resource_id, v_profile_id,
    v_kind, v_target_pid, v_motivo,
    'Apelación #' || p_appeal_id::text || ' sobre la acción #' || v_orig_action::text || '.'
  )
  returning id into v_action_id;

  if v_appellant is not null and v_appellant <> v_actor then
    insert into public.notifications (user_id, type, mod_action_id, actor_display)
    values (v_appellant, 'decision_mod', v_action_id, 'Moderación');
  end if;
end;
$$;

revoke execute on function public.mod_review_appeal(bigint, text) from public, anon;
grant execute on function public.mod_review_appeal(bigint, text) to authenticated;

comment on function public.mod_review_appeal(bigint, text) is
  'Resuelve una apelación pendiente (aceptada / rechazada). El revisor DEBE ser distinto '
  'del actor de la acción original (NOT_ALLOWED si no, §11.5.2). Escribe una fila de '
  'auditoría sobre el mismo target — `restaurar` si se acepta, `desestimar_reporte` si se '
  'mantiene, con la referencia a la apelación en notas_internas — y notifica al apelante. '
  'La reversión material se hace con la RPC que corresponda (mod_restore_* / '
  'mod_revoke_restriction).';


-- =====================================================================================
-- Invitaciones (§8.3.7, D3) — admin/mod en MVP
-- =====================================================================================
create or replace function public.create_invite(
  p_max_uses   int default 10,
  p_expires_at timestamptz default null,
  p_note       text default null
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor        uuid := auth.uid();
  v_role         text;
  v_actor_status text;
  v_note         text := nullif(btrim(coalesce(p_note, '')), '');
  v_code         text;
begin
  if v_actor is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select pr.role, pr.status into v_role, v_actor_status
  from public.profiles pr where pr.id = v_actor;
  if v_role is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if v_role not in ('mod', 'admin') or v_actor_status <> 'activo' then
    raise exception 'NOT_ALLOWED';
  end if;

  if p_max_uses is null or p_max_uses < 1 or p_max_uses > 500 then
    raise exception 'INVALID_INPUT';
  end if;
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'INVALID_INPUT';
  end if;
  if v_note is not null and char_length(v_note) > 200 then
    raise exception 'INVALID_INPUT';
  end if;

  -- Un solo reintento ante colisión de nanoid (§8.2.1): el UNIQUE es el que decide.
  begin
    insert into public.invites (created_by, max_uses, expires_at, note)
    values (v_actor, p_max_uses, p_expires_at, v_note)
    returning code into v_code;
  exception when unique_violation then
    insert into public.invites (created_by, max_uses, expires_at, note)
    values (v_actor, p_max_uses, p_expires_at, v_note)
    returning code into v_code;
  end;

  return v_code;
end;
$$;

revoke execute on function public.create_invite(int, timestamptz, text) from public, anon;
grant execute on function public.create_invite(int, timestamptz, text) to authenticated;

comment on function public.create_invite(int, timestamptz, text) is
  'Crea un código de invitación (mod/admin en MVP; la emisión por usuarios de confianza es '
  'P2) y devuelve el code para armar el link. No escribe mod_actions: el vocabulario '
  'cerrado de `action` y el CHECK de `target_kind` (post/comment/resource/profile) no '
  'admiten una invitación como target — la auditoría de emisión es invites.created_by. '
  'El consumo del código es atómico en handle_new_user (§0.5-R18).';
