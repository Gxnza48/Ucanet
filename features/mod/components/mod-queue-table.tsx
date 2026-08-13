/**
 * features/mod/components/mod-queue-table.tsx — S1, la cola (§11.4.1, §17.4.10).
 *
 * Server Component: tabla densa, controles nativos, cero presupuesto de estética.
 * El moderador es un usuario avanzado sentado a un escritorio, y cada minuto de
 * pulido acá se le roba al producto público. Una fila por objetivo, no por
 * reporte: varios denunciantes sobre la misma cosa colapsan en un ítem con su
 * contador (§11.3.3).
 *
 * Lo que esta tabla NO muestra, por diseño: quién reportó (§11.4.1) y la autoría
 * de contenido anónimo (§11.4.2). El recorte de contenido sale de las vistas
 * `_public`, exactamente lo que ve cualquiera.
 */
import Link from 'next/link'

import { Chip } from '@/components/ui/chip'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@/components/ui/table'
import { relativeTime } from '@/lib/utils/dates'
import type { ReportQueueItem } from '../queries'
import { CONTENT_KIND_LABELS, REPORT_CATEGORIA_LABELS, REPORT_STATUS_LABELS } from '../schemas'

export function ModQueueTable({ items }: { items: ReportQueueItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="No hay nada en la cola."
        description="Cuando alguien reporte una publicación, un comentario, un recurso o un perfil, aparece acá."
      />
    )
  }

  const abiertos = items.filter(
    (item) => item.status === 'abierto' || item.status === 'en_revision',
  ).length
  const masViejo = items.reduce<string | null>(
    (oldest, item) => (oldest === null || item.createdAt < oldest ? item.createdAt : oldest),
    null,
  )

  return (
    <div>
      <p className="mb-3 text-s text-text-secondary">
        {abiertos} {abiertos === 1 ? 'abierto' : 'abiertos'}
        {masViejo ? ` · el más viejo ${relativeTime(masViejo)}` : ''}
      </p>

      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Fecha</TableHeaderCell>
            <TableHeaderCell>Tipo</TableHeaderCell>
            <TableHeaderCell>Categoría</TableHeaderCell>
            <TableHeaderCell>Reportes</TableHeaderCell>
            <TableHeaderCell>Contenido</TableHeaderCell>
            <TableHeaderCell>Estado</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="whitespace-nowrap text-text-secondary">
                <time dateTime={item.createdAt}>{relativeTime(item.createdAt)}</time>
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {CONTENT_KIND_LABELS[item.targetKind]}
              </TableCell>
              <TableCell>
                <span className="flex flex-wrap gap-1">
                  {item.priority ? <Chip>Prioritario</Chip> : null}
                  {item.categorias.map((categoria) => (
                    <Chip key={categoria} variant="neutral">
                      {REPORT_CATEGORIA_LABELS[categoria]}
                    </Chip>
                  ))}
                </span>
              </TableCell>
              <TableCell className="whitespace-nowrap tabular-nums">{item.reportCount}</TableCell>
              <TableCell>
                {/* El detalle es el único lugar donde se abre el contenido completo. */}
                <Link
                  href={`/mod/reportes/${item.id}`}
                  className="font-semibold text-accent hover:underline"
                >
                  {item.excerpt}
                </Link>
              </TableCell>
              <TableCell className="whitespace-nowrap text-text-secondary">
                {REPORT_STATUS_LABELS[item.status]}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
