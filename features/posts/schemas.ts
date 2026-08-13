/**
 * features/posts/schemas.ts — validación de publicaciones y comentarios.
 *
 * Estos esquemas son la primera de las cinco etapas obligatorias de toda Server
 * Action (BUILD-CONTRACT §4.6). No sustituyen a la base: `create_post`,
 * `create_comment` y compañía vuelven a validar largos, profundidad y permisos
 * dentro de la transacción (PART 8 §8.5.3). Acá validamos para poder devolver
 * copy en es-AR sin gastar un viaje a Postgres, y para que el mensaje señale el
 * campo exacto.
 *
 * Los límites salen de `LIMITS` (lib/config.ts), que a su vez espeja los CHECK de
 * las migraciones. Si alguna vez difieren, manda la migración.
 *
 * Todo lo que entra viene de un `FormData`, así que:
 * - los checkboxes llegan como 'on' (tildado) o no llegan (destildado);
 * - los inputs de texto vacíos llegan como '' y no como `undefined`.
 * Ambas cosas se normalizan acá, no en cada action.
 */
import { z } from 'zod'
import { LIMITS } from '@/lib/config'
import { isPublicId } from '@/lib/utils/public-id'
import { isSlug } from '@/lib/utils/slug'

/** `posts.kind`: CHECK (kind in ('texto','pregunta')) de la migración 0005. */
export const POST_KINDS = ['texto', 'pregunta'] as const
export type PostKind = (typeof POST_KINDS)[number]

/** `comments.status` / `posts.status`: CHECK de la migración 0005. */
export const CONTENT_STATUSES = ['activo', 'eliminado_autor', 'eliminado_mod'] as const
export type ContentStatus = (typeof CONTENT_STATUSES)[number]

/**
 * Un checkbox de HTML no manda nada cuando está destildado: la ausencia ES el
 * `false`. `preprocess` convierte cualquier forma que llegue ('on', 'true', un
 * booleano ya armado, o nada) en un booleano de verdad.
 */
const checkboxBoolean = z.preprocess(
  (value) => value === 'on' || value === 'true' || value === true,
  z.boolean(),
)

/**
 * Identificador público de 10 caracteres (`^[a-z0-9]{10}$`, alfabeto de
 * `public.nanoid()`). Es lo único que viaja al navegador: los bigint internos no
 * salen nunca del servidor (D14.7).
 */
export const publicIdSchema = z
  .string()
  .trim()
  .refine(isPublicId, 'No encontramos eso. Puede que se haya eliminado.')

/** Slug de materia opcional; '' y ausente valen lo mismo. */
const optionalMateriaSlug = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === undefined || value === '' ? undefined : value))
  .refine((value) => value === undefined || isSlug(value), 'Elegí una materia de la lista.')

/** Public id opcional; '' y ausente valen lo mismo. */
const optionalPublicId = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === undefined || value === '' ? undefined : value))
  .refine(
    (value) => value === undefined || isPublicId(value),
    'No encontramos eso. Puede que se haya eliminado.',
  )

const postBody = z
  .string()
  .trim()
  .min(1, 'Escribí algo antes de publicar.')
  .max(LIMITS.postBody, 'La publicación no puede pasar de 10.000 caracteres.')

const postTitle = z
  .string()
  .trim()
  .max(LIMITS.postTitle, 'El título no puede pasar de 120 caracteres.')
  .optional()
  .transform((value) => (value === undefined || value === '' ? undefined : value))

const commentBody = z
  .string()
  .trim()
  .min(1, 'Escribí un comentario antes de enviarlo.')
  .max(LIMITS.commentBody, 'El comentario no puede pasar de 5.000 caracteres.')

/**
 * Composer de PART 17 §17.4.3. `kind` viaja como checkbox "Es una pregunta" con
 * value="pregunta": destildado no manda nada y cae en el default 'texto'.
 */
export const createPostSchema = z.object({
  body: postBody,
  title: postTitle,
  materiaSlug: optionalMateriaSlug,
  kind: z.enum(POST_KINDS, { error: 'Elegí un tipo de publicación válido.' }).default('texto'),
  anonymous: checkboxBoolean,
})
export type CreatePostInput = z.infer<typeof createPostSchema>

/**
 * Comentario de la página del post. `parentPublicId` ausente = comentario de
 * primer nivel; presente = respuesta (profundidad 2, el techo de D2).
 */
export const createCommentSchema = z.object({
  postPublicId: publicIdSchema,
  parentPublicId: optionalPublicId,
  body: commentBody,
  anonymous: checkboxBoolean,
})
export type CreateCommentInput = z.infer<typeof createCommentSchema>

/**
 * Edición dentro de la ventana de 24 h (`update_own_post` la vuelve a chequear).
 * `materiaSlug` no se puede cambiar al editar: viaja sólo para saber qué etiqueta
 * de caché invalidar, porque la RPC no devuelve la materia.
 */
export const updatePostSchema = z.object({
  publicId: publicIdSchema,
  body: postBody,
  title: postTitle,
  materiaSlug: optionalMateriaSlug,
})
export type UpdatePostInput = z.infer<typeof updatePostSchema>

/**
 * Edición dentro de la ventana de 1 h. `postPublicId` viaja sólo para la etiqueta
 * de caché `post:<publicId>`: desde un comentario no hay forma de llegar al
 * public_id de su publicación sin dos consultas más.
 */
export const updateCommentSchema = z.object({
  publicId: publicIdSchema,
  postPublicId: optionalPublicId,
  body: commentBody,
})
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>

/** Borrado blando de una publicación propia (`delete_own_post`). */
export const deletePostSchema = z.object({
  publicId: publicIdSchema,
  materiaSlug: optionalMateriaSlug,
})
export type DeletePostInput = z.infer<typeof deletePostSchema>

/** Borrado blando de un comentario propio (`delete_own_comment`). */
export const deleteCommentSchema = z.object({
  publicId: publicIdSchema,
  postPublicId: optionalPublicId,
})
export type DeleteCommentInput = z.infer<typeof deleteCommentSchema>
