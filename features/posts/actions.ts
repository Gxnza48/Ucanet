'use server'

import 'server-only'

/**
 * features/posts/actions.ts — escrituras de publicaciones, comentarios y votos.
 *
 * Las cinco etapas obligatorias de BUILD-CONTRACT §4.6, en orden, en todas:
 *   1. `schema.safeParse` (nunca se confía en lo que mandó el formulario);
 *   2. leer la sesión del servidor;
 *   3. UNA sola RPC — toda la lógica de permisos, límites de tasa y contadores
 *      vive dentro de la función SECURITY DEFINER, en la misma transacción;
 *   4. invalidar las etiquetas de caché;
 *   5. devolver `ok()` / `fail(rpcErrorMessage(error))`.
 *
 * Acá no hay SQL. Las lecturas auxiliares que sí aparecen (resolver el id interno
 * de una publicación, mirar si quedó una fila de voto) no son la escritura: son
 * consultas indexadas contra las vistas públicas y las tablas de votos, que hacen
 * falta porque las RPC de voto devuelven el score nuevo pero no si el voto quedó
 * puesto o sacado — y el contrato de `togglePostVote` pide las dos cosas.
 *
 * Caché: se usa `updateTag` y no `revalidateTag`. En Next 16 `revalidateTag`
 * pasó a pedir un segundo argumento (perfil de `cacheLife`) y expira de forma
 * diferida; `updateTag` es la API de "leé lo que acabás de escribir" dentro de
 * una Server Action, que es exactamente lo que necesita el botón de voto
 * optimista para reconciliar. El vocabulario de etiquetas es el del contrato:
 * `post:<publicId>` y `materia:<slug>`.
 */
import { updateTag } from 'next/cache'
import { GENERIC_ERROR, messageForCode, rpcErrorMessage } from '@/lib/errors'
import { fail, ok, type ActionResult } from '@/lib/result'
import { createClient, getUser } from '@/lib/supabase/server'
import {
  createCommentSchema,
  createPostSchema,
  deleteCommentSchema,
  deletePostSchema,
  publicIdSchema,
  updateCommentSchema,
  updatePostSchema,
} from './schemas'
import type { z } from 'zod'

/** Estado previo de `useActionState`: no se lee nunca, pero define la firma. */
type PrevState<T = undefined> = ActionResult<T> | null

type VoteResult = { score: number; voted: boolean }

// ---------------------------------------------------------------------------
// Publicaciones
// ---------------------------------------------------------------------------

export async function createPost(
  _prev: PrevState<{ publicId: string }>,
  formData: FormData,
): Promise<ActionResult<{ publicId: string }>> {
  const parsed = createPostSchema.safeParse({
    body: field(formData, 'body'),
    title: field(formData, 'title'),
    materiaSlug: field(formData, 'materiaSlug'),
    kind: field(formData, 'kind') ?? 'texto',
    anonymous: field(formData, 'anonymous'),
  })
  if (!parsed.success) return failFromIssues(parsed.error)

  const user = await getUser()
  if (!user) return fail(messageForCode('NOT_AUTHENTICATED'))

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_post', {
    p_body: parsed.data.body,
    p_title: parsed.data.title,
    p_materia_slug: parsed.data.materiaSlug,
    p_kind: parsed.data.kind,
    p_anonymous: parsed.data.anonymous,
  })

  if (error) return fail(rpcErrorMessage(error))
  if (!data) return fail(GENERIC_ERROR)

  updateTag(`post:${data}`)
  if (parsed.data.materiaSlug) updateTag(`materia:${parsed.data.materiaSlug}`)

  return ok({ publicId: data })
}

export async function updatePost(
  _prev: PrevState,
  formData: FormData,
): Promise<ActionResult<undefined>> {
  const parsed = updatePostSchema.safeParse({
    publicId: field(formData, 'publicId'),
    body: field(formData, 'body'),
    title: field(formData, 'title'),
    materiaSlug: field(formData, 'materiaSlug'),
  })
  if (!parsed.success) return failFromIssues(parsed.error)

  const user = await getUser()
  if (!user) return fail(messageForCode('NOT_AUTHENTICATED'))

  const supabase = await createClient()
  const { error } = await supabase.rpc('update_own_post', {
    p_public_id: parsed.data.publicId,
    p_body: parsed.data.body,
    p_title: parsed.data.title,
  })

  if (error) return fail(rpcErrorMessage(error))

  updateTag(`post:${parsed.data.publicId}`)
  if (parsed.data.materiaSlug) updateTag(`materia:${parsed.data.materiaSlug}`)

  return ok()
}

/**
 * Borrado blando: la fila sobrevive con el cuerpo vaciado para que el hilo
 * conserve su estructura (§8.7). La URL pasa a renderizar un tombstone HTTP 410,
 * así que quien borra tiene que salir de la página — de eso se encarga el
 * componente, que navega cuando esto devuelve `ok()`.
 */
export async function deletePost(
  _prev: PrevState,
  formData: FormData,
): Promise<ActionResult<undefined>> {
  const parsed = deletePostSchema.safeParse({
    publicId: field(formData, 'publicId'),
    materiaSlug: field(formData, 'materiaSlug'),
  })
  if (!parsed.success) return failFromIssues(parsed.error)

  const user = await getUser()
  if (!user) return fail(messageForCode('NOT_AUTHENTICATED'))

  const supabase = await createClient()
  const { error } = await supabase.rpc('delete_own_post', {
    p_public_id: parsed.data.publicId,
  })

  if (error) return fail(rpcErrorMessage(error))

  updateTag(`post:${parsed.data.publicId}`)
  if (parsed.data.materiaSlug) updateTag(`materia:${parsed.data.materiaSlug}`)

  return ok()
}

// ---------------------------------------------------------------------------
// Comentarios
// ---------------------------------------------------------------------------

export async function createComment(
  _prev: PrevState<{ publicId: string }>,
  formData: FormData,
): Promise<ActionResult<{ publicId: string }>> {
  const parsed = createCommentSchema.safeParse({
    postPublicId: field(formData, 'postPublicId'),
    parentPublicId: field(formData, 'parentPublicId'),
    body: field(formData, 'body'),
    anonymous: field(formData, 'anonymous'),
  })
  if (!parsed.success) return failFromIssues(parsed.error)

  const user = await getUser()
  if (!user) return fail(messageForCode('NOT_AUTHENTICATED'))

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_comment', {
    p_post_public_id: parsed.data.postPublicId,
    p_parent_public_id: parsed.data.parentPublicId,
    p_body: parsed.data.body,
    p_anonymous: parsed.data.anonymous,
  })

  if (error) return fail(rpcErrorMessage(error))
  if (!data) return fail(GENERIC_ERROR)

  updateTag(`post:${parsed.data.postPublicId}`)

  return ok({ publicId: data })
}

export async function updateComment(
  _prev: PrevState,
  formData: FormData,
): Promise<ActionResult<undefined>> {
  const parsed = updateCommentSchema.safeParse({
    publicId: field(formData, 'publicId'),
    postPublicId: field(formData, 'postPublicId'),
    body: field(formData, 'body'),
  })
  if (!parsed.success) return failFromIssues(parsed.error)

  const user = await getUser()
  if (!user) return fail(messageForCode('NOT_AUTHENTICATED'))

  const supabase = await createClient()
  const { error } = await supabase.rpc('update_own_comment', {
    p_public_id: parsed.data.publicId,
    p_body: parsed.data.body,
  })

  if (error) return fail(rpcErrorMessage(error))

  if (parsed.data.postPublicId) updateTag(`post:${parsed.data.postPublicId}`)

  return ok()
}

export async function deleteComment(
  _prev: PrevState,
  formData: FormData,
): Promise<ActionResult<undefined>> {
  const parsed = deleteCommentSchema.safeParse({
    publicId: field(formData, 'publicId'),
    postPublicId: field(formData, 'postPublicId'),
  })
  if (!parsed.success) return failFromIssues(parsed.error)

  const user = await getUser()
  if (!user) return fail(messageForCode('NOT_AUTHENTICATED'))

  const supabase = await createClient()
  const { error } = await supabase.rpc('delete_own_comment', {
    p_public_id: parsed.data.publicId,
  })

  if (error) return fail(rpcErrorMessage(error))

  if (parsed.data.postPublicId) updateTag(`post:${parsed.data.postPublicId}`)

  return ok()
}

// ---------------------------------------------------------------------------
// Votos (§0.5-R20: sólo en la página del post)
// ---------------------------------------------------------------------------

/**
 * `toggle_post_vote` devuelve el score nuevo, no el estado del voto. Para armar
 * el `{ score, voted }` del contrato hacen falta dos lecturas mínimas, y se
 * ordenan en dos tandas para no encadenar tres viajes:
 *   tanda 1 — resolver el id interno de la publicación, en paralelo con la RPC
 *             (la RPC no necesita el id: trabaja con el public_id);
 *   tanda 2 — mirar si quedó fila en `post_votes` (la respuesta autoritativa,
 *             ya sin carrera posible contra la propia transacción).
 */
export async function togglePostVote(publicId: string): Promise<ActionResult<VoteResult>> {
  const parsed = publicIdSchema.safeParse(publicId)
  if (!parsed.success) return fail(messageForCode('TARGET_NOT_FOUND'))

  const user = await getUser()
  if (!user) return fail(messageForCode('NOT_AUTHENTICATED'))

  const supabase = await createClient()

  const [post, voteRpc] = await Promise.all([
    supabase.from('posts_public').select('id').eq('public_id', parsed.data).maybeSingle(),
    supabase.rpc('toggle_post_vote', { p_public_id: parsed.data }),
  ])

  if (voteRpc.error) return fail(rpcErrorMessage(voteRpc.error))

  const postId = post.data?.id
  if (postId === null || postId === undefined) return fail(messageForCode('TARGET_NOT_FOUND'))

  const { data: vote } = await supabase
    .from('post_votes')
    .select('post_id')
    .eq('post_id', postId)
    .eq('user_id', user.id)
    .maybeSingle()

  updateTag(`post:${parsed.data}`)

  return ok({ score: voteRpc.data ?? 0, voted: vote !== null })
}

/**
 * Igual que el voto de publicación, con un salto más: desde el public_id de un
 * comentario no se llega al de su publicación sin pasar por el id interno del
 * post. Ese salto se paga porque sin invalidar `post:<publicId>` el score
 * optimista del botón volvería al valor viejo al terminar la transición.
 */
export async function toggleCommentVote(publicId: string): Promise<ActionResult<VoteResult>> {
  const parsed = publicIdSchema.safeParse(publicId)
  if (!parsed.success) return fail(messageForCode('TARGET_NOT_FOUND'))

  const user = await getUser()
  if (!user) return fail(messageForCode('NOT_AUTHENTICATED'))

  const supabase = await createClient()

  const [comment, voteRpc] = await Promise.all([
    supabase
      .from('comments_public')
      .select('id, post_id')
      .eq('public_id', parsed.data)
      .maybeSingle(),
    supabase.rpc('toggle_comment_vote', { p_public_id: parsed.data }),
  ])

  if (voteRpc.error) return fail(rpcErrorMessage(voteRpc.error))

  const commentId = comment.data?.id
  if (commentId === null || commentId === undefined) return fail(messageForCode('TARGET_NOT_FOUND'))

  const postId = comment.data?.post_id ?? null
  const [vote, post] = await Promise.all([
    supabase
      .from('comment_votes')
      .select('comment_id')
      .eq('comment_id', commentId)
      .eq('user_id', user.id)
      .maybeSingle(),
    postId === null
      ? Promise.resolve(null)
      : supabase.from('posts_public').select('public_id').eq('id', postId).maybeSingle(),
  ])

  const postPublicId = post?.data?.public_id
  if (postPublicId) updateTag(`post:${postPublicId}`)

  return ok({ score: voteRpc.data ?? 0, voted: vote.data !== null })
}

// ---------------------------------------------------------------------------
// Ayudas
// ---------------------------------------------------------------------------

/**
 * Un `FormData` puede traer un `File` en cualquier campo. Todo lo que no sea
 * texto se descarta acá y el esquema decide si eso es un error o un opcional
 * ausente.
 */
function field(formData: FormData, name: string): string | undefined {
  const value = formData.get(name)
  return typeof value === 'string' ? value : undefined
}

/**
 * El primer problema es el que se muestra: el contrato de `ActionResult` lleva un
 * mensaje, no una lista. `field` deja que el formulario marque el control
 * culpable (PART 17 §17.7).
 */
function failFromIssues<T>(error: z.ZodError): ActionResult<T> {
  const issue = error.issues[0]
  const path = issue?.path[0]
  const name = typeof path === 'string' ? path : undefined
  return fail<T>(issue?.message ?? GENERIC_ERROR, name)
}
