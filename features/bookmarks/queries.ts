import 'server-only'

/**
 * features/bookmarks/queries.ts — las lecturas de Guardados.
 *
 * Guardados es la tercera lista del producto de uso diario (junto a "Para vos" y
 * "Tendencias"): lo que el lector marcó con el ícono de guardar, en orden inverso al de
 * guardado. No es un feed rankeado ni tiene fórmula: el orden lo pone la persona.
 *
 * ---------------------------------------------------------------------------------------
 * DE DÓNDE SALEN LOS DATOS
 * ---------------------------------------------------------------------------------------
 * De la RPC `feed_guardados(p_limit, p_after_created_at, p_after_id)`, que devuelve las
 * mismas columnas que las otras dos listas más `saved_at`. La RPC corre `security definer`
 * sobre `posts_public` y ya viene acotada a quien la llama (`auth.uid()`), así que acá no
 * se filtra por usuario: hacerlo sería redundante y daría la falsa impresión de que la
 * autorización vive en TypeScript.
 *
 * `getBookmarkedIds()` es la otra mitad: una lista cualquiera de publicaciones necesita
 * saber cuáles ya están guardadas para pintar el botón, y tiene que resolverlo en UNA
 * consulta y no en una por fila. Es el mismo patrón exacto de `getViewerPostVotes()` en
 * features/posts.
 *
 * ---------------------------------------------------------------------------------------
 * TIPOS: POR QUÉ HAY UN CAST ACÁ (y cuándo se borra)
 * ---------------------------------------------------------------------------------------
 * `lib/types.gen.ts` todavía no conoce ni la tabla `bookmarks` ni la función
 * `feed_guardados`: la migración que las crea se escribe en paralelo a este archivo. En
 * vez de castear a `any` (que apagaría el tipado de TODA la consulta) o de tocar
 * `lib/types.gen.ts` (que es de otro agente y lo regenera CI), este archivo declara el
 * DELTA —exactamente los dos objetos que faltan, con la forma que emite
 * `supabase gen types`— y se lo suma al `Database` real. El resto del esquema sigue
 * tipado como siempre: `materias` y `carreras` se leen con el tipo generado de verdad.
 *
 * El `Omit<…>` antes de cada intersección es a propósito: cuando `lib/types.gen.ts` gane
 * estos dos objetos, la declaración local los pisa en vez de intersecarlos, así que el
 * archivo compila igual antes y después. Cuando eso pase, se borran el bloque
 * `BookmarksSchema`, el cast de `createBookmarksClient()` y este párrafo, en un commit.
 *
 * ---------------------------------------------------------------------------------------
 * ERRORES Y PAGINACIÓN
 * ---------------------------------------------------------------------------------------
 * Una lectura de lista que falla devuelve página vacía y deja el error en el log, igual
 * que el feed: una lista vacía es un mal rato, una excepción es una pantalla rota.
 *
 * Cursor keyset `(saved_at, id)` en base64url, nunca OFFSET (BUILD-CONTRACT §4.5).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

import { PAGE_SIZE } from '@/lib/config'
import { createClient, getUser } from '@/lib/supabase/server'
import type { Database } from '@/lib/types.gen'

// ---------------------------------------------------------------------------------------
// Tipos públicos de la feature
// ---------------------------------------------------------------------------------------

/** Materia o carrera de una fila, ya resuelta a algo linkeable. */
export type GuardadoScope = {
  slug: string
  nombre: string
}

/**
 * Una fila de Guardados: la fila del feed más el momento en que se guardó.
 *
 * Sin `id` interno: el bigint no cruza al navegador (D14.7). La fila viaja con `publicId`
 * y con slugs, que es todo lo que necesita para linkear a `/p/[publicId]` y a
 * `/materias/[slug]`.
 *
 * Es un SUPERCONJUNTO estructural de la fila del feed (`features/feed/queries.ts` →
 * `PostListItem`): mismos nombres, mismos tipos, más `savedAt`, `editedAt` y `lockedAt`.
 * TypeScript es estructural, así que un `GuardadoItem[]` entra tal cual donde se espera
 * una lista de feed. Es deliberado —el límite de imports entre features prohíbe compartir
 * el tipo— y la regla operativa es la misma que documenta el feed: si la forma cambia,
 * cambia en las dos features en el mismo commit.
 */
export type GuardadoItem = {
  /** nanoid de 10 caracteres. Es la URL: `/p/[publicId]`. */
  publicId: string
  /** `texto` | `pregunta`. Solo `pregunta` lleva rótulo visible. */
  kind: string
  /** Puede faltar: los micro-posts no llevan título y la fila usa el cuerpo. */
  title: string | null
  /** Cuerpo completo; el recorte lo hace la fila al renderizar. */
  body: string
  isAnonymous: boolean
  /** Seudónimo del autor, o null si publicó como anónimo. Nunca hay otro dato de autor (D3). */
  authorHandle: string | null
  /** Materia etiquetada, si la hay. */
  materia: GuardadoScope | null
  /** Carrera del snapshot; solo se muestra en posts SIN materia (§12.5, §12.7). */
  carrera: GuardadoScope | null
  score: number
  commentsCount: number
  createdAt: string
  lastActivityAt: string
  /** Última edición, o null. Hoy la lista no lo muestra; viene de la RPC y no se tira. */
  editedAt: string | null
  /** Hilo bloqueado por moderación (§0.5-R5), o null. Ídem: llega de la RPC. */
  lockedAt: string | null
  /** Cuándo lo guardó el lector. Es lo que ordena esta lista. */
  savedAt: string
}

/** Opciones de toda lectura de lista (BUILD-CONTRACT §4.5). */
export type GuardadosOptions = {
  /** Cursor keyset opaco devuelto por la página anterior. */
  cursor?: string
  /** Tamaño de página; por defecto `PAGE_SIZE` (25). */
  limit?: number
}

export type GuardadosPage = {
  items: GuardadoItem[]
  nextCursor: string | null
}

// ---------------------------------------------------------------------------------------
// El delta de esquema que `lib/types.gen.ts` todavía no tiene (ver el encabezado)
// ---------------------------------------------------------------------------------------

/**
 * Fila cruda de `feed_guardados`, tal como sale de PostgREST.
 *
 * La nulabilidad está declarada COLUMNA POR COLUMNA contra el esquema real, y ahí este
 * bloque es más preciso que lo que emite `supabase gen types` para una función
 * `returns table (…)`: el generador tipa todas esas columnas como no-nulas (mirá
 * `search_posts` en `lib/types.gen.ts`) aunque `title`, `materia_id` y `author_handle`
 * puedan venir en null. Se declara lo que la base puede devolver de verdad, para que el
 * mapeador de abajo esté obligado a contemplarlo.
 */
type FeedGuardadosRow = {
  /** Id interno. Solo servidor: alimenta el cursor keyset y las lecturas de catálogo. */
  id: number
  public_id: string
  materia_id: number | null
  carrera_id: number | null
  kind: string
  title: string | null
  body: string
  is_anonymous: boolean
  author_handle: string | null
  score: number
  comments_count: number
  locked_at: string | null
  created_at: string
  edited_at: string | null
  last_activity_at: string
  /** `bookmarks.created_at` con alias. Es la clave de orden de esta lista. */
  saved_at: string
}

type BookmarksSchema = {
  public: Omit<Database['public'], 'Tables' | 'Functions'> & {
    Tables: Omit<Database['public']['Tables'], 'bookmarks'> & {
      bookmarks: {
        Row: { user_id: string; post_id: number; created_at: string }
        Insert: { user_id: string; post_id: number; created_at?: string }
        Update: { user_id?: string; post_id?: number; created_at?: string }
        Relationships: []
      }
    }
    Functions: Omit<Database['public']['Functions'], 'feed_guardados'> & {
      feed_guardados: {
        Args: {
          p_limit: number
          p_after_created_at: string | null
          p_after_id: number | null
        }
        Returns: FeedGuardadosRow[]
      }
    }
  }
}

type BookmarksClient = SupabaseClient<BookmarksSchema>

/** El cliente de siempre, con los dos objetos que `lib/types.gen.ts` todavía no declara. */
async function createBookmarksClient(): Promise<BookmarksClient> {
  return (await createClient()) as unknown as BookmarksClient
}

// ---------------------------------------------------------------------------------------
// Constantes y cursor
// ---------------------------------------------------------------------------------------

/** Tope defensivo del tamaño de página pedido por quien llama. */
const MAX_LIMIT = 100

const EMPTY_PAGE: GuardadosPage = { items: [], nextCursor: null }

/**
 * Cursor keyset `(saved_at, id)`, JSON chico en base64url validado con Zod.
 *
 * No va firmado a propósito: el peor caso de que alguien lo manipule es una página rara,
 * no una fuga — la RPC sigue corriendo acotada a su `auth.uid()`. base64url y no base64
 * porque el cursor viaja en el query string, donde un `+` se decodifica como espacio.
 *
 * `c` alimenta `p_after_created_at`: el parámetro nombra `created_at` de `bookmarks`, que
 * es la columna que la RPC devuelve con alias `saved_at`. Si el orden de la RPC resultara
 * ser por `posts.created_at` y no por el del marcador, esta es la única línea a cambiar.
 */
const cursorSchema = z.object({
  /** `saved_at` de la última fila entregada. */
  c: z.string().min(1),
  /** Id interno de esa fila; desempata marcadores del mismo instante. */
  i: z.number().int().positive(),
})

function encodeCursor(value: z.infer<typeof cursorSchema>): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url')
}

function decodeCursor(raw: string | undefined): z.infer<typeof cursorSchema> | null {
  if (!raw) return null
  try {
    const parsed = cursorSchema.safeParse(
      JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')),
    )
    return parsed.success ? parsed.data : null
  } catch {
    // JSON roto o base64 inválido: se ignora y se sirve la primera página.
    return null
  }
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return PAGE_SIZE
  return Math.min(Math.max(1, Math.trunc(limit)), MAX_LIMIT)
}

// ---------------------------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------------------------

type ScopeMaps = {
  materias: Map<number, GuardadoScope>
  carreras: Map<number, GuardadoScope>
}

/**
 * Resuelve nombres y slugs del catálogo para las filas que ya se van a devolver.
 *
 * Se hace DESPUÉS de recortar la página: son como mucho 25 ids distintos por lado, contra
 * dos tablas diminutas y por PK. Solo se piden carreras de los posts SIN materia: el chip
 * de carrera existe únicamente para los posts sin etiquetar (§12.5).
 *
 * Es gemela de `loadScopes()` en features/feed: el límite de imports entre features
 * prohíbe compartirla y no existe `features/shared/`, jamás. Si algún día hay un tercer
 * inquilino, se promueve a `lib/`.
 */
async function loadScopes(supabase: BookmarksClient, rows: FeedGuardadosRow[]): Promise<ScopeMaps> {
  const materiaIds = [
    ...new Set(rows.map((row) => row.materia_id).filter((id): id is number => id !== null)),
  ]
  const carreraIds = [
    ...new Set(
      rows
        .filter((row) => row.materia_id === null)
        .map((row) => row.carrera_id)
        .filter((id): id is number => id !== null),
    ),
  ]

  const [materiasResult, carrerasResult] = await Promise.all([
    materiaIds.length > 0
      ? supabase.from('materias').select('id, slug, nombre').in('id', materiaIds)
      : Promise.resolve({ data: [], error: null }),
    carreraIds.length > 0
      ? supabase.from('carreras').select('id, slug, nombre').in('id', carreraIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  const materias = new Map<number, GuardadoScope>()
  for (const row of materiasResult.data ?? []) {
    materias.set(row.id, { slug: row.slug, nombre: row.nombre })
  }

  const carreras = new Map<number, GuardadoScope>()
  for (const row of carrerasResult.data ?? []) {
    carreras.set(row.id, { slug: row.slug, nombre: row.nombre })
  }

  return { materias, carreras }
}

function toItem(row: FeedGuardadosRow, scopes: ScopeMaps): GuardadoItem {
  const materia = row.materia_id === null ? null : (scopes.materias.get(row.materia_id) ?? null)
  // El chip de carrera es el fallback de los posts sin materia, nunca un segundo chip.
  const carrera =
    materia === null && row.carrera_id !== null
      ? (scopes.carreras.get(row.carrera_id) ?? null)
      : null

  return {
    publicId: row.public_id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    isAnonymous: row.is_anonymous,
    authorHandle: row.author_handle,
    materia,
    carrera,
    score: row.score,
    commentsCount: row.comments_count,
    createdAt: row.created_at,
    lastActivityAt: row.last_activity_at,
    editedAt: row.edited_at,
    lockedAt: row.locked_at,
    savedAt: row.saved_at,
  }
}

// ---------------------------------------------------------------------------------------
// Las dos lecturas
// ---------------------------------------------------------------------------------------

/**
 * La lista de `/guardados`, de lo último guardado a lo primero.
 *
 * Sin sesión no hay nada que leer: `feed_guardados` está otorgada solo a `authenticated`,
 * así que llamarla como anónimo sería un error garantizado. `getUser()` está memorizada
 * por request, de modo que este chequeo no cuesta un viaje extra cuando la página ya pasó
 * por `requireProfile()`.
 *
 * Se pide UNA fila de más (`limit + 1`): es cómo se sabe que hay página siguiente sin
 * contar el total.
 */
export async function getGuardados(opts: GuardadosOptions = {}): Promise<GuardadosPage> {
  const limit = clampLimit(opts.limit)

  const user = await getUser()
  if (!user) return EMPTY_PAGE

  const supabase = await createBookmarksClient()
  const cursor = decodeCursor(opts.cursor)

  const { data, error } = await supabase.rpc('feed_guardados', {
    p_limit: limit + 1,
    p_after_created_at: cursor?.c ?? null,
    p_after_id: cursor?.i ?? null,
  })

  if (error) {
    console.error('[guardados] falló la lectura de Guardados', error)
    return EMPTY_PAGE
  }

  const rows = data ?? []
  const hasMore = rows.length > limit
  const page = hasMore ? rows.slice(0, limit) : rows

  const scopes = await loadScopes(supabase, page)
  const items = page.map((row) => toItem(row, scopes))

  const last = page[page.length - 1]
  const nextCursor =
    hasMore && last !== undefined ? encodeCursor({ c: last.saved_at, i: last.id }) : null

  return { items, nextCursor }
}

/**
 * De un lote de publicaciones, cuáles ya están guardadas por el lector.
 *
 * Una sola consulta para toda la lista: es lo que permite que una página con 25 filas
 * pinte 25 botones de guardar sin 25 lecturas. Mismo patrón que `getViewerPostVotes()`.
 *
 * Los `postIds` son bigint internos y por eso esto se llama SIEMPRE del lado del servidor,
 * con los ids que la propia página acaba de leer; al navegador viaja el `publicId` (D14.7).
 *
 * `bookmarks` tiene política de select sobre las filas propias, así que la base ya acota
 * el resultado. El `.eq('user_id', …)` igual va: le da al planificador el prefijo del
 * índice y deja la consulta correcta aunque la política se ensanche algún día.
 */
export async function getBookmarkedIds(postIds: number[]): Promise<Set<number>> {
  if (postIds.length === 0) return new Set()

  const user = await getUser()
  if (!user) return new Set()

  const supabase = await createBookmarksClient()
  const { data, error } = await supabase
    .from('bookmarks')
    .select('post_id')
    .eq('user_id', user.id)
    .in('post_id', postIds)

  if (error) {
    console.error('[guardados] no se pudieron leer los marcadores', error)
    return new Set()
  }

  return new Set((data ?? []).map((row) => row.post_id))
}
