-- =============================================================================
-- uca.net · semilla de catálogo · 99_aliases.sql
--
-- FUENTE ......... nombres coloquiales de estudiantes, sobre las materias
--                  sembradas desde APPENDIX A §C.4 (Abogacía Plan 2013) y
--                  §C.5 (Contador Público Plan 2017).
-- ESTADO ......... SIN VERIFICAR — APPENDIX A no publica jerga estudiantil.
--   Estos alias son una primera aproximación editorial ("consti", "penal 1",
--   "conta 2") pensada para que el typeahead funcione desde el día 1 con cero
--   usuarios. La fuente real de verdad va a ser `search_queries` (§0.5-R10):
--   las consultas con cero resultados son exactamente el insumo para corregir
--   esta lista, y corregirla es re-correr este archivo.
--
-- COLUMNA ........ public.materias.aliases text[] (PART 8 §8.3.1, §0.5-R13).
--   Alimenta el typeahead y entra al tsvector `search` con peso B, por debajo
--   del nombre (peso A) y por encima de la descripción (peso C).
--
-- FORMATO ........ minúsculas, sin tildes y sin ñ: el estudiante teclea "quimica"
--   y "danos" desde el celular. La configuración `public.es` desacentúa igual
--   (§8.6), pero guardar el alias ya normalizado deja el dato legible y hace
--   trivial el prefix-match de `f_unaccent(lower(...))`.
--   No se repite el nombre de la materia como alias: eso ya pesa A.
--
-- POR QUÉ ES UPDATE Y NO UPSERT: una materia sin fila en el catálogo no debe
--   nacer acá — nacería sin plan de estudios y sin carrera. Este archivo solo
--   pinta alias sobre materias que 40_/41_ ya crearon, y falla ruidosamente si
--   algún slug no existe (típicamente, un typo).
--
-- IDEMPOTENCIA ... el UPDATE reemplaza el array completo. Re-ejecutable siempre;
--   es también la forma de *quitar* un alias: se saca de la lista y se re-corre.
--
-- DEPENDENCIA .... 40_materias_abogacia.sql y 41_materias_contador.sql.
-- =============================================================================

set client_encoding = 'UTF8';

create temporary table if not exists _seed_aliases (
  slug    text primary key,
  aliases text[] not null
);
truncate table _seed_aliases;

insert into _seed_aliases (slug, aliases) values
  -- ======================= ABOGACÍA · Plan 2013 ==========================
  ('derecho-constitucional',                         array['consti', 'constitucional', 'derecho consti']),
  ('derechos-y-garantias-constitucionales',          array['garantias', 'consti 2', 'derechos y garantias']),
  ('derecho-penal-parte-general',                    array['penal 1', 'penal i', 'penal general', 'penal']),
  ('derecho-penal-parte-especial',                   array['penal 2', 'penal ii', 'penal especial']),
  ('introduccion-al-derecho-abogacia',               array['intro', 'intro al derecho', 'idd']),
  ('derecho-romano',                                 array['romano']),
  ('instituciones-de-derecho-civil',                 array['civil', 'instituciones civil', 'civil 1']),
  ('principios-de-derecho-privado',                  array['privado', 'principios', 'pdp']),
  ('obligaciones-civiles-y-comerciales',             array['obligaciones', 'oblis', 'obli']),
  ('derecho-de-danos',                               array['danos', 'responsabilidad civil']),
  ('historia-del-derecho',                           array['historia del derecho', 'hdd']),
  ('historia-de-la-cultura',                         array['cultura', 'hdc']),
  ('filosofia-y-antropologia-abogacia',              array['filo', 'antropo', 'filo y antro']),
  ('formacion-del-pensamiento-juridico-politico',    array['formacion', 'pensamiento juridico', 'fpjp']),
  ('etica-y-sus-fundamentos-abogacia',               array['etica']),
  ('economia-politica',                              array['economia', 'eco']),
  ('derecho-politico',                               array['politico', 'derecho pol']),
  ('teoria-general-del-proceso',                     array['tgp', 'proceso', 'teoria del proceso']),
  ('derecho-procesal-penal',                         array['procesal penal', 'dpp']),
  ('derecho-procesal-civil-y-comercial',             array['procesal civil', 'procesal', 'dpcc']),
  ('contratos-civiles-y-comerciales-parte-general',  array['contratos', 'contratos 1', 'contratos general']),
  ('contratos-civiles-y-comerciales-parte-especial', array['contratos 2', 'contratos especial']),
  ('derecho-societario',                             array['societario', 'sociedades']),
  ('instituciones-de-derecho-comercial',             array['comercial', 'instituciones comercial', 'idc']),
  ('derecho-del-trabajo-y-de-la-seguridad-social',   array['laboral', 'trabajo', 'derecho laboral']),
  ('derechos-reales-parte-general',                  array['reales', 'reales 1', 'derechos reales']),
  ('derechos-reales-parte-especial',                 array['reales 2']),
  ('titulos-valores',                                array['titulos', 'titulos de credito']),
  ('concursos-y-quiebras',                           array['concursos', 'quiebras']),
  ('derecho-internacional-publico',                  array['internacional publico', 'dip']),
  ('derecho-internacional-privado',                  array['internacional privado', 'dipr']),
  ('derecho-de-familia',                             array['familia']),
  ('derecho-sucesorio',                              array['sucesiones', 'sucesorio']),
  ('filosofia-del-derecho',                          array['filo del derecho', 'filosofia juridica']),
  ('instituciones-de-derecho-administrativo',        array['administrativo', 'admin 1', 'ida']),
  ('derecho-administrativo-especial',                array['administrativo especial', 'admin 2']),
  ('derecho-canonico',                               array['canonico']),
  ('seminario-de-derecho-tributario',                array['tributario', 'seminario tributario']),
  ('introduccion-a-la-teologia-abogacia',            array['teologia', 'teo']),
  ('sintesis-teologica-abogacia',                    array['sintesis', 'teologia 2']),
  ('moral-y-compromiso-social-abogacia',             array['moral']),
  ('seminario-de-practica-profesional-civil-comercial-laboral', array['practica civil', 'practica profesional civil']),
  ('seminario-de-practica-profesional-empresarial',  array['practica empresarial']),
  ('seminario-de-practica-profesional-publico-penal',array['practica penal', 'practica publica']),
  ('seminario-de-responsabilidades-especiales-y-seguros', array['seguros', 'responsabilidades especiales']),
  ('seminario-de-etica-social-y-profesional',        array['etica profesional', 'etica social']),
  ('idioma-i-abogacia',                              array['idioma 1', 'ingles 1']),
  ('idioma-ii-abogacia',                             array['idioma 2', 'ingles 2']),
  -- Los seminarios se nombran en romanos pero se tipean en arábigos.
  ('seminario-i-abogacia',                           array['seminario 1', 'semi 1']),
  ('seminario-ii-abogacia',                          array['seminario 2', 'semi 2']),
  ('seminario-iii-abogacia',                         array['seminario 3', 'semi 3']),
  ('seminario-iv-abogacia',                          array['seminario 4', 'semi 4']),
  ('seminario-v-abogacia',                           array['seminario 5', 'semi 5']),
  ('derechos-humanos',                               array['ddhh', 'humanos']),
  ('negociacion-mediacion-y-arbitraje',              array['mediacion', 'arbitraje', 'negociacion abogacia']),
  ('derecho-ambiental',                              array['ambiental']),
  ('derecho-de-la-alta-tecnologia',                  array['alta tecnologia', 'tecnologia', 'informatico']),
  ('derecho-deportivo',                              array['deportivo']),

  -- =================== CONTADOR PÚBLICO · Plan 2017 ======================
  ('contabilidad',                                   array['conta', 'conta 1', 'contabilidad 1']),
  ('contabilidad-y-sistemas-de-informacion',         array['conta 2', 'contabilidad 2', 'csi']),
  ('contabilidad-para-la-toma-de-decisiones',        array['conta 3', 'toma de decisiones']),
  ('contabilidad-de-combinaciones-de-negocios',      array['conta 4', 'combinaciones']),
  ('estados-contables',                              array['estados', 'ecc']),
  ('administracion',                                 array['admin', 'adm 1', 'administracion 1']),
  ('administracion-avanzada',                        array['adm 2', 'admin avanzada']),
  ('matematica-aplicada-i',                          array['mate 1', 'matematica 1', 'analisis']),
  ('matematica-aplicada-ii',                         array['mate 2', 'matematica 2']),
  ('matematica-financiera',                          array['mate financiera', 'financiera']),
  ('microeconomia',                                  array['micro']),
  ('macroeconomia',                                  array['macro']),
  ('estadistica',                                    array['esta']),
  ('competitividad-y-costos',                        array['costos']),
  ('presupuesto-y-control',                          array['presupuesto']),
  ('finanzas-corporativas',                          array['finanzas', 'finanzas corpo']),
  ('finanzas-publicas-y-control',                    array['finanzas publicas']),
  ('impuestos-i',                                    array['impuestos 1', 'impo 1']),
  ('impuestos-ii',                                   array['impuestos 2', 'impo 2']),
  ('auditoria',                                      array['audi']),
  ('normas-internacionales-de-informacion-financiera', array['niif', 'normas internacionales']),
  ('diseno-y-auditoria-de-sistemas-de-informacion',  array['sistemas', 'auditoria de sistemas', 'dasi']),
  ('gestion-de-it',                                  array['it', 'gestion it', 'sistemas de gestion']),
  ('actuacion-profesional',                          array['actuacion']),
  ('derecho-publico',                                array['publico', 'derecho pub']),
  ('derecho-comercial',                              array['comercial', 'derecho com']),
  ('derecho-laboral-y-seguridad-social',             array['laboral', 'derecho laboral', 'seguridad social']),
  ('derecho-concursal-y-quiebras',                   array['concursal', 'quiebras']),
  ('introduccion-al-derecho-contador',               array['intro al derecho', 'idd']),
  ('practicas-de-integracion-i',                     array['practicas 1', 'pi 1']),
  ('practicas-de-integracion-ii',                    array['practicas 2', 'pi 2']),
  ('filosofia-y-antropologia-contador',              array['filo', 'antropo']),
  ('etica-y-sus-fundamentos-contador',               array['etica']),
  ('etica-economica-y-empresarial',                  array['etica economica', 'etica empresarial']),
  ('introduccion-a-la-teologia-contador',            array['teologia', 'teo']),
  ('sintesis-teologica-contador',                    array['sintesis', 'teologia 2']),
  ('moral-y-compromiso-social-contador',             array['moral']),
  ('taller-logica-y-oratoria',                       array['logica', 'oratoria']),
  ('taller-comunicacion-y-redaccion',                array['redaccion', 'comunicacion']),
  ('taller-software-de-negocios-i',                  array['software 1', 'excel']),
  ('taller-software-de-negocios-ii',                 array['software 2']),
  ('taller-de-habilidades-profesionales',            array['habilidades']),
  ('idioma-extranjero-ingles-contador',              array['ingles', 'idioma']),
  ('seminario-i-contador',                           array['seminario 1', 'semi 1']),
  ('seminario-ii-contador',                          array['seminario 2', 'semi 2']),
  ('seminario-iii-contador',                         array['seminario 3', 'semi 3']),
  ('seminario-iv-contador',                          array['seminario 4', 'semi 4']),
  ('seminario-argentina-en-el-mundo',                array['argentina en el mundo']),
  ('seminario-contabilidad-socio-ambiental-y-ong',   array['socio ambiental', 'ong']),
  ('gerencia-y-liderazgo',                           array['gerencia', 'liderazgo']),
  ('fundamentos-del-marketing',                      array['marketing', 'marketing 1']),
  ('marketing-estrategico',                          array['marketing 2']),
  ('estrategia-empresarial',                         array['estrategia']),
  ('negociacion',                                    array['negociacion contador']),
  ('finanzas-corporativas-avanzadas',                array['finanzas avanzadas', 'finanzas 2']),
  ('auditoria-interna-y-operativa',                  array['auditoria interna']),
  ('prevencion-de-delitos-financieros-y-lavado-de-activos', array['lavado', 'lavado de activos', 'prevencion de delitos']);

update public.materias m
   set aliases = a.aliases
  from _seed_aliases a
 where m.slug = a.slug
   and m.aliases is distinct from a.aliases;

-- Guarda de integridad de la semilla (no es una RPC: mensaje en castellano, sin
-- códigos de RPC_ERROR_CODES). Un slug acá que no exista en `materias` es un
-- typo, y un typo silencioso deja la materia sin typeahead para siempre.
do $$
declare
  faltantes text;
  n int;
begin
  select string_agg(a.slug, ', ' order by a.slug) into faltantes
  from _seed_aliases a
  where not exists (select 1 from public.materias m where m.slug = a.slug);

  if faltantes is not null then
    raise exception 'Semilla 99_aliases.sql: estos slugs de materia no existen en el catálogo: %', faltantes;
  end if;

  select count(*) into n from public.materias where cardinality(aliases) > 0;
  raise notice 'uca.net · catálogo: % materias con alias coloquiales.', n;
end
$$;

drop table _seed_aliases;
