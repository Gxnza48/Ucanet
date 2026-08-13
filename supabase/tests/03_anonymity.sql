-- =============================================================================
-- 03_anonymity — LA prueba central: la promesa del producto (D3, D14.5)
-- =============================================================================
-- PART 25 §25.1, ítems 1 a 5. Si algo de este archivo falla, uca.net no puede
-- salir a producción: el anonimato es la razón por la que un estudiante escribe
-- lo que no escribiría con su nombre.
--
-- Lo que se afirma, en orden:
--   A. las vistas anulan el autor del contenido anónimo y solo del anónimo;
--   B. el alias por hilo es estable dentro del hilo y NO correlacionable entre
--      hilos — el mismo autor es "Anónimo 1" en uno y "Anónimo 2" en otro;
--   C. anon_aliases es ilegible para todo rol de aplicación, y las tablas base
--      también lo son, incluso para el propio autor de la fila;
--   D. un visitante sin cuenta ve el hilo anónimo sin autor y el firmado con
--      autor (la mitad "permite" de D14.2);
--   E. estructura: ninguna vista _public expone author_id, no existe columna
--      email en ningún objeto de public, y las cinco vistas son security_barrier
--      y no security_invoker (que es el mecanismo del que depende todo lo demás).
--
-- Escenario:
--   P1 'pgtapanon1' — publicación ANÓNIMA de ana (alias 0 reservado al autor)
--   P2 'pgtapfirm1' — publicación FIRMADA de ana
--   En P1: bruno comenta anónimo dos veces y firmado una; cami comenta anónimo.
--   En P2: cami comenta anónimo primero, bruno después.
--   Resultado esperado: bruno = alias 1 en P1 y alias 2 en P2.
-- =============================================================================
begin;
set local search_path = public, extensions, tests;

select plan(27);


-- -----------------------------------------------------------------------------
-- Fixtures
-- -----------------------------------------------------------------------------
select tests.create_user('pgtap_ana');
select tests.create_user('pgtap_bruno');
select tests.create_user('pgtap_cami');

-- Las publicaciones se insertan con public_id determinista para poder nombrarlas
-- en las afirmaciones; los comentarios sí pasan por la RPC, porque el mecanismo
-- bajo prueba (asignación de alias) vive en create_comment.
insert into public.posts (public_id, author_id, body, is_anonymous)
values ('pgtapanon1', tests.user_id('pgtap_ana'), 'hilo anonimo de ana', true);

-- create_post reserva el alias 0 para el autor de una publicación anónima
-- ("Anónimo (autor)", §8.3.4): se reproduce acá el mismo estado.
insert into public.anon_aliases (post_id, author_id, alias_num)
values ((select id from public.posts where public_id = 'pgtapanon1'),
        tests.user_id('pgtap_ana'), 0);

insert into public.posts (public_id, author_id, body, is_anonymous)
values ('pgtapfirm1', tests.user_id('pgtap_ana'), 'hilo firmado de ana', false);

select tests.authenticate_as('pgtap_bruno');
select public.create_comment('pgtapanon1', null, 'bruno anonimo uno', true);
select public.create_comment('pgtapanon1', null, 'bruno anonimo dos', true);
select public.create_comment('pgtapanon1', null, 'bruno firmado', false);

select tests.authenticate_as('pgtap_cami');
select public.create_comment('pgtapanon1', null, 'cami anonimo', true);
select public.create_comment('pgtapfirm1', null, 'cami anonimo en el otro hilo', true);

select tests.authenticate_as('pgtap_bruno');
select public.create_comment('pgtapfirm1', null, 'bruno anonimo en el otro hilo', true);

select tests.clear_authentication();


-- -----------------------------------------------------------------------------
-- A. Las vistas anulan al autor del contenido anónimo (5)
-- -----------------------------------------------------------------------------
select is((select p.author_handle from public.posts_public p where p.public_id = 'pgtapanon1'),
          null::text,
          'posts_public no expone ningún autor en una publicación anónima');

select ok((select p.is_anonymous from public.posts_public p where p.public_id = 'pgtapanon1'),
          'posts_public sí marca la publicación como anónima: la etiqueta es pública, la identidad no');

select is((select p.author_handle from public.posts_public p where p.public_id = 'pgtapfirm1'),
          'pgtap_ana',
          'posts_public expone el seudónimo cuando la publicación está firmada (mitad "permite")');

select hasnt_column('public', 'posts_public', 'author_id',
                    'posts_public no tiene columna author_id para ninguna fila, anónima o no');

select hasnt_column('public', 'comments_public', 'author_id',
                    'comments_public no tiene columna author_id');


-- -----------------------------------------------------------------------------
-- B. El alias por hilo: estable adentro, independiente afuera (8)
-- -----------------------------------------------------------------------------
select is((select c.author_handle from public.comments_public c where c.body = 'bruno anonimo uno'),
          null::text,
          'un comentario anónimo no trae seudónimo de autor');

select is((select c.anon_alias_num::int from public.comments_public c where c.body = 'bruno anonimo uno'),
          1,
          'el primer comentarista anónimo del hilo recibe el alias 1 (el 0 es del autor de la publicación)');

select is((select c.anon_alias_num::int from public.comments_public c where c.body = 'bruno anonimo dos'),
          1,
          'el mismo autor anónimo conserva su alias dentro del hilo: la conversación sigue siendo coherente');

select is((select c.anon_alias_num::int from public.comments_public c where c.body = 'cami anonimo'),
          2,
          'otro autor anónimo del mismo hilo recibe otro número');

select is((select c.author_handle from public.comments_public c where c.body = 'bruno firmado'),
          'pgtap_bruno',
          'un comentario firmado del mismo autor sí muestra su seudónimo');

select is((select c.anon_alias_num::int from public.comments_public c where c.body = 'bruno firmado'),
          null::int,
          'un comentario firmado no trae número de alias');

select is((select c.anon_alias_num::int from public.comments_public c
            where c.body = 'bruno anonimo en el otro hilo'),
          2,
          'en otro hilo el alias se asigna de cero, por orden de aparición');

select ok(tests.alias_num('pgtapanon1', 'pgtap_bruno')
          <> tests.alias_num('pgtapfirm1', 'pgtap_bruno'),
          'el mismo autor anónimo NO es correlacionable entre hilos: alias distinto en cada uno');


-- -----------------------------------------------------------------------------
-- C. El mapeo y las tablas base son inalcanzables (4)
-- -----------------------------------------------------------------------------
select tests.authenticate_as_anon();

select throws_ok('select 1 from public.anon_aliases', '42501');

select tests.authenticate_as('pgtap_ana');

select throws_ok('select 1 from public.anon_aliases', '42501');

-- Ni siquiera el autor de la fila puede leer la tabla base: lee su contenido
-- por la vista, como cualquiera (PART 25 §25.1 ítem 2).
select throws_ok('select 1 from public.posts', '42501');

select throws_ok('select 1 from public.comments', '42501');


-- -----------------------------------------------------------------------------
-- D. Lectura pública desde afuera (2)
-- -----------------------------------------------------------------------------
select tests.authenticate_as_anon();

select is((select p.author_handle from public.posts_public p where p.public_id = 'pgtapanon1'),
          null::text,
          'un visitante sin cuenta ve el hilo anónimo y no ve autor');

select is((select p.author_handle from public.posts_public p where p.public_id = 'pgtapfirm1'),
          'pgtap_ana',
          'un visitante sin cuenta sí ve el autor del hilo firmado');

select tests.clear_authentication();


-- -----------------------------------------------------------------------------
-- E. Estructura: la anonimidad está en el esquema, no en la aplicación (8)
-- -----------------------------------------------------------------------------
select hasnt_column('public', 'profiles', 'email',
                    'profiles no tiene columna email: el correo vive solo en auth.users');

select hasnt_column('public', 'profiles_public', 'email',
                    'profiles_public tampoco puede exponer un correo que no existe en su origen');

select is_empty(
  $$
    select table_name || '.' || column_name
      from information_schema.columns
     where table_schema = 'public'
       and table_name in ('posts_public','comments_public','resources_public',
                          'resource_files_public','profiles_public')
       and column_name in ('author_id','author_uuid','user_id','email')
  $$,
  'ninguna vista _public expone una columna de autoría interna ni de contacto'
);

select is_empty(
  $$
    select c.relname::text
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'v'
       and c.relname in ('posts_public','comments_public','resources_public',
                         'resource_files_public','profiles_public')
       and (coalesce(array_to_string(c.reloptions, ','), '') not like '%security_barrier=true%'
         or coalesce(array_to_string(c.reloptions, ','), '')     like '%security_invoker=true%')
  $$,
  'las cinco vistas son security_barrier y NO security_invoker: el anulado vive dentro de la vista'
);

select ok(
  (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'anon_aliases')
  and not exists (
    select 1 from pg_policy p
     where p.polrelid = 'public.anon_aliases'::regclass),
  'anon_aliases tiene RLS habilitada y cero políticas: es ilegible hoy y por diseño'
);

-- Las tres afirmaciones globales de §25.1 ítem 1: no hay UNA sola fila anónima,
-- en ninguna de las tres vistas de contenido, que traiga seudónimo de autor.
select is_empty(
  $$ select p.public_id from public.posts_public p
      where p.is_anonymous and p.author_handle is not null $$,
  'ninguna fila anónima de posts_public trae seudónimo'
);

select is_empty(
  $$ select c.public_id from public.comments_public c
      where c.is_anonymous and c.author_handle is not null $$,
  'ninguna fila anónima de comments_public trae seudónimo'
);

select is_empty(
  $$ select r.public_id from public.resources_public r
      where r.is_anonymous and r.author_handle is not null $$,
  'ninguna fila anónima de resources_public trae seudónimo'
);


select * from finish();
rollback;
