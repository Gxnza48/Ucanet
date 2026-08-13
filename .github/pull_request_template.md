# Qué cambia

<!-- Una o dos frases. Qué hace el usuario ahora que antes no podía, o qué se arregló. -->

Cierra: <!-- #issue, o "ninguno" -->

# Cómo lo probé

<!-- Los pasos exactos en el preview: URL, cuenta usada, qué miraste. Si toca el esquema, decí contra qué base. -->

# Revisión (PART 26 §26.6)

Nueve casilleros binarios. Si alguno no aplica, marcalo igual y escribí "no aplica" al lado; dejarlo en blanco es dejar la revisión sin hacer.

## Seguridad y datos (D14)

- [ ] **RLS con test.** Toda política nueva o modificada tiene su prueba pgTAP de permitir y su prueba de denegar, en este mismo PR (D14.2).
- [ ] **Sin claves en el cliente.** Ninguna `service_role` fuera de `app/api/cron` y `lib/supabase/admin.ts`; ninguna variable `NEXT_PUBLIC_` nueva sin entrada en `docs/decisions.md` (D14.3).
- [ ] **IDs públicos en las URLs.** Nada de ids `bigint` de la base en rutas, formularios ni payloads: solo `public_id` de nanoid y slugs (D14.7).
- [ ] **Lecturas por las vistas `_public`.** El contenido anónimo no expone campos de autor por ningún camino (D14.5, D3).
- [ ] **Validación en el servidor.** Toda mutación pasa por Zod del lado del servidor, sin confiar en lo que ya validó el formulario (D14.4).
- [ ] **Con rate limit si escribe.** El límite vive en la función SQL, no solo en el proxy (D14.9).

## Producto y moderación

- [ ] **Superficie de moderación presente.** Lo que crea contenido se puede reportar, remover y queda auditado; si no, no se mergea (D14.10).
- [ ] **Anda deslogueado** donde el contenido es público, y el contenido eliminado responde 410, no 404 (§0.5-R23c).
- [ ] **Copy en es-AR con voseo.** Leído en voz alta una vez: "Publicá", "Ingresá", "Seguí". Sin inglés en botones, placeholders ni `aria-label`. Sin emoji ni signos de exclamación (D9, D14.6).
- [ ] **Evento de analítica** si la acción está en el catálogo cerrado de PART 24 §24.3. Nunca texto libre, nunca por usuario.

## Interfaz

- [ ] **Mobile a 390 px** revisado de verdad, no solo el responsive del navegador.
- [ ] **Teclado y foco.** Todo alcanzable con Tab, con anillo de foco visible; los iconos tienen nombre accesible.
- [ ] **Solo tokens.** Ningún valor arbitrario de Tailwind ni hex crudo: los valores visuales salen de `app/tokens.css` (PART 17 anti-checklist 13-14).

## Performance y dependencias

- [ ] **Presupuesto de JS respetado.** Las páginas de contenido (`/p/[id]`, materia, carrera, legales) siguen sin JS de cliente propio; el feed sigue por debajo de 90 KB gz (PART 22 §22.1). Todo `'use client'` nuevo está en la lista de PART 19 §19.3.
- [ ] **Consultas por render ≤ 3**, todas con índice (PART 22 §22.2).
- [ ] **Sin dependencias nuevas.** Y si la hay, tiene su ADR en `docs/decisions.md` con qué, por qué y camino de salida (D14.8).

## Si toca el esquema

- [ ] Migración nueva en `supabase/migrations/`, nunca editando una ya aplicada (D14.1).
- [ ] `supabase db reset` local en verde: la cadena replaya desde cero.
- [ ] `lib/types.gen.ts` regenerado y commiteado.
- [ ] **Aditiva**: compatible hacia atrás con la app que está desplegada. Un cambio destructivo va en dos entregas (§20.8).

# Notas para quien revise

<!-- Lo que releerías vos si volvieras a esto en seis meses. Dudas abiertas, deuda aceptada a propósito, qué NO probaste. -->
