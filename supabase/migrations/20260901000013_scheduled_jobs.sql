-- =============================================================================
-- 0012 (archivo …000013) — Trabajos programados (PART 8 §8.5.6 y §8.7)
--
-- Tres funciones que NO son RPC de usuario: las invoca únicamente el endpoint
-- diario `/api/cron/aggregates` con la service-role key (§0.5-R16). No hay
-- pg_cron: su disponibilidad en el tier gratuito es de confianza media, así que
-- nada depende de él (§8.2.4). Si algún día se adopta, estas mismas funciones
-- reciben un wrapper `cron.schedule` y nada más cambia.
--
--   1. cron_heartbeat()      — keepalive: marca actividad diaria (§21.5).
--   2. reconcile_counters()  — recuento nocturno de contadores y karma (§8.2.5).
--   3. purge_retention()     — matriz de retención de §8.7.
--
-- Las tres son SECURITY DEFINER con `search_path` fijado, con EXECUTE revocado a
-- `public`, `anon` y `authenticated`, y otorgado SOLO a `service_role`: ningún
-- usuario de la aplicación puede dispararlas. Devuelven jsonb con los conteos de
-- cada paso para que el endpoint los registre (y para que un run raro sea
-- visible en los logs en vez de silencioso).
--
-- `statement_timeout` se sube a 120 s dentro de las dos funciones pesadas porque
-- los roles de API de Supabase traen timeouts cortos y un recuento nocturno
-- completo no debe morir por eso.
-- =============================================================================


-- =============================================================================
-- 1. cron_heartbeat() — keepalive (§21.5)
-- =============================================================================
create or replace function public.cron_heartbeat()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count bigint;
begin
  -- Un contador por día en `events`. El proyecto Supabase Free se pausa tras ~1
  -- semana de inactividad (§21.5): la escritura diaria más el SELECT real que
  -- hace el endpoint son la evidencia de actividad. Corre a diario, así que hay
  -- 6 días de margen antes de que una falla se vuelva una pausa.
  insert into public.events as e (name, day, dim, count)
  values ('cron_heartbeat', current_date, '', 1)
  on conflict (name, day, dim) do update
    set count = e.count + 1
  returning e.count into v_count;

  return jsonb_build_object(
    'event', 'cron_heartbeat',
    'day', current_date,
    'count', v_count
  );
end;
$$;

comment on function public.cron_heartbeat() is
  'Keepalive del cron diario (§21.5): inserta o incrementa la fila '
  '(''cron_heartbeat'', hoy, '''') de `events`. Evita que el proyecto Free se pause tras '
  'una semana de inactividad — el riesgo real es la ventana muerta de enero-febrero. '
  'El nombre `cron_heartbeat` es un contador OPERATIVO: queda fuera del catálogo cerrado '
  'de 14 eventos de producto de PART 24 §24.3 y nunca lo escribe `track_event`, que valida '
  'su allowlist. `events` no se purga jamás (§0.5-R11): una fila por día son kilobytes por '
  'año. Solo la llama el endpoint de cron con la service-role key.';


-- =============================================================================
-- 2. reconcile_counters() — recuento nocturno (§8.2.5, §8.5.6, §0.5-R7)
-- =============================================================================
create or replace function public.reconcile_counters()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
set statement_timeout to '120s'
as $$
declare
  v_posts     int := 0;
  v_comments  int := 0;
  v_resources int := 0;
  v_karma     int := 0;
  v_status    int := 0;
begin
  -- ---------------------------------------------------------------------------
  -- 2.1 posts: score (votos) y comments_count (comentarios activos)
  -- Los contadores los mantienen las RPC dentro de la misma transacción que causa
  -- el cambio (tenet 7); esto es la red de contención: SQL directo, un purgado que
  -- se lleva filas fuente o un bug dejan una deriva con vida media ≤ 24 h.
  -- `comments_count` cuenta SOLO comentarios `activo`, que es lo que las RPC
  -- incrementan y decrementan (los tombstones se ven en el hilo pero no suman).
  -- ---------------------------------------------------------------------------
  with fresh as (
    select p.id,
           coalesce(v.n, 0) as score,
           coalesce(c.n, 0) as comments_count
    from public.posts p
    left join (
      select pv.post_id, count(*)::int as n
      from public.post_votes pv
      group by pv.post_id
    ) v on v.post_id = p.id
    left join (
      select cm.post_id, count(*)::int as n
      from public.comments cm
      where cm.status = 'activo'
      group by cm.post_id
    ) c on c.post_id = p.id
  )
  update public.posts p
     set score = f.score,
         comments_count = f.comments_count
    from fresh f
   where f.id = p.id
     and (p.score is distinct from f.score
          or p.comments_count is distinct from f.comments_count);
  get diagnostics v_posts = row_count;

  -- ---------------------------------------------------------------------------
  -- 2.2 comments: score
  -- ---------------------------------------------------------------------------
  with fresh as (
    select c.id, coalesce(v.n, 0) as score
    from public.comments c
    left join (
      select cv.comment_id, count(*)::int as n
      from public.comment_votes cv
      group by cv.comment_id
    ) v on v.comment_id = c.id
  )
  update public.comments c
     set score = f.score
    from fresh f
   where f.id = c.id
     and c.score is distinct from f.score;
  get diagnostics v_comments = row_count;

  -- ---------------------------------------------------------------------------
  -- 2.3 resources: score (recalculable) y downloads_count (solo hacia arriba)
  -- `downloads_count` NO se puede recalcular desde cero: su tabla fuente
  -- (`download_log`) es efímera de 7 días por diseño de privacidad (§0.5-R9), así
  -- que un recuento total pondría en cero el histórico de descargas. Se reconcilia
  -- de forma MONÓTONA: el contador nunca baja, y se levanta al piso que demuestra
  -- la ventana viva (pares distintos usuario × día, que es exactamente lo que
  -- `register_download` incrementa). El límite de día usa la zona de la sesión;
  -- como es un piso y no una autoridad, el corte exacto es indiferente.
  -- ---------------------------------------------------------------------------
  with fresh as (
    select r.id,
           coalesce(v.n, 0) as score,
           greatest(r.downloads_count, coalesce(d.n, 0)) as downloads_count
    from public.resources r
    left join (
      select rv.resource_id, count(*)::int as n
      from public.resource_votes rv
      group by rv.resource_id
    ) v on v.resource_id = r.id
    left join (
      select dd.resource_id, count(*)::int as n
      from (
        select distinct dl.resource_id, dl.user_id, dl.created_at::date as dia
        from public.download_log dl
      ) dd
      group by dd.resource_id
    ) d on d.resource_id = r.id
  )
  update public.resources r
     set score = f.score,
         downloads_count = f.downloads_count
    from fresh f
   where f.id = r.id
     and (r.score is distinct from f.score
          or r.downloads_count is distinct from f.downloads_count);
  get diagnostics v_resources = row_count;

  -- ---------------------------------------------------------------------------
  -- 2.4 karma de TODOS los perfiles (§0.5-R7, C5)
  -- Karma = upvotes recibidos en posts + comentarios + recursos del autor,
  -- INCLUYENDO el contenido anónimo. Precisamente por eso es un batch nocturno
  -- uniforme y no un incremento en el momento del voto: si el karma se moviera al
  -- instante en que una publicación anónima recibe un voto, el timing correlaciona
  -- autor con contenido. Se recalcula para todos los perfiles todas las noches,
  -- tengan o no votos nuevos, para que el recálculo mismo no diga nada.
  -- Solo suma contenido `activo`: lo removido por moderación no acredita karma, y
  -- lo eliminado por el autor deja de sumar ahora en vez de desaparecer de golpe
  -- cuando la purga de 365 días borre las filas (§8.7).
  -- Las cáscaras de cuentas eliminadas quedan en 0 (§8.7), y este recálculo no
  -- puede resucitarles el karma aunque conserven contenido activo.
  -- ---------------------------------------------------------------------------
  with recibidos as (
    select p.author_id as profile_id, count(*)::int as n
    from public.post_votes v
    join public.posts p on p.id = v.post_id
    where p.status = 'activo'
    group by p.author_id
    union all
    select c.author_id, count(*)::int
    from public.comment_votes v
    join public.comments c on c.id = v.comment_id
    where c.status = 'activo'
    group by c.author_id
    union all
    select r.author_id, count(*)::int
    from public.resource_votes v
    join public.resources r on r.id = v.resource_id
    where r.status = 'activo'
    group by r.author_id
  ),
  totales as (
    select profile_id, sum(n)::int as karma
    from recibidos
    group by profile_id
  ),
  fresh as (
    select pr.id,
           case when pr.status = 'eliminado' then 0 else coalesce(t.karma, 0) end as karma
    from public.profiles pr
    left join totales t on t.profile_id = pr.id
  )
  update public.profiles pr
     set karma = f.karma
    from fresh f
   where f.id = pr.id
     and pr.karma is distinct from f.karma;
  get diagnostics v_karma = row_count;

  -- ---------------------------------------------------------------------------
  -- 2.5 re-derivación de profiles.status para suspensiones vencidas (§8.3.6)
  -- `profiles.status` espeja la peor restricción vigente para que los chequeos de
  -- las RPC sean baratos. Las RPC de moderación actualizan el espejo al aplicar y
  -- al revocar, pero una suspensión con `until` en el pasado vence sola: nadie
  -- ejecuta nada en ese instante. Esta re-derivación es quien la levanta.
  -- Restricción vigente = revoked_at is null and (until is null or until > now()).
  -- Nunca se toca `eliminado`: una cáscara no vuelve a la vida.
  -- El caso borde que se cuida: si moderación restringió una cuenta que todavía no
  -- terminó el onboarding, al vencer NO puede quedar `activo` (saltearía
  -- `complete_onboarding` con handle placeholder). El prefijo reservado
  -- `estudiante_` (§8.3.2) es el marcador estructural de ese estado, y el guion
  -- bajo va escapado porque en LIKE es comodín.
  -- ---------------------------------------------------------------------------
  with vigentes as (
    select ur.user_id,
           bool_or(ur.tipo = 'ban') as tiene_ban,
           bool_or(ur.tipo = 'suspension') as tiene_suspension
    from public.user_restrictions ur
    where ur.revoked_at is null
      and (ur.until is null or ur.until > now())
    group by ur.user_id
  ),
  fresh as (
    select pr.id,
           case
             when coalesce(r.tiene_ban, false) then 'baneado'
             when coalesce(r.tiene_suspension, false) then 'suspendido'
             when pr.handle::text like 'estudiante\_%' then 'nuevo'
             else 'activo'
           end as status
    from public.profiles pr
    left join vigentes r on r.user_id = pr.id
    where pr.status <> 'eliminado'
  )
  update public.profiles pr
     set status = f.status
    from fresh f
   where f.id = pr.id
     and pr.status is distinct from f.status;
  get diagnostics v_status = row_count;

  return jsonb_build_object(
    'posts_fixed', v_posts,
    'comments_fixed', v_comments,
    'resources_fixed', v_resources,
    'karma_updated', v_karma,
    'status_rederived', v_status,
    'ran_at', now()
  );
end;
$$;

comment on function public.reconcile_counters() is
  'Recuento nocturno de PART 8 §8.5.6, invocado por `/api/cron/aggregates`. Recalcula '
  '`posts.score` y `posts.comments_count`, `comments.score`, `resources.score` y — solo '
  'hacia arriba, porque `download_log` vive 7 días — `resources.downloads_count`; '
  'recalcula el karma de TODOS los perfiles (recompute uniforme nocturno, §0.5-R7: el '
  'karma del contenido anónimo entra en el total sin quedar itemizado ni correlacionable '
  'en el tiempo, C5); y re-deriva `profiles.status` cuando una suspensión vence. Devuelve '
  'jsonb con cuántas filas corrigió cada paso: si esos números no son ~0 en régimen, hay '
  'una RPC que no mantiene su contador. Solo la llama el endpoint de cron con la '
  'service-role key.';


-- =============================================================================
-- 3. purge_retention() — matriz de retención (§8.7)
-- =============================================================================
create or replace function public.purge_retention()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
set statement_timeout to '120s'
as $$
declare
  v_download_log    int := 0;
  v_search_queries  int := 0;
  v_notif_read      int := 0;
  v_notif_unread    int := 0;
  v_drafts          int := 0;
  v_abandoned       int := 0;
  v_comments        int := 0;
  v_posts           int := 0;
  v_paso            int := 0;
  v_perfil          record;
  v_ok              boolean;
begin
  -- ---------------------------------------------------------------------------
  -- 3.1 download_log > 7 días (§0.5-R9)
  -- No existe historial durable de descargas: la ventana móvil de 7 días ES toda
  -- la tabla, y así está declarado en /privacidad. Solo sirve para rate-limit y
  -- para deduplicar el incremento de `downloads_count` por usuario y por día.
  -- ---------------------------------------------------------------------------
  delete from public.download_log
   where created_at < now() - interval '7 days';
  get diagnostics v_download_log = row_count;

  -- ---------------------------------------------------------------------------
  -- 3.2 search_queries > 12 meses (§0.5-R10)
  -- Telemetría de búsqueda sin vínculo con usuarios; a los 12 meses ya no informa
  -- decisiones de contenido semilla y deja de existir.
  -- ---------------------------------------------------------------------------
  delete from public.search_queries sq
   where sq.day < (current_date - interval '12 months')::date;
  get diagnostics v_search_queries = row_count;

  -- ---------------------------------------------------------------------------
  -- 3.3 notificaciones: leídas > 90 días, no leídas > 180 días (§0.5-R14)
  -- La no leída dura el doble porque nadie debería perder un aviso de moderación
  -- por no haber entrado en tres meses. La ventana de las leídas se mide desde
  -- `read_at` (cuándo se leyó), no desde `created_at`: lo que se está reteniendo es
  -- el aviso ya consumido.
  -- ---------------------------------------------------------------------------
  delete from public.notifications
   where read_at is not null
     and read_at < now() - interval '90 days';
  get diagnostics v_notif_read = row_count;

  delete from public.notifications
   where read_at is null
     and created_at < now() - interval '180 days';
  get diagnostics v_notif_unread = row_count;

  -- ---------------------------------------------------------------------------
  -- 3.4 borradores de recursos > 24 h (§0.5-R12)
  -- `request_upload` crea la fila en `borrador`; `finalize_upload` la pasa a
  -- `activo`. Lo que no se finalizó en 24 h es basura de un upload abandonado y se
  -- borra físicamente (arrastra sus `resource_files` por cascada). Los objetos que
  -- hayan quedado en el prefijo de cuarentena `incoming/{upload_nanoid}` de R2 los
  -- destruye el endpoint: esa clave no está en la base hasta el finalize, así que
  -- SQL no puede conocerla.
  -- ---------------------------------------------------------------------------
  delete from public.resources
   where status = 'borrador'
     and created_at < now() - interval '24 hours';
  get diagnostics v_drafts = row_count;

  -- ---------------------------------------------------------------------------
  -- 3.5 registros abandonados: status 'nuevo' con más de 30 días (§8.5.6)
  -- Una cuenta que confirmó el mail pero nunca eligió seudónimo no puede publicar
  -- (todas las RPC de contenido exigen `activo`), así que a los 30 días es solo un
  -- mail retenido sin propósito. Se aplica la MISMA anonimización que
  -- `delete_account` (§8.7): la fila de `profiles` nunca se borra físicamente
  -- (las cáscaras sostienen los FK RESTRICT del esquema), pero queda `eliminado` y
  -- con handle de cáscara — lo que además la entrega al mismo barrido que borra la
  -- fila de `auth.users` desde el endpoint (SQL no toca el esquema `auth`).
  -- Se van también sus follows: son preferencias, no contenido (§8.7).
  -- El handle de cáscara se sortea; ante colisión con el UNIQUE se reintenta, y si
  -- ni así entra se avisa y se sigue: una cuenta trabada no debe abortar la purga.
  -- ---------------------------------------------------------------------------
  for v_perfil in
    select p.id
    from public.profiles p
    where p.status = 'nuevo'
      and p.created_at < now() - interval '30 days'
    order by p.created_at
  loop
    v_ok := false;
    for v_intento in 1..5 loop
      begin
        update public.profiles
           set handle = ('usuario_eliminado_' || public.nanoid(4))::extensions.citext,
               status = 'eliminado',
               carrera_id = null,
               ingreso_year = null,
               karma = 0,
               invited_with = null
         where id = v_perfil.id;
        v_ok := true;
        exit;
      exception when unique_violation then
        v_ok := false;
      end;
    end loop;

    if v_ok then
      delete from public.materia_follows where user_id = v_perfil.id;
      delete from public.notifications where user_id = v_perfil.id;
      v_abandoned := v_abandoned + 1;
    else
      raise warning 'purge_retention: no se pudo anonimizar el perfil abandonado %',
        v_perfil.id;
    end if;
  end loop;

  -- ---------------------------------------------------------------------------
  -- 3.6 borrado físico de contenido eliminado con más de 365 días (§8.7)
  -- Solo acá hay DELETE de contenido: el borrado del usuario y el de moderación
  -- son transiciones de estado (tenet 4). Se mide sobre `created_at` porque el
  -- esquema no guarda un `deleted_at` — la publicación ya lleva como mínimo un año
  -- creada y además invisible.
  --
  -- Orden obligatorio: `comments.parent_id` es ON DELETE RESTRICT, así que un
  -- comentario padre no se borra mientras exista CUALQUIER hijo, ni siquiera si el
  -- hijo se fuera a borrar en la misma cascada. Por eso se barre profundidad 2
  -- antes que profundidad 1, y los comentarios de un post condenado se borran a
  -- mano antes que el post (la cascada del post no respetaría ese orden).
  -- Nota sobre §8.7: la matriz dice "sin hijos activos"; acá la condición es más
  -- estricta —sin hijos de ningún tipo— porque un tombstone hijo bloquea el DELETE
  -- igual. El padre simplemente espera al año siguiente, cuando el hijo también
  -- califique. Los comentarios de profundidad 2 son hojas por construcción (el
  -- CHECK `comments_depth_parent` más el rechazo DEPTH_EXCEEDED de
  -- `create_comment`), así que borrarlos primero siempre desbloquea a su padre.
  -- ---------------------------------------------------------------------------

  -- 3.6.a Respuestas (profundidad 2) eliminadas hace más de 365 días.
  delete from public.comments c
   where c.status in ('eliminado_autor','eliminado_mod')
     and c.depth = 2
     and c.created_at < now() - interval '365 days';
  get diagnostics v_paso = row_count;
  v_comments := v_comments + v_paso;

  -- 3.6.b Comentarios raíz eliminados hace más de 365 días que ya no tienen hijos.
  delete from public.comments c
   where c.status in ('eliminado_autor','eliminado_mod')
     and c.depth = 1
     and c.created_at < now() - interval '365 days'
     and not exists (
       select 1 from public.comments h where h.parent_id = c.id
     );
  get diagnostics v_paso = row_count;
  v_comments := v_comments + v_paso;

  -- 3.6.c Hilos de publicaciones condenadas: primero las respuestas…
  delete from public.comments c
   using public.posts p
   where p.id = c.post_id
     and p.status in ('eliminado_autor','eliminado_mod')
     and p.created_at < now() - interval '365 days'
     and c.depth = 2;
  get diagnostics v_paso = row_count;
  v_comments := v_comments + v_paso;

  -- 3.6.d …después los comentarios raíz, ya sin hijos.
  delete from public.comments c
   using public.posts p
   where p.id = c.post_id
     and p.status in ('eliminado_autor','eliminado_mod')
     and p.created_at < now() - interval '365 days'
     and c.depth = 1;
  get diagnostics v_paso = row_count;
  v_comments := v_comments + v_paso;

  -- 3.6.e Y recién ahí la publicación: arrastra votos, alias anónimos,
  -- notificaciones y reportes por cascada; `mod_actions` sobrevive con sus FK en
  -- null porque el registro de auditoría guarda `target_public_id` y `target_kind`
  -- como texto (§8.3.6).
  delete from public.posts p
   where p.status in ('eliminado_autor','eliminado_mod')
     and p.created_at < now() - interval '365 days';
  get diagnostics v_posts = row_count;

  -- ---------------------------------------------------------------------------
  -- Fuera de alcance a propósito:
  --  * `events` NO se purga nunca (§0.5-R11): es agregado puro, kilobytes por año,
  --    y es la materia prima de las estadísticas del archivo.
  --  * Destrucción de archivos en R2 a los 30 días de la baja (e inmediata para
  --    `retirado_legal`) — es una llamada S3, la hace el endpoint sobre
  --    `resource_files`; SQL no borra objetos.
  --  * Purga de reportes resueltos a los 2 años (§8.7): pendiente de
  --    [LEGAL REVIEW]. No se borra evidencia de abuso hasta que haya criterio
  --    legal; agregarlo después es un paso más en esta misma función.
  -- ---------------------------------------------------------------------------

  return jsonb_build_object(
    'download_log', v_download_log,
    'search_queries', v_search_queries,
    'notifications_read', v_notif_read,
    'notifications_unread', v_notif_unread,
    'resource_drafts', v_drafts,
    'abandoned_signups', v_abandoned,
    'comments_purged', v_comments,
    'posts_purged', v_posts,
    'ran_at', now()
  );
end;
$$;

comment on function public.purge_retention() is
  'Purga diaria de la matriz de retención de PART 8 §8.7, invocada por '
  '`/api/cron/aggregates`. Pasos: `download_log` > 7 días (§0.5-R9); `search_queries` > 12 '
  'meses (§0.5-R10); notificaciones leídas > 90 días y no leídas > 180 días (§0.5-R14); '
  'borradores de recursos > 24 h (§0.5-R12); registros `nuevo` abandonados > 30 días '
  '(anonimizados como cáscara, igual que `delete_account`); y borrado FÍSICO de posts y '
  'comentarios `eliminado_*` con más de 365 días, en orden hijos→padres porque '
  '`comments.parent_id` es RESTRICT. Devuelve jsonb con el conteo de cada paso para que el '
  'endpoint lo registre. `events` nunca se purga; la destrucción de archivos en R2 y el '
  'borrado de `auth.users` viven en el endpoint, no acá. Solo la llama el endpoint de cron '
  'con la service-role key.';


-- =============================================================================
-- Permisos: nadie de la aplicación ejecuta estos trabajos
-- Ningún rol alcanzable desde una request puede correr un recuento total ni un
-- DELETE masivo. La service-role key vive solo en `app/api/cron/*` (D5, D14.3).
-- =============================================================================
revoke execute on function public.cron_heartbeat()     from public, anon, authenticated;
revoke execute on function public.reconcile_counters() from public, anon, authenticated;
revoke execute on function public.purge_retention()    from public, anon, authenticated;

grant execute on function public.cron_heartbeat()     to service_role;
grant execute on function public.reconcile_counters() to service_role;
grant execute on function public.purge_retention()    to service_role;


-- ----------------------------------------------------------------------------
-- compute_activity_rollups — WAU, MAU y cohortes de retorno (PART 24 §24.4)
--
-- DAU lo cuenta touch_last_seen() en el momento (un incremento por persona por día).
-- WAU y MAU no se pueden contar así: son ventanas móviles, y contarlas exigiría o un
-- log por usuario (que la postura de privacidad prohíbe) o un recuento nocturno.
-- Elegimos el recuento nocturno sobre profiles.last_seen_day, la única columna de
-- actividad que existe, y escribimos el resultado como una foto agregada en events.
--
-- Las cohortes de retorno son el instrumento del portón de D11 ("40% de la beta vuelve
-- en la semana 2"). Se calculan solo los lunes, con la resolución semanal que ese
-- portón necesita: para cada semana de registro, cuánta de su gente apareció la semana
-- que termina. La cohorte se identifica por semana ISO de created_at, dato que ya
-- tenemos; nunca se guarda quién compone la cohorte.
--
-- Idempotente: correr el cron dos veces el mismo día no infla nada, porque estas filas
-- se PISAN (set count = ...) en vez de incrementarse. Es lo correcto para una foto y lo
-- contrario de lo que hace track_event, que cuenta ocurrencias.
-- ----------------------------------------------------------------------------
create or replace function public.compute_activity_rollups()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_hoy      date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_wau      bigint;
  v_mau      bigint;
  v_cohortes int := 0;
begin
  select count(*) into v_wau
    from public.profiles p
   where p.last_seen_day >= v_hoy - 6
     and p.status <> 'eliminado';

  select count(*) into v_mau
    from public.profiles p
   where p.last_seen_day >= v_hoy - 29
     and p.status <> 'eliminado';

  insert into public.events (name, day, dim, count)
  values ('wau', v_hoy, '', v_wau)
  on conflict (name, day, dim) do update set count = excluded.count;

  insert into public.events (name, day, dim, count)
  values ('mau', v_hoy, '', v_mau)
  on conflict (name, day, dim) do update set count = excluded.count;

  -- Cohortes: solo los lunes, mirando la semana que acaba de cerrar.
  if extract(isodow from v_hoy) = 1 then
    with semana as (
      select v_hoy - 7 as desde, v_hoy - 1 as hasta
    ),
    volvieron as (
      select
        'cohorte-' || to_char(p.created_at at time zone 'America/Argentina/Buenos_Aires',
                              'IYYY-IW') as cohorte,
        count(*) as vivos
      from public.profiles p, semana s
      where p.status <> 'eliminado'
        and p.last_seen_day between s.desde and s.hasta
      group by 1
    )
    insert into public.events (name, day, dim, count)
    select 'retorno_semanal', v_hoy, v.cohorte, v.vivos
      from volvieron v
    on conflict (name, day, dim) do update set count = excluded.count;

    get diagnostics v_cohortes = row_count;
  end if;

  return jsonb_build_object(
    'wau', v_wau,
    'mau', v_mau,
    'cohortes', v_cohortes
  );
end;
$fn$;

comment on function public.compute_activity_rollups() is
  'Foto nocturna de actividad agregada (PART 24 §24.4): WAU y MAU contados sobre profiles.last_seen_day, y los lunes las cohortes de retorno semanal que miden el portón de D11. Escribe filas que se PISAN, no que se incrementan, así que correr el cron dos veces no infla nada. No guarda ni puede reconstruir quién compone cada número.';

revoke execute on function public.compute_activity_rollups() from public, anon, authenticated;
