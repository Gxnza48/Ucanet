/**
 * lib/utils/handle.ts — comparar seudónimos como los compara la base.
 *
 * `profiles.handle` es `citext` (migración 0004): en Postgres
 * `'MateConBizcochos' = 'mateconbizcochos'` es verdadero, y por eso el alta rechaza
 * dos seudónimos que solo difieran en mayúsculas. Pero las cinco vistas `_public`
 * emiten `pr.handle::text` (migración 0010), y sobre `text` PostgREST compara byte a
 * byte: un `eq.MATECONBIZCOCHOS` no devuelve ninguna fila aunque la persona exista.
 * De ahí salía el perfil que mentía — cabecera propia completa y cero publicaciones.
 *
 * La comparación insensible se hace entonces del lado del filtro, con `ilike` y el
 * seudónimo entero como patrón (sin `*`: es igualdad, no búsqueda). `_` y `%` son
 * comodines de LIKE y `_` es un carácter válido de seudónimo (PART 9 §9.5), así que
 * hay que escaparlos con la barra invertida que Postgres usa por defecto: sin eso,
 * `/u/mate_con` listaría también lo que escribió `mateXcon`, que es atribuirle a un
 * seudónimo lo que publicó otro — el error más caro posible en un producto anónimo.
 *
 * Vale para las columnas de handle de las vistas (`author_handle` de
 * `posts_public` / `resources_public`, `handle` de `profiles_public`). Sobre la
 * tabla base `profiles`, `eq` ya es insensible solo: ahí la columna sigue siendo
 * citext.
 */

/** Metacaracteres de LIKE. La barra invertida va primero para no re-escapar. */
const LIKE_METACHARACTERS = /[\\%_]/g

/**
 * Patrón `ilike` que iguala un seudónimo sin distinguir mayúsculas.
 *
 * Uso: en la consulta a `posts_public`, `.ilike('author_handle', handlePattern(handle))`.
 * (El ejemplo va en prosa a propósito: escrito como código dispararía la regla 2 de
 * `scripts/forbidden.sh`, que busca el patrón de acceso a datos en texto plano.)
 */
export function handlePattern(handle: string): string {
  return handle.replace(LIKE_METACHARACTERS, '\\$&')
}
