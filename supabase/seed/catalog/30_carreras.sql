-- =============================================================================
-- uca.net · semilla de catálogo · 30_carreras.sql
--
-- FUENTE ......... APPENDIX A §C.3 (Carreras, sede Rosario) · origen en §A.2 y §B
-- ESTADO ......... MIXTO — cada fila lleva su marca al final:
--                  [VERIFICADA]   → tiene página de carrera oficial en uca.edu.ar
--                                   (accedida 2026-08-13)
--                  [SIN VERIFICAR] → aparece solo en fragmentos del índice de
--                                   búsqueda de uca.edu.ar; la página no se pudo
--                                   renderizar para confirmar que esté abierta a
--                                   inscripción (§B, primera y segunda viñeta)
--
-- POR QUÉ SE SIEMBRAN IGUAL LAS SIN VERIFICAR: PART 8 §8.3.1 lo adjudica —
--   "una fila de carrera equivocada es una corrección barata, una ausente
--    bloquea el onboarding".
--
-- duracion_anios: solo se completa donde el apéndice lo verifica con el plan de
--   estudios oficial (Abogacía 5 años §A.3; Contador Público 4 años §A.4). En el
--   resto queda NULL: no se inventan datos.
--
-- DEPENDENCIA .... 20_facultades.sql. IDEMPOTENCIA: upsert por `slug`.
-- =============================================================================

set client_encoding = 'UTF8';

do $$
declare
  n int;
begin
  select count(*) into n
  from public.facultades
  where slug in ('derecho-cs-sociales-rosario', 'cs-economicas-rosario', 'quimica-ingenieria-rosario');
  if n <> 3 then
    raise exception 'Semilla 30_carreras.sql: faltan facultades (se encontraron %/3). Corré 20_facultades.sql primero.', n;
  end if;
end
$$;

with datos(slug, nombre, facultad_slug, nivel, duracion_anios) as (
  values
    -- --- Facultad de Derecho y Ciencias Sociales del Rosario --------------
    ('abogacia'::text,                   'Abogacía'::text,                                             'derecho-cs-sociales-rosario'::text, 'grado'::text,  5::smallint), -- [VERIFICADA]
    ('psicopedagogia',                   'Licenciatura en Psicopedagogía',                             'derecho-cs-sociales-rosario',       'grado',        null),        -- [VERIFICADA]
    ('notariado',                        'Notariado',                                                  'derecho-cs-sociales-rosario',       'grado',        null),        -- [SIN VERIFICAR]
    ('martillero-corredor',              'Martillero Público, Corredor y Tasador',                     'derecho-cs-sociales-rosario',       'pregrado',     null),        -- [SIN VERIFICAR]
    ('relaciones-internacionales',       'Licenciatura en Relaciones Internacionales',                 'derecho-cs-sociales-rosario',       'grado',        null),        -- [SIN VERIFICAR]
    ('ciencias-politicas',               'Licenciatura en Ciencias Políticas',                         'derecho-cs-sociales-rosario',       'grado',        null),        -- [SIN VERIFICAR]
    ('comunicacion-periodistica',        'Licenciatura en Comunicación Periodística',                  'derecho-cs-sociales-rosario',       'grado',        null),        -- [SIN VERIFICAR]
    ('comunicacion-publicitaria',        'Licenciatura en Comunicación Publicitaria e Institucional',  'derecho-cs-sociales-rosario',       'grado',        null),        -- [SIN VERIFICAR]

    -- --- Facultad de Ciencias Económicas del Rosario ----------------------
    ('contador-publico',                 'Contador Público',                                           'cs-economicas-rosario',             'grado',        4),           -- [VERIFICADA]
    ('gestion-negocios-digitales',       'Licenciatura en Gestión de Negocios Digitales',              'cs-economicas-rosario',             'grado',        null),        -- [SIN VERIFICAR]

    -- --- Facultad de Química e Ingeniería del Rosario ---------------------
    ('ingenieria-quimica',               'Ingeniería Química',                                         'quimica-ingenieria-rosario',        'grado',        null),        -- [VERIFICADA]
    ('ingenieria-industrial',            'Ingeniería Industrial',                                      'quimica-ingenieria-rosario',        'grado',        null),        -- [VERIFICADA]
    ('ingenieria-ambiental',             'Ingeniería Ambiental',                                       'quimica-ingenieria-rosario',        'grado',        null),        -- [VERIFICADA]
    ('tecnicatura-quimica',              'Tecnicatura Universitaria en Química',                       'quimica-ingenieria-rosario',        'pregrado',     null)         -- [VERIFICADA]
)
insert into public.carreras (facultad_id, slug, nombre, nivel, duracion_anios)
select f.id, d.slug, d.nombre, d.nivel, d.duracion_anios
from datos d
join public.facultades f on f.slug = d.facultad_slug
on conflict (slug) do update
   set facultad_id    = excluded.facultad_id,
       nombre         = excluded.nombre,
       nivel          = excluded.nivel,
       duracion_anios = excluded.duracion_anios;

do $$
declare
  n int;
begin
  select count(*) into n from public.carreras;
  raise notice 'uca.net · catálogo: % carrera(s) cargada(s).', n;
end
$$;
