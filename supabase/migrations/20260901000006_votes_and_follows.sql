-- =============================================================================
-- uca.net — migración 0006: post_votes, comment_votes, materia_follows
-- PART 8 §8.3.4 (votos y follows)
--
-- Depende de: 0002 (materias), 0004 (profiles), 0005 (posts, comments)
--
-- DESPLAZAMIENTO DECLARADO — resource_votes NO se crea acá.
--   §8.3.4 agrupa las tres tablas de voto, pero resource_votes tiene una FK a
--   public.resources, que recién nace en la migración 0007. Crearla en este
--   archivo haría fallar la migración con "relation public.resources does not
--   exist", y las migraciones se aplican en orden lexicográfico estricto
--   (§8.10.1). Por eso resource_votes se crea en 0007, inmediatamente después
--   de resources, con el DDL de §8.3.4 verbatim y la misma postura de RLS,
--   grants e índices que sus dos hermanas de este archivo. No hay cambio de
--   diseño: es puramente el orden de dependencias de las FK, el mismo motivo
--   por el que invites precede a profiles (§8.10.1).
--
-- Las tres tablas de voto son estructuralmente idénticas y separadas a
-- propósito: nada de pares tipo/id polimórficos (tenet 2). El voto es solo
-- positivo (D2: sin downvotes), así que la existencia de la fila ES el voto —
-- no hay columna value que validar.
--
-- Postura de seguridad:
--   · post_votes / comment_votes: RLS habilitada, UNA política de select sobre
--     las filas propias (la UI tiene que poder pintar "ya votaste"). Sin grants
--     de insert/update/delete: solo las RPC toggle_*_vote escriben. Nadie puede
--     enumerar quién votó qué; el agregado vive en el score cacheado.
--   · materia_follows: la ÚNICA tabla escribible por política de todo el
--     esquema (§8.3.4), porque seguir/dejar de seguir es una escritura de una
--     fila, idempotente, sin contadores, sin dimensión de anonimato y sin
--     sensibilidad a límites de tasa que justifique una función.
--
-- Sobre auth.uid(): las políticas lo envuelven en (select auth.uid()) para que
-- el planner lo evalúe una sola vez como initPlan en vez de por fila. Es la
-- forma recomendada por Supabase y es semánticamente idéntica.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- post_votes
-- -----------------------------------------------------------------------------

create table public.post_votes (
  post_id    bigint not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

comment on table public.post_votes is
  'Upvotes de publicaciones, uno por usuario por post, garantizado por la PK compuesta. Solo positivo (D2). Escribe únicamente la RPC toggle_post_vote; destildar el voto borra la fila — la única excepción a "los DELETE físicos solo pasan en los jobs de purga", porque un voto retirado no es contenido y conservarlo sería vigilancia (§8.3.4).';

comment on column public.post_votes.post_id is
  'Post votado. ON DELETE CASCADE: la purga física del post se lleva sus votos.';
comment on column public.post_votes.user_id is
  'Votante. Solo lo ve el propio votante (política de select) y las funciones definer; el resto del mundo ve nada más que el score agregado del post.';
comment on column public.post_votes.created_at is
  'Momento del voto; alimenta la ventana de límite de tasa de votos, que se cuenta con el índice (user_id, created_at desc) sin tabla de contadores (§8.3.8).';

create index post_votes_user_id_created_at_idx
  on public.post_votes (user_id, created_at desc);

alter table public.post_votes enable row level security;

revoke all on table public.post_votes from anon, authenticated;
grant select on table public.post_votes to authenticated;

create policy post_votes_select_own
  on public.post_votes
  for select
  to authenticated
  using (user_id = (select auth.uid()));

comment on policy post_votes_select_own on public.post_votes is
  'Cada usuario ve solamente sus propios votos: es lo justo para renderizar el estado "ya votaste" y nada más. No hay política de insert/update/delete: se escribe por toggle_post_vote.';


-- -----------------------------------------------------------------------------
-- comment_votes
-- -----------------------------------------------------------------------------

create table public.comment_votes (
  comment_id bigint not null references public.comments(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

comment on table public.comment_votes is
  'Upvotes de comentarios, uno por usuario por comentario (PK compuesta). Misma forma y misma postura que post_votes; escribe solo la RPC toggle_comment_vote.';

comment on column public.comment_votes.comment_id is
  'Comentario votado. ON DELETE CASCADE: la purga física del comentario se lleva sus votos.';
comment on column public.comment_votes.user_id is
  'Votante; visible únicamente para sí mismo.';
comment on column public.comment_votes.created_at is
  'Momento del voto; ventana de límite de tasa contada por el índice (user_id, created_at desc).';

create index comment_votes_user_id_created_at_idx
  on public.comment_votes (user_id, created_at desc);

alter table public.comment_votes enable row level security;

revoke all on table public.comment_votes from anon, authenticated;
grant select on table public.comment_votes to authenticated;

create policy comment_votes_select_own
  on public.comment_votes
  for select
  to authenticated
  using (user_id = (select auth.uid()));

comment on policy comment_votes_select_own on public.comment_votes is
  'Cada usuario ve solamente sus propios votos. Sin políticas de escritura: se escribe por toggle_comment_vote.';


-- -----------------------------------------------------------------------------
-- materia_follows — la única tabla escribible por política (§8.3.4)
-- -----------------------------------------------------------------------------

create table public.materia_follows (
  user_id    uuid not null references public.profiles(id) on delete restrict,
  materia_id bigint not null references public.materias(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (user_id, materia_id)
);

comment on table public.materia_follows is
  'Materias que sigue cada usuario: alimenta el feed "Mis materias" y el contador de seguidores de la página de materia. Es la única tabla del esquema que se escribe por política y no por RPC (§8.3.4): un follow es una fila, idempotente, sin contadores cacheados, sin dimensión de anonimato y sin sensibilidad a límites de tasa. El conteo de seguidores se resuelve con un count(*) indexado en la página de materia — no hay columna cacheada porque las visitas a materias son mucho más raras que las filas de feed. Son datos de preferencia, no contenido: delete_account los borra (§8.7).';

comment on column public.materia_follows.user_id is
  'Quien sigue. Las políticas obligan a que sea siempre auth.uid(): nadie puede leer ni escribir follows ajenos.';
comment on column public.materia_follows.materia_id is
  'Materia seguida. ON DELETE RESTRICT contra el catálogo: una materia con seguidores no se borra por accidente (las correcciones de catálogo son migraciones).';
comment on column public.materia_follows.created_at is
  'Desde cuándo la sigue.';

-- PK (user_id, materia_id) cubre "mis materias"; este índice cubre el conteo
-- de seguidores y la búsqueda inversa por materia (§8.3.4).
create index materia_follows_materia_id_idx
  on public.materia_follows (materia_id);

alter table public.materia_follows enable row level security;

revoke all on table public.materia_follows from anon, authenticated;
grant select, insert, delete on table public.materia_follows to authenticated;

create policy materia_follows_select_own
  on public.materia_follows
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy materia_follows_insert_own
  on public.materia_follows
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy materia_follows_delete_own
  on public.materia_follows
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

comment on policy materia_follows_select_own on public.materia_follows is
  'A quién sigue cada uno es privado: solo el propio usuario lee sus filas.';
comment on policy materia_follows_insert_own on public.materia_follows is
  'Seguir: inserción de una fila propia. La acción usa on conflict do nothing para que seguir dos veces sea idempotente.';
comment on policy materia_follows_delete_own on public.materia_follows is
  'Dejar de seguir: borrado físico de la fila propia. No hay política de update: una fila de follow no tiene nada que actualizar.';
