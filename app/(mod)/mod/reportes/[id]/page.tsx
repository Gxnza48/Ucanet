import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Breadcrumb } from '@/components/ui/breadcrumb'
import { Chip } from '@/components/ui/chip'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@/components/ui/table'
import { ModActionForm } from '@/features/mod/components/mod-action-form'
import { getModActionsForUser, getReportDetail } from '@/features/mod/queries'
import {
  CONTENT_KIND_LABELS,
  MOD_ACTION_LABELS,
  REPORT_CATEGORIA_LABELS,
  REPORT_CATEGORIA_REGLA,
  REPORT_STATUS_LABELS,
} from '@/features/mod/schemas'
import { formatDate, relativeTime } from '@/lib/utils/dates'
import { excerpt } from '@/lib/utils/text'

/**
 * app/(mod)/mod/reportes/[id]/page.tsx — S2, el detalle (PART 11 §11.4.1).
 *
 * Una decisión de moderación se toma acá y en ningún otro lado, con las tres cosas
 * que hacen falta a la vista al mismo tiempo: el contenido tal como lo ven los
 * usuarios, todos los reportes sobre ese mismo objetivo, y el historial de la cuenta.
 * Poner las acciones abajo del contenido y no arriba es deliberado: se decide después
 * de leer, no antes.
 *
 * DOS REGLAS DE ANONIMATO QUE ESTA PANTALLA NO ROMPE:
 *
 * 1. **El denunciante no aparece nunca** (§11.4.1). Ni el handle, ni un enlace, ni una
 *    inicial. Se ve la categoría, el detalle que escribió y la fecha. Reportar tiene
 *    que ser seguro o deja de haber reportes, y los reportes son ~el 100% de la
 *    detección de abuso a esta escala.
 * 2. **La autoría anónima no es ambiental** (§11.4.2). El contenido se lee por las
 *    vistas `_public`, que ya anulan el autor de lo anónimo. Destaparlo es una acción
 *    aparte, con motivo obligatorio, y la fila `revelar_autor` que escribe ES la
 *    auditoría. Por eso el historial de cuenta de abajo aparece sólo cuando el handle
 *    ya se conoce (contenido firmado o reporte contra un perfil): pedirlo antes sería
 *    convertir una revelación auditada en una lectura de página.
 *
 * El id es un bigint interno y viaja en la URL. Es la excepción explícita a D14.7 que
 * documenta `features/mod/queries.ts`: el panel es una superficie interna y las RPC de
 * moderación reciben bigint. Ningún id de estos sale a una página pública.
 */

type Params = Promise<{ id: string }>

/** El id de la URL, si es un bigint positivo. Cualquier otra cosa es un 404. */
function parseId(raw: string): number | null {
  if (!/^[0-9]{1,18}$/.test(raw)) return null
  const value = Number(raw)
  return Number.isSafeInteger(value) && value > 0 ? value : null
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params
  const parsed = parseId(id)
  return { title: parsed ? `Reporte #${parsed}` : 'Reporte' }
}

export default async function ReportDetailPage({ params }: { params: Params }) {
  const { id } = await params
  const reportId = parseId(id)
  if (reportId === null) notFound()

  const detail = await getReportDetail(reportId)
  if (!detail) notFound()

  const { target, targetKind } = detail
  const kindLabel = CONTENT_KIND_LABELS[targetKind]

  // Handle conocido sin revelar nada: perfil reportado, o contenido firmado.
  const knownHandle =
    targetKind === 'profile'
      ? detail.targetPublicId
      : target.isAnonymous
        ? null
        : target.authorHandle

  const history = knownHandle ? await getModActionsForUser(knownHandle) : []

  return (
    <div>
      <Breadcrumb items={[{ href: '/mod', label: 'Cola' }, { label: `Reporte #${detail.id}` }]} />

      <header className="mt-4">
        <h2 className="text-l font-semibold text-text-primary">
          {kindLabel} · {REPORT_STATUS_LABELS[detail.status]}
        </h2>
        <p className="mt-1 text-s text-text-secondary">
          Primer reporte <time dateTime={detail.createdAt}>{relativeTime(detail.createdAt)}</time> ·{' '}
          {detail.reports.length}{' '}
          {detail.reports.length === 1 ? 'reporte en total' : 'reportes en total'}
          {target.href ? (
            <>
              {' · '}
              <Link href={target.href} className="text-accent hover:underline">
                Ver en el sitio
              </Link>
            </>
          ) : null}
        </p>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* El contenido denunciado, como lo ve cualquiera                      */}
      {/* ------------------------------------------------------------------ */}
      <section className="mt-6">
        <h3 className="text-s font-semibold text-text-secondary">Contenido denunciado</h3>
        <div className="mt-2 rounded-container border border-border p-4">
          {target.missing ? (
            <p className="text-base text-text-secondary">
              El contenido ya no está en las vistas públicas: lo removieron, lo borró su autor o lo
              purgó la retención. El reporte se puede cerrar igual.
            </p>
          ) : (
            <>
              {target.title ? (
                <p className="text-base font-semibold text-text-primary">{target.title}</p>
              ) : null}
              {target.body ? (
                <p className="user-content mt-2 text-base text-text-primary">{target.body}</p>
              ) : (
                <p className="mt-2 text-base text-text-secondary">Sin texto.</p>
              )}
              <p className="mt-3 text-s text-text-secondary">
                {target.isAnonymous
                  ? 'Publicado en anónimo. El autor no se muestra acá.'
                  : target.authorHandle
                    ? `Autor: ${target.authorHandle}`
                    : 'Sin autor visible.'}
              </p>
            </>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Los reportes — sin denunciantes                                     */}
      {/* ------------------------------------------------------------------ */}
      <section className="mt-6">
        <h3 className="text-s font-semibold text-text-secondary">Reportes sobre este objetivo</h3>
        <div className="mt-2">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Fecha</TableHeaderCell>
                <TableHeaderCell>Categoría</TableHeaderCell>
                <TableHeaderCell>Detalle</TableHeaderCell>
                <TableHeaderCell>Estado</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {detail.reports.map((report) => {
                const regla = REPORT_CATEGORIA_REGLA[report.categoria]
                return (
                  <TableRow key={report.id}>
                    <TableCell className="whitespace-nowrap text-text-secondary">
                      <time dateTime={report.createdAt} title={formatDate(report.createdAt)}>
                        {relativeTime(report.createdAt)}
                      </time>
                    </TableCell>
                    <TableCell>
                      <Chip variant="neutral">{REPORT_CATEGORIA_LABELS[report.categoria]}</Chip>
                      {regla !== null ? (
                        <span className="ml-2 whitespace-nowrap text-text-secondary">
                          Regla {regla}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="user-content">{report.detalle ?? '—'}</TableCell>
                    <TableCell className="whitespace-nowrap text-text-secondary">
                      {REPORT_STATUS_LABELS[report.status]}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
        <p className="mt-2 text-s text-text-secondary">
          Quién reportó no se muestra en ningún lado del panel. Reportar tiene que ser seguro.
        </p>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Historial de la cuenta                                              */}
      {/* ------------------------------------------------------------------ */}
      <section className="mt-6">
        <h3 className="text-s font-semibold text-text-secondary">Historial de la cuenta</h3>
        {!knownHandle ? (
          <p className="mt-2 text-base text-text-secondary">
            El objetivo es anónimo. Para ver el historial hay que ver el autor primero, y esa
            consulta queda registrada en la auditoría.
          </p>
        ) : history.length === 0 ? (
          <p className="mt-2 text-base text-text-secondary">
            {knownHandle} no tiene acciones de moderación previas contra su cuenta.
          </p>
        ) : (
          <div className="mt-2">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Fecha</TableHeaderCell>
                  <TableHeaderCell>Acción</TableHeaderCell>
                  <TableHeaderCell>Motivo público</TableHeaderCell>
                  <TableHeaderCell>Notas internas</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {history.map((action) => (
                  <TableRow key={action.id}>
                    <TableCell className="whitespace-nowrap text-text-secondary">
                      <time dateTime={action.createdAt} title={formatDate(action.createdAt)}>
                        {relativeTime(action.createdAt)}
                      </time>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {MOD_ACTION_LABELS[action.action] ?? action.action}
                    </TableCell>
                    <TableCell>{excerpt(action.motivoPublico, 160)}</TableCell>
                    <TableCell className="text-text-secondary">
                      {action.notasInternas ? excerpt(action.notasInternas, 160) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="mt-2 text-s text-text-secondary">
              Las sanciones de más de 12 meses no cuentan para la escalera de §11.5.1: la gente se
              gradúa de su versión de primer año.
            </p>
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Acciones                                                            */}
      {/* ------------------------------------------------------------------ */}
      <section className="mt-8 border-t border-border pt-6">
        <h3 className="text-base font-semibold text-text-primary">Acciones</h3>
        {detail.targetPublicId ? (
          <div className="mt-4">
            <ModActionForm
              targetKind={targetKind}
              publicId={detail.targetPublicId}
              excerpt={excerpt(target.title ?? target.body ?? '', 200)}
              isAnonymous={target.isAnonymous}
              authorHandle={knownHandle}
              reportId={detail.id}
            />
          </div>
        ) : (
          <p className="mt-2 text-base text-text-secondary">
            No pudimos resolver el objetivo del reporte, así que no hay nada sobre lo que actuar.
            Cerralo como duplicado o desestimalo desde la cola.
          </p>
        )}
      </section>
    </div>
  )
}
