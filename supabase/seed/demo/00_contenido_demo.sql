-- =====================================================================================
-- CONTENIDO DE DEMOSTRACIÓN — NO ES PARTE DEL PRODUCTO
--
-- Existe por una sola razón: un feed vacío no se puede evaluar. Para ver si "Para vos"
-- rankea bien, si los alias anónimos son coherentes dentro de un hilo, o si la búsqueda
-- devuelve algo útil, hace falta corpus.
--
-- **BORRALO ANTES DE LA PRIMERA INVITACIÓN REAL.** D11 es explícito: los recursos y las
-- publicaciones de siembra tienen que venir de cuentas reales de gente real, sin señales
-- fabricadas, porque "una comunidad chica y densa se da cuenta" y el carácter de
-- institución no sobrevive a eso. Esto NO es la siembra de D11: es un maniquí.
--
-- Todas las cuentas usan el dominio @demo.ucanet.test y todos los handles arrancan con
-- "demo". Eso hace que la limpieza sea trivial: ver 99_limpiar_demo.sql.
--
-- NO está declarado en config.toml a propósito: `supabase db reset` no lo aplica.
-- Se aplica a mano, y solo cuando querés una demo.
-- =====================================================================================

begin;

-- -------------------------------------------------------------------------------------
-- Cuentas. Se escriben directo en auth.users porque el trigger handle_new_user exige un
-- código de invitación válido y acá no hay quien las emita. La contraseña de todas es
-- "demo-ucanet-2026".
-- -------------------------------------------------------------------------------------
create temporary table _demo_users (
  email  text,
  handle text,
  carrera_slug text,
  ingreso smallint,
  uid uuid default extensions.gen_random_uuid()
) on commit drop;

insert into _demo_users (email, handle, carrera_slug, ingreso) values
  ('sol@demo.ucanet.test',   'demoMateConBizcochos',  'abogacia',        2023),
  ('tomi@demo.ucanet.test',  'demoFiscalDelTercerPiso','abogacia',       2022),
  ('juli@demo.ucanet.test',  'demoApunteDeUltimaHora','abogacia',        2024),
  ('nico@demo.ucanet.test',  'demoCafeDeLaMaquina',   'contador-publico',2023),
  ('flor@demo.ucanet.test',  'demoResumenCompartido', 'contador-publico',2022),
  ('bauti@demo.ucanet.test', 'demoPasilloDeLaFacu',   'abogacia',        2021);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000', u.uid, 'authenticated', 'authenticated', u.email,
  extensions.crypt('demo-ucanet-2026', extensions.gen_salt('bf')), now(),
  now() - interval '60 days', now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
  '', '', '', ''
from _demo_users u;

-- El trigger handle_new_user ya creó un perfil con handle placeholder para cada uno.
-- Acá se completa el onboarding a mano: handle real, carrera, año, status activo.
update public.profiles p
   set handle       = u.handle,
       carrera_id   = c.id,
       ingreso_year = u.ingreso,
       status       = 'activo',
       created_at   = now() - interval '60 days'
  from _demo_users u
  join public.carreras c on c.slug = u.carrera_slug
 where p.id = u.uid;

-- -------------------------------------------------------------------------------------
-- Materias seguidas. Es lo que le da señal a "Para vos": sin follows, la afinidad de
-- todo el mundo es 'descubrimiento' y el feed se vuelve un ranking global.
-- -------------------------------------------------------------------------------------
insert into public.materia_follows (user_id, materia_id)
select u.uid, m.id
  from _demo_users u
  join public.plan_materias pm on pm.carrera_id = (select id from public.carreras where slug = u.carrera_slug)
  join public.materias m on m.id = pm.materia_id
 where pm.anio <= 3
   and (u.handle, m.slug) in (
     ('demoMateConBizcochos', 'derecho-constitucional'),
     ('demoMateConBizcochos', 'derecho-romano'),
     ('demoMateConBizcochos', 'obligaciones-civiles-y-comerciales'),
     ('demoFiscalDelTercerPiso', 'derecho-penal-parte-general'),
     ('demoFiscalDelTercerPiso', 'derecho-constitucional'),
     ('demoApunteDeUltimaHora', 'introduccion-al-derecho'),
     ('demoApunteDeUltimaHora', 'historia-del-derecho'),
     ('demoPasilloDeLaFacu', 'derecho-constitucional'),
     ('demoPasilloDeLaFacu', 'derecho-societario')
   )
on conflict do nothing;

-- -------------------------------------------------------------------------------------
-- Publicaciones. Mezcla deliberada para que el feed tenga de todo qué rankear:
-- preguntas y textos, firmadas y anónimas, con materia y sin materia, y repartidas en
-- el tiempo para que la caída por antigüedad se note.
-- -------------------------------------------------------------------------------------
create temporary table _demo_posts (
  autor text, materia_slug text, kind text, title text, body text,
  anon boolean, hace interval, votos int, coment int
) on commit drop;

insert into _demo_posts (autor, materia_slug, kind, title, body, anon, hace, votos, coment) values
  ('demoMateConBizcochos', 'derecho-constitucional', 'pregunta',
   '¿Alguien rindió Consti con la cátedra de la tarde?',
   E'Estoy por anotarme al final de diciembre y no sé qué esperar. ¿Toma todo el programa o se enfoca en las bolillas de garantías?\n\nSi alguien tiene el machete de las últimas mesas, se agradece.',
   false, interval '3 hours', 14, 6),

  ('demoFiscalDelTercerPiso', 'derecho-penal-parte-general', 'texto',
   'Resumen de la unidad 7 (teoría del delito) actualizado',
   E'Lo armé cursando este cuatrimestre, con lo que efectivamente entró en el parcial. Está en la pestaña de Recursos de la materia.\n\nOjo que la unidad 7 cambió respecto del apunte que circula de 2021: agregaron el tratamiento de la imputación objetiva.',
   false, interval '9 hours', 22, 4),

  ('demoApunteDeUltimaHora', 'introduccion-al-derecho', 'pregunta',
   NULL,
   E'¿Introducción al Derecho se puede llevar previa con Historia del Derecho o son correlativas sí o sí? En el plan de estudios no me queda claro.',
   false, interval '1 day 2 hours', 5, 3),

  ('demoPasilloDeLaFacu', 'derecho-constitucional', 'texto',
   NULL,
   E'Aviso: cambiaron el aula de la comisión 3. Ahora es en el segundo piso, ala nueva. Estuvimos veinte minutos esperando abajo como tontos.',
   false, interval '5 hours', 31, 8),

  ('demoMateConBizcochos', 'derecho-romano', 'pregunta',
   '¿Vale la pena leer el manual completo o alcanza con el resumen?',
   E'Me dijeron que el final de Romano es a libro cerrado y que preguntan de todo. Los que ya rindieron, ¿leyeron el manual entero?',
   true, interval '2 days', 9, 5),

  ('demoFiscalDelTercerPiso', NULL, 'texto',
   NULL,
   E'Che, ¿alguien más siente que el segundo cuatrimestre se hizo eterno? Faltan dos semanas para finales y todavía tengo tres materias sin cerrar.',
   false, interval '7 hours', 18, 7),

  ('demoJuli_placeholder', NULL, 'texto', NULL, E'placeholder', false, interval '1 day', 0, 0),

  ('demoCafeDeLaMaquina', 'contabilidad-i', 'pregunta',
   '¿Cómo tomó el parcial de Contabilidad I este año?',
   E'Rendí el año pasado y era todo ejercicios. Un compañero me dijo que ahora agregaron teoría. ¿Alguien que haya rendido este cuatrimestre?',
   false, interval '11 hours', 7, 2),

  ('demoResumenCompartido', 'contabilidad-i', 'texto',
   'Ejercicios resueltos de asientos, unidades 1 a 4',
   E'Los resolví con la resolución del profe al lado, así que están chequeados. Si encuentran un error avisen y lo corrijo.',
   false, interval '1 day 6 hours', 16, 3),

  ('demoPasilloDeLaFacu', 'derecho-societario', 'texto',
   NULL,
   E'Terminé de cursar Societario y quería dejar dicho que la bibliografía del programa está desactualizada respecto de lo que toman. Preguntan bastante de la reforma.',
   true, interval '3 days', 11, 4),

  ('demoApunteDeUltimaHora', 'historia-del-derecho', 'pregunta',
   NULL,
   E'¿Hay parciales viejos de Historia del Derecho dando vueltas? Busqué en Recursos y no encontré nada de esta materia.',
   false, interval '4 hours', 3, 1),

  ('demoMateConBizcochos', 'obligaciones-civiles-y-comerciales', 'texto',
   'Lo que más se repite en los finales de Obligaciones',
   E'Junté las últimas seis mesas y hay tres temas que aparecen siempre: mora, obligaciones de dar cosa cierta, y solidaridad.\n\nNo es magia, es que el programa es largo y las mesas son cortas.',
   false, interval '2 days 4 hours', 27, 9),

  ('demoFiscalDelTercerPiso', 'derecho-constitucional', 'pregunta',
   NULL,
   E'¿Alguien tiene el fallo completo de "Bazterrica"? En el campus está el link roto.',
   false, interval '20 hours', 6, 2),

  ('demoResumenCompartido', NULL, 'texto',
   NULL,
   E'Se viene la semana de finales y la biblioteca ya está llena a las 8 de la mañana. Aviso para el que quiera lugar.',
   false, interval '6 hours', 12, 3);

-- La fila placeholder existía solo para dejar el hueco de juli; se descarta.
delete from _demo_posts where autor = 'demoJuli_placeholder';

insert into public.posts (
  author_id, materia_id, carrera_id, kind, title, body, is_anonymous,
  score, comments_count, created_at, last_activity_at
)
select
  pr.id,
  m.id,
  case when dp.materia_slug is null then pr.carrera_id else null end,
  dp.kind, dp.title, dp.body, dp.anon,
  dp.votos, dp.coment,
  now() - dp.hace,
  now() - dp.hace + (dp.coment * interval '18 minutes')
from _demo_posts dp
join public.profiles pr on pr.handle = dp.autor
left join public.materias m on m.slug = dp.materia_slug;

-- Alias 0 para los posts anónimos: es lo que hace que el autor anónimo de un hilo se
-- muestre como "Anónimo (autor)" de forma coherente (§8.3.4).
insert into public.anon_aliases (post_id, author_id, alias_num)
select p.id, p.author_id, 0
  from public.posts p
 where p.is_anonymous
   and exists (select 1 from public.profiles pr where pr.id = p.author_id and pr.handle like 'demo%')
on conflict do nothing;

-- -------------------------------------------------------------------------------------
-- Comentarios. Incluye un hilo con dos anónimos distintos para poder verificar a ojo que
-- "Anónimo 1" y "Anónimo 2" se mantienen estables dentro del hilo y no se cruzan.
-- -------------------------------------------------------------------------------------
create temporary table _demo_comments (
  post_titulo_o_cuerpo text, autor text, body text, anon boolean, hace interval, votos int
) on commit drop;

insert into _demo_comments (post_titulo_o_cuerpo, autor, body, anon, hace, votos) values
  ('¿Alguien rindió Consti con la cátedra de la tarde?', 'demoFiscalDelTercerPiso',
   E'Rendí en julio. Toma todo el programa pero pregunta corto, dos o tres cosas y te suelta. Lo importante es que sepas ubicar los fallos.', false, interval '2 hours', 9),
  ('¿Alguien rindió Consti con la cátedra de la tarde?', 'demoPasilloDeLaFacu',
   E'Coincido. A mí me preguntó garantías y un fallo de la unidad 4.', true, interval '1 hour', 4),
  ('¿Alguien rindió Consti con la cátedra de la tarde?', 'demoApunteDeUltimaHora',
   E'¿Alguno se acuerda si deja llevar la Constitución a la mesa?', true, interval '50 minutes', 2),
  ('¿Alguien rindió Consti con la cátedra de la tarde?', 'demoMateConBizcochos',
   E'Gracias, me sirve un montón.', false, interval '30 minutes', 1),
  ('Aviso: cambiaron el aula de la comisión 3.', 'demoMateConBizcochos',
   E'Mil gracias por avisar, estaba yendo para allá.', false, interval '4 hours', 6),
  ('Aviso: cambiaron el aula de la comisión 3.', 'demoApunteDeUltimaHora',
   E'¿Es solo esta semana o de acá en adelante?', false, interval '3 hours', 2),
  ('Lo que más se repite en los finales de Obligaciones', 'demoFiscalDelTercerPiso',
   E'Muy bueno esto. Agrego que también cae bastante compensación.', false, interval '1 day', 8),
  ('Resumen de la unidad 7 (teoría del delito) actualizado', 'demoPasilloDeLaFacu',
   E'Lo bajé, está impecable. Gracias por tomarte el laburo de actualizarlo.', false, interval '6 hours', 5),
  ('¿Cómo tomó el parcial de Contabilidad I este año?', 'demoResumenCompartido',
   E'Rendí hace tres semanas: mitad ejercicios, mitad teoría corta. Cambió respecto del año pasado.', false, interval '8 hours', 4),
  ('¿Vale la pena leer el manual completo o alcanza con el resumen?', 'demoMateConBizcochos',
   E'Yo leí el resumen y me fue bien, pero le dediqué tiempo a los casos prácticos.', true, interval '1 day', 3);

insert into public.comments (post_id, author_id, body, is_anonymous, depth, score, created_at)
select
  p.id, pr.id, dc.body, dc.anon, 1, dc.votos, now() - dc.hace
from _demo_comments dc
join public.profiles pr on pr.handle = dc.autor
join public.posts p
  on coalesce(p.title, left(p.body, 40)) like left(dc.post_titulo_o_cuerpo, 40) || '%';

-- Alias por hilo para los comentarios anónimos: se asigna en orden de aparición, que es
-- exactamente lo que hace create_comment con el advisory lock (§8.3.4).
insert into public.anon_aliases (post_id, author_id, alias_num)
select post_id, author_id, alias_num
from (
  select c.post_id, c.author_id,
         (coalesce((select max(a.alias_num) from public.anon_aliases a where a.post_id = c.post_id), 0)
          + row_number() over (partition by c.post_id order by min(c.created_at)))::smallint as alias_num
    from public.comments c
   where c.is_anonymous
     and not exists (select 1 from public.anon_aliases a
                      where a.post_id = c.post_id and a.author_id = c.author_id)
   group by c.post_id, c.author_id
) x
on conflict do nothing;

-- -------------------------------------------------------------------------------------
-- Votos reales. Los contadores de arriba son el número que se muestra; estas filas son
-- las que hacen que el ranking de "Para vos" tenga señal de afinidad de verdad
-- (quién votó qué → en qué materias se metió cada uno).
-- -------------------------------------------------------------------------------------
insert into public.post_votes (post_id, user_id, created_at)
select p.id, pr.id, p.created_at + interval '20 minutes'
  from public.posts p
  cross join public.profiles pr
 where pr.handle like 'demo%'
   and pr.id <> p.author_id
   and (p.id + ('x' || substr(md5(pr.handle), 1, 8))::bit(32)::bigint) % 3 = 0
on conflict do nothing;

insert into public.comment_votes (comment_id, user_id, created_at)
select c.id, pr.id, c.created_at + interval '15 minutes'
  from public.comments c
  cross join public.profiles pr
 where pr.handle like 'demo%'
   and pr.id <> c.author_id
   and (c.id + ('x' || substr(md5(pr.handle), 1, 8))::bit(32)::bigint) % 4 = 0
on conflict do nothing;

commit;

-- Reconciliación: deja score y comments_count coherentes con las filas reales, que es lo
-- mismo que hace el cron todas las noches (§8.5.6). Sin esto, los números de arriba y los
-- votos insertados no coinciden y el feed muestra una cosa distinta de la que hay.
select public.reconcile_counters();
