/**
 * lib/r2.ts — objetos en Cloudflare R2 (§0.5-R17, PART 14 §14.3-14.5).
 *
 * Los archivos de recursos viven en un bucket privado de R2 desde la primera
 * subida: 10 GB gratis y egreso sin costo, contra el 1 GB + 5 GB/mes de Supabase
 * Storage, que era la rotura más probable del presupuesto (D13). El navegador
 * nunca ve el bucket: sube y baja siempre por URLs firmadas de 120 s que emite
 * el servidor después de chequear sesión, cuota y límites en la base.
 *
 * Las claves son neutrales respecto del proveedor y NUNCA contienen ids de
 * usuario ni nombres de archivo originales (PART 8 §8.3.5):
 *
 *     incoming/{upload_nanoid}                       cuarentena
 *     r/{resource_public_id}/{file_nanoid}.{ext}     definitiva
 *
 * El nombre original sobrevive solo como metadato en `resource_files` y vuelve a
 * aparecer, saneado, en el `Content-Disposition` de la descarga.
 */
import 'server-only'

import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

import { getR2Config } from '@/lib/env.server'

/** TTL de toda URL firmada, subida o bajada (§0.5-R12/R17). */
export const SIGNED_URL_TTL_SECONDS = 120

/** Nombre de descarga de último recurso, si el original quedó vacío al sanear. */
const FALLBACK_DOWNLOAD_NAME = 'archivo'

/** Tope del nombre original replicado en el header (PART 14 §14.4). */
const MAX_DOWNLOAD_NAME = 200

type R2 = { client: S3Client; bucket: string }

let r2: R2 | null = null

/**
 * Cliente perezoso: se construye en el primer uso real, no al importar.
 *
 * `next build` prerenderiza páginas que importan este módulo de forma indirecta
 * y no tiene por qué exigir credenciales de R2 (PART 20 §20.6). Si faltan, el
 * error aparece en la primera subida o descarga, fuerte y con nombre propio.
 */
function getClient(): R2 {
  if (r2) return r2

  const config = getR2Config()
  r2 = {
    bucket: config.bucket,
    client: new S3Client({
      // R2 no tiene regiones: la API S3 exige el campo y 'auto' es el valor que
      // Cloudflare documenta.
      region: 'auto',
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      // El SDK agrega checksums CRC obligatorios por defecto; R2 los rechaza en
      // pedidos firmados que el navegador reproduce tal cual. Solo cuando la
      // operación realmente los exige.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    }),
  }
  return r2
}

/** Clave de cuarentena donde aterriza una subida antes del sniff y el strip de EXIF. */
export function quarantineKey(uploadId: string): string {
  return `incoming/${uploadId}`
}

/**
 * Clave definitiva del archivo de un recurso. La extensión sale del tipo
 * *olfateado* en el servidor, nunca de lo que declaró el cliente (PART 9 §9.11).
 */
export function finalKey(resourcePublicId: string, fileId: string, ext: string): string {
  const extension = ext.toLowerCase().replace(/[^a-z0-9]/g, '')
  return `r/${resourcePublicId}/${fileId}.${extension}`
}

/** URL firmada para subir a `key`. El cliente no elige ni la clave ni el TTL. */
export async function presignPut(
  key: string,
  contentType: string,
  expiresIn: number = SIGNED_URL_TTL_SECONDS,
): Promise<string> {
  const { client, bucket } = getClient()

  return getSignedUrl(
    client,
    new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }),
    { expiresIn },
  )
}

/**
 * URL firmada para descargar `key`, con el nombre original saneado.
 *
 * Siempre `attachment`: un PDF hostil puede traer JavaScript, y entregarlo como
 * adjunto empuja el renderizado al visor del sistema en vez de ejecutarlo en un
 * origen nuestro (PART 14 §14.2). El `filename*` en UTF-8 conserva tildes y ñ;
 * el `filename` ASCII es el respaldo para clientes viejos.
 */
export async function presignGet(
  key: string,
  downloadName: string,
  expiresIn: number = SIGNED_URL_TTL_SECONDS,
): Promise<string> {
  const { client, bucket } = getClient()
  const safeName = sanitizeDownloadName(downloadName)
  const asciiName = safeName.replace(/[^\x20-\x7e]/g, '_')

  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(safeName)}`,
    }),
    { expiresIn },
  )
}

/**
 * Mueve un objeto: copia y después borra. R2 (como S3) no tiene rename.
 *
 * El borrado va después de una copia exitosa; si el borrado falla, el objeto de
 * cuarentena queda huérfano y lo levanta la purga diaria — perder el original
 * antes de tener la copia sería perder el archivo del usuario.
 */
export async function moveObject(fromKey: string, toKey: string): Promise<void> {
  const { client, bucket } = getClient()
  const copySource = `${bucket}/${fromKey.split('/').map(encodeURIComponent).join('/')}`

  await client.send(new CopyObjectCommand({ Bucket: bucket, Key: toKey, CopySource: copySource }))
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: fromKey }))
}

/** Borra un objeto. Idempotente: borrar algo que no existe no es un error en S3. */
export async function deleteObject(key: string): Promise<void> {
  const { client, bucket } = getClient()
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
}

/**
 * Metadatos reales del objeto, o null si no existe.
 *
 * `finalize_upload` compara este tamaño contra el declarado por el cliente: lo
 * que dijo el navegador es una pista, esto es el dato.
 */
export async function headObject(
  key: string,
): Promise<{ size: number; contentType: string } | null> {
  const { client, bucket } = getClient()

  try {
    const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    return {
      size: head.ContentLength ?? 0,
      contentType: head.ContentType ?? 'application/octet-stream',
    }
  } catch (error: unknown) {
    if (isNotFound(error)) return null
    throw error
  }
}

/**
 * Sanea el nombre de descarga: se queda con el último segmento, tira caracteres
 * de control y los que romperían el header, y corta a 200. Los nombres de
 * archivo son entrada de usuario y viajan en un header HTTP.
 */
function sanitizeDownloadName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? ''

  const cleaned = Array.from(base)
    .filter((char) => {
      const code = char.codePointAt(0) ?? 0
      return code >= 0x20 && code !== 0x7f
    })
    .join('')
    .replace(/["\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_DOWNLOAD_NAME)
    .trim()

  return cleaned || FALLBACK_DOWNLOAD_NAME
}

function isNotFound(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false

  const candidate = error as { name?: string; $metadata?: { httpStatusCode?: number } }
  return (
    candidate.name === 'NotFound' ||
    candidate.name === 'NoSuchKey' ||
    candidate.$metadata?.httpStatusCode === 404
  )
}
