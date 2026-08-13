-- =============================================================================
-- 00_setup — infraestructura compartida de la suite pgTAP
-- =============================================================================
-- PART 25 §25.1: la suite de base de datos es la capa crítica del pirámide de
-- tests, porque la RLS es la única pared entre el anonimato y la exposición
-- (D14.2: toda política tiene un test que prueba el permitir Y un test que
-- prueba el denegar).
--
-- ██  ESTE ARCHIVO SOLO SE APLICA A LA BASE LOCAL / DE CI.  ██
-- Crea un esquema `tests` con funciones SECURITY DEFINER que escriben en
-- auth.users, abren el registro y leen anon_aliases. Aplicarlo contra un
-- proyecto hosteado sería regalar una puerta trasera al mapeo de anonimato.
-- Se ejecuta únicamente con `supabase test db` contra 127.0.0.1:54322.
--
-- FORMA DE ESTE ARCHIVO (distinta a la del resto de la suite):
--   1. Un bloque DDL fuera de transacción: crea el esquema `tests`, la tabla
--      de fixtures y los helpers. psql lo autocommitea, así que 01..08 lo
--      encuentran ya cargado. Todo es idempotente (`if not exists` /
--      `create or replace`): correrlo dos veces no rompe nada.
--   2. Un bloque `begin; select plan(N); ... rollback;` que se autotestea. Es
--      un archivo de la suite como cualquier otro y tiene que emitir TAP.
--
-- CÓMO SE ACTÚA COMO UN ROL (el mecanismo que usan 02..08):
--   select tests.authenticate_as('pgtap_ana');   -- role authenticated + JWT
--   select tests.authenticate_as_anon();         -- role anon, sin sesión
--   select tests.authenticate_no_session();      -- authenticated sin claims
--   select tests.clear_authentication();         -- vuelta a postgres
--   Los helpers usan set_config(..., is_local => true), que es exactamente
--   `set local`: todo muere con el rollback del archivo.
--
-- POR QUÉ LAS CUENTAS NACEN "T2" (created_at = now() - 60 días):
--   public.rate_limit_for() clasifica por antigüedad (PART 11 §11.6.2). Una
--   cuenta recién creada es T0 y solo puede publicar 1 post por hora, lo que
--   haría fallar cualquier fixture con dos publicaciones. El default es T2
--   (establecida) y quien quiera probar el límite pide created_at => now().
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. pgTAP y permisos para poder afirmar desde un rol de aplicación
-- -----------------------------------------------------------------------------
create extension if not exists pgtap with schema extensions;

-- Los tests corren `select throws_ok(...)` DESPUÉS de hacerse pasar por
-- authenticated/anon, así que esos roles necesitan poder ejecutar las funciones
-- de pgTAP. Es un grant de andamiaje sobre el esquema `extensions`, no sobre
-- `public`: no afloja ninguna de las afirmaciones de 02_grants ni 04_functions_meta,
-- que solo miran objetos de `public`.
grant usage on schema extensions to anon, authenticated;
grant execute on all functions in schema extensions to anon, authenticated;


-- -----------------------------------------------------------------------------
-- 2. Esquema tests + tabla de fixtures
-- -----------------------------------------------------------------------------
create schema if not exists tests;

comment on schema tests is
  'Andamiaje de la suite pgTAP (PART 25 §25.1). Solo existe en la base local y en CI: sus funciones SECURITY DEFINER crean usuarios en auth.users y leen anon_aliases, que es la tabla que el producto entero existe para proteger. Nunca se aplica a producción.';

grant usage on schema tests to public;

create table if not exists tests.fixtures (
  key   text primary key,
  value text
);

comment on table tests.fixtures is
  'Memoria de un test: guarda ids que una RPC devuelve (public_id, uuid, bigint) para poder usarlos en afirmaciones posteriores sin variables de psql. Se escribe dentro de la transacción del test y muere con su rollback. Sin grants: se llega por tests.remember()/tests.recall().';


-- -----------------------------------------------------------------------------
-- 3. Helpers de fixtures
-- -----------------------------------------------------------------------------

create or replace function tests.open_signups()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  -- handle_new_user (migración 0004) aborta el alta sin invitación salvo que el
  -- kill-switch registro_abierto esté en true. Los tests no arman un árbol de
  -- invitaciones: abren el portón dentro de su propia transacción.
  insert into public.app_settings (key, value)
  values ('registro_abierto', 'true'::jsonb)
  on conflict (key) do update set value = 'true'::jsonb;
$$;

comment on function tests.open_signups() is
  'Prende el kill-switch registro_abierto para que insertar en auth.users no muera con INVITE_INVALID. Local a la transacción del test.';


create or replace function tests.create_user(
  p_handle     text,
  p_role       text        default 'user',
  p_status     text        default 'activo',
  p_created_at timestamptz default null,
  p_carrera_id bigint      default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid := gen_random_uuid();
  v_at timestamptz := coalesce(p_created_at, now() - interval '60 days');
begin
  perform tests.open_signups();

  -- El alta pasa por el trigger real handle_new_user: crea el perfil con handle
  -- placeholder `estudiante_*` y status 'nuevo'. Después se lo lleva al estado
  -- que el test necesita, que es lo que haría complete_onboarding.
  insert into auth.users (
    id, instance_id, aud, role, email,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) values (
    v_id,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated', 'authenticated',
    lower(p_handle) || '@pgtap.test',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('pgtap_handle', p_handle),
    v_at, now()
  );

  update public.profiles
     set handle     = p_handle::extensions.citext,
         role       = p_role,
         status     = p_status,
         carrera_id = p_carrera_id,
         created_at = v_at
   where id = v_id;

  return v_id;
end;
$$;

comment on function tests.create_user(text, text, text, timestamptz, bigint) is
  'Crea una cuenta de prueba: fila en auth.users (el trigger handle_new_user hace el perfil) y después el perfil queda con el handle, rol, status y created_at pedidos. created_at default = hace 60 días, o sea tier T2 (PART 11 §11.6.2): pasá now() para probar los límites de una cuenta nueva.';


create or replace function tests.user_id(p_handle text)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  -- Con search_path = public, pg_temp los operadores de citext (que viven en
  -- `extensions`) no son visibles: se nombra el operador, como en assert_handle_ok.
  select p.id
    from public.profiles p
   where p.handle operator(extensions.=) p_handle::extensions.citext;
$$;

comment on function tests.user_id(text) is
  'uuid del perfil con ese seudónimo, o null. SECURITY DEFINER porque los tests lo llaman también desde un rol al que la RLS de profiles solo le muestra su propia fila.';


create or replace function tests.remember(p_key text, p_value text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into tests.fixtures (key, value)
  values (p_key, p_value)
  on conflict (key) do update set value = excluded.value;
  return p_value;
end;
$$;

comment on function tests.remember(text, text) is
  'Guarda un valor (public_id devuelto por una RPC, uuid, id) bajo una clave y lo devuelve, para poder envolver la llamada: select tests.remember(''p1'', public.create_post(''x'')).';


create or replace function tests.recall(p_key text)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select f.value from tests.fixtures f where f.key = p_key;
$$;

comment on function tests.recall(text) is 'Recupera lo guardado con tests.remember().';


create or replace function tests.recall_uuid(p_key text)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select tests.recall(p_key)::uuid;
$$;

comment on function tests.recall_uuid(text) is 'tests.recall() casteado a uuid.';


create or replace function tests.recall_id(p_key text)
returns bigint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select tests.recall(p_key)::bigint;
$$;

comment on function tests.recall_id(text) is 'tests.recall() casteado a bigint (ids internos de mod_actions, appeals, reports).';


create or replace function tests.alias_num(p_post_public_id text, p_handle text)
returns int
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select a.alias_num::int
    from public.anon_aliases a
    join public.posts p     on p.id  = a.post_id
    join public.profiles pr on pr.id = a.author_id
   where p.public_id = p_post_public_id
     and pr.handle operator(extensions.=) p_handle::extensions.citext;
$$;

comment on function tests.alias_num(text, text) is
  'Número de alias de un autor dentro de un hilo, leído directo de anon_aliases. ES LA PUERTA TRASERA que el producto no tiene: existe solo para que 03_anonymity pueda afirmar que el mismo autor NO conserva el número entre hilos. Sin grants: únicamente postgres.';


-- -----------------------------------------------------------------------------
-- 4. Helpers de impersonación
-- -----------------------------------------------------------------------------
-- Los cuatro son SECURITY INVOKER y sin cláusula SET a propósito: un
-- `set_config(..., is_local => true)` hecho dentro de una función CON cláusula
-- SET se revierte al salir de la función. Sin cláusula SET, el valor vive hasta
-- el final de la transacción, que es exactamente lo que el test necesita.

create or replace function tests.authenticate_as(p_handle text)
returns void
language plpgsql
as $$
declare
  v_id uuid := tests.user_id(p_handle);
begin
  if v_id is null then
    raise exception 'pgtap: no existe ningún perfil con el seudónimo %', p_handle;
  end if;
  perform tests.authenticate_as_uuid(v_id);
end;
$$;

comment on function tests.authenticate_as(text) is
  'Actúa como ese usuario: role authenticated + request.jwt.claims con su sub, que es lo que lee auth.uid().';


create or replace function tests.authenticate_as_uuid(p_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_id::text, 'role', 'authenticated')::text,
    true);
  perform set_config('role', 'authenticated', true);
end;
$$;

comment on function tests.authenticate_as_uuid(uuid) is
  'Igual que tests.authenticate_as() pero por uuid. Hace falta después de delete_account: la cuenta eliminada ya no tiene seudónimo por el cual buscarla.';


create or replace function tests.authenticate_no_session()
returns void
language plpgsql
as $$
begin
  -- Rol de aplicación con sesión inválida: auth.uid() devuelve null y las RPC
  -- tienen que cortar con NOT_AUTHENTICATED, no con un permiso denegado.
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'authenticated', true);
end;
$$;

comment on function tests.authenticate_no_session() is
  'role authenticated pero sin JWT: el caso "sesión vencida" que debe terminar en NOT_AUTHENTICATED.';


create or replace function tests.authenticate_as_anon()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'anon', true);
end;
$$;

comment on function tests.authenticate_as_anon() is
  'Visitante sin cuenta: role anon y ningún claim. Es el rol con el que se prueba la lectura pública y el cierre de todo lo demás.';


create or replace function tests.clear_authentication()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', session_user::text, true);
end;
$$;

comment on function tests.clear_authentication() is
  'Vuelve al rol de la sesión (postgres) y borra los claims: se usa antes de cada bloque de verificación que necesita leer tablas base.';


-- -----------------------------------------------------------------------------
-- 5. Grants del andamiaje
-- -----------------------------------------------------------------------------
-- Deny first: solo se abre lo que un test necesita invocar YA convertido en
-- authenticated/anon. create_user, open_signups y alias_num quedan reservados a
-- postgres — alias_num sobre todo, que es una lectura directa del mapeo de
-- anonimato.
revoke all on all functions in schema tests from public;

grant execute on function tests.user_id(text)              to public;
grant execute on function tests.authenticate_as(text)      to public;
grant execute on function tests.authenticate_as_uuid(uuid) to public;
grant execute on function tests.authenticate_no_session()  to public;
grant execute on function tests.authenticate_as_anon()     to public;
grant execute on function tests.clear_authentication()     to public;
grant execute on function tests.remember(text, text)       to public;
grant execute on function tests.recall(text)               to public;
grant execute on function tests.recall_uuid(text)          to public;
grant execute on function tests.recall_id(text)            to public;


-- =============================================================================
-- Autotest del andamiaje: si estos 13 no pasan, el resto de la suite miente.
-- =============================================================================
begin;
set local search_path = public, extensions, tests;

select plan(13);

select ok(exists (select 1 from pg_extension where extname = 'pgtap'),
          'pgTAP está instalada');

select ok(exists (select 1 from pg_namespace where nspname = 'tests'),
          'el esquema tests existe');

select ok(exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                   where n.nspname = 'tests' and c.relname = 'fixtures'),
          'la tabla de memoria tests.fixtures existe');

select tests.create_user('pgtap_setup_a');

select ok(tests.user_id('pgtap_setup_a') is not null,
          'create_user deja un perfil creado por el trigger handle_new_user');

select is((select p.status from public.profiles p where p.id = tests.user_id('pgtap_setup_a')),
          'activo',
          'create_user deja el perfil en activo por defecto');

select is((select p.handle::text from public.profiles p where p.id = tests.user_id('pgtap_setup_a')),
          'pgtap_setup_a',
          'create_user deja el seudónimo pedido, no el placeholder estudiante_*');

select is(public.account_tier(
            (select p.created_at from public.profiles p where p.id = tests.user_id('pgtap_setup_a'))),
          'T2',
          'por defecto la cuenta nace T2: los fixtures no chocan con los límites de una cuenta nueva');

select tests.create_user('pgtap_setup_b', 'user', 'nuevo');

select is((select p.status from public.profiles p where p.id = tests.user_id('pgtap_setup_b')),
          'nuevo',
          'create_user respeta el status pedido (onboarding sin terminar)');

select tests.authenticate_as('pgtap_setup_a');

select is(auth.uid(), tests.user_id('pgtap_setup_a'),
          'authenticate_as fija auth.uid() al usuario pedido');

select tests.authenticate_as_uuid(tests.user_id('pgtap_setup_b'));

select is(auth.uid(), tests.user_id('pgtap_setup_b'),
          'authenticate_as_uuid también fija auth.uid()');

select tests.clear_authentication();

select is(auth.uid(), null::uuid,
          'clear_authentication deja la sesión sin identidad');

select is(tests.remember('pgtap_clave', 'valor recordado'),
          'valor recordado',
          'remember devuelve el valor para poder envolver la llamada que lo produce');

select is(tests.recall('pgtap_clave'), 'valor recordado',
          'recall devuelve lo que remember guardó');

select * from finish();
rollback;
