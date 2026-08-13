/**
 * lib/utils/text.ts — recortes de texto para listas y metadatos.
 *
 * Dos funciones con propósitos distintos:
 *
 * - `truncate` corta duro, respetando el largo pedido. Para títulos y nombres de
 *   archivo, donde el largo es una restricción de layout.
 * - `excerpt` arma un resumen legible: aplasta saltos de línea y espacios, corta
 *   en límite de palabra. Para `<meta name="description">`, previews de WhatsApp
 *   (D11) y el cuerpo abreviado en un renglón de feed.
 *
 * Ninguna sanitiza HTML: los cuerpos del MVP son texto plano y el escapado de
 * React es el sanitizador (PART 19 §19.12). Estas funciones solo acortan.
 */

/** Largo por defecto de un extracto: alcanza para una meta description. */
export const EXCERPT_LENGTH = 200

/** Puntos suspensivos tipográficos, no tres puntos. */
const ELLIPSIS = '…'

/**
 * Corta `text` a `max` caracteres. El resultado nunca supera `max`: si hubo que
 * cortar, los puntos suspensivos ocupan el último lugar disponible.
 *
 * Devuelve el texto intacto cuando ya entra — el `…` es señal de "hay más", y
 * ponerlo cuando no falta nada miente.
 */
export function truncate(text: string, max: number): string {
  if (max <= 0) return ''
  if (text.length <= max) return text

  const cut = dropDanglingSurrogate(text.slice(0, max - 1))
  return `${trimEnd(cut)}${ELLIPSIS}`
}

/**
 * Resumen de una sola línea: aplasta todo espacio en blanco (incluidos saltos de
 * línea y párrafos) a un espacio simple, y corta en el último límite de palabra
 * que entre en `max`, con `…` solo si efectivamente cortó.
 *
 * Cortar en límite de palabra importa porque estos extractos se leen fuera del
 * sitio —en la tarjeta de un enlace compartido, en el resultado de Google— donde
 * una palabra partida al medio es lo único que el lector ve del post.
 */
export function excerpt(text: string, max: number = EXCERPT_LENGTH): string {
  if (max <= 0) return ''

  const collapsed = collapseWhitespace(text)
  if (collapsed.length <= max) return collapsed

  const room = max - 1 // el último carácter queda para el `…`
  // Un carácter de más para saber si el corte parte una palabra o cae justo entre dos.
  const candidate = collapsed.slice(0, room + 1)
  const lastSpace = candidate.lastIndexOf(' ')

  // Sin espacios: es una sola palabra larguísima (una URL pegada, por ejemplo),
  // y ahí el corte duro es la única opción.
  const cut =
    lastSpace > 0 ? collapsed.slice(0, lastSpace) : dropDanglingSurrogate(collapsed.slice(0, room))

  return `${trimEnd(cut)}${ELLIPSIS}`
}

/** Todo espacio en blanco (saltos, tabs, espacios repetidos) pasa a un espacio simple. */
function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function trimEnd(value: string): string {
  return value.replace(/\s+$/, '')
}

/**
 * Evita partir un par sustituto al cortar por índice: `slice` opera sobre
 * unidades UTF-16 y podría dejar media letra (un carácter fuera del plano
 * básico) y renderizar el rombo de reemplazo.
 */
function dropDanglingSurrogate(value: string): string {
  const last = value.charCodeAt(value.length - 1)
  return last >= 0xd800 && last <= 0xdbff ? value.slice(0, -1) : value
}
