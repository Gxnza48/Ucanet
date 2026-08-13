-- =============================================================================
-- 01_rls_enabled — meta-test del tenet 1: RLS en TODA tabla de public
-- =============================================================================
-- D14.2 / PART 8 §8.1 tenet 1: "RLS enabled on every table, no exceptions".
-- Este archivo no prueba una política concreta: prueba que no exista ninguna
-- tabla sin la pared puesta. Es el test que atrapa la tabla nueva que alguien
-- agrega en 2027 y se olvida de cerrar.
--
-- Las cuatro afirmaciones que lo componen:
--   1. ninguna tabla de public tiene relrowsecurity = false;
--   2. el inventario de tablas es exactamente el que esta suite cubre (una
--      tabla nueva rompe el test a propósito: hay que venir acá y decidir);
--   3. el conjunto de tablas SIN políticas es exactamente el declarado
--      inaccesible (sin política = inaccesible a propósito, tenet 1);
--   4. y 5. la superficie de escritura son las funciones, no los grants
--      (tenet 6): anon no escribe en ninguna tabla y authenticated solo en
--      materia_follows (§8.3.4).
-- =============================================================================
begin;
set local search_path = public, extensions, tests;

select plan(5);


-- 1 ---------------------------------------------------------------------------
select is_empty(
  $$
    select c.relname::text
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind = 'r'
       and not c.relrowsecurity
  $$,
  'tenet 1: toda tabla de public tiene row level security habilitada'
);


-- 2 ---------------------------------------------------------------------------
-- Inventario normativo de PART 8 §8.3 (29 tablas). Si aparece una tabla que no
-- está acá, o desaparece una que sí, este test falla y obliga a revisar la
-- suite entera — que es exactamente lo que tiene que pasar.
select is_empty(
  $$
    with esperadas(t) as (values
      ('anon_aliases'),('app_settings'),('appeals'),('carreras'),('comment_votes'),
      ('comments'),('download_log'),('events'),('facultades'),('handle_blocklist'),
      ('handle_history'),('invites'),('materia_follows'),('materias'),('mod_actions'),
      ('notifications'),('plan_materias'),('post_votes'),('posts'),('profiles'),
      ('reports'),('resource_files'),('resource_votes'),('resources'),('search_queries'),
      ('sedes'),('universidades'),('user_restrictions'),('waitlist')
    ),
    reales(t) as (
      select c.relname::text
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r'
    )
    select d.t from (
      (select t from esperadas except select t from reales)
      union all
      (select t from reales except select t from esperadas)
    ) d(t)
  $$,
  'el inventario de tablas de public es exactamente el que cubre esta suite'
);


-- 3 ---------------------------------------------------------------------------
-- Nueve tablas tienen CERO políticas y eso está declarado en sus COMMENT:
-- posts / comments / resources / resource_files se leen por las vistas _public
-- y se escriben por RPC; anon_aliases, handle_history, handle_blocklist,
-- download_log y waitlist no se tocan desde la aplicación, nunca.
select is_empty(
  $$
    with declaradas(t) as (values
      ('anon_aliases'),('comments'),('download_log'),('handle_blocklist'),
      ('handle_history'),('posts'),('resource_files'),('resources'),('waitlist')
    ),
    sin_politica(t) as (
      select c.relname::text
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r'
         and not exists (select 1 from pg_policy p where p.polrelid = c.oid)
    )
    select d.t from (
      (select t from declaradas except select t from sin_politica)
      union all
      (select t from sin_politica except select t from declaradas)
    ) d(t)
  $$,
  'las tablas sin políticas son exactamente las nueve declaradas inaccesibles a propósito'
);


-- 4 ---------------------------------------------------------------------------
select is_empty(
  $$
    select c.relname::text
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
       and (has_table_privilege('anon', c.oid, 'INSERT')
         or has_table_privilege('anon', c.oid, 'UPDATE')
         or has_table_privilege('anon', c.oid, 'DELETE'))
  $$,
  'anon no escribe en ninguna tabla: la superficie de escritura son las funciones (tenet 6)'
);


-- 5 ---------------------------------------------------------------------------
-- materia_follows es la única tabla escribible por política de todo el esquema
-- (§8.3.4). notifications y app_settings tienen grants de UPDATE por COLUMNA
-- (read_at / value), que has_table_privilege correctamente no cuenta como
-- privilegio de tabla.
select is_empty(
  $$
    select c.relname::text
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
       and c.relname <> 'materia_follows'
       and (has_table_privilege('authenticated', c.oid, 'INSERT')
         or has_table_privilege('authenticated', c.oid, 'UPDATE')
         or has_table_privilege('authenticated', c.oid, 'DELETE'))
  $$,
  'materia_follows es la única tabla que authenticated escribe por política (§8.3.4)'
);


select * from finish();
rollback;
