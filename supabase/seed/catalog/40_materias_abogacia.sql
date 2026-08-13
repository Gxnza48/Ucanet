-- =============================================================================
-- uca.net · semilla de catálogo · 40_materias_abogacia.sql
--
-- FUENTE ......... APPENDIX A §C.4 (Materias — Abogacía, Plan 2013)
--                  Origen: §A.3, PDF oficial leído completo
--                  wadmin.uca.edu.ar/public/ckeditor/Facultad%20de%20Derecho/
--                  pdf/Plan%20de%20estudios.pdf (descargado 2026-08-13)
-- ESTADO ......... VERIFICADO para el plan (51 materias del cuerpo principal,
--                  con código oficial, año y cuatrimestre tomados del PDF).
--                  SALVEDAD de §A.3: el PDF vive en la carpeta "Facultad de
--                  Derecho" (Buenos Aires). Rosario declara que conviven los
--                  planes 2013 y 2020; los deltas específicos de Rosario NO se
--                  verificaron. El Plan 2020 queda SIN VERIFICAR (§B) y por eso
--                  no se siembra: cuando aparezca, entra como plan '2020' en
--                  plan_materias sin tocar estas filas.
--
-- TABLAS ......... public.materias + public.plan_materias (PART 8 §8.3.1)
--                  plan = '2013' · carrera = 'abogacia'
--
-- SLUGS GLOBALES . §8.3.1: el slug de materia es único a nivel global. Las
--   materias cuyo nombre colisiona con Contador Público (Plan 2017) llevan la
--   carrera como calificador — `filosofia-y-antropologia-abogacia`,
--   `introduccion-al-derecho-abogacia`, `etica-y-sus-fundamentos-abogacia`,
--   `introduccion-a-la-teologia-abogacia`, `sintesis-teologica-abogacia`,
--   `moral-y-compromiso-social-abogacia` y los `seminario-N-abogacia`. Son
--   facultades distintas: son páginas de comunidad distintas, no una fusión.
--   Los seminarios numerados se califican los cinco por consistencia de serie
--   (un slug `seminario-i` global no identifica nada).
--
-- ORTOGRAFÍA ..... el apéndice trae los nombres sin tildes por limitación de la
--   fuente. Acá `nombre` va con ortografía correcta en castellano; `slug` va sin
--   tildes, siempre (D7). También se expanden dos abreviaturas de tabla del PDF
--   ("Sem." → "Seminario"; "D.Civ., D.Com. y D.Lab." → "Derecho Civil, Comercial
--   y Laboral"; "D.Publico y D.Penal" → "Derecho Público y Penal") porque
--   `nombre` se renderiza como título de /materias/[slug].
--
-- IDIOMA Y OPTATIVAS (§C.4, párrafo final — INFERIDO, ver decisiones):
--   El apéndice dice "2 niveles de Idioma (cod 628, 629) y 2 materias optativas
--   de 4 hs a elegir en el segundo ciclo (cods 619-650, e.g. Derechos Humanos,
--   ...)". No da año ni cuatrimestre por materia. Adjudicación de esta semilla:
--     · anio = 4 → §A.3 fija los ciclos en 1-3 y 4-5, y las optativas son "del
--       segundo ciclo"; los códigos 6xx acompañan esa ubicación.
--     · cuatrimestre = 0 → el valor "anual / no fijado por el plan" que ya
--       admite el CHECK de plan_materias (§8.3.1). El plan no ata las optativas
--       a un semestre.
--     · codigo = NULL en las optativas nombradas: el apéndice da un RANGO
--       (619-650) y ejemplos, no un mapeo código↔materia. No se inventa.
--     · Idioma I / Idioma II: los códigos 628 y 629 sí están verificados; los
--       nombres son la denominación estándar de los niveles (INFERIDO).
--   La lista de optativas es PARCIAL (el apéndice da ejemplos, no el catálogo
--   completo). Se completa por migración/semilla cuando haya fuente.
--
-- DEPENDENCIA .... 30_carreras.sql. IDEMPOTENCIA: upsert por `slug` en materias
--   y por la PK (carrera_id, plan, materia_id) en plan_materias. El upsert de
--   materias NO toca `aliases` a propósito: esa columna la escribe 99_aliases.sql.
-- =============================================================================

set client_encoding = 'UTF8';

do $$
begin
  if not exists (select 1 from public.carreras where slug = 'abogacia') then
    raise exception 'Semilla 40_materias_abogacia.sql: falta la carrera "abogacia". Corré 30_carreras.sql primero.';
  end if;
end
$$;

with datos(slug, nombre, codigo, anio, cuatrimestre, optativa) as (
  values
    -- ---------------- 1° año · 1er cuatrimestre --------------------------
    ('filosofia-y-antropologia-abogacia'::text,           'Filosofía y Antropología'::text,                                          '881'::text, 1::smallint, 1::smallint, false),
    ('introduccion-al-derecho-abogacia',                  'Introducción al Derecho',                                                 '120',       1, 1, false),
    ('historia-de-la-cultura',                            'Historia de la Cultura',                                                  '121',       1, 1, false),
    ('principios-de-derecho-privado',                     'Principios de Derecho Privado',                                           '123',       1, 1, false),

    -- ---------------- 1° año · 2do cuatrimestre --------------------------
    ('formacion-del-pensamiento-juridico-politico',       'Formación del Pensamiento Jurídico-Político',                             '124',       1, 2, false),
    ('instituciones-de-derecho-civil',                    'Instituciones de Derecho Civil',                                          '125',       1, 2, false),
    ('historia-del-derecho',                              'Historia del Derecho',                                                    '126',       1, 2, false),
    ('derecho-romano',                                    'Derecho Romano',                                                          '127',       1, 2, false),
    ('seminario-i-abogacia',                              'Seminario I',                                                             '882',       1, 2, false),

    -- ---------------- 2° año · 1er cuatrimestre --------------------------
    ('etica-y-sus-fundamentos-abogacia',                  'Ética y sus Fundamentos',                                                 '883',       2, 1, false),
    ('instituciones-de-derecho-comercial',                'Instituciones de Derecho Comercial',                                      '216',       2, 1, false),
    ('obligaciones-civiles-y-comerciales',                'Obligaciones Civiles y Comerciales',                                      '220',       2, 1, false),
    ('derecho-politico',                                  'Derecho Político',                                                        '221',       2, 1, false),
    ('economia-politica',                                 'Economía Política',                                                       '222',       2, 1, false),

    -- ---------------- 2° año · 2do cuatrimestre --------------------------
    ('teoria-general-del-proceso',                        'Teoría General del Proceso',                                              '225',       2, 2, false),
    ('derecho-penal-parte-general',                       'Derecho Penal (Parte General)',                                           '226',       2, 2, false),
    ('derecho-de-danos',                                  'Derecho de Daños',                                                        '227',       2, 2, false),
    ('seminario-ii-abogacia',                             'Seminario II',                                                            '884',       2, 2, false),

    -- ---------------- 3° año · 1er cuatrimestre --------------------------
    ('introduccion-a-la-teologia-abogacia',               'Introducción a la Teología',                                              '885',       3, 1, false),
    ('derecho-procesal-penal',                            'Derecho Procesal Penal',                                                  '321',       3, 1, false),
    ('contratos-civiles-y-comerciales-parte-general',     'Contratos Civiles y Comerciales (Parte General)',                         '323',       3, 1, false),
    ('derecho-penal-parte-especial',                      'Derecho Penal (Parte Especial)',                                          '324',       3, 1, false),
    ('derecho-constitucional',                            'Derecho Constitucional',                                                  '325',       3, 1, false),

    -- ---------------- 3° año · 2do cuatrimestre --------------------------
    ('derechos-y-garantias-constitucionales',             'Derechos y Garantías Constitucionales',                                   '320',       3, 2, false),
    ('derecho-del-trabajo-y-de-la-seguridad-social',      'Derecho del Trabajo y de la Seguridad Social',                            '326',       3, 2, false),
    ('contratos-civiles-y-comerciales-parte-especial',    'Contratos Civiles y Comerciales (Parte Especial)',                        '328',       3, 2, false),
    ('derecho-societario',                                'Derecho Societario',                                                      '329',       3, 2, false),
    ('seminario-iii-abogacia',                            'Seminario III',                                                           '886',       3, 2, false),

    -- ---------------- 4° año · 1er cuatrimestre --------------------------
    ('sintesis-teologica-abogacia',                       'Síntesis Teológica',                                                      '887',       4, 1, false),
    ('derechos-reales-parte-general',                     'Derechos Reales (Parte General)',                                         '420',       4, 1, false),
    ('titulos-valores',                                   'Títulos Valores',                                                         '421',       4, 1, false),
    ('seminario-de-responsabilidades-especiales-y-seguros','Seminario de Responsabilidades Especiales y Seguros',                    '423',       4, 1, false),
    ('derecho-procesal-civil-y-comercial',                'Derecho Procesal Civil y Comercial',                                      '424',       4, 1, false),

    -- ---------------- 4° año · 2do cuatrimestre --------------------------
    ('seminario-de-practica-profesional-civil-comercial-laboral', 'Seminario de Práctica Profesional (Derecho Civil, Comercial y Laboral)', '427', 4, 2, false),
    ('concursos-y-quiebras',                              'Concursos y Quiebras',                                                    '428',       4, 2, false),
    ('derecho-internacional-publico',                     'Derecho Internacional Público',                                           '429',       4, 2, false),
    ('derechos-reales-parte-especial',                    'Derechos Reales (Parte Especial)',                                        '430',       4, 2, false),
    ('seminario-iv-abogacia',                             'Seminario IV',                                                            '888',       4, 2, false),

    -- ---------------- 5° año · 1er cuatrimestre --------------------------
    ('moral-y-compromiso-social-abogacia',                'Moral y Compromiso Social',                                               '889',       5, 1, false),
    ('derecho-de-familia',                                'Derecho de Familia',                                                      '521',       5, 1, false),
    ('seminario-de-derecho-tributario',                   'Seminario de Derecho Tributario',                                         '522',       5, 1, false),
    ('instituciones-de-derecho-administrativo',           'Instituciones de Derecho Administrativo',                                 '523',       5, 1, false),
    ('filosofia-del-derecho',                             'Filosofía del Derecho',                                                   '524',       5, 1, false),
    ('seminario-de-practica-profesional-empresarial',     'Seminario de Práctica Profesional (Empresarial)',                         '525',       5, 1, false),

    -- ---------------- 5° año · 2do cuatrimestre --------------------------
    ('derecho-internacional-privado',                     'Derecho Internacional Privado',                                           '526',       5, 2, false),
    ('derecho-sucesorio',                                 'Derecho Sucesorio',                                                       '527',       5, 2, false),
    ('derecho-administrativo-especial',                   'Derecho Administrativo Especial',                                         '528',       5, 2, false),
    ('derecho-canonico',                                  'Derecho Canónico',                                                        '529',       5, 2, false),
    ('seminario-de-practica-profesional-publico-penal',   'Seminario de Práctica Profesional (Derecho Público y Penal)',             '530',       5, 2, false),
    ('seminario-de-etica-social-y-profesional',           'Seminario de Ética Social y Profesional',                                 '531',       5, 2, false),
    ('seminario-v-abogacia',                              'Seminario V',                                                             '890',       5, 2, false),

    -- ---------------- Segundo ciclo · Idioma (requisito) -----------------
    -- Códigos 628/629 verificados en §C.4; nombres y ubicación INFERIDOS.
    ('idioma-i-abogacia',                                 'Idioma I',                                                                '628',       4, 0, false),
    ('idioma-ii-abogacia',                                'Idioma II',                                                               '629',       4, 0, false),

    -- ---------------- Segundo ciclo · Optativas (lista PARCIAL) ----------
    -- §C.4: "2 materias optativas de 4 hs a elegir en el segundo ciclo
    -- (cods 619-650, e.g. ...)". Código NULL: el apéndice da rango, no mapeo.
    ('derechos-humanos',                                  'Derechos Humanos',                                                        null,        4, 0, true),
    ('negociacion-mediacion-y-arbitraje',                 'Negociación, Mediación y Arbitraje',                                      null,        4, 0, true),
    ('derecho-ambiental',                                 'Derecho Ambiental',                                                       null,        4, 0, true),
    ('bioderecho',                                        'Bioderecho',                                                              null,        4, 0, true),
    ('derecho-de-la-alta-tecnologia',                     'Derecho de la Alta Tecnología',                                           null,        4, 0, true),
    ('derecho-deportivo',                                 'Derecho Deportivo',                                                       null,        4, 0, true)
),
materias_upsert as (
  insert into public.materias (slug, nombre)
  select d.slug, d.nombre
  from datos d
  on conflict (slug) do update
     set nombre = excluded.nombre
  returning id, slug
)
insert into public.plan_materias (carrera_id, materia_id, plan, anio, cuatrimestre, codigo, optativa)
select c.id, m.id, '2013', d.anio, d.cuatrimestre, d.codigo, d.optativa
from datos d
join materias_upsert m on m.slug = d.slug
join public.carreras c on c.slug = 'abogacia'
on conflict (carrera_id, plan, materia_id) do update
   set anio         = excluded.anio,
       cuatrimestre = excluded.cuatrimestre,
       codigo       = excluded.codigo,
       optativa     = excluded.optativa;

do $$
declare
  n int;
begin
  select count(*) into n
  from public.plan_materias pm
  join public.carreras c on c.id = pm.carrera_id
  where c.slug = 'abogacia' and pm.plan = '2013';
  raise notice 'uca.net · catálogo: % materias en Abogacía Plan 2013.', n;
end
$$;
