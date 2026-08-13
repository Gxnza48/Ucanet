/**
 * features/mod/schemas.ts — el vocabulario cerrado de moderación, en Zod 4.
 *
 * Las doce categorías de reporte son las de PART 11 §11.3.1 **verbatim**, con sus
 * etiquetas en es-AR y el número de regla al que mapea cada una; el CHECK de
 * `reports.categoria` (migración 0008) lleva exactamente los mismos doce valores.
 * Las acciones son las de §11.5.1 y sus RPC están en la migración 0012.
 *
 * Todo lo que valida acá se vuelve a validar en la base: estos esquemas existen
 * para dar copy en castellano antes de gastar una llamada, no para reemplazar la
 * guarda del servidor (D14.4).
 */
import { z } from 'zod'

import { LIMITS } from '@/lib/config'

// ---------------------------------------------------------------------------
// Vocabulario
// ---------------------------------------------------------------------------

/** Objetivos posibles de un reporte o de una acción (`target_kind`). */
export const TARGET_KINDS = ['post', 'comment', 'resource', 'profile'] as const
export type TargetKind = (typeof TARGET_KINDS)[number]

/** Objetivos que son contenido: los que se pueden remover, restaurar o revelar. */
export const CONTENT_KINDS = ['post', 'comment', 'resource'] as const
export type ContentKind = (typeof CONTENT_KINDS)[number]

export const CONTENT_KIND_LABELS: Record<TargetKind, string> = {
  post: 'Publicación',
  comment: 'Comentario',
  resource: 'Recurso',
  profile: 'Perfil',
}

/** Las 12 categorías de PART 11 §11.3.1, en el orden en que se muestran. */
export const REPORT_CATEGORIA_VALUES = [
  'spam',
  'acoso',
  'amenazas',
  'datos_personales',
  'ataque_persona',
  'suplantacion',
  'contenido_ilegal',
  'compraventa',
  'infraccion_autor',
  'contenido_sexual',
  'manipulacion',
  'otro',
] as const
export type ReportCategoria = (typeof REPORT_CATEGORIA_VALUES)[number]

/** Etiquetas de UI (§11.3.1, columna "Label in UI"). */
export const REPORT_CATEGORIA_LABELS: Record<ReportCategoria, string> = {
  spam: 'Spam o publicidad',
  acoso: 'Acoso u hostigamiento',
  amenazas: 'Amenazas o violencia',
  datos_personales: 'Datos personales de alguien',
  ataque_persona: 'Ataque o acusación a una persona con nombre',
  suplantacion: 'Se hace pasar por otro',
  contenido_ilegal: 'Contenido ilegal',
  compraventa: 'Venta indebida o fraude académico',
  infraccion_autor: 'Infringe derechos de autor',
  contenido_sexual: 'Contenido sexual explícito',
  manipulacion: 'Votos manipulados o cuentas falsas',
  otro: 'Otro',
}

/** Regla de la comunidad a la que mapea cada categoría (§11.3.1). */
export const REPORT_CATEGORIA_REGLA: Record<ReportCategoria, number | null> = {
  spam: 5,
  acoso: 2,
  amenazas: 3,
  datos_personales: 1,
  ataque_persona: 4,
  suplantacion: 6,
  contenido_ilegal: 7,
  compraventa: 8,
  infraccion_autor: 9,
  contenido_sexual: 10,
  manipulacion: 11,
  otro: null,
}

/** Categorías inaccionables sin texto: el detalle es obligatorio (§11.3.2). */
export const CATEGORIAS_CON_DETALLE_OBLIGATORIO: readonly ReportCategoria[] = [
  'infraccion_autor',
  'suplantacion',
  'otro',
]

/** Se atienden primero, siempre (§11.4.1). */
export const CATEGORIAS_PRIORITARIAS: readonly ReportCategoria[] = [
  'amenazas',
  'datos_personales',
  'contenido_ilegal',
]

/** Lista lista para renderizar la radio list del diálogo de reporte. */
export const REPORT_CATEGORIAS = REPORT_CATEGORIA_VALUES.map((value) => ({
  value,
  label: REPORT_CATEGORIA_LABELS[value],
  regla: REPORT_CATEGORIA_REGLA[value],
}))

/** Estados de `reports.status` (CHECK de la migración 0008). */
export const REPORT_STATUS_VALUES = [
  'abierto',
  'en_revision',
  'resuelto',
  'desestimado',
  'resuelto_duplicado',
] as const
export type ReportStatus = (typeof REPORT_STATUS_VALUES)[number]

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  abierto: 'Abierto',
  en_revision: 'En revisión',
  resuelto: 'Resuelto',
  desestimado: 'Desestimado',
  resuelto_duplicado: 'Duplicado',
}

/** Resoluciones que acepta `mod_resolve_report` (migración 0012). */
export const REPORT_RESOLUTIONS = ['resuelto', 'desestimado', 'resuelto_duplicado'] as const

/** Vocabulario cerrado de `mod_actions.action` (§11.5.1). */
export const MOD_ACTION_LABELS: Record<string, string> = {
  remover: 'Removió contenido',
  restaurar: 'Restauró contenido',
  advertir: 'Advirtió',
  suspender: 'Suspendió',
  banear: 'Inhabilitó',
  desbanear: 'Rehabilitó',
  resolver_reporte: 'Resolvió un reporte',
  desestimar_reporte: 'Desestimó un reporte',
  retiro_legal: 'Retiro legal',
  bloquear_hilo: 'Bloqueó el hilo',
  revelar_autor: 'Vio el autor',
}

/** Escalera de duraciones de §11.5.1. La duración vive en `until`, no en el nombre. */
export const RESTRICTION_DURATIONS = [
  { value: 7, label: '7 días' },
  { value: 30, label: '30 días' },
] as const

// ---------------------------------------------------------------------------
// Piezas comunes
// ---------------------------------------------------------------------------

const PUBLIC_ID_PATTERN = /^[a-z0-9]{10}$/
const HANDLE_PATTERN = /^[A-Za-z0-9_]{3,24}$/

const publicIdField = z
  .string()
  .trim()
  .regex(PUBLIC_ID_PATTERN, 'No pudimos identificar el contenido.')

const handleField = z
  .string()
  .trim()
  .regex(HANDLE_PATTERN, 'El seudónimo puede tener de 3 a 24 letras, números o guion bajo.')

/** `motivo_publico`: lo que ve el usuario afectado. CHECK: entre 3 y 500 (0008). */
const motivoField = z
  .string()
  .trim()
  .min(3, 'Escribí el motivo: es lo que va a leer la persona afectada.')
  .max(500, 'El motivo no puede superar los 500 caracteres.')

/** `notas_internas`: nunca sale del panel. CHECK: hasta 2000 (0008). */
const notasField = z
  .string()
  .trim()
  .max(2000, 'Las notas internas no pueden superar los 2000 caracteres.')
  .optional()

const idField = z.coerce
  .number({ error: 'No pudimos identificar el registro.' })
  .int('No pudimos identificar el registro.')
  .positive('No pudimos identificar el registro.')

const contentKindField = z.enum(CONTENT_KINDS, { error: 'Elegí el tipo de contenido.' })

/**
 * Lee un campo de texto del FormData. Devuelve `undefined` cuando viene vacío, que
 * es lo que los campos opcionales necesitan para no chocar contra un `min()`.
 */
export function formText(formData: FormData, key: string): string | undefined {
  const raw = formData.get(key)
  if (typeof raw !== 'string') return undefined
  const trimmed = raw.trim()
  return trimmed === '' ? undefined : trimmed
}

// ---------------------------------------------------------------------------
// Reportes y apelaciones (cualquier cuenta)
// ---------------------------------------------------------------------------

export const reportSchema = z
  .object({
    targetKind: z.enum(TARGET_KINDS, { error: 'No pudimos identificar qué estás reportando.' }),
    targetPublicId: z
      .string()
      .trim()
      .min(1, 'No pudimos identificar qué estás reportando.')
      .max(40),
    categoria: z.enum(REPORT_CATEGORIA_VALUES, { error: 'Elegí un motivo para el reporte.' }),
    detalle: z
      .string()
      .trim()
      .max(
        LIMITS.reportDetail,
        `El detalle no puede superar los ${LIMITS.reportDetail} caracteres.`,
      )
      .optional(),
  })
  .refine(
    (value) =>
      value.targetKind === 'profile'
        ? HANDLE_PATTERN.test(value.targetPublicId)
        : PUBLIC_ID_PATTERN.test(value.targetPublicId),
    { error: 'No pudimos identificar qué estás reportando.', path: ['targetPublicId'] },
  )
  .refine(
    (value) =>
      !CATEGORIAS_CON_DETALLE_OBLIGATORIO.includes(value.categoria) ||
      (value.detalle !== undefined && value.detalle.length > 0),
    { error: 'En esta categoría necesitamos que nos cuentes un poco más.', path: ['detalle'] },
  )

export type ReportInput = z.infer<typeof reportSchema>

export const appealSchema = z.object({
  modActionId: idField,
  body: z
    .string()
    .trim()
    .min(1, 'Contanos por qué creés que la decisión fue un error.')
    .max(LIMITS.appealBody, `La apelación no puede superar los ${LIMITS.appealBody} caracteres.`),
})

export type AppealInput = z.infer<typeof appealSchema>

// ---------------------------------------------------------------------------
// Acciones de moderación (rol mod/admin; la base lo vuelve a chequear)
// ---------------------------------------------------------------------------

/** `mod_remove_post` / `mod_remove_comment` / `mod_remove_resource`. */
export const modContentActionSchema = z.object({
  targetKind: contentKindField,
  publicId: publicIdField,
  motivo: motivoField,
  notas: notasField,
})

/** `mod_restore_post` / `mod_restore_comment` / `mod_restore_resource`. */
export const modRestoreContentSchema = modContentActionSchema

/** `mod_legal_takedown_resource`: sólo recursos (§11.7.2). */
export const modLegalTakedownSchema = z.object({
  publicId: publicIdField,
  motivo: motivoField,
  notas: notasField,
})

/** `mod_lock_thread`: setea `posts.locked_at` (§11.6.4). */
export const modLockThreadSchema = z.object({
  publicId: publicIdField,
  motivo: motivoField,
  notas: notasField,
})

/** `mod_reveal_author`: el "Ver autor" auditado (§11.4.2). No admite perfiles. */
export const modRevealAuthorSchema = z.object({
  targetKind: contentKindField,
  publicId: publicIdField,
  motivo: motivoField,
  notas: notasField,
})

/** `mod_warn_user`. */
export const modWarnUserSchema = z.object({
  handle: handleField,
  motivo: motivoField,
})

/**
 * `mod_restrict_user`. La duración no es parte del nombre de la acción: una
 * suspensión necesita días futuros y un ban es permanente (`until` null).
 */
export const modRestrictUserSchema = z
  .object({
    handle: handleField,
    tipo: z.enum(['suspension', 'ban'], { error: 'Elegí suspensión o inhabilitación.' }),
    dias: z.coerce
      .number()
      .int()
      .min(1, 'La suspensión tiene que durar al menos un día.')
      .max(365, 'Una suspensión no puede pasar de 365 días. Para eso está la inhabilitación.')
      .optional(),
    motivo: motivoField,
  })
  .refine((value) => value.tipo !== 'suspension' || value.dias !== undefined, {
    error: 'Elegí cuántos días dura la suspensión.',
    path: ['dias'],
  })

export type ModRestrictUserInput = z.infer<typeof modRestrictUserSchema>

/** `mod_revoke_restriction`. */
export const modRevokeRestrictionSchema = z.object({
  restrictionId: idField,
})

/** `mod_resolve_report`. */
export const modResolveReportSchema = z.object({
  reportId: idField,
  resolution: z.enum(REPORT_RESOLUTIONS, { error: 'Elegí cómo cerrás el reporte.' }),
})

/** `mod_review_appeal`: la revisa alguien distinto del actor original (§11.5.2). */
export const modReviewAppealSchema = z.object({
  appealId: idField,
  resolucion: z.enum(['aceptada', 'rechazada'], { error: 'Elegí el resultado de la apelación.' }),
})

/** `create_invite`. */
export const createInviteSchema = z.object({
  maxUses: z.coerce
    .number()
    .int()
    .min(1, 'Una invitación tiene que servir al menos una vez.')
    .max(500, 'El máximo son 500 usos por código.'),
  expiresAt: z.string().trim().min(1).optional(),
  note: z.string().trim().max(200, 'La nota no puede superar los 200 caracteres.').optional(),
})
