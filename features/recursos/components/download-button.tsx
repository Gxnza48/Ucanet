/**
 * features/recursos/components/download-button.tsx — el botón de descarga de
 * PART 14 §14.5.
 *
 * Es un `<a>` a `/recursos/[publicId]/descargar`, no un `onClick`: la descarga
 * tiene que andar sin JavaScript, y esa ruta es un route handler que llama a
 * `register_download` (límite horario + conteo deduplicado por usuario-día) y
 * responde 302 a una URL firmada de R2 de 120 s. Un `<a>` pelado y no `<Link>`
 * a propósito — `next/link` prefetchea, y prefetchear una descarga sería
 * registrar descargas que nadie pidió y quemar el límite del visitante.
 *
 * Sin sesión, el botón no descarga: invita a entrar (§14.5, el momento de
 * conversión más fuerte del producto). Los metadatos del recurso son públicos e
 * indexables; los bytes, no.
 *
 * CONVENCIÓN CON LA RUTA: con varios archivos, cada botón agrega `?archivo=N`
 * con la `position` del archivo (1 a 3) —§17.4.5 pide un botón por archivo— y la
 * ruta debe usar ese parámetro para elegir cuál de las claves que devuelve
 * `register_download` firma. Sin el parámetro, la ruta sirve el primero.
 */
import Link from 'next/link'

import { buttonClasses } from '@/components/ui/button-styles'
import type { AcceptedMime } from '@/lib/config'

import { MIME_LABELS, formatBytes } from '../schemas'

export type DownloadButtonProps = {
  publicId: string
  /** Hay sesión iniciada. Lo resuelve la página en el servidor, nunca el cliente. */
  authenticated: boolean
  /** Tipo del archivo, para el rótulo "Descargar (PDF, 2,4 MB)". */
  mime?: AcceptedMime | null
  sizeBytes?: number
  /** `position` del archivo (1 a 3) cuando el recurso tiene más de uno. */
  filePosition?: number
  className?: string
}

export function DownloadButton({
  publicId,
  authenticated,
  mime,
  sizeBytes,
  filePosition,
  className,
}: DownloadButtonProps) {
  if (!authenticated) {
    // Destino interno: acá sí `next/link`, que es navegación de la aplicación y
    // no una descarga.
    return (
      <Link
        href={`/ingresar?next=${encodeURIComponent(`/recursos/${publicId}`)}`}
        className={buttonClasses('primary', className)}
      >
        Ingresá para descargar
      </Link>
    )
  }

  const query = filePosition === undefined ? '' : `?archivo=${filePosition}`

  return (
    <a
      href={`/recursos/${publicId}/descargar${query}`}
      // Los buscadores no tienen por qué golpear una ruta que escribe en
      // download_log; además, sin sesión, solo verían el redirect a /ingresar.
      rel="nofollow"
      className={buttonClasses('primary', className)}
    >
      {label(mime, sizeBytes)}
    </a>
  )
}

function label(mime: AcceptedMime | null | undefined, sizeBytes: number | undefined): string {
  const parts: string[] = []
  if (mime) parts.push(MIME_LABELS[mime])
  if (sizeBytes !== undefined && sizeBytes > 0) parts.push(formatBytes(sizeBytes))

  return parts.length > 0 ? `Descargar (${parts.join(', ')})` : 'Descargar'
}
