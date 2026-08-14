-- =============================================================================
-- 09_feed_para_vos — "Para vos", "Tendencias" y guardados (migración 0015)
-- =============================================================================
-- La 0015 agrega el único feed personalizado del producto, y lo hace bajo dos
-- límites que no se negocian. Este archivo existe para que esos dos límites
-- sean verificables y no una promesa escrita en un comentario:
--
--   · CERO TRACKING. El ranking solo puede mirar señales que YA existen como
--     contenido: materia_follows, post_votes, comments y la carrera del propio
--     llamante (PART 24 §24.1 prohíbe el log de conducta por usuario, y §0.1/C3
--     lo eleva a identidad del producto). Acá se prueba por el resultado: con
--     un follow y un voto alcanza para que aparezcan 'seguis' y 'te_interesa',
--     y sin sesión no hay nada que calcular.
--
--   · EXPLICABLE EN UNA ORACIÓN (PART 12 §12.3). Por eso feed_para_vos devuelve
--     `motivo`. Se afirma que TODA fila trae un motivo del vocabulario cerrado
--     y que el multiplicador que movió la fila es el que el motivo declara: si
--     alguna vez dejan de coincidir, la UI estaría explicando una razón falsa.
--
-- Y encima de todo eso, la regla que no cambia nunca (D3, D14.5): las tres
-- funciones emiten filas construidas sobre posts_public, así que el contenido
-- anónimo sale sin autor y `author_id` no existe en ningún retorno.
--
-- ESCENARIO. Todas las publicaciones son de pgtap_bruno; ana es la lectora con
-- señales (sigue una materia, votó una publicación) y bruno la lectora sin
-- ninguna. Ninguna cuenta tiene carrera, así que la rama 'tu_carrera' queda
-- deliberadamente fuera de juego y el escalón que se mide es 2,0 contra 1,5
-- contra 1,0. h = horas de antigüedad (created_at = last_activity_at en todas,
-- salvo lo que diga la fila), E = score + 2*comments_count, base = la fórmula de
-- §12.3 verbatim: (10 + least(E, 40)) / (h + 2)^1.5.
--
--   public_id    materia      h    score  com  E    base      para qué está
--   pgtapfvan1   anon         1     5     0    5    2,88675   anonimato (anónima)
--   pgtapfvfi1   anon         1     5     0    5    2,88675   anonimato (firmada)
--   pgtapfvsig   seguida      5     4     0    4    0,75593   afinidad 2,0
--   pgtapfvnos   suelta       5     4     0    4    0,75593   afinidad 1,0 (testigo)
--   pgtapfvvot   votada       6     3     0    3    0,57453   la que ana votó
--   pgtapfvint   votada       5     4     0    4    0,75593   afinidad 1,5
--   pgtapfvd01…05 densa       3     8     0    8    1,60997   diversidad (cinco)
--   pgtapfvr01…02 rival       3     6     0    6    1,43109   diversidad (rivales)
--   pgtapfvnew   tendencia    4    20     0   20    2,04127   tendencias (reciente)
--   pgtapfvold   tendencia   40    20     2   24    0,12491   tendencias (viejo)
--   pgtapfvvie   tendencia   72    50     0   50→40 0,07855   fuera de las 48 h
--   pgtapfvcer   tendencia    3     0     0    0    0,89443   engagement cero
--   pgtapfvbaj   suelta       2     0     0    —    —         guardada y eliminada
--
-- Las cinco de la materia densa valen 1,60997 cada una y las dos rivales
-- 1,43109: sin penalidad de diversidad las cinco barrerían con las dos. Con la
-- penalidad, de la tercera fila en adelante el puntaje se divide por el número
-- de fila (1,60997/3 = 0,53666; /4 = 0,40249; /5 = 0,32199) y las rivales se
-- meten en el medio. Eso es exactamente lo que se afirma en la sección C.
-- =============================================================================
begin;
set local search_path = public, extensions, tests;

select plan(56);


-- -----------------------------------------------------------------------------
-- Fixtures
-- -----------------------------------------------------------------------------
select tests.create_user('pgtap_ana');
select tests.create_user('pgtap_bruno');

-- El corpus que ya estaba en la base local (supabase/seed.sql y cualquier otro
-- fixture de desarrollo) se empuja fuera de las dos ventanas — los 30 días de
-- feed_para_vos y las 48 h de feed_tendencias — para que el ORDEN que se afirma
-- más abajo dependa únicamente de las filas de este archivo. Es un UPDATE dentro
-- de la transacción del test: muere con el rollback final, igual que todo lo
-- demás. Va ANTES de insertar los fixtures propios, así no los toca.
update public.posts
   set created_at       = now() - interval '400 days',
       last_activity_at = now() - interval '400 days';

insert into public.materias (slug, nombre) values
  ('pgtap-fv-anon',      'Materia pgTAP de anonimato'),
  ('pgtap-fv-seguida',   'Materia pgTAP que ana sigue'),
  ('pgtap-fv-suelta',    'Materia pgTAP que nadie sigue'),
  ('pgtap-fv-votada',    'Materia pgTAP donde ana ya votó'),
  ('pgtap-fv-densa',     'Materia pgTAP en pleno parcial'),
  ('pgtap-fv-rival',     'Materia pgTAP que compite'),
  ('pgtap-fv-tendencia', 'Materia pgTAP de tendencias');

-- Todas las publicaciones son de bruno: ana es la lectora, así ninguna afinidad
-- se confunde con autoría propia. created_at = last_activity_at en todas, así
-- que h_eff es exactamente `horas` y la aritmética del encabezado es verificable
-- a mano. now() es constante dentro de la transacción y se pasa el MISMO now()
-- como p_now, así que las diferencias son horas exactas y las igualdades de
-- punto flotante de más abajo son legítimas.
insert into public.posts (
  public_id, author_id, materia_id, body, is_anonymous,
  score, comments_count, status, created_at, last_activity_at
)
select v.public_id, tests.user_id('pgtap_bruno'), m.id, v.body, v.is_anonymous,
       v.score, v.comments_count, v.status,
       now() - make_interval(hours => v.horas),
       now() - make_interval(hours => v.horas)
  from (values
    -- Anonimato: dos filas gemelas de la misma materia, una anónima y una firmada.
    ('pgtapfvan1'::text, 'pgtap-fv-anon'::text,
     'publicacion anonima de bruno'::text,              true,   5, 0, 'activo'::text,  1),
    ('pgtapfvfi1', 'pgtap-fv-anon',
     'publicacion firmada de bruno',                    false,  5, 0, 'activo',        1),
    -- Afinidad: mismas señales y misma antigüedad, distinta materia.
    ('pgtapfvsig', 'pgtap-fv-seguida',
     'post de la materia que ana sigue',                false,  4, 0, 'activo',        5),
    ('pgtapfvnos', 'pgtap-fv-suelta',
     'post equivalente de una materia suelta',          false,  4, 0, 'activo',        5),
    ('pgtapfvvot', 'pgtap-fv-votada',
     'post que ana voto alguna vez',                    false,  3, 0, 'activo',        6),
    ('pgtapfvint', 'pgtap-fv-votada',
     'otro post de esa misma materia',                  false,  4, 0, 'activo',        5),
    -- Diversidad: cinco de una materia contra dos de otra, mismas fechas.
    ('pgtapfvd01', 'pgtap-fv-densa', 'materia en parcial, hilo 1',  false,  8, 0, 'activo', 3),
    ('pgtapfvd02', 'pgtap-fv-densa', 'materia en parcial, hilo 2',  false,  8, 0, 'activo', 3),
    ('pgtapfvd03', 'pgtap-fv-densa', 'materia en parcial, hilo 3',  false,  8, 0, 'activo', 3),
    ('pgtapfvd04', 'pgtap-fv-densa', 'materia en parcial, hilo 4',  false,  8, 0, 'activo', 3),
    ('pgtapfvd05', 'pgtap-fv-densa', 'materia en parcial, hilo 5',  false,  8, 0, 'activo', 3),
    ('pgtapfvr01', 'pgtap-fv-rival', 'otra materia compitiendo, 1', false,  6, 0, 'activo', 3),
    ('pgtapfvr02', 'pgtap-fv-rival', 'otra materia compitiendo, 2', false,  6, 0, 'activo', 3),
    -- Tendencias: el viejo acumuló MÁS engagement que el reciente (24 contra 20).
    ('pgtapfvnew', 'pgtap-fv-tendencia',
     'reciente con mucho movimiento',                   false, 20, 0, 'activo',        4),
    ('pgtapfvold', 'pgtap-fv-tendencia',
     'viejo con mas engagement acumulado',              false, 20, 2, 'activo',       40),
    ('pgtapfvvie', 'pgtap-fv-tendencia',
     'de hace tres dias y con cincuenta votos',         false, 50, 0, 'activo',       72),
    ('pgtapfvcer', 'pgtap-fv-tendencia',
     'reciente y sin nada de engagement',               false,  0, 0, 'activo',        3),
    -- Guardados: una publicación que ana guarda y que después se elimina.
    ('pgtapfvbaj', 'pgtap-fv-suelta',
     'guardada y despues eliminada por su autor',       false,  0, 0, 'eliminado_autor', 2)
  ) as v(public_id, materia_slug, body, is_anonymous,
         score, comments_count, status, horas)
  join public.materias m on m.slug = v.materia_slug;

-- Las DOS únicas señales de afinidad de ana, y las dos son contenido que ya
-- existía: un follow explícito y un voto explícito. No hay ninguna tabla de
-- impresiones ni de vistas que alimentar, porque no existe (PART 24 §24.1).
insert into public.materia_follows (user_id, materia_id)
select tests.user_id('pgtap_ana'), m.id
  from public.materias m
 where m.slug = 'pgtap-fv-seguida';

insert into public.post_votes (post_id, user_id)
select p.id, tests.user_id('pgtap_ana')
  from public.posts p
 where p.public_id = 'pgtapfvvot';

-- Marcadores. Se insertan con created_at explícito porque dentro de una
-- transacción now() es constante: sin fechas distintas, el orden por saved_at no
-- probaría nada. Ana guarda la firmada hace 10 minutos y la anónima hace 2 horas
-- — al revés del orden por fecha de publicación, para que la afirmación sobre el
-- orden de la lista distinga una cosa de la otra.
insert into public.bookmarks (user_id, post_id, created_at)
select tests.user_id('pgtap_ana'), p.id, v.guardado
  from (values ('pgtapfvsig'::text, now() - interval '10 minutes'),
               ('pgtapfvan1',       now() - interval '2 hours'),
               ('pgtapfvbaj',       now() - interval '1 hour')) as v(public_id, guardado)
  join public.posts p on p.public_id = v.public_id;

insert into public.bookmarks (user_id, post_id, created_at)
select tests.user_id('pgtap_bruno'), p.id, now() - interval '30 minutes'
  from public.posts p
 where p.public_id = 'pgtapfvnos';


-- -----------------------------------------------------------------------------
-- A. Anonimato: el feed nuevo no abre una puerta nueva (8)
-- -----------------------------------------------------------------------------
-- Las tres funciones construyen sus filas sobre posts_public, así que heredan el
-- anulado de la vista. Eso hay que probarlo igual: una función SECURITY DEFINER
-- que mañana lea `public.posts` directo para "resolver un join" volvería a tener
-- author_id a mano, y nadie se daría cuenta hasta que salga en un payload.
select tests.authenticate_as('pgtap_ana');

select is((select f.author_handle from public.feed_para_vos(now(), 50) f
            where f.public_id = 'pgtapfvan1'),
          null::text,
          'feed_para_vos no emite ningún autor en una publicación anónima');

select is((select f.author_handle from public.feed_para_vos(now(), 50) f
            where f.public_id = 'pgtapfvfi1'),
          'pgtap_bruno',
          'feed_para_vos sí emite el seudónimo cuando la publicación está firmada (mitad "permite")');

select ok((select f.is_anonymous from public.feed_para_vos(now(), 50) f
            where f.public_id = 'pgtapfvan1'),
          'la bandera is_anonymous sí viaja: la etiqueta "Anónimo" es pública, la identidad no');

select is((select f.author_handle from public.feed_tendencias(now(), 50) f
            where f.public_id = 'pgtapfvan1'),
          null::text,
          'feed_tendencias tampoco emite autor en contenido anónimo');

select is((select f.author_handle from public.feed_tendencias(now(), 50) f
            where f.public_id = 'pgtapfvfi1'),
          'pgtap_bruno',
          'y sí lo emite en la publicación firmada: la regla es la del contenido, no la del feed');

select is_empty(
  $$ select f.public_id from public.feed_para_vos(now(), 50) f
      where f.is_anonymous and f.author_handle is not null $$,
  'ninguna fila anónima de feed_para_vos trae seudónimo (§25.1 ítem 1, ahora sobre el feed nuevo)'
);

select is_empty(
  $$ select f.public_id from public.feed_tendencias(now(), 50) f
      where f.is_anonymous and f.author_handle is not null $$,
  'ninguna fila anónima de feed_tendencias trae seudónimo'
);

-- Estructural: las columnas de salida de una función `returns table` viven en
-- pg_proc.proargnames junto con sus parámetros. Si alguna vez alguien agrega
-- author_id "para el join del cliente", esto lo caza antes que el code review.
select is_empty(
  $$
    select p.proname || '.' || a.name
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      cross join lateral unnest(coalesce(p.proargnames, '{}'::text[])) as a(name)
     where n.nspname = 'public'
       and p.proname in ('feed_para_vos', 'feed_tendencias', 'feed_guardados')
       and a.name in ('author_id', 'author_uuid', 'user_id', 'email')
  $$,
  'ninguna de las tres funciones nuevas declara una columna de autoría interna ni de contacto'
);


-- -----------------------------------------------------------------------------
-- B. Afinidad: por qué subió esta fila, y cuánto (10)
-- -----------------------------------------------------------------------------
-- Ana sigue 'pgtap-fv-seguida' y votó una publicación de 'pgtap-fv-votada'. Nada
-- más. Con eso alcanza para las tres etiquetas que puede haber acá, y las tres
-- se miden contra el MISMO testigo (pgtapfvnos: misma antigüedad, mismo score,
-- ninguna afinidad), así que los cocientes son el multiplicador y nada más.
select is_empty(
  $$ select f.public_id from public.feed_para_vos(now(), 50) f
      where f.motivo is null
         or f.motivo not in ('seguis', 'te_interesa', 'tu_carrera', 'descubrimiento') $$,
  'toda fila trae un motivo del vocabulario cerrado: una fila que no se puede explicar en una oración no debería estar en el feed (§12.3)'
);

select ok(
  (select abs(f.rank - (14::double precision / power(7::double precision, 1.5))) < 1e-9
     from public.feed_para_vos(now(), 50) f
    where f.public_id = 'pgtapfvnos'),
  'una fila sin afinidad vale exactamente (10 + E) / (h_eff + 2)^1.5: la fórmula de §12.3 entra intacta, sin una constante cambiada');

select is((select f.motivo from public.feed_para_vos(now(), 50) f
            where f.public_id = 'pgtapfvsig'),
          'seguis',
          'la publicación de una materia seguida se explica con "seguis"');

select is((select f.motivo from public.feed_para_vos(now(), 50) f
            where f.public_id = 'pgtapfvnos'),
          'descubrimiento',
          'y la equivalente de una materia suelta, con "descubrimiento"');

select ok(
  (select (max(f.rank) filter (where f.public_id = 'pgtapfvsig'))
        > (max(f.rank) filter (where f.public_id = 'pgtapfvnos'))
     from public.feed_para_vos(now(), 50) f),
  'con el mismo score y la misma antigüedad, la publicación de la materia que seguís rankea por encima de la que no');

select ok(
  (select abs( (max(f.rank) filter (where f.public_id = 'pgtapfvsig'))
             / (max(f.rank) filter (where f.public_id = 'pgtapfvnos')) - 2.0) < 1e-9
     from public.feed_para_vos(now(), 50) f),
  'y por exactamente 2,0: el techo del multiplicador es chico a propósito, reordena entre publicaciones de edad parecida y no resucita lo viejo');

select is((select f.motivo from public.feed_para_vos(now(), 50) f
            where f.public_id = 'pgtapfvint'),
          'te_interesa',
          'un voto viejo alcanza para etiquetar "te_interesa" a otra publicación de esa materia: la señal ya existía como contenido, no hay tabla de conducta que consultar');

select ok(
  (select abs( (max(f.rank) filter (where f.public_id = 'pgtapfvint'))
             / (max(f.rank) filter (where f.public_id = 'pgtapfvnos')) - 1.5) < 1e-9
     from public.feed_para_vos(now(), 50) f),
  'y ese motivo vale 1,5, no 2,0: el multiplicador que se aplicó es el que el motivo declara');

-- La otra dirección: el impulso es del lector, no del post. La misma fila, para
-- alguien que no sigue nada, no vale más que su testigo.
select tests.authenticate_as('pgtap_bruno');

select is((select f.motivo from public.feed_para_vos(now(), 50) f
            where f.public_id = 'pgtapfvsig'),
          'descubrimiento',
          'para quien no sigue esa materia la misma publicación es descubrimiento: la afinidad la pone el lector');

select ok(
  (select abs( (max(f.rank) filter (where f.public_id = 'pgtapfvsig'))
             - (max(f.rank) filter (where f.public_id = 'pgtapfvnos'))) < 1e-9
     from public.feed_para_vos(now(), 50) f),
  'y las dos filas equivalentes pesan exactamente lo mismo para él');


-- -----------------------------------------------------------------------------
-- C. Diversidad: una materia en pleno parcial no se come el feed (5)
-- -----------------------------------------------------------------------------
-- Se corre como bruno, que no tiene ninguna señal: así el multiplicador de las
-- siete publicaciones es 1,0 y lo ÚNICO que reordena es la penalidad de
-- row_number(). Las afirmaciones hablan de la distribución de puntajes dentro de
-- cada materia, no de qué id le tocó a cuál, para que no dependan del orden en
-- que la base asignó los identity.
select tests.authenticate_as('pgtap_bruno');

select ok(
  (select (select max(d.rank) from public.feed_para_vos(now(), 50) d
            where d.public_id like 'pgtapfvd%')
        > (select max(r.rank) from public.feed_para_vos(now(), 50) r
            where r.public_id like 'pgtapfvr%')),
  'las dos primeras de la materia densa sí le ganan a la otra materia: antes de la tercera fila no hay penalidad que aplicar');

select ok(
  (select (select max(r.rank) from public.feed_para_vos(now(), 50) r
            where r.public_id like 'pgtapfvr%')
        > (select d.rank from public.feed_para_vos(now(), 50) d
            where d.public_id like 'pgtapfvd%'
            order by d.rank desc offset 2 limit 1)),
  'pero de la tercera en adelante la materia rival pasa por encima, aunque tenga menos votos');

select ok(
  (select abs( (select max(d.rank) from public.feed_para_vos(now(), 50) d
                 where d.public_id like 'pgtapfvd%')
             / (select d.rank from public.feed_para_vos(now(), 50) d
                 where d.public_id like 'pgtapfvd%'
                 order by d.rank desc offset 2 limit 1) - 3.0) < 1e-9),
  'la penalidad es exactamente el número de fila: la tercera publicación de la materia vale un tercio');

select ok(
  (select abs(max(d.rank) / min(d.rank) - 5.0) < 1e-9
     from public.feed_para_vos(now(), 50) d
    where d.public_id like 'pgtapfvd%'),
  'y escala con la fila: la quinta vale un quinto');

select is(
  (select (count(*) filter (where t.public_id like 'pgtapfvd%'))::int
     from (select f.public_id
             from public.feed_para_vos(now(), 50) f
            where f.public_id like 'pgtapfvd%'
               or f.public_id like 'pgtapfvr%'
            order by f.rank desc, f.id desc
            limit 5) t),
  3,
  'con siete publicaciones compitiendo, las cinco de la misma materia ocupan solo TRES de los cinco primeros lugares: sin la penalidad barrerían con las cinco');


-- -----------------------------------------------------------------------------
-- D. Paginación: el cursor keyset no repite ni saltea (2)
-- -----------------------------------------------------------------------------
-- El contrato con el frontend pide (p_now, p_after_rank, p_after_id) y el corte
-- es `(rank, id) < (cursor)` sobre un puntaje que se recalcula en cada llamada:
-- por eso p_now viaja EN el cursor (§12.4). Si no viajara, la segunda página se
-- puntuaría con otro reloj y el scroll repetiría o saltearía filas. Se pide una
-- primera página de UNA fila y se usa esa misma fila como cursor de la segunda,
-- que es exactamente lo que hace la pantalla.
select isnt(
  (select p2.public_id
     from public.feed_para_vos(now(), 1) p1
     cross join lateral public.feed_para_vos(now(), 1, p1.rank, p1.id) p2),
  (select p1.public_id from public.feed_para_vos(now(), 1) p1),
  'la segunda página no repite la fila con la que se cortó');

select is(
  (select p2.public_id
     from public.feed_para_vos(now(), 1) p1
     cross join lateral public.feed_para_vos(now(), 1, p1.rank, p1.id) p2),
  (select f.public_id from public.feed_para_vos(now(), 50) f
    order by f.rank desc, f.id desc offset 1 limit 1),
  'y arranca exactamente en la fila siguiente del orden completo: tampoco saltea ninguna');


-- -----------------------------------------------------------------------------
-- E. Sin sesión: el feed degrada, no falla (5)
-- -----------------------------------------------------------------------------
select tests.authenticate_as_anon();

select lives_ok('select * from public.feed_para_vos(now())',
                'un visitante sin cuenta puede pedir "Para vos": auth.uid() null no es un error');

select ok((select count(*) from public.feed_para_vos(now(), 50)) > 0,
          'y le devuelve filas: sin sesión el feed degrada a "lo mejor de los últimos días", no a una lista vacía');

select is_empty(
  $$ select f.public_id from public.feed_para_vos(now(), 50) f
      where f.motivo <> 'descubrimiento' $$,
  'sin sesión todo es descubrimiento: no hay follows, ni votos, ni carrera que mirar'
);

select lives_ok('select * from public.feed_tendencias(now())',
                'tendencias también es pública: no se personaliza, así que no necesita sesión');

select tests.authenticate_as('pgtap_ana');

select isnt_empty(
  $$ select f.public_id from public.feed_para_vos(now(), 50) f
      where f.motivo = 'seguis' $$,
  'la misma consulta, con sesión, sí trae filas etiquetadas "seguis" (mitad "permite")'
);


-- -----------------------------------------------------------------------------
-- F. Tendencias: velocidad, no acumulación (7)
-- -----------------------------------------------------------------------------
-- velocidad = (score + 2*comments_count) / max(horas desde created_at, 2). El
-- caso está armado para que el post viejo tenga MÁS engagement total que el
-- reciente: si igual pierde, es porque la división por antigüedad manda.
select ok(
  (select (max(f.score + 2 * f.comments_count) filter (where f.public_id = 'pgtapfvold'))
        > (max(f.score + 2 * f.comments_count) filter (where f.public_id = 'pgtapfvnew'))
     from public.feed_tendencias(now(), 50) f),
  'premisa del caso: el viejo acumuló más engagement que el reciente (24 contra 20)');

select ok(
  (select (max(f.velocidad) filter (where f.public_id = 'pgtapfvnew'))
        > (max(f.velocidad) filter (where f.public_id = 'pgtapfvold'))
     from public.feed_tendencias(now(), 50) f),
  'y aun así el reciente le gana: un post de hace 40 h con más votos no le gana a uno de hace 4 h');

select is(
  (select f.public_id from public.feed_tendencias(now(), 50) f
    order by f.velocidad desc, f.id desc limit 1),
  'pgtapfvnew',
  'la lista la encabeza el reciente: "qué se está moviendo ahora", no "qué juntó más votos"');

select ok(
  (select abs(f.velocidad - 0.6) < 1e-9
     from public.feed_tendencias(now(), 50) f
    where f.public_id = 'pgtapfvold'),
  'velocidad del viejo = (20 + 2*2) / 40 h = 0,6: el comentario pesa el doble que el voto, igual que en §12.3');

select ok(
  (select abs(f.velocidad - 2.5) < 1e-9
     from public.feed_tendencias(now(), 50) f
    where f.public_id = 'pgtapfvan1'),
  'y el piso de 2 h en el denominador funciona: 5 votos en 1 h dan 2,5, no 5,0 — un post de diez minutos no marca una velocidad absurda');

select is_empty(
  $$ select f.public_id from public.feed_tendencias(now(), 50) f
      where f.public_id = 'pgtapfvvie' $$,
  'una publicación de hace 72 h no vuelve por muchos votos que tenga: la ventana es de 48 h'
);

select is_empty(
  $$ select f.public_id from public.feed_tendencias(now(), 50) f
      where f.public_id = 'pgtapfvcer' $$,
  'y una reciente sin nada de engagement tampoco entra: tendencias no es una lista de ceros'
);


-- -----------------------------------------------------------------------------
-- G. Guardados: la lista es de quien llama y de nadie más (10)
-- -----------------------------------------------------------------------------
-- feed_guardados es SECURITY DEFINER, así que la RLS de bookmarks NO la protege:
-- el filtro por auth.uid() de adentro de la función es lo ÚNICO que separa los
-- guardados de una persona de los de otra. Por eso se prueba por resultado y en
-- las dos direcciones.
select tests.authenticate_as('pgtap_ana');

select is((select count(*)::int from public.feed_guardados()),
          2,
          'feed_guardados devuelve las publicaciones vivas que guardó quien llama (ana tiene tres marcadores, uno apunta a una publicación eliminada)');

select is(
  (select string_agg(f.public_id, ',' order by f.saved_at desc, f.id desc)
     from public.feed_guardados() f),
  'pgtapfvsig,pgtapfvan1',
  'y las ordena por fecha de GUARDADO descendente, no por la fecha de la publicación');

select is_empty(
  $$ select f.public_id from public.feed_guardados() f
      where f.public_id = 'pgtapfvnos' $$,
  'lo que guardó otro usuario no aparece en la lista propia'
);

select is((select f.saved_at from public.feed_guardados() f
            where f.public_id = 'pgtapfvsig'),
          now() - interval '10 minutes',
          'saved_at es la fecha del marcador, no la de la publicación: es lo que ordena la lista y lo que compara el cursor');

select is((select f.author_handle from public.feed_guardados() f
            where f.public_id = 'pgtapfvan1'),
          null::text,
          'la lista de guardados obedece la misma regla de anonimato que el resto del sitio');

select is_empty(
  $$ select f.public_id from public.feed_guardados() f
      where f.public_id = 'pgtapfvbaj' $$,
  'una publicación eliminada desaparece de la lista: el join es contra posts_public'
);

select tests.clear_authentication();

select is((select count(*)::int
             from public.bookmarks b
             join public.posts p on p.id = b.post_id
            where p.public_id = 'pgtapfvbaj'),
          1,
          'pero el marcador sigue ahí: si moderación restaura la publicación, el guardado vuelve solo');

select tests.authenticate_as('pgtap_bruno');

select is(
  (select string_agg(f.public_id, ',' order by f.saved_at desc, f.id desc)
     from public.feed_guardados() f),
  'pgtapfvnos',
  'otro usuario recibe exactamente sus propios guardados y ninguno de los tres de ana');

select tests.authenticate_no_session();

select throws_ok('select * from public.feed_guardados()',
                 'P0001', 'NOT_AUTHENTICATED',
                 'sin sesión aborta con NOT_AUTHENTICATED en vez de devolver un vacío mentiroso: la pantalla tiene que poder mandar a /ingresar');

select tests.authenticate_as_anon();

-- anon no tiene grant de execute sobre feed_guardados (a diferencia de los otros
-- dos feeds): no llega ni a evaluar la sesión.
select throws_ok('select * from public.feed_guardados()', '42501');


-- -----------------------------------------------------------------------------
-- H. bookmarks: RLS en las dos direcciones (9)
-- -----------------------------------------------------------------------------
-- La segunda y última tabla del esquema que se escribe por política y no por RPC
-- (§8.3.4, §8.11). La contracara de esa comodidad es que las políticas son la
-- única pared: se prueba que permiten lo propio y que niegan lo ajeno.
select tests.clear_authentication();

select ok(
  (select c.relrowsecurity
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'bookmarks'),
  'bookmarks tiene RLS habilitada');

select is((select count(*)::int from pg_policy p
            where p.polrelid = 'public.bookmarks'::regclass),
          3,
          'y exactamente tres políticas —select, insert y delete de las filas propias—: no hay update porque un marcador no tiene nada que actualizar');

select tests.authenticate_as('pgtap_bruno');

-- Guardar en nombre de otro: la WITH CHECK de bookmarks_insert_own lo corta con
-- 42501 (violación de política), no con un conflicto de clave.
select throws_ok(
  $$ insert into public.bookmarks (user_id, post_id)
     select tests.user_id('pgtap_ana'), p.id
       from public.posts_public p
      where p.public_id = 'pgtapfvnos' $$,
  '42501');

select lives_ok(
  $$ insert into public.bookmarks (user_id, post_id)
     select auth.uid(), p.id
       from public.posts_public p
      where p.public_id = 'pgtapfvsig' $$,
  'la mitad "permite": cada uno sí guarda con su propio user_id');

select is((select count(*)::int from public.bookmarks),
          2,
          'la política de select solo muestra las filas propias: bruno ve sus dos marcadores y ninguno de los tres de ana');

select throws_ok('update public.bookmarks set created_at = now()', '42501');

-- Un DELETE de filas ajenas no es un error: la política las filtra ANTES, así
-- que la sentencia corre y no toca nada. Por eso hace falta la afirmación de
-- abajo, que es la que prueba que efectivamente no borró nada.
select lives_ok(
  $$ delete from public.bookmarks where user_id = tests.user_id('pgtap_ana') $$,
  'borrar marcadores ajenos no levanta error: la política de delete los filtra antes de tocarlos');

select tests.clear_authentication();

select is((select count(*)::int from public.bookmarks b
            where b.user_id = tests.user_id('pgtap_ana')),
          3,
          'y no borró ninguno: los tres marcadores de ana siguen enteros');

select tests.authenticate_as_anon();

select throws_ok('select 1 from public.bookmarks', '42501');


select * from finish();
rollback;
