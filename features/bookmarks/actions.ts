'use server'

import 'server-only'

/**
 * features/bookmarks/actions.ts — guardar y quitar de guardados.
 *
 * ESCRIBE DIRECTO EN LA TABLA. `bookmarks` es escribible por política, igual que
 * `materia_follows` (§8.3.4): un marcador es una fila, idempotente, sin contadores
 * cacheados, sin dimensión de anonimato y sin límite de tasa que justifique una función
 * `security definer`. Las políticas exigen `user_id = auth.uid()`, así que la autorización
 * la aplica la base: si alguien mandara el id de otra persona, la fila no entraría. Acá no
 * hay SQL, hay una escritura tipada guardada por política.
 *
 * Los cinco pasos obligatorios de BUILD-CONTRACT §4.6, en orden: Zod primero, sesión
 * después, una sola escritura, invalidación al final, y recién ahí el `ActionResult`.
 *
 * Sobre los tipos: `lib/types.gen.ts` todavía no declara `bookmarks` (la migración se
 * escribe en paralelo). Este archivo suma el delta al `Database` real en vez de castear a
 * `any`, para que el resto de la consulta —`posts_public` incluida— siga tipada de verdad.
 * Cuando el tipo generado incorpore la tabla, se borran el bloque `BookmarksSchema` y el
 * cast; el `Omit<…>` de la intersección hace que el archivo compile igual antes y después.
 * Es el mismo delta que declara `queries.ts`, duplicado a propósito: son doce líneas
 * temporales y así cada archivo se puede borrar solo.
 *
 * Por qué NO hay `trackEvent`: el catálogo de PART 24 §24.3 es una allowlist cerrada y no
 * tiene un evento de guardado. Agregarlo es migración nueva más entrada en
 * `docs/decisions.md` (D14.8), no una línea suelta acá.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { GENERIC_ERROR, messageForCode, rpcErrorMessage } from '@/lib/errors'
import { fail, ok, type ActionResult } from '@/lib/result'
import { createClient, getUser } from '@/lib/supabase/server'
import type { Database } from '@/lib/types.gen'
import { isPublicId } from '@/lib/utils/public-id'

// ---------------------------------------------------------------------------------------
// El delta de esquema que `lib/types.gen.ts` todavía no tiene (ver el encabezado)
// ---------------------------------------------------------------------------------------

type BookmarksSchema = {
  public: Omit<Database['public'], 'Tables'> & {
    Tables: Omit<Database['public']['Tables'], 'bookmarks'> & {
      bookmarks: {
        Row: { user_id: string; post_id: number; created_at: string }
        Insert: { user_id: string; post_id: number; created_at?: string }
        Update: { user_id?: string; post_id?: number; created_at?: string }
        Relationships: []
      }
    }
  }
}

async function createBookmarksClient(): Promise<SupabaseClient<BookmarksSchema>> {
  return (await createClient()) as unknown as SupabaseClient<BookmarksSchema>
}

// ---------------------------------------------------------------------------------------

/**
 * Identificador público de 10 caracteres. Lo valida Zod aunque el botón lo haya recibido
 * del servidor: el cliente puede mandar cualquier cosa y eso tiene que morir acá.
 */
const toggleBookmarkSchema = z
  .string()
  .trim()
  .refine(isPublicId, 'No encontramos eso. Puede que se haya eliminado.')

/** Código de Postgres para violación de unicidad: guardar dos veces es un no-op, no un error. */
const UNIQUE_VIOLATION = '23505'

/**
 * Guardar o quitar de guardados. Devuelve el estado resultante para que el botón
 * reconcilie su actualización optimista con el servidor.
 *
 * No es un toggle ciego: primero lee si la fila propia existe y después inserta o borra.
 * Leer antes cuesta un viaje más y hace que dos toques rápidos converjan al mismo estado
 * en vez de alternar según cuál llegue primero.
 *
 * La publicación se resuelve por `posts_public` y no por `posts`: es la vista pública
 * (D14.2), ya filtra `status = 'activo'` y no expone `author_id`. Consecuencia buscada —
 * una publicación eliminada o removida por moderación no se puede guardar, y responde lo
 * mismo que una que nunca existió.
 */
export async function toggleBookmark(
  publicId: string,
): Promise<ActionResult<{ guardado: boolean }>> {
  // 1. Zod primero, siempre, pase lo que pase del lado del cliente.
  const parsed = toggleBookmarkSchema.safeParse(publicId)
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? GENERIC_ERROR)
  }

  // 2. La sesión sale del servidor. Nunca del formulario.
  const user = await getUser()
  if (!user) return fail(messageForCode('NOT_AUTHENTICATED'))

  const supabase = await createBookmarksClient()

  const { data: post, error: postError } = await supabase
    .from('posts_public')
    .select('id')
    .eq('public_id', parsed.data)
    .maybeSingle()

  if (postError) return fail(rpcErrorMessage(postError))
  if (!post || post.id === null) return fail('No encontramos eso. Puede que se haya eliminado.')

  const postId = post.id

  const { data: existente, error: readError } = await supabase
    .from('bookmarks')
    .select('post_id')
    .eq('user_id', user.id)
    .eq('post_id', postId)
    .maybeSingle()

  if (readError) return fail(rpcErrorMessage(readError))

  const guardado = existente === null

  // 3. Exactamente una escritura, guardada por política.
  if (guardado) {
    const { error } = await supabase.from('bookmarks').insert({ user_id: user.id, post_id: postId })

    // Una carrera entre dos toques deja la fila puesta: es el estado que se pedía.
    if (error && error.code !== UNIQUE_VIOLATION) return fail(rpcErrorMessage(error))
  } else {
    // El `user_id` es redundante bajo la política de borrado, que ya exige `auth.uid()`.
    // Va igual: deja el DELETE acotado por sí mismo y no por lo que la política haga hoy.
    const { error } = await supabase
      .from('bookmarks')
      .delete()
      .eq('user_id', user.id)
      .eq('post_id', postId)

    if (error) return fail(rpcErrorMessage(error))
  }

  // 4. Invalidación, después de que la escritura commiteó.
  //    Solo `/guardados`: es la única superficie del sitio que lista marcadores. La página
  //    de la publicación no necesita revalidarse — su botón es optimista y reconcilia con
  //    el `{ guardado }` que devuelve esta misma acción.
  revalidatePath('/guardados')

  // 5. El estado autoritativo para el cliente.
  return ok({ guardado })
}
