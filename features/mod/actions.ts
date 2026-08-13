'use server'

import 'server-only'

/**
 * features/mod/actions.ts — reportes, apelaciones y la escalera de moderación.
 *
 * Cada acción sigue los cinco pasos de PART 20 §20.4: Zod, sesión, **una sola**
 * RPC, revalidación, `ok()` / `fail(rpcErrorMessage(error))`. Ninguna contiene SQL:
 * todo el poder vive en las funciones SECURITY DEFINER de la migración 0012, que
 * vuelven a chequear rol, estado de la cuenta, límites y vocabulario cerrado. Si
 * alguien saltease esta capa entera, la base seguiría diciendo que no (D14.9).
 *
 * Toda acción de moderación escribe exactamente una fila en `mod_actions` — eso lo
 * hace la RPC, no este archivo — y notifica al afectado. La moderación de tu
 * contenido nunca es invisible para vos (D3).
 */
import { revalidatePath, updateTag } from 'next/cache'

import { trackEvent } from '@/lib/analytics'
import { GENERIC_ERROR, rpcErrorMessage } from '@/lib/errors'
import { fail, ok, type ActionResult } from '@/lib/result'
import { createClient, getProfile, getUser } from '@/lib/supabase/server'
import {
  appealSchema,
  createInviteSchema,
  formText,
  modContentActionSchema,
  modLegalTakedownSchema,
  modLockThreadSchema,
  modResolveReportSchema,
  modRestoreContentSchema,
  modRestrictUserSchema,
  modRevealAuthorSchema,
  modReviewAppealSchema,
  modRevokeRestrictionSchema,
  modWarnUserSchema,
  reportSchema,
} from './schemas'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Corta temprano cuando quien llama no es moderador. No reemplaza la guarda de la
 * base — la duplica para dar copy en castellano sin gastar una llamada a la RPC.
 */
async function assertMod(): Promise<string | null> {
  const profile = await getProfile()
  if (!profile) return 'Necesitás iniciar sesión.'
  if (profile.role !== 'mod' && profile.role !== 'admin') return 'No tenés permiso para hacer esto.'
  if (profile.status !== 'activo') return 'No tenés permiso para hacer esto.'
  return null
}

function firstIssue(error: { issues: Array<{ message: string }> }): string {
  return error.issues[0]?.message ?? GENERIC_ERROR
}

// ---------------------------------------------------------------------------
// Reportes y apelaciones — cualquier cuenta
// ---------------------------------------------------------------------------

/**
 * Alta de reporte (§11.3). El anonimato del denunciante frente al reportado es
 * total, pero el reporte SÍ queda atado a la cuenta internamente: el spam de
 * reportes es un vector de abuso que hay que poder limitar y auditar (§11.3.2).
 */
export async function createReport(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = reportSchema.safeParse({
    targetKind: formText(formData, 'targetKind'),
    targetPublicId: formText(formData, 'targetPublicId'),
    categoria: formText(formData, 'categoria'),
    detalle: formText(formData, 'detalle'),
  })
  if (!parsed.success) return fail(firstIssue(parsed.error))

  const user = await getUser()
  if (!user) return fail('Necesitás iniciar sesión para reportar.')

  const supabase = await createClient()
  const { error } = await supabase.rpc('create_report', {
    p_target_kind: parsed.data.targetKind,
    p_target_public_id: parsed.data.targetPublicId,
    p_categoria: parsed.data.categoria,
    p_detalle: parsed.data.detalle ?? undefined,
  })
  if (error) return fail(rpcErrorMessage(error))

  // §24.3 #12: contador agregado con la categoría como `dim`. Sin texto libre.
  await trackEvent('reporte_creado', parsed.data.categoria)

  revalidatePath('/mod')
  return ok()
}

/**
 * Apelación (§11.5.2): una por acción, dentro de los 30 días, y la revisa alguien
 * distinto del que decidió. Una cuenta suspendida o baneada puede apelar — la
 * restricción corta la participación, no el debido proceso.
 */
export async function createAppeal(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = appealSchema.safeParse({
    modActionId: formText(formData, 'modActionId'),
    body: formText(formData, 'body'),
  })
  if (!parsed.success) return fail(firstIssue(parsed.error))

  const user = await getUser()
  if (!user) return fail('Necesitás iniciar sesión para apelar.')

  const supabase = await createClient()
  const { error } = await supabase.rpc('create_appeal', {
    p_mod_action_id: parsed.data.modActionId,
    p_body: parsed.data.body,
  })
  if (error) return fail(rpcErrorMessage(error))

  revalidatePath('/apelacion')
  revalidatePath('/mod/apelaciones')
  return ok()
}

// ---------------------------------------------------------------------------
// Escalera de moderación — rol mod/admin
// ---------------------------------------------------------------------------

/** Remoción de contenido: el estado pasa a `eliminado_mod` y el cuerpo se oculta. */
export async function modRemoveContent(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = modContentActionSchema.safeParse({
    targetKind: formText(formData, 'targetKind'),
    publicId: formText(formData, 'publicId'),
    motivo: formText(formData, 'motivo'),
    notas: formText(formData, 'notas'),
  })
  if (!parsed.success) return fail(firstIssue(parsed.error))

  const denied = await assertMod()
  if (denied) return fail(denied)

  const { targetKind, publicId, motivo, notas } = parsed.data
  const supabase = await createClient()
  const args = { p_public_id: publicId, p_motivo: motivo, p_notas: notas ?? undefined }

  const { error } =
    targetKind === 'post'
      ? await supabase.rpc('mod_remove_post', args)
      : targetKind === 'comment'
        ? await supabase.rpc('mod_remove_comment', args)
        : await supabase.rpc('mod_remove_resource', args)

  if (error) return fail(rpcErrorMessage(error))

  revalidateRemoval(targetKind, publicId)
  return ok()
}

/** Restauración: la marcha atrás de una remoción (error propio o apelación aceptada). */
export async function modRestoreContent(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = modRestoreContentSchema.safeParse({
    targetKind: formText(formData, 'targetKind'),
    publicId: formText(formData, 'publicId'),
    motivo: formText(formData, 'motivo'),
    notas: formText(formData, 'notas'),
  })
  if (!parsed.success) return fail(firstIssue(parsed.error))

  const denied = await assertMod()
  if (denied) return fail(denied)

  const { targetKind, publicId, motivo, notas } = parsed.data
  const supabase = await createClient()
  const args = { p_public_id: publicId, p_motivo: motivo, p_notas: notas ?? undefined }

  const { error } =
    targetKind === 'post'
      ? await supabase.rpc('mod_restore_post', args)
      : targetKind === 'comment'
        ? await supabase.rpc('mod_restore_comment', args)
        : await supabase.rpc('mod_restore_resource', args)

  if (error) return fail(rpcErrorMessage(error))

  revalidateRemoval(targetKind, publicId)
  return ok()
}

/** Advertencia: sólo aviso, pero cuenta como strike en la escalera (§11.5.1). */
export async function modWarnUser(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = modWarnUserSchema.safeParse({
    handle: formText(formData, 'handle'),
    motivo: formText(formData, 'motivo'),
  })
  if (!parsed.success) return fail(firstIssue(parsed.error))

  const denied = await assertMod()
  if (denied) return fail(denied)

  const supabase = await createClient()
  const { error } = await supabase.rpc('mod_warn_user', {
    p_handle: parsed.data.handle,
    p_motivo: parsed.data.motivo,
  })
  if (error) return fail(rpcErrorMessage(error))

  revalidatePath(`/mod/usuarios/${parsed.data.handle}`)
  revalidatePath('/mod')
  return ok()
}

/**
 * Suspensión o inhabilitación. La duración no está en el nombre de la acción:
 * `until` futuro para una suspensión, `null` para un ban permanente (§11.5.1).
 */
export async function modRestrictUser(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = modRestrictUserSchema.safeParse({
    handle: formText(formData, 'handle'),
    tipo: formText(formData, 'tipo'),
    dias: formText(formData, 'dias'),
    motivo: formText(formData, 'motivo'),
  })
  if (!parsed.success) return fail(firstIssue(parsed.error))

  const denied = await assertMod()
  if (denied) return fail(denied)

  const { handle, tipo, dias, motivo } = parsed.data
  const until =
    tipo === 'suspension' && dias ? new Date(Date.now() + dias * DAY_MS).toISOString() : null

  const supabase = await createClient()
  const { error } = await supabase.rpc('mod_restrict_user', {
    p_handle: handle,
    p_tipo: tipo,
    // `types.gen.ts` tipa `p_until` como `string`, pero la función SQL lo declara
    // `timestamptz` sin default y exige NULL para un ban: el valor null es correcto
    // y la firma generada es la que se queda corta.
    p_until: until as string,
    p_motivo: motivo,
  })
  if (error) return fail(rpcErrorMessage(error))

  revalidatePath(`/mod/usuarios/${handle}`)
  revalidatePath('/mod/restricciones')
  return ok()
}

/** Levantar una restricción: no se borran, se revocan. */
export async function modRevokeRestriction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = modRevokeRestrictionSchema.safeParse({
    restrictionId: formText(formData, 'restrictionId'),
  })
  if (!parsed.success) return fail(firstIssue(parsed.error))

  const denied = await assertMod()
  if (denied) return fail(denied)

  const supabase = await createClient()
  const { error } = await supabase.rpc('mod_revoke_restriction', {
    p_restriction_id: parsed.data.restrictionId,
  })
  if (error) return fail(rpcErrorMessage(error))

  revalidatePath('/mod/restricciones')
  return ok()
}

/** Bloqueo de hilo (§11.6.4): el contenido queda, los comentarios nuevos no entran. */
export async function modLockThread(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = modLockThreadSchema.safeParse({
    publicId: formText(formData, 'publicId'),
    motivo: formText(formData, 'motivo'),
    notas: formText(formData, 'notas'),
  })
  if (!parsed.success) return fail(firstIssue(parsed.error))

  const denied = await assertMod()
  if (denied) return fail(denied)

  const supabase = await createClient()
  const { error } = await supabase.rpc('mod_lock_thread', {
    p_public_id: parsed.data.publicId,
    p_motivo: parsed.data.motivo,
    p_notas: parsed.data.notas ?? undefined,
  })
  if (error) return fail(rpcErrorMessage(error))

  updateTag(`post:${parsed.data.publicId}`)
  revalidatePath('/mod')
  return ok()
}

/**
 * "Ver autor" (§11.4.2): la única superficie donde el anonimato se levanta, y
 * sólo hacia adentro. La RPC escribe la fila `revelar_autor` ANTES de devolver el
 * handle — esa fila ES la auditoría, no hay tabla de revelaciones. El autor no
 * recibe aviso: un aviso le confirmaría al autor anónimo que lo miraron.
 */
export async function modRevealAuthor(
  _prev: ActionResult<{ handle: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ handle: string }>> {
  const parsed = modRevealAuthorSchema.safeParse({
    targetKind: formText(formData, 'targetKind'),
    publicId: formText(formData, 'publicId'),
    motivo: formText(formData, 'motivo'),
    notas: formText(formData, 'notas'),
  })
  if (!parsed.success) return fail(firstIssue(parsed.error))

  const denied = await assertMod()
  if (denied) return fail(denied)

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('mod_reveal_author', {
    p_target_kind: parsed.data.targetKind,
    p_target_public_id: parsed.data.publicId,
    p_motivo: parsed.data.motivo,
    p_notas: parsed.data.notas ?? undefined,
  })
  if (error) return fail(rpcErrorMessage(error))
  if (!data) return fail('No encontramos eso. Puede que se haya eliminado.')

  revalidatePath('/mod')
  return ok({ handle: data })
}

/** Cierre de un ítem de la cola. Termina siempre en un aviso al denunciante. */
export async function modResolveReport(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = modResolveReportSchema.safeParse({
    reportId: formText(formData, 'reportId'),
    resolution: formText(formData, 'resolution'),
  })
  if (!parsed.success) return fail(firstIssue(parsed.error))

  const denied = await assertMod()
  if (denied) return fail(denied)

  const supabase = await createClient()
  const { error } = await supabase.rpc('mod_resolve_report', {
    p_report_id: parsed.data.reportId,
    p_resolution: parsed.data.resolution,
  })
  if (error) return fail(rpcErrorMessage(error))

  revalidatePath('/mod')
  revalidatePath(`/mod/reportes/${parsed.data.reportId}`)
  return ok()
}

/**
 * Revisión de apelación. La RPC rechaza al actor original: una apelación que la
 * resuelve la misma persona es un segundo "no", no una revisión (§11.5.2). La
 * reversión material (restaurar, revocar) es una acción aparte y explícita.
 */
export async function modReviewAppeal(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = modReviewAppealSchema.safeParse({
    appealId: formText(formData, 'appealId'),
    resolucion: formText(formData, 'resolucion'),
  })
  if (!parsed.success) return fail(firstIssue(parsed.error))

  const denied = await assertMod()
  if (denied) return fail(denied)

  const supabase = await createClient()
  const { error } = await supabase.rpc('mod_review_appeal', {
    p_appeal_id: parsed.data.appealId,
    p_resolucion: parsed.data.resolucion,
  })
  if (error) return fail(rpcErrorMessage(error))

  revalidatePath('/mod/apelaciones')
  return ok()
}

/** Retiro legal de un recurso: la vía de la Ley 11.723 (§11.7.2). Sólo recursos. */
export async function modLegalTakedown(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = modLegalTakedownSchema.safeParse({
    publicId: formText(formData, 'publicId'),
    motivo: formText(formData, 'motivo'),
    notas: formText(formData, 'notas'),
  })
  if (!parsed.success) return fail(firstIssue(parsed.error))

  const denied = await assertMod()
  if (denied) return fail(denied)

  const supabase = await createClient()
  const { error } = await supabase.rpc('mod_legal_takedown_resource', {
    p_public_id: parsed.data.publicId,
    p_motivo: parsed.data.motivo,
    p_notas: parsed.data.notas ?? undefined,
  })
  if (error) return fail(rpcErrorMessage(error))

  updateTag(`recurso:${parsed.data.publicId}`)
  revalidatePath('/recursos')
  revalidatePath('/mod')
  return ok()
}

/** Alta de un código de invitación (mod/admin en el MVP, D3). */
export async function createInvite(
  _prev: ActionResult<{ code: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ code: string }>> {
  const parsed = createInviteSchema.safeParse({
    maxUses: formText(formData, 'maxUses') ?? '10',
    expiresAt: formText(formData, 'expiresAt'),
    note: formText(formData, 'note'),
  })
  if (!parsed.success) return fail(firstIssue(parsed.error))

  const denied = await assertMod()
  if (denied) return fail(denied)

  // `expiresAt` llega como fecha de un <input type="date">: se manda como ISO o no
  // se manda. Una fecha inválida es entrada inválida, no una invitación eterna.
  let expiresAt: string | undefined
  if (parsed.data.expiresAt) {
    const parsedDate = new Date(parsed.data.expiresAt)
    if (Number.isNaN(parsedDate.getTime())) return fail('Revisá la fecha de vencimiento.')
    expiresAt = parsedDate.toISOString()
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_invite', {
    p_max_uses: parsed.data.maxUses,
    p_expires_at: expiresAt,
    p_note: parsed.data.note ?? undefined,
  })
  if (error) return fail(rpcErrorMessage(error))
  if (!data) return fail(GENERIC_ERROR)

  revalidatePath('/mod')
  return ok({ code: data })
}

/**
 * Revalidación de una remoción o restauración. El comentario no tiene etiqueta de
 * caché propia (el vocabulario de PART 20 es `post:` / `recurso:`), así que su
 * página vuelve por el ISR de la publicación.
 */
function revalidateRemoval(targetKind: 'post' | 'comment' | 'resource', publicId: string): void {
  if (targetKind === 'post') {
    updateTag(`post:${publicId}`)
    revalidatePath('/reciente')
  } else if (targetKind === 'resource') {
    updateTag(`recurso:${publicId}`)
    revalidatePath('/recursos')
  }
  revalidatePath('/mod')
}
