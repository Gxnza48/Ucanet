-- ============================================================================
-- 0015 — "Para vos", "Tendencias" y marcadores
--
-- Las migraciones 0001–0014 ya se aplicaron y no se editan: esto es aditivo y
-- forward-only. Agrega cuatro objetos y un índice:
--
--   1. public.feed_para_vos(...)   — el feed personalizado, ranking explicable.
--   2. public.feed_tendencias(...) — "qué se está moviendo ahora", sin personalizar.
--   3. public.bookmarks            — tabla de marcadores (guardados).
--   4. public.feed_guardados(...)  — la lista de marcadores del usuario.
--   +  posts_last_activity_at_idx  — el índice que hace barata la ventana acotada.
--
-- POR QUÉ EXISTE ESTO, Y CON QUÉ LÍMITES (importa más que el SQL)
--
-- PART 12 §12.1 corta el MVP en dos pestañas y manda "Para vos" a P3; §12.9 lo
-- describe como *quota blend*, no como modelo, y cierra con una decisión
-- permanente: nunca filtrado colaborativo, nunca recomendadores aprendidos.
-- Este archivo construye "Para vos" adelantado en el tiempo, y para no romper
-- ninguna de esas promesas se somete a dos límites que no se negocian:
--
--   · CERO TRACKING NUEVO. El ranking usa solo señales que YA existen como
--     contenido: `materia_follows` (a qué te anotaste), `post_votes` (qué
--     votaste), `comments` (dónde escribiste) y `profiles.carrera_id` (tu
--     cohorte). No se crea ninguna tabla de impresiones, de clicks ni de vistas.
--     PART 24 §24.1 prohíbe el log de conducta por usuario y esa prohibición es
--     identidad del producto (§0.1, C3), no un detalle de implementación. La
--     única tabla nueva de este archivo, `bookmarks`, es una acción EXPLÍCITA
--     del usuario sobre una publicación — es contenido, no observación.
--
--   · RANKING EXPLICABLE EN UNA ORACIÓN (PART 12 §12.3). Por eso
--     `feed_para_vos` devuelve `motivo`: una etiqueta corta —
--     seguis | te_interesa | tu_carrera | descubrimiento — que la UI traduce a
--     "Porque seguís Derecho Romano". La base NO manda copy: emite la etiqueta,
--     la pantalla escribe la oración (§12.9: "every item can carry a one-line
--     reason. Explainability remains a hard requirement").
--
-- La fórmula base es LA MISMA de §12.3 y de features/feed/ranking.ts, sin una
-- constante cambiada. Lo único que "Para vos" agrega encima es un multiplicador
-- de afinidad discreto (2.0 / 1.5 / 1.4 / 1.0) y una penalidad de diversidad.
-- Si esas dos capas dejaran de ser explicables, sobra el feed, no la explicación.
--
-- ANONIMATO. Las tres funciones de feed emiten filas construidas ÍNTEGRAMENTE
-- sobre `public.posts_public` (migración 0010): `author_handle` ya viene NULL
-- cuando `is_anonymous`, y `author_id` no existe en la vista, así que no hay
-- forma de que salga por acá. Las tablas base solo se tocan para calcular la
-- afinidad DEL PROPIO LLAMANTE (sus follows, sus votos, sus comentarios, su
-- carrera) y nada de eso se devuelve: entra al cálculo y muere ahí (D5, D14.5).
--
-- Reglas uniformes de 0011/0012/0014, verificadas por el meta-test pgTAP sobre
-- pg_proc: `security definer` + `set search_path = public, pg_temp`,
-- `revoke execute ... from public, anon` y grants explícitos, RLS en toda tabla
-- nueva, COMMENT ON en todo objeto nuevo, y errores con
-- `raise exception '<CODE>'` usando solo códigos de RPC_ERROR_CODES
-- (lib/errors.ts).
--
-- Dependencias: 0004 (profiles.carrera_id), 0005 (posts), 0006
-- (post_votes, materia_follows), 0010 (posts_public), 0013 (purge_retention).
-- ============================================================================


-- ============================================================================
-- 0. Índice de soporte para la ventana acotada
--
-- 0005 tiene `posts_created_at_idx (created_at desc) where status='activo'` y
-- `posts_carrera_id_last_activity_at_idx (carrera_id, last_activity_at desc)`,
-- pero ninguno ordena TODO el corpus activo por last_activity_at. Sin este
-- índice, la cota de ~600 filas de `feed_para_vos` se pagaría con un sort de
-- todo lo activo — es decir, la cota dejaría de ser una cota.
-- ============================================================================

create index posts_last_activity_at_idx
  on public.posts (last_activity_at desc)
  where status = 'activo';

comment on index public.posts_last_activity_at_idx is
  'Ordena el corpus activo por última actividad. Existe para que la ventana acotada de feed_para_vos (~600 filas) sea un range scan y no un sort completo: es la contracara física de la cota de §0.5-R2.';


-- ============================================================================
-- 1. feed_para_vos — el feed personalizado
--
-- CONJUNTO DE CANDIDATOS. Publicaciones activas de los últimos 30 días,
-- acotadas a las ~600 más recientes por `last_activity_at`. La cota es dura y
-- sigue la misma lógica que la ventana de 400 de §0.5-R2 / §12.4: sin ella,
-- esta consulta se vuelve un scan que crece con los años y el
-- [FREE-TIER RISK] del plan se hace real. 600 y no 400 porque acá el orden
-- final reordena por afinidad y diversidad, así que hace falta un poco más de
-- material del que se muestra; sigue siendo un número fijo, revisable solo con
-- datos.
--
-- PUNTAJE = base × afinidad.
--
--   base = (10 + least(E, 40)) / (h_eff + 2)^1.5      con E = score + 2*comments
--          h_eff = max(0, max(h desde last_activity_at, h desde created_at - 48))
--
--   Es la fórmula de §12.3 VERBATIM (la misma que features/feed/ranking.ts).
--   Sus constantes sostienen la oración publicada en /acerca: "Ordenamos por lo
--   más nuevo; los votos y comentarios pueden adelantar una publicación unas
--   horas, nunca días". No se reinventa acá.
--
--   afinidad = el multiplicador MÁS ALTO que aplique; NO se acumulan (un post
--   de una materia que seguís y además de tu carrera vale 2.0, no 2.8). Que sea
--   un máximo y no un producto es lo que hace que `motivo` sea verdadero: hay
--   exactamente una razón por la que esta fila subió.
--
--     2.0  materia seguida            → motivo 'seguis'
--     1.5  materia donde votaste o comentaste antes → 'te_interesa'
--     1.4  post de tu carrera         → 'tu_carrera'
--     1.0  todo lo demás              → 'descubrimiento'
--
--   El techo de 2.0 es deliberadamente chico: multiplica por 2 un puntaje cuyo
--   rango útil ya cubre un factor de ~5 entre "recién publicado" y "muerto".
--   Traducido: la afinidad reordena entre publicaciones de edad parecida, NO
--   resucita lo viejo. La promesa de /acerca sigue en pie con el multiplicador
--   puesto.
--
--   'te_interesa' se DERIVA en la consulta desde `post_votes` y `comments` del
--   propio llamante — las materias de los posts que votó o comentó. Sin tabla
--   nueva, sin tracking, sin log de conducta (PART 24 §24.1).
--
-- DIVERSIDAD. `row_number()` por materia sobre el puntaje: a partir de la
-- TERCERA fila de una misma materia el puntaje se divide por el número de fila
-- (3ª /3, 4ª /4, …). Una materia en pleno parcial no puede comerse el feed. Las
-- publicaciones SIN materia caen todas en la misma partición (NULL): también es
-- deliberado — la charla general de campus es una voz más, no un pase libre.
--
-- SIN SESIÓN. `auth.uid()` null ⇒ afinidad 1.0 para todo y `motivo`
-- 'descubrimiento': el feed degrada a "lo mejor de los últimos días" y la
-- función NO falla. Por eso tiene grant a `anon`.
--
-- PAGINACIÓN. `p_now` lo FIJA el cliente en el cursor: todas las páginas de una
-- misma sesión de scroll calculan los mismos puntajes, así no hay filas
-- repetidas ni agujeros (§12.4). El corte es keyset sobre (rank, id), nunca
-- OFFSET. El row_number de diversidad se calcula sobre la ventana COMPLETA
-- antes de cortar por cursor, para que la penalidad de una fila no dependa de
-- en qué página cayó.
-- ============================================================================

create or replace function public.feed_para_vos(
  p_now        timestamptz,
  p_limit      int              default 25,
  p_after_rank double precision default null,
  p_after_id   bigint           default null
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
  locked_at        timestamptz,
  created_at       timestamptz,
  edited_at        timestamptz,
  last_activity_at timestamptz,
  rank             double precision,
  motivo           text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid       uuid := auth.uid();
  -- p_now nulo no es un error del usuario: es la primera página, antes de que
  -- exista cursor. Se resuelve con el reloj del servidor.
  v_now       timestamptz := coalesce(p_now, now());
  v_limit     int := least(greatest(coalesce(p_limit, 25), 1), 50);
  v_carrera   bigint;
  v_ventana   constant int := 600;   -- cota dura de candidatos (§0.5-R2)
  v_senales   constant int := 500;   -- cota dura de señales de afinidad leídas
begin
  -- La carrera del llamante: fila propia de profiles. Con sesión anónima queda
  -- null y la rama 'tu_carrera' nunca se activa.
  if v_uid is not null then
    select p.carrera_id into v_carrera
      from public.profiles p
     where p.id = v_uid;
  end if;

  return query
  with
  -- Materias seguidas. `materia_follows` es la única tabla escribible por
  -- política (§8.3.4) y su política de select ya limita a las filas propias;
  -- acá igual se filtra explícito porque esta función es DEFINER y la RLS no
  -- se aplica al dueño.
  mis_materias as (
    select f.materia_id
      from public.materia_follows f
     where v_uid is not null
       and f.user_id = v_uid
  ),

  -- Señales de interés YA EXISTENTES: los posts que el llamante votó y aquellos
  -- donde comentó. Se leen de las tablas base porque `comments_public` no tiene
  -- author_id (por diseño) y porque un post que después se borró sigue siendo
  -- señal válida de interés en su materia. De estas filas NO se emite NADA: lo
  -- único que sale del CTE es un conjunto de materia_id del propio llamante.
  -- Ambas listas van acotadas a las `v_senales` más recientes para que el costo
  -- no crezca con la vida de la cuenta.
  votos_recientes as (
    select v.post_id
      from public.post_votes v
     where v_uid is not null
       and v.user_id = v_uid
     order by v.created_at desc
     limit v_senales
  ),
  comentarios_recientes as (
    select c.post_id
      from public.comments c
     where v_uid is not null
       and c.author_id = v_uid
     order by c.created_at desc
     limit v_senales
  ),
  materias_tocadas as (
    select p.materia_id
      from public.posts p
      join votos_recientes v on v.post_id = p.id
     where p.materia_id is not null
    union
    select p.materia_id
      from public.posts p
      join comentarios_recientes c on c.post_id = p.id
     where p.materia_id is not null
  ),

  -- Ventana acotada. El segundo predicado es lógicamente redundante
  -- (last_activity_at >= created_at, así que el filtro por created_at ya lo
  -- implica), pero es el que le permite al planner recorrer
  -- posts_last_activity_at_idx como range scan y frenar, en vez de leer todo lo
  -- activo para después ordenarlo.
  candidatos as (
    select p.id, p.public_id, p.materia_id, p.carrera_id, p.kind, p.title,
           p.body, p.is_anonymous, p.author_handle, p.score, p.comments_count,
           p.locked_at, p.created_at, p.edited_at, p.last_activity_at
      from public.posts_public p
     where p.created_at >= v_now - interval '30 days'
       and p.last_activity_at >= v_now - interval '30 days'
     order by p.last_activity_at desc
     limit v_ventana
  ),

  -- El motivo se decide ANTES que el multiplicador y el multiplicador se deriva
  -- del motivo: así es estructuralmente imposible que la UI explique una razón
  -- distinta de la que movió la fila.
  etiquetado as (
    select c.*,
           case
             when c.materia_id is not null
                  and exists (select 1 from mis_materias f
                               where f.materia_id = c.materia_id)
               then 'seguis'
             when c.materia_id is not null
                  and exists (select 1 from materias_tocadas t
                               where t.materia_id = c.materia_id)
               then 'te_interesa'
             when v_carrera is not null and c.carrera_id = v_carrera
               then 'tu_carrera'
             else 'descubrimiento'
           end as motivo
      from candidatos c
  ),

  -- h_eff de §12.3: la edad que marca la última actividad, salvo que eso
  -- implique rejuvenecer el post más de 48 h respecto de su fecha real.
  medido as (
    select e.*,
           greatest(
             0::double precision,
             greatest(
               (extract(epoch from (v_now - e.last_activity_at)) / 3600.0)::double precision,
               (extract(epoch from (v_now - e.created_at)) / 3600.0)::double precision - 48.0
             )
           ) as h_eff
      from etiquetado e
  ),

  puntuado as (
    select m.*,
           (
             (10 + least(m.score + 2 * m.comments_count, 40))::double precision
             / power(m.h_eff + 2.0, 1.5)
           )
           * (case m.motivo
                when 'seguis'      then 2.0
                when 'te_interesa' then 1.5
                when 'tu_carrera'  then 1.4
                else 1.0
              end)::double precision as puntaje
      from medido m
  ),

  -- Penalidad de diversidad sobre la ventana completa (no sobre la página).
  diversificado as (
    select q.*,
           row_number() over (partition by q.materia_id
                                  order by q.puntaje desc, q.id desc) as fila
      from puntuado q
  ),

  ordenado as (
    select d.*,
           case when d.fila >= 3
                then d.puntaje / d.fila::double precision
                else d.puntaje
           end as rank_final
      from diversificado d
  )

  select s.id, s.public_id, s.materia_id, s.carrera_id, s.kind, s.title, s.body,
         s.is_anonymous, s.author_handle, s.score, s.comments_count, s.locked_at,
         s.created_at, s.edited_at, s.last_activity_at, s.rank_final, s.motivo
    from ordenado s
   where p_after_rank is null
      or p_after_id is null
      or (s.rank_final, s.id) < (p_after_rank, p_after_id)
   order by s.rank_final desc, s.id desc
   limit v_limit;
end;
$$;

comment on function public.feed_para_vos(timestamptz, int, double precision, bigint) is
  'Feed personalizado "Para vos" (PART 12 §12.9, con la fórmula de §12.3 intacta). Puntúa una ventana acotada a las ~600 publicaciones activas más recientes de los últimos 30 días con base × afinidad, donde base es el rank de §12.3 y afinidad es el multiplicador MÁS ALTO que aplique — 2.0 materia seguida, 1.5 materia donde votaste o comentaste, 1.4 tu carrera, 1.0 resto — sin acumular. Aplica una penalidad de diversidad por materia (de la tercera fila en adelante el puntaje se divide por el número de fila) y devuelve `motivo` (seguis | te_interesa | tu_carrera | descubrimiento) para que la UI pueda explicar cada fila en una oración. NO usa ningún dato de conducta: solo materia_follows, post_votes, comments y carrera del propio llamante (PART 24 §24.1 prohíbe el log por usuario). Sin sesión la afinidad es 1.0 y el feed degrada a "lo mejor de los últimos días", sin fallar. Paginación keyset por (rank, id) con p_now fijado en el cursor para que todas las páginas puntúen igual (§12.4). Las filas salen de posts_public, así que author_handle ya viene NULL en contenido anónimo y author_id no existe.';

revoke execute on function public.feed_para_vos(timestamptz, int, double precision, bigint) from public, anon;
grant execute on function public.feed_para_vos(timestamptz, int, double precision, bigint) to anon, authenticated;


-- ============================================================================
-- 2. feed_tendencias — qué se está moviendo ahora
--
-- No es el "Tendencias" con z-score de §12.9 (ese exige ≥ 200 eventos de
-- engagement por día para no ser ruido con etiqueta, y esa compuerta sigue
-- cerrada). Es la versión honesta y sin estado: velocidad de engagement en
-- crudo sobre las últimas 48 h.
--
--   velocidad = (score + 2*comments_count) / max(horas desde created_at, 2)
--
-- El piso de 2 h en el denominador es el mismo `+2` de §12.3 leído de otra
-- forma: sin él, un post de diez minutos con dos votos marcaría una velocidad
-- absurda. El umbral de al menos 1 de engagement evita la lista de ceros.
-- No se personaliza, no lleva `motivo` y no tiene cursor: es una lista corta y
-- se agota en una página.
-- ============================================================================

create or replace function public.feed_tendencias(
  p_now   timestamptz,
  p_limit int default 25
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
  locked_at        timestamptz,
  created_at       timestamptz,
  edited_at        timestamptz,
  last_activity_at timestamptz,
  velocidad        double precision
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_now   timestamptz := coalesce(p_now, now());
  v_limit int := least(greatest(coalesce(p_limit, 25), 1), 50);
begin
  return query
    select s.id, s.public_id, s.materia_id, s.carrera_id, s.kind, s.title,
           s.body, s.is_anonymous, s.author_handle, s.score, s.comments_count,
           s.locked_at, s.created_at, s.edited_at, s.last_activity_at,
           s.velocidad
      from (
        select p.id, p.public_id, p.materia_id, p.carrera_id, p.kind, p.title,
               p.body, p.is_anonymous, p.author_handle, p.score,
               p.comments_count, p.locked_at, p.created_at, p.edited_at,
               p.last_activity_at,
               ( (p.score + 2 * p.comments_count)::double precision
                 / greatest(
                     (extract(epoch from (v_now - p.created_at)) / 3600.0)::double precision,
                     2.0
                   )
               ) as velocidad
          from public.posts_public p
         where p.created_at >= v_now - interval '48 hours'
           and (p.score + 2 * p.comments_count) >= 1
      ) s
     order by s.velocidad desc, s.id desc
     limit v_limit;
end;
$$;

comment on function public.feed_tendencias(timestamptz, int) is
  'Lista "qué se está moviendo ahora": publicaciones de las últimas 48 h con al menos 1 de engagement, ordenadas por velocidad = (score + 2*comments_count) / max(horas desde created_at, 2). Sin personalizar, sin motivo y sin cursor — es una lista corta que se agota en una página. No es el "Tendencias" con z-score de PART 12 §12.9: esa versión sigue esperando la compuerta de ≥ 200 eventos de engagement por día. Las filas salen de posts_public (author_handle NULL en contenido anónimo, sin author_id).';

revoke execute on function public.feed_tendencias(timestamptz, int) from public, anon;
grant execute on function public.feed_tendencias(timestamptz, int) to anon, authenticated;


-- ============================================================================
-- 3. bookmarks — marcadores (guardados)
--
-- §8.11 nombra los marcadores como el punto de extensión natural de
-- `materia_follows`, y esta tabla copia su forma y su postura al pie de la
-- letra: PK compuesta, RLS habilitada, y — como el follow — se escribe POR
-- POLÍTICA y no por RPC. La excepción de tenet 6 se justifica igual que allá:
-- guardar es una fila, idempotente, sin contadores cacheados, sin dimensión de
-- anonimato y sin sensibilidad a límites de tasa que pida una función.
--
-- No es tracking (PART 24 §24.1): es una acción explícita y deliberada del
-- usuario sobre una publicación concreta, visible solo para él, que él mismo
-- puede deshacer. Nada la escribe por el hecho de leer, mirar o pasar de largo.
--
-- Privacidad: NO hay contador público de "veces guardado". Un contador
-- convertiría un gesto privado en señal social y abriría la puerta a
-- inferencias sobre qué guarda una cohorte chica. Si algún día hace falta, se
-- resuelve con una función de agregado como `materia_follower_count` (0011), no
-- exponiendo filas.
-- ============================================================================

create table public.bookmarks (
  user_id    uuid not null references public.profiles(id) on delete restrict,
  post_id    bigint not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

comment on table public.bookmarks is
  'Publicaciones guardadas por cada usuario ("Guardados"): alimenta feed_guardados. Punto de extensión previsto en §8.11, con la misma forma y postura que materia_follows (§8.3.4) — es la segunda y última tabla del esquema que se escribe por política y no por RPC, porque guardar es una fila, idempotente, sin contadores cacheados, sin dimensión de anonimato y sin sensibilidad a límites de tasa. Son datos de preferencia, no contenido: purge_retention() los borra cuando la cuenta se elimina, y la cascada del post se los lleva cuando el contenido se purga físicamente (§8.7). No existe contador público de "veces guardado": el gesto es privado y así se queda.';

comment on column public.bookmarks.user_id is
  'Quien guarda. Las políticas obligan a que sea siempre auth.uid(): nadie lee ni escribe marcadores ajenos. ON DELETE RESTRICT contra profiles, igual que materia_follows: las filas de perfil no se borran físicamente, se anonimizan.';
comment on column public.bookmarks.post_id is
  'Publicación guardada. ON DELETE CASCADE: el borrado físico del post en purge_retention() (a los 365 días de eliminado) se lleva sus marcadores sin dejar huérfanos. El borrado BLANDO no borra la fila — el post simplemente deja de aparecer en feed_guardados, porque esa función lee posts_public, que solo emite filas activas; si moderación restaura el post, el marcador sigue ahí.';
comment on column public.bookmarks.created_at is
  'Cuándo se guardó. Es la clave de orden y de cursor de feed_guardados (saved_at desc, id desc).';

-- La PK (user_id, post_id) resuelve "¿está guardado?"; este índice cubre la
-- lista ordenada por fecha de guardado, que es el acceso caliente.
create index bookmarks_user_id_created_at_idx
  on public.bookmarks (user_id, created_at desc);

-- Necesario para la CASCADE: sin índice por post_id, cada DELETE de post en la
-- purga anual haría un seq scan de bookmarks.
create index bookmarks_post_id_idx
  on public.bookmarks (post_id);

comment on index public.bookmarks_user_id_created_at_idx is
  'Cubre el keyset de feed_guardados: las filas de un usuario en orden de guardado descendente.';
comment on index public.bookmarks_post_id_idx is
  'Soporta el ON DELETE CASCADE desde posts en la purga física anual; sin él la purga haría un seq scan por post borrado.';

alter table public.bookmarks enable row level security;

revoke all on table public.bookmarks from anon, authenticated;
grant select, insert, delete on table public.bookmarks to authenticated;

create policy bookmarks_select_own
  on public.bookmarks
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy bookmarks_insert_own
  on public.bookmarks
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy bookmarks_delete_own
  on public.bookmarks
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

comment on policy bookmarks_select_own on public.bookmarks is
  'Qué guarda cada uno es privado: solo el propio usuario lee sus filas. No hay lectura agregada de marcadores para nadie más, ni siquiera contada.';
comment on policy bookmarks_insert_own on public.bookmarks is
  'Guardar: inserción de una fila propia. La acción usa on conflict do nothing para que guardar dos veces sea idempotente.';
comment on policy bookmarks_delete_own on public.bookmarks is
  'Dejar de guardar: borrado físico de la fila propia. No hay política de update: un marcador no tiene nada que actualizar.';


-- ============================================================================
-- 4. feed_guardados — la lista de marcadores del usuario
--
-- Es SECURITY DEFINER por la misma razón que las otras dos: el contenido se lee
-- de `posts_public` y hace falta join contra `bookmarks`. La RLS de bookmarks
-- NO protege acá (el dueño de la función está exento), así que el filtro por
-- `auth.uid()` es explícito y es la única cosa que separa los guardados de una
-- persona de los de otra. No se toca.
--
-- El join contra posts_public hace que los posts eliminados desaparezcan solos
-- de la lista, sin borrar el marcador: si moderación restaura el contenido, el
-- guardado vuelve a aparecer.
--
-- Nota sobre el nombre del parámetro: el cursor se llama `p_after_created_at`
-- por contrato con el frontend, pero compara contra `saved_at`
-- (bookmarks.created_at), que es lo que ordena esta lista — no contra el
-- created_at de la publicación.
-- ============================================================================

create or replace function public.feed_guardados(
  p_limit            int         default 25,
  p_after_created_at timestamptz default null,
  p_after_id         bigint      default null
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
  locked_at        timestamptz,
  created_at       timestamptz,
  edited_at        timestamptz,
  last_activity_at timestamptz,
  saved_at         timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_limit int := least(greatest(coalesce(p_limit, 25), 1), 50);
begin
  -- Sin sesión no hay guardados que devolver. Se aborta con el código de
  -- RPC_ERROR_CODES en vez de devolver vacío para que la pantalla pueda mandar
  -- a /ingresar en lugar de mostrar un estado vacío mentiroso.
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  return query
    select s.id, s.public_id, s.materia_id, s.carrera_id, s.kind, s.title,
           s.body, s.is_anonymous, s.author_handle, s.score, s.comments_count,
           s.locked_at, s.created_at, s.edited_at, s.last_activity_at,
           s.saved_at
      from (
        select p.id, p.public_id, p.materia_id, p.carrera_id, p.kind, p.title,
               p.body, p.is_anonymous, p.author_handle, p.score,
               p.comments_count, p.locked_at, p.created_at, p.edited_at,
               p.last_activity_at,
               b.created_at as saved_at
          from public.bookmarks b
          join public.posts_public p on p.id = b.post_id
         where b.user_id = v_uid
      ) s
     where p_after_created_at is null
        or p_after_id is null
        or (s.saved_at, s.id) < (p_after_created_at, p_after_id)
     order by s.saved_at desc, s.id desc
     limit v_limit;
end;
$$;

comment on function public.feed_guardados(int, timestamptz, bigint) is
  'Publicaciones guardadas por quien llama, más recientes primero por fecha de guardado, con paginación keyset sobre (saved_at, id) — el parámetro se llama p_after_created_at por contrato con el frontend pero compara contra saved_at (bookmarks.created_at), no contra el created_at del post. Solo authenticated: sin sesión aborta con NOT_AUTHENTICATED. El filtro por auth.uid() es explícito porque esta función es DEFINER y la RLS de bookmarks no aplica al dueño. El join contra posts_public hace que los posts eliminados desaparezcan de la lista sin borrar el marcador (si moderación restaura, el guardado vuelve) y garantiza la misma regla de anonimato que el resto del sitio.';

revoke execute on function public.feed_guardados(int, timestamptz, bigint) from public, anon;
grant execute on function public.feed_guardados(int, timestamptz, bigint) to authenticated;


-- ============================================================================
-- 5. purge_retention() — se le agrega el paso de marcadores
--
-- 0013 no se edita (forward-only): se reemplaza la función con su cuerpo ACTUAL
-- verbatim más un paso 3.7. Lo único que cambia es ese paso y la clave
-- 'bookmarks' del jsonb de salida — todo lo demás es idéntico, a propósito.
--
-- Qué limpia el paso nuevo y qué NO:
--   · SÍ: marcadores de cuentas eliminadas. `delete_account` (0011) borra
--     materia_follows y notifications porque son datos de preferencia (§8.7);
--     los marcadores son exactamente eso, pero esa función es anterior a esta
--     tabla y no se edita. La purga cierra el hueco: apenas el perfil queda en
--     'eliminado' (por baja voluntaria o por el barrido de registros
--     abandonados de 3.5), sus marcadores se van.
--   · NO: marcadores de publicaciones con borrado blando. Esos los levanta sola
--     la CASCADE cuando el post se borra físicamente al año (3.6.e). Borrarlos
--     antes le haría perder un guardado a alguien cada vez que moderación
--     retira y después restaura una publicación, que es justo el caso donde el
--     usuario no hizo nada malo.
-- ============================================================================

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
  v_bookmarks       int := 0;
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
  -- Se van también sus follows: son preferencias, no contenido (§8.7). Sus
  -- marcadores los levanta el paso 3.7, junto con los de las bajas voluntarias.
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
  -- notificaciones, reportes y MARCADORES por cascada; `mod_actions` sobrevive con
  -- sus FK en null porque el registro de auditoría guarda `target_public_id` y
  -- `target_kind` como texto (§8.3.6).
  delete from public.posts p
   where p.status in ('eliminado_autor','eliminado_mod')
     and p.created_at < now() - interval '365 days';
  get diagnostics v_posts = row_count;

  -- ---------------------------------------------------------------------------
  -- 3.7 marcadores de cuentas eliminadas (migración 0015)
  -- Los marcadores son datos de preferencia, igual que los follows: §8.7 dice que
  -- se van con la cuenta. `delete_account` (0011) borra materia_follows y
  -- notifications pero es anterior a `bookmarks` y no se edita, así que el barrido
  -- vive acá y cubre las dos vías por las que un perfil llega a 'eliminado': la
  -- baja voluntaria y el paso 3.5.
  --
  -- Los marcadores de publicaciones con borrado BLANDO no se tocan a propósito:
  -- se los lleva la cascada de 3.6.e cuando el post se borra físicamente. Si se
  -- borraran antes, cada retiro-y-restauración de moderación le costaría un
  -- guardado a alguien que no hizo nada.
  -- ---------------------------------------------------------------------------
  delete from public.bookmarks b
   using public.profiles p
   where p.id = b.user_id
     and p.status = 'eliminado';
  get diagnostics v_bookmarks = row_count;

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
    'bookmarks_purged', v_bookmarks,
    'ran_at', now()
  );
end;
$$;

comment on function public.purge_retention() is
  'Purga diaria de la matriz de retención de PART 8 §8.7, invocada por '
  '`/api/cron/aggregates`. Pasos: `download_log` > 7 días (§0.5-R9); `search_queries` > 12 '
  'meses (§0.5-R10); notificaciones leídas > 90 días y no leídas > 180 días (§0.5-R14); '
  'borradores de recursos > 24 h (§0.5-R12); registros `nuevo` abandonados > 30 días '
  '(anonimizados como cáscara, igual que `delete_account`); borrado FÍSICO de posts y '
  'comentarios `eliminado_*` con más de 365 días, en orden hijos→padres porque '
  '`comments.parent_id` es RESTRICT; y (0015) marcadores de cuentas eliminadas, que son '
  'datos de preferencia como los follows pero quedaron fuera de `delete_account` por ser '
  'la tabla posterior. Devuelve jsonb con el conteo de cada paso para que el endpoint lo '
  'registre. `events` nunca se purga; la destrucción de archivos en R2 y el borrado de '
  '`auth.users` viven en el endpoint, no acá. Solo la llama el endpoint de cron con la '
  'service-role key.';

-- `create or replace function` conserva los privilegios existentes; se reafirman
-- igual, porque el costo de la redundancia es cero y el de un grant perdido es
-- un DELETE masivo alcanzable desde una request (D5, D14.3).
revoke execute on function public.purge_retention() from public, anon, authenticated;
grant execute on function public.purge_retention() to service_role;
