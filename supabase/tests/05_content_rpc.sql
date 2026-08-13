-- =============================================================================
-- 05_content_rpc — create_post / create_comment (PART 8 §8.5.3)
-- =============================================================================
-- Las reglas que la base tiene que sostener aunque la aplicación entera esté
-- comprometida (D14.9: los límites viven en la función, no en el middleware):
--
--   · profundidad máxima 2 — un solo nivel de respuestas (D2);
--   · un hilo bloqueado no admite comentarios nuevos (§0.5-R5);
--   · los límites de tasa cortan la publicación N+1 de la ventana (§0.5-R6);
--   · una cuenta que no terminó el onboarding (status 'nuevo') no publica;
--   · sin sesión no se publica, y anon ni siquiera puede invocar la función.
--
-- Cada regla se prueba en las dos direcciones (D14.2): la llamada legítima pasa
-- y la ilegítima levanta el código exacto de RPC_ERROR_CODES (lib/errors.ts),
-- que es lo que el servidor traduce a copy es-AR.
--
-- Sobre los tiers: pgtap_bruno nace T2 (8 posts/hora) para poder armar el
-- escenario; pgtap_t0 nace con created_at = now(), o sea T0, que es 1 post por
-- hora — el límite que se prueba.
-- =============================================================================
begin;
set local search_path = public, extensions, tests;

select plan(23);


-- -----------------------------------------------------------------------------
-- Fixtures
-- -----------------------------------------------------------------------------
select tests.create_user('pgtap_ana');
select tests.create_user('pgtap_bruno');
select tests.create_user('pgtap_nuevo', 'user', 'nuevo');
select tests.create_user('pgtap_t0',    'user', 'activo', now());

insert into public.materias (slug, nombre)
values ('pgtap-materia', 'Materia de prueba pgTAP');

-- created_at explícitamente viejo: dentro de una transacción now() es constante,
-- así que sin esto el last_activity_at que escribe create_comment sería idéntico
-- al created_at del hilo y la afirmación sobre el bump no probaría nada.
insert into public.posts (public_id, author_id, body, created_at, last_activity_at)
values ('pgtappost1', tests.user_id('pgtap_ana'), 'hilo abierto de ana',
        now() - interval '2 hours', now() - interval '2 hours');

-- Hilo bloqueado por moderación. Se setea locked_at directo: lo que se prueba
-- acá es la reacción de create_comment, no mod_lock_thread (eso es 07).
insert into public.posts (public_id, author_id, body, locked_at)
values ('pgtaplock1', tests.user_id('pgtap_ana'), 'hilo cerrado por moderacion', now());

insert into public.comments (public_id, post_id, author_id, body, depth)
values ('pgtapcmt01',
        (select id from public.posts where public_id = 'pgtappost1'),
        tests.user_id('pgtap_ana'), 'comentario raiz de ana', 1);

insert into public.comments (public_id, post_id, parent_id, author_id, body, depth)
values ('pgtapcmt02',
        (select id from public.posts where public_id = 'pgtappost1'),
        (select id from public.comments where public_id = 'pgtapcmt01'),
        tests.user_id('pgtap_ana'), 'respuesta de ana', 2);


-- -----------------------------------------------------------------------------
-- A. create_post (4)
-- -----------------------------------------------------------------------------
select tests.authenticate_as('pgtap_bruno');

select matches(public.create_post('cuerpo de bruno'), '^[a-z0-9]{10}$',
               'create_post devuelve un public_id de 10 caracteres del alfabeto sin ambiguos');

select throws_ok('select public.create_post('''')', 'P0001', 'INVALID_INPUT',
                 'un cuerpo vacío no se publica');

select throws_ok('select public.create_post(''cuerpo'', null, ''materia-que-no-existe'')',
                 'P0001', 'TARGET_NOT_FOUND',
                 'una materia inexistente corta con TARGET_NOT_FOUND');

select matches(public.create_post('post con materia', null, 'pgtap-materia'), '^[a-z0-9]{10}$',
               'la materia se resuelve por slug: el bigint interno nunca viaja (D14.7)');


-- -----------------------------------------------------------------------------
-- B. create_comment: profundidad, bloqueo y objetivo (6)
-- -----------------------------------------------------------------------------
select matches(public.create_comment('pgtappost1', null, 'comentario raiz de bruno'),
               '^[a-z0-9]{10}$',
               'un comentario de primer nivel se crea');

select matches(public.create_comment('pgtappost1', 'pgtapcmt01', 'respuesta de bruno'),
               '^[a-z0-9]{10}$',
               'responder a un comentario raíz se permite: profundidad 2');

select throws_ok('select public.create_comment(''pgtappost1'', ''pgtapcmt02'', ''tercer nivel'')',
                 'P0001', 'DEPTH_EXCEEDED',
                 'responder a una respuesta se rechaza: la profundidad máxima es 2 (D2)');

select throws_ok('select public.create_comment(''pgtaplock1'', null, ''en hilo bloqueado'')',
                 'P0001', 'THREAD_LOCKED',
                 'un hilo bloqueado no admite comentarios nuevos (§0.5-R5)');

select throws_ok('select public.create_comment(''noexiste00'', null, ''cuerpo'')',
                 'P0001', 'TARGET_NOT_FOUND',
                 'comentar en una publicación inexistente corta con TARGET_NOT_FOUND');

select throws_ok('select public.create_comment(''pgtappost1'', null, '''')',
                 'P0001', 'INVALID_INPUT',
                 'un comentario vacío no se crea');


-- -----------------------------------------------------------------------------
-- C. Onboarding sin terminar (2)
-- -----------------------------------------------------------------------------
select tests.authenticate_as('pgtap_nuevo');

select throws_ok('select public.create_post(''cuerpo de una cuenta a medio crear'')',
                 'P0001', 'NOT_ONBOARDED',
                 'una cuenta en status nuevo no puede publicar');

select throws_ok('select public.create_comment(''pgtappost1'', null, ''cuerpo'')',
                 'P0001', 'NOT_ONBOARDED',
                 'una cuenta en status nuevo tampoco puede comentar');


-- -----------------------------------------------------------------------------
-- D. Límite de tasa de una cuenta nueva (3)
-- -----------------------------------------------------------------------------
select tests.authenticate_as('pgtap_t0');

select lives_ok('select public.create_post(''primera publicacion de una cuenta nueva'')',
                'una cuenta T0 puede publicar una vez en la hora');

select throws_ok('select public.create_post(''segunda publicacion en la misma hora'')',
                 'P0001', 'RATE_LIMIT',
                 'la segunda publicación de la hora corta con RATE_LIMIT (T0 = 1/hora)');

select lives_ok('select public.create_comment(''pgtappost1'', null, ''comentario de la cuenta nueva'')',
                'el límite de publicaciones no bloquea el de comentarios: son cuotas distintas');


-- -----------------------------------------------------------------------------
-- E. Sin sesión y sin cuenta (2)
-- -----------------------------------------------------------------------------
select tests.authenticate_no_session();

select throws_ok('select public.create_post(''sin sesion'')',
                 'P0001', 'NOT_AUTHENTICATED',
                 'con el rol authenticated pero sin JWT válido la RPC corta con NOT_AUTHENTICATED');

select tests.authenticate_as_anon();

select throws_ok('select public.create_post(''desde anon'')', '42501');


-- -----------------------------------------------------------------------------
-- F. Efectos colaterales de un comentario (6)
-- -----------------------------------------------------------------------------
select tests.clear_authentication();

select is((select p.comments_count from public.posts p where p.public_id = 'pgtappost1'),
          3,
          'comments_count cuenta los tres comentarios creados por RPC y ninguno de los fallidos');

select ok((select p.last_activity_at > p.created_at from public.posts p
            where p.public_id = 'pgtappost1'),
          'un comentario mueve last_activity_at del hilo (PART 12 §12.3)');

select is((select c.depth::int from public.comments c where c.body = 'respuesta de bruno'),
          2,
          'la respuesta quedó guardada con depth 2');

select is((select count(*)::int from public.notifications n
            where n.user_id = tests.user_id('pgtap_ana') and n.type = 'respuesta_post'),
          1,
          'las respuestas al hilo se agrupan en un solo aviso para el autor');

select is((select n.group_count from public.notifications n
            where n.user_id = tests.user_id('pgtap_ana') and n.type = 'respuesta_post'),
          2,
          'y ese aviso lleva la cuenta de las dos respuestas agrupadas');

select is((select count(*)::int from public.notifications n
            where n.user_id = tests.user_id('pgtap_ana') and n.type = 'respuesta_comentario'),
          1,
          'responder a un comentario genera su propio aviso, con otro group_key');


select * from finish();
rollback;
