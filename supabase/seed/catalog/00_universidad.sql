-- =============================================================================
-- uca.net · semilla de catálogo · 00_universidad.sql
--
-- FUENTE ......... APPENDIX A §A.1 (Sede / Campus)
-- ESTADO ......... VERIFICADO
--   "UCA is the Pontificia Universidad Catolica Argentina, with campuses in
--    Buenos Aires (Puerto Madero), Rosario, Mendoza and Parana."
--   uca.edu.ar (estructura del sitio) +
--   en.wikipedia.org/wiki/Pontifical_Catholic_University_of_Argentina
--   (accedido 2026-08-13)
--
-- TABLA .......... public.universidades (PART 8 §8.3.1)
--   Raíz de la cadena universidades → sedes → facultades → carreras →
--   plan_materias → materias (PART 8 §8.8). En MVP hay exactamente 1 fila.
--
-- IDEMPOTENCIA ... upsert por `slug` (PART 8 §8.10.2). Este archivo se aplica a
--   dev, CI y producción tantas veces como haga falta: nunca toca contenido de
--   usuarios, solo corrige el catálogo.
--
-- ORTOGRAFÍA ..... el `slug` va sin tildes (D7: minúsculas, ascii, guiones);
--   el `nombre` lleva la ortografía correcta en castellano aunque el apéndice
--   lo tenga sin tildes por limitaciones de la fuente.
-- =============================================================================

set client_encoding = 'UTF8';

insert into public.universidades (slug, nombre, sigla)
values ('uca', 'Pontificia Universidad Católica Argentina', 'UCA')
on conflict (slug) do update
   set nombre = excluded.nombre,
       sigla  = excluded.sigla;

-- Verificación de la semilla: si esto falla, nada aguas abajo tiene sentido.
-- Nota: esto es una guarda de semilla, no una RPC — por eso el mensaje es texto
-- en castellano y no uno de los códigos de RPC_ERROR_CODES (lib/errors.ts).
do $$
begin
  if not exists (select 1 from public.universidades where slug = 'uca') then
    raise exception 'Semilla 00_universidad.sql: no quedó la fila de la universidad "uca".';
  end if;
  raise notice 'uca.net · catálogo: universidad "uca" lista.';
end
$$;
