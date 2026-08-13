/**
 * features/recursos/schemas.ts — validación de entrada de la feature de recursos
 * (PART 14 §14.2-14.3, BUILD-CONTRACT §4.5).
 *
 * Este módulo es la frontera de confianza del pipeline de subida y, por eso, el
 * único de la feature que importan las dos orillas: `actions.ts` (servidor) para
 * revalidar todo lo que el navegador ya dijo haber validado (D14.4), y
 * `components/upload-form.tsx` (cliente) para no dejar que el estudiante llene
 * un formulario que el servidor va a rechazar. NO puede importar nada de
 * servidor: si alguien le agrega `server-only`, el formulario deja de compilar.
 *
 * Los límites numéricos salen todos de `LIMITS`/`ACCEPTED_MIME` en `lib/config.ts`,
 * que a su vez espejan los CHECK de la migración 0007. Tres copias del mismo
 * número (SQL, config, Zod) es una de más; la de acá existe para que el error
 * llegue en castellano y no como una violación de constraint.
 *
 * Acá vive también el vocabulario de la feature (los seis `tipo` de §14.2 con sus
 * rótulos y plurales, la extensión de cada MIME) y el formateo de tamaños. Es el
 * único módulo que comparten `queries.ts`, `actions.ts` y los tres componentes
 * sin arrastrar dependencias de servidor: la feature no tiene —a propósito— un
 * `utils.ts` más para que dos funciones de diez líneas vivan solas.
 */
import { z } from 'zod'

import { ACCEPTED_MIME, LIMITS, type AcceptedMime } from '@/lib/config'
import { isPublicId } from '@/lib/utils/public-id'
import { isSlug } from '@/lib/utils/slug'

// ---------------------------------------------------------------------------
// Vocabulario (PART 14 §14.2)
// ---------------------------------------------------------------------------

/**
 * Los seis tipos de §14.2, en el orden en que se muestran en el select.
 * Espeja `resources_tipo_check` de la migración 0007: agregar uno es una
 * migración, y esa fricción es deliberada.
 */
export const RESOURCE_TIPOS = ['resumen', 'apunte', 'parcial', 'final', 'guia', 'otro'] as const

export type ResourceTipo = (typeof RESOURCE_TIPOS)[number]

/** Rótulos largos de §14.2, para el select del formulario. */
export const TIPO_LABELS: Record<ResourceTipo, string> = {
  resumen: 'Resumen',
  apunte: 'Apunte',
  parcial: 'Parcial',
  final: 'Final',
  guia: 'Guía de ejercicios',
  otro: 'Otro',
}

/** Rótulos cortos del chip de la fila densa (PART 17 §17.4.5). */
export const TIPO_CHIP_LABELS: Record<ResourceTipo, string> = {
  ...TIPO_LABELS,
  guia: 'Guía',
}

/** Plurales para el aviso de duplicados de §14.8 ("Ya hay 3 resúmenes…"). */
export const TIPO_PLURALS: Record<ResourceTipo, string> = {
  resumen: 'resúmenes',
  apunte: 'apuntes',
  parcial: 'parciales',
  final: 'finales',
  guia: 'guías',
  otro: 'recursos',
}

/** Tipos con posturas legales propias (§14.9): el formulario les muestra el aviso. */
export const TIPOS_EXAMEN: readonly ResourceTipo[] = ['parcial', 'final']

/** Rótulo visible de cada MIME aceptado ("PDF · 2,4 MB"). */
export const MIME_LABELS: Record<AcceptedMime, string> = {
  'application/pdf': 'PDF',
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
  'image/webp': 'WebP',
}

/**
 * Extensión de la clave final por MIME (§14.4).
 *
 * Sale del tipo *olfateado* en el servidor, nunca de lo que declaró el
 * navegador: la extensión que el usuario escribió no participa de la clave.
 */
export const MIME_EXTENSIONS: Record<AcceptedMime, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

/** Días que un recurso lleva la etiqueta "Nuevo" en la estantería (§14.7). */
export const NEW_RESOURCE_DAYS = 14

/** Primer año aceptado en `anio`; el tope es el año en curso (§14.2). */
export const RESOURCE_YEAR_MIN = 2000

export function isResourceTipo(value: string): value is ResourceTipo {
  return (RESOURCE_TIPOS as readonly string[]).includes(value)
}

export function isAcceptedMime(value: string): value is AcceptedMime {
  return (ACCEPTED_MIME as readonly string[]).includes(value)
}

/** Años ofrecidos en el select, del actual hacia atrás hasta 2000. */
export function resourceYearOptions(): number[] {
  const current = new Date().getFullYear()
  const years: number[] = []
  for (let year = current; year >= RESOURCE_YEAR_MIN; year--) years.push(year)
  return years
}

// ---------------------------------------------------------------------------
// Formato
// ---------------------------------------------------------------------------

const KIB = 1024
const MIB = 1024 * 1024

const oneDecimal = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 })
const noDecimals = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })

/**
 * Tamaño legible en es-AR: "2,4 MB", "512 KB" (PART 17 §17.4.5).
 * Coma decimal, no punto: es el separador que lee un estudiante argentino.
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB'
  if (bytes < MIB) return `${noDecimals.format(Math.max(1, Math.round(bytes / KIB)))} KB`
  return `${oneDecimal.format(bytes / MIB)} MB`
}

/** Plural simple para los contadores de la fila ("1 descarga" / "12 descargas"). */
export function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`
}

// ---------------------------------------------------------------------------
// Esquemas
// ---------------------------------------------------------------------------

/** Un `public_id` de recurso tal como viaja en la URL (D14.7). */
export const resourcePublicIdSchema = z
  .string('Falta el recurso.')
  .trim()
  .refine(isPublicId, 'El recurso no es válido.')

const materiaSlugSchema = z
  .string('Elegí la materia del recurso.')
  .trim()
  .min(1, 'Elegí la materia del recurso.')
  .refine(isSlug, 'La materia no es válida.')

/**
 * Un archivo *declarado* por el navegador en la fase 1: nombre, tamaño y tipo.
 * Los bytes no pasan por acá — viajan directo a R2 (§14.3, paso 3) — así que
 * todo esto es una promesa que el servidor verifica con HEAD y magic numbers en
 * `finalizeResource`. Sirve para firmar las URLs y para rechazar temprano lo que
 * seguro va a fallar, no como evidencia.
 */
const declaredFileSchema = z.object({
  name: z
    .string('El archivo no tiene nombre.')
    .trim()
    .min(1, 'El archivo no tiene nombre.')
    // Tolerante a propósito: el servidor lo sanea y lo recorta a 200 antes de
    // guardarlo (§14.4). Rechazar un nombre largo perdería una contribución real.
    .max(400, 'El nombre del archivo es demasiado largo.'),
  size: z
    .number('El tamaño del archivo no es válido.')
    .int('El tamaño del archivo no es válido.')
    .min(1, 'Uno de los archivos está vacío.')
    .max(LIMITS.fileMaxBytes, 'Cada archivo puede pesar hasta 10 MB.'),
  type: z.enum(ACCEPTED_MIME, 'Solo aceptamos PDF, JPG, PNG o WebP.'),
})

export type DeclaredFile = z.infer<typeof declaredFileSchema>

/**
 * Fase 1 de la subida (§14.3, paso 2): metadatos + archivos declarados.
 *
 * El tope de `anio` se calcula en cada validación y no al importar el módulo:
 * un proceso de servidor que sobrevive al 31 de diciembre no puede empezar a
 * rechazar el año en curso.
 */
export const createResourceDraftSchema = z.object({
  title: z
    .string('Poné un título.')
    .trim()
    .min(LIMITS.resourceTitleMin, 'El título tiene que tener al menos 8 caracteres.')
    .max(LIMITS.resourceTitle, 'El título puede tener hasta 120 caracteres.'),
  materiaSlug: materiaSlugSchema,
  tipo: z.enum(RESOURCE_TIPOS, 'Elegí el tipo de recurso.'),
  anio: z
    .number('El año no es válido.')
    .int('El año no es válido.')
    .min(RESOURCE_YEAR_MIN, 'El año tiene que ser 2000 o posterior.')
    .refine((year) => year <= new Date().getFullYear(), 'El año no puede ser futuro.')
    .optional(),
  description: z
    .string()
    .trim()
    .max(LIMITS.resourceDescription, 'La descripción puede tener hasta 2000 caracteres.')
    .optional(),
  anonymous: z.boolean().default(false),
  files: z
    .array(declaredFileSchema)
    .min(1, 'Elegí al menos un archivo.')
    .max(LIMITS.filesPerResource, 'Podés subir hasta 3 archivos.'),
})

export type CreateResourceDraftInput = z.infer<typeof createResourceDraftSchema>

/**
 * Fase 2 (§14.3, paso 4): qué archivos dice el navegador haber subido.
 *
 * NO lleva la clave del objeto. La clave la deriva el servidor del `publicId` y
 * del índice, igual que en la fase 1 (ver `quarantineKeyFor` en `actions.ts`):
 * si el cliente pudiera nombrarla, podría pedir que finalicemos el objeto en
 * cuarentena de otra persona. `materiaSlug` viaja solo para invalidar la caché
 * de la estantería y no gobierna ninguna decisión de autorización.
 */
export const finalizeResourceSchema = z.object({
  publicId: resourcePublicIdSchema,
  materiaSlug: materiaSlugSchema.optional(),
  files: z
    .array(
      z.object({
        index: z
          .number('El archivo no es válido.')
          .int('El archivo no es válido.')
          .min(0, 'El archivo no es válido.')
          .max(LIMITS.filesPerResource - 1, 'El archivo no es válido.'),
        name: declaredFileSchema.shape.name,
        size: declaredFileSchema.shape.size,
      }),
    )
    .min(1, 'No recibimos ningún archivo.')
    .max(LIMITS.filesPerResource, 'Podés subir hasta 3 archivos.'),
})

export type FinalizeResourceInput = z.infer<typeof finalizeResourceSchema>

export const deleteResourceSchema = z.object({
  publicId: resourcePublicIdSchema,
})

// ---------------------------------------------------------------------------
// FormData → objeto plano
//
// Vive acá, y no en `actions.ts`, para que el formulario del cliente arme
// exactamente la forma que el servidor va a parsear. Estas funciones NO validan:
// devuelven `unknown` con la forma cruda y el que valida es Zod, siempre.
// ---------------------------------------------------------------------------

function readText(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function readChecked(formData: FormData, key: string): boolean {
  const value = formData.get(key)
  return value === 'on' || value === 'true' || value === '1'
}

/** Los archivos viajan como JSON en un campo de texto: los bytes van a R2, no acá. */
function readJson(formData: FormData, key: string): unknown {
  const raw = formData.get(key)
  if (typeof raw !== 'string' || raw === '') return undefined
  try {
    return JSON.parse(raw)
  } catch {
    // Zod convierte esto en "Elegí al menos un archivo." sin filtrar el detalle.
    return undefined
  }
}

export function draftFormValues(formData: FormData): unknown {
  const anio = readText(formData, 'anio')

  return {
    title: readText(formData, 'title'),
    materiaSlug: readText(formData, 'materiaSlug'),
    tipo: readText(formData, 'tipo'),
    anio: anio === '' ? undefined : Number(anio),
    description: readText(formData, 'description') || undefined,
    anonymous: readChecked(formData, 'anonymous'),
    files: readJson(formData, 'files'),
  }
}

export function finalizeFormValues(formData: FormData): unknown {
  const materiaSlug = readText(formData, 'materiaSlug')

  return {
    publicId: readText(formData, 'publicId'),
    materiaSlug: materiaSlug === '' ? undefined : materiaSlug,
    files: readJson(formData, 'files'),
  }
}

export function deleteFormValues(formData: FormData): unknown {
  return { publicId: readText(formData, 'publicId') }
}
