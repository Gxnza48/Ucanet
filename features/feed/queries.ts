import 'server-only'

/**
 * features/feed/queries.ts — las cuatro pestañas del feed (PART 12).
 *
 *   "Para vos"     `/`               `feed_para_vos`     — rankeada en Postgres, con motivo
 *   "Mis materias" `/mis-materias`   `posts_public`      — la regla exacta de §12.2, en memoria
 *   "Reciente"     `/reciente`       `posts_public`      — cronológico duro
 *   "Tendencias"   `/tendencias`     `feed_tendencias`   — velocidad, sin paginar
 *
 * CAMBIO RESPECTO DEL PLAN, anotado acá para que no se lea como un descuido: D2 cortaba el
 * MVP en dos pestañas y mandaba "Para vos" y "Tendencias" a fase 3. El fundador las adelantó
 * porque la home tiene que ser una superficie de uso diario. Lo que NO cambia es el carácter:
 * el orden se sigue pudiendo explicar en una línea (§12.3), y "Para vos" viaja con el `motivo`
 * por el que cada fila está donde está — ver `MOTIVO_LABEL`, que es esa promesa hecha copy.
 *
 * DÓNDE SE PUNTÚA CADA UNA. "Mis materias" se rankea en memoria sobre una ventana acotada
 * (`FEED_WINDOW`), porque su alcance es chico y la fórmula queda auditable en `ranking.ts`.
 * "Para vos" y "Tendencias" NO: su alcance es el sitio entero, así que el orden lo calcula
 * Postgres adentro de la RPC y este archivo solo lo transporta. La consecuencia práctica es
 * que la RPC devuelve las filas YA ordenadas y este archivo nunca las reordena.
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
 * Todo sale de `posts_public` o de una RPC `security definer` que lee esa misma vista
 * (D14.2). Esa vista ya filtra `status = 'activo'` y ya anula
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

import type { PostgrestError } from '@supabase/supabase-js'
import { z } from 'zod'

import { PAGE_SIZE } from '@/lib/config'
import { createClient, getProfile } from '@/lib/supabase/server'
import type { PostPublic } from '@/lib/types.gen'

import { toMotivo, type FeedMotivo } from './motivos'
import { compareRanked, rankPost } from './ranking'

export { compareRanked, effectiveAgeHours, engagement, rankPost } from './ranking'
export type { RankablePost } from './ranking'

// El motivo de cada fila de "Para vos" vive en `./motivos`, no acá, por la misma razón que
// la fórmula vive en `./ranking`: este archivo es `server-only` y el rótulo lo necesita
// también el navegador (el scroll infinito renderiza filas nuevas del lado del cliente).
// Se reexporta para que el resto de la aplicación lo consuma desde un solo lugar.
export { MOTIVO_LABEL, isMotivo, toMotivo } from './motivos'
export type { FeedMotivo } from './motivos'

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
  /**
   * Solo lo trae "Para vos". Es OPCIONAL y no `| null` a propósito: `features/posts` y
   * `features/materias` producen esta misma forma sin el campo (y no pueden importarlo, ver
   * el encabezado), así que el campo tiene que poder faltar para que las tres formas sigan
   * siendo estructuralmente intercambiables.
   */
  motivo?: FeedMotivo
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

function toListItem(post: NarrowedPost, scopes: ScopeMaps, motivo?: FeedMotivo): PostListItem {
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
    motivo,
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

// ---------------------------------------------------------------------------------------
// Las dos pestañas que calcula Postgres
// ---------------------------------------------------------------------------------------
//
// `feed_para_vos` y `feed_tendencias` son funciones `security definer` (BUILD-CONTRACT §5):
// leen `posts_public` y las tablas de señales del lector adentro de la base, y devuelven las
// filas YA ordenadas. Este archivo no reordena nada — si lo hiciera, el keyset dejaría de
// coincidir con el orden real y aparecerían huecos.
//
// TIPADO: `lib/types.gen.ts` se escribe a mano contra las migraciones y todavía no conoce
// estas dos funciones (las está escribiendo la migración en paralelo). El cliente tipado
// rechaza un nombre de RPC que no está en `Database['public']['Functions']`, así que el
// puente de abajo declara la firma acordada y castea el cliente UNA sola vez, en un lugar.
// Cuando `types.gen.ts` incorpore las funciones, borrar `callFeedRpc` y llamar
// `supabase.rpc('feed_para_vos', …)` directo: el resto del archivo no cambia.

/** Las columnas comunes a las dos RPC. Todo nullable, igual que `posts_public`. */
type FeedRpcRow = {
  id: number | null
  public_id: string | null
  materia_id: number | null
  carrera_id: number | null
  kind: string | null
  title: string | null
  body: string | null
  is_anonymous: boolean | null
  author_handle: string | null
  score: number | null
  comments_count: number | null
  locked_at: string | null
  created_at: string | null
  edited_at: string | null
  last_activity_at: string | null
}

/** `feed_para_vos`: agrega el rank con el que se pagina y el motivo que se muestra. */
type ParaVosRow = FeedRpcRow & { rank: number | null; motivo: string | null }

/**
 * `feed_tendencias`: agrega `velocidad`. No se lee acá — la RPC ya ordenó por ella y una fila
 * de feed no muestra métricas de ranking (§12.5) — pero queda declarada para que el contrato
 * esté escrito donde se consume.
 */
type TendenciasRow = FeedRpcRow & { velocidad: number | null }

/** Fila de "Para vos" ya estrechada: la que se pagina y la que se rotula. */
type ParaVosEntry = { post: NarrowedPost; rank: number | null; motivo?: FeedMotivo }

/** Solo estos tres tipos viajan como argumento de las RPC de feed. */
type FeedRpcArgs = Record<string, string | number | null>

type FeedRpcResult<Row> = { data: Row[] | null; error: PostgrestError | null }

function callFeedRpc<Row>(
  supabase: Awaited<ReturnType<typeof createClient>>,
  fn: 'feed_para_vos' | 'feed_tendencias',
  args: FeedRpcArgs,
): PromiseLike<FeedRpcResult<Row>> {
  const client = supabase as unknown as {
    rpc: (name: string, params: FeedRpcArgs) => PromiseLike<FeedRpcResult<Row>>
  }
  return client.rpc(fn, args)
}

/**
 * Convierte una tanda de filas de RPC en filas de feed, resolviendo el catálogo una sola vez.
 *
 * `narrowPost` acepta estas filas sin ceremonia: tienen los mismos nombres de columna y la
 * misma nulabilidad que `posts_public`, que es de donde salen. Las columnas de más
 * (`locked_at`, `edited_at`, `rank`, `velocidad`) se ignoran acá: la fila del feed no las usa.
 */
async function toFeedItems(
  supabase: Awaited<ReturnType<typeof createClient>>,
  entries: Array<{ post: NarrowedPost; motivo?: FeedMotivo }>,
): Promise<PostListItem[]> {
  const scopes = await loadScopes(
    supabase,
    entries.map((entry) => entry.post),
  )
  return entries.map((entry) => toListItem(entry.post, scopes, entry.motivo))
}

/**
 * "Para vos" — la home de uso diario (PART 12 §12.3, adelantada de fase 3).
 *
 * Mezcla lo que seguís, lo que se parece a lo que leés, lo de tu carrera y un resto para
 * descubrir; el peso de cada canal lo decide `feed_para_vos`. Cada fila vuelve con su
 * `motivo`, y ese motivo se muestra: es la diferencia entre un feed que se puede auditar y
 * una caja negra.
 *
 * EL CURSOR LLEVA EL RELOJ ADENTRO. `t` es el `p_now` que se fijó al pedir la primera página
 * y se arrastra sin tocar en todas las siguientes, de modo que las cinco páginas de una misma
 * sesión de scroll se puntúan contra el MISMO instante. Sin eso, cada página recalcularía el
 * decaimiento con una hora distinta, las filas se cruzarían entre páginas y el lector vería
 * duplicados y huecos — el bug clásico del scroll infinito rankeado. Con `(t, rank, id)` el
 * orden es total y determinista, y `(rank, id)` corta exactamente donde terminó la anterior.
 *
 * Es el mismo sobre que ya usa "Mis materias" (`rankedCursorSchema`): tres campos, base64url,
 * opaco y sin firmar (§12.4). Por eso `lib/cursor.ts` se queda como está — su `Cursor` de dos
 * campos no alcanza para esto, y el codificador de tres campos ya vive en este archivo.
 *
 * Sin sesión no hay nada que personalizar: devuelve página vacía y la ruta muestra Reciente.
 */
export async function getParaVosFeed(opts: FeedOptions = {}): Promise<FeedPage> {
  const limit = clampLimit(opts.limit)
  const profile = await getProfile()
  if (!profile) return EMPTY_PAGE

  const supabase = await createClient()
  const cursor = decodeCursor(opts.cursor, rankedCursorSchema)
  // `t0` de la primera página, o el que ya venía arrastrando el cursor.
  const now = cursor?.t ?? new Date().toISOString()

  const { data, error } = await callFeedRpc<ParaVosRow>(supabase, 'feed_para_vos', {
    p_now: now,
    // Una fila de más: es cómo se sabe que hay página siguiente sin contar el total.
    p_limit: limit + 1,
    p_after_rank: cursor?.r ?? null,
    p_after_id: cursor?.i ?? null,
  })

  if (error) {
    console.error('[feed] falló la lectura de Para vos', error)
    return EMPTY_PAGE
  }

  const rows = (data ?? [])
    .map((row): ParaVosEntry | null => {
      const post = narrowPost(row)
      return post === null ? null : { post, rank: row.rank, motivo: toMotivo(row.motivo) }
    })
    .filter((entry): entry is ParaVosEntry => entry !== null)

  const hasMore = rows.length > limit
  const page = hasMore ? rows.slice(0, limit) : rows
  const items = await toFeedItems(supabase, page)

  const last = page[page.length - 1]
  // Sin rank no se puede armar el keyset: se corta la paginación en vez de arriesgar un
  // cursor que repita filas. En la práctica la RPC siempre lo manda.
  const nextCursor =
    hasMore && last !== undefined && last.rank !== null
      ? encodeCursor({ t: now, r: last.rank, i: last.post.id })
      : null

  return { items, nextCursor }
}

/**
 * "Tendencias" — lo que se está moviendo AHORA (`/tendencias`).
 *
 * Ordena por velocidad (actividad por unidad de tiempo), no por acumulado: por eso es una
 * lista corta y no una tabla de líderes. NO PAGINA, y es deliberado — `feed_tendencias` no
 * toma cursor. Una tendencia con scroll infinito deja de ser una tendencia y se vuelve un
 * ranking histórico, que es justo la mecánica de vitrina que el producto no quiere (D2, D8).
 * Se lee entera de un vistazo y se vuelve al feed.
 *
 * `nextCursor` siempre es null: la firma sigue siendo `FeedPage` para que la lista y la
 * página se rendericen con los mismos componentes que el resto de las pestañas.
 */
export async function getTendenciasFeed(limit?: number): Promise<FeedPage> {
  const supabase = await createClient()

  const { data, error } = await callFeedRpc<TendenciasRow>(supabase, 'feed_tendencias', {
    p_now: new Date().toISOString(),
    p_limit: clampLimit(limit),
  })

  if (error) {
    console.error('[feed] falló la lectura de Tendencias', error)
    return EMPTY_PAGE
  }

  const rows = (data ?? [])
    .map(narrowPost)
    .filter((post): post is NarrowedPost => post !== null)
    .map((post) => ({ post }))

  return { items: await toFeedItems(supabase, rows), nextCursor: null }
}
