import 'server-only'

/**
 * features/posts/queries.ts — lecturas de publicaciones y comentarios.
 *
 * Todo sale de `posts_public` y `comments_public` (BUILD-CONTRACT §7.2). Las
 * tablas base no tienen SELECT para ningún rol de la aplicación, así que ni por
 * error se puede leer `author_id` desde acá: la anonimidad la hace cumplir la
 * base, no este archivo (PART 8 §8.4).
 *
 * Sobre el `id` interno: las vistas lo exponen a propósito para joins del lado
 * del servidor (§8.4, D14.7) y los tipos de acá lo conservan porque
 * `getComments(postId)` y `getViewerPostVotes(ids)` lo necesitan. NUNCA se
 * serializa al navegador: los Client Components de esta feature reciben
 * `publicId`, jamás el objeto entero.
 *
 * Nulabilidad: `supabase gen types` marca TODAS las columnas de una vista como
 * `| null` porque Postgres no propaga NOT NULL a las vistas (ver el encabezado de
 * lib/types.gen.ts). Los mapeadores de este archivo son el lugar donde ese ruido
 * se estrecha: si falta un invariante (id, public_id, created_at) la fila se
 * descarta en vez de propagar nulls a la UI.
 *
 * Paginación: cursor keyset `created_at,id` en base64url (BUILD-CONTRACT §4.5),
 * nunca OFFSET — con OFFSET, insertar una publicación mientras alguien pagina le
 * repite filas.
 */
import { PAGE_SIZE } from '@/lib/config'
import { createClient, getUser } from '@/lib/supabase/server'
import { handlePattern } from '@/lib/utils/handle'
import type { ContentStatus, PostKind } from './schemas'

/** Materia o carrera de una publicación: lo mínimo para pintar el chip de alcance. */
export type PostScope = {
  slug: string
  nombre: string
}

/**
 * La fila del feed (PART 12 §12.5). `body` viene completo: el recorte a 120/160
 * caracteres es decisión de presentación y vive en `components/post-row.tsx`.
 */
export type PostListItem = {
  /** Id interno. Sólo servidor: no cruza al navegador (D14.7). */
  id: number
  publicId: string
  kind: PostKind
  title: string | null
  body: string | null
  /** Seudónimo del autor, o `null` si la publicación es anónima. */
  authorHandle: string | null
  isAnonymous: boolean
  materia: PostScope | null
  /** Carrera congelada al publicar (§0.5-R3): chip de alcance de los posts sin materia. */
  carrera: PostScope | null
  score: number
  commentsCount: number
  createdAt: string
  lastActivityAt: string
  editedAt: string | null
}

/** La publicación en su página (PART 17 §17.4.2). */
export type PostDetail = PostListItem & {
  /** Hilo bloqueado por moderación (§0.5-R5): el contenido queda, los comentarios nuevos no. */
  lockedAt: string | null
}

/** Un comentario del árbol. `replies` sólo se llena en profundidad 1 (D2). */
export type CommentNode = {
  /** Id interno. Sólo servidor. */
  id: number
  publicId: string
  parentId: number | null
  depth: number
  /** `null` cuando el comentario está eliminado: la lápida conserva la estructura, no las palabras. */
  body: string | null
  status: ContentStatus
  isAnonymous: boolean
  authorHandle: string | null
  /** Alias por hilo ("Anónimo 2"); 0 = autor de la publicación. */
  anonAliasNum: number | null
  score: number
  createdAt: string
  editedAt: string | null
  replies: CommentNode[]
}

export type ListOptions = {
  cursor?: string
  limit?: number
}

export type Page<T> = {
  items: T[]
  nextCursor: string | null
}

// Una sola cadena literal por lista, sin concatenar: supabase-js infiere el tipo
// de la fila parseando ESTE literal en tiempo de compilación. Partido en dos
// trozos, el tipo degrada a `GenericStringError` y se pierde el tipado entero.
const POST_COLUMNS =
  'id, public_id, kind, title, body, is_anonymous, author_handle, score, comments_count, locked_at, created_at, edited_at, last_activity_at, materias(slug, nombre), carreras(slug, nombre)'

const COMMENT_COLUMNS =
  'id, public_id, parent_id, depth, body, status, is_anonymous, author_handle, anon_alias_num, score, created_at, edited_at'

// ---------------------------------------------------------------------------
// Publicaciones
// ---------------------------------------------------------------------------

/**
 * La publicación de `/p/[publicId]`. Devuelve `null` tanto si el id no existe
 * como si la publicación fue eliminada: `posts_public` filtra `status = 'activo'`,
 * así que las dos situaciones son indistinguibles desde acá. La página resuelve
 * esa ambigüedad con un tombstone HTTP 410 (§0.5-R23c), no con un 404.
 */
export async function getPost(publicId: string): Promise<PostDetail | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('posts_public')
    .select(POST_COLUMNS)
    .eq('public_id', publicId)
    .maybeSingle()

  if (error || !data) return null

  const item = toPostListItem(data)
  if (!item) return null

  return { ...item, lockedAt: data.locked_at }
}

/**
 * Publicaciones firmadas de un perfil (PART 17 §17.4.4). Las anónimas quedan
 * afuera solas, sin filtro explícito: `posts_public` anula `author_handle` cuando
 * `is_anonymous`, así que no hay handle contra el cual comparar. Eso es
 * deliberado — el listado de "mis anónimas" sería una fuga por encima del hombro.
 *
 * El handle llega de la URL (`/u/[handle]`), con la capitalización que haya
 * tipeado quien entró. La comparación va con `ilike` y no con `eq` porque la vista
 * emite `pr.handle::text` y sobre text PostgREST distingue mayúsculas, mientras que
 * la base las ignora (citext): ver `lib/utils/handle.ts`.
 */
export async function getPostsByAuthor(
  handle: string,
  opts: ListOptions = {},
): Promise<Page<PostListItem>> {
  const supabase = await createClient()
  const limit = normalizeLimit(opts.limit)

  let query = supabase
    .from('posts_public')
    .select(POST_COLUMNS)
    .ilike('author_handle', handlePattern(handle))
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1)

  const cursor = decodeCursor(opts.cursor)
  if (cursor) {
    // El timestamp va entre comillas: lleva `+`, `:` y `.`, que PostgREST lee como
    // sintaxis del filtro si van sueltos. Es la misma forma que usan feed, materias,
    // recursos y notifications.
    query = query.or(
      `created_at.lt."${cursor.createdAt}",and(created_at.eq."${cursor.createdAt}",id.lt.${cursor.id})`,
    )
  }

  const { data, error } = await query
  if (error || !data) return emptyPage()

  return paginate(data.map(toPostListItem).filter(isPresent), limit)
}

// ---------------------------------------------------------------------------
// Autoría propia
// ---------------------------------------------------------------------------

/**
 * ¿Esta publicación la escribió quien mira?
 *
 * No se puede responder comparando `authorHandle` contra el seudónimo del
 * visitante: en el contenido anónimo `posts_public` anula `author_handle` (D5),
 * así que esa comparación da `false` para el propio autor y le saca los botones
 * de editar y borrar — justo lo que C6 (Ley 25.326) trata como no negociable.
 *
 * La respuesta la da `is_own_content` (migración 0014), SECURITY DEFINER: mira
 * `posts.author_id`, que ninguna vista expone, y devuelve un booleano y nada
 * más. Sin sesión ni siquiera se llama: la respuesta es `false` por definición y
 * la RPC no está otorgada a `anon`.
 */
export async function isOwnPost(publicId: string): Promise<boolean> {
  return isOwnContent('post', publicId)
}

/**
 * Ídem para un comentario. Es una llamada por comentario, así que sirve para las
 * pantallas de UN comentario (edición, borrado, moderación puntual) y NO para
 * pintar el hilo: ahí sería una consulta por fila. El árbol de `/p/[publicId]`
 * sigue resolviendo la autoría por handle, con el límite conocido de que un
 * comentario anónimo no muestra sus acciones de autor.
 */
export async function isOwnComment(publicId: string): Promise<boolean> {
  return isOwnContent('comment', publicId)
}

/** Un error de la RPC se lee como "no sos el autor": nunca abre una acción de más. */
async function isOwnContent(kind: 'post' | 'comment', publicId: string): Promise<boolean> {
  const user = await getUser()
  if (!user) return false

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('is_own_content', {
    p_kind: kind,
    p_public_id: publicId,
  })

  return !error && data === true
}

// ---------------------------------------------------------------------------
// Comentarios
// ---------------------------------------------------------------------------

/**
 * El árbol de comentarios de una publicación, en dos consultas: una página de
 * comentarios de primer nivel y todas las respuestas de esa página. La
 * profundidad máxima es 2 (D2), así que no hay recursión que armar.
 *
 * Orden cronológico ascendente en los dos niveles (PART 17 §17.4.2): un archivo
 * comprensible le gana al orden por engagement (D1, permanencia). El cursor
 * pagina sólo el primer nivel; las respuestas viajan enteras con su padre, que es
 * lo que hace que una respuesta nunca aparezca huérfana.
 *
 * Las lápidas (`eliminado_autor` / `eliminado_mod`) vienen incluidas a propósito:
 * `comments_public` no las filtra porque el hilo tiene que seguir siendo
 * coherente y las respuestas de abajo conservan contexto.
 *
 * @param postId Id interno de la publicación (el `id` de `PostDetail`).
 */
export async function getComments(
  postId: number,
  opts: ListOptions = {},
): Promise<Page<CommentNode>> {
  const supabase = await createClient()
  const limit = normalizeLimit(opts.limit)

  let query = supabase
    .from('comments_public')
    .select(COMMENT_COLUMNS)
    .eq('post_id', postId)
    .is('parent_id', null)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(limit + 1)

  const cursor = decodeCursor(opts.cursor)
  if (cursor) {
    // Timestamp entrecomillado, igual que en `getPostsByAuthor` y en el resto de
    // las listas: sin comillas, el `+` del offset se interpreta como sintaxis.
    query = query.or(
      `created_at.gt."${cursor.createdAt}",and(created_at.eq."${cursor.createdAt}",id.gt.${cursor.id})`,
    )
  }

  const { data, error } = await query
  if (error || !data) return emptyPage()

  const page = paginate(data.map(toCommentNode).filter(isPresent), limit)
  if (page.items.length === 0) return page

  const parentIds = page.items.map((item) => item.id)
  const { data: replyRows } = await supabase
    .from('comments_public')
    .select(COMMENT_COLUMNS)
    .eq('post_id', postId)
    .in('parent_id', parentIds)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })

  if (!replyRows) return page

  const byParent = new Map<number, CommentNode[]>()
  for (const row of replyRows) {
    const reply = toCommentNode(row)
    if (!reply || reply.parentId === null) continue
    const bucket = byParent.get(reply.parentId)
    if (bucket) bucket.push(reply)
    else byParent.set(reply.parentId, [reply])
  }

  return {
    ...page,
    items: page.items.map((item) => ({ ...item, replies: byParent.get(item.id) ?? [] })),
  }
}

// ---------------------------------------------------------------------------
// Votos del visitante
// ---------------------------------------------------------------------------

/**
 * Qué publicaciones de este lote ya votó quien mira. La política
 * `post_votes_select_own` limita la lectura a las filas propias; el `eq(user_id)`
 * está igual porque es lo que hace que el índice de la clave primaria se use.
 *
 * Devuelve un Set vacío para visitantes sin sesión: sin voto no hay estado que
 * pintar, y la página sigue siendo pública (C16).
 */
export async function getViewerPostVotes(postIds: number[]): Promise<Set<number>> {
  if (postIds.length === 0) return new Set()

  const user = await getUser()
  if (!user) return new Set()

  const supabase = await createClient()
  const { data } = await supabase
    .from('post_votes')
    .select('post_id')
    .eq('user_id', user.id)
    .in('post_id', postIds)

  return new Set((data ?? []).map((row) => row.post_id))
}

/** Ídem `getViewerPostVotes`, para comentarios. */
export async function getViewerCommentVotes(commentIds: number[]): Promise<Set<number>> {
  if (commentIds.length === 0) return new Set()

  const user = await getUser()
  if (!user) return new Set()

  const supabase = await createClient()
  const { data } = await supabase
    .from('comment_votes')
    .select('comment_id')
    .eq('user_id', user.id)
    .in('comment_id', commentIds)

  return new Set((data ?? []).map((row) => row.comment_id))
}

// ---------------------------------------------------------------------------
// Mapeo de filas
// ---------------------------------------------------------------------------

type PostRow = {
  id: number | null
  public_id: string | null
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
  materias: { slug: string; nombre: string } | null
  carreras: { slug: string; nombre: string } | null
}

function toPostListItem(row: PostRow): PostListItem | null {
  const { id, public_id: publicId, created_at: createdAt } = row
  if (id === null || publicId === null || createdAt === null) return null

  return {
    id,
    publicId,
    kind: row.kind === 'pregunta' ? 'pregunta' : 'texto',
    title: row.title,
    body: row.body,
    authorHandle: row.author_handle,
    isAnonymous: row.is_anonymous ?? row.author_handle === null,
    materia: row.materias,
    carrera: row.carreras,
    score: row.score ?? 0,
    commentsCount: row.comments_count ?? 0,
    createdAt,
    lastActivityAt: row.last_activity_at ?? createdAt,
    editedAt: row.edited_at,
  }
}

type CommentRow = {
  id: number | null
  public_id: string | null
  parent_id: number | null
  depth: number | null
  body: string | null
  status: string | null
  is_anonymous: boolean | null
  author_handle: string | null
  anon_alias_num: number | null
  score: number | null
  created_at: string | null
  edited_at: string | null
}

function toCommentNode(row: CommentRow): CommentNode | null {
  const { id, public_id: publicId, created_at: createdAt } = row
  if (id === null || publicId === null || createdAt === null) return null

  return {
    id,
    publicId,
    parentId: row.parent_id,
    depth: row.depth === 2 ? 2 : 1,
    body: row.body,
    status: toContentStatus(row.status),
    isAnonymous: row.is_anonymous ?? false,
    authorHandle: row.author_handle,
    anonAliasNum: row.anon_alias_num,
    score: row.score ?? 0,
    createdAt,
    editedAt: row.edited_at,
    replies: [],
  }
}

/**
 * Un status desconocido se trata como eliminado por moderación, no como activo:
 * si algún día la migración agrega un estado, el peor error posible sería
 * renderizar como vivo un contenido que la base considera retirado.
 */
function toContentStatus(value: string | null): ContentStatus {
  if (value === 'activo') return 'activo'
  if (value === 'eliminado_autor') return 'eliminado_autor'
  return 'eliminado_mod'
}

// ---------------------------------------------------------------------------
// Paginación keyset
// ---------------------------------------------------------------------------

type Keyset = { createdAt: string; id: number }

function normalizeLimit(limit?: number): number {
  if (limit === undefined || !Number.isFinite(limit)) return PAGE_SIZE
  return Math.min(Math.max(Math.trunc(limit), 1), PAGE_SIZE)
}

function emptyPage<T>(): Page<T> {
  return { items: [], nextCursor: null }
}

/**
 * Se pide una fila de más para saber si hay página siguiente sin contar el total
 * (un COUNT sobre el feed es exactamente lo que §12.8 prohíbe). La fila extra se
 * descarta y su predecesora define el cursor.
 */
function paginate<T extends { id: number; createdAt: string }>(rows: T[], limit: number): Page<T> {
  const hasMore = rows.length > limit
  const items = hasMore ? rows.slice(0, limit) : rows
  const last = items[items.length - 1]

  return {
    items,
    nextCursor: hasMore && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null,
  }
}

function encodeCursor(keyset: Keyset): string {
  return toBase64Url(`${keyset.createdAt}|${keyset.id}`)
}

/** Un cursor manipulado devuelve `null` y la lista arranca desde el principio. */
function decodeCursor(cursor: string | undefined): Keyset | null {
  if (!cursor) return null

  const raw = fromBase64Url(cursor)
  if (raw === null) return null

  const separator = raw.lastIndexOf('|')
  if (separator <= 0) return null

  const createdAt = raw.slice(0, separator)
  const id = Number(raw.slice(separator + 1))
  if (!Number.isSafeInteger(id) || Number.isNaN(Date.parse(createdAt))) return null

  return { createdAt, id }
}

function toBase64Url(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value: string): string | null {
  try {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/')
    return atob(padded + '==='.slice((padded.length + 3) % 4))
  } catch {
    return null
  }
}

function isPresent<T>(value: T | null): value is T {
  return value !== null
}
