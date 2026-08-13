'use server'

import 'server-only'

/**
 * features/materias/actions.ts — seguir y dejar de seguir una materia (PART 8 §8.3.4).
 *
 * ESCRIBE DIRECTO EN LA TABLA, y es la única acción del producto que lo hace. `materia_follows`
 * es la única tabla escribible por política de todo el esquema (§8.3.4) porque un follow es una
 * fila, idempotente, sin contadores cacheados, sin dimensión de anonimato y sin sensibilidad a
 * límites de tasa que justifique una función `security definer`. Las políticas
 * `materia_follows_insert_own` y `materia_follows_delete_own` exigen `user_id = auth.uid()`, así
 * que la autorización la aplica la base: si alguien mandara el id de otra persona, la fila no
 * entraría. Acá no hay SQL, hay una escritura tipada guardada por política.
 *
 * Los cinco pasos obligatorios de BUILD-CONTRACT §4.6, en orden: Zod primero, sesión después,
 * una sola escritura, invalidación al final, y recién ahí el `ActionResult`.
 *
 * Sobre `updateTag` y no `revalidateTag`: en Next 16 `revalidateTag` pasa a exigir un segundo
 * argumento (perfil de `cacheLife`) y expira de forma diferida; `updateTag` es la API de "leé lo
 * que acabás de escribir" dentro de una Server Action, que es lo que necesita el botón optimista
 * para reconciliar contra el conteo de seguidores que acaba de cambiar. Es la misma decisión que
 * ya tomaron `features/posts/actions.ts` y `features/recursos/actions.ts`. El vocabulario de
 * etiquetas es el del contrato: `materia:<slug>`.
 */

import { revalidatePath, updateTag } from 'next/cache'
import { z } from 'zod'

import { trackEvent } from '@/lib/analytics'
import { GENERIC_ERROR, rpcErrorMessage } from '@/lib/errors'
import { fail, ok, type ActionResult } from '@/lib/result'
import { createClient, getUser } from '@/lib/supabase/server'

/**
 * El id interno viaja porque el botón lo recibe como prop desde el servidor (D14.7: es un
 * cruce explícito y acotado, no un payload de contenido). Igual se valida: el cliente puede
 * mandar cualquier cosa, y una materia inexistente tiene que morir acá y no en la base.
 */
const toggleFollowSchema = z.object({
  materiaId: z.number().int().positive('Esa materia no existe.'),
})

/** Código de Postgres para violación de unicidad: seguir dos veces es un no-op, no un error. */
const UNIQUE_VIOLATION = '23505'

/**
 * Seguir o dejar de seguir una materia. Devuelve el estado resultante para que el botón
 * reconcilie su actualización optimista con el servidor.
 *
 * No es un toggle ciego: primero lee si la fila propia existe (la política de select ya acota
 * la lectura al usuario) y después inserta o borra. Leer antes cuesta un viaje más y hace que
 * dos toques rápidos converjan al mismo estado en vez de alternar según cuál llegue primero.
 */
export async function toggleFollow(
  materiaId: number,
): Promise<ActionResult<{ following: boolean }>> {
  // 1. Zod primero, siempre, pase lo que pase del lado del cliente.
  const parsed = toggleFollowSchema.safeParse({ materiaId })
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? GENERIC_ERROR)
  }

  // 2. La sesión sale del servidor. Nunca del formulario.
  const user = await getUser()
  if (!user) return fail('Ingresá para seguir una materia.')

  const supabase = await createClient()

  // La materia tiene que existir y hace falta su slug para la etiqueta de caché. El catálogo
  // es público, así que esta lectura no depende de la sesión.
  const { data: materia, error: materiaError } = await supabase
    .from('materias')
    .select('id, slug')
    .eq('id', parsed.data.materiaId)
    .maybeSingle()

  if (materiaError) return fail(rpcErrorMessage(materiaError))
  if (!materia) return fail('Esa materia no existe.')

  const { data: existente, error: readError } = await supabase
    .from('materia_follows')
    .select('materia_id')
    .eq('materia_id', materia.id)
    .maybeSingle()

  if (readError) return fail(rpcErrorMessage(readError))

  const following = existente === null

  // 3. Exactamente una escritura, guardada por política.
  if (following) {
    const { error } = await supabase
      .from('materia_follows')
      .insert({ user_id: user.id, materia_id: materia.id })

    // Una carrera entre dos toques deja la fila puesta: es el estado que se pedía.
    if (error && error.code !== UNIQUE_VIOLATION) return fail(rpcErrorMessage(error))
  } else {
    const { error } = await supabase.from('materia_follows').delete().eq('materia_id', materia.id)

    if (error) return fail(rpcErrorMessage(error))
  }

  // 4. Invalidación, después de que la escritura commiteó.
  //    `materia:<slug>` corrige el conteo de seguidores de las dos pestañas de la materia;
  //    `/` porque el feed "Mis materias" y el riel de la home dependen de esta lista.
  updateTag(`materia:${materia.slug}`)
  revalidatePath('/')

  // PART 24 §24.3: solo el alta se cuenta. Un contador de "dejó de seguir" no cambiaría
  // ninguna decisión y `trackEvent` no lleva dimensión para este evento.
  if (following) await trackEvent('materia_seguida')

  // 5. El estado autoritativo para el cliente.
  return ok({ following })
}
