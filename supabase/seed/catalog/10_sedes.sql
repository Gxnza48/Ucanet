-- =============================================================================
-- uca.net · semilla de catálogo · 10_sedes.sql
--
-- FUENTE ......... APPENDIX A §C.1 (Sedes) · dato de origen en §A.1
-- ESTADO ......... VERIFICADO
--   "Campus Rosario address: Av. Pellegrini 3314 (S2002QEO), Rosario, Santa Fe.
--    Phone 0810-2200-822."
--   uca.edu.ar/es/rosario/el-campus/contactos (accedido 2026-08-13)
--
-- TABLA .......... public.sedes (PART 8 §8.3.1). MVP: 1 fila.
--   El teléfono no se guarda: `sedes` no tiene columna para eso y no se inventan
--   columnas (el DDL de PART 8 es normativo).
--
-- DEPENDENCIA .... 00_universidad.sql (la sede cuelga de universidades.slug='uca').
-- IDEMPOTENCIA ... upsert por `slug`.
-- =============================================================================

set client_encoding = 'UTF8';

-- Guarda de orden de aplicación (semilla, no RPC: mensaje en castellano, sin
-- códigos de RPC_ERROR_CODES).
do $$
begin
  if not exists (select 1 from public.universidades where slug = 'uca') then
    raise exception 'Semilla 10_sedes.sql: falta la universidad "uca". Corré 00_universidad.sql primero.';
  end if;
end
$$;

with datos(slug, nombre, ciudad, direccion) as (
  values
    (
      'rosario'::text,
      'Campus Rosario'::text,
      'Rosario, Santa Fe'::text,
      'Av. Pellegrini 3314 (S2002QEO)'::text
    )
)
insert into public.sedes (universidad_id, slug, nombre, ciudad, direccion)
select u.id, d.slug, d.nombre, d.ciudad, d.direccion
from datos d
join public.universidades u on u.slug = 'uca'
on conflict (slug) do update
   set universidad_id = excluded.universidad_id,
       nombre         = excluded.nombre,
       ciudad         = excluded.ciudad,
       direccion      = excluded.direccion;

do $$
declare
  n int;
begin
  select count(*) into n from public.sedes;
  raise notice 'uca.net · catálogo: % sede(s) cargada(s).', n;
end
$$;
