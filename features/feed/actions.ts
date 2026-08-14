'use server'

import 'server-only'

/**
 * features/feed/actions.ts — la página siguiente del feed, como Server Action.
 *
 * POR QUÉ SON ACTIONS Y NO UN ROUTE HANDLER. El scroll infinito necesita pedir la página
 * siguiente desde el navegador. Las dos formas de hacerlo son un `app/api/feed/route.ts` o
 * esto. Se eligió esto por tres razones concretas:
 *
 *   1. Un route handler sería una URL pública más, y el mapa de URLs es un contrato de diez
 *      años (D7). `/api/feed?cursor=…` no está en ese mapa y no debería estar: no es una
 *      página, es un detalle de implementación de una lista.
 *   2. La action reusa la sesión del request sin volver a parsear cookies a mano, y corre
 *      bajo RLS como el lector, igual que el render del servidor. Un handler tendría que
 *      repetir ese armado, que es exactamente donde se filtran datos.
 *   3. El tipo de retorno es el mismo `FeedPage` que ya devuelve `queries.ts`: no hay un
 *      contrato JSON paralelo que mantener sincronizado ni un `zod` de respuesta.
 *
 * SON LECTURAS, NO ESCRITURAS. Las cinco etapas de BUILD-CONTRACT §4.6 aplican en lo que
 * tiene sentido —se valida la entrada aunque el cliente ya la haya armado, y se devuelve
 * `ActionResult`— pero acá NO hay `updateTag` ni `revalidateTag`: no se escribió nada, y
 * invalidar caché desde una lectura sería tirar el trabajo de otro request por nada.
 *
 * El cursor entrante es dato del navegador y se trata como tal: se acota el largo antes de
 * decodificarlo. No hace falta más — el cursor no autoriza nada (§12.4), la consulta corre
 * igual bajo RLS, y `decodeCursor` ya devuelve null ante cualquier basura, que degrada a
 * "primera página" en vez de romper.
 */
import { z } from 'zod'

import { fail, ok, type ActionResult } from '@/lib/result'

import {
  getMisMateriasFeed,
  getParaVosFeed,
  getRecentFeed,
  type FeedOptions,
  type FeedPage,
} from './queries'

/**
 * Mismo tope que `lib/cursor.ts`: ningún cursor legítimo se acerca a 512 caracteres, y el
 * corte evita que una cadena de un megabyte llegue a `JSON.parse`.
 */
const MAX_CURSOR_LENGTH = 512

const cursorSchema = z.string().min(1).max(MAX_CURSOR_LENGTH)

/**
 * Copy de §17.5.6: una oración, dice qué pasó y qué hacer. Se usa igual para el cursor
 * inválido y para el fallo de lectura porque, desde el lector, son el mismo hecho: la
 * página siguiente no llegó y el botón "Reintentar" es la salida en los dos casos.
 */
const LOAD_MORE_ERROR = 'No pudimos cargar más publicaciones. Probá de nuevo.'

/**
 * El cuerpo compartido de las tres actions.
 *
 * No se exporta: en un módulo `'use server'` cada export es un endpoint, así que lo único
 * que sale de este archivo son las tres funciones que el navegador tiene permitido llamar.
 *
 * `read` no captura nada: recibe la función de lectura y ya. Las lecturas del feed no tiran
 * ante un error de base (devuelven página vacía y lo dejan en el log), así que el `catch` es
 * para lo imprevisto — un cursor que rompe el decodificador, una caída del cliente Supabase.
 */
async function loadMorePage(
  cursor: string,
  read: (opts: FeedOptions) => Promise<FeedPage>,
): Promise<ActionResult<FeedPage>> {
  const parsed = cursorSchema.safeParse(cursor)
  if (!parsed.success) return fail<FeedPage>(LOAD_MORE_ERROR)

  try {
    return ok(await read({ cursor: parsed.data }))
  } catch (error) {
    console.error('[feed] falló la página siguiente', error)
    return fail<FeedPage>(LOAD_MORE_ERROR)
  }
}

/** Página siguiente de "Para vos" (`/`). El `now` de la sesión viaja adentro del cursor. */
export async function loadMoreParaVos(cursor: string): Promise<ActionResult<FeedPage>> {
  return loadMorePage(cursor, getParaVosFeed)
}

/** Página siguiente de "Reciente" (`/reciente`). Keyset por `(created_at, id)`. */
export async function loadMoreReciente(cursor: string): Promise<ActionResult<FeedPage>> {
  return loadMorePage(cursor, getRecentFeed)
}

/** Página siguiente de "Mis materias" (`/mis-materias`). Keyset por `(rank, id)` con `t0` fijo. */
export async function loadMoreMisMaterias(cursor: string): Promise<ActionResult<FeedPage>> {
  return loadMorePage(cursor, getMisMateriasFeed)
}
