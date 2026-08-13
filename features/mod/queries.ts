import 'server-only'

/**
 * features/mod/queries.ts — lecturas del panel `/mod/*` (PART 11 §11.4).
 *
 * Todo lo que se lee acá está protegido por políticas `role in ('mod','admin')`
 * (migración 0008): para cualquier otra cuenta estas consultas devuelven cero
 * filas. Las páginas igual llaman a `requireMod()` para redirigir en vez de
 * mostrar una tabla vacía; acá no se redirige nada, así que estas funciones son
 * seguras de usar también desde `generateMetadata`.
 *
 * Dos reglas de anonimato que este archivo respeta sin excepción:
 *
 * 1. **El denunciante no se muestra nunca** (§11.4.1): `reports.reporter_id` no se
 *    selecciona en ninguna consulta de este archivo. La cola muestra cuántos
 *    reportaron, no quiénes.
 * 2. **La autoría anónima no es ambiental** (§11.4.2): el contenido se lee por las
 *    vistas `_public`, que ya anulan el autor de lo anónimo. Ver el autor real es
 *    una acción aparte y auditada (`mod_reveal_author`), nunca una lectura.
 */
import { createClient } from '@/lib/supabase/server'
import { handlePattern } from '@/lib/utils/handle'
import { excerpt } from '@/lib/utils/text'
import {
  CATEGORIAS_PRIORITARIAS,
  REPORT_CATEGORIA_VALUES,
  REPORT_STATUS_VALUES,
  type ReportCategoria,
  type ReportStatus,
  type TargetKind,
} from './schemas'

/** Largo del recorte de contenido en la cola (§11.4.1). */
const QUEUE_EXCERPT = 140
/** Tope de filas que trae la cola de una vez: la cola es de trabajo, no un archivo. */
const QUEUE_LIMIT = 200

const HANDLE_PATTERN = /^[A-Za-z0-9_]{3,24}$/

export type ReportQueueItem = {
  /**
   * El reporte más viejo del objetivo: es el que abre `/mod/reportes/[id]`. Los
   * ids de moderación son internos por diseño — el panel es una superficie
   * interna y las RPC de PART 8 reciben bigint (excepción explícita a D14.7).
   */
  id: number
  targetKind: TargetKind
  /** `public_id` del contenido o handle del perfil, cuando se pudo resolver. */
  targetPublicId: string | null
  excerpt: string
  categorias: ReportCategoria[]
  reportCount: number
  status: ReportStatus
  /** Fecha del reporte más viejo del objetivo: es la edad que mide el SLA. */
  createdAt: string
  /** `amenazas`, `datos_personales` o `contenido_ilegal` (§11.4.3). */
  priority: boolean
}

export type ReportDetail = {
  id: number
  targetKind: TargetKind
  targetPublicId: string | null
  status: ReportStatus
  createdAt: string
  target: {
    title: string | null
    body: string | null
    /** Enlace público al contenido, cuando sigue visible. */
    href: string | null
    isAnonymous: boolean
    /** Handle del autor sólo si el contenido NO es anónimo. */
    authorHandle: string | null
    /** El contenido ya no está en las vistas públicas (removido o purgado). */
    missing: boolean
  }
  /** Todos los reportes sobre el mismo objetivo, sin identificar a nadie. */
  reports: Array<{
    id: number
    categoria: ReportCategoria
    detalle: string | null
    status: ReportStatus
    createdAt: string
  }>
}

export type AppealItem = {
  id: number
  body: string
  status: 'pendiente' | 'aceptada' | 'rechazada'
  createdAt: string
  modActionId: number
  action: string
  targetKind: string
  targetPublicId: string
  motivoPublico: string
  actionCreatedAt: string
}

export type RestrictionItem = {
  id: number
  handle: string | null
  tipo: string
  motivo: string
  startsAt: string
  until: string | null
  createdAt: string
}

export type ModActionItem = {
  id: number
  action: string
  targetKind: string
  targetPublicId: string
  motivoPublico: string
  notasInternas: string | null
  createdAt: string
}

function isReportCategoria(value: string): value is ReportCategoria {
  return (REPORT_CATEGORIA_VALUES as readonly string[]).includes(value)
}

function isReportStatus(value: string): value is ReportStatus {
  return (REPORT_STATUS_VALUES as readonly string[]).includes(value)
}

function targetKindOf(row: {
  post_id: number | null
  comment_id: number | null
  resource_id: number | null
  profile_id: string | null
}): { kind: TargetKind; key: string } | null {
  if (row.post_id !== null) return { kind: 'post', key: `post:${row.post_id}` }
  if (row.comment_id !== null) return { kind: 'comment', key: `comment:${row.comment_id}` }
  if (row.resource_id !== null) return { kind: 'resource', key: `resource:${row.resource_id}` }
  if (row.profile_id !== null) return { kind: 'profile', key: `profile:${row.profile_id}` }
  return null
}

type TargetSnapshot = {
  publicId: string | null
  title: string | null
  body: string | null
  href: string | null
  isAnonymous: boolean
  authorHandle: string | null
  missing: boolean
}

const MISSING_TARGET: TargetSnapshot = {
  publicId: null,
  title: null,
  body: null,
  href: null,
  isAnonymous: false,
  authorHandle: null,
  missing: true,
}

/**
 * Resuelve el contenido reportado contra las vistas `_public`. Lo removido no
 * está en `posts_public` ni en `resources_public`, así que queda como `missing`:
 * la cola tiene que seguir siendo legible después de una acción.
 */
async function loadTargets(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ids: { posts: number[]; comments: number[]; resources: number[]; profiles: string[] },
): Promise<Map<string, TargetSnapshot>> {
  const out = new Map<string, TargetSnapshot>()

  // Varios reportes sobre el mismo objetivo comparten id: se pide una sola vez.
  const postIds = [...new Set(ids.posts)]
  const commentIds = [...new Set(ids.comments)]
  const resourceIds = [...new Set(ids.resources)]
  const profileIds = [...new Set(ids.profiles)]

  const [posts, comments, resources, profiles] = await Promise.all([
    postIds.length > 0
      ? supabase
          .from('posts_public')
          .select('id, public_id, title, body, is_anonymous, author_handle')
          .in('id', postIds)
      : null,
    commentIds.length > 0
      ? supabase
          .from('comments_public')
          .select('id, public_id, post_id, body, is_anonymous, author_handle')
          .in('id', commentIds)
      : null,
    resourceIds.length > 0
      ? supabase
          .from('resources_public')
          .select('id, public_id, title, description, is_anonymous, author_handle')
          .in('id', resourceIds)
      : null,
    profileIds.length > 0
      ? supabase.from('profiles_public').select('id, handle').in('id', profileIds)
      : null,
  ])

  for (const row of posts?.data ?? []) {
    if (row.id === null) continue
    out.set(`post:${row.id}`, {
      publicId: row.public_id,
      title: row.title,
      body: row.body,
      href: row.public_id ? `/p/${row.public_id}` : null,
      isAnonymous: row.is_anonymous ?? false,
      authorHandle: row.author_handle,
      missing: false,
    })
  }

  // El comentario necesita el `public_id` de su publicación para el permalink.
  const commentRows = comments?.data ?? []
  const parentIds = [
    ...new Set(commentRows.map((row) => row.post_id).filter((id): id is number => id !== null)),
  ]
  const parents =
    parentIds.length > 0
      ? await supabase.from('posts_public').select('id, public_id').in('id', parentIds)
      : null
  const parentById = new Map<number, string>()
  for (const row of parents?.data ?? []) {
    if (row.id !== null && row.public_id !== null) parentById.set(row.id, row.public_id)
  }

  for (const row of commentRows) {
    if (row.id === null) continue
    const parent = row.post_id !== null ? parentById.get(row.post_id) : undefined
    out.set(`comment:${row.id}`, {
      publicId: row.public_id,
      title: null,
      body: row.body,
      href: parent && row.public_id ? `/p/${parent}#c-${row.public_id}` : null,
      isAnonymous: row.is_anonymous ?? false,
      authorHandle: row.author_handle,
      missing: false,
    })
  }

  for (const row of resources?.data ?? []) {
    if (row.id === null) continue
    out.set(`resource:${row.id}`, {
      publicId: row.public_id,
      title: row.title,
      body: row.description,
      href: row.public_id ? `/recursos/${row.public_id}` : null,
      isAnonymous: row.is_anonymous ?? false,
      authorHandle: row.author_handle,
      missing: false,
    })
  }

  for (const row of profiles?.data ?? []) {
    if (row.id === null) continue
    out.set(`profile:${row.id}`, {
      publicId: row.handle,
      title: row.handle,
      body: null,
      href: row.handle ? `/u/${row.handle}` : null,
      isAnonymous: false,
      authorHandle: row.handle,
      missing: false,
    })
  }

  return out
}

function snapshotExcerpt(target: TargetSnapshot, max: number): string {
  if (target.missing) return 'Contenido no disponible'
  const source = target.title ?? target.body ?? ''
  const text = excerpt(source, max)
  return text.length > 0 ? text : 'Sin texto'
}

/**
 * S1 — la cola (§11.4.1). Un ítem por objetivo, no por reporte: varios
 * denunciantes sobre la misma cosa colapsan en una fila cuya prioridad sube con
 * la cantidad (§11.3.3). Orden: categorías prioritarias, después cantidad de
 * reportes, después el más viejo primero.
 */
export async function getReportQueue(status?: ReportStatus): Promise<ReportQueueItem[]> {
  const supabase = await createClient()

  let query = supabase
    .from('reports')
    .select('id, categoria, status, created_at, post_id, comment_id, resource_id, profile_id')
    .order('created_at', { ascending: true })
    .limit(QUEUE_LIMIT)

  query = status ? query.eq('status', status) : query.in('status', ['abierto', 'en_revision'])

  const { data, error } = await query
  if (error || !data) return []

  type Group = {
    id: number
    kind: TargetKind
    targetKey: string
    categorias: Set<ReportCategoria>
    count: number
    status: ReportStatus
    createdAt: string
  }

  const groups = new Map<string, Group>()
  for (const row of data) {
    const target = targetKindOf(row)
    if (!target) continue
    if (!isReportCategoria(row.categoria) || !isReportStatus(row.status)) continue

    const existing = groups.get(target.key)
    if (existing) {
      existing.categorias.add(row.categoria)
      existing.count += 1
      continue
    }
    groups.set(target.key, {
      id: row.id,
      kind: target.kind,
      targetKey: target.key,
      categorias: new Set([row.categoria]),
      count: 1,
      status: row.status,
      createdAt: row.created_at,
    })
  }

  const list = [...groups.values()]
  const targets = await loadTargets(supabase, {
    posts: data.flatMap((row) => (row.post_id !== null ? [row.post_id] : [])),
    comments: data.flatMap((row) => (row.comment_id !== null ? [row.comment_id] : [])),
    resources: data.flatMap((row) => (row.resource_id !== null ? [row.resource_id] : [])),
    profiles: data.flatMap((row) => (row.profile_id !== null ? [row.profile_id] : [])),
  })

  const items: ReportQueueItem[] = list.map((group) => {
    const target = targets.get(group.targetKey) ?? MISSING_TARGET
    const categorias = [...group.categorias]
    return {
      id: group.id,
      targetKind: group.kind,
      targetPublicId: target.publicId,
      excerpt: snapshotExcerpt(target, QUEUE_EXCERPT),
      categorias,
      reportCount: group.count,
      status: group.status,
      createdAt: group.createdAt,
      priority: categorias.some((categoria) => CATEGORIAS_PRIORITARIAS.includes(categoria)),
    }
  })

  return items.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority ? -1 : 1
    if (a.reportCount !== b.reportCount) return b.reportCount - a.reportCount
    return a.createdAt.localeCompare(b.createdAt)
  })
}

/**
 * S2 — el detalle (§11.4.1): el reporte, todos sus hermanos sobre el mismo
 * objetivo, y el contenido tal como lo ven los usuarios. El bloque de autor de
 * contenido anónimo llega vacío a propósito: se destapa con "Ver autor", que es
 * una acción auditada, no una lectura (§11.4.2).
 */
export async function getReportDetail(id: number): Promise<ReportDetail | null> {
  if (!Number.isInteger(id) || id <= 0) return null

  const supabase = await createClient()

  const { data: report, error } = await supabase
    .from('reports')
    .select(
      'id, categoria, detalle, status, created_at, post_id, comment_id, resource_id, profile_id',
    )
    .eq('id', id)
    .maybeSingle()

  if (error || !report) return null

  const target = targetKindOf(report)
  if (!target || !isReportStatus(report.status)) return null

  // Hermanos: mismo objetivo, cualquier estado. Sin `reporter_id` (§11.4.1).
  let siblings = supabase
    .from('reports')
    .select('id, categoria, detalle, status, created_at')
    .order('created_at', { ascending: true })

  if (report.post_id !== null) siblings = siblings.eq('post_id', report.post_id)
  else if (report.comment_id !== null) siblings = siblings.eq('comment_id', report.comment_id)
  else if (report.resource_id !== null) siblings = siblings.eq('resource_id', report.resource_id)
  else if (report.profile_id !== null) siblings = siblings.eq('profile_id', report.profile_id)

  const [siblingRows, targets] = await Promise.all([
    siblings,
    loadTargets(supabase, {
      posts: report.post_id !== null ? [report.post_id] : [],
      comments: report.comment_id !== null ? [report.comment_id] : [],
      resources: report.resource_id !== null ? [report.resource_id] : [],
      profiles: report.profile_id !== null ? [report.profile_id] : [],
    }),
  ])

  const snapshot = targets.get(target.key) ?? MISSING_TARGET

  const reports = (siblingRows.data ?? []).flatMap((row) => {
    if (!isReportCategoria(row.categoria) || !isReportStatus(row.status)) return []
    return [
      {
        id: row.id,
        categoria: row.categoria,
        detalle: row.detalle,
        status: row.status,
        createdAt: row.created_at,
      },
    ]
  })

  return {
    id: report.id,
    targetKind: target.kind,
    targetPublicId: snapshot.publicId,
    status: report.status,
    createdAt: report.created_at,
    target: {
      title: snapshot.title,
      body: snapshot.body,
      href: snapshot.href,
      isAnonymous: snapshot.isAnonymous,
      authorHandle: snapshot.isAnonymous ? null : snapshot.authorHandle,
      missing: snapshot.missing,
    },
    reports,
  }
}

/**
 * Apelaciones, con la acción original al lado. Se leen en dos consultas en vez de
 * un embed para que el tipado no dependa de cómo PostgREST infiera la relación.
 */
export async function listAppeals(
  status?: 'pendiente' | 'aceptada' | 'rechazada',
): Promise<AppealItem[]> {
  const supabase = await createClient()

  let query = supabase
    .from('appeals')
    .select('id, body, status, created_at, mod_action_id')
    .order('created_at', { ascending: true })
    .limit(QUEUE_LIMIT)

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error || !data || data.length === 0) return []

  const actionIds = [...new Set(data.map((row) => row.mod_action_id))]
  const { data: actions } = await supabase
    .from('mod_actions')
    .select('id, action, target_kind, target_public_id, motivo_publico, created_at')
    .in('id', actionIds)

  const actionById = new Map((actions ?? []).map((row) => [row.id, row]))

  const items: AppealItem[] = []
  for (const row of data) {
    const action = actionById.get(row.mod_action_id)
    if (!action) continue
    if (row.status !== 'pendiente' && row.status !== 'aceptada' && row.status !== 'rechazada') {
      continue
    }
    items.push({
      id: row.id,
      body: row.body,
      status: row.status,
      createdAt: row.created_at,
      modActionId: row.mod_action_id,
      action: action.action,
      targetKind: action.target_kind,
      targetPublicId: action.target_public_id,
      motivoPublico: action.motivo_publico,
      actionCreatedAt: action.created_at,
    })
  }
  return items
}

/**
 * Restricciones vigentes (`/mod/restricciones`, §17.4.10). Activa =
 * `revoked_at is null` y (`until is null` o `until > now`), el mismo predicado
 * que centraliza `has_active_restriction()` en la base.
 */
export async function listRestrictions(): Promise<RestrictionItem[]> {
  const supabase = await createClient()
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('user_restrictions')
    .select('id, user_id, tipo, motivo, starts_at, until, created_at')
    .is('revoked_at', null)
    .or(`until.is.null,until.gt."${now}"`)
    .order('created_at', { ascending: false })
    .limit(QUEUE_LIMIT)

  if (error || !data) return []

  const userIds = [...new Set(data.map((row) => row.user_id))]
  const { data: profiles } =
    userIds.length > 0
      ? await supabase.from('profiles_public').select('id, handle').in('id', userIds)
      : { data: null }

  const handleById = new Map<string, string>()
  for (const row of profiles ?? []) {
    if (row.id !== null && row.handle !== null) handleById.set(row.id, row.handle)
  }

  return data.map((row) => ({
    id: row.id,
    handle: handleById.get(row.user_id) ?? null,
    tipo: row.tipo,
    motivo: row.motivo,
    startsAt: row.starts_at,
    until: row.until,
    createdAt: row.created_at,
  }))
}

/**
 * S3 — historial de una cuenta (§11.4.1). Devuelve las acciones que apuntan al
 * perfil: sanciones de cuenta y cierres cuyo objetivo es el perfil. Las remociones
 * de contenido de esa persona NO se pueden listar acá: el vínculo contenido→autor
 * vive en `posts.author_id`, que el panel no puede leer por diseño (D14.5), y
 * atarlo requeriría una revelación auditada por pieza (§11.4.2).
 */
export async function getModActionsForUser(handle: string): Promise<ModActionItem[]> {
  const clean = handle.trim()
  if (!HANDLE_PATTERN.test(clean)) return []

  const supabase = await createClient()

  // `ilike` y no `eq`: `profiles_public` emite `handle::text` y sobre text la
  // comparación distingue mayúsculas, aunque la columna de la base sea citext
  // (lib/utils/handle.ts). Con `eq`, buscar "MateConBizcochos" en el panel no
  // encontraba el perfil y el historial salía a medias.
  const { data: profile } = await supabase
    .from('profiles_public')
    .select('id')
    .ilike('handle', handlePattern(clean))
    .maybeSingle()

  const filters = [`and(target_kind.eq.profile,target_public_id.eq.${clean})`]
  if (profile?.id) filters.unshift(`profile_id.eq.${profile.id}`)

  const { data, error } = await supabase
    .from('mod_actions')
    .select('id, action, target_kind, target_public_id, motivo_publico, notas_internas, created_at')
    .or(filters.join(','))
    .order('created_at', { ascending: false })
    .limit(QUEUE_LIMIT)

  if (error || !data) return []

  return data.map((row) => ({
    id: row.id,
    action: row.action,
    targetKind: row.target_kind,
    targetPublicId: row.target_public_id,
    motivoPublico: row.motivo_publico,
    notasInternas: row.notas_internas,
    createdAt: row.created_at,
  }))
}
