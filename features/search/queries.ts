import 'server-only'

/**
 * features/search/queries.ts — lecturas de búsqueda (PART 13, PART 17 §17.4.6).
 *
 * Toda la búsqueda pasa por las tres funciones `search_*` de la migración 0011
 * (`search_posts`, `search_resources`, `search_catalog`): son STABLE, corren sobre
 * las vistas `_public` y nunca pueden emitir un campo de autor de contenido anónimo
 * (PART 13 §13.2, D14.5). Acá no hay SQL ni `select` sobre tablas de contenido.
 *
 * Los `id` bigint que devuelven las RPC se usan sólo del lado del servidor, para
 * resolver el nombre de la materia o la carrera del chip; al navegador viajan
 * `public_id` y `slug` (D14.7).
 *
 * `searchAll` está envuelta en `cache()` de React: la página `/buscar` puede
 * llamarla desde `generateMetadata` y desde el componente sin pagar dos veces la
 * consulta ni registrar la misma búsqueda dos veces en `search_queries`.
 */
import { cache } from 'react'

import { trackEvent } from '@/lib/analytics'
import { PAGE_SIZE } from '@/lib/config'
import { createClient } from '@/lib/supabase/server'

/** Filtro `tipo` de la URL (`/buscar?q=…&tipo=recursos`). "Todo" es el default. */
export type SearchTipo = 'todo' | 'publicaciones' | 'recursos' | 'materias'

/** Referencia de catálogo tal como viaja al navegador: sin ids internos. */
export type CatalogRef = {
  slug: string
  nombre: string
}

export type MateriaHit = CatalogRef
export type CarreraHit = CatalogRef

export type PostHit = {
  publicId: string
  kind: string
  title: string | null
  body: string | null
  isAnonymous: boolean
  authorHandle: string | null
  score: number
  commentsCount: number
  createdAt: string
  lastActivityAt: string
  materia: CatalogRef | null
  carrera: CatalogRef | null
}

export type ResourceHit = {
  publicId: string
  tipo: string
  title: string
  description: string | null
  anio: number | null
  isAnonymous: boolean
  authorHandle: string | null
  score: number
  downloadsCount: number
  createdAt: string
  materia: CatalogRef | null
}

export type SearchResults = {
  /** La consulta normalizada: lo que se muestra entre comillas en la página. */
  q: string
  tipo: SearchTipo
  materias: MateriaHit[]
  carreras: CarreraHit[]
  recursos: ResourceHit[]
  publicaciones: PostHit[]
  /** Suma de los cuatro grupos. Cero dispara el estado de §13.7. */
  total: number
}

/**
 * Tamaños de la página uno, en el orden fijo de PART 13 §13.5 / PART 17 §17.4.6:
 * Materias 5 → Carreras 3 → Recursos 5 → Publicaciones 10. El orden es la
 * precedencia de tipo: no hay mezcla numérica entre tipos distintos (§13.4).
 */
export const SEARCH_GROUP_LIMITS = {
  materias: 5,
  carreras: 3,
  recursos: 5,
  publicaciones: 10,
} as const

/** Mínimo de caracteres para tocar el índice. Menos que esto no es una consulta. */
export const SEARCH_MIN_LENGTH = 2

/** Tope de la consulta, espejo del `left(…, 100)` de las RPC (§13.3). */
export const SEARCH_MAX_LENGTH = 100

/** Sugerencias de typeahead: sólo materias, 2 caracteres mínimo, 8 como máximo (§13.6). */
export const SUGGEST_MIN_LENGTH = 2
export const SUGGEST_LIMIT = 8

/** Recorta espacios, colapsa los internos y corta a 100 caracteres (§13.3). */
export function normalizeQuery(input: string): string {
  return input.replace(/\s+/g, ' ').trim().slice(0, SEARCH_MAX_LENGTH)
}

function emptyResults(q: string, tipo: SearchTipo): SearchResults {
  return { q, tipo, materias: [], carreras: [], recursos: [], publicaciones: [], total: 0 }
}

function toCatalogRef(row: { slug: string; nombre: string }): CatalogRef {
  return { slug: row.slug, nombre: row.nombre }
}

/**
 * Resuelve nombre y slug de las materias y carreras referenciadas por los
 * resultados. Las tablas de catálogo son públicas (política `read_all` de la
 * migración 0002), así que esto no abre ninguna superficie nueva; los ids no
 * salen de esta función.
 */
async function loadCatalogRefs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  materiaIds: number[],
  carreraIds: number[],
): Promise<{ materias: Map<number, CatalogRef>; carreras: Map<number, CatalogRef> }> {
  const materias = new Map<number, CatalogRef>()
  const carreras = new Map<number, CatalogRef>()

  const [materiaRows, carreraRows] = await Promise.all([
    materiaIds.length > 0
      ? supabase.from('materias').select('id, slug, nombre').in('id', materiaIds)
      : null,
    carreraIds.length > 0
      ? supabase.from('carreras').select('id, slug, nombre').in('id', carreraIds)
      : null,
  ])

  for (const row of materiaRows?.data ?? []) {
    materias.set(row.id, toCatalogRef(row))
  }
  for (const row of carreraRows?.data ?? []) {
    carreras.set(row.id, toCatalogRef(row))
  }

  return { materias, carreras }
}

/**
 * Búsqueda del sitio: catálogo (materias y carreras), recursos y publicaciones.
 *
 * Los grupos salen siempre en el mismo orden y con los mismos tamaños; un grupo
 * vacío se colapsa en la UI. Cuando `tipo` no es "todo", el grupo elegido crece a
 * `PAGE_SIZE` y los demás quedan vacíos: eso es el "Ver más" de §13.5.
 */
export const searchAll = cache(async function searchAll(
  q: string,
  tipo: SearchTipo = 'todo',
): Promise<SearchResults> {
  const query = normalizeQuery(q ?? '')
  if (query.length < SEARCH_MIN_LENGTH) return emptyResults(query, tipo)

  const supabase = await createClient()

  const wantsCatalog = tipo === 'todo' || tipo === 'materias'
  const wantsResources = tipo === 'todo' || tipo === 'recursos'
  const wantsPosts = tipo === 'todo' || tipo === 'publicaciones'

  // El catálogo viene en una sola llamada con materias antes que carreras: por eso
  // se pide holgado y se parte acá, en vez de dos RPC (§13.4, precedencia de grupo).
  const catalogLimit = tipo === 'materias' ? PAGE_SIZE : 25
  const resourceLimit = tipo === 'recursos' ? PAGE_SIZE : SEARCH_GROUP_LIMITS.recursos
  const postLimit = tipo === 'publicaciones' ? PAGE_SIZE : SEARCH_GROUP_LIMITS.publicaciones

  const [catalog, resources, posts] = await Promise.all([
    wantsCatalog ? supabase.rpc('search_catalog', { p_query: query, p_limit: catalogLimit }) : null,
    wantsResources
      ? supabase.rpc('search_resources', { p_query: query, p_limit: resourceLimit })
      : null,
    wantsPosts ? supabase.rpc('search_posts', { p_query: query, p_limit: postLimit }) : null,
  ])

  const catalogRows = catalog?.data ?? []
  const resourceRows = resources?.data ?? []
  const postRows = posts?.data ?? []

  const materias = catalogRows
    .filter((row) => row.kind === 'materia')
    .slice(0, tipo === 'materias' ? PAGE_SIZE : SEARCH_GROUP_LIMITS.materias)
    .map(toCatalogRef)

  // Las carreras sólo aparecen en "Todo": el filtro de tipo del producto tiene
  // cuatro valores y las carreras se pliegan dentro de "Todo" (§13.5).
  const carreras =
    tipo === 'todo'
      ? catalogRows
          .filter((row) => row.kind === 'carrera')
          .slice(0, SEARCH_GROUP_LIMITS.carreras)
          .map(toCatalogRef)
      : []

  const refs = await loadCatalogRefs(
    supabase,
    [...postRows.map((row) => row.materia_id), ...resourceRows.map((row) => row.materia_id)].filter(
      (id): id is number => typeof id === 'number',
    ),
    postRows.map((row) => row.carrera_id).filter((id): id is number => typeof id === 'number'),
  )

  const publicaciones: PostHit[] = postRows.map((row) => ({
    publicId: row.public_id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    isAnonymous: row.is_anonymous,
    authorHandle: row.author_handle,
    score: row.score,
    commentsCount: row.comments_count,
    createdAt: row.created_at,
    lastActivityAt: row.last_activity_at,
    materia: refs.materias.get(row.materia_id) ?? null,
    carrera: refs.carreras.get(row.carrera_id) ?? null,
  }))

  const recursos: ResourceHit[] = resourceRows.map((row) => ({
    publicId: row.public_id,
    tipo: row.tipo,
    title: row.title,
    description: row.description,
    anio: row.anio,
    isAnonymous: row.is_anonymous,
    authorHandle: row.author_handle,
    score: row.score,
    downloadsCount: row.downloads_count,
    createdAt: row.created_at,
    materia: refs.materias.get(row.materia_id) ?? null,
  }))

  const total = materias.length + carreras.length + recursos.length + publicaciones.length

  // Telemetría (§13.8, §0.5-R10, §24.3): la consulta normalizada y su total van a
  // `search_queries` — jamás usuario, sesión ni IP —, y los contadores agregados
  // `busqueda` / `busqueda_sin_resultados` a `events`, que nunca guarda texto
  // libre. El segundo es el generador de la lista de contenido faltante. Si algo
  // de esto falla, la búsqueda no se entera: una métrica nunca rompe una lectura.
  try {
    await Promise.all([
      supabase.rpc('log_search_query', { p_query: query, p_results_total: total }),
      trackEvent('busqueda'),
      ...(total === 0 ? [trackEvent('busqueda_sin_resultados')] : []),
    ])
  } catch {
    // Silencio deliberado.
  }

  return { q: query, tipo, materias, carreras, recursos, publicaciones, total }
})

/**
 * Normaliza el término del typeahead. Deja letras, números y espacios: los
 * comodines de LIKE (`%`, `_`) y cualquier carácter con significado para
 * PostgREST se caen acá, así que el término llega inerte al filtro.
 */
function normalizeSuggestTerm(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40)
}

/**
 * Sugerencias del typeahead: materias y nada más (§13.6). Prefijo sobre el nombre
 * y coincidencia exacta contra `materias.aliases`, que es la tolerancia a apodos
 * de v1 ("consti" → Derecho Constitucional). Sin FTS: una consulta de índice por
 * tecleo es exactamente el costo que §13.5 rechaza.
 */
export async function suggestMaterias(q: string): Promise<MateriaHit[]> {
  const term = normalizeSuggestTerm(q ?? '')
  if (term.length < SUGGEST_MIN_LENGTH) return []

  const supabase = await createClient()

  const [byName, byAlias] = await Promise.all([
    supabase
      .from('materias')
      .select('slug, nombre')
      .ilike('nombre', `${term}%`)
      .order('nombre')
      .limit(SUGGEST_LIMIT),
    supabase
      .from('materias')
      .select('slug, nombre')
      .contains('aliases', [term])
      .order('nombre')
      .limit(SUGGEST_LIMIT),
  ])

  const seen = new Set<string>()
  const out: MateriaHit[] = []

  // El prefijo del nombre va primero: es lo que el estudiante está tipeando.
  for (const row of [...(byName.data ?? []), ...(byAlias.data ?? [])]) {
    if (seen.has(row.slug)) continue
    seen.add(row.slug)
    out.push(toCatalogRef(row))
    if (out.length >= SUGGEST_LIMIT) break
  }

  return out
}
