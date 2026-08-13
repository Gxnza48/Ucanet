-- =============================================================================
-- uca.net · semilla de catálogo · 41_materias_contador.sql
--
-- FUENTE ......... APPENDIX A §C.5 (Materias — Contador Público, Plan 2017)
--                  Origen: §A.4, PDF oficial leído completo
--                  wadmin.uca.edu.ar/public/ckeditor/Ciencias%20Econ%C3%B3micas/
--                  Correlativas%202017/2Planes%20de%20Estudios%202017%20
--                  CORRELATIVAS%20CP.pdf (descargado 2026-08-13)
-- ESTADO ......... VERIFICADO para el plan (57 slots numerados, 4 años,
--                  8 semestres; título intermedio Analista Administrativo
--                  Contable al completar 3° año S1).
--                  SALVEDAD de §A.4: el PDF está en la carpeta general de
--                  Ciencias Económicas; la facultad de Rosario publica su propia
--                  página "Contador Público - Plan 2017", lo que apunta fuerte a
--                  que rige el mismo plan, pero no se obtuvo una copia sellada
--                  para Rosario.
--
-- TABLAS ......... public.materias + public.plan_materias (PART 8 §8.3.1)
--                  plan = '2017' · carrera = 'contador-publico'
--
-- SLUGS GLOBALES . §8.3.1: slug único global. Las materias homónimas de Abogacía
--   Plan 2013 llevan la carrera como calificador: `filosofia-y-antropologia-
--   contador`, `introduccion-al-derecho-contador`, `etica-y-sus-fundamentos-
--   contador`, `introduccion-a-la-teologia-contador`, `sintesis-teologica-
--   contador`, `moral-y-compromiso-social-contador` y los `seminario-N-contador`.
--   Son facultades distintas: dos páginas de comunidad, no una fusión.
--
-- SLOTS "OPTATIVA GRUPO N" — DECISIÓN (el apéndice era ambiguo):
--   Los códigos 40, 41, 46, 47, 48, 53, 54 y 55 del PDF son *casilleros* del plan
--   ("Optativa Grupo 1/2/3"), no materias. No se les crea página de materia:
--     (a) `materias` es la unidad de permanencia (D1) — una página llamada
--         "Optativa Grupo 2" no acumula nada;
--     (b) la PK de plan_materias es (carrera_id, plan, materia_id), así que un
--         mismo casillero repetido en dos años ni siquiera se puede representar.
--   En su lugar se siembran las optativas NOMBRADAS del apéndice con
--   `optativa = true`, ubicadas en el año/cuatrimestre del PRIMER casillero de su
--   grupo (Grupo 1 → 3°/2C por cod 40; Grupo 2 → 3°/2C por cod 41;
--   Grupo 3 → 4°/1C por cod 48) y `codigo = NULL`, porque el apéndice da rangos
--   (58-62, 63-71, 72-76) y ejemplos, no un mapeo código↔materia.
--   COSTO ACEPTADO: la grilla del plan de estudios pierde la marca "elegí 2 del
--   Grupo 2 en 4°/1C". Se recupera cuando haya fuente para el catálogo completo
--   de optativas. La lista sembrada es PARCIAL (son los ejemplos del apéndice).
--
-- ORTOGRAFÍA ..... `nombre` con tildes y ñ correctas ("Diseño y Auditoría de
--   Sistemas de Información" donde la fuente escribió "Disenio y Auditoria...");
--   `slug` siempre sin tildes ni ñ (D7). Se expande una abreviatura de tabla:
--   "Normas Internac." → "Normas Internacionales".
--
-- DEPENDENCIA .... 30_carreras.sql. IDEMPOTENCIA: upsert por `slug` en materias
--   y por la PK (carrera_id, plan, materia_id) en plan_materias. El upsert de
--   materias NO toca `aliases`: esa columna la escribe 99_aliases.sql.
-- =============================================================================

set client_encoding = 'UTF8';

do $$
begin
  if not exists (select 1 from public.carreras where slug = 'contador-publico') then
    raise exception 'Semilla 41_materias_contador.sql: falta la carrera "contador-publico". Corré 30_carreras.sql primero.';
  end if;
end
$$;

with datos(slug, nombre, codigo, anio, cuatrimestre, optativa) as (
  values
    -- ---------------- 1° año · 1er cuatrimestre --------------------------
    ('administracion'::text,                          'Administración'::text,                            '1'::text, 1::smallint, 1::smallint, false),
    ('contabilidad',                                  'Contabilidad',                                    '2',  1, 1, false),
    ('matematica-aplicada-i',                         'Matemática Aplicada I',                           '3',  1, 1, false),
    ('microeconomia',                                 'Microeconomía',                                   '4',  1, 1, false),
    ('seminario-argentina-en-el-mundo',               'Seminario: Argentina en el Mundo',                '5',  1, 1, false),
    ('filosofia-y-antropologia-contador',             'Filosofía y Antropología',                        '6',  1, 1, false),
    ('taller-logica-y-oratoria',                      'Taller: Lógica y Oratoria',                       '7',  1, 1, false),
    ('taller-comunicacion-y-redaccion',               'Taller: Comunicación y Redacción',                '8',  1, 1, false),

    -- ---------------- 1° año · 2do cuatrimestre --------------------------
    ('administracion-avanzada',                       'Administración Avanzada',                         '9',  1, 2, false),
    ('contabilidad-y-sistemas-de-informacion',        'Contabilidad y Sistemas de Información',          '10', 1, 2, false),
    ('matematica-aplicada-ii',                        'Matemática Aplicada II',                          '11', 1, 2, false),
    ('macroeconomia',                                 'Macroeconomía',                                   '12', 1, 2, false),
    ('introduccion-al-derecho-contador',              'Introducción al Derecho',                         '13', 1, 2, false),
    ('seminario-i-contador',                          'Seminario I',                                     '14', 1, 2, false),
    ('taller-software-de-negocios-i',                 'Taller: Software de Negocios I',                  '15', 1, 2, false),

    -- ---------------- 2° año · 1er cuatrimestre --------------------------
    ('estadistica',                                   'Estadística',                                     '16', 2, 1, false),
    ('contabilidad-para-la-toma-de-decisiones',       'Contabilidad para la Toma de Decisiones',         '17', 2, 1, false),
    ('derecho-publico',                               'Derecho Público',                                 '18', 2, 1, false),
    ('derecho-laboral-y-seguridad-social',            'Derecho Laboral y Seguridad Social',              '19', 2, 1, false),
    ('etica-y-sus-fundamentos-contador',              'Ética y sus Fundamentos',                         '20', 2, 1, false),
    ('introduccion-a-la-teologia-contador',           'Introducción a la Teología',                      '21', 2, 1, false),
    ('taller-de-habilidades-profesionales',           'Taller de Habilidades Profesionales',             '22', 2, 1, false),

    -- ---------------- 2° año · 2do cuatrimestre --------------------------
    ('competitividad-y-costos',                       'Competitividad y Costos',                         '23', 2, 2, false),
    ('matematica-financiera',                         'Matemática Financiera',                           '24', 2, 2, false),
    ('contabilidad-de-combinaciones-de-negocios',     'Contabilidad de Combinaciones de Negocios',       '25', 2, 2, false),
    ('derecho-comercial',                             'Derecho Comercial',                               '26', 2, 2, false),
    ('gestion-de-it',                                 'Gestión de IT',                                   '27', 2, 2, false),
    ('seminario-ii-contador',                         'Seminario II',                                    '28', 2, 2, false),
    ('taller-software-de-negocios-ii',                'Taller: Software de Negocios II',                 '29', 2, 2, false),
    ('idioma-extranjero-ingles-contador',             'Requisito Curricular: Idioma Extranjero - Inglés','30', 2, 2, false),

    -- ---------------- 3° año · 1er cuatrimestre --------------------------
    -- (al cerrar este semestre se otorga el título intermedio de
    --  Analista Administrativo Contable — §A.4)
    ('estados-contables',                             'Estados Contables',                               '31', 3, 1, false),
    ('finanzas-publicas-y-control',                   'Finanzas Públicas y Control',                     '32', 3, 1, false),
    ('derecho-concursal-y-quiebras',                  'Derecho Concursal y Quiebras',                    '33', 3, 1, false),
    ('presupuesto-y-control',                         'Presupuesto y Control',                           '34', 3, 1, false),
    ('seminario-contabilidad-socio-ambiental-y-ong',  'Seminario: Contabilidad Socio Ambiental y de ONG','35', 3, 1, false),
    ('sintesis-teologica-contador',                   'Síntesis Teológica',                              '36', 3, 1, false),

    -- ---------------- 3° año · 2do cuatrimestre --------------------------
    ('finanzas-corporativas',                         'Finanzas Corporativas',                           '37', 3, 2, false),
    ('normas-internacionales-de-informacion-financiera', 'Normas Internacionales de Información Financiera', '38', 3, 2, false),
    ('impuestos-i',                                   'Impuestos I',                                     '39', 3, 2, false),
    ('seminario-iii-contador',                        'Seminario III',                                   '42', 3, 2, false),
    ('diseno-y-auditoria-de-sistemas-de-informacion', 'Diseño y Auditoría de Sistemas de Información',   '43', 3, 2, false),

    -- ---------------- 4° año · 1er cuatrimestre --------------------------
    ('etica-economica-y-empresarial',                 'Ética Económica y Empresarial',                   '44', 4, 1, false),
    ('auditoria',                                     'Auditoría',                                       '45', 4, 1, false),
    ('moral-y-compromiso-social-contador',            'Moral y Compromiso Social',                       '49', 4, 1, false),
    ('practicas-de-integracion-i',                    'Prácticas de Integración I',                      '50', 4, 1, false),

    -- ---------------- 4° año · 2do cuatrimestre --------------------------
    ('impuestos-ii',                                  'Impuestos II',                                    '51', 4, 2, false),
    ('actuacion-profesional',                         'Actuación Profesional',                           '52', 4, 2, false),
    ('seminario-iv-contador',                         'Seminario IV',                                    '56', 4, 2, false),
    ('practicas-de-integracion-ii',                   'Prácticas de Integración II',                     '57', 4, 2, false),

    -- ---------------- Optativas Grupo 1 (cods 58-62 · lista PARCIAL) -----
    -- Primer casillero del grupo: cod 40 → 3° año, 2do cuatrimestre.
    ('prevencion-de-delitos-financieros-y-lavado-de-activos', 'Prevención de Delitos Financieros y Lavado de Activos', null, 3, 2, true),
    ('auditoria-interna-y-operativa',                 'Auditoría Interna y Operativa',                   null, 3, 2, true),

    -- ---------------- Optativas Grupo 2 (cods 63-71 · lista PARCIAL) -----
    -- Primer casillero del grupo: cod 41 → 3° año, 2do cuatrimestre.
    ('gerencia-y-liderazgo',                          'Gerencia y Liderazgo',                            null, 3, 2, true),
    ('fundamentos-del-marketing',                     'Fundamentos del Marketing',                       null, 3, 2, true),
    ('estrategia-empresarial',                        'Estrategia Empresarial',                          null, 3, 2, true),

    -- ---------------- Optativas Grupo 3 (cods 72-76 · lista PARCIAL) -----
    -- Primer casillero del grupo: cod 48 → 4° año, 1er cuatrimestre.
    ('marketing-estrategico',                         'Marketing Estratégico',                           null, 4, 1, true),
    ('finanzas-corporativas-avanzadas',               'Finanzas Corporativas Avanzadas',                 null, 4, 1, true),
    ('negociacion',                                   'Negociación',                                     null, 4, 1, true)
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
select c.id, m.id, '2017', d.anio, d.cuatrimestre, d.codigo, d.optativa
from datos d
join materias_upsert m on m.slug = d.slug
join public.carreras c on c.slug = 'contador-publico'
on conflict (carrera_id, plan, materia_id) do update
   set anio         = excluded.anio,
       cuatrimestre = excluded.cuatrimestre,
       codigo       = excluded.codigo,
       optativa     = excluded.optativa;

do $$
declare
  n int;
  total int;
begin
  select count(*) into n
  from public.plan_materias pm
  join public.carreras c on c.id = pm.carrera_id
  where c.slug = 'contador-publico' and pm.plan = '2017';
  select count(*) into total from public.materias;
  raise notice 'uca.net · catálogo: % materias en Contador Público Plan 2017 (% materias en total).', n, total;
end
$$;
