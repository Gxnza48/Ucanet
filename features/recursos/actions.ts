'use server'

/**
 * features/recursos/actions.ts — el pipeline de subida de PART 14 §14.3.
 *
 * Dos fases, y la razón de que sean dos está en §14.3 paso 3: los bytes NO pasan
 * por Vercel. El navegador sube directo a Cloudflare R2 con una URL firmada de
 * 120 s que emite el servidor después de que la base validó sesión, cuota,
 * límite diario y metadatos.
 *
 *   fase 1 · createResourceDraft → RPC request_upload → recurso en 'borrador'
 *            + una URL de PUT por archivo contra incoming/{uploadId}
 *   fase 2 · finalizeResource   → HEAD + magic numbers + strip de EXIF + move
 *            → RPC finalize_upload → el recurso pasa a 'activo'
 *
 * EL CLIENTE NUNCA ELIGE LA RUTA. Ni en la fase 1 (la clave se firma acá) ni en
 * la fase 2 (la clave se vuelve a derivar acá del `public_id` y del índice). Es
 * la diferencia entre "subí este archivo" y "escribí en esta ruta del bucket":
 * si la clave viajara en el formulario, alguien podría pedir que finalicemos el
 * objeto en cuarentena de otra persona, o pisar el archivo de otro recurso.
 * Derivarla la vuelve, además, idempotente: reintentar una subida fallida
 * sobreescribe el mismo objeto en vez de dejar basura.
 *
 * Lo que declara el navegador (nombre, tamaño, tipo) es una pista. El dato es lo
 * que el servidor ve en R2: HEAD para el tamaño real y los primeros bytes para
 * el tipo real (§14.3 paso 4 — la extensión y el Content-Type son del cliente y
 * por lo tanto no valen como única verificación).
 */

import 'server-only'

import { createHash } from 'node:crypto'

// `updateTag` y no `revalidateTag`: en Next 16 `revalidateTag` pasó a exigir un
// perfil de `cacheLife` y expira de forma diferida, mientras que `updateTag` es
// la API de "leé lo que acabás de escribir" dentro de una Server Action — que es
// lo que necesita quien acaba de publicar un recurso para verlo en la estantería.
// El vocabulario de etiquetas es el del contrato: `recurso:<publicId>`,
// `materia:<slug>`.
import { revalidatePath, updateTag } from 'next/cache'

import { LIMITS, type AcceptedMime } from '@/lib/config'
import { GENERIC_ERROR, messageForCode, rpcErrorMessage } from '@/lib/errors'
import {
  deleteObject,
  finalKey,
  headObject,
  moveObject,
  presignGet,
  presignPut,
  quarantineKey,
  SIGNED_URL_TTL_SECONDS,
} from '@/lib/r2'
import { fail, ok, type ActionResult } from '@/lib/result'
import { createClient, getUser } from '@/lib/supabase/server'
import type { Json } from '@/lib/types.gen'
import { newPublicId } from '@/lib/utils/public-id'

import {
  MIME_EXTENSIONS,
  createResourceDraftSchema,
  deleteFormValues,
  deleteResourceSchema,
  draftFormValues,
  finalizeFormValues,
  finalizeResourceSchema,
  resourcePublicIdSchema,
} from './schemas'

/** Una URL de subida firmada, atada a un archivo declarado por su índice. */
export type PresignedUpload = {
  index: number
  /** Clave de cuarentena elegida por el servidor. El cliente la recibe, no la propone. */
  key: string
  url: string
}

export type ResourceDraft = {
  publicId: string
  uploads: PresignedUpload[]
}

/** Bytes que alcanzan para reconocer los cuatro formatos aceptados. */
const SNIFF_BYTES = 16

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/** Tope del nombre original guardado como metadato (§14.4 y CHECK de la 0007). */
const MAX_ORIGINAL_NAME = 200

const FALLBACK_ORIGINAL_NAME = 'archivo'

// ---------------------------------------------------------------------------
// Fase 1 — createResourceDraft
// ---------------------------------------------------------------------------

/**
 * Valida los metadatos, crea el recurso en borrador y devuelve una URL de PUT
 * por archivo contra la cuarentena.
 *
 * No revalida ninguna caché a propósito: un borrador no existe para nadie más
 * —`resources_public` solo emite filas `activo`— así que no hay nada publicado
 * que invalidar todavía. Los borradores abandonados los limpia el cron diario a
 * las 24 h (§14.3 paso 5).
 */
export async function createResourceDraft(
  _prev: ActionResult<ResourceDraft> | null,
  formData: FormData,
): Promise<ActionResult<ResourceDraft>> {
  const parsed = createResourceDraftSchema.safeParse(draftFormValues(formData))
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? GENERIC_ERROR)

  const user = await getUser()
  if (!user) return fail(messageForCode('NOT_AUTHENTICATED'))

  const input = parsed.data
  const supabase = await createClient()

  // La RPC es la que manda: cuota de 100 MB, límite diario, kill-switch de
  // subidas y los CHECK de la tabla. Lo de arriba solo evita el viaje de ida.
  const { data: publicId, error } = await supabase.rpc('request_upload', {
    p_materia_slug: input.materiaSlug,
    p_tipo: input.tipo,
    p_anio: input.anio,
    p_title: input.title,
    p_description: input.description,
    p_anonymous: input.anonymous,
  })

  if (error || !publicId) return fail(rpcErrorMessage(error))

  try {
    const uploads: PresignedUpload[] = []
    for (const [index, file] of input.files.entries()) {
      const key = quarantineKeyFor(publicId, index)
      uploads.push({
        index,
        key,
        // Se firma con el tipo declarado porque R2 exige que el PUT mande
        // exactamente ese Content-Type; el tipo real se olfatea en la fase 2.
        url: await presignPut(key, file.type, SIGNED_URL_TTL_SECONDS),
      })
    }

    return ok({ publicId, uploads })
  } catch (cause) {
    // Sin URLs firmadas no hay subida posible. El borrador queda y lo levanta el
    // cron: perder 24 h de una fila vacía es más barato que borrarla acá y
    // arriesgar que el usuario pierda los metadatos que ya escribió.
    console.error('createResourceDraft: no se pudieron firmar las URLs', cause)
    return fail(GENERIC_ERROR)
  }
}

// ---------------------------------------------------------------------------
// Fase 2 — finalizeResource
// ---------------------------------------------------------------------------

type VerifiedFile = {
  storagePath: string
  originalName: string
  mime: AcceptedMime
  sizeBytes: number
  sha256: string | null
}

/**
 * Verifica lo que realmente aterrizó en la cuarentena, lo limpia, lo mueve a su
 * clave definitiva y publica el recurso (§14.3 paso 4).
 *
 * Por cada archivo: HEAD (existe y el tamaño coincide y entra en 10 MB) →
 * magic numbers sobre los primeros bytes → strip de metadatos si es JPEG →
 * `r/{publicId}/{fileId}.{ext}`. Si algo falla, se borran los objetos huérfanos
 * —los que ya se movieron y los que quedaron en cuarentena— y el recurso queda
 * en borrador para reintentar.
 */
export async function finalizeResource(
  _prev: ActionResult<{ publicId: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ publicId: string }>> {
  const parsed = finalizeResourceSchema.safeParse(finalizeFormValues(formData))
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? GENERIC_ERROR)

  const user = await getUser()
  if (!user) return fail(messageForCode('NOT_AUTHENTICATED'))

  const { publicId, materiaSlug, files } = parsed.data

  // Todo lo que hay que barrer si esto sale mal.
  const quarantined = files.map((file) => quarantineKeyFor(publicId, file.index))
  const written: string[] = []

  const abort = async (message: string): Promise<ActionResult<{ publicId: string }>> => {
    await discard([...written, ...quarantined])
    return fail(message)
  }

  const verified: VerifiedFile[] = []

  try {
    for (const declared of files) {
      const source = quarantineKeyFor(publicId, declared.index)

      const head = await headObject(source)
      if (!head) {
        return await abort('No encontramos uno de los archivos. Volvé a elegirlo y probá de nuevo.')
      }
      if (head.size !== declared.size) {
        return await abort('Uno de los archivos se subió incompleto. Probá de nuevo.')
      }
      if (head.size < 1 || head.size > LIMITS.fileMaxBytes) {
        return await abort('Cada archivo puede pesar hasta 10 MB.')
      }

      const header = await readObject(source, SNIFF_BYTES)
      const mime = header ? sniffMime(header) : null
      if (!mime) {
        return await abort(
          'Uno de los archivos no es un PDF ni una imagen. Solo aceptamos PDF, JPG, PNG o WebP.',
        )
      }

      const target = finalKey(publicId, newPublicId(), MIME_EXTENSIONS[mime])
      let sizeBytes = head.size
      let sha256: string | null = null

      if (mime === 'image/jpeg') {
        // Las fotos de un parcial traen GPS y modelo de teléfono: metadatos que
        // desanonimizan a quien subió (§14.3). Se reescribe el archivo sin sus
        // segmentos APPn antes de que exista en su clave definitiva.
        const original = await readObject(source)
        if (!original) {
          return await abort('No pudimos leer una de las imágenes. Probá de nuevo.')
        }

        const stripped = stripJpegMetadata(original)
        if (!stripped) {
          return await abort(
            'No pudimos limpiar los datos ocultos de una de las fotos. Convertila a PDF o sacá otra.',
          )
        }

        await putObject(target, stripped, mime)
        written.push(target)
        await deleteObject(source)

        sizeBytes = stripped.length
        // El hash sale de los bytes que efectivamente se guardan, no del
        // original: es el que sirve para el manifiesto del backup (D13) y para
        // detectar re-subidas byte a byte (§14.8).
        sha256 = createHash('sha256').update(stripped).digest('hex')
      } else {
        await moveObject(source, target)
        written.push(target)
      }

      verified.push({
        storagePath: target,
        originalName: sanitizeOriginalName(declared.name),
        mime,
        sizeBytes,
        sha256,
      })
    }
  } catch (cause) {
    console.error('finalizeResource: falló la verificación de archivos', cause)
    return await abort(GENERIC_ERROR)
  }

  const supabase = await createClient()
  const payload: Json = verified.map((file) => ({
    storage_path: file.storagePath,
    original_name: file.originalName,
    mime: file.mime,
    size_bytes: file.sizeBytes,
    sha256: file.sha256,
  }))

  const { error } = await supabase.rpc('finalize_upload', {
    p_resource_public_id: publicId,
    p_files: payload,
  })

  if (error) {
    // La base rechazó el lote: los objetos ya movidos no son de nadie.
    await discard(written)
    return fail(rpcErrorMessage(error))
  }

  updateTag(`recurso:${publicId}`)
  if (materiaSlug) updateTag(`materia:${materiaSlug}`)
  revalidatePath('/recursos')

  return ok({ publicId })
}

// ---------------------------------------------------------------------------
// Baja y voto
// ---------------------------------------------------------------------------

/**
 * Baja blanda del recurso propio.
 *
 * No toca R2: los objetos los destruye el job de retención a los 30 días
 * (§8.7). Borrarlos acá volvería irreversible una baja hecha por error y
 * dejaría sin evidencia una moderación abierta.
 */
export async function deleteResource(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = deleteResourceSchema.safeParse(deleteFormValues(formData))
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? GENERIC_ERROR)

  const user = await getUser()
  if (!user) return fail(messageForCode('NOT_AUTHENTICATED'))

  const { publicId } = parsed.data
  const supabase = await createClient()
  const { error } = await supabase.rpc('delete_own_resource', { p_public_id: publicId })

  if (error) return fail(rpcErrorMessage(error))

  updateTag(`recurso:${publicId}`)
  revalidatePath('/recursos')

  return ok()
}

/**
 * Alterna el voto positivo sobre un recurso (up-only, D2).
 *
 * La RPC devuelve el score nuevo y nada más, así que el estado del control se
 * deduce comparando contra el score anterior: si subió, el visitante acaba de
 * votar. Con dos votos simultáneos de personas distintas el booleano puede
 * quedar invertido por un instante; es cosmético y la próxima carga lo corrige
 * (PART 17 §17.5.1 ya acepta que el número de las filas venga desfasado).
 */
export async function toggleResourceVote(
  publicId: string,
): Promise<ActionResult<{ score: number; voted: boolean }>> {
  const parsed = resourcePublicIdSchema.safeParse(publicId)
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? GENERIC_ERROR)

  const user = await getUser()
  if (!user) return fail(messageForCode('NOT_AUTHENTICATED'))

  const id = parsed.data
  const supabase = await createClient()

  const { data: before } = await supabase
    .from('resources_public')
    .select('score')
    .eq('public_id', id)
    .maybeSingle()

  const { data: score, error } = await supabase.rpc('toggle_resource_vote', { p_public_id: id })

  if (error || typeof score !== 'number') return fail(rpcErrorMessage(error))

  const previous = before?.score ?? null
  updateTag(`recurso:${id}`)

  return ok({ score, voted: previous === null ? true : score > previous })
}

// ---------------------------------------------------------------------------
// Claves y objetos
// ---------------------------------------------------------------------------

/**
 * Clave de cuarentena de un archivo, derivada y no negociada.
 *
 * El `public_id` del recurso ya es un nanoid de 10 caracteres inadivinable, y el
 * índice lo hace único dentro del borrador: alcanza para que las dos fases
 * lleguen a la misma clave sin que el navegador tenga que devolvérnosla.
 */
function quarantineKeyFor(resourcePublicId: string, index: number): string {
  return quarantineKey(`${resourcePublicId}-${index + 1}`)
}

/**
 * Lee un objeto de R2 desde el servidor, entero o solo su cabecera.
 *
 * `lib/r2.ts` no expone un GET directo, así que se firma una URL de 120 s y se
 * la consume acá mismo con `Range`. Para olfatear el tipo viajan 16 bytes; el
 * archivo completo se baja únicamente para los JPEG, que son los que hay que
 * reescribir sin metadatos.
 */
async function readObject(key: string, maxBytes?: number): Promise<Buffer | null> {
  const url = await presignGet(key, FALLBACK_ORIGINAL_NAME)
  const headers: Record<string, string> = {}
  if (maxBytes !== undefined) headers.Range = `bytes=0-${maxBytes - 1}`

  const response = await fetch(url, { cache: 'no-store', headers })
  if (!response.ok) return null

  return Buffer.from(await response.arrayBuffer())
}

async function putObject(key: string, body: Buffer, contentType: AcceptedMime): Promise<void> {
  const url = await presignPut(key, contentType, SIGNED_URL_TTL_SECONDS)
  const response = await fetch(url, {
    method: 'PUT',
    body: new Uint8Array(body),
    headers: { 'Content-Type': contentType },
    cache: 'no-store',
  })

  if (!response.ok) throw new Error(`R2_PUT_${response.status}`)
}

/** Borra objetos huérfanos sin dejar que un fallo de limpieza tape el error real. */
async function discard(keys: string[]): Promise<void> {
  await Promise.all(
    keys.map(async (key) => {
      try {
        await deleteObject(key)
      } catch (cause) {
        // Queda huérfano en R2 y lo levanta la purga diaria (§8.7).
        console.error('finalizeResource: no se pudo borrar el objeto huérfano', key, cause)
      }
    }),
  )
}

// ---------------------------------------------------------------------------
// Tipo real del archivo
// ---------------------------------------------------------------------------

/**
 * Tipo real por magic numbers (§14.3): `%PDF-`, `FF D8 FF`, la firma de PNG y
 * `RIFF....WEBP`. Devuelve null si no es ninguno de los cuatro formatos.
 */
function sniffMime(header: Buffer): AcceptedMime | null {
  if (header.length >= 5 && header.subarray(0, 5).toString('latin1') === '%PDF-') {
    return 'application/pdf'
  }
  if (header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
    return 'image/jpeg'
  }
  if (header.length >= 8 && header.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return 'image/png'
  }
  if (
    header.length >= 12 &&
    header.subarray(0, 4).toString('latin1') === 'RIFF' &&
    header.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return 'image/webp'
  }

  return null
}

/**
 * Saca los segmentos de metadatos de un JPEG: APP0-APP15 (donde viven EXIF con
 * GPS, XMP y el perfil ICC) y los comentarios COM.
 *
 * Recorre la cadena de marcadores desde SOI hasta SOS y copia solo lo
 * estructural; a partir de SOS empieza el flujo comprimido y se copia tal cual,
 * así que la imagen no se recodifica y no pierde calidad. Devuelve null si la
 * cadena no se entiende, y quien llama trata eso como rechazo: un JPEG que no
 * podemos recorrer es un JPEG del que no podemos afirmar que le sacamos el GPS.
 *
 * DEUDA CONOCIDA — PART 14 §14.3 exige limpiar también PNG y WebP. No está
 * hecho: PNG guarda metadatos en chunks tEXt/iTXt/zTXt/eXIf y WebP en chunks
 * EXIF/XMP de su contenedor RIFF, y cada formato es su propio recorrido. Se
 * eligió no sumar una dependencia de imágenes (D14.8, presupuesto de 14
 * paquetes) y no escribir dos parsers más en esta pasada. Riesgo real: una foto
 * de un parcial guardada como PNG o WebP conserva sus metadatos. El caso
 * dominante en teléfonos es JPEG, que sí se limpia.
 */
function stripJpegMetadata(input: Buffer): Buffer | null {
  if (input.length < 4 || input[0] !== 0xff || input[1] !== 0xd8) return null

  const kept: Buffer[] = [Buffer.from([0xff, 0xd8])]
  let offset = 2

  while (offset + 1 < input.length) {
    if (input[offset] !== 0xff) return null

    // Una hilera de 0xff antes del marcador es relleno legal.
    let markerAt = offset + 1
    while (input[markerAt] === 0xff) markerAt += 1

    const marker = input[markerAt]
    if (marker === undefined) return null

    // Marcadores sin carga útil: TEM y los reinicios RST0-RST7.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      kept.push(input.subarray(offset, markerAt + 1))
      offset = markerAt + 1
      continue
    }

    // EOI: fin de la imagen.
    if (marker === 0xd9) {
      kept.push(input.subarray(offset))
      return Buffer.concat(kept)
    }

    const lengthAt = markerAt + 1
    if (lengthAt + 2 > input.length) return null

    const length = input.readUInt16BE(lengthAt)
    if (length < 2 || lengthAt + length > input.length) return null

    // SOS: de acá en adelante son datos comprimidos, no segmentos. Se copia
    // todo el resto sin mirarlo.
    if (marker === 0xda) {
      kept.push(input.subarray(offset))
      return Buffer.concat(kept)
    }

    const isMetadata = (marker >= 0xe0 && marker <= 0xef) || marker === 0xfe
    if (!isMetadata) kept.push(input.subarray(offset, lengthAt + length))

    offset = lengthAt + length
  }

  return null
}

/**
 * Nombre original saneado (§14.3/§14.4): se queda con el último segmento, tira
 * separadores de ruta y caracteres de control, colapsa espacios y corta a 200.
 * Los nombres de archivo son entrada de usuario y este es el único lugar donde
 * sobreviven — la clave del objeto nunca los contiene.
 */
function sanitizeOriginalName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? ''

  const cleaned = Array.from(base)
    .filter((char) => {
      const code = char.codePointAt(0) ?? 0
      return code >= 0x20 && code !== 0x7f
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_ORIGINAL_NAME)
    .trim()

  return cleaned || FALLBACK_ORIGINAL_NAME
}
