-- #############################################################################
-- #                                                                           #
-- #   uca.net · FIXTURES DE DESARROLLO LOCAL                                  #
-- #                                                                           #
-- #   ██  ESTO NUNCA VA A PRODUCCIÓN. NUNCA. BAJO NINGUNA CIRCUNSTANCIA.  ██  #
-- #                                                                           #
-- #   Este archivo crea usuarios con CONTRASEÑAS CONOCIDAS Y PÚBLICAS,        #
-- #   escribe directo en auth.users, desactiva triggers de autenticación y    #
-- #   saltea todas las RPC (y por lo tanto todos los rate limits, todas las   #
-- #   restricciones y toda la validación de PART 8 §8.5).                     #
-- #                                                                           #
-- #   Aplicarlo contra un proyecto hosteado sería regalar cuentas admin.      #
-- #                                                                           #
-- #   Se aplica SOLO vía `supabase db reset` / `supabase start` contra la     #
-- #   base local (127.0.0.1:54322) y en CI. PART 8 §8.10.2: "Dev fixtures     #
-- #   (supabase/seed.sql): fake users/posts for local development and         #
-- #   Playwright runs only; never applied to prod."                           #
-- #                                                                           #
-- #############################################################################
--
-- -----------------------------------------------------------------------------
-- CÓMO SE CARGA EL CATÁLOGO ACADÉMICO (que este archivo NO carga)
-- -----------------------------------------------------------------------------
-- El catálogo real (APPENDIX A) vive en supabase/seed/catalog/*.sql y se aplica
-- a TODOS los entornos, incluida producción. Este archivo depende de él pero no
-- lo incluye, por dos razones:
--
--   1. El CLI de Supabase ejecuta los archivos de seed con su propio driver de
--      Postgres, no con psql, así que los meta-comandos de psql (`\ir`, `\i`) no
--      se interpretan: quedarían como SQL inválido y romperían `db reset`.
--   2. Mezclar catálogo (va a prod) con fixtures (jamás va a prod) en un mismo
--      archivo es exactamente el accidente que este banner intenta evitar.
--
-- La forma soportada de encadenarlos es declararlos en supabase/config.toml, que
-- expande los globs en orden lexicográfico (el catálogo primero, las fixtures
-- después):
--
--     [db.seed]
--     enabled   = true
--     sql_paths = ["./seed/catalog/*.sql", "./seed.sql"]
--
-- Fuera del CLI (staging, una base remota de prueba, CI con psql), el catálogo
-- se aplica con:  npm run db:seed:catalog   (scripts/apply-catalog-seed.mjs)
--
-- Si preferís invocar el catálogo desde acá con psql y NO con el CLI, estas dos
-- líneas hacen el trabajo — quedan comentadas a propósito porque rompen
-- `supabase db reset`:
--
--     -- \ir seed/catalog/00_universidad.sql
--     -- \ir seed/catalog/10_sedes.sql   ... etc.
--
-- -----------------------------------------------------------------------------
-- CUENTAS QUE CREA (contraseña única para todas: "ucanet-local-2026")
-- -----------------------------------------------------------------------------
--   fundador@ucanet.test  → MateConBizcochos       role admin  · Abogacía
--   mod@ucanet.test       → FiscalDelTercerPiso    role mod    · Abogacía
--   ana@ucanet.test       → ApunteDeUltimoMomento  role user   · Abogacía
--   bruno@ucanet.test     → CafeDeLaMaquina        role user   · Contador Público
-- =============================================================================

set client_encoding = 'UTF8';

-- -----------------------------------------------------------------------------
-- 0. Guardas
-- -----------------------------------------------------------------------------
-- Nota: estas guardas son de fixture, no son RPC — por eso levantan un mensaje
-- en castellano y no uno de los códigos de RPC_ERROR_CODES (lib/errors.ts).
do $$
begin
  if current_setting('server_version_num')::int < 150000 then
    raise notice 'uca.net · fixtures: se esperaba PostgreSQL 15+; versión actual %.', current_setting('server_version');
  end if;

  if not exists (select 1 from public.materias) then
    raise exception using message =
      'Fixtures locales: el catálogo académico está vacío. Aplicá supabase/seed/catalog/*.sql antes (npm run db:seed:catalog, o declaralos en [db.seed].sql_paths de supabase/config.toml).';
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- 1. Usuarios de prueba en auth.users
-- -----------------------------------------------------------------------------
-- Se desactivan los triggers de usuario sobre auth.users mientras insertamos:
-- `handle_new_user` (PART 8 §8.5.1) valida y consume un código de invitación, y
-- las fixtures no tienen de dónde sacar uno (invites.created_by exige un perfil
-- que todavía no existe: el huevo y la gallina). Insertamos los perfiles a mano,
-- unas líneas más abajo, con los handles definitivos ya puestos.
-- Requiere ser dueño de la tabla: en local corre como `postgres`. En un proyecto
-- hosteado esto falla — y está perfecto que falle.
alter table auth.users disable trigger user;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
select
  '00000000-0000-0000-0000-000000000000',
  v.id::uuid,
  'authenticated',
  'authenticated',
  v.email,
  extensions.crypt('ucanet-local-2026', extensions.gen_salt('bf')),
  now() - interval '30 days',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now() - interval '30 days',
  now() - interval '30 days',
  '', '', '', ''
from (values
  ('11111111-1111-4111-a111-111111111111'::text, 'fundador@ucanet.test'::text),
  ('22222222-2222-4222-a222-222222222222',       'mod@ucanet.test'),
  ('33333333-3333-4333-a333-333333333333',       'ana@ucanet.test'),
  ('44444444-4444-4444-a444-444444444444',       'bruno@ucanet.test')
) as v(id, email)
on conflict (id) do nothing;

-- Identidad de proveedor "email": sin esta fila, GoTrue no resuelve el login.
insert into auth.identities (
  id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(),
  u.id::text,
  u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email',
  now() - interval '30 days',
  now() - interval '30 days',
  now() - interval '30 days'
from auth.users u
where u.email like '%@ucanet.test'
  and not exists (
    select 1 from auth.identities i
    where i.user_id = u.id and i.provider = 'email'
  );

alter table auth.users enable trigger user;

-- -----------------------------------------------------------------------------
-- 2. Perfiles (public.profiles)
-- -----------------------------------------------------------------------------
-- Handles con sabor es-AR, como manda el generador de seudónimos de D3.
-- `status = 'activo'`: las RPC de contenido exigen ese estado (PART 8 §8.3.2).
insert into public.profiles (id, handle, carrera_id, ingreso_year, karma, notif_respuestas, role, status)
select v.id::uuid, v.handle, c.id, v.ingreso_year::smallint, v.karma, true, v.role, 'activo'
from (values
  ('11111111-1111-4111-a111-111111111111'::text, 'MateConBizcochos'::text,      'abogacia'::text,         2022, 34, 'admin'::text),
  ('22222222-2222-4222-a222-222222222222',       'FiscalDelTercerPiso',         'abogacia',               2021, 58, 'mod'),
  ('33333333-3333-4333-a333-333333333333',       'ApunteDeUltimoMomento',       'abogacia',               2024, 12, 'user'),
  ('44444444-4444-4444-a444-444444444444',       'CafeDeLaMaquina',             'contador-publico',       2025,  4, 'user')
) as v(id, handle, carrera_slug, ingreso_year, karma, role)
left join public.carreras c on c.slug = v.carrera_slug
on conflict (id) do update
   set handle       = excluded.handle,
       carrera_id   = excluded.carrera_id,
       ingreso_year = excluded.ingreso_year,
       karma        = excluded.karma,
       role         = excluded.role,
       status       = excluded.status;

-- -----------------------------------------------------------------------------
-- 3. Materias seguidas (alimenta el feed "Mis materias")
-- -----------------------------------------------------------------------------
insert into public.materia_follows (user_id, materia_id)
select p.id, m.id
from (values
  ('MateConBizcochos'::text,      'derecho-constitucional'::text),
  ('MateConBizcochos',            'derecho-romano'),
  ('MateConBizcochos',            'derecho-penal-parte-general'),
  ('FiscalDelTercerPiso',         'derecho-constitucional'),
  ('ApunteDeUltimoMomento',       'derecho-romano'),
  ('ApunteDeUltimoMomento',       'derecho-penal-parte-general'),
  ('CafeDeLaMaquina',             'contabilidad'),
  ('CafeDeLaMaquina',             'impuestos-i'),
  ('CafeDeLaMaquina',             'administracion')
) as v(handle, materia_slug)
join public.profiles p on p.handle::text = v.handle
join public.materias m on m.slug = v.materia_slug
on conflict (user_id, materia_id) do nothing;

-- -----------------------------------------------------------------------------
-- 4. Publicaciones
-- -----------------------------------------------------------------------------
-- `carrera_id` es el snapshot de cohorte del autor al crear (§0.5-R3).
-- seedpost04 va sin materia: se muestra a la carrera del autor.
insert into public.posts (
  public_id, author_id, materia_id, carrera_id, kind, title, body,
  is_anonymous, score, comments_count, status, created_at, last_activity_at
)
select
  v.public_id, p.id, m.id, c.id, v.kind, v.title, v.body,
  v.is_anonymous, v.score, v.comments_count, 'activo',
  now() - make_interval(hours => v.horas),
  now() - make_interval(hours => v.horas_actividad)
from (values
  (
    'seedpost01'::text, 'MateConBizcochos'::text, 'derecho-constitucional'::text, 'abogacia'::text,
    'pregunta'::text,
    '¿Alguien rindió Consti con la cátedra de la mañana?'::text,
    E'Voy a rendir en el turno de noviembre y no encuentro finales viejos de esa cátedra. ¿Toman todo el programa o se concentran en la parte de control de constitucionalidad?\n\nCualquier dato sirve, gracias.'::text,
    false, 3, 2, 30, 2
  ),
  (
    'seedpost02', 'ApunteDeUltimoMomento', 'derecho-romano', 'abogacia',
    'texto',
    'Subí el resumen de Romano, bolillas 1 a 5',
    E'Lo armé cursando el año pasado, está en Recursos. Tiene los casos que tomó la cátedra en los últimos dos parciales.\n\nSi encuentran errores, avisen y lo corrijo.',
    false, 2, 1, 26, 5
  ),
  (
    'seedpost03', 'ApunteDeUltimoMomento', 'derecho-penal-parte-general', 'abogacia',
    'texto',
    null,
    E'Publico anónimo porque me da vergüenza preguntarlo: llevo dos veces desaprobado el primer parcial y no sé si sigo o dejo la materia para el año que viene.\n\n¿A alguien más le pasó?',
    true, 2, 1, 20, 3
  ),
  (
    'seedpost04', 'CafeDeLaMaquina', null, 'contador-publico',
    'pregunta',
    '¿Ya salió el cronograma del segundo cuatrimestre?',
    'Pregunto por acá porque en el campus todavía figura el del cuatrimestre pasado.',
    false, 1, 0, 8, 8
  ),
  (
    'seedpost05', 'CafeDeLaMaquina', 'contabilidad', 'contador-publico',
    'texto',
    'Hilo general de dudas de Conta 1',
    'Dejo el hilo abierto para juntar las dudas de la cursada en un solo lugar.',
    false, 0, 0, 6, 6
  )
) as v(public_id, handle, materia_slug, carrera_slug, kind, title, body,
       is_anonymous, score, comments_count, horas, horas_actividad)
join public.profiles p on p.handle::text = v.handle
left join public.materias m on m.slug = v.materia_slug
left join public.carreras c on c.slug = v.carrera_slug
on conflict (public_id) do nothing;

-- Hilo bloqueado por moderación (§0.5-R5): create_comment lo rechaza con THREAD_LOCKED.
update public.posts
   set locked_at = now() - interval '4 hours'
 where public_id = 'seedpost05'
   and locked_at is null;

-- -----------------------------------------------------------------------------
-- 5. Alias anónimos por hilo (public.anon_aliases)
-- -----------------------------------------------------------------------------
-- alias_num = 0 está reservado al autor del post cuando el post es anónimo;
-- los comentaristas anónimos toman 1, 2, 3… (PART 8 §8.3.4).
insert into public.anon_aliases (post_id, author_id, alias_num)
select po.id, pr.id, v.alias_num::smallint
from (values
  ('seedpost03'::text, 'ApunteDeUltimoMomento'::text, 0),
  ('seedpost03',       'MateConBizcochos',            1)
) as v(post_public_id, handle, alias_num)
join public.posts po on po.public_id = v.post_public_id
join public.profiles pr on pr.handle::text = v.handle
on conflict (post_id, author_id) do nothing;

-- -----------------------------------------------------------------------------
-- 6. Comentarios
-- -----------------------------------------------------------------------------
-- Primero los de primer nivel (depth 1)…
insert into public.comments (
  public_id, post_id, parent_id, depth, author_id, body, is_anonymous, score, status, created_at
)
select
  v.public_id, po.id, null::bigint, 1::smallint, pr.id, v.body, v.is_anonymous, v.score, v.status,
  now() - make_interval(hours => v.horas)
from (values
  ('seedcmt001'::text, 'seedpost01'::text, 'ApunteDeUltimoMomento'::text,
   E'Rendí en julio. Toman todo el programa pero la parte de control de constitucionalidad se la saben de memoria: si eso lo tenés firme, zafás.'::text,
   false, 2, 'activo'::text, 24),
  ('seedcmt003', 'seedpost02', 'CafeDeLaMaquina',
   'Gracias por subirlo. ¿Está actualizado con el fallo nuevo?',
   false, 0, 'activo', 20),
  ('seedcmt004', 'seedpost03', 'MateConBizcochos',
   'Me pasó igual en segundo año. No dejes la materia: hablá con el ayudante antes del recuperatorio, cambia todo.',
   true, 1, 'activo', 12),
  -- Tumba: comentario borrado por su autor. body en null, la fila queda para que
  -- el hilo no pierda estructura (PART 8 §8.7).
  ('seedcmt005', 'seedpost02', 'FiscalDelTercerPiso',
   null,
   false, 0, 'eliminado_autor', 18)
) as v(public_id, post_public_id, handle, body, is_anonymous, score, status, horas)
join public.posts po on po.public_id = v.post_public_id
join public.profiles pr on pr.handle::text = v.handle
on conflict (public_id) do nothing;

-- …y después las respuestas (depth 2, el máximo que permite D2).
insert into public.comments (
  public_id, post_id, parent_id, depth, author_id, body, is_anonymous, score, status, created_at
)
select
  v.public_id, po.id, pa.id, 2::smallint, pr.id, v.body, false, v.score, 'activo',
  now() - make_interval(hours => v.horas)
from (values
  ('seedcmt002'::text, 'seedpost01'::text, 'seedcmt001'::text, 'CafeDeLaMaquina'::text,
   '¿Y el material de la cátedra alcanza o hay que ir al manual?'::text, 1, 22)
) as v(public_id, post_public_id, parent_public_id, handle, body, score, horas)
join public.posts po on po.public_id = v.post_public_id
join public.comments pa on pa.public_id = v.parent_public_id
join public.profiles pr on pr.handle::text = v.handle
on conflict (public_id) do nothing;

-- -----------------------------------------------------------------------------
-- 7. Votos (up-only: la existencia de la fila ES el voto)
-- -----------------------------------------------------------------------------
insert into public.post_votes (post_id, user_id)
select po.id, pr.id
from (values
  ('seedpost01'::text, 'ApunteDeUltimoMomento'::text),
  ('seedpost01',       'CafeDeLaMaquina'),
  ('seedpost01',       'FiscalDelTercerPiso'),
  ('seedpost02',       'MateConBizcochos'),
  ('seedpost02',       'CafeDeLaMaquina'),
  ('seedpost03',       'MateConBizcochos'),
  ('seedpost03',       'CafeDeLaMaquina'),
  ('seedpost04',       'MateConBizcochos')
) as v(post_public_id, handle)
join public.posts po on po.public_id = v.post_public_id
join public.profiles pr on pr.handle::text = v.handle
on conflict (post_id, user_id) do nothing;

insert into public.comment_votes (comment_id, user_id)
select co.id, pr.id
from (values
  ('seedcmt001'::text, 'MateConBizcochos'::text),
  ('seedcmt001',       'CafeDeLaMaquina'),
  ('seedcmt002',       'MateConBizcochos'),
  ('seedcmt004',       'CafeDeLaMaquina')
) as v(comment_public_id, handle)
join public.comments co on co.public_id = v.comment_public_id
join public.profiles pr on pr.handle::text = v.handle
on conflict (comment_id, user_id) do nothing;

-- -----------------------------------------------------------------------------
-- 8. Recursos y sus archivos
-- -----------------------------------------------------------------------------
-- OJO: los objetos NO existen en Cloudflare R2 (§0.5-R17). Las claves de abajo
-- son ficticias: la ruta de descarga va a fallar al firmar la URL, y está bien —
-- lo que se ejercita en local es la ficha, el contador y la moderación, no el
-- almacenamiento. Para probar descargas de verdad, subí un archivo con el flujo
-- real (request_upload → finalize_upload).
insert into public.resources (
  public_id, materia_id, author_id, tipo, anio, title, description,
  is_anonymous, score, downloads_count, status, created_at
)
select
  v.public_id, m.id, p.id, v.tipo, v.anio::smallint, v.title, v.description,
  v.is_anonymous, v.score, v.downloads_count, 'activo',
  now() - make_interval(days => v.dias)
from (values
  (
    'seedres001'::text, 'derecho-constitucional'::text, 'ApunteDeUltimoMomento'::text,
    'resumen'::text, 2025,
    'Resumen completo de Derecho Constitucional (Plan 2013)'::text,
    'Cubre las diez bolillas del programa, con los fallos que la cátedra pidió leer. Hecho a partir de las clases del primer cuatrimestre de 2025.'::text,
    false, 2, 7, 14
  ),
  (
    'seedres002', 'contabilidad', 'CafeDeLaMaquina',
    'parcial', 2025,
    'Primer parcial de Contabilidad resuelto',
    'El parcial que tomaron en mayo, con la resolución punto por punto. No garantizo que esté todo bien: si ven un error, comenten.',
    true, 1, 3, 9
  )
) as v(public_id, materia_slug, handle, tipo, anio, title, description,
       is_anonymous, score, downloads_count, dias)
join public.materias m on m.slug = v.materia_slug
join public.profiles p on p.handle::text = v.handle
on conflict (public_id) do nothing;

insert into public.resource_files (
  resource_id, storage_path, original_name, mime, size_bytes, position
)
select r.id, v.storage_path, v.original_name, v.mime, v.size_bytes, v.position::smallint
from (values
  ('seedres001'::text, 'r/seedres001/seedfilea1.pdf'::text, 'resumen-consti-2025.pdf'::text, 'application/pdf'::text, 1572864, 1),
  ('seedres002',       'r/seedres002/seedfileb1.pdf',       'parcial-conta-2025.pdf',        'application/pdf',       987654,  1)
) as v(resource_public_id, storage_path, original_name, mime, size_bytes, position)
join public.resources r on r.public_id = v.resource_public_id
on conflict (storage_path) do nothing;

insert into public.resource_votes (resource_id, user_id)
select r.id, pr.id
from (values
  ('seedres001'::text, 'MateConBizcochos'::text),
  ('seedres001',       'CafeDeLaMaquina'),
  ('seedres002',       'ApunteDeUltimoMomento')
) as v(resource_public_id, handle)
join public.resources r on r.public_id = v.resource_public_id
join public.profiles pr on pr.handle::text = v.handle
on conflict (resource_id, user_id) do nothing;

-- -----------------------------------------------------------------------------
-- 9. Seguridad: un reporte abierto y una acción de moderación auditada
-- -----------------------------------------------------------------------------
insert into public.reports (reporter_id, post_id, categoria, detalle, status)
select pr.id, po.id, 'ataque_persona', 'Reporte de ejemplo para ver la cola de moderación en /mod.', 'abierto'
from public.profiles pr
join public.posts po on po.public_id = 'seedpost03'
where pr.handle::text = 'CafeDeLaMaquina'
  and not exists (
    select 1 from public.reports r
    where r.reporter_id = pr.id and r.post_id = po.id
  );

-- Bitácora inmutable (PART 8 §8.3.6): esta fila es la que bloqueó seedpost05.
insert into public.mod_actions (
  actor_id, action, post_id, target_kind, target_public_id, motivo_publico, notas_internas
)
select pr.id, 'bloquear_hilo', po.id, 'post', 'seedpost05',
       'Se bloqueó el hilo: las dudas de cursada van en la página de la materia.',
       'Fixture local. No corresponde a ninguna decisión real.'
from public.profiles pr
join public.posts po on po.public_id = 'seedpost05'
where pr.handle::text = 'FiscalDelTercerPiso'
  and not exists (
    select 1 from public.mod_actions ma
    where ma.target_public_id = 'seedpost05' and ma.action = 'bloquear_hilo'
  );

-- -----------------------------------------------------------------------------
-- 10. Avisos
-- -----------------------------------------------------------------------------
-- `actor_display` se precalcula respetando el anonimato (§0.5-R14): la notificación
-- nunca vuelve a consultar al autor.
insert into public.notifications (user_id, type, post_id, comment_id, actor_display, group_key, group_count, read_at)
select u.id, 'respuesta_post', po.id, co.id, 'ApunteDeUltimoMomento',
       'respuesta_post:' || po.id::text, 1, null::timestamptz
from public.profiles u
join public.posts po on po.public_id = 'seedpost01'
join public.comments co on co.public_id = 'seedcmt001'
where u.handle::text = 'MateConBizcochos'
  and not exists (select 1 from public.notifications n where n.user_id = u.id and n.comment_id = co.id);

insert into public.notifications (user_id, type, post_id, comment_id, actor_display, group_key, group_count, read_at)
select u.id, 'respuesta_comentario', po.id, co.id, 'CafeDeLaMaquina',
       'respuesta_comentario:' || co.id::text, 1, now() - interval '2 hours'
from public.profiles u
join public.posts po on po.public_id = 'seedpost01'
join public.comments co on co.public_id = 'seedcmt002'
where u.handle::text = 'ApunteDeUltimoMomento'
  and not exists (select 1 from public.notifications n where n.user_id = u.id and n.comment_id = co.id);

insert into public.notifications (user_id, type, mod_action_id, actor_display, group_count, read_at)
select u.id, 'decision_mod', ma.id, 'Moderación', 1, null::timestamptz
from public.profiles u
join public.mod_actions ma on ma.target_public_id = 'seedpost05' and ma.action = 'bloquear_hilo'
where u.handle::text = 'CafeDeLaMaquina'
  and not exists (select 1 from public.notifications n where n.user_id = u.id and n.mod_action_id = ma.id);

-- -----------------------------------------------------------------------------
-- 11. Invitación y lista de espera
-- -----------------------------------------------------------------------------
insert into public.invites (code, created_by, max_uses, note)
select 'devinv01', p.id, 25, 'Invitación de desarrollo local — /invitacion/devinv01'
from public.profiles p
where p.handle::text = 'MateConBizcochos'
on conflict (code) do nothing;

insert into public.waitlist (email, source)
values ('espera@ucanet.test', 'seed-local')
on conflict (email) do nothing;

-- -----------------------------------------------------------------------------
-- 12. Resumen
-- -----------------------------------------------------------------------------
do $$
declare
  n_users     int;
  n_materias  int;
  n_posts     int;
  n_comments  int;
  n_resources int;
begin
  select count(*) into n_users     from public.profiles;
  select count(*) into n_materias  from public.materias;
  select count(*) into n_posts     from public.posts;
  select count(*) into n_comments  from public.comments;
  select count(*) into n_resources from public.resources;

  raise notice '---------------------------------------------------------------';
  raise notice 'uca.net · FIXTURES LOCALES CARGADAS (nunca en producción)';
  raise notice '  % perfiles · % materias · % posts · % comentarios · % recursos',
    n_users, n_materias, n_posts, n_comments, n_resources;
  raise notice '  Contraseña de todas las cuentas: ucanet-local-2026';
  raise notice '  fundador@ucanet.test (admin) · mod@ucanet.test (mod)';
  raise notice '  ana@ucanet.test · bruno@ucanet.test';
  raise notice '  Invitación de prueba: /invitacion/devinv01';
  raise notice '---------------------------------------------------------------';
end
$$;
