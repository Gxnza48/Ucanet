/**
 * features/recursos/components/resource-row.tsx — la fila de recurso de PART 17
 * §17.4.5.
 *
 * Fila densa de dos líneas, explícitamente NO una tarjeta (§47 del brief y el
 * anti-checklist de PART 17): línea 1, chip de tipo + título; línea 2, materia ·
 * año · "PDF · 2,4 MB" · descargas · votos. Toda la fila es el link a la ficha.
 *
 * Server Component. No hay control de voto acá: los votos se emiten solo en la
 * ficha del recurso y en la de la publicación (§17.5.1), y las filas muestran el
 * número como texto — que además puede venir unos segundos desfasado de la
 * caché, lo cual está aceptado.
 */
import type { ReactNode } from 'react'

import { Chip } from '@/components/ui/chip'
import { ListRow } from '@/components/ui/list-row'

import type { ResourceListItem } from '../queries'
import { MIME_LABELS, NEW_RESOURCE_DAYS, TIPO_CHIP_LABELS, formatBytes, plural } from '../schemas'

const DAY_MS = 24 * 60 * 60 * 1000

export type ResourceRowProps = {
  resource: ResourceListItem
  className?: string
}

export function ResourceRow({ resource, className }: ResourceRowProps) {
  const meta: Array<{ key: string; node: ReactNode }> = []

  if (resource.materia) meta.push({ key: 'materia', node: resource.materia.nombre })
  if (resource.anio !== null) meta.push({ key: 'anio', node: String(resource.anio) })
  if (resource.primaryMime) {
    meta.push({ key: 'formato', node: MIME_LABELS[resource.primaryMime] })
  }
  if (resource.fileCount > 1) {
    meta.push({ key: 'archivos', node: plural(resource.fileCount, 'archivo', 'archivos') })
  }
  if (resource.totalBytes > 0) {
    meta.push({ key: 'tamano', node: formatBytes(resource.totalBytes) })
  }
  meta.push({
    key: 'descargas',
    node: plural(resource.downloadsCount, 'descarga', 'descargas'),
  })
  meta.push({
    key: 'votos',
    // El número se anuncia una sola vez: la versión visible lleva el triángulo y
    // queda oculta al lector de pantalla.
    node: (
      <>
        <span aria-hidden="true">▲ {resource.score}</span>
        <span className="sr-only">{plural(resource.score, 'voto', 'votos')}</span>
      </>
    ),
  })

  return (
    <ListRow
      className={className}
      href={`/recursos/${resource.publicId}`}
      title={
        <span className="flex flex-wrap items-center gap-2">
          <Chip variant="neutral">{TIPO_CHIP_LABELS[resource.tipo]}</Chip>
          <span className="min-w-0">{resource.title}</span>
          {isNew(resource.createdAt) ? <Chip>Nuevo</Chip> : null}
        </span>
      }
    >
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-s text-text-secondary">
        {meta.map((part, index) => (
          <span key={part.key} className="inline-flex items-center gap-2 whitespace-nowrap">
            {/* El punto separador es decoración: sin él, el lector de pantalla
                leería un punto entre cada dato de la línea. */}
            {index > 0 ? <span aria-hidden="true">·</span> : null}
            {part.node}
          </span>
        ))}
      </span>
    </ListRow>
  )
}

/** "Nuevo" durante 14 días (§14.7): compensación de arranque en frío del estante. */
function isNew(createdAt: string): boolean {
  const created = new Date(createdAt).getTime()
  if (Number.isNaN(created)) return false
  return Date.now() - created < NEW_RESOURCE_DAYS * DAY_MS
}
