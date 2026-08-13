-- =============================================================================
-- uca.net — migración 0005: posts, comments, anon_aliases
-- PART 8 §8.3.3 (contenido) + §8.3.4 (anon_aliases)
--
-- Depende de: 0001 (public.nanoid(), configuración FTS public.es)
--             0002 (materias, carreras)
--             0004 (profiles)
--
-- Postura de seguridad (tenets 1, 5 y 6 de §8.1):
--   · RLS habilitada en las tres tablas de este archivo.
--   · posts y comments: CERO políticas y CERO grants para anon/authenticated.
--     Una tabla sin políticas es inaccesible A PROPÓSITO. La lectura pública
--     pasa por las vistas definer posts_public / comments_public (migración
--     0010); la escritura, por las RPC SECURITY DEFINER (migración 0011).
--     Lo que la base nunca emite, ningún bug del frontend puede filtrar.
--   · anon_aliases: cero políticas, cero grants, para siempre (ver el comentario
--     de la tabla).
--
-- Sobre los nombres de los CHECK: este archivo copia el DDL normativo de
-- PART 8, que declara los CHECK de columna en línea y sin nombre explícito.
-- PostgreSQL les asigna nombres deterministas — posts_public_id_check,
-- posts_kind_check, posts_title_check, posts_body_check, posts_status_check,
-- comments_public_id_check, comments_depth_check, comments_body_check,
-- comments_status_check, anon_aliases_alias_num_check — y son esos los que
-- usa §8.2.2 para ampliar un vocabulario con DROP CONSTRAINT + ADD CONSTRAINT.
-- Los constraints de tabla sí llevan el nombre que fija PART 8, verbatim.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- posts — la unidad de actividad (D1)
-- -----------------------------------------------------------------------------

create table public.posts (
  id               bigint generated always as identity primary key,
  public_id        text not null unique default public.nanoid()
                   check (public_id ~ '^[a-z0-9]{10}$'),
  author_id        uuid not null references public.profiles(id) on delete restrict,
  materia_id       bigint null references public.materias(id) on delete restrict,
  carrera_id       bigint null references public.carreras(id) on delete restrict,  -- snapshot de cohorte al crear (§0.5-R3)
  kind             text not null default 'texto' check (kind in ('texto','pregunta')),
  title            text null check (char_length(title) <= 120),
  body             text null check (char_length(body) <= 10000),
  is_anonymous     boolean not null default false,
  score            int not null default 0,
  comments_count   int not null default 0,
  status           text not null default 'activo'
                   check (status in ('activo','eliminado_autor','eliminado_mod')),
  locked_at        timestamptz null,                        -- bloqueo de hilo, lo setea bloquear_hilo (§0.5-R5)
  created_at       timestamptz not null default now(),
  edited_at        timestamptz null,
  last_activity_at timestamptz not null default now(),
  search           tsvector generated always as (
                     setweight(to_tsvector('public.es', coalesce(title, '')), 'A') ||
                     setweight(to_tsvector('public.es', coalesce(body, '')), 'C')
                   ) stored,
  constraint posts_body_required check (status <> 'activo' or body is not null)
);

comment on table public.posts is
  'Publicaciones: la unidad de actividad de la plataforma (D1). Un solo tipo de fila para todos los kinds y un solo composer (D2). Sin políticas RLS a propósito: se lee por la vista posts_public y se escribe por las RPC SECURITY DEFINER (tenets 5 y 6).';

comment on column public.posts.id is
  'PK interna. Nunca sale del servidor: las URL y los payloads llevan public_id (D14.7, tenet 3).';
comment on column public.posts.public_id is
  'Identidad pública: nanoid de 10 caracteres sobre el alfabeto sin ambigüedades (sin 0/1/i/l/o). Es lo que viaja en /p/[publicId] y es estable para siempre (D7).';
comment on column public.posts.author_id is
  'Autor real. Se retiene SIEMPRE, incluso en contenido anónimo (moderación, límites de tasa, obligaciones legales — D3). Jamás se expone: posts_public no tiene esta columna.';
comment on column public.posts.materia_id is
  'Materia opcional. Null = conversación general de campus, que se muestra a la carrera del autor.';
comment on column public.posts.carrera_id is
  'Snapshot de la carrera del autor al momento de crear el post (§0.5-R3). No se actualiza si después el autor cambia de carrera: es dato de cohorte, no de perfil. Dato grueso y no identificante, por eso se toma incluso en posts anónimos.';
comment on column public.posts.kind is
  'Vocabulario: texto | pregunta (§8.2.2). Las encuestas (P2) entran ampliando este CHECK, sin tabla nueva de posts.';
comment on column public.posts.title is
  'Título opcional, hasta 120 caracteres. Pesa A en el vector de búsqueda.';
comment on column public.posts.body is
  'Cuerpo, hasta 10.000 caracteres. Es nullable SOLO porque la eliminación lo anula (§8.7); posts_body_required garantiza que todo post activo tiene cuerpo.';
comment on column public.posts.is_anonymous is
  'Publicación anónima (D3): el payload público no lleva ningún campo de autor — ni handle, ni karma, ni antigüedad.';
comment on column public.posts.score is
  'Contador cacheado de upvotes. Lo mantiene la RPC toggle_post_vote dentro de la misma transacción y lo recalcula reconcile_counters() cada noche (§8.2.5, tenet 7).';
comment on column public.posts.comments_count is
  'Contador cacheado de comentarios activos; mismo mecanismo y misma reconciliación nocturna que score.';
comment on column public.posts.status is
  'activo | eliminado_autor | eliminado_mod. Borrado blando (tenet 4): el DELETE físico ocurre únicamente en purge_retention() (§8.7).';
comment on column public.posts.locked_at is
  'Hilo bloqueado por la acción de moderación bloquear_hilo (§0.5-R5); create_comment rechaza con THREAD_LOCKED mientras no sea null. Se expone en posts_public porque el estado de bloqueo es UI pública.';
comment on column public.posts.edited_at is
  'Null = nunca editado. Solo marca de edición: en MVP no guardamos historial de revisiones (§8.11).';
comment on column public.posts.last_activity_at is
  'Última actividad del hilo (creación, o el último comentario). Ordena el feed de carrera.';
comment on column public.posts.search is
  'Vector FTS generado: título peso A, cuerpo peso C, configuración public.es (§8.6). Al anularse body en una eliminación el vector queda vacío y la fila sale sola del índice parcial. CAVEAT: si alguna vez cambia la config public.es o el diccionario unaccent, esta columna NO se recalcula sola — esa migración debe reescribir las filas (update public.posts set body = body) y reindexar.';

comment on constraint posts_body_required on public.posts is
  'Un post activo siempre tiene cuerpo; solo los eliminados pueden tenerlo en null.';

-- Índices de §8.3.3.
create index posts_created_at_idx
  on public.posts (created_at desc)
  where status = 'activo';

create index posts_materia_id_created_at_idx
  on public.posts (materia_id, created_at desc)
  where status = 'activo' and materia_id is not null;

create index posts_carrera_id_last_activity_at_idx
  on public.posts (carrera_id, last_activity_at desc)
  where status = 'activo' and carrera_id is not null;

-- Deliberadamente NO parcial: las filas eliminadas tienen que seguir contando
-- para los límites de tasa, así borrar un post no resetea el límite (§8.3.8).
create index posts_author_id_created_at_idx
  on public.posts (author_id, created_at desc);

create index posts_search_idx
  on public.posts using gin (search)
  where status = 'activo';

alter table public.posts enable row level security;

-- Sin políticas: inaccesible a propósito para anon y authenticated (tenet 1).
-- El revoke es redundante con los default privileges invertidos en 0001; está
-- explícito porque el costo de la redundancia es cero y el de un grant olvidado
-- es una filtración de autoría.
revoke all on table public.posts from anon, authenticated;


-- -----------------------------------------------------------------------------
-- comments — respuestas, un solo nivel de anidamiento (D2)
-- -----------------------------------------------------------------------------

create table public.comments (
  id           bigint generated always as identity primary key,
  public_id    text not null unique default public.nanoid()
               check (public_id ~ '^[a-z0-9]{10}$'),
  post_id      bigint not null references public.posts(id) on delete cascade,
  parent_id    bigint null references public.comments(id) on delete restrict,
  depth        smallint not null default 1 check (depth in (1, 2)),
  author_id    uuid not null references public.profiles(id) on delete restrict,
  body         text null check (char_length(body) <= 5000),
  is_anonymous boolean not null default false,
  score        int not null default 0,
  status       text not null default 'activo'
               check (status in ('activo','eliminado_autor','eliminado_mod')),
  created_at   timestamptz not null default now(),
  edited_at    timestamptz null,
  constraint comments_depth_parent check ((parent_id is null) = (depth = 1)),
  constraint comments_body_required check (status <> 'activo' or body is not null)
);

comment on table public.comments is
  'Comentarios con profundidad máxima 2 (D2: un solo nivel de respuestas). Los eliminados quedan como lápida — la fila sobrevive para que el hilo no pierda contexto — y comments_public enmascara cuerpo y autor. Sin políticas RLS: se lee por comments_public y se escribe por las RPC.';

comment on column public.comments.id is
  'PK interna; nunca cruza el borde del servidor (D14.7).';
comment on column public.comments.public_id is
  'Identidad pública del comentario: la necesitan los permalinks (/p/[publicId]#c-[commentPublicId]) y las notificaciones, sin exponer secuencias.';
comment on column public.comments.post_id is
  'Post al que pertenece. ON DELETE CASCADE: la purga física de un post se lleva su hilo entero.';
comment on column public.comments.parent_id is
  'Comentario padre; null en los de primer nivel. ON DELETE RESTRICT: un padre con respuestas se convierte en lápida, nunca se borra físicamente mientras tenga hijos.';
comment on column public.comments.depth is
  'Profundidad desnormalizada, 1 o 2. La coherencia con el padre (parent.depth = 1) la valida create_comment y levanta DEPTH_EXCEEDED, porque un CHECK no puede leer otra fila.';
comment on column public.comments.author_id is
  'Autor real, retenido siempre incluso en comentarios anónimos (D3). Nunca se expone: comments_public solo emite handle o número de alias.';
comment on column public.comments.body is
  'Cuerpo, hasta 5.000 caracteres. Nullable solo por la eliminación (§8.7); comments_body_required lo exige en los activos. Sin tsvector: la búsqueda de MVP no cubre comentarios (D2, §8.9).';
comment on column public.comments.is_anonymous is
  'Comentario anónimo: se muestra como "Anónimo N" usando el alias por hilo de anon_aliases.';
comment on column public.comments.score is
  'Contador cacheado de upvotes, mantenido por toggle_comment_vote y reconciliado de noche (§8.2.5).';
comment on column public.comments.status is
  'activo | eliminado_autor | eliminado_mod. A diferencia de posts, el eliminado sigue siendo visible como lápida en el hilo.';
comment on column public.comments.edited_at is
  'Null = nunca editado.';

comment on constraint comments_depth_parent on public.comments is
  'Estructura del hilo: sin padre implica depth 1, con padre implica depth 2. Prohíbe cualquier tercer nivel a nivel de esquema.';
comment on constraint comments_body_required on public.comments is
  'Un comentario activo siempre tiene cuerpo; solo las lápidas pueden tenerlo en null.';

-- Índices de §8.3.3.
create index comments_post_id_created_at_idx
  on public.comments (post_id, created_at);

create index comments_parent_id_idx
  on public.comments (parent_id)
  where parent_id is not null;

create index comments_author_id_created_at_idx
  on public.comments (author_id, created_at desc);

alter table public.comments enable row level security;

-- Sin políticas: inaccesible a propósito para anon y authenticated (tenet 1).
revoke all on table public.comments from anon, authenticated;


-- -----------------------------------------------------------------------------
-- anon_aliases — el mapeo de anonimato (§8.3.4)
-- -----------------------------------------------------------------------------

create table public.anon_aliases (
  post_id    bigint not null references public.posts(id) on delete cascade,
  author_id  uuid not null references public.profiles(id) on delete restrict,
  alias_num  smallint not null check (alias_num >= 0),
  created_at timestamptz not null default now(),
  primary key (post_id, author_id),
  unique (post_id, alias_num)
);

comment on table public.anon_aliases is
  'LA TABLA MÁS CRÍTICA DEL ESQUEMA. Mapea (post, autor) -> número de alias para que dentro de un mismo hilo el mismo autor anónimo sea siempre "Anónimo N" (D3), y para que ese vínculo no exista nunca entre hilos distintos. Tiene RLS habilitada, CERO políticas y CERO grants: es ilegible para anon y para authenticated, hoy y siempre. Solo la leen las funciones SECURITY DEFINER y la vista comments_public, que emite el número y jamás el mapeo. Cualquier política, grant o vista que exponga author_id junto al post rompe el anonimato de toda la plataforma; pgTAP afirma que el SELECT falla para todos los roles. No agregar políticas acá: si algo necesita leer esta tabla, se hace dentro de una función definer.';

comment on column public.anon_aliases.post_id is
  'Hilo en el que vale el alias. El alcance es el hilo y nada más: el mismo autor recibe números distintos en posts distintos, así que correlacionar entre hilos es imposible.';
comment on column public.anon_aliases.author_id is
  'Autor real detrás del alias. Este es el dato que nunca sale de la base.';
comment on column public.anon_aliases.alias_num is
  '0 está reservado para el autor del post cuando el post es anónimo (se muestra "Anónimo (autor)"); los comentaristas reciben 1, 2, 3… por orden de primera aparición anónima. El UNIQUE (post_id, alias_num) hace imposible la doble asignación incluso bajo carrera; create_comment toma pg_advisory_xact_lock(post_id) antes de calcular max(alias_num) + 1 (§0.5-R22).';
comment on column public.anon_aliases.created_at is
  'Momento de la primera aparición anónima del autor en el hilo.';

-- Índices: los dos constraints únicos alcanzan (§8.3.4). La fila sobrevive a la
-- eliminación del comentario (un autor que vuelve conserva su número) y a la
-- eliminación de la cuenta (el alias queda apuntando al cascarón anonimizado,
-- que ya no tiene mail ni handle: el mapeo apunta a nadie — §8.7).

alter table public.anon_aliases enable row level security;

-- Cero políticas y cero grants. Es deliberado y es permanente.
revoke all on table public.anon_aliases from anon, authenticated;
