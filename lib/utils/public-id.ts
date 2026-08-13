/**
 * lib/utils/public-id.ts — identificadores públicos (D7, D14.7).
 *
 * Los ids internos (`bigint`) nunca salen del servidor: las URLs y los payloads
 * llevan `public_id`. El alfabeto es EXACTAMENTE el de `public.nanoid()` en la
 * migración 0001 (PART 8 §8.2.1) — 31 caracteres, sin `0/1/i/l/o`, para que un
 * id dictado por teléfono o copiado de un póster con QR no se lea mal:
 *
 *     substr('23456789abcdefghjkmnpqrstuvwxyz', ...)
 *
 * La base es la que genera los ids por DEFAULT; estas funciones son para los
 * casos donde el servidor necesita uno antes de escribir (la clave de cuarentena
 * de una subida, un código de invitación generado fuera de un INSERT). Si el
 * alfabeto cambia acá y no en SQL, se rompe la promesa de URLs de diez años.
 *
 * 31^10 ≈ 8,2 × 10^14 combinaciones. La colisión la resuelve el UNIQUE de la
 * tabla más un reintento dentro del RPC: estos son localizadores, no secretos.
 */
import { customAlphabet } from 'nanoid'

/** Alfabeto espejo de `public.nanoid()`. No tocar sin migrar la función SQL. */
export const PUBLIC_ID_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz'

/** Largo por defecto de un public_id (posts, comments, resources). */
export const PUBLIC_ID_SIZE = 10

/** Largo de un código de invitación (`invites.code`, PART 8 §8.6). */
export const INVITE_CODE_SIZE = 8

const generate = customAlphabet<string>(PUBLIC_ID_ALPHABET, PUBLIC_ID_SIZE)

/** Genera un id público de `size` caracteres (10 por defecto). */
export function newPublicId(size: number = PUBLIC_ID_SIZE): string {
  return generate(size)
}

/** Genera un código de invitación de 8 caracteres (§0.5-R18). */
export function newInviteCode(): string {
  return generate(INVITE_CODE_SIZE)
}

/**
 * Forma de id público válida en una URL: `^[a-z0-9]{10}$`.
 *
 * A propósito es más ancha que el alfabeto generador: acepta `0/1/i/l/o`. Es una
 * guarda de ruta —`/p/[publicId]` descarta basura antes de consultar la base— y
 * no un validador de origen. Angostarla al alfabeto convertiría cualquier cambio
 * futuro del generador en 404 masivos sobre contenido que sí existe.
 */
export function isPublicId(value: string): boolean {
  return /^[a-z0-9]{10}$/.test(value)
}
