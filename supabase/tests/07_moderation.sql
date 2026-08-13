-- =============================================================================
-- 07_moderation — RPC de moderación y bitácora inmutable (PART 8 §8.5.5)
-- =============================================================================
-- D14.10: toda funcionalidad trae su superficie de moderación — reportable,
-- removible, auditada — o no se despliega. Lo que este archivo sostiene:
--
--   · remover y restaurar contenido, con la fila de auditoría y el aviso al
--     autor en la misma transacción (§25.1 ítem 9);
--   · mod_actions es append-only: UPDATE y DELETE fallan para todos, incluido
--     postgres, porque el trigger no distingue roles (§25.1 ítem 8);
--   · un usuario común no puede llamar ninguna RPC de moderación ni leer la
--     cola de reportes ni la bitácora (§25.1 ítems 6 y 7);
--   · una apelación la revisa alguien DISTINTO del que tomó la decisión: es la
--     regla que hace que apelar sea algo más que un segundo "no" de la misma
--     persona (PART 11 §11.5.2).
--
-- La remoción por moderación conserva el cuerpo (evidencia para la apelación,
-- §8.7); la del autor lo vacía. Ese contraste se prueba acá y en 08.
-- =============================================================================
begin;
set local search_path = public, extensions, tests;

select plan(42);


-- -----------------------------------------------------------------------------
-- Fixtures
-- -----------------------------------------------------------------------------
select tests.create_user('pgtap_ana');
select tests.create_user('pgtap_bruno');
select tests.create_user('pgtap_mod1', 'mod');
select tests.create_user('pgtap_mod2', 'mod');

insert into public.posts (public_id, author_id, body, comments_count)
values ('pgtappost1', tests.user_id('pgtap_ana'), 'cuerpo original de ana', 1);

insert into public.comments (public_id, post_id, author_id, body, depth)
values ('pgtapcmt01',
        (select id from public.posts where public_id = 'pgtappost1'),
        tests.user_id('pgtap_ana'), 'comentario de ana', 1);


-- -----------------------------------------------------------------------------
-- A. Quién puede moderar (2)
-- -----------------------------------------------------------------------------
select tests.authenticate_as('pgtap_bruno');

select throws_ok('select public.mod_remove_post(''pgtappost1'', ''Motivo de prueba'')',
                 'P0001', 'NOT_ALLOWED',
                 'un usuario común no puede remover contenido ajeno');

select tests.authenticate_as_anon();

select throws_ok('select public.mod_remove_post(''pgtappost1'', ''Motivo de prueba'')', '42501');


-- -----------------------------------------------------------------------------
-- B. Remover (6)
-- -----------------------------------------------------------------------------
select tests.authenticate_as('pgtap_mod1');

select lives_ok('select public.mod_remove_post(''pgtappost1'', ''Se removió por datos personales de terceros.'')',
                'un moderador remueve una publicación activa');

select tests.clear_authentication();

select is_empty(
  $$ select 1 from public.posts_public p where p.public_id = 'pgtappost1' $$,
  'la publicación removida desaparece de la vista pública'
);

select is((select p.status from public.posts p where p.public_id = 'pgtappost1'),
          'eliminado_mod',
          'y queda marcada como eliminado_mod (borrado blando, tenet 4)');

select ok((select p.body is not null from public.posts p where p.public_id = 'pgtappost1'),
          'la remoción de moderación conserva el cuerpo como evidencia para la apelación (§8.7)');

select is((select count(*)::int from public.mod_actions ma
            where ma.action = 'remover' and ma.target_public_id = 'pgtappost1'),
          1,
          'la decisión dejó exactamente una fila en la bitácora');

select is((select count(*)::int from public.notifications n
            where n.user_id = tests.user_id('pgtap_ana') and n.type = 'decision_mod'),
          1,
          'la moderación de tu contenido nunca es anónima para vos: el autor recibe el aviso (D3)');


-- -----------------------------------------------------------------------------
-- C. Restaurar (5)
-- -----------------------------------------------------------------------------
select tests.authenticate_as('pgtap_mod1');

select lives_ok('select public.mod_restore_post(''pgtappost1'', ''Revisado: no incumplía las Reglas.'')',
                'un moderador restaura lo que removió moderación');

select tests.clear_authentication();

select isnt_empty(
  $$ select 1 from public.posts_public p where p.public_id = 'pgtappost1' $$,
  'la publicación restaurada vuelve a la vista pública'
);

select is((select count(*)::int from public.mod_actions ma
            where ma.action = 'restaurar' and ma.target_public_id = 'pgtappost1'),
          1,
          'la restauración también deja su fila: una corrección es una fila nueva, nunca una edición');

select tests.authenticate_as('pgtap_mod1');

select lives_ok('select public.mod_remove_comment(''pgtapcmt01'', ''Se removió por ataque a una persona.'')',
                'un moderador remueve un comentario');

select tests.clear_authentication();

select is((select p.comments_count from public.posts p where p.public_id = 'pgtappost1'),
          0,
          'remover un comentario descuenta el contador cacheado del hilo');


-- -----------------------------------------------------------------------------
-- D. mod_actions es una bitácora append-only (6)
-- -----------------------------------------------------------------------------
select tests.authenticate_as('pgtap_mod1');

select lives_ok('select public.mod_restore_comment(''pgtapcmt01'', ''Revisado: se restituye.'')',
                'y restaurarlo lo vuelve a sumar');

select tests.clear_authentication();

select is((select p.comments_count from public.posts p where p.public_id = 'pgtappost1'),
          1,
          'el contador vuelve a 1 tras la restauración');

-- Ni siquiera postgres: el trigger mod_actions_immutable no distingue roles.
select throws_ok(
  'update public.mod_actions set motivo_publico = ''editado'' where action = ''remover''',
  'P0001', 'NOT_ALLOWED',
  'nadie puede editar la bitácora de moderación, ni con superusuario');

select throws_ok(
  'delete from public.mod_actions where action = ''remover''',
  'P0001', 'NOT_ALLOWED',
  'nadie puede borrar una fila de la bitácora');

select tests.authenticate_as('pgtap_mod1');

select throws_ok('update public.mod_actions set notas_internas = ''x''', '42501');

select throws_ok(
  'insert into public.mod_actions (actor_id, action, target_kind, target_public_id, motivo_publico) '
  || 'values (auth.uid(), ''remover'', ''post'', ''pgtappost1'', ''a mano'')',
  '42501');


-- -----------------------------------------------------------------------------
-- E. Quién lee la cola y la bitácora (4)
-- -----------------------------------------------------------------------------
select tests.authenticate_as('pgtap_bruno');

select is_empty($$ select 1 from public.mod_actions $$,
                'un usuario común no ve ni una fila de la bitácora');

select is_empty($$ select 1 from public.reports $$,
                'un usuario común no ve la cola de reportes: la cola es ciega para quien reporta');

-- Los avisos de moderación que ya recibió ana son suyos y de nadie más.
select is_empty($$ select 1 from public.notifications $$,
                'un usuario no ve los avisos ajenos (todavía no tiene ninguno propio)');

select tests.authenticate_as('pgtap_mod1');

select isnt_empty($$ select 1 from public.mod_actions $$,
                  'un moderador sí lee la bitácora');


-- -----------------------------------------------------------------------------
-- F. Reportar y resolver (5)
-- -----------------------------------------------------------------------------
select tests.authenticate_as('pgtap_bruno');

select lives_ok('select public.create_report(''post'', ''pgtappost1'', ''spam'')',
                'cualquier cuenta activa puede reportar contenido ajeno');

select throws_ok('select public.create_report(''post'', ''pgtappost1'', ''spam'')',
                 'P0001', 'DUPLICATE_REPORT',
                 'el índice único parcial impide reportar dos veces lo mismo');

select tests.authenticate_as('pgtap_mod1');

select isnt_empty(
  $$ select 1 from public.reports r where r.reporter_id = tests.user_id('pgtap_bruno') $$,
  'el reporte aparece en la cola de moderación'
);

select lives_ok(
  'select public.mod_resolve_report('
  || '(select r.id from public.reports r where r.reporter_id = tests.user_id(''pgtap_bruno'') order by r.id desc limit 1), '
  || '''resuelto'')',
  'un moderador cierra el reporte');

select tests.clear_authentication();

select is((select r.status from public.reports r
            where r.reporter_id = tests.user_id('pgtap_bruno') order by r.id desc limit 1),
          'resuelto',
          'el reporte queda cerrado con su resolución');


-- -----------------------------------------------------------------------------
-- G. Sanción a la cuenta (4)
-- -----------------------------------------------------------------------------
select is((select count(*)::int from public.notifications n
            where n.user_id = tests.user_id('pgtap_bruno') and n.type = 'reporte_resuelto'),
          1,
          'todo reporte termina en exactamente un aviso al denunciante (§11.3.4)');

select tests.authenticate_as('pgtap_mod1');

select lives_ok(
  'select public.mod_restrict_user(''pgtap_ana'', ''suspension'', now() + interval ''7 days'', ''Suspensión de prueba pgTAP.'')',
  'un moderador suspende una cuenta');

select tests.clear_authentication();

select is((select p.status from public.profiles p where p.id = tests.user_id('pgtap_ana')),
          'suspendido',
          'profiles.status espeja la peor restricción vigente');

select tests.authenticate_as('pgtap_ana');

select throws_ok('select public.create_post(''intento publicar suspendida'')',
                 'P0001', 'RESTRICTED',
                 'una cuenta suspendida no participa');


-- -----------------------------------------------------------------------------
-- H. Apelación: la revisa otro (5)
-- -----------------------------------------------------------------------------
select tests.clear_authentication();

select tests.remember('accion_susp',
  (select ma.id::text from public.mod_actions ma
    where ma.action = 'suspender' and ma.target_public_id = 'pgtap_ana'
    order by ma.id desc limit 1));

select tests.authenticate_as('pgtap_ana');

select lives_ok(
  'select public.create_appeal(tests.recall_id(''accion_susp''), ''No estoy de acuerdo con la suspensión.'')',
  'una cuenta suspendida conserva el derecho a apelar: la restricción corta la participación, no el debido proceso');

select tests.authenticate_as('pgtap_mod1');

select throws_ok(
  'select public.mod_review_appeal('
  || '(select ap.id from public.appeals ap where ap.mod_action_id = tests.recall_id(''accion_susp'')), '
  || '''aceptada'')',
  'P0001', 'NOT_ALLOWED',
  'quien tomó la decisión no puede revisar su propia apelación (§11.5.2)');

select tests.authenticate_as('pgtap_mod2');

select lives_ok(
  'select public.mod_review_appeal('
  || '(select ap.id from public.appeals ap where ap.mod_action_id = tests.recall_id(''accion_susp'')), '
  || '''aceptada'')',
  'otro moderador sí puede revisarla');

select tests.clear_authentication();

select is((select ap.status from public.appeals ap
            where ap.mod_action_id = tests.recall_id('accion_susp')),
          'aceptada',
          'la apelación queda resuelta');

select is((select ap.reviewed_by from public.appeals ap
            where ap.mod_action_id = tests.recall_id('accion_susp')),
          tests.user_id('pgtap_mod2'),
          'y el revisor registrado es el segundo moderador, no el primero');


-- -----------------------------------------------------------------------------
-- I. Bloquear hilo y "Ver autor" auditado (5)
-- -----------------------------------------------------------------------------
select tests.authenticate_as('pgtap_bruno');

select throws_ok('select public.mod_lock_thread(''pgtappost1'', ''Motivo de prueba'')',
                 'P0001', 'NOT_ALLOWED',
                 'un usuario común no puede bloquear un hilo');

select tests.authenticate_as('pgtap_mod1');

select lives_ok('select public.mod_lock_thread(''pgtappost1'', ''Se cierra el hilo: la discusión se salió de las Reglas.'')',
                'un moderador bloquea el hilo');

select is(public.mod_reveal_author('post', 'pgtappost1', 'Investigación de acoso reportado.'),
          'pgtap_ana',
          'el "Ver autor" devuelve el seudónimo real del autor a un moderador');

select tests.clear_authentication();

select ok((select p.locked_at is not null from public.posts p where p.public_id = 'pgtappost1'),
          'el hilo quedó con locked_at: create_comment lo rechazará con THREAD_LOCKED');

select is((select count(*)::int from public.mod_actions ma
            where ma.action = 'revelar_autor' and ma.target_public_id = 'pgtappost1'),
          1,
          'y la revelación dejó su fila de auditoría: no hay tabla de reveals, la bitácora ES el control');


select * from finish();
rollback;
