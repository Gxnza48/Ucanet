/**
 * lib/result.ts — el tipo de retorno de toda Server Action (PART 20 §20.4).
 *
 * Las actions nunca tiran para errores esperables: devuelven `{ ok: false, error }`
 * con copy en es-AR listo para mostrar. Las excepciones quedan para bugs reales.
 */

export type ActionResult<T = undefined> =
  { ok: true; data: T } | { ok: false; error: string; field?: string }

export function ok(): ActionResult<undefined>
export function ok<T>(data: T): ActionResult<T>
export function ok<T>(data?: T): ActionResult<T | undefined> {
  return { ok: true, data }
}

export function fail<T = undefined>(error: string, field?: string): ActionResult<T> {
  return field ? { ok: false, error, field } : { ok: false, error }
}
