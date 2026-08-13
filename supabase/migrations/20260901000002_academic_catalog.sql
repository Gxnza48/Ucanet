-- =============================================================================
-- 0002 — Catálogo académico
-- =============================================================================
-- Implementa PART 8 §8.3.1 completo (universidades, sedes, facultades, carreras,
-- materias, plan_materias) más los índices de búsqueda de §8.6.
--
-- Reglas que rigen este archivo:
--   * tenet 1 (RLS everywhere): las seis tablas habilitan RLS. Como el catálogo
--     es público (D5, §8.3.9), las seis llevan la política `read_all`.
--   * §8.2.6 (deny first, grant per object): la migración 0001 revocó los
--     privilegios por defecto de anon/authenticated en el esquema public. Una
--     política sin GRANT no alcanza: cada tabla legible necesita su
--     `grant select` explícito, y acá está.
--   * §8.3.1: el catálogo no se escribe nunca desde la aplicación. Altas,
--     correcciones y fusiones entran por migración o por el seed idempotente
--     (§8.10.2). Por eso ninguna tabla recibe grants de escritura ni políticas
--     de insert/update/delete: la ausencia es deliberada.
--   * Toda FK hacia el catálogo es ON DELETE RESTRICT: mientras exista contenido
--     colgando, borrar una fila del catálogo es imposible por construcción.
--   * §8.2.2: nada de tipos enum; texto + CHECK con nombre.
--
-- Depende de 0001: configuración de búsqueda `public.es` y `public.f_unaccent()`.
-- Forward-only: una vez aplicada, esta migración no se edita (§8.10.3).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Helper: concatenación IMMUTABLE de arreglos de texto
-- -----------------------------------------------------------------------------
-- pg_catalog.array_to_string() está declarada STABLE (usa la función de salida
-- del tipo de elemento, que para algunos tipos depende de GUCs como TimeZone).
-- Postgres exige funciones IMMUTABLE en la expresión de una columna generada, así
-- que la función cruda no puede usarse dentro de materias.search. Para text[] la
-- conversión es la identidad y por lo tanto es genuinamente inmutable: este
-- envoltorio lo declara, con el mismo criterio con el que §8.6 envuelve
-- extensions.unaccent() dentro de public.f_unaccent().
create or replace function public.f_array_to_string(p_values text[], p_sep text)
returns text
language sql
immutable
parallel safe
as $$
  select pg_catalog.array_to_string(coalesce(p_values, '{}'::text[]), p_sep)
$$;

comment on function public.f_array_to_string(text[], text) is
  'Envoltorio IMMUTABLE de array_to_string para text[]. Existe únicamente para que la columna generada materias.search sea legal en Postgres (§8.6). No accede a datos. Debe seguir siendo ejecutable por el rol que corre migraciones y seeds, que es su dueño.';

-- Función auxiliar interna: ningún rol de aplicación la invoca (el catálogo solo
-- se escribe desde migraciones y seeds, que corren como el dueño de la función).
revoke execute on function public.f_array_to_string(text[], text) from public, anon, authenticated;


-- -----------------------------------------------------------------------------
-- universidades
-- -----------------------------------------------------------------------------
create table public.universidades (
  id          bigint generated always as identity primary key,
  slug        text not null unique
              constraint universidades_slug_check
              check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  nombre      text not null
              constraint universidades_nombre_check
              check (char_length(nombre) between 2 and 160),
  sigla       text null
              constraint universidades_sigla_check
              check (char_length(sigla) <= 20),
  created_at  timestamptz not null default now()
);

comment on table public.universidades is
  'Raíz de la cadena académica universidades > sedes > facultades > carreras > materias (§8.8). En MVP tiene una sola fila (Pontificia Universidad Católica Argentina). Nunca se borra: las correcciones entran por migración o seed.';
comment on column public.universidades.slug is
  'Identidad pública y estable de la universidad. Es la clave de conflicto del seed idempotente (§8.10.2): minúsculas, sin acentos, con guiones, hasta 80 caracteres.';
comment on column public.universidades.sigla is
  'Sigla institucional para mostrar en la UI, por ejemplo UCA. Opcional.';

alter table public.universidades enable row level security;

create policy read_all on public.universidades
  for select
  to anon, authenticated
  using (true);

revoke all on table public.universidades from anon, authenticated;
grant select on table public.universidades to anon, authenticated;


-- -----------------------------------------------------------------------------
-- sedes
-- -----------------------------------------------------------------------------
create table public.sedes (
  id              bigint generated always as identity primary key,
  universidad_id  bigint not null references public.universidades(id) on delete restrict,
  slug            text not null unique
                  constraint sedes_slug_check
                  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  nombre          text not null
                  constraint sedes_nombre_check
                  check (char_length(nombre) between 2 and 160),
  ciudad          text not null
                  constraint sedes_ciudad_check
                  check (char_length(ciudad) <= 120),
  direccion       text null
                  constraint sedes_direccion_check
                  check (char_length(direccion) <= 200),
  created_at      timestamptz not null default now()
);

comment on table public.sedes is
  'Campus físico de una universidad. En MVP tiene una sola fila (Campus Rosario, APÉNDICE A §C.1). Nunca se borra desde la aplicación.';
comment on column public.sedes.universidad_id is
  'Universidad a la que pertenece la sede. ON DELETE RESTRICT: no se puede borrar una universidad con sedes.';
comment on column public.sedes.slug is
  'Identidad pública y estable de la sede; clave de conflicto del seed idempotente.';
comment on column public.sedes.ciudad is
  'Ciudad de la sede. Se muestra en la UI y sirve para desambiguar cuando haya más de un campus.';
comment on column public.sedes.direccion is
  'Dirección postal de la sede. Opcional; solo dato de contexto, no se usa en ninguna consulta.';

create index idx_sedes_universidad_id on public.sedes (universidad_id);

alter table public.sedes enable row level security;

create policy read_all on public.sedes
  for select
  to anon, authenticated
  using (true);

revoke all on table public.sedes from anon, authenticated;
grant select on table public.sedes to anon, authenticated;


-- -----------------------------------------------------------------------------
-- facultades
-- -----------------------------------------------------------------------------
create table public.facultades (
  id          bigint generated always as identity primary key,
  sede_id     bigint not null references public.sedes(id) on delete restrict,
  slug        text not null unique
              constraint facultades_slug_check
              check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  nombre      text not null
              constraint facultades_nombre_check
              check (char_length(nombre) between 2 and 200),
  created_at  timestamptz not null default now()
);

comment on table public.facultades is
  'Facultad como unidad organizativa de una sede. En MVP son 3 filas (APÉNDICE A §C.2) y cada una tiene su página pública /facultades/[slug] (D7). Nunca se borra desde la aplicación.';
comment on column public.facultades.sede_id is
  'Sede a la que pertenece la facultad. ON DELETE RESTRICT. Si la universidad unificara facultades entre sedes, el remodelado se hace por migración: el slug es la identidad duradera.';
comment on column public.facultades.slug is
  'Identidad pública y estable de la facultad; aparece en la URL /facultades/[slug] y es la clave de conflicto del seed.';

create index idx_facultades_sede_id on public.facultades (sede_id);

alter table public.facultades enable row level security;

create policy read_all on public.facultades
  for select
  to anon, authenticated
  using (true);

revoke all on table public.facultades from anon, authenticated;
grant select on table public.facultades to anon, authenticated;


-- -----------------------------------------------------------------------------
-- carreras
-- -----------------------------------------------------------------------------
create table public.carreras (
  id             bigint generated always as identity primary key,
  facultad_id    bigint not null references public.facultades(id) on delete restrict,
  slug           text not null unique
                 constraint carreras_slug_check
                 check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  nombre         text not null
                 constraint carreras_nombre_check
                 check (char_length(nombre) between 2 and 200),
  nivel          text not null default 'grado'
                 constraint carreras_nivel_check
                 check (nivel in ('pregrado','grado','posgrado')),
  duracion_anios smallint null
                 constraint carreras_duracion_anios_check
                 check (duracion_anios between 1 and 8),
  created_at     timestamptz not null default now(),
  search         tsvector generated always as (to_tsvector('public.es', nombre)) stored
);

comment on table public.carreras is
  'Carrera de grado o posgrado: el ancla de cohorte (D1) y una página de navegación primaria /carreras/[slug] (D7). En MVP son unas 14 filas (APÉNDICE A §C.3). Nunca se borra desde la aplicación.';
comment on column public.carreras.facultad_id is
  'Facultad que dicta la carrera. ON DELETE RESTRICT.';
comment on column public.carreras.slug is
  'Identidad pública y estable de la carrera; aparece en la URL y es la clave de conflicto del seed. Único a nivel global (§8.8: ante colisión entre universidades se prefija al sembrar, nunca se reescriben URLs vigentes).';
comment on column public.carreras.nivel is
  'Nivel académico. Vocabulario cerrado por CHECK, no por tipo enum (§8.2.2): pregrado, grado, posgrado.';
comment on column public.carreras.duracion_anios is
  'Duración nominal del plan en años, para mostrar en la ficha de la carrera. Nullable porque el APÉNDICE A no la verifica para todas las carreras.';
comment on column public.carreras.search is
  'Vector FTS del nombre con la configuración public.es (español + unaccent, §8.6). Columna generada almacenada: se mantiene sola en cada UPDATE. Si alguna vez cambia la configuración public.es, la migración que la cambie debe reescribir esta columna y reindexar.';

create index idx_carreras_facultad_id on public.carreras (facultad_id);
create index idx_carreras_search on public.carreras using gin (search);

-- Typeahead (§8.6, PART 13 §13.6): prefijo sobre el nombre sin acentos y en
-- minúsculas. text_pattern_ops es lo que habilita LIKE 'algebra%' con una
-- collation que no es C. Sin pg_trgm en MVP (§0.5-R21).
create index idx_carreras_nombre_prefix on public.carreras (public.f_unaccent(lower(nombre)) text_pattern_ops);

alter table public.carreras enable row level security;

create policy read_all on public.carreras
  for select
  to anon, authenticated
  using (true);

revoke all on table public.carreras from anon, authenticated;
grant select on table public.carreras to anon, authenticated;


-- -----------------------------------------------------------------------------
-- materias
-- -----------------------------------------------------------------------------
create table public.materias (
  id          bigint generated always as identity primary key,
  slug        text not null unique
              constraint materias_slug_check
              check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  nombre      text not null
              constraint materias_nombre_check
              check (char_length(nombre) between 2 and 160),
  descripcion text null
              constraint materias_descripcion_check
              check (char_length(descripcion) <= 2000),
  aliases     text[] not null default '{}',
  created_at  timestamptz not null default now(),
  search      tsvector generated always as (
                setweight(to_tsvector('public.es', nombre), 'A') ||
                setweight(to_tsvector('public.es', public.f_array_to_string(aliases, ' ')), 'B') ||
                setweight(to_tsvector('public.es', coalesce(descripcion, '')), 'C')
              ) stored
);

comment on table public.materias is
  'La unidad de permanencia (D1): una página pública duradera por materia, con slug único global (D7). Una materia es una página de comunidad, no una fila de plan: la pertenencia a un plan, el año, el cuatrimestre y el código oficial viven en plan_materias, porque la misma materia puede estar en varios planes. Nunca se borra: las fusiones se hacen por migración repuntando FK y redirigiendo slugs (PART 23).';
comment on column public.materias.slug is
  'Identidad pública y estable de la materia; aparece en /materias/[slug] y es la clave de conflicto del seed. Único a nivel global: si dos carreras comparten nombre pero no programa, se siembran materias separadas con slug calificado por carrera.';
comment on column public.materias.descripcion is
  'Descripción editorial breve de la materia. Entra al vector de búsqueda con peso C.';
comment on column public.materias.aliases is
  'Nombres coloquiales que los estudiantes efectivamente escriben (consti para Derecho Constitucional). Alimenta el typeahead y entra al vector de búsqueda con peso B (§0.5-R13). Por defecto arreglo vacío; se siembra desde el APÉNDICE A.';
comment on column public.materias.search is
  'Vector FTS con la configuración public.es (§8.6). Pesos: nombre A, aliases B, descripcion C. Columna generada almacenada; si cambia la configuración public.es hay que reescribirla y reindexar.';

create index idx_materias_search on public.materias using gin (search);

-- Typeahead (§8.6, PART 13 §13.6). El prefijo sobre aliases se resuelve sin
-- índice a propósito: son unas 110 filas y un scan secuencial del catálogo es
-- irrelevante frente a la complejidad de indexar prefijos dentro de un arreglo.
create index idx_materias_nombre_prefix on public.materias (public.f_unaccent(lower(nombre)) text_pattern_ops);

alter table public.materias enable row level security;

create policy read_all on public.materias
  for select
  to anon, authenticated
  using (true);

revoke all on table public.materias from anon, authenticated;
grant select on table public.materias to anon, authenticated;


-- -----------------------------------------------------------------------------
-- plan_materias
-- -----------------------------------------------------------------------------
create table public.plan_materias (
  carrera_id   bigint not null references public.carreras(id) on delete restrict,
  materia_id   bigint not null references public.materias(id) on delete restrict,
  plan         text not null
               constraint plan_materias_plan_check
               check (char_length(plan) <= 20),
  anio         smallint not null
               constraint plan_materias_anio_check
               check (anio between 1 and 8),
  cuatrimestre smallint not null
               constraint plan_materias_cuatrimestre_check
               check (cuatrimestre in (0, 1, 2)),
  codigo       text null
               constraint plan_materias_codigo_check
               check (char_length(codigo) <= 20),
  optativa     boolean not null default false,
  created_at   timestamptz not null default now(),
  primary key (carrera_id, plan, materia_id)
);

comment on table public.plan_materias is
  'Mapeo carrera <-> materia con versionado de plan (APÉNDICE A §E.3: en Abogacía conviven los planes 2013 y 2020). Renderiza la grilla del plan de estudios en la página de carrera y resuelve materias de mi carrera para el feed (PART 12). Se corrige por migración o reejecutando el seed, nunca desde la aplicación.';
comment on column public.plan_materias.carrera_id is
  'Carrera del plan. ON DELETE RESTRICT.';
comment on column public.plan_materias.materia_id is
  'Materia incluida en el plan. ON DELETE RESTRICT.';
comment on column public.plan_materias.plan is
  'Versión del plan de estudios como texto libre acotado: 2013, 2017, 2020. Forma parte de la clave primaria porque la misma materia puede estar en varios planes de la misma carrera con distinto año y código.';
comment on column public.plan_materias.anio is
  'Año de la carrera en el que se cursa la materia según este plan (1 a 8).';
comment on column public.plan_materias.cuatrimestre is
  'Cuatrimestre de cursada: 1, 2, o 0 para materias anuales.';
comment on column public.plan_materias.codigo is
  'Código oficial de la materia dentro de este plan. Depende del plan, por eso vive acá y no en materias.';
comment on column public.plan_materias.optativa is
  'True si la materia es optativa dentro del plan. La grilla del plan de estudios las separa de las obligatorias.';

-- Búsqueda inversa: en qué carreras se estudia esta materia.
create index idx_plan_materias_materia_id on public.plan_materias (materia_id);

alter table public.plan_materias enable row level security;

create policy read_all on public.plan_materias
  for select
  to anon, authenticated
  using (true);

revoke all on table public.plan_materias from anon, authenticated;
grant select on table public.plan_materias to anon, authenticated;
