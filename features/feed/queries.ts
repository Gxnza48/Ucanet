import 'server-only'

/**
 * features/feed/queries.ts — las dos pestañas del feed (PART 12).
 *
 * "Mis materias" (`/`) y "Reciente" (`/reciente`) son TODO el feed del MVP (D2). No hay
 * "Para vos", no hay "Tendencias", no hay home algorítmico.
 *
 * ---------------------------------------------------------------------------------------
 * SOBRE `PostListItem` — la duplicación es deliberada y está mandada por el contrato
 * ---------------------------------------------------------------------------------------
 * `features/posts` exporta su propio `PostListItem`, y una feature NUNCA importa otra
 * (BUILD-CONTRACT §2, y `eslint-plugin-boundaries` lo hace fallar en CI). Tampoco existe
 * `features/shared/`, jamás. Así que este archivo declara su gemelo ESTRUCTURAL: mismos
 * campos, mismos tipos, mismo significado. TypeScript es estructural, de modo que un
 * `PostListItem` de posts entra donde se espera este y viceversa mientras las formas no
 * se separen. La regla operativa si alguna vez hay que cambiar la forma: se cambia en las
 * dos features en el mismo commit, o `<FeedList>` deja de aceptar las listas de la página
 * de materia (que también entrega esta forma, ver `features/materias/queries.ts`).
 *
 * ---------------------------------------------------------------------------------------
 * LECTURAS PÚBLICAS
 * ---------------------------------------------------------------------------------------
 * Todo sale de `posts_public` (D14.2). Esa vista ya filtra `status = 'activo'` y ya anula
 * `author_handle` en el contenido anónimo; `author_id` directamente no existe en ella, así
 * que no hay forma de seleccionarlo por accidente. Los nombres de materia y carrera se
 * resuelven contra el catálogo (`materias`, `carreras`), que sí tiene `grant select` a
 * `anon` y `authenticated`.
 *
 * Todas las columnas de la vista llegan tipadas como nullable (ver el encabezado de
 * `lib/types.gen.ts`: Postgres no propaga NOT NULL a las vistas). Estrechar es trabajo de
 * este archivo — es el lugar correcto, porque acá se conoce el invariante.
 *
 * ---------------------------------------------------------------------------------------
 * ERRORES
 * ---------------------------------------------------------------------------------------
 * Una lectura de lista que falla devuelve página vacía y deja el error en el log: el feed
 * es la superficie de más tráfico del sitio y un error transitorio de red no debería
 * tumbar la home entera. Las lecturas de detalle (en otras features) sí distinguen "no
 * existe" de "falló".
 */

import { z } from 'zod'

import { PAGE_SIZE } from '@/lib/config'
import { createClient, getProfile } from '@/lib/supabase/server'
import type { PostPublic } from '@/lib/types.gen'

import { compareRanked, rankPost } from './ranking'

export { compareRanked, effectiveAgeHours, engagement, rankPost } from './ranking'
export type { RankablePost } from './ranking'

// ---------------------------------------------------------------------------------------
// Tipos públicos de la feature
// ---------------------------------------------------------------------------------------

/** Materia o carrera de una fila, ya resuelta a algo linkeable. */
export type PostListScope = {
  slug: string
  nombre: string
}

/**
 * Una fila del feed (PART 12 §12.5, "Feed item anatomy").
 *
 * Sin `id` interno: el bigint no cruza al navegador (D14.7). La fila viaja con `publicId`
 * y con slugs, que es exactamente lo que necesita para linkear a `/p/[publicId]` y a
 * `/materias/[slug]`.
 */
export type PostListItem = {
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
  materia: PostListScope | null
  /** Carrera del snapshot; solo se muestra en posts SIN materia (§12.5, §12.7). */
  carrera: PostListScope | null
  score: number
  commentsCount: number
  createdAt: string
  lastActivityAt: string
}

/** Opciones de toda lectura de lista (BUILD-CONTRACT §4.5). */
export type FeedOptions = {
  /** Cursor keyset opaco devuelto por la página anterior. */
  cursor?: string
  /** Tamaño de página; por defecto `PAGE_SIZE` (25). */
  limit?: number
}

export type FeedPage = {
  items: PostListItem[]
  nextCursor: string | null
}

// ---------------------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------------------

/**
 * Ventana acotada de "Mis materias" (§0.5-R2 y §12.4).
 *
 * Una sola lectura keyset por `(last_activity_at, id)` descendente, cortada en las 400
 * filas más nuevas del alcance del lector; esas 400 se puntúan en memoria con §12.3 y se
 * paginan desde ahí. A escala MVP (~30 posts por semana por cohorte) la ventana real son
 * decenas de filas. Es el límite que impide que el feed rankeado se vuelva un scan sin
 * techo a medida que se acumulan años de contenido: constante dura, se revisa con datos.
 */
export const FEED_WINDOW = 400

/** Tope defensivo del tamaño de página pedido por quien llama. */
const MAX_LIMIT = 100

/**
 * Columnas de `posts_public` que consume el feed. Explícitas y no `*`: la vista podría
 * crecer y una fila de feed no debería empezar a arrastrar el `search` tsvector completo.
 */
const POST_COLUMNS =
  'id, public_id, materia_id, carrera_id, kind, title, body, is_anonymous, author_handle, score, comments_count, created_at, last_activity_at'

type PostRow = Pick<
  PostPublic,
  | 'id'
  | 'public_id'
  | 'materia_id'
  | 'carrera_id'
  | 'kind'
  | 'title'
  | 'body'
  | 'is_anonymous'
  | 'author_handle'
  | 'score'
  | 'comments_count'
  | 'created_at'
  | 'last_activity_at'
>

/** Fila ya estrechada, todavía con el id interno: solo circula del lado del servidor. */
type NarrowedPost = {
  id: number
  publicId: string
  materiaId: number | null
  carreraId: number | null
  kind: string
  title: string | null
  body: string
  isAnonymous: boolean
  authorHandle: string | null
  score: number
  commentsCount: number
  createdAt: string
  lastActivityAt: string
}

const EMPTY_PAGE: FeedPage = { items: [], nextCursor: null }

// ---------------------------------------------------------------------------------------
// Cursores keyset (§12.4)
// ---------------------------------------------------------------------------------------
//
// Nunca OFFSET: `OFFSET n` escanea y descarta n filas (el costo crece con la profundidad)
// y las filas que se mueven entre pedidos producen duplicados y agujeros. Keyset es
// O(página) para siempre.
//
// El cursor es un JSON chico en base64url, validado con Zod del lado del servidor. No va
// firmado a propósito: el peor caso de que alguien lo manipule es una página rara, no una
// fuga — la consulta sigue corriendo bajo RLS como el lector. base64url y no base64 porque
// el cursor viaja en el query string y ahí un `+` de base64 clásico se decodifica como
// espacio.

const recentCursorSchema = z.object({
  /** `created_at` de la última fila entregada. */
  c: z.string().min(1),
  /** Id interno de esa fila; desempata timestamps idénticos. */
  i: z.number().int().positive(),
})

const rankedCursorSchema = z.object({
  /** `t0` fijado en la primera página: sin esto, cada página re-rankearía con otra hora. */
  t: z.string().min(1),
  /** Rank de la última fila entregada. */
  r: z.number().finite(),
  /** Id interno de esa fila. */
  i: z.number().int().positive(),
})

function encodeCursor(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url')
}

function decodeCursor<T>(raw: string | undefined, schema: z.ZodType<T>): T | null {
  if (!raw) return null
  try {
    const parsed = schema.safeParse(JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')))
    return parsed.success ? parsed.data : null
  } catch {
    // JSON roto o base64 inválido: se ignora y se sirve la primera página.
    return null
  }
}

// ---------------------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------------------

function clampLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return PAGE_SIZE
  return Math.min(Math.max(1, Math.trunc(limit)), MAX_LIMIT)
}

/**
 * Estrecha una fila de la vista. Devuelve null si le falta algún invariante: en la práctica
 * no pasa nunca (la vista solo emite posts activos, y un post activo tiene cuerpo por
 * CHECK), pero el tipo generado dice `| null` en todo y descartar la fila es preferible a
 * renderizar un `undefined` en una página pública.
 */
function narrowPost(row: PostRow): NarrowedPost | null {
  const { id, public_id: publicId, created_at: createdAt, body } = row
  if (id === null || publicId === null || createdAt === null || body === null) return null

  return {
    id,
    publicId,
    materiaId: row.materia_id,
    carreraId: row.carrera_id,
    kind: row.kind ?? 'texto',
    title: row.title,
    body,
    isAnonymous: row.is_anonymous ?? false,
    authorHandle: row.author_handle,
    score: row.score ?? 0,
    commentsCount: row.comments_count ?? 0,
    createdAt,
    lastActivityAt: row.last_activity_at ?? createdAt,
  }
}

type ScopeMaps = {
  materias: Map<number, PostListScope>
  carreras: Map<number, PostListScope>
}

/**
 * Resuelve nombres y slugs del catálogo para las filas que ya se van a devolver.
 *
 * Se hace DESPUÉS de recortar la página, no sobre la ventana entera de 400: son como mucho
 * 25 ids distintos por lado, contra dos tablas diminutas y por PK. Y se hace con dos
 * consultas planas en vez de un embed de PostgREST sobre la vista a propósito — la relación
 * existe (la declara `lib/types.gen.ts`), pero un embed sobre una vista `security definer`
 * es exactamente el tipo de detalle que no se puede verificar sin una base local, y acá el
 * costo de evitarlo es de dos lecturas por PK.
 *
 * Solo se piden carreras de los posts SIN materia: el chip de carrera existe únicamente
 * para los posts sin etiquetar (§12.5).
 */
async function loadScopes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  posts: NarrowedPost[],
): Promise<ScopeMaps> {
  const materiaIds = [
    ...new Set(posts.map((post) => post.materiaId).filter((id): id is number => id !== null)),
  ]
  const carreraIds = [
    ...new Set(
      posts
        .filter((post) => post.materiaId === null)
        .map((post) => post.carreraId)
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

  const materias = new Map<number, PostListScope>()
  for (const row of materiasResult.data ?? []) {
    materias.set(row.id, { slug: row.slug, nombre: row.nombre })
  }

  const carreras = new Map<number, PostListScope>()
  for (const row of carrerasResult.data ?? []) {
    carreras.set(row.id, { slug: row.slug, nombre: row.nombre })
  }

  return { materias, carreras }
}

function toListItem(post: NarrowedPost, scopes: ScopeMaps): PostListItem {
  const materia = post.materiaId === null ? null : (scopes.materias.get(post.materiaId) ?? null)
  // El chip de carrera es el fallback de los posts sin materia, nunca un segundo chip.
  const carrera =
    materia === null && post.carreraId !== null
      ? (scopes.carreras.get(post.carreraId) ?? null)
      : null

  return {
    publicId: post.publicId,
    kind: post.kind,
    title: post.title,
    body: post.body,
    isAnonymous: post.isAnonymous,
    authorHandle: post.authorHandle,
    materia,
    carrera,
    score: post.score,
    commentsCount: post.commentsCount,
    createdAt: post.createdAt,
    lastActivityAt: post.lastActivityAt,
  }
}

/**
 * Ids de las materias que sigue el lector.
 *
 * `materia_follows` tiene política de select sobre las filas propias, así que esto ya está
 * acotado al usuario por la base: no hace falta (ni serviría) filtrar por `user_id` acá.
 * La consulta está duplicada respecto de `features/materias/queries.ts` por el límite de
 * imports entre features; son cuatro líneas y la alternativa sería una capa compartida en
 * `lib/` que solo tendría este inquilino.
 */
async function readFollowedMateriaIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<number[]> {
  const { data, error } = await supabase.from('materia_follows').select('materia_id')
  if (error) {
    console.error('[feed] no se pudieron leer las materias seguidas', error)
    return []
  }
  return (data ?? []).map((row) => row.materia_id)
}

// ---------------------------------------------------------------------------------------
// Las dos pestañas
// ---------------------------------------------------------------------------------------

/**
 * "Mis materias" — la pestaña personalizada (PART 12 §12.2 y §12.3).
 *
 * REGLA DE INCLUSIÓN, exacta (§12.2). Un post aparece si y solo si:
 *   1. `post.materia_id` está entre las materias que sigue el lector, **O BIEN**
 *   2. `post.materia_id IS NULL` **Y** `post.carrera_id = viewer.carrera_id` (ambos no nulos).
 * Es una UNIÓN de conjuntos, no una mezcla de dos streams: un post que cumple las dos
 * cláusulas es una sola fila. Quien no tiene carrera obtiene solo la cláusula 1; quien no
 * sigue nada y no tiene carrera obtiene la pestaña vacía (el estado vacío lo pone la
 * página, §12.6). `status = 'activo'` ya viene impuesto por la vista.
 *
 * RANKING (§12.3) — se calcula en memoria, no en SQL: la ventana está acotada a 400 filas
 * y la fórmula queda así en TypeScript, testeada (`ranking.ts`) y auditable, en vez de
 * enterrada en un `order by` que nadie puede probar sin una base.
 *
 * NUNCA se cachea de forma compartida: es por usuario y se renderiza bajo su sesión
 * (§12.8). Su baratura viene del alcance (dos scans de índice, ≤ 400 filas), no del caché.
 */
export async function getMisMateriasFeed(opts: FeedOptions = {}): Promise<FeedPage> {
  const limit = clampLimit(opts.limit)
  const profile = await getProfile()
  if (!profile) return EMPTY_PAGE

  const supabase = await createClient()
  const followed = await readFollowedMateriaIds(supabase)
  const carreraId = profile.carrera_id

  let query = supabase
    .from('posts_public')
    .select(POST_COLUMNS)
    .order('last_activity_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(FEED_WINDOW)

  if (followed.length > 0 && carreraId !== null) {
    // Las dos cláusulas de §12.2 en un solo OR: una fila que cumple ambas sigue siendo una.
    query = query.or(
      `materia_id.in.(${followed.join(',')}),and(materia_id.is.null,carrera_id.eq.${carreraId})`,
    )
  } else if (followed.length > 0) {
    query = query.in('materia_id', followed)
  } else if (carreraId !== null) {
    query = query.is('materia_id', null).eq('carrera_id', carreraId)
  } else {
    // Sin follows y sin carrera no hay alcance: ni vale la pena ir a la base.
    return EMPTY_PAGE
  }

  const { data, error } = await query
  if (error) {
    console.error('[feed] falló la ventana de Mis materias', error)
    return EMPTY_PAGE
  }

  const cursor = decodeCursor(opts.cursor, rankedCursorSchema)
  // `t0` fijo para toda la sesión de paginación: garantiza ranks idénticos página a
  // página, y por lo tanto ni duplicados ni agujeros (§12.4).
  const t0 = cursor?.t ?? new Date().toISOString()
  const t0Millis = Date.parse(t0)
  const now = Number.isNaN(t0Millis) ? Date.now() : t0Millis

  const scored = (data ?? [])
    .map(narrowPost)
    .filter((post): post is NarrowedPost => post !== null)
    .map((post) => ({ post, id: post.id, rank: rankPost(post, now) }))
    .sort(compareRanked)

  // Keyset sobre el resultado ya puntuado: la primera fila estrictamente por debajo de
  // `(rank, id)` del cursor. El orden es total, así que el corte es exacto.
  let start = 0
  if (cursor) {
    const index = scored.findIndex(
      (entry) => entry.rank < cursor.r || (entry.rank === cursor.r && entry.id < cursor.i),
    )
    start = index === -1 ? scored.length : index
  }

  const window = scored.slice(start, start + limit)
  const scopes = await loadScopes(
    supabase,
    window.map((entry) => entry.post),
  )
  const items = window.map((entry) => toListItem(entry.post, scopes))

  const last = window[window.length - 1]
  const hasMore = last !== undefined && scored.length > start + window.length
  const nextCursor = hasMore ? encodeCursor({ t: t0, r: last.rank, i: last.id }) : null

  return { items, nextCursor }
}

/**
 * "Reciente" — todo el sitio, estrictamente cronológico (PART 12 §12.4).
 *
 * `ORDER BY created_at DESC, id DESC` sobre `created_at`, NO sobre `last_activity_at`: los
 * bumps no reordenan Reciente, porque si lo hicieran "cronológico" (D2) sería mentira.
 *
 * Es la misma consulta para todo el mundo, así que es cacheable a nivel de ruta (§12.8);
 * el TTL lo fija la página, no esta función.
 */
export async function getRecentFeed(opts: FeedOptions = {}): Promise<FeedPage> {
  const limit = clampLimit(opts.limit)
  const supabase = await createClient()

  let query = supabase
    .from('posts_public')
    .select(POST_COLUMNS)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    // Una fila de más: es cómo se sabe que hay página siguiente sin contar el total.
    .limit(limit + 1)

  const cursor = decodeCursor(opts.cursor, recentCursorSchema)
  if (cursor) {
    // `(created_at, id) < (c, i)` escrito como lo entiende PostgREST. El timestamp va
    // entre comillas porque lleva `+`, `:` y `.`.
    query = query.or(
      `created_at.lt."${cursor.c}",and(created_at.eq."${cursor.c}",id.lt.${cursor.i})`,
    )
  }

  const { data, error } = await query
  if (error) {
    console.error('[feed] falló la lectura de Reciente', error)
    return EMPTY_PAGE
  }

  const rows = (data ?? []).map(narrowPost).filter((post): post is NarrowedPost => post !== null)
  const hasMore = rows.length > limit
  const page = hasMore ? rows.slice(0, limit) : rows

  const scopes = await loadScopes(supabase, page)
  const items = page.map((post) => toListItem(post, scopes))

  const last = page[page.length - 1]
  const nextCursor =
    hasMore && last !== undefined ? encodeCursor({ c: last.createdAt, i: last.id }) : null

  return { items, nextCursor }
}
