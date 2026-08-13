-- =============================================================================
-- 02_grants — meta-test de la matriz de acceso (PART 8 §8.3.9)
-- =============================================================================
-- §8.2.6 invierte los privilegios por defecto de Supabase: negar primero,
-- otorgar por objeto. Este archivo afirma las dos mitades de esa decisión
-- (D14.2 — permitir Y denegar):
--
--   DENIEGA  las nueve tablas de contenido e identidad no tienen SELECT para
--            anon ni para authenticated. Ni siquiera para el autor de la fila:
--            un autor lee su propio contenido por la vista, como todo el mundo.
--   PERMITE  las cinco vistas _public y las seis tablas del catálogo sí lo
--            tienen, que es todo lo que la aplicación necesita para renderizar.
--
-- Dos afirmaciones de cierre miran la matriz entera en vez de tabla por tabla:
-- anon solo puede leer el catálogo, y authenticated solo las veinte tablas de
-- §8.3.9. Si mañana alguien agrega un `grant select` de más, ahí se rompe.
-- =============================================================================
begin;
set local search_path = public, extensions, tests;

select plan(45);


-- -----------------------------------------------------------------------------
-- A. Las nueve tablas cerradas: ni anon ni authenticated leen (18 afirmaciones)
-- -----------------------------------------------------------------------------
select ok(not has_table_privilege('anon', 'public.posts', 'select'),
          'anon no puede leer la tabla posts');
select ok(not has_table_privilege('authenticated', 'public.posts', 'select'),
          'authenticated no puede leer la tabla posts (se lee por posts_public)');

select ok(not has_table_privilege('anon', 'public.comments', 'select'),
          'anon no puede leer la tabla comments');
select ok(not has_table_privilege('authenticated', 'public.comments', 'select'),
          'authenticated no puede leer la tabla comments (se lee por comments_public)');

select ok(not has_table_privilege('anon', 'public.resources', 'select'),
          'anon no puede leer la tabla resources');
select ok(not has_table_privilege('authenticated', 'public.resources', 'select'),
          'authenticated no puede leer la tabla resources (se lee por resources_public)');

select ok(not has_table_privilege('anon', 'public.resource_files', 'select'),
          'anon no puede leer resource_files (ahí vive storage_path)');
select ok(not has_table_privilege('authenticated', 'public.resource_files', 'select'),
          'authenticated no puede leer resource_files: la ruta del objeto en R2 no sale de la base');

select ok(not has_table_privilege('anon', 'public.anon_aliases', 'select'),
          'anon no puede leer anon_aliases');
select ok(not has_table_privilege('authenticated', 'public.anon_aliases', 'select'),
          'authenticated no puede leer anon_aliases: el mapeo autor↔hilo no se emite jamás');

select ok(not has_table_privilege('anon', 'public.handle_history', 'select'),
          'anon no puede leer handle_history');
select ok(not has_table_privilege('authenticated', 'public.handle_history', 'select'),
          'authenticated no puede leer handle_history: no hay historial público de seudónimos (C4)');

select ok(not has_table_privilege('anon', 'public.handle_blocklist', 'select'),
          'anon no puede leer handle_blocklist');
select ok(not has_table_privilege('authenticated', 'public.handle_blocklist', 'select'),
          'authenticated no puede leer handle_blocklist');

select ok(not has_table_privilege('anon', 'public.download_log', 'select'),
          'anon no puede leer download_log');
select ok(not has_table_privilege('authenticated', 'public.download_log', 'select'),
          'authenticated no puede leer download_log: quién descargó qué es inaccesible por diseño');

select ok(not has_table_privilege('anon', 'public.waitlist', 'select'),
          'anon no puede leer waitlist');
select ok(not has_table_privilege('authenticated', 'public.waitlist', 'select'),
          'authenticated no puede leer waitlist: es PII pura, encierro máximo');


-- -----------------------------------------------------------------------------
-- B. Las cinco vistas _public sí se leen (10 afirmaciones)
-- -----------------------------------------------------------------------------
select ok(has_table_privilege('anon', 'public.posts_public', 'select'),
          'anon lee posts_public');
select ok(has_table_privilege('authenticated', 'public.posts_public', 'select'),
          'authenticated lee posts_public');

select ok(has_table_privilege('anon', 'public.comments_public', 'select'),
          'anon lee comments_public');
select ok(has_table_privilege('authenticated', 'public.comments_public', 'select'),
          'authenticated lee comments_public');

select ok(has_table_privilege('anon', 'public.resources_public', 'select'),
          'anon lee resources_public');
select ok(has_table_privilege('authenticated', 'public.resources_public', 'select'),
          'authenticated lee resources_public');

select ok(has_table_privilege('anon', 'public.resource_files_public', 'select'),
          'anon lee resource_files_public');
select ok(has_table_privilege('authenticated', 'public.resource_files_public', 'select'),
          'authenticated lee resource_files_public');

select ok(has_table_privilege('anon', 'public.profiles_public', 'select'),
          'anon lee profiles_public');
select ok(has_table_privilege('authenticated', 'public.profiles_public', 'select'),
          'authenticated lee profiles_public');


-- -----------------------------------------------------------------------------
-- C. El catálogo académico es público (12 afirmaciones)
-- -----------------------------------------------------------------------------
select ok(has_table_privilege('anon', 'public.universidades', 'select'),
          'anon lee universidades');
select ok(has_table_privilege('authenticated', 'public.universidades', 'select'),
          'authenticated lee universidades');

select ok(has_table_privilege('anon', 'public.sedes', 'select'), 'anon lee sedes');
select ok(has_table_privilege('authenticated', 'public.sedes', 'select'),
          'authenticated lee sedes');

select ok(has_table_privilege('anon', 'public.facultades', 'select'), 'anon lee facultades');
select ok(has_table_privilege('authenticated', 'public.facultades', 'select'),
          'authenticated lee facultades');

select ok(has_table_privilege('anon', 'public.carreras', 'select'), 'anon lee carreras');
select ok(has_table_privilege('authenticated', 'public.carreras', 'select'),
          'authenticated lee carreras');

select ok(has_table_privilege('anon', 'public.materias', 'select'), 'anon lee materias');
select ok(has_table_privilege('authenticated', 'public.materias', 'select'),
          'authenticated lee materias');

select ok(has_table_privilege('anon', 'public.plan_materias', 'select'),
          'anon lee plan_materias');
select ok(has_table_privilege('authenticated', 'public.plan_materias', 'select'),
          'authenticated lee plan_materias');


-- -----------------------------------------------------------------------------
-- D. Las vistas son de solo lectura (1 afirmación)
-- -----------------------------------------------------------------------------
select is_empty(
  $$
    select v.t || ' / ' || r.rol
      from (values ('posts_public'),('comments_public'),('resources_public'),
                   ('resource_files_public'),('profiles_public')) v(t)
     cross join (values ('anon'),('authenticated')) r(rol)
     where has_table_privilege(r.rol::name, 'public.' || v.t, 'INSERT')
        or has_table_privilege(r.rol::name, 'public.' || v.t, 'UPDATE')
        or has_table_privilege(r.rol::name, 'public.' || v.t, 'DELETE')
  $$,
  'las vistas _public son de solo lectura para los roles de la aplicación'
);


-- -----------------------------------------------------------------------------
-- E. profiles: cerrada para anon, autolectura para authenticated (2 afirmaciones)
-- -----------------------------------------------------------------------------
select ok(not has_table_privilege('anon', 'public.profiles', 'select'),
          'anon no lee profiles: los perfiles públicos salen por profiles_public');
select ok(has_table_privilege('authenticated', 'public.profiles', 'select'),
          'authenticated sí tiene SELECT sobre profiles (la política lo acota a su propia fila)');


-- -----------------------------------------------------------------------------
-- F. La matriz completa (2 afirmaciones)
-- -----------------------------------------------------------------------------
select is_empty(
  $$
    select c.relname::text
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
       and has_table_privilege('anon', c.oid, 'SELECT')
       and c.relname not in ('universidades','sedes','facultades','carreras',
                             'materias','plan_materias')
  $$,
  'anon solo tiene SELECT sobre el catálogo académico y sobre ninguna otra tabla'
);

select is_empty(
  $$
    select c.relname::text
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
       and has_table_privilege('authenticated', c.oid, 'SELECT')
       and c.relname not in (
         'universidades','sedes','facultades','carreras','materias','plan_materias',
         'invites','profiles','post_votes','comment_votes','materia_follows',
         'resource_votes','reports','mod_actions','user_restrictions','appeals',
         'notifications','events','search_queries','app_settings')
  $$,
  'authenticated solo tiene SELECT sobre las veinte tablas de la matriz de §8.3.9'
);


select * from finish();
rollback;
