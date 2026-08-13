-- ============================================================================
-- 0014 — Dos RPC que el resto del set daba por existentes
--
-- Las migraciones 0001–0013 son forward-only y no se editan; esto es aditivo.
-- Una revisión adversarial del código de aplicación contra el esquema encontró
-- dos huecos donde la UI promete algo que la base no le deja hacer:
--
--   1. `update_notification_prefs` — `profiles` tiene UNA sola política
--      (`profiles_select_self`, migración 0004) y UN solo grant (`select`).
--      No hay UPDATE posible desde el rol `authenticated` y ninguna RPC de
--      0011/0012 toca `notif_respuestas`, así que el único interruptor de
--      /ajustes (§0.5-R14) devolvía error genérico SIEMPRE. La preferencia es
--      un booleano y su superficie de escritura tiene que ser una función, como
--      todo lo demás (tenet 6: "writes are functions, not table grants").
--
--   2. `is_own_content` — la página de la publicación decidía "sos el autor"
--      comparando `author_handle` contra el seudónimo de quien mira. Para
--      contenido ANÓNIMO `author_handle` es null por construcción (vistas
--      _public, migración 0010), de modo que el autor de una publicación
--      anónima no podía editarla NI BORRARLA — y encima se le ofrecía votarse a
--      sí mismo, que `toggle_post_vote` rechaza con SELF_VOTE. Que el autor no
--      pueda suprimir lo suyo choca de frente con el derecho de supresión que
--      C6 (Ley 25.326) trata como vinculante. Esta función devuelve SOLO un
--      booleano: es SECURITY DEFINER justamente para poder mirar `author_id`
--      sin exponerlo (D5, D14.5).
--
-- Mismas reglas uniformes que 0011/0012, verificadas por el meta-test pgTAP
-- sobre pg_proc: `security definer` + `set search_path = public, pg_temp`,
-- `revoke execute ... from public, anon` y luego `grant execute ... to
-- authenticated`, y errores con `raise exception '<CODE>'` usando únicamente
-- códigos de RPC_ERROR_CODES (lib/errors.ts).
--
-- Dependencias: 0004 (profiles.notif_respuestas), 0005 (posts, comments),
-- 0007 (resources).
-- ============================================================================


-- ============================================================================
-- 1. PREFERENCIAS — PART 8 §8.5.2, §0.5-R14
-- ============================================================================

create or replace function public.update_notification_prefs(p_notif_respuestas boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  -- No usa assert_can_write() a propósito, por el mismo motivo que
  -- `delete_account` (0011): una cuenta suspendida o baneada conserva el derecho
  -- a silenciar sus propios avisos. Silenciar no es escribir contenido — es
  -- dejar de recibir correo, y negárselo a quien está sancionado sería castigo
  -- sin regla que lo respalde (PART 11 §11.8). Tampoco se exige status
  -- 'activo': el único guard es que haya sesión.
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  -- La columna es NOT NULL: sin este chequeo un null del cliente llegaría como
  -- error crudo de Postgres a la pantalla, que es lo que lib/errors.ts existe
  -- para evitar.
  if p_notif_respuestas is null then
    raise exception 'INVALID_INPUT';
  end if;

  -- Solo la fila propia, y solo esa columna. `updated_at` lo mantiene el trigger
  -- `set_updated_at` de 0004; no se toca a mano.
  update public.profiles
     set notif_respuestas = p_notif_respuestas
   where id = v_uid;

  -- Sesión válida sin fila de perfil: un alta a medio terminar. Se responde lo
  -- mismo que sin sesión, que es lo que la pantalla sabe manejar.
  if not found then
    raise exception 'NOT_AUTHENTICATED';
  end if;
end;
$$;

comment on function public.update_notification_prefs(boolean) is
  'Escribe la única preferencia de notificaciones de v1 (profiles.notif_respuestas, §0.5-R14) sobre la fila propia. No exige status activo: una cuenta sancionada conserva el derecho a silenciar sus avisos (PART 11 §11.8). Es la ÚNICA vía de escritura: profiles no otorga UPDATE a ningún rol de la aplicación.';

revoke execute on function public.update_notification_prefs(boolean) from public, anon;
grant execute on function public.update_notification_prefs(boolean) to authenticated;


-- ============================================================================
-- 2. AUTORÍA PROPIA — PART 8 §8.5.3, D5/C6
-- ============================================================================

create or replace function public.is_own_content(
  p_kind      text,
  p_public_id text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_author uuid;
  v_id     text := btrim(coalesce(p_public_id, ''));
begin
  -- Sin sesión no hay autoría que reconocer, y responder antes de mirar nada
  -- evita que un visitante anónimo use esta función como sonda.
  if v_uid is null then
    return false;
  end if;

  if p_kind is null or p_kind not in ('post', 'comment', 'resource') then
    raise exception 'INVALID_INPUT';
  end if;

  if v_id = '' then
    return false;
  end if;

  -- Se busca por public_id SIN filtrar por status: la pregunta es "¿esto es
  -- tuyo?", no "¿esto está vivo?". Quien llama ya resolvió la visibilidad por
  -- las vistas _public antes de llegar acá.
  if p_kind = 'post' then
    select p.author_id into v_author
      from public.posts p
     where p.public_id = v_id;
  elsif p_kind = 'comment' then
    select c.author_id into v_author
      from public.comments c
     where c.public_id = v_id;
  else
    select r.author_id into v_author
      from public.resources r
     where r.public_id = v_id;
  end if;

  -- Un id inexistente deja v_author en null y sale false, igual que un id ajeno:
  -- la función no distingue "no existe" de "no es tuyo", así que tampoco sirve
  -- para enumerar contenido.
  --
  -- Lo que se devuelve es un booleano y NADA más. Si devolviera el author_id,
  -- cualquier persona con sesión podría preguntar por un public_id ajeno y
  -- obtener el autor de una publicación anónima: exactamente la unión autor ↔
  -- contenido que las vistas _public existen para impedir (D5, D14.5). El único
  -- camino autorizado para develar un autor sigue siendo `mod_reveal_author`
  -- (0012), que exige rol de moderación y deja registro en mod_actions.
  return v_author is not null and v_author = v_uid;
end;
$$;

comment on function public.is_own_content(text, text) is
  'Responde si el contenido identificado por (p_kind, p_public_id) lo escribió quien llama. p_kind es post | comment | resource. Devuelve solo un booleano — nunca el autor — y false sin sesión o si no existe. Es SECURITY DEFINER porque las tablas base no otorgan SELECT: es la única forma de que el autor de contenido ANÓNIMO pueda editar y borrar lo suyo (C6, Ley 25.326) sin que author_handle salga de la base (D5, D14.5).';

revoke execute on function public.is_own_content(text, text) from public, anon;
grant execute on function public.is_own_content(text, text) to authenticated;
