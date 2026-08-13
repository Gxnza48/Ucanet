-- =============================================================================
-- 08_deletion — borrado propio, lápidas y baja de cuenta (PART 8 §8.5.2, §8.7)
-- =============================================================================
-- C6 del spine: bajo la Ley 25.326 y por decencia básica, el derecho de una
-- persona a borrar sus palabras le gana al deseo del archivo de conservarlas.
-- Lo que la base tiene que garantizar:
--
--   · borrar una publicación propia la saca de la vista pública Y le vacía el
--     cuerpo en el acto (a diferencia de la remoción por moderación, que lo
--     conserva como evidencia — ver 07);
--   · borrar un comentario deja una LÁPIDA: la fila sobrevive para que el hilo
--     no pierda contexto, con el cuerpo y el autor en null — una eliminación
--     nunca puede revelar a quien escribió anónimo;
--   · delete_account tiene las dos ramas de D3: 'borrar' da de baja todo lo
--     escrito, 'conservar' lo deja atribuido a la cáscara anonimizada. En las
--     dos, el perfil sobrevive como cáscara (es destino de FKs RESTRICT), el
--     seudónimo entra en cuarentena y las preferencias se van.
-- =============================================================================
begin;
set local search_path = public, extensions, tests;

select plan(38);


-- -----------------------------------------------------------------------------
-- Fixtures
-- -----------------------------------------------------------------------------
select tests.create_user('pgtap_ana');
select tests.create_user('pgtap_bruno');
select tests.create_user('pgtap_cami');

select tests.remember('ana_id',   tests.user_id('pgtap_ana')::text);
select tests.remember('bruno_id', tests.user_id('pgtap_bruno')::text);

insert into public.materias (slug, nombre)
values ('pgtap-materia', 'Materia de prueba pgTAP');

insert into public.posts (public_id, author_id, body)
values ('pgtappost1', tests.user_id('pgtap_ana'),   'cuerpo de ana'),
       ('pgtappost2', tests.user_id('pgtap_bruno'), 'cuerpo de bruno'),
       ('pgtappost3', tests.user_id('pgtap_ana'),   'otro cuerpo de ana');

insert into public.comments (public_id, post_id, author_id, body, depth)
values ('pgtapcmt01',
        (select id from public.posts where public_id = 'pgtappost2'),
        tests.user_id('pgtap_ana'), 'comentario de ana', 1);

insert into public.comments (public_id, post_id, parent_id, author_id, body, depth)
values ('pgtapcmt02',
        (select id from public.posts where public_id = 'pgtappost2'),
        (select id from public.comments where public_id = 'pgtapcmt01'),
        tests.user_id('pgtap_cami'), 'respuesta de cami', 2);

insert into public.comments (public_id, post_id, author_id, body, depth)
values ('pgtapcmt03',
        (select id from public.posts where public_id = 'pgtappost2'),
        tests.user_id('pgtap_ana'), 'segundo comentario de ana', 1);

update public.posts
   set comments_count = 3
 where public_id = 'pgtappost2';

-- Datos de preferencia y un aviso: los dos se van en las dos ramas de la baja.
insert into public.materia_follows (user_id, materia_id)
values (tests.user_id('pgtap_ana'),
        (select id from public.materias where slug = 'pgtap-materia'));

insert into public.notifications (user_id, type, post_id, comment_id, actor_display)
values (tests.user_id('pgtap_ana'), 'respuesta_post',
        (select id from public.posts where public_id = 'pgtappost2'),
        (select id from public.comments where public_id = 'pgtapcmt02'),
        'pgtap_cami');

-- Karma distinto de cero para que su puesta a cero sea observable.
update public.profiles set karma = 7 where id = tests.user_id('pgtap_ana');

-- Un voto EMITIDO por ana: la rama 'borrar' lo retira y ajusta el score ajeno.
select tests.authenticate_as('pgtap_ana');
select public.toggle_post_vote('pgtappost2');


-- -----------------------------------------------------------------------------
-- A. Borrado de una publicación propia (6)
-- -----------------------------------------------------------------------------
select lives_ok('select public.delete_own_post(''pgtappost1'')',
                'el autor puede borrar su publicación');

select throws_ok('select public.delete_own_post(''pgtappost2'')',
                 'P0001', 'NOT_ALLOWED',
                 'pero no la de otra persona');

select throws_ok('select public.delete_own_post(''pgtappost1'')',
                 'P0001', 'TARGET_NOT_FOUND',
                 'ni la propia dos veces: ya no está activa');

select tests.clear_authentication();

select is((select p.status from public.posts p where p.public_id = 'pgtappost1'),
          'eliminado_autor',
          'el borrado del autor es blando: la fila queda, el estado cambia (tenet 4)');

select is((select p.body from public.posts p where p.public_id = 'pgtappost1'),
          null::text,
          'y el cuerpo se vacía en el acto, no cuando pase el job de retención (§8.7)');

select is_empty($$ select 1 from public.posts_public p where p.public_id = 'pgtappost1' $$,
                'la publicación borrada desaparece de la vista pública (la URL renderiza un 410)');


-- -----------------------------------------------------------------------------
-- B. La lápida de un comentario conserva el hilo (9)
-- -----------------------------------------------------------------------------
select tests.authenticate_as('pgtap_ana');

select lives_ok('select public.delete_own_comment(''pgtapcmt01'')',
                'el autor puede borrar su comentario');

select tests.clear_authentication();

select is((select c.status from public.comments c where c.public_id = 'pgtapcmt01'),
          'eliminado_autor',
          'el comentario queda en eliminado_autor');

select is((select c.body from public.comments c where c.public_id = 'pgtapcmt01'),
          null::text,
          'con el cuerpo vaciado');

select isnt_empty($$ select 1 from public.comments_public c where c.public_id = 'pgtapcmt01' $$,
                  'pero NO desaparece de la vista: el hilo tiene que seguir siendo coherente');

select is((select c.body from public.comments_public c where c.public_id = 'pgtapcmt01'),
          null::text,
          'la lápida conserva la estructura del hilo, no las palabras');

select is((select c.status from public.comments_public c where c.public_id = 'pgtapcmt01'),
          'eliminado_autor',
          'y expone el status para que la UI renderice "Comentario eliminado"');

select is((select c.author_handle from public.comments_public c where c.public_id = 'pgtapcmt01'),
          null::text,
          'una eliminación nunca revela al autor');

select is((select count(*)::int from public.comments_public c
            where c.parent_id = (select id from public.comments where public_id = 'pgtapcmt01')
              and c.status = 'activo'),
          1,
          'la respuesta que colgaba del comentario borrado sigue viva y colgada de él');

select is((select p.comments_count from public.posts p where p.public_id = 'pgtappost2'),
          2,
          'el contador cacheado del hilo baja: los tombstones no suman');


-- -----------------------------------------------------------------------------
-- C. delete_account, rama 'borrar' (14)
-- -----------------------------------------------------------------------------
select tests.authenticate_as('pgtap_cami');

select throws_ok('select public.delete_account(''vaciar'')', 'P0001', 'INVALID_INPUT',
                 'delete_account solo acepta los dos modos de D3');

select tests.authenticate_as('pgtap_ana');

select lives_ok('select public.delete_account(''borrar'')',
                'la baja con "borrar mis publicaciones" se ejecuta');

select tests.clear_authentication();

select is((select p.status from public.posts p where p.public_id = 'pgtappost3'),
          'eliminado_autor',
          'todo lo publicado pasa a eliminado_autor');

select is((select p.body from public.posts p where p.public_id = 'pgtappost3'),
          null::text,
          'con los cuerpos vaciados');

select is((select c.status from public.comments c where c.public_id = 'pgtapcmt03'),
          'eliminado_autor',
          'los comentarios que quedaban activos también');

select is((select p.comments_count from public.posts p where p.public_id = 'pgtappost2'),
          1,
          'y el contador del hilo ajeno se descuenta antes de darlos de baja');

select is((select p.status from public.profiles p where p.id = tests.recall_uuid('ana_id')),
          'eliminado',
          'el perfil sobrevive como cáscara: es destino de FKs RESTRICT, no se borra físicamente');

select matches((select p.handle::text from public.profiles p where p.id = tests.recall_uuid('ana_id')),
               '^usuario_eliminado_[a-z0-9]{4}$',
               'con el seudónimo reemplazado por una cáscara anónima');

select is((select p.karma from public.profiles p where p.id = tests.recall_uuid('ana_id')),
          0,
          'el karma se pone en cero');

select is((select count(*)::int from public.materia_follows f where f.user_id = tests.recall_uuid('ana_id')),
          0,
          'las materias seguidas son preferencias, no contenido: se borran en las dos ramas');

select is((select count(*)::int from public.notifications n where n.user_id = tests.recall_uuid('ana_id')),
          0,
          'los avisos también');

select isnt_empty(
  $$ select 1 from public.handle_history h where h.old_handle::text = 'pgtap_ana' $$,
  'el seudónimo liberado entra en cuarentena de 90 días: nadie hereda la reputación de una cuenta que se fue'
);

select is((select count(*)::int from public.post_votes v where v.user_id = tests.recall_uuid('ana_id')),
          0,
          'los votos emitidos se retiran: un voto retirado no es contenido');

select is((select p.score from public.posts p where p.public_id = 'pgtappost2'),
          0,
          'y el score del contenido ajeno se ajusta en la misma transacción');


-- -----------------------------------------------------------------------------
-- D. La sesión de una cuenta dada de baja muere en el acto (2)
-- -----------------------------------------------------------------------------
select tests.authenticate_as_uuid(tests.recall_uuid('ana_id'));

select throws_ok('select public.create_post(''despues de darme de baja'')',
                 'P0001', 'RESTRICTED',
                 'la sesión puede seguir viva, la escritura no');

select throws_ok('select public.delete_account(''borrar'')', 'P0001', 'NOT_ALLOWED',
                 'y no se puede dar de baja dos veces');


-- -----------------------------------------------------------------------------
-- E. delete_account, rama 'conservar' (7)
-- -----------------------------------------------------------------------------
select tests.authenticate_as('pgtap_bruno');

select lives_ok('select public.delete_account(''conservar'')',
                'la baja con "conservar mis publicaciones" se ejecuta');

select tests.clear_authentication();

select is((select p.status from public.posts p where p.public_id = 'pgtappost2'),
          'activo',
          'el contenido sigue activo');

select is((select p.body from public.posts p where p.public_id = 'pgtappost2'),
          'cuerpo de bruno',
          'con su cuerpo intacto');

select isnt_empty($$ select 1 from public.posts_public p where p.public_id = 'pgtappost2' $$,
                  'y sigue siendo público');

select matches((select p.author_handle from public.posts_public p where p.public_id = 'pgtappost2'),
               '^usuario_eliminado_',
               'atribuido a la cáscara anonimizada, que es lo que el usuario eligió');

select is((select p.status from public.profiles p where p.id = tests.recall_uuid('bruno_id')),
          'eliminado',
          'el perfil igual queda como cáscara eliminada');

select is((select count(*)::int from public.comments c
            where c.author_id = tests.user_id('pgtap_cami') and c.status = 'activo'),
          1,
          'y el contenido de terceros no se toca en ninguna de las dos ramas');


select * from finish();
rollback;
