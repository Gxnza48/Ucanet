-- =============================================================================
-- 04_functions_meta — meta-test sobre pg_proc (PART 8 §8.5, reglas uniformes)
-- =============================================================================
-- Las RPC son la superficie de escritura entera del producto (tenet 6), y son
-- SECURITY DEFINER: corren como `postgres` y saltean la RLS por definición. Dos
-- descuidos las convierten en escalada de privilegios:
--
--   1. search_path sin fijar — el atacante planta una tabla en un esquema suyo
--      y la función definer se la come. Por eso todas llevan
--      `set search_path = public, pg_temp`, con pg_temp al final.
--   2. EXECUTE para PUBLIC — las funciones nacen con EXECUTE para PUBLIC, y
--      anon/authenticated son miembros de PUBLIC. Cada función revoca
--      explícitamente y otorga a mano (§8.5 regla 2).
--
-- Este archivo no prueba lo que hace ninguna función: prueba que ninguna esté
-- mal colgada. Las funciones que pertenecen a una extensión (pgtap, pgcrypto)
-- quedan excluidas de los barridos: no son nuestras.
-- =============================================================================
begin;
set local search_path = public, extensions, tests;

select plan(14);


-- -----------------------------------------------------------------------------
-- A. search_path fijado en toda función SECURITY DEFINER (2)
-- -----------------------------------------------------------------------------
select is_empty(
  $$
    select p.oid::regprocedure::text
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prosecdef
       and not exists (select 1 from pg_depend d
                        where d.classid = 'pg_proc'::regclass
                          and d.objid = p.oid and d.deptype = 'e')
       and not exists (select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) c
                        where c like 'search\_path=%')
  $$,
  'toda función SECURITY DEFINER de public tiene search_path fijado'
);

select is_empty(
  $$
    select p.oid::regprocedure::text
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prosecdef
       and not exists (select 1 from pg_depend d
                        where d.classid = 'pg_proc'::regclass
                          and d.objid = p.oid and d.deptype = 'e')
       and not exists (select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) c
                        where c like 'search\_path=%pg\_temp%')
  $$,
  'ese search_path incluye pg_temp: el esquema temporal no queda al frente'
);


-- -----------------------------------------------------------------------------
-- B. Nadie hereda EXECUTE por ser PUBLIC (1)
-- -----------------------------------------------------------------------------
-- proacl null significa "privilegios por defecto", y el default de una función
-- es EXECUTE para PUBLIC: también cuenta como fallo.
select is_empty(
  $$
    select p.oid::regprocedure::text
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and not exists (select 1 from pg_depend d
                        where d.classid = 'pg_proc'::regclass
                          and d.objid = p.oid and d.deptype = 'e')
       and (p.proacl is null
         or exists (select 1 from aclexplode(p.proacl) a
                     where a.grantee = 0 and a.privilege_type = 'EXECUTE'))
  $$,
  'ninguna función de public conserva EXECUTE para PUBLIC (§8.5 regla 2)'
);


-- -----------------------------------------------------------------------------
-- C. Qué puede ejecutar cada rol (5)
-- -----------------------------------------------------------------------------
select is_empty(
  $$
    select p.oid::regprocedure::text
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and not exists (select 1 from pg_depend d
                        where d.classid = 'pg_proc'::regclass
                          and d.objid = p.oid and d.deptype = 'e')
       and has_function_privilege('anon', p.oid, 'EXECUTE')
       and p.proname not in ('search_posts','search_resources','search_catalog',
                             'log_search_query')
  $$,
  'anon solo ejecuta las tres funciones de búsqueda y el registro de telemetría'
);

select is_empty(
  $$
    select f.n from (values ('public.cron_heartbeat()'),
                            ('public.reconcile_counters()'),
                            ('public.purge_retention()')) f(n)
     where has_function_privilege('authenticated', f.n, 'EXECUTE')
  $$,
  'ningún rol alcanzable desde una request ejecuta los trabajos programados'
);

select is_empty(
  $$
    select f.n from (values ('public.cron_heartbeat()'),
                            ('public.reconcile_counters()'),
                            ('public.purge_retention()')) f(n)
     where not has_function_privilege('service_role', f.n, 'EXECUTE')
  $$,
  'los trabajos programados sí los ejecuta service_role (el cron diario)'
);

select ok(not has_function_privilege('anon', 'public.create_post(text,text,text,text,boolean)', 'EXECUTE'),
          'anon no puede publicar');

select ok(has_function_privilege('authenticated', 'public.create_post(text,text,text,text,boolean)', 'EXECUTE'),
          'authenticated sí puede publicar (mitad "permite")');


-- -----------------------------------------------------------------------------
-- D. Helpers internos y utilidades: cerrados a los dos roles (5)
-- -----------------------------------------------------------------------------
select ok(has_function_privilege('anon', 'public.search_posts(text,text,int,int,int,double precision,bigint)', 'EXECUTE'),
          'la búsqueda sí es pública: se puede buscar sin cuenta');

select ok(not has_function_privilege('anon', 'public.nanoid(int)', 'EXECUTE'),
          'anon no ejecuta nanoid()');

select ok(not has_function_privilege('authenticated', 'public.nanoid(int)', 'EXECUTE'),
          'authenticated tampoco ejecuta nanoid(): se invoca desde DEFAULT y desde funciones definer');

select ok(not has_function_privilege('authenticated', 'public.assert_can_write()', 'EXECUTE'),
          'assert_can_write() es un helper interno, no una RPC');

select ok(not has_function_privilege('authenticated', 'public.current_profile()', 'EXECUTE'),
          'current_profile() es un helper interno: el cliente lee su perfil por la política de autolectura');


-- -----------------------------------------------------------------------------
-- E. El contrato de funciones está completo (1)
-- -----------------------------------------------------------------------------
select is_empty(
  $$
    with esperadas(f) as (values
      ('account_tier'),('app_setting'),('assert_can_write'),('assert_handle_ok'),
      ('complete_onboarding'),('create_appeal'),('create_comment'),('create_invite'),
      ('create_post'),('create_report'),('cron_heartbeat'),('current_profile'),
      ('delete_account'),('delete_own_comment'),('delete_own_post'),('delete_own_resource'),
      ('f_array_to_string'),('f_unaccent'),('finalize_upload'),('handle_new_user'),
      ('has_active_restriction'),('is_appeal_appellant'),('log_search_query'),
      ('mod_legal_takedown_resource'),('mod_lock_thread'),('mod_remove_comment'),
      ('mod_remove_post'),('mod_remove_resource'),('mod_resolve_report'),
      ('mod_restore_comment'),('mod_restore_post'),('mod_restore_resource'),
      ('mod_restrict_user'),('mod_reveal_author'),('mod_review_appeal'),
      ('mod_revoke_restriction'),('mod_warn_user'),('nanoid'),('purge_retention'),
      ('raise_immutable'),('rate_limit_for'),('rate_limits'),('reconcile_counters'),
      ('register_download'),('rename_handle'),('request_upload'),('search_catalog'),
      ('search_posts'),('search_resources'),('set_updated_at'),('toggle_comment_vote'),
      ('toggle_post_vote'),('toggle_resource_vote'),('update_own_comment'),('update_own_post')
    )
    select f from esperadas
     where not exists (
       select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = esperadas.f)
  $$,
  'todas las funciones que el contrato de PART 8 §8.5 promete existen en public'
);


select * from finish();
rollback;
