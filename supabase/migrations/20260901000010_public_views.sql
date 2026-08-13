-- =============================================================================
-- 0010 — Vistas públicas (PART 8 §8.4)
--
-- Las cinco vistas `_public` son el ÚNICO camino por el que `anon` y
-- `authenticated` leen contenido. Las tablas base (posts, comments, resources,
-- resource_files, profiles) no otorgan SELECT a ningún rol de la aplicación
-- (§8.3.9), así que la anonimidad se hace cumplir acá, en la base de datos, y no
-- en la app (tenet 5, D14.5): un bug del frontend no puede filtrar lo que la base
-- nunca emite.
--
-- Semántica DEFINER, a propósito (§8.4.1): las vistas se crean SIN
-- `security_invoker`, por lo que se ejecutan con los privilegios de su dueño
-- (`postgres`, el rol que aplica las migraciones) y no requieren ningún grant
-- sobre las tablas base. Esa es la decisión (b) de §8.4.1: con vistas invoker
-- habría que devolverle SELECT sobre `posts` a `authenticated` — exactamente la
-- superficie de fuga (author_id, is_anonymous joinables) que estas vistas existen
-- para eliminar; y RLS filtra FILAS, nunca COLUMNAS, así que ninguna política
-- puede anular un campo de autor. El linter de Supabase advierte sobre vistas
-- definer justamente porque saltean RLS: acá ese salteo ES el punto, es
-- deliberado, está documentado, y la política entera vive dentro de la vista.
--
-- `with (security_barrier = true)` impide que una función "leaky" provista por el
-- usuario se empuje por debajo de los filtros de la vista y espíe filas antes de
-- que se anulen los campos de autor.
--
-- Regla de serialización (D14.7): las vistas exponen el `id` interno para joins
-- del lado del servidor; solo `public_id` y slugs cruzan hacia el navegador.
--
-- ADVERTENCIA: agregar una columna a estas vistas es agregar una fuga. Las listas
-- de columnas de §8.4.2 son normativas y están cubiertas por pgTAP (se afirma el
-- anulado de filas anónimas y la ausencia de `author_id` en todas las vistas).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- posts_public — publicaciones activas
-- -----------------------------------------------------------------------------
create view public.posts_public with (security_barrier = true) as
select p.id, p.public_id, p.materia_id, p.carrera_id, p.kind, p.title, p.body,
       p.is_anonymous,
       case when p.is_anonymous then null else pr.handle::text end as author_handle,
       p.score, p.comments_count, p.locked_at,
       p.created_at, p.edited_at, p.last_activity_at,
       p.search
from public.posts p
join public.profiles pr on pr.id = p.author_id
where p.status = 'activo';

comment on view public.posts_public is
  'Lectura pública de publicaciones (PART 8 §8.4.2). Se anula `author_handle` '
  'cuando `is_anonymous`: el payload público de contenido anónimo no contiene NINGÚN '
  'campo de autor (D3) — ni handle, ni karma, ni antigüedad. `author_id` no existe en '
  'la vista para ninguna fila, anónima o no, así que ningún rol de la app tiene camino '
  'hacia él. `status` tampoco se expone: es constante por el WHERE (solo `activo`), y '
  'las publicaciones eliminadas están ausentes por completo — su URL renderiza un '
  'tombstone HTTP 410 en la app (§0.5-R23c), no un 404. `locked_at` sí se expone porque '
  'el estado de bloqueo es UI pública ("Hilo bloqueado" en el composer, §0.5-R5) y '
  '`carrera_id` también porque es dato de cohorte grueso y no identificante (§0.5-R3).';

comment on column public.posts_public.id is
  'Id interno (bigint) para joins del lado del servidor. NUNCA cruza al navegador: los '
  'payloads y URLs llevan `public_id` (D14.7).';
comment on column public.posts_public.is_anonymous is
  'Bandera pública: la UI necesita saber que debe rotular "Anónimo". No revela quién.';
comment on column public.posts_public.author_handle is
  'Seudónimo del autor, o NULL si la publicación es anónima. Único vínculo con la '
  'identidad que emite la vista; el `author_id` real nunca sale de la tabla base.';
comment on column public.posts_public.search is
  'tsvector generado (título A, cuerpo C) que consumen las funciones `search_*`.';

-- -----------------------------------------------------------------------------
-- comments_public — comentarios, con tombstones visibles
-- -----------------------------------------------------------------------------
create view public.comments_public with (security_barrier = true) as
select c.id, c.public_id, c.post_id, c.parent_id, c.depth,
       case when c.status = 'activo' then c.body else null end as body,
       c.status,
       (c.status = 'activo' and c.is_anonymous) as is_anonymous,
       case when c.status <> 'activo' or c.is_anonymous
            then null else pr.handle::text end as author_handle,
       case when c.status = 'activo' and c.is_anonymous
            then aa.alias_num else null end as anon_alias_num,
       c.score, c.created_at, c.edited_at
from public.comments c
join public.profiles pr on pr.id = c.author_id
left join public.anon_aliases aa
       on aa.post_id = c.post_id and aa.author_id = c.author_id;

comment on view public.comments_public is
  'Lectura pública de comentarios (PART 8 §8.4.2). A diferencia de `posts_public`, las '
  'filas eliminadas NO desaparecen: el hilo tiene que seguir siendo coherente, así que '
  'el comentario sobrevive como tombstone (`status` visible, `body` y `author_handle` '
  'en NULL) y la UI renderiza "Comentario eliminado". Se anula `author_handle` cuando el '
  'comentario es anónimo O está eliminado — una eliminación nunca puede revelar a quien '
  'escribió anónimo. `anon_alias_num` es lo ÚNICO que la tabla `anon_aliases` emite '
  'jamás: el número es público por diseño ("Anónimo 2"), el mapeo (post_id, author_id) '
  'nunca. `author_id` no existe en la vista.';

comment on column public.comments_public.id is
  'Id interno (bigint) para joins del servidor; al navegador va `public_id` (D14.7).';
comment on column public.comments_public.body is
  'NULL cuando el comentario no está activo: el tombstone conserva la estructura del '
  'hilo, no las palabras.';
comment on column public.comments_public.status is
  'Se expone (a diferencia de posts) porque la UI distingue comentario vivo de tombstone.';
comment on column public.comments_public.is_anonymous is
  'Solo verdadero para comentarios activos y anónimos; en tombstones es falso porque ya '
  'no hay nada que rotular.';
comment on column public.comments_public.anon_alias_num is
  'Número de alias por hilo ("Anónimo N"). 0 = autor de la publicación. NULL si el '
  'comentario está firmado o eliminado.';

-- -----------------------------------------------------------------------------
-- resources_public — recursos activos (metadatos)
-- -----------------------------------------------------------------------------
create view public.resources_public with (security_barrier = true) as
select r.id, r.public_id, r.materia_id, r.tipo, r.anio, r.title, r.description,
       r.is_anonymous,
       case when r.is_anonymous then null else pr.handle::text end as author_handle,
       r.score, r.downloads_count, r.created_at, r.edited_at, r.search
from public.resources r
join public.profiles pr on pr.id = r.author_id
where r.status = 'activo';

comment on view public.resources_public is
  'Lectura pública de recursos (PART 8 §8.4.2). Se anula `author_handle` cuando '
  '`is_anonymous`. Solo filas `activo`: borradores (`borrador`), pendientes, eliminados y '
  'retiros legales (`retirado_legal`) son invisibles para todo rol de la app. No se '
  'exponen `author_id`, `status` ni `price_cents` (punto de extensión del marketplace, '
  'fijado en NULL por CHECK — C11).';

comment on column public.resources_public.id is
  'Id interno (bigint) para joins del servidor; al navegador va `public_id` (D14.7).';
comment on column public.resources_public.author_handle is
  'Seudónimo del autor, o NULL si el recurso se publicó de forma anónima.';

-- -----------------------------------------------------------------------------
-- resource_files_public — metadatos de archivos de recursos activos
-- -----------------------------------------------------------------------------
create view public.resource_files_public with (security_barrier = true) as
select f.id, f.resource_id, f.original_name, f.mime, f.size_bytes, f.position
from public.resource_files f
join public.resources r on r.id = f.resource_id
where r.status = 'activo';

comment on view public.resource_files_public is
  'Metadatos de archivos para la ficha de un recurso (PART 8 §8.4.2). Lo que se anula acá '
  'no es un campo de autor sino la UBICACIÓN del archivo: `storage_path` (la clave del '
  'objeto en Cloudflare R2) y `sha256` se quedan adentro. Nadie puede construir una URL a '
  'un archivo desde esta vista: la ruta de descarga es el route handler del servidor, que '
  'llama a `register_download` y recién ahí firma una URL de R2 de 120 s (§0.5-R12/R17). '
  'Tampoco se expone `replaced_at`: los archivos superseded no se muestran.';

comment on column public.resource_files_public.id is
  'Id interno del archivo; se usa solo del lado del servidor para armar la descarga.';
comment on column public.resource_files_public.original_name is
  'Nombre original saneado, único resto del archivo tal como lo subió su autor; la clave '
  'real del objeto no contiene nombres ni ids de usuario.';

-- -----------------------------------------------------------------------------
-- profiles_public — perfiles seudónimos
-- -----------------------------------------------------------------------------
create view public.profiles_public with (security_barrier = true) as
select p.id, p.handle::text as handle, p.karma, p.carrera_id, p.ingreso_year,
       p.role, p.status, p.created_at
from public.profiles p
where p.status in ('activo','suspendido','baneado','eliminado');

comment on view public.profiles_public is
  'Lectura pública de perfiles (PART 8 §8.4.2). Acá lo anulado es por ausencia: quedan '
  'afuera `handle_changed_at` (el historial de renombres es privado — sin él, comparar '
  'nombres viejos y nuevos deja de ser posible, C4), `invited_with` (el árbol de '
  'invitaciones es dato forense, no público), `updated_at`, `notif_respuestas` y — '
  'estructuralmente — email y datos de auth, que nunca entraron a esta tabla. Las filas '
  '`status = ''nuevo''` (registro sin onboarding terminado) son invisibles. `role` se '
  'expone para que las acciones de moderación lleven autoridad visible, y `created_at` '
  'para mostrar antigüedad en grano grueso ("Se unió en marzo de 2027"). Las páginas de '
  'perfil son públicas pero `noindex` (C16).';

comment on column public.profiles_public.id is
  'UUID interno del perfil (= auth.users.id). Se expone SOLO para joins del lado del '
  'servidor; nunca se serializa al navegador — la identidad pública es el handle (D14.7).';
comment on column public.profiles_public.karma is
  'Entero único de reputación (C10), recalculado de forma uniforme cada noche por '
  '`reconcile_counters()` — nunca en el instante del voto, para que el karma de contenido '
  'anónimo no se pueda correlacionar temporalmente con quién lo publicó (§0.5-R7, C5).';
comment on column public.profiles_public.status is
  'Se expone porque una cuenta suspendida, baneada o eliminada se renderiza distinto. '
  'Las cuentas eliminadas quedan como cáscara anonimizada (`usuario_eliminado_*`).';

-- -----------------------------------------------------------------------------
-- Grants — el único SELECT que tienen los roles de la aplicación sobre contenido
-- (§8.4.2 in fine, §8.3.9). Las tablas base siguen sin ningún grant.
-- Necesario explícitamente porque 0001 revoca los privilegios por defecto de
-- Supabase sobre `public` (§8.2.6).
-- -----------------------------------------------------------------------------
grant select on public.posts_public          to anon, authenticated;
grant select on public.comments_public       to anon, authenticated;
grant select on public.resources_public      to anon, authenticated;
grant select on public.resource_files_public to anon, authenticated;
grant select on public.profiles_public       to anon, authenticated;
