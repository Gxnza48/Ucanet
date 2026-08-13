import 'server-only'

/**
 * features/notifications/queries.ts — lecturas de `/avisos` (§0.5-R14, §17.4.7).
 *
 * `notifications` es la única tabla del lado del contenido que la aplicación lee
 * directo, sin RPC (migración 0009): la RLS acota cada fila a su destinatario y
 * `actor_display` ya viene congelado como etiqueta pública — el handle real de un
 * actor anónimo nunca entra en esta tabla, así que no hay nada que anonimizar acá.
 *
 * El texto de cada aviso se arma en el servidor a partir de `type`, `actor_display`
 * y `group_count`. Los ids internos no viajan: el destino de la fila se resuelve a
 * `public_id` contra las vistas `_public` (D14.7), y la paginación usa un cursor
 * keyset opaco sobre (created_at, id), nunca OFFSET (§12.4).
 */
import { PAGE_SIZE } from '@/lib/config'
import { decodeCursor, encodeCursor } from '@/lib/cursor'
import { createClient, getUser } from '@/lib/supabase/server'
import { excerpt, truncate } from '@/lib/utils/text'

/** Los cuatro tipos del MVP (CHECK de `notifications.type`, migración 0009). */
export type NotificationType =
  'respuesta_post' | 'respuesta_comentario' | 'decision_mod' | 'reporte_resuelto'

export type NotificationItem = {
  /**
   * Cursor keyset de esta fila. Hace de `key` de React y de punto de partida de la
   * página siguiente: el id bigint queda dentro del blob opaco, nunca suelto.
   */
  cursor: string
  type: NotificationType
  /** Etiqueta pública del actor: handle, "Anónimo 2" o "Moderación". */
  actorDisplay: string
  groupCount: number
  createdAt: string
  read: boolean
  /** Texto ya redactado en es-AR. */
  text: string
  /** Destino de la fila, o null cuando el aviso no lleva a ningún lado. */
  href: string | null
}

/**
 * Nombre del parámetro con el que `/avisos` enlaza a `/apelacion`. Vive acá como
 * cadena, no como import: una feature nunca importa otra (BUILD-CONTRACT §2). La
 * contraparte que lo lee es `features/mod` — si cambia, cambia en los dos lados.
 */
const APPEAL_PARAM = 'accion'

/**
 * El timestamp del cursor se interpola entre comillas dentro de un filtro `or` de
 * PostgREST. `decodeCursor` ya lo validó como fecha; esto descarta además cualquier
 * comilla o barra, que es lo único que podría romper el entrecomillado. Se usa el
 * valor crudo que devolvió PostgREST, sin re-serializar: `toISOString()` recorta a
 * milisegundos y `timestamptz` tiene microsegundos — truncar saltearía filas.
 */
function safeCursorTimestamp(value: string): string | null {
  return /["\\]/.test(value) ? null : value
}

function isNotificationType(value: string): value is NotificationType {
  return (
    value === 'respuesta_post' ||
    value === 'respuesta_comentario' ||
    value === 'decision_mod' ||
    value === 'reporte_resuelto'
  )
}

/** Rótulo corto de una publicación para el texto del aviso. */
function postLabel(title: string | null, body: string | null): string {
  const label = title ?? excerpt(body ?? '', 60)
  return truncate(label, 60)
}

function buildText(
  type: NotificationType,
  actorDisplay: string,
  groupCount: number,
  label: string | null,
): string {
  const target = label ? ` «${label}»` : ''
  // Agrupación (§0.5-R14): un evento nuevo sobre un aviso no leído incrementa el
  // contador en vez de insertar otra fila. Una publicación popular ocupa una fila,
  // no treinta.
  const actor = groupCount > 1 ? `${actorDisplay} y ${groupCount - 1} más` : actorDisplay
  const verbo = groupCount > 1 ? 'respondieron' : 'respondió'

  switch (type) {
    case 'respuesta_post':
      return `${actor} ${verbo} tu publicación${target}`
    case 'respuesta_comentario':
      return `${actor} ${verbo} tu comentario${label ? ` en${target}` : ''}`
    case 'decision_mod':
      return 'Moderación tomó una decisión sobre tu contenido. Podés apelarla.'
    case 'reporte_resuelto':
      return 'Tu reporte fue revisado. Gracias por avisar.'
  }
}

/**
 * Avisos del usuario, del más nuevo al más viejo. Los leídos siguen visibles
 * (grises): un aviso que desaparece al leerlo castiga al que mira (§17.4.7).
 */
export async function listNotifications(opts?: {
  cursor?: string
  limit?: number
}): Promise<{ items: NotificationItem[]; nextCursor: string | null }> {
  const user = await getUser()
  if (!user) return { items: [], nextCursor: null }

  const limit = Math.min(Math.max(opts?.limit ?? PAGE_SIZE, 1), PAGE_SIZE)
  const cursor = decodeCursor(opts?.cursor)

  const supabase = await createClient()

  let query = supabase
    .from('notifications')
    .select(
      'id, type, actor_display, group_count, read_at, created_at, post_id, comment_id, mod_action_id',
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1)

  // Comparación de tuplas (created_at, id): `created_at` solo no desempata dos
  // filas del mismo instante y se saltearía una (§12.4).
  const cursorTs = cursor ? safeCursorTimestamp(cursor.createdAt) : null
  if (cursor && cursorTs) {
    query = query.or(
      `created_at.lt."${cursorTs}",and(created_at.eq."${cursorTs}",id.lt.${cursor.id})`,
    )
  }

  const { data, error } = await query
  if (error || !data) return { items: [], nextCursor: null }

  const page = data.slice(0, limit)
  const last = data.length > limit ? page[page.length - 1] : undefined
  const nextCursor = last ? encodeCursor({ createdAt: last.created_at, id: last.id }) : null

  // Resolución de destinos contra las vistas públicas: de los ids internos sólo
  // salen `public_id` y el título. Una publicación removida no está en la vista,
  // así que su aviso queda sin enlace en vez de llevar a un 410.
  const postIds = [
    ...new Set(page.map((row) => row.post_id).filter((id): id is number => id !== null)),
  ]
  const commentIds = [
    ...new Set(page.map((row) => row.comment_id).filter((id): id is number => id !== null)),
  ]

  const [posts, comments] = await Promise.all([
    postIds.length > 0
      ? supabase.from('posts_public').select('id, public_id, title, body').in('id', postIds)
      : null,
    commentIds.length > 0
      ? supabase.from('comments_public').select('id, public_id').in('id', commentIds)
      : null,
  ])

  const postById = new Map<number, { publicId: string; label: string }>()
  for (const row of posts?.data ?? []) {
    if (row.id === null || row.public_id === null) continue
    postById.set(row.id, { publicId: row.public_id, label: postLabel(row.title, row.body) })
  }

  const commentById = new Map<number, string>()
  for (const row of comments?.data ?? []) {
    if (row.id === null || row.public_id === null) continue
    commentById.set(row.id, row.public_id)
  }

  const items: NotificationItem[] = []
  for (const row of page) {
    if (!isNotificationType(row.type)) continue

    const post = row.post_id !== null ? postById.get(row.post_id) : undefined
    const commentPublicId = row.comment_id !== null ? commentById.get(row.comment_id) : undefined

    let href: string | null = null
    if (row.type === 'respuesta_post' || row.type === 'respuesta_comentario') {
      href = post ? `/p/${post.publicId}${commentPublicId ? `#c-${commentPublicId}` : ''}` : null
    } else if (row.type === 'decision_mod' && row.mod_action_id !== null) {
      // La apelación se enlaza desde el aviso de la sanción (§11.5.2). `create_appeal`
      // recibe el id de la acción, así que el id viaja en la URL de /apelacion.
      href = `/apelacion?${APPEAL_PARAM}=${row.mod_action_id}`
    }

    items.push({
      cursor: encodeCursor({ createdAt: row.created_at, id: row.id }),
      type: row.type,
      actorDisplay: row.actor_display,
      groupCount: row.group_count,
      createdAt: row.created_at,
      read: row.read_at !== null,
      text: buildText(row.type, row.actor_display, row.group_count, post?.label ?? null),
      href,
    })
  }

  return { items, nextCursor }
}

/** Sin leer = `read_at is null`. Alimenta el badge del header (tope visual "9+"). */
export async function getUnreadCount(): Promise<number> {
  const user = await getUser()
  if (!user) return 0

  const supabase = await createClient()
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('read_at', null)

  if (error) return 0
  return count ?? 0
}
