-- =============================================================================
-- 06_votes — toggle_post_vote / toggle_comment_vote (PART 8 §8.5.4)
-- =============================================================================
-- El voto es up-only (D2: sin downvotes), así que la existencia de la fila ES el
-- voto. Cuatro propiedades que la base tiene que garantizar:
--
--   · el toggle es idempotente: votar, destildar y volver a votar deja UNA fila
--     y score 1, nunca 2 (PART 25 §25.1 ítem 10);
--   · el auto-voto se rechaza, también en contenido anónimo — la autoría existe
--     internamente aunque no se muestre (PART 11 §11.6.3);
--   · el score cacheado queda bien en la misma transacción (§8.2.5);
--   · y el karma NO se mueve en el acto: lo recalcula entero el batch nocturno,
--     que es precisamente lo que impide correlacionar el karma de un contenido
--     anónimo con el instante en que lo votaron (§0.5-R7, C5).
--
-- Cierra con la superficie de acceso: cada uno ve sus votos y nada más, y nadie
-- escribe votos ni scores sin pasar por la RPC.
-- =============================================================================
begin;
set local search_path = public, extensions, tests;

select plan(21);


-- -----------------------------------------------------------------------------
-- Fixtures
-- -----------------------------------------------------------------------------
select tests.create_user('pgtap_ana');
select tests.create_user('pgtap_bruno');
select tests.create_user('pgtap_cami');
select tests.create_user('pgtap_mod1', 'mod');
select tests.create_user('pgtap_susp', 'user', 'suspendido');

insert into public.user_restrictions (user_id, tipo, motivo, created_by, until)
values (tests.user_id('pgtap_susp'), 'suspension', 'Suspensión de prueba pgTAP',
        tests.user_id('pgtap_mod1'), now() + interval '7 days');

insert into public.posts (public_id, author_id, body)
values ('pgtappost1', tests.user_id('pgtap_ana'), 'publicacion votable de ana');

insert into public.posts (public_id, author_id, body, status)
values ('pgtapdel01', tests.user_id('pgtap_ana'), null, 'eliminado_autor');

insert into public.comments (public_id, post_id, author_id, body, depth)
values ('pgtapcmt01',
        (select id from public.posts where public_id = 'pgtappost1'),
        tests.user_id('pgtap_ana'), 'comentario votable de ana', 1);


-- -----------------------------------------------------------------------------
-- A. El toggle es idempotente (6)
-- -----------------------------------------------------------------------------
select tests.authenticate_as('pgtap_bruno');

select is(public.toggle_post_vote('pgtappost1'), 1,
          'el primer voto deja el score en 1');

select is(public.toggle_post_vote('pgtappost1'), 0,
          'el segundo toggle retira el voto y devuelve el score a 0');

select is(public.toggle_post_vote('pgtappost1'), 1,
          'el tercer toggle vuelve a votar: nunca acumula dos votos del mismo usuario');

select tests.clear_authentication();

select is((select count(*)::int from public.post_votes v
            join public.posts p on p.id = v.post_id
           where p.public_id = 'pgtappost1'),
          1,
          'la PK (post_id, user_id) deja una sola fila de voto por usuario');

select tests.authenticate_as('pgtap_cami');

select is(public.toggle_post_vote('pgtappost1'), 2,
          'un segundo votante suma');

select tests.clear_authentication();

select is((select p.score from public.posts p where p.public_id = 'pgtappost1'),
          2,
          'el score cacheado del post quedó en 2 dentro de la misma transacción');


-- -----------------------------------------------------------------------------
-- B. Qué no se puede votar (6)
-- -----------------------------------------------------------------------------
select tests.authenticate_as('pgtap_ana');

select throws_ok('select public.toggle_post_vote(''pgtappost1'')', 'P0001', 'SELF_VOTE',
                 'nadie vota su propia publicación');

select tests.authenticate_as('pgtap_bruno');

select throws_ok('select public.toggle_post_vote(''noexiste00'')',
                 'P0001', 'TARGET_NOT_FOUND',
                 'votar una publicación inexistente corta con TARGET_NOT_FOUND');

select throws_ok('select public.toggle_post_vote(''pgtapdel01'')',
                 'P0001', 'TARGET_NOT_FOUND',
                 'el contenido eliminado no se puede votar');

select is(public.toggle_comment_vote('pgtapcmt01'), 1,
          'un comentario ajeno sí se vota');

select tests.authenticate_as('pgtap_ana');

select throws_ok('select public.toggle_comment_vote(''pgtapcmt01'')',
                 'P0001', 'SELF_VOTE',
                 'tampoco se vota el comentario propio');

select tests.authenticate_as('pgtap_susp');

select throws_ok('select public.toggle_post_vote(''pgtappost1'')', 'P0001', 'RESTRICTED',
                 'una cuenta suspendida no vota (PART 25 §25.1 ítem 11)');


-- -----------------------------------------------------------------------------
-- C. El karma no se mueve con el voto, se mueve de noche (3)
-- -----------------------------------------------------------------------------
select tests.clear_authentication();

select is((select c.score from public.comments c where c.public_id = 'pgtapcmt01'),
          1,
          'el score cacheado del comentario también quedó bien');

select is((select p.karma from public.profiles p where p.id = tests.user_id('pgtap_ana')),
          0,
          'el karma de la autora sigue en 0: los votos NUNCA lo tocan en el acto (§0.5-R7)');

select public.reconcile_counters();

select is((select p.karma from public.profiles p where p.id = tests.user_id('pgtap_ana')),
          3,
          'el recuento nocturno sí lo acredita: 2 votos de publicación + 1 de comentario');


-- -----------------------------------------------------------------------------
-- D. Quién ve y quién escribe los votos (5)
-- -----------------------------------------------------------------------------
select tests.authenticate_as('pgtap_bruno');

select is((select count(*)::int from public.post_votes), 1,
          'cada usuario ve exactamente sus propios votos');

select throws_ok('insert into public.post_votes (post_id, user_id) values (1, ''00000000-0000-0000-0000-000000000000'')',
                 '42501');

select throws_ok('update public.posts set score = 999 where public_id = ''pgtappost1''', '42501');

select tests.authenticate_as('pgtap_cami');

select is_empty(
  $$ select 1 from public.post_votes v where v.user_id = tests.user_id('pgtap_bruno') $$,
  'nadie puede enumerar los votos ajenos: la política solo muestra las filas propias'
);

select tests.authenticate_as_anon();

select throws_ok('select 1 from public.post_votes', '42501');


-- -----------------------------------------------------------------------------
-- E. Y el score baja cuando se retira el voto (1)
-- -----------------------------------------------------------------------------
select tests.authenticate_as('pgtap_cami');

select is(public.toggle_post_vote('pgtappost1'), 1,
          'retirar el voto vuelve a bajar el score cacheado');


select * from finish();
rollback;
