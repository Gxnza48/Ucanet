/**
 * features/recursos/components/resource-view.tsx — la ficha de un recurso
 * (PART 17 §17.4.5, PART 14 §14.5).
 *
 * Server Component, cero JavaScript propio: el título, los metadatos, la
 * descripción y la lista de archivos son la página que Google indexa y la que un
 * estudiante va a abrir en 2036 (D1, C16). Lo único que necesita cliente —el
 * control de voto y el menú de acciones— entra por las ranuras `vote` y
 * `actions`, que compone la página: así esta ficha sigue siendo estática aunque
 * arriba haya interactividad.
 *
 * Un recurso anónimo se rotula "Anónimo" y punto: `resources_public` ya devolvió
 * `author_handle` en null y acá no hay ningún camino de vuelta al autor (D3).
 */
import Link from 'next/link'
import type { ReactNode } from 'react'

import { Chip } from '@/components/ui/chip'
import { formatDate, relativeTime } from '@/lib/utils/dates'

import type { ResourceDetail } from '../queries'
import { MIME_LABELS, TIPO_LABELS, formatBytes, plural } from '../schemas'
import { DownloadButton } from './download-button'

export type ResourceViewProps = {
  resource: ResourceDetail
  /** Hay sesión iniciada: gobierna el botón de descarga (§14.5). */
  authenticated: boolean
  /** Control de voto, que es de cliente (§17.5.1). Lo pone la página. */
  vote?: ReactNode
  /** Menú de acciones: "Reportar" siempre, "Editar"/"Eliminar" para el autor. */
  actions?: ReactNode
  className?: string
}

export function ResourceView({
  resource,
  authenticated,
  vote,
  actions,
  className,
}: ResourceViewProps) {
  // Con un solo archivo la ruta de descarga no necesita saber cuál es.
  const multiple = resource.files.length > 1

  return (
    <article className={className}>
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Chip variant="neutral">{TIPO_LABELS[resource.tipo]}</Chip>
          {resource.anio === null ? null : <Chip variant="neutral">{resource.anio}</Chip>}
        </div>

        <h1 className="text-xl font-semibold text-text-primary">{resource.title}</h1>

        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-s text-text-secondary">
          {resource.materia ? (
            <>
              <Link href={`/materias/${resource.materia.slug}`} className="text-accent">
                {resource.materia.nombre}
              </Link>
              <span aria-hidden="true">·</span>
            </>
          ) : null}
          <span>Subido por {authorLabel(resource)}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={resource.createdAt} title={formatDate(resource.createdAt)}>
            {relativeTime(resource.createdAt)}
          </time>
          <span aria-hidden="true">·</span>
          <span>{plural(resource.downloadsCount, 'descarga', 'descargas')}</span>
        </p>

        {resource.editedAt ? (
          <p className="text-s text-text-secondary">
            Actualizado el {formatDate(resource.editedAt)}
          </p>
        ) : null}
      </header>

      {resource.description ? (
        <p className="user-content mt-5 text-base text-text-primary">{resource.description}</p>
      ) : null}

      <section className="mt-6 flex flex-col gap-3" aria-labelledby="recurso-archivos">
        <h2 id="recurso-archivos" className="text-s font-semibold text-text-primary">
          {resource.files.length === 1 ? 'Archivo' : 'Archivos'}
        </h2>

        {resource.files.length === 0 ? (
          <p className="text-m text-text-secondary">Este recurso no tiene archivos disponibles.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {resource.files.map((file) => (
              <li
                key={file.position}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-m text-text-primary">{file.originalName}</span>
                  <span className="text-s text-text-secondary">
                    {MIME_LABELS[file.mime]} · {formatBytes(file.sizeBytes)}
                  </span>
                </span>
                <DownloadButton
                  publicId={resource.publicId}
                  authenticated={authenticated}
                  mime={file.mime}
                  sizeBytes={file.sizeBytes}
                  {...(multiple ? { filePosition: file.position } : {})}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {vote || actions ? (
        <div className="mt-5 flex flex-wrap items-center gap-4">
          {vote}
          {actions}
        </div>
      ) : null}
    </article>
  )
}

/** "Anónimo" o el seudónimo, que enlaza al perfil público (§14.6, D3). */
function authorLabel(resource: ResourceDetail): ReactNode {
  if (resource.isAnonymous || !resource.authorHandle) return 'Anónimo'

  return (
    <Link href={`/u/${resource.authorHandle}`} className="text-accent">
      {resource.authorHandle}
    </Link>
  )
}
