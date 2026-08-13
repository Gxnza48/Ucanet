-- =============================================================================
-- 0007_resources — recursos, archivos y log efímero de descargas
-- PART 8 §8.3.5 (más `resource_votes` de §8.3.4).
--
-- Depende de: 0001 (public.nanoid(), configuración FTS public.es, revokes de
-- privilegios por defecto §8.2.6), 0002 (materias), 0004 (profiles).
--
-- Contenido:
--   · resources      — el imán de utilidad (D1): material académico tipado,
--                      colgado de exactamente una materia.
--   · resource_files — metadata de los archivos físicos (1–3 vivos por recurso).
--   · resource_votes — voto up-only sobre recursos (§8.3.4). Se define en esta
--                      migración y no en 0006 porque su FK necesita que
--                      `resources` ya exista; el resto de la tabla es idéntica
--                      a `post_votes` / `comment_votes`.
--   · download_log   — log efímero de 7 días (§0.5-R9), sin PK a propósito.
--
-- LOS ARCHIVOS NO VIVEN EN LA BASE NI EN SUPABASE STORAGE. Viven en Cloudflare
-- R2 (§0.5-R17: 10 GB gratis, egress cero, API S3). Esta migración no crea
-- buckets de `storage`, ni objetos del esquema `storage`, ni políticas de
-- storage — deliberadamente. `resource_files.storage_path` es una clave de
-- objeto neutral respecto del proveedor (`r/{resource_public_id}/{file_nanoid}.{ext}`)
-- y las URLs firmadas de 120 s se emiten del lado del servidor (PART 14).
--
-- Convención de esta migración: los CHECK llevan nombre explícito (§8.2.2 —
-- agregar o quitar un valor de un vocabulario es DROP CONSTRAINT + ADD
-- CONSTRAINT, y eso necesita un nombre estable). Los nombres elegidos son
-- exactamente los que PostgreSQL generaría por su cuenta (`<tabla>_<col>_check`),
-- así que el catálogo queda igual que si se hubieran escrito sin nombrar.
--
-- Privilegios: 0001 revocó los privilegios por defecto de `anon` y
-- `authenticated` sobre las tablas de `public` (§8.2.6), así que todo lo que
-- se crea acá nace inaccesible. El único GRANT de esta migración es el SELECT
-- de `resource_votes` a `authenticated`, que la política de más abajo acota a
-- las filas propias. Ninguna de las cuatro tablas recibe grants de escritura:
-- se escriben solo desde funciones SECURITY DEFINER (tenet 6).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- resources
-- -----------------------------------------------------------------------------

create table public.resources (
  id              bigint generated always as identity primary key,
  public_id       text not null unique default public.nanoid()
                  constraint resources_public_id_check check (public_id ~ '^[a-z0-9]{10}$'),
  materia_id      bigint not null references public.materias(id) on delete restrict,
  author_id       uuid not null references public.profiles(id) on delete restrict,
  tipo            text not null
                  constraint resources_tipo_check
                  check (tipo in ('resumen','apunte','parcial','final','guia','otro')),
  anio            smallint null
                  constraint resources_anio_check check (anio between 2000 and 2100),
  title           text not null
                  constraint resources_title_check check (char_length(title) between 8 and 120),
  description     text null
                  constraint resources_description_check check (char_length(description) <= 2000),
  is_anonymous    boolean not null default false,
  score           int not null default 0,
  downloads_count int not null default 0,
  price_cents     int null
                  constraint resources_price_cents_check check (price_cents is null),
  status          text not null default 'borrador'
                  constraint resources_status_check
                  check (status in ('borrador','activo','pendiente','eliminado_autor','eliminado_mod','retirado_legal')),
  created_at      timestamptz not null default now(),
  edited_at       timestamptz null,
  search          tsvector generated always as (
                    setweight(to_tsvector('public.es', title), 'A') ||
                    setweight(to_tsvector('public.es', coalesce(description, '')), 'C')
                  ) stored
);

comment on table public.resources is
  'Material académico tipado (resumen, apunte, parcial, final, guía, otro) colgado de exactamente una materia: el imán de utilidad de D1. Gratis siempre en MVP. Los bytes de los archivos viven en Cloudflare R2 (§0.5-R17); acá solo vive la metadata. Sin lectura directa: se lee por la vista resources_public (§8.4).';

comment on column public.resources.id is
  'PK interna. Nunca sale del servidor (D14.7): la URL usa public_id.';
comment on column public.resources.public_id is
  'Identidad pública: nanoid de 10 caracteres del alfabeto sin ambigüedades (§8.2.1). Es lo que viaja en /recursos/[publicId].';
comment on column public.resources.materia_id is
  'Materia a la que pertenece el recurso. Obligatoria: un recurso sin materia no es hallable ni acumula valor en la página que dura diez años. ON DELETE RESTRICT porque el catálogo no se borra.';
comment on column public.resources.author_id is
  'Autor real, siempre guardado aunque is_anonymous sea true (D3): hace falta para moderación, rate limits, cuota y requerimientos legales. Nunca sale por la vista pública si el recurso es anónimo.';
comment on column public.resources.tipo is
  'Vocabulario cerrado de §8.2.2: resumen, apunte, parcial, final, guia, otro. Texto + CHECK con nombre, no enum nativo.';
comment on column public.resources.anio is
  'Año del material (el año del parcial, de la cursada, de la edición del apunte), no el año de subida. Opcional.';
comment on column public.resources.title is
  'Mínimo 8 caracteres a propósito (§0.5-R12): fuerza títulos descriptivos y descarta "resumen" o "parcial" a secas, que arruinan la búsqueda.';
comment on column public.resources.description is
  'Descripción libre opcional, hasta 2000 caracteres. Entra al tsvector con peso C.';
comment on column public.resources.is_anonymous is
  'Si es true, la vista resources_public devuelve author_handle en null. La columna author_id sigue existiendo, pero anon/authenticated no tienen ningún camino hacia ella (tenet 5).';
comment on column public.resources.score is
  'Contador cacheado de votos positivos. Lo mantiene toggle_resource_vote dentro de la misma transacción y lo recalcula reconcile_counters todas las noches (§8.2.5).';
comment on column public.resources.downloads_count is
  'Contador cacheado de descargas, deduplicado por usuario y por día en register_download (§0.5-R9). No es un contador de requests: es un contador de estudiantes-día.';
comment on column public.resources.price_cents is
  'Punto de extensión del marketplace (C11, PART 15). CHECK-clavado en null: ningún camino de código puede ponerle precio a nada hasta que una migración futura relaje resources_price_cents_check.';
comment on column public.resources.status is
  'Ciclo de vida. borrador: fila creada por request_upload, todavía sin archivos (se purga a las 24 h). activo: publicado. pendiente: gancho de premoderación, sin uso en MVP. eliminado_autor / eliminado_mod: baja blanda. retirado_legal: bajada por copyright o pedido legal, se distingue de la baja de moderación porque destruye los archivos de inmediato y deja otro rastro de auditoría (§8.2.2, §8.7).';
comment on column public.resources.edited_at is
  'Se setea cuando el autor edita título o descripción. Null quiere decir nunca editado; no hay historial de revisiones en MVP (§8.11).';
comment on column public.resources.search is
  'tsvector generado y almacenado con la configuración public.es (español + unaccent, §8.6). Pesos: título A, descripción C (§0.5-R13). Se regenera solo en cada UPDATE.';

-- Índices de §8.3.5. El unique de public_id ya trae su índice por la restricción.
create index resources_materia_created_idx
  on public.resources (materia_id, created_at desc)
  where status = 'activo';

-- No es parcial a propósito: la cuota de 100 MB y las ventanas de rate limit
-- tienen que contar también los recursos dados de baja (§8.3.8).
create index resources_author_created_idx
  on public.resources (author_id, created_at desc);

create index resources_search_gin_idx
  on public.resources using gin (search)
  where status = 'activo';

alter table public.resources enable row level security;

-- RLS habilitada y CERO políticas de select, a propósito (tenet 1 + tenet 5):
-- ni anon ni authenticated pueden leer esta tabla por ninguna vía. La lectura
-- pública pasa por la vista definer resources_public (§8.4), que es la que
-- decide qué se ve de un recurso anónimo. Tampoco hay grants de escritura:
-- escriben request_upload, finalize_upload, delete_own_resource, las RPC de
-- moderación y los jobs (§8.5).


-- -----------------------------------------------------------------------------
-- resource_files
-- -----------------------------------------------------------------------------

create table public.resource_files (
  id            bigint generated always as identity primary key,
  resource_id   bigint not null references public.resources(id) on delete cascade,
  storage_path  text not null unique
                constraint resource_files_storage_path_check check (char_length(storage_path) <= 300),
  original_name text not null
                constraint resource_files_original_name_check
                check (char_length(original_name) between 1 and 200),
  mime          text not null
                constraint resource_files_mime_check
                check (mime in ('application/pdf','image/jpeg','image/png','image/webp')),
  size_bytes    int not null
                constraint resource_files_size_bytes_check check (size_bytes between 1 and 10485760),
  sha256        text null
                constraint resource_files_sha256_check check (sha256 ~ '^[a-f0-9]{64}$'),
  position      smallint not null default 1
                constraint resource_files_position_check check (position between 1 and 3),
  replaced_at   timestamptz null,
  created_at    timestamptz not null default now()
);

comment on table public.resource_files is
  'Metadata de los archivos de un recurso: hasta 3 vivos, hasta 10 MB cada uno (D2). Los bytes viven en Cloudflare R2 (§0.5-R17), fuera de la base — esta migración no crea buckets ni políticas de Supabase Storage a propósito. Reemplazar un archivo inserta una fila nueva y marca replaced_at en la vieja: no hay tabla de versiones (§0.5-R12).';

comment on column public.resource_files.resource_id is
  'Recurso dueño del archivo. ON DELETE CASCADE: la purga física de un recurso se lleva su metadata de archivos.';
comment on column public.resource_files.storage_path is
  'Clave de objeto en R2, neutral respecto del proveedor: r/{resource_public_id}/{file_nanoid}.{ext} (§0.5-R17). Nunca contiene ids de usuario ni el nombre original del archivo. Antes de moverse acá el objeto pasa por la cuarentena incoming/{upload_nanoid}, donde el servidor le olfatea el mime y le saca el EXIF (PART 14). UNIQUE: dos filas no pueden apuntar al mismo objeto.';
comment on column public.resource_files.original_name is
  'Nombre con el que el estudiante subió el archivo, saneado. Sirve para nombrar la descarga; no forma parte de la clave de objeto.';
comment on column public.resource_files.mime is
  'Tipo verificado por sniffing del lado del servidor, no el Content-Type que declaró el navegador. Vocabulario cerrado de 4 valores; espeja ACCEPTED_MIME en lib/config.ts.';
comment on column public.resource_files.size_bytes is
  'Tamaño real del objeto en R2, verificado con HEAD después de la subida. Tope 10485760 (10 MiB) por archivo; la suma por usuario se controla contra la cuota de 100 MB en request_upload (§0.5-R12).';
comment on column public.resource_files.sha256 is
  'Hash hexadecimal en minúsculas del contenido. Sirve para detectar duplicados, para el chequeo de integridad del export semanal (D13) y para matchear futuros pedidos de baja. Nullable porque los archivos viejos pueden no tenerlo.';
comment on column public.resource_files.position is
  'Orden de presentación, 1 a 3. Junto con el índice único parcial de más abajo es lo que hace estructural (no procedural) la regla de máximo 3 archivos vivos por recurso.';
comment on column public.resource_files.replaced_at is
  'Se setea cuando una fila más nueva reemplaza a este archivo (§0.5-R12). Mientras es null, el archivo está vivo y ocupa su position. Las filas reemplazadas conservan su position para que quede historia, y por eso el índice único es parcial. El objeto en R2 se destruye con 30 días de demora (§8.7).';

-- Índices de §8.3.5. El unique de storage_path ya trae su índice por la restricción.
-- Este índice ES la regla de "máximo 3 archivos vivos por recurso": el CHECK acota
-- position a 1..3 y el único parcial impide repetir una position entre las filas
-- vivas. No hay forma de insertar un cuarto archivo vivo (§8.3.5).
create unique index resource_files_live_position_uidx
  on public.resource_files (resource_id, position)
  where replaced_at is null;

create index resource_files_sha256_idx
  on public.resource_files (sha256)
  where sha256 is not null;

alter table public.resource_files enable row level security;

-- RLS habilitada y CERO políticas de select, a propósito (tenet 1 + tenet 5):
-- la metadata visible sale por la vista resource_files_public (§8.4), que no
-- expone ni storage_path ni sha256. La autorización de descarga la hace la
-- ruta del servidor (PART 14), que llama a register_download y recién ahí
-- firma una URL de R2 de 120 s. Sin grants de escritura: escribe
-- finalize_upload (§8.5.3).


-- -----------------------------------------------------------------------------
-- resource_votes  (§8.3.4 — desplazada desde 0006 por dependencia de FK)
-- -----------------------------------------------------------------------------

create table public.resource_votes (
  resource_id bigint not null references public.resources(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete restrict,
  created_at  timestamptz not null default now(),
  primary key (resource_id, user_id)
);

comment on table public.resource_votes is
  'Voto positivo de un usuario sobre un recurso. Up-only (D2: no hay downvotes), así que la existencia de la fila ES el voto y no hace falta columna de valor. Un voto por usuario por recurso, garantizado por la PK compuesta. Nadie puede enumerar quién votó qué: cada uno ve solo sus propias filas y el agregado vive en el contador cacheado resources.score.';

comment on column public.resource_votes.resource_id is
  'Recurso votado. ON DELETE CASCADE: la purga física del recurso se lleva sus votos.';
comment on column public.resource_votes.user_id is
  'Quien votó. ON DELETE RESTRICT: el perfil se anonimiza, nunca se borra físicamente (D3), así que el voto no queda huérfano.';
comment on column public.resource_votes.created_at is
  'Fecha del voto. Es la ventana que usan los rate limits de votación (§0.5-R6).';

-- Índices de §8.3.4. La PK cubre "¿este usuario votó este recurso?".
create index resource_votes_user_created_idx
  on public.resource_votes (user_id, created_at desc);

alter table public.resource_votes enable row level security;

-- Único grant de lectura de esta migración. La política de abajo lo acota a
-- las filas propias; sin política, el grant no alcanza para leer nada.
grant select on table public.resource_votes to authenticated;

-- El único select permitido: tus propios votos. La UI lo necesita para
-- renderizar el estado "ya votaste" (§8.3.4).
create policy resource_votes_select_own on public.resource_votes
  for select
  to authenticated
  using (user_id = auth.uid());

-- Sin grants ni políticas de escritura, a propósito: votar y desvotar pasa
-- exclusivamente por toggle_resource_vote (§8.5.4), que valida el estado del
-- recurso, rechaza el autovoto y ajusta resources.score en la misma
-- transacción. Retractar un voto borra la fila: un voto retirado no es
-- contenido y conservarlo sería vigilancia (§8.3.4).


-- -----------------------------------------------------------------------------
-- download_log
-- -----------------------------------------------------------------------------

create table public.download_log (
  resource_id bigint not null references public.resources(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now()
);

comment on table public.download_log is
  'Log efímero de descargas con ventana rodante de 7 días (§0.5-R9). Existe SOLO para dos cosas: (a) limitar la tasa de emisión de URLs firmadas y (b) deduplicar el incremento de resources.downloads_count por usuario, por recurso y por día. NO existe ningún historial durable de descargas por usuario: la ventana de 7 días es toda la tabla, y así está declarado en el inventario de datos de PART 9 §9.11.3 y en la página de Privacidad. SIN PRIMARY KEY a propósito: es un log append-only y un mismo usuario puede generar legítimamente varias filas por recurso y por día (solo la primera incrementa el contador).';

comment on column public.download_log.resource_id is
  'Recurso descargado. ON DELETE CASCADE.';
comment on column public.download_log.user_id is
  'Quien descargó. ON DELETE CASCADE, y no RESTRICT como en las tablas de contenido: esto no es contenido, es telemetría efímera, y si el perfil se va no hay nada que preservar.';
comment on column public.download_log.created_at is
  'Momento de la descarga. Es la única columna que importa: sobre ella corren la ventana de rate limit, la deduplicación por día y la purga a los 7 días (§8.7).';

-- Índices de §8.3.5.
create index download_log_user_created_idx
  on public.download_log (user_id, created_at desc);

create index download_log_resource_user_created_idx
  on public.download_log (resource_id, user_id, created_at desc);

alter table public.download_log enable row level security;

-- RLS habilitada, CERO políticas y CERO grants, a propósito (tenet 1): esta
-- tabla se escribe y se lee únicamente dentro de register_download (§8.5.3) y
-- del job purge_retention (§8.7), que corren como SECURITY DEFINER propiedad
-- de postgres. Ningún rol alcanzable desde la app la toca. Que quién descargó
-- qué sea inaccesible no es un descuido: es el diseño.
