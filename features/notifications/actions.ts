'use server'

import 'server-only'

/**
 * features/notifications/actions.ts — la única escritura de avisos.
 *
 * `notifications` tiene un grant acotado a columna (`grant update (read_at)`,
 * migración 0009) más una política que exige `user_id = auth.uid()`: marcar como
 * leído es literalmente lo único que la aplicación puede escribir en esta tabla.
 * Ni el tipo, ni el actor, ni el contador de grupo son tocables desde el cliente,
 * y por eso esta escritura no necesita RPC (es la excepción que fija PART 8).
 *
 * De los cinco pasos de PART 20 §20.4, el primero (Zod) es vacío a propósito: la
 * acción no recibe entrada. El alcance no se toma del cliente sino de la sesión.
 */
import { revalidatePath } from 'next/cache'

import { rpcErrorMessage } from '@/lib/errors'
import { fail, ok, type ActionResult } from '@/lib/result'
import { createClient, getUser } from '@/lib/supabase/server'

export async function markAllRead(): Promise<ActionResult> {
  const user = await getUser()
  if (!user) return fail('Necesitás iniciar sesión.')

  const supabase = await createClient()
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('read_at', null)

  if (error) return fail(rpcErrorMessage(error))

  revalidatePath('/avisos')
  return ok()
}
