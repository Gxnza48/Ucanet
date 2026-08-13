import 'server-only'

/**
 * features/materias/queries.ts — el catálogo académico y la página de materia (PART 17
 * §17.4.1, PART 23 §23.7).
 *
 * Este módulo sirve a las siete rutas del "crawl mesh": `/materias`, `/materias/[slug]`,
 * `/materias/[slug]/recursos`, `/carreras/[slug]`, `/facultades/[slug]`, `/recursos` y `/`.
 * Es el activo permanente del producto (D1): una materia no se borra nunca, su slug es una
 * promesa de diez años (D7) y su página es la que rankea.
 *
 * ---------------------------------------------------------------------------------------
 * DE DÓNDE SALE CADA COSA
 * ---------------------------------------------------------------------------------------
 * El catálogo (`universidades` › `sedes` › `facultades` › `carreras` › `materias` +
 * `plan_materias`) es público: la migración 0002 le da `read_all` y `grant select` a `anon`
 * y `authenticated`, y sus columnas son NOT NULL, así que se lee derecho y llega tipado sin
 * nulls que estrechar. El CONTENIDO (publicaciones, recursos) sale siempre de las vistas
 * `_public` (D14.2), donde todas las columnas vienen `| null` porque Postgres no propaga
 * NOT NULL a las vistas: estrechar eso es trabajo de este archivo.
 *
 * Los joins del catálogo se hacen con consultas planas y mapas en memoria, no con embeds de
 * PostgREST — mismo criterio que `features/feed/queries.ts`: son tres tablas diminutas (3
 * facultades, ~14 carreras, ~110 materias) leídas por PK, y el costo de evitar un embed que
 * no se puede verificar sin una base local es de una lectura más.
 *
 * ---------------------------------------------------------------------------------------
 * EL CONTEO DE SEGUIDORES VA POR RPC, A PROPÓSITO
 * ---------------------------------------------------------------------------------------
 * `materia_follows` solo deja ver las filas propias (§8.3.4), así que un `count(*)` desde la
 * aplicación devolvería 0 o 1. El agregado lo da `materia_follower_count(p_materia_id)`, una
 * función `security definer` de la migración 0011 que devuelve un número y nada más: no hay
 * forma de saber QUIÉN sigue una materia.
 *
 * ---------------------------------------------------------------------------------------
 * SOBRE `PostListItem` — la duplicación es deliberada y está mandada por el contrato
 * ---------------------------------------------------------------------------------------
 * `features/feed` exporta su propio `PostListItem` y una feature NUNCA importa otra
 * (BUILD-CONTRACT §2, con `eslint-plugin-boundaries` haciéndolo fallar en CI). Tampoco existe
 * `features/shared/`. Este archivo declara el gemelo ESTRUCTURAL de esa forma: mismos campos,
 * mismos tipos, mismo significado. TypeScript es estructural, así que las listas de acá entran
 * en `<FeedList>` — que es exactamente lo que hace `/carreras/[slug]` con `carrera.actividad`.
 * Regla operativa: si la forma cambia, cambia en las dos features en el mismo commit.
 *
 * ---------------------------------------------------------------------------------------
 * IDS INTERNOS
 * ---------------------------------------------------------------------------------------
 * `MateriaListItem.id` y `MateriaDetail.id` llevan el bigint interno porque las rutas lo
 * necesitan del lado del servidor: `/` cruza el catálogo contra `getFollowedMateriaIds()` y
 * `/materias/[slug]` se lo pasa a `listResources({ materiaId })` y a `getMateriaPosts()`. Nunca
 * se serializa al navegador — `FollowButton` recibe el id porque la Server Action escribe por
 * id, y ese es el único cruce, explícito y acotado (D14.7).
 *
 * ---------------------------------------------------------------------------------------
 * ERRORES
 * ---------------------------------------------------------------------------------------
 * Las lecturas de lista degradan a vacío y dejan el error en el log: el catálogo aparece en
 * casi todas las páginas y un error transitorio no debería tumbar la home. Las lecturas de
 * detalle devuelven `null`, que las rutas convierten en `notFound()`.
 */

import { cache } from 'react'
import { z } from 'zod'

import { PAGE_SIZE } from '@/lib/config'
import { createClient, getUser } from '@/lib/supabase/server'
import type { PostPublic, ResourcePublic } from '@/lib/types.gen'

// ---------------------------------------------------------------------------------------
// Tipos públicos de la feature
// ---------------------------------------------------------------------------------------

/** Facultad reducida a lo linkeable: `/facultades/[slug]`. */
export type FacultadRef = {
  slug: string
  nombre: string
}

/**
 * Una carrera que incluye a la materia, con su ubicación en el plan.
 *
 * `cuatrimestre` es 0 para las materias anuales (CHECK `cuatrimestre in (0,1,2)`, migración
 * 0002). El rótulo visible ("2° año, 1er cuatrimestre") lo arma la ruta: es presentación.
 */
export type MateriaCarrera = {
  slug: string
  nombre: string
  /** Año de la carrera en el que se cursa, 1 a 8. */
  anio: number
  /** 0 = anual, 1 = primer cuatrimestre, 2 = segundo. */
  cuatrimestre: number
  facultad: FacultadRef
}

/** La materia como fila de catálogo (`/materias`, selectores de materia, riel de la home). */
export type MateriaListItem = {
  /** Id interno (bigint). Solo servidor. */
  id: number
  slug: string
  nombre: string
  /** Una entrada por carrera que la incluye; vacío si ningún plan la referencia. */
  carreras: MateriaCarrera[]
}

/** La materia en su página (§17.4.1), con los contadores que se muestran y se indexan. */
export type MateriaDetail = MateriaListItem & {
  descripcion: string | null
  followersCount: number
  postsCount: number
  resourcesCount: number
}

/** Materia o carrera de una fila de feed, ya resuelta a algo linkeable. */
export type PostListScope = {
  slug: string
  nombre: string
}

/** Gemelo estructural de `features/feed`.`PostListItem` — ver el encabezado. */
export type PostListItem = {
  /** nanoid de 10 caracteres. Es la URL: `/p/[publicId]`. */
  publicId: string
  /** `texto` | `pregunta`. Solo `pregunta` lleva rótulo visible. */
  kind: string
  /** Puede faltar: los micro-posts no llevan título y la fila usa el cuerpo. */
  title: string | null
  body: string
  isAnonymous: boolean
  /** Seudónimo del autor, o null si publicó como anónimo. Nunca hay otro dato de autor (D3). */
  authorHandle: string | null
  materia: PostListScope | null
  /** Carrera del snapshot; solo se muestra en posts SIN materia (§12.5). */
  carrera: PostListScope | null
  score: number
  commentsCount: number
  createdAt: string
  lastActivityAt: string
}

/** Un recurso de la materia (metadatos públicos; los bytes van por §14.5). */
export type MateriaResourceItem = {
  publicId: string
  /** `resumen` | `apunte` | `parcial` | `final` | `guia` | `otro`. */
  tipo: string
  /** Año del parcial/final, si quien lo subió lo declaró. */
  anio: number | null
  title: string
  description: string | null
  isAnonymous: boolean
  authorHandle: string | null
  score: number
  downloadsCount: number
  createdAt: string
}

/** Una fila de la grilla del plan de estudios (`plan_materias` + el nombre de la materia). */
export type PlanEntry = {
  slug: string
  nombre: string
  /** Código oficial dentro de ESTE plan; depende del plan, por eso no vive en `materias`. */
  codigo: string | null
  anio: number
  cuatrimestre: number
  optativa: boolean
  /** Versión del plan: '2013', '2020'. */
  plan: string
}

/** La carrera en su página: el plan completo más la actividad reciente de su gente. */
export type CarreraDetail = {
  /** Id interno (bigint). Solo servidor. */
  id: number
  slug: string
  nombre: string
  /** `pregrado` | `grado` | `posgrado` (CHECK cerrado, §8.2.2). */
  nivel: string
  duracionAnios: number | null
  facultad: FacultadRef
  /** La grilla del plan, sin ordenar por año: agrupar es decisión de presentación. */
  materias: PlanEntry[]
  actividad: PostListItem[]
}

/** Una carrera en la lista de su facultad. */
export type FacultadCarrera = {
  slug: string
  nombre: string
  nivel: string
  /** Materias distintas del plan (una materia en dos versiones de plan cuenta una vez). */
  materiasCount: number
}

/** La facultad en su página: el nodo más alto del mesh de enlaces (§23.7). */
export type FacultadDetail = {
  /** Id interno (bigint). Solo servidor. */
  id: number
  slug: string
  nombre: string
  sede: { slug: string; nombre: string; ciudad: string } | null
  carreras: FacultadCarrera[]
}

/** Opciones de toda lectura de lista (BUILD-CONTRACT §4.5). */
export type ListOptions = {
  /** Cursor keyset opaco devuelto por la página anterior. */
  cursor?: string
  /** Tamaño de página; por defecto `PAGE_SIZE` (25). */
  limit?: number
}

export type Page<T> = {
  items: T[]
  nextCursor: string | null
}

// ---------------------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------------------

/** Tope defensivo del tamaño de página pedido por quien llama. */
const MAX_LIMIT = 100

/**
 * Cuántas publicaciones muestra el bloque "Actividad reciente" de la carrera.
 *
 * Es una vitrina, no un feed: la página de carrera existe para el plan de estudios y este
 * bloque solo tiene que probar que atrás hay gente. Quien quiera más tiene el link a
 * `/reciente` justo abajo, así que no hay paginación que ofrecer.
 */
const CARRERA_ACTIVITY = 10

/**
 * Una sola cadena literal por lista, sin concatenar: supabase-js infiere el tipo de la fila
 * parseando ESTE literal en tiempo de compilación. Partida en dos trozos, el tipo degrada a
 * `GenericStringError` y se pierde el tipado entero.
 */
const POST_COLUMNS =
  'id, public_id, materia_id, carrera_id, kind, title, body, is_anonymous, author_handle, score, comments_count, created_at, last_activity_at'

const RESOURCE_COLUMNS =
  'id, public_id, tipo, anio, title, description, is_anonymous, author_handle, score, downloads_count, created_at'

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

type ResourceRow = Pick<
  ResourcePublic,
  | 'id'
  | 'public_id'
  | 'tipo'
  | 'anio'
  | 'title'
  | 'description'
  | 'is_anonymous'
  | 'author_handle'
  | 'score'
  | 'downloads_count'
  | 'created_at'
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

type NarrowedResource = MateriaResourceItem & { id: number }

// ---------------------------------------------------------------------------------------
// Cursores keyset (BUILD-CONTRACT §4.5)
// ---------------------------------------------------------------------------------------
//
// Nunca OFFSET: `OFFSET n` escanea y descarta n filas y las filas que se mueven entre pedidos
// producen duplicados y agujeros. Keyset es O(página) para siempre.
//
// El cursor es un JSON chico en base64url validado con Zod del lado del servidor. No va
// firmado a propósito: el peor caso de que alguien lo manipule es una página rara, no una
// fuga — la consulta sigue corriendo bajo RLS como el lector. base64url y no base64 porque el
// cursor viaja en el query string, donde un `+` se decodifica como espacio.

const keysetCursorSchema = z.object({
  /** `created_at` de la última fila entregada. */
  c: z.string().min(1),
  /** Id interno de esa fila; desempata timestamps idénticos. */
  i: z.number().int().positive(),
})

type Keyset = z.infer<typeof keysetCursorSchema>

function encodeCursor(keyset: Keyset): string {
  return Buffer.from(JSON.stringify(keyset), 'utf8').toString('base64url')
}

function decodeCursor(raw: string | undefined): Keyset | null {
  if (!raw) return null
  try {
    const parsed = keysetCursorSchema.safeParse(
      JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')),
    )
    return parsed.success ? parsed.data : null
  } catch {
    // JSON roto o base64 inválido: se ignora y se sirve la primera página.
    return null
  }
}

/** `(created_at, id) < (c, i)` escrito como lo entiende PostgREST. */
function keysetFilter(cursor: Keyset): string {
  // El timestamp va entre comillas porque lleva `+`, `:` y `.`.
  return `created_at.lt."${cursor.c}",and(created_at.eq."${cursor.c}",id.lt.${cursor.i})`
}

// ---------------------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------------------

function clampLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return PAGE_SIZE
  return Math.min(Math.max(1, Math.trunc(limit)), MAX_LIMIT)
}

function emptyPage<T>(): Page<T> {
  return { items: [], nextCursor: null }
}

/**
 * Se pide una fila de más para saber si hay página siguiente sin contar el total. La fila
 * extra se descarta y su predecesora define el cursor.
 */
function paginate<T extends { id: number; createdAt: string }, U>(
  rows: T[],
  limit: number,
  toItem: (row: T) => U,
): Page<U> {
  const hasMore = rows.length > limit
  const page = hasMore ? rows.slice(0, limit) : rows
  const last = page[page.length - 1]

  return {
    items: page.map(toItem),
    nextCursor:
      hasMore && last !== undefined ? encodeCursor({ c: last.createdAt, i: last.id }) : null,
  }
}

/**
 * Texto plegado para comparar: sin acentos y en minúsculas.
 *
 * El catálogo se busca acá y no en la base a propósito. La alternativa sería `search_catalog`,
 * pero esa RPC mezcla carreras y corta en 25 filas, y `/materias` necesita TODAS las materias
 * que coincidan. Sobre ~110 filas ya leídas, plegar y comparar es una decisión de microsegundos
 * que además hace que «algebra» encuentre «Álgebra» y que «consti» encuentre Derecho
 * Constitucional por su alias, sin depender de la configuración FTS.
 */
function fold(value: string): string {
  // NFD separa la letra de su tilde; `\p{M}` borra las marcas combinantes que quedaron.
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

/**
 * Estrecha una fila de `posts_public`. Devuelve null si falta un invariante: en la práctica no
 * pasa (la vista solo emite posts activos, y un post activo tiene cuerpo por CHECK), pero el
 * tipo generado dice `| null` en todo y descartar la fila es preferible a renderizar un
 * `undefined` en una página pública.
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

function narrowResource(row: ResourceRow): NarrowedResource | null {
  const { id, public_id: publicId, created_at: createdAt, title } = row
  if (id === null || publicId === null || createdAt === null || title === null) return null

  return {
    id,
    publicId,
    tipo: row.tipo ?? 'otro',
    anio: row.anio,
    title,
    description: row.description,
    isAnonymous: row.is_anonymous ?? false,
    authorHandle: row.author_handle,
    score: row.score ?? 0,
    downloadsCount: row.downloads_count ?? 0,
    createdAt,
  }
}

type ScopeMaps = {
  materias: Map<number, PostListScope>
  carreras: Map<number, PostListScope>
}

/**
 * Resuelve nombres y slugs del catálogo para las filas que ya se van a devolver: como mucho 25
 * ids distintos por lado, contra dos tablas diminutas y por PK.
 *
 * Solo se piden carreras de los posts SIN materia: el chip de carrera existe únicamente para
 * los posts sin etiquetar (§12.5).
 */
async function loadPostScopes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  posts: NarrowedPost[],
): Promise<ScopeMaps> {
  const materiaIds = unique(posts.map((post) => post.materiaId))
  const carreraIds = unique(
    posts.filter((post) => post.materiaId === null).map((post) => post.carreraId),
  )

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

function toPostListItem(post: NarrowedPost, scopes: ScopeMaps): PostListItem {
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

function unique(ids: Array<number | null>): number[] {
  return [...new Set(ids.filter((id): id is number => id !== null))]
}

function byNombre(a: { nombre: string }, b: { nombre: string }): number {
  return a.nombre.localeCompare(b.nombre, 'es-AR')
}

/**
 * Las carreras que incluyen a cada una de estas materias, con año y cuatrimestre.
 *
 * UNA ENTRADA POR CARRERA, no una por fila de `plan_materias`. La misma materia puede estar en
 * dos versiones de plan de la misma carrera (en Abogacía conviven 2013 y 2020, §8.3.1) y
 * `/materias` la listaría dos veces bajo el mismo encabezado. Se conserva la fila del plan más
 * nuevo —el que está cursando la gente hoy— comparando `plan` como texto, que para años en
 * cuatro dígitos ordena igual que numéricamente.
 */
async function loadCarrerasDeMaterias(
  supabase: Awaited<ReturnType<typeof createClient>>,
  materiaIds: number[],
): Promise<Map<number, MateriaCarrera[]>> {
  const porMateria = new Map<number, MateriaCarrera[]>()
  if (materiaIds.length === 0) return porMateria

  const { data: planRows, error } = await supabase
    .from('plan_materias')
    .select('materia_id, carrera_id, plan, anio, cuatrimestre')
    .in('materia_id', materiaIds)

  if (error || !planRows || planRows.length === 0) {
    if (error) console.error('[materias] no se pudo leer plan_materias', error)
    return porMateria
  }

  const { data: carreraRows } = await supabase
    .from('carreras')
    .select('id, slug, nombre, facultad_id')
    .in('id', unique(planRows.map((row) => row.carrera_id)))

  const carreras = carreraRows ?? []

  const { data: facultadRows } = await supabase
    .from('facultades')
    .select('id, slug, nombre')
    .in('id', unique(carreras.map((row) => row.facultad_id)))

  const facultades = new Map<number, FacultadRef>()
  for (const row of facultadRows ?? []) {
    facultades.set(row.id, { slug: row.slug, nombre: row.nombre })
  }

  const carrerasById = new Map(carreras.map((row) => [row.id, row]))

  // Deduplicación por (materia, carrera) conservando el plan más nuevo.
  const mejorPlan = new Map<string, { plan: string; entry: MateriaCarrera; materiaId: number }>()

  for (const row of planRows) {
    const carrera = carrerasById.get(row.carrera_id)
    if (!carrera) continue
    const facultad = facultades.get(carrera.facultad_id)
    if (!facultad) continue

    const clave = `${row.materia_id}:${carrera.id}`
    const previo = mejorPlan.get(clave)
    if (previo && previo.plan >= row.plan) continue

    mejorPlan.set(clave, {
      plan: row.plan,
      materiaId: row.materia_id,
      entry: {
        slug: carrera.slug,
        nombre: carrera.nombre,
        anio: row.anio,
        cuatrimestre: row.cuatrimestre,
        facultad,
      },
    })
  }

  for (const { materiaId, entry } of mejorPlan.values()) {
    const lista = porMateria.get(materiaId)
    if (lista) lista.push(entry)
    else porMateria.set(materiaId, [entry])
  }

  for (const lista of porMateria.values()) lista.sort(byNombre)

  return porMateria
}

// ---------------------------------------------------------------------------------------
// Materias
// ---------------------------------------------------------------------------------------

/**
 * El catálogo entero, o el subconjunto que coincide con `q` (PART 23 §23.7).
 *
 * Devuelve TODAS las materias que coinciden, sin paginar: son ~110 filas y `/materias` las
 * agrupa por facultad y carrera para armar el hub del mesh de enlaces. Una materia que ningún
 * plan referencia sale con `carreras: []` — no se pierde nunca, porque una materia huérfana en
 * el índice es una página huérfana en Google.
 *
 * `q` se parte en palabras y se exigen TODAS: «derecho consti» encuentra Derecho Constitucional
 * y no devuelve todo lo que tenga "derecho". Los `aliases` cuentan como texto buscable (§0.5-R13).
 */
export async function listMaterias(q?: string): Promise<MateriaListItem[]> {
  const supabase = await createClient()

  const { data, error } = await supabase.from('materias').select('id, slug, nombre, aliases')
  if (error || !data) {
    console.error('[materias] no se pudo leer el catálogo', error)
    return []
  }

  const tokens = q ? fold(q).split(/\s+/).filter(Boolean) : []
  const rows =
    tokens.length === 0
      ? data
      : data.filter((row) => {
          const heno = fold(`${row.nombre} ${row.aliases.join(' ')}`)
          return tokens.every((token) => heno.includes(token))
        })

  const carreras = await loadCarrerasDeMaterias(
    supabase,
    rows.map((row) => row.id),
  )

  return rows
    .map((row) => ({
      id: row.id,
      slug: row.slug,
      nombre: row.nombre,
      carreras: carreras.get(row.id) ?? [],
    }))
    .sort(byNombre)
}

/**
 * La materia de `/materias/[slug]` con todo lo que su encabezado y sus metadatos necesitan
 * (§17.4.1). `null` cuando el slug no está en el catálogo: una materia no se borra nunca
 * (§8.3.1), así que acá no hay lápida 410 que rendir, o estuvo siempre o nunca estuvo.
 *
 * Envuelta en `cache()` de React porque las dos rutas de materia la llaman dos veces por
 * request —una en `generateMetadata` y otra en el render— y son cinco viajes a la base cada
 * vez. La memoización dura lo que dura el request, que es exactamente lo que hace falta.
 */
export const getMateria = cache(async (slug: string): Promise<MateriaDetail | null> => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('materias')
    .select('id, slug, nombre, descripcion')
    .eq('slug', slug)
    .maybeSingle()

  if (error || !data) return null

  const [carreras, followersCount, postsCount, resourcesCount] = await Promise.all([
    loadCarrerasDeMaterias(supabase, [data.id]),
    countFollowers(supabase, data.id),
    countPosts(supabase, data.id),
    countResources(supabase, data.id),
  ])

  return {
    id: data.id,
    slug: data.slug,
    nombre: data.nombre,
    descripcion: data.descripcion,
    carreras: carreras.get(data.id) ?? [],
    followersCount,
    postsCount,
    resourcesCount,
  }
})

/** El agregado público de seguidores; ver la nota del encabezado sobre por qué es una RPC. */
async function countFollowers(
  supabase: Awaited<ReturnType<typeof createClient>>,
  materiaId: number,
): Promise<number> {
  const { data, error } = await supabase.rpc('materia_follower_count', { p_materia_id: materiaId })
  if (error) {
    console.error('[materias] falló el conteo de seguidores', error)
    return 0
  }
  return data ?? 0
}

/**
 * Conteos de la materia. `head: true` no trae ninguna fila: viaja solo el `Content-Range` con
 * el total, que es lo único que se muestra ("34 recursos" en la meta description, §23.2). La
 * página está cacheada por ISR, así que el count no corre por visita.
 *
 * Son dos funciones y no una parametrizada por vista: el nombre de la relación es un literal
 * que supabase-js parsea en tiempo de compilación para inferir la fila, y una unión de dos
 * nombres tira ese tipado abajo.
 */
async function countPosts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  materiaId: number,
): Promise<number> {
  const { count, error } = await supabase
    .from('posts_public')
    .select('id', { count: 'exact', head: true })
    .eq('materia_id', materiaId)

  if (error) {
    console.error('[materias] falló el conteo de publicaciones', error)
    return 0
  }
  return count ?? 0
}

async function countResources(
  supabase: Awaited<ReturnType<typeof createClient>>,
  materiaId: number,
): Promise<number> {
  const { count, error } = await supabase
    .from('resources_public')
    .select('id', { count: 'exact', head: true })
    .eq('materia_id', materiaId)

  if (error) {
    console.error('[materias] falló el conteo de recursos', error)
    return 0
  }
  return count ?? 0
}

/**
 * Las publicaciones de una materia, cronológicas descendentes (§17.4.1).
 *
 * Por `created_at` y no por `last_activity_at`: la página de materia es un archivo (D1), y un
 * comentario nuevo en un hilo de hace un año no debería empujarlo arriba de lo que se publicó
 * esta semana. Los bumps son cosa del feed personalizado, no del archivo.
 *
 * @param materiaId Id interno de la materia (el `id` de `MateriaDetail`).
 */
export async function getMateriaPosts(
  materiaId: number,
  opts: ListOptions = {},
): Promise<Page<PostListItem>> {
  const supabase = await createClient()
  const limit = clampLimit(opts.limit)

  let query = supabase
    .from('posts_public')
    .select(POST_COLUMNS)
    .eq('materia_id', materiaId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    // Una fila de más: es cómo se sabe que hay página siguiente sin contar el total.
    .limit(limit + 1)

  const cursor = decodeCursor(opts.cursor)
  if (cursor) query = query.or(keysetFilter(cursor))

  const { data, error } = await query
  if (error || !data) {
    console.error('[materias] falló la lectura de publicaciones', error)
    return emptyPage()
  }

  const rows = data.map(narrowPost).filter((post): post is NarrowedPost => post !== null)
  const scopes = await loadPostScopes(supabase, rows.slice(0, limit))

  return paginate(rows, limit, (post) => toPostListItem(post, scopes))
}

/**
 * Los recursos de una materia, del más nuevo al más viejo.
 *
 * Orden cronológico y no el ranking de §14.7 (votos → descargas → recencia) a propósito: la
 * estantería que ven las rutas es la de `features/recursos`.`listResources({ materiaId })`, que
 * es la dueña de ese orden. Esta función existe para el contrato de la feature (BUILD-CONTRACT
 * §4.5) y para cualquier consumidor que quiera "lo último subido" sin arrastrar el ranking, y
 * su cursor keyset `(created_at, id)` es exacto justamente porque el orden es simple.
 */
export async function getMateriaResources(
  materiaId: number,
  opts: ListOptions = {},
): Promise<Page<MateriaResourceItem>> {
  const supabase = await createClient()
  const limit = clampLimit(opts.limit)

  let query = supabase
    .from('resources_public')
    .select(RESOURCE_COLUMNS)
    .eq('materia_id', materiaId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1)

  const cursor = decodeCursor(opts.cursor)
  if (cursor) query = query.or(keysetFilter(cursor))

  const { data, error } = await query
  if (error || !data) {
    console.error('[materias] falló la lectura de recursos', error)
    return emptyPage()
  }

  const rows = data
    .map(narrowResource)
    .filter((resource): resource is NarrowedResource => resource !== null)

  // El id interno se cae acá: al navegador va `publicId` (D14.7).
  return paginate(rows, limit, ({ id: _id, ...item }) => item)
}

// ---------------------------------------------------------------------------------------
// Carreras y facultades
// ---------------------------------------------------------------------------------------

/**
 * La carrera de `/carreras/[slug]` con su plan de estudios completo (PART 23 §23.6).
 *
 * `materias` trae UNA fila por posición de plan, no una por materia: la misma materia puede
 * aparecer en dos versiones de plan con año distinto y la grilla las muestra a las dos (por eso
 * la ruta arma su key con slug + año + cuatrimestre). Lo único que se deduplica es la
 * repetición exacta —misma materia, mismo año, mismo cuatrimestre en dos planes—, que no
 * aporta información y rompería esa key.
 *
 * `actividad` es la unión de dos conjuntos: publicaciones etiquetadas con alguna materia del
 * plan y publicaciones cuya carrera congelada (§0.5-R3) es esta. Un post que cumple las dos
 * cláusulas sigue siendo una sola fila.
 */
export const getCarrera = cache(async (slug: string): Promise<CarreraDetail | null> => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('carreras')
    .select('id, slug, nombre, nivel, duracion_anios, facultad_id')
    .eq('slug', slug)
    .maybeSingle()

  if (error || !data) return null

  const { data: facultadRow } = await supabase
    .from('facultades')
    .select('slug, nombre')
    .eq('id', data.facultad_id)
    .maybeSingle()

  // `facultad_id` es NOT NULL con FK RESTRICT: si acá no hay fila, la lectura falló. Se
  // devuelve `null` (la ruta hace notFound()) en vez de renderizar migas y un link a
  // `/facultades/` sin slug, que sería una página rota indexable.
  if (!facultadRow) return null

  const { data: planRows } = await supabase
    .from('plan_materias')
    .select('materia_id, plan, anio, cuatrimestre, codigo, optativa')
    .eq('carrera_id', data.id)

  const plan = planRows ?? []

  const { data: materiaRows } = await supabase
    .from('materias')
    .select('id, slug, nombre')
    .in('id', unique(plan.map((row) => row.materia_id)))

  const materiasById = new Map((materiaRows ?? []).map((row) => [row.id, row]))

  const vistas = new Set<string>()
  const materias: PlanEntry[] = []
  for (const row of plan) {
    const materia = materiasById.get(row.materia_id)
    if (!materia) continue

    const clave = `${row.materia_id}:${row.anio}:${row.cuatrimestre}`
    if (vistas.has(clave)) continue
    vistas.add(clave)

    materias.push({
      slug: materia.slug,
      nombre: materia.nombre,
      codigo: row.codigo,
      anio: row.anio,
      cuatrimestre: row.cuatrimestre,
      optativa: row.optativa,
      plan: row.plan,
    })
  }

  return {
    id: data.id,
    slug: data.slug,
    nombre: data.nombre,
    nivel: data.nivel,
    duracionAnios: data.duracion_anios,
    facultad: facultadRow,
    materias,
    actividad: await loadCarreraActivity(
      supabase,
      data.id,
      unique(plan.map((row) => row.materia_id)),
    ),
  }
})

async function loadCarreraActivity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  carreraId: number,
  materiaIds: number[],
): Promise<PostListItem[]> {
  let query = supabase
    .from('posts_public')
    .select(POST_COLUMNS)
    .order('last_activity_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(CARRERA_ACTIVITY)

  query =
    materiaIds.length > 0
      ? query.or(`materia_id.in.(${materiaIds.join(',')}),carrera_id.eq.${carreraId}`)
      : query.eq('carrera_id', carreraId)

  const { data, error } = await query
  if (error || !data) {
    console.error('[materias] falló la actividad de la carrera', error)
    return []
  }

  const rows = data.map(narrowPost).filter((post): post is NarrowedPost => post !== null)
  const scopes = await loadPostScopes(supabase, rows)

  return rows.map((post) => toPostListItem(post, scopes))
}

/**
 * La facultad de `/facultades/[slug]`: sus carreras agrupables por nivel y cuántas materias
 * tiene cada plan.
 *
 * `materiasCount` cuenta materias DISTINTAS: una materia que está en el plan 2013 y en el 2020
 * de la misma carrera es una materia, no dos, y el número que se muestra al lado de la carrera
 * tiene que coincidir con el largo de la grilla de su página.
 */
export const getFacultad = cache(async (slug: string): Promise<FacultadDetail | null> => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('facultades')
    .select('id, slug, nombre, sede_id')
    .eq('slug', slug)
    .maybeSingle()

  if (error || !data) return null

  const [{ data: sedeRow }, { data: carreraRows }] = await Promise.all([
    supabase.from('sedes').select('slug, nombre, ciudad').eq('id', data.sede_id).maybeSingle(),
    supabase.from('carreras').select('id, slug, nombre, nivel').eq('facultad_id', data.id),
  ])

  const carreras = carreraRows ?? []

  const { data: planRows } = await supabase
    .from('plan_materias')
    .select('carrera_id, materia_id')
    .in(
      'carrera_id',
      carreras.map((row) => row.id),
    )

  const materiasPorCarrera = new Map<number, Set<number>>()
  for (const row of planRows ?? []) {
    const bucket = materiasPorCarrera.get(row.carrera_id)
    if (bucket) bucket.add(row.materia_id)
    else materiasPorCarrera.set(row.carrera_id, new Set([row.materia_id]))
  }

  return {
    id: data.id,
    slug: data.slug,
    nombre: data.nombre,
    sede: sedeRow ?? null,
    carreras: carreras
      .map((row) => ({
        slug: row.slug,
        nombre: row.nombre,
        nivel: row.nivel,
        materiasCount: materiasPorCarrera.get(row.id)?.size ?? 0,
      }))
      .sort(byNombre),
  }
})

// ---------------------------------------------------------------------------------------
// Seguimiento
// ---------------------------------------------------------------------------------------

/**
 * Ids de las materias que sigue quien mira, o `[]` sin sesión.
 *
 * `materia_follows` tiene política de select sobre las filas propias, así que la base ya acota
 * el resultado al usuario: no hace falta (ni serviría) filtrar por `user_id` acá.
 */
export async function getFollowedMateriaIds(): Promise<number[]> {
  const user = await getUser()
  if (!user) return []

  const supabase = await createClient()
  const { data, error } = await supabase.from('materia_follows').select('materia_id')
  if (error) {
    console.error('[materias] no se pudieron leer las materias seguidas', error)
    return []
  }

  return (data ?? []).map((row) => row.materia_id)
}

/**
 * Si quien mira sigue esta materia. Sin sesión es `false`: la página es pública (C16) y el
 * botón de seguir se reemplaza por una puerta a `/ingresar`.
 */
export async function isFollowing(materiaId: number): Promise<boolean> {
  const user = await getUser()
  if (!user) return false

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('materia_follows')
    .select('materia_id')
    .eq('materia_id', materiaId)
    .maybeSingle()

  if (error) {
    console.error('[materias] no se pudo leer el estado de seguimiento', error)
    return false
  }

  return data !== null
}
