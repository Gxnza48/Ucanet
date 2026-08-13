/**
 * features/recursos/queries.ts — lecturas de la estantería de recursos
 * (PART 14 §14.5/§14.7, PART 17 §17.4.5, BUILD-CONTRACT §4.5).
 *
 * TODA lectura pasa por las vistas `_public` (D14.5). Las tablas `resources` y
 * `resource_files` tienen RLS habilitada y CERO políticas de select: consultarlas
 * desde acá no devolvería filas, devolvería un error de permisos. Eso es a
 * propósito — `resources_public` es la que decide anular `author_handle` en un
 * recurso anónimo, y `resource_files_public` la que se guarda `storage_path` y
 * `sha256` adentro de la base (migración 0010).
 *
 * NULABILIDAD: Postgres no propaga NOT NULL a las columnas de una vista, así que
 * `lib/types.gen.ts` tipa todo como `| null`. El estrechamiento se hace acá, que
 * es donde se conoce el invariante: una fila sin `public_id` o sin `title` es
 * imposible y se descarta en silencio en vez de contaminar la UI con nulos.
 *
 * Paginación por keyset (BUILD-CONTRACT §4.5), nunca OFFSET: el cursor lleva la
 * clave de orden completa en base64url. Con OFFSET, insertar un recurso mientras
 * alguien pagina le repite o le saltea filas, y esta es una estantería que se
 * lee de arriba abajo.
 */
import 'server-only'

import { LIMITS, PAGE_SIZE, type AcceptedMime } from '@/lib/config'
import { createClient, getProfile, getUser } from '@/lib/supabase/server'
import { handlePattern } from '@/lib/utils/handle'

import { isAcceptedMime, isResourceTipo, type ResourceTipo } from './schemas'

/**
 * Columnas de `resources_public` que necesita una fila de lista.
 *
 * Un único literal, sin concatenar: `supabase-js` deriva el tipo del resultado
 * parseando ESTA cadena en tiempo de compilación, y `'a' + 'b'` colapsa a
 * `string` y le saca el tipo a toda la consulta.
 */
const RESOURCE_COLUMNS =
  'id, public_id, materia_id, tipo, anio, title, description, is_anonymous, author_handle, score, downloads_count, created_at, edited_at'

/** Metadatos visibles de un archivo. Nunca incluye `storage_path` ni `sha256`. */
export type ResourceFileSummary = {
  originalName: string
  mime: AcceptedMime
  sizeBytes: number
  /** 1 a 3: el orden en que el autor eligió los archivos (§8.3.5). */
  position: number
}

export type ResourceMateria = {
  slug: string
  nombre: string
}

export type ResourceListItem = {
  publicId: string
  title: string
  tipo: ResourceTipo
  anio: number | null
  materia: ResourceMateria | null
  /** `null` cuando el recurso es anónimo: la vista no emite ningún campo de autor (D3). */
  authorHandle: string | null
  isAnonymous: boolean
  score: number
  downloadsCount: number
  createdAt: string
  fileCount: number
  totalBytes: number
  /** MIME del primer archivo, para el "PDF · 2,4 MB" de la fila (§17.4.5). */
  primaryMime: AcceptedMime | null
}

export type ResourceDetail = ResourceListItem & {
  /**
   * Id interno (bigint). NO puede serializarse al navegador (D14.7): existe para
   * que el servidor resuelva el voto propio con `getViewerResourceVotes`.
   */
  id: number
  description: string | null
  editedAt: string | null
  files: ResourceFileSummary[]
}

/** Orden de la estantería. Por defecto, el de §14.7 cuando hay materia. */
export type ResourceOrden = 'destacados' | 'recientes'

export type ListResourcesOptions = {
  materiaId?: number
  tipo?: string
  cursor?: string
  limit?: number
  orden?: ResourceOrden
}

export type ResourceListPage = {
  items: ResourceListItem[]
  nextCursor: string | null
}

type ResourceRow = {
  id: number | null
  public_id: string | null
  materia_id: number | null
  tipo: string | null
  anio: number | null
  title: string | null
  description: string | null
  is_anonymous: boolean | null
  author_handle: string | null
  score: number | null
  downloads_count: number | null
  created_at: string | null
  edited_at: string | null
}

type Keyset = {
  score: number
  downloads: number
  createdAt: string
  id: number
}

/**
 * Lista de recursos, filtrable por materia y por tipo.
 *
 * Orden por defecto (§14.7): en la estantería de una materia, votos desc →
 * descargas desc → recencia. En el listado global manda la recencia, porque ahí
 * ordenar por votos congelaría la portada del catálogo entero en los mismos
 * veinte recursos para siempre; adentro de una materia el conjunto es chico y
 * los votos son justamente la señal que ordena (la etiqueta "Nuevo" de 14 días
 * es la compensación de arranque en frío que fija §14.7).
 */
export async function listResources(opts: ListResourcesOptions = {}): Promise<ResourceListPage> {
  const limit = Math.min(Math.max(opts.limit ?? PAGE_SIZE, 1), PAGE_SIZE)
  const orden: ResourceOrden = opts.orden ?? (opts.materiaId ? 'destacados' : 'recientes')
  const cursor = decodeCursor(opts.cursor)

  const supabase = await createClient()
  let filtered = supabase.from('resources_public').select(RESOURCE_COLUMNS)

  if (opts.materiaId !== undefined) filtered = filtered.eq('materia_id', opts.materiaId)
  if (opts.tipo && isResourceTipo(opts.tipo)) filtered = filtered.eq('tipo', opts.tipo)
  if (cursor) filtered = filtered.or(keysetFilter(orden, cursor))

  const ordered =
    orden === 'recientes'
      ? filtered.order('created_at', { ascending: false }).order('id', { ascending: false })
      : filtered
          .order('score', { ascending: false })
          .order('downloads_count', { ascending: false })
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })

  // Se pide una fila de más: si vuelve, hay página siguiente y su cursor sale de
  // la última fila que sí se muestra.
  const { data, error } = await ordered.limit(limit + 1)

  if (error) {
    console.error('listResources', error)
    return { items: [], nextCursor: null }
  }

  const rows = (data ?? []).filter(isRenderableRow)
  const page = rows.slice(0, limit)
  const items = await decorate(page)
  const last = page[page.length - 1]
  const hasMore = rows.length > limit && last !== undefined

  return {
    items,
    nextCursor: hasMore && last ? encodeCursor(keysetOf(last)) : null,
  }
}

/**
 * Ficha completa de un recurso: metadatos públicos + lista de archivos.
 *
 * Devuelve `null` cuando el recurso no existe, está en borrador, fue eliminado o
 * retirado por pedido legal — la vista solo emite filas `activo`. La página lo
 * traduce a una lápida HTTP 410, no a un 404 (§0.5-R23c).
 */
export async function getResource(publicId: string): Promise<ResourceDetail | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('resources_public')
    .select(RESOURCE_COLUMNS)
    .eq('public_id', publicId)
    .maybeSingle()

  if (error) {
    console.error('getResource', error)
    return null
  }
  if (!data || !isRenderableRow(data)) return null

  const files = await listFiles([data.id])
  const items = await decorate([data], files)
  const item = items[0]
  if (!item) return null

  return {
    ...item,
    id: data.id,
    description: data.description,
    editedAt: data.edited_at,
    files: files.get(data.id) ?? [],
  }
}

/**
 * Solo el tipo de un recurso, o `null` si no existe o no es visible.
 *
 * Existe para la analítica: `track_event` exige `dim` en `recurso_descargado` y ese
 * `dim` es el tipo del recurso (allowlist de la migración 0011). `register_download`
 * devuelve las claves de objeto y nada más, así que el tipo hay que ir a buscarlo.
 *
 * COSTO: una consulta más, de una sola columna, resuelta por el índice único de
 * `resources_public.public_id` — el mínimo que se puede leer de un recurso. No usa
 * `getResource`, que además de la fila trae los archivos y la materia (tres idas y
 * vueltas) para armar una ficha que nadie va a renderizar.
 */
export async function getResourceTipo(publicId: string): Promise<ResourceTipo | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('resources_public')
    .select('tipo')
    .eq('public_id', publicId)
    .maybeSingle()

  if (error || !data?.tipo || !isResourceTipo(data.tipo)) return null
  return data.tipo
}

/**
 * Ids de los recursos que el visitante ya votó, para pintar el control.
 *
 * `resource_votes` tiene una única política de select —"tus propias filas"— así
 * que esta consulta no puede devolver el voto de nadie más ni aunque se le pase
 * cualquier id: la base es la que acota, no el WHERE (migración 0007).
 */
export async function getViewerResourceVotes(resourceIds: number[]): Promise<Set<number>> {
  if (resourceIds.length === 0) return new Set()

  const user = await getUser()
  if (!user) return new Set()

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('resource_votes')
    .select('resource_id')
    .eq('user_id', user.id)
    .in('resource_id', resourceIds)

  if (error) {
    console.error('getViewerResourceVotes', error)
    return new Set()
  }

  return new Set((data ?? []).map((row) => row.resource_id))
}

/**
 * Cuánto del cupo de subida de 100 MB lleva usado el visitante (§0.5-R12).
 *
 * APROXIMACIÓN CONOCIDA: la cuota real se mide sobre `resource_files.size_bytes`
 * de TODO lo que la persona subió alguna vez —incluidos recursos anónimos,
 * borrados y archivos reemplazados— y esa suma solo la puede hacer una función
 * `security definer`, porque las tablas base no otorgan select a nadie. No existe
 * hoy una RPC de cuota en las migraciones 0001-0013, así que acá se suma lo único
 * visible: los archivos de los recursos activos y firmados del propio usuario.
 * Subestima. Es una pista para la UI y nada más — quien decide es
 * `request_upload`/`finalize_upload`, que levantan QUOTA_EXCEEDED con el número
 * verdadero (PART 8 §8.5.3).
 */
export async function getQuotaUsage(): Promise<{ usedBytes: number; limitBytes: number }> {
  const limitBytes = LIMITS.userQuotaBytes
  const profile = await getProfile()
  if (!profile) return { usedBytes: 0, limitBytes }

  const supabase = await createClient()
  // `ilike` y no `eq`: la vista emite `handle::text` y sobre text la comparación
  // distingue mayúsculas, mientras que la columna de la base es citext y no
  // (lib/utils/handle.ts). Acá el handle viene del propio perfil, así que hoy
  // coincide igual; la forma se unifica para que nadie herede el bug al reusar.
  const { data: resources, error } = await supabase
    .from('resources_public')
    .select('id')
    .ilike('author_handle', handlePattern(profile.handle))

  if (error) {
    console.error('getQuotaUsage', error)
    return { usedBytes: 0, limitBytes }
  }

  const ids = (resources ?? [])
    .map((row) => row.id)
    .filter((id): id is number => typeof id === 'number')
  if (ids.length === 0) return { usedBytes: 0, limitBytes }

  const files = await listFiles(ids)
  let usedBytes = 0
  for (const list of files.values()) {
    for (const file of list) usedBytes += file.sizeBytes
  }

  return { usedBytes, limitBytes }
}

// ---------------------------------------------------------------------------
// Interno
// ---------------------------------------------------------------------------

type RenderableRow = ResourceRow & {
  id: number
  public_id: string
  title: string
  tipo: ResourceTipo
  created_at: string
}

/** Una fila sin id, public_id, título, tipo válido o fecha es imposible: se descarta. */
function isRenderableRow(row: ResourceRow): row is RenderableRow {
  return (
    typeof row.id === 'number' &&
    typeof row.public_id === 'string' &&
    typeof row.title === 'string' &&
    typeof row.tipo === 'string' &&
    isResourceTipo(row.tipo) &&
    typeof row.created_at === 'string'
  )
}

/**
 * Completa las filas con su materia y el resumen de archivos.
 *
 * Tres consultas planas en vez de un embed de PostgREST: el catálogo y los
 * archivos se leen con un `in (...)` sobre la página entera, que es una ida y
 * vuelta por lista y no una por fila, y el tipado no depende de cómo PostgREST
 * infiera la cardinalidad de una relación declarada sobre una vista.
 */
async function decorate(
  rows: RenderableRow[],
  preloadedFiles?: Map<number, ResourceFileSummary[]>,
): Promise<ResourceListItem[]> {
  if (rows.length === 0) return []

  const materiaIds = unique(
    rows.map((row) => row.materia_id).filter((id): id is number => typeof id === 'number'),
  )

  const [materias, files] = await Promise.all([
    listMaterias(materiaIds),
    preloadedFiles ?? listFiles(rows.map((row) => row.id)),
  ])

  return rows.map((row) => {
    const rowFiles = files.get(row.id) ?? []
    const materia = row.materia_id === null ? undefined : materias.get(row.materia_id)

    return {
      publicId: row.public_id,
      title: row.title,
      tipo: row.tipo,
      anio: row.anio,
      materia: materia ?? null,
      authorHandle: row.author_handle,
      isAnonymous: row.is_anonymous ?? false,
      score: row.score ?? 0,
      downloadsCount: row.downloads_count ?? 0,
      createdAt: row.created_at,
      fileCount: rowFiles.length,
      totalBytes: rowFiles.reduce((total, file) => total + file.sizeBytes, 0),
      primaryMime: rowFiles[0]?.mime ?? null,
    }
  })
}

async function listMaterias(ids: number[]): Promise<Map<number, ResourceMateria>> {
  const result = new Map<number, ResourceMateria>()
  if (ids.length === 0) return result

  const supabase = await createClient()
  const { data, error } = await supabase.from('materias').select('id, slug, nombre').in('id', ids)

  if (error) {
    console.error('listMaterias', error)
    return result
  }

  for (const row of data ?? []) result.set(row.id, { slug: row.slug, nombre: row.nombre })
  return result
}

async function listFiles(resourceIds: number[]): Promise<Map<number, ResourceFileSummary[]>> {
  const result = new Map<number, ResourceFileSummary[]>()
  if (resourceIds.length === 0) return result

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('resource_files_public')
    .select('resource_id, original_name, mime, size_bytes, position')
    .in('resource_id', resourceIds)
    .order('position', { ascending: true })

  if (error) {
    console.error('listFiles', error)
    return result
  }

  for (const row of data ?? []) {
    if (
      typeof row.resource_id !== 'number' ||
      typeof row.original_name !== 'string' ||
      typeof row.mime !== 'string' ||
      !isAcceptedMime(row.mime) ||
      typeof row.size_bytes !== 'number'
    ) {
      continue
    }

    const list = result.get(row.resource_id) ?? []
    list.push({
      originalName: row.original_name,
      mime: row.mime,
      sizeBytes: row.size_bytes,
      position: row.position ?? list.length + 1,
    })
    result.set(row.resource_id, list)
  }

  return result
}

function unique(values: number[]): number[] {
  return Array.from(new Set(values))
}

function keysetOf(row: RenderableRow): Keyset {
  return {
    score: row.score ?? 0,
    downloads: row.downloads_count ?? 0,
    createdAt: row.created_at,
    id: row.id,
  }
}

/**
 * El filtro keyset como cadena de PostgREST: "todo lo que va estrictamente
 * después de esta fila en el orden pedido". Las marcas de tiempo van entre
 * comillas porque llevan `+` y `:`, que PostgREST interpreta como sintaxis.
 */
function keysetFilter(orden: ResourceOrden, cursor: Keyset): string {
  const at = `"${cursor.createdAt}"`

  if (orden === 'recientes') {
    return [`created_at.lt.${at}`, `and(created_at.eq.${at},id.lt.${cursor.id})`].join(',')
  }

  return [
    `score.lt.${cursor.score}`,
    `and(score.eq.${cursor.score},downloads_count.lt.${cursor.downloads})`,
    `and(score.eq.${cursor.score},downloads_count.eq.${cursor.downloads},created_at.lt.${at})`,
    `and(score.eq.${cursor.score},downloads_count.eq.${cursor.downloads},created_at.eq.${at},id.lt.${cursor.id})`,
  ].join(',')
}

function encodeCursor(keyset: Keyset): string {
  return Buffer.from(JSON.stringify(keyset), 'utf8').toString('base64url')
}

/** Un cursor ilegible se ignora y se sirve la primera página: nunca es un error. */
function decodeCursor(cursor: string | undefined): Keyset | null {
  if (!cursor) return null

  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))
    if (typeof parsed !== 'object' || parsed === null) return null

    const candidate = parsed as Partial<Keyset>
    if (
      typeof candidate.score !== 'number' ||
      typeof candidate.downloads !== 'number' ||
      typeof candidate.createdAt !== 'string' ||
      typeof candidate.id !== 'number'
    ) {
      return null
    }

    return {
      score: candidate.score,
      downloads: candidate.downloads,
      createdAt: candidate.createdAt,
      id: candidate.id,
    }
  } catch {
    return null
  }
}
