/**
 * lib/errors.ts — traducción de los códigos de error de las RPC a copy es-AR.
 *
 * Las funciones SECURITY DEFINER de PART 8 §8.5 levantan códigos estables
 * (`RATE_LIMIT`, `THREAD_LOCKED`, …). El servidor los mapea acá; ningún mensaje
 * de Postgres crudo llega jamás a la pantalla de un estudiante.
 */
import type { PostgrestError } from '@supabase/supabase-js'

/** Códigos que las RPC pueden levantar. Espejo de PART 8 §8.5. */
export const RPC_ERROR_CODES = [
  'RATE_LIMIT',
  'NOT_ALLOWED',
  'NOT_AUTHENTICATED',
  'NOT_ONBOARDED',
  'RESTRICTED',
  'TARGET_NOT_FOUND',
  'THREAD_LOCKED',
  'DEPTH_EXCEEDED',
  'INVITE_INVALID',
  'HANDLE_TAKEN',
  'HANDLE_COOLDOWN',
  'HANDLE_RESERVED',
  'HANDLE_INVALID',
  'QUOTA_EXCEEDED',
  'DUPLICATE_REPORT',
  'DUPLICATE_APPEAL',
  'INVALID_INPUT',
  'SELF_VOTE',
  'KILL_SWITCH',
] as const

export type RpcErrorCode = (typeof RPC_ERROR_CODES)[number]

const MESSAGES: Record<RpcErrorCode, string> = {
  RATE_LIMIT: 'Esperá unos minutos antes de publicar de nuevo.',
  NOT_ALLOWED: 'No tenés permiso para hacer esto.',
  NOT_AUTHENTICATED: 'Necesitás iniciar sesión.',
  NOT_ONBOARDED: 'Terminá de crear tu perfil para poder participar.',
  RESTRICTED: 'Tu cuenta tiene una restricción activa. Revisá tus avisos.',
  TARGET_NOT_FOUND: 'No encontramos eso. Puede que se haya eliminado.',
  THREAD_LOCKED: 'El hilo está bloqueado: no admite comentarios nuevos.',
  DEPTH_EXCEEDED: 'Solo se puede responder un nivel. Respondé al comentario principal.',
  INVITE_INVALID: 'El código de invitación no es válido o ya se usó.',
  HANDLE_TAKEN: 'Ese seudónimo ya está en uso.',
  HANDLE_COOLDOWN: 'Podés cambiar tu seudónimo cada 90 días.',
  HANDLE_RESERVED: 'Ese seudónimo está reservado. Elegí otro.',
  HANDLE_INVALID: 'El seudónimo puede tener de 3 a 24 letras, números o guion bajo.',
  QUOTA_EXCEEDED: 'Llegaste al límite de espacio para archivos (100 MB).',
  DUPLICATE_REPORT: 'Ya reportaste este contenido.',
  DUPLICATE_APPEAL: 'Ya enviaste una apelación para esta decisión.',
  INVALID_INPUT: 'Revisá los datos: algo no es válido.',
  SELF_VOTE: 'No podés votar tu propio contenido.',
  KILL_SWITCH: 'Esta función está pausada temporalmente.',
}

/** Copy genérico cuando no reconocemos el error. Nunca filtra detalle técnico. */
export const GENERIC_ERROR = 'Algo salió mal. Probá de nuevo en un momento.'

function isRpcErrorCode(value: string): value is RpcErrorCode {
  return (RPC_ERROR_CODES as readonly string[]).includes(value)
}

/**
 * Extrae el código de error de una PostgrestError y devuelve copy en es-AR.
 * Las RPC levantan `raise exception 'RATE_LIMIT'`, que llega en `message`.
 */
export function rpcErrorMessage(error: PostgrestError | Error | null | undefined): string {
  if (!error) return GENERIC_ERROR
  const raw = 'message' in error && typeof error.message === 'string' ? error.message : ''
  const token = raw.trim().split(/[\s:]+/)[0] ?? ''
  if (isRpcErrorCode(token)) return MESSAGES[token]
  if (isRpcErrorCode(raw.trim())) return MESSAGES[raw.trim() as RpcErrorCode]
  // Violación de unicidad: caso frecuente y con copy propio.
  if ('code' in error && error.code === '23505') return 'Eso ya existe.'
  return GENERIC_ERROR
}

/** Copy para un código conocido, sin pasar por un objeto de error. */
export function messageForCode(code: RpcErrorCode): string {
  return MESSAGES[code]
}
