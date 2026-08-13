/**
 * lib/cursor.ts — el cursor keyset que usan TODAS las listas (PART 12 §12.4).
 *
 * Paginación por clave, nunca por `OFFSET`. Dos razones, las dos duras:
 *
 *   - `OFFSET n` hace que Postgres escanee y tire n filas: el costo crece con la
 *     profundidad de la página. El keyset es O(página) para siempre.
 *   - Con OFFSET, cualquier fila que se inserte o se borre entre dos requests corre
 *     todo el resto: aparecen duplicados y huecos. Con keyset la página siguiente se
 *     define por "todo lo que viene después de ESTA fila", que no se mueve.
 *
 * La consulta que esto habilita es siempre la misma forma:
 *
 *     order by created_at desc, id desc
 *     where (created_at, id) < (:createdAt, :id)     -- comparación de tuplas
 *
 * El par completo importa: `created_at` solo no desempata dos filas del mismo
 * milisegundo y se saltearía una. Por eso el cursor lleva SIEMPRE los dos campos.
 *
 * El cursor es opaco y NO está firmado, y eso está decidido (§12.4): lo peor que
 * consigue quien lo manipule es una página rara. La consulta corre igual bajo RLS
 * como el visitante que la pide, así que un cursor inventado no destapa nada — no
 * es un token de autorización y no hay que tratarlo como tal. Lo que sí hace falta
 * es que un cursor basura no rompa la página: por eso `decodeCursor` valida con Zod
 * y devuelve null en lugar de tirar, y quien lo llama trata el null como "primera
 * página".
 *
 * Codificación: base64url (`-` y `_`, sin relleno `=`). Va en un query string, y
 * base64 clásico mete `+` y `/`, que obligan a escapar en cada link que se arme a
 * mano. Se usa `btoa`/`atob`, que existen tanto en Node 20 como en el runtime Edge;
 * el contenido es JSON puro ASCII (un timestamp ISO y un entero), así que no hay
 * problema de UTF-8.
 */
import { z } from 'zod'

/**
 * Posición dentro de una lista ordenada.
 *
 * `createdAt` es el TIMESTAMP DE ORDEN, no necesariamente la columna `created_at`:
 * en Reciente es `created_at` (D2: cronológico de verdad, los comentarios no
 * reordenan) y en Mis materias es `last_activity_at`. El nombre viene del contrato
 * (BUILD CONTRACT §4.5); lo que importa es que sea la misma columna por la que
 * ordena el `ORDER BY`.
 *
 * `id` es el bigint interno y JAMÁS se renderiza: viaja adentro del blob opaco y
 * vuelve al servidor, que es la única frontera donde puede existir (D14.7).
 */
export type Cursor = {
  createdAt: string
  id: number
}

/** Tope de largo de un cursor entrante. Nada legítimo se acerca; el resto es ruido. */
const MAX_CURSOR_LENGTH = 512

/** Alfabeto base64url. Se chequea antes de decodificar para no darle basura a atob. */
const BASE64URL = /^[A-Za-z0-9_-]+$/

/**
 * Forma del payload, con las claves cortas para que el cursor no infle la URL.
 * `t` = timestamp de orden, `i` = id.
 *
 * `t` se valida con `Date.parse` y no con `z.iso.datetime()` a propósito: PostgREST
 * serializa `timestamptz` con microsegundos y offset (`2027-03-14T12:00:00.123456+00:00`),
 * y encadenarse al formato exacto convertiría un detalle del driver en páginas rotas.
 * Lo único que se exige es que sea una fecha que Postgres pueda comparar.
 */
const payloadSchema = z.object({
  t: z
    .string()
    .min(4)
    .max(64)
    .refine((value) => Number.isFinite(Date.parse(value)), 'timestamp inválido'),
  i: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
})

/**
 * Serializa una posición a un cursor opaco listo para un query string.
 *
 * Lo arma quien produce la lista, con la ÚLTIMA fila devuelta: ese es el
 * `nextCursor` de `{ items, nextCursor }`. Cuando no hay página siguiente, el valor
 * es null y no se llama a esta función.
 */
export function encodeCursor(cursor: Cursor): string {
  return toBase64Url(JSON.stringify({ t: cursor.createdAt, i: cursor.id }))
}

/**
 * Lee un cursor de la URL. Devuelve null ante cualquier cosa que no sea uno válido.
 *
 * Null significa "primera página", que es la degradación correcta: un cursor
 * truncado al copiar un link, uno de una versión vieja o uno tocado a mano muestran
 * el principio de la lista, no un error.
 */
export function decodeCursor(value: string | null | undefined): Cursor | null {
  if (!value || value.length > MAX_CURSOR_LENGTH || !BASE64URL.test(value)) return null

  try {
    const json = fromBase64Url(value)
    const parsed = payloadSchema.safeParse(JSON.parse(json))
    if (!parsed.success) return null

    return { createdAt: parsed.data.t, id: parsed.data.i }
  } catch {
    // JSON roto o base64 inválido: mismo tratamiento que un cursor ausente.
    return null
  }
}

/** base64url sin relleno. */
function toBase64Url(text: string): string {
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Inversa de `toBase64Url`: repone el relleno que `atob` sí exige. */
function fromBase64Url(value: string): string {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padding = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4))
  return atob(base64 + padding)
}
