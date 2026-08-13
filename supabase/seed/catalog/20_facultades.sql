-- =============================================================================
-- uca.net · semilla de catálogo · 20_facultades.sql
--
-- FUENTE ......... APPENDIX A §C.2 (Facultades, sede Rosario) · origen en §A.2
-- ESTADO ......... VERIFICADO (las tres tienen página oficial con "del rosario"
--                  en la URL canónica de uca.edu.ar, accedidas 2026-08-13):
--   · uca.edu.ar/es/facultades/facultad-de-derecho-y-ciencias-sociales-del-rosario
--   · uca.edu.ar/es/facultades/facultad-de-ciencias-economicas-del-rosario
--   · uca.edu.ar/es/facultades/facultad-de-quimica-e-ingenieria-del-rosario
--
-- SALVEDAD ....... APPENDIX A §B marca SIN VERIFICAR una posible unificación
--   administrativa de facultades entre sedes (algunas carreras de Rosario
--   resuelven bajo facultades de Buenos Aires con `?sede_de_interes=Rosario`).
--   PART 8 §8.3.1 adjudica: se mantiene el FK simple facultad → sede y el slug
--   es la identidad durable; si la universidad cambia su estructura, se remodela
--   por migración.
--
-- DECISIÓN EDITORIAL: el nombre de Química e Ingeniería va SIN el epíteto
--   histórico "Fray Rogelio Bacon" (atestiguado por lacapital.com.ar y anotado
--   en §A.2), porque `nombre` se renderiza como título de la página
--   /facultades/[slug] (D7) y la URL oficial vigente lo omite.
--
-- DEPENDENCIA .... 10_sedes.sql. IDEMPOTENCIA: upsert por `slug`.
-- =============================================================================

set client_encoding = 'UTF8';

do $$
begin
  if not exists (select 1 from public.sedes where slug = 'rosario') then
    raise exception 'Semilla 20_facultades.sql: falta la sede "rosario". Corré 10_sedes.sql primero.';
  end if;
end
$$;

with datos(slug, nombre) as (
  values
    ('derecho-cs-sociales-rosario'::text, 'Facultad de Derecho y Ciencias Sociales del Rosario'::text),
    ('cs-economicas-rosario',             'Facultad de Ciencias Económicas del Rosario'),
    -- Nombre histórico: "Fray Rogelio Bacon" (§A.2). Ver decisión editorial arriba.
    ('quimica-ingenieria-rosario',        'Facultad de Química e Ingeniería del Rosario')
)
insert into public.facultades (sede_id, slug, nombre)
select s.id, d.slug, d.nombre
from datos d
join public.sedes s on s.slug = 'rosario'
on conflict (slug) do update
   set sede_id = excluded.sede_id,
       nombre  = excluded.nombre;

do $$
declare
  n int;
begin
  select count(*) into n from public.facultades;
  raise notice 'uca.net · catálogo: % facultad(es) cargada(s).', n;
end
$$;
