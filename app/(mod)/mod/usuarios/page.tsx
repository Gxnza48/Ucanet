import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@/components/ui/table'
import { modRevokeRestriction } from '@/features/mod/actions'
import { getModActionsForUser, listRestrictions } from '@/features/mod/queries'
import { MOD_ACTION_LABELS } from '@/features/mod/schemas'
import { formatDate, relativeTime } from '@/lib/utils/dates'
import { excerpt } from '@/lib/utils/text'

/**
 * app/(mod)/mod/usuarios/page.tsx — restricciones vigentes e historial de cuenta
 * (PART 11 §11.4.1 S3, §11.5.1).
 *
 * DOS COSAS EN UNA PANTALLA, porque son la misma pregunta desde dos lados: "¿a quién
 * tenemos sancionado ahora?" y "¿qué pasó antes con esta cuenta?".
 *
 * 1. **Restricciones activas.** Activa = `revoked_at is null` y (`until is null` o
 *    `until` futuro), el mismo predicado que centraliza `has_active_restriction()` en
 *    la base. Una suspensión vencida desaparece sola de esta lista sin que nadie haga
 *    nada: el vencimiento es un hecho del reloj, no un trabajo pendiente.
 * 2. **Historial por seudónimo.** Un `<form method="get">` que carga la cuenta en la
 *    URL. Es la entrada de los casos de patrón — el hostigador serial que acumula
 *    reportes chicos y ninguno alcanza por sí solo (§11.4.1 S3).
 *
 * LAS RESTRICCIONES SE REVOCAN, NO SE BORRAN. `mod_revoke_restriction` marca
 * `revoked_at` y escribe su fila en `mod_actions`: la sanción sigue estando en la
 * historia y la marcha atrás también. Que un ban equivocado se pueda reparar es un
 * requisito del sistema (§11.5.1), y que la reparación quede escrita también.
 *
 * LO QUE ESTA PANTALLA NO PUEDE MOSTRAR: el contenido que publicó esa cuenta. El
 * vínculo contenido→autor vive en `posts.author_id`, que el panel no lee por diseño
 * (D14.5), y atarlo pieza por pieza exigiría una revelación auditada por cada una
 * (§11.4.2). El historial que sí se ve son las acciones contra la cuenta.
 *
 * SIN JAVASCRIPT DE RUTA: formularios nativos contra Server Actions, resultado por
 * URL (POST → redirect → GET).
 */
export const metadata: Metadata = {
  title: 'Usuarios',
}

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

const HANDLE_PATTERN = /^[A-Za-z0-9_]{3,24}$/

const TIPO_LABELS: Record<string, string> = {
  suspension: 'Suspensión',
  ban: 'Inhabilitación',
}

/** Tope del mensaje que vuelve por la URL. Se renderiza como texto plano. */
const MAX_MESSAGE = 200

function param(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value
  const trimmed = raw?.trim()
  return trimmed ? trimmed : undefined
}

/**
 * Envuelve `modRevokeRestriction` para un `<form action>` nativo: la acción de la
 * feature devuelve `ActionResult` y el formulario espera `void`. El resultado vuelve
 * por la URL. Sin lógica propia: la validación, la sesión, la RPC y la revalidación
 * están donde tienen que estar.
 */
async function revokeRestrictionAction(formData: FormData): Promise<void> {
  'use server'

  const result = await modRevokeRestriction(null, formData)

  const query = new URLSearchParams()
  const handle = formData.get('handle')
  if (typeof handle === 'string' && HANDLE_PATTERN.test(handle)) query.set('handle', handle)
  if (result.ok) query.set('r', 'ok')
  else {
    query.set('r', 'error')
    query.set('m', result.error.slice(0, MAX_MESSAGE))
  }

  redirect(`/mod/usuarios?${query.toString()}`)
}

export default async function ModUsersPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const handleRaw = param(sp.handle)
  const handle = handleRaw && HANDLE_PATTERN.test(handleRaw) ? handleRaw : undefined
  const resultado = param(sp.r)
  const mensaje = param(sp.m)?.slice(0, MAX_MESSAGE)

  const [restrictions, history] = await Promise.all([
    listRestrictions(),
    handle ? getModActionsForUser(handle) : Promise.resolve([]),
  ])

  return (
    <div>
      {resultado === 'ok' ? (
        <p role="status" className="text-m text-text-secondary">
          Listo. La restricción quedó revocada y la marcha atrás está registrada.
        </p>
      ) : null}
      {resultado === 'error' ? (
        <p role="status" className="text-m text-danger">
          {mensaje ?? 'No pudimos revocar la restricción.'}
        </p>
      ) : null}

      {/* ------------------------------------------------------------------ */}
      {/* Restricciones vigentes                                              */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <h2 className="text-base font-semibold text-text-primary">Restricciones vigentes</h2>
        <p className="mt-1 text-s text-text-secondary">
          Una suspensión con fecha vence sola. La inhabilitación no vence: sale de esta lista
          únicamente si alguien la revoca.
        </p>

        {restrictions.length === 0 ? (
          <EmptyState
            className="mt-2"
            title="No hay restricciones activas."
            description="Ninguna cuenta está suspendida ni inhabilitada en este momento."
          />
        ) : (
          <div className="mt-3">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Cuenta</TableHeaderCell>
                  <TableHeaderCell>Tipo</TableHeaderCell>
                  <TableHeaderCell>Desde</TableHeaderCell>
                  <TableHeaderCell>Hasta</TableHeaderCell>
                  <TableHeaderCell>Motivo</TableHeaderCell>
                  <TableHeaderCell>
                    <span className="sr-only">Acción</span>
                  </TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {restrictions.map((restriction) => (
                  <TableRow key={restriction.id}>
                    <TableCell className="whitespace-nowrap">
                      {restriction.handle ? (
                        <Link
                          href={`/mod/usuarios?handle=${encodeURIComponent(restriction.handle)}`}
                          className="font-semibold text-accent hover:underline"
                        >
                          {restriction.handle}
                        </Link>
                      ) : (
                        <span className="text-text-secondary">Cuenta eliminada</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {TIPO_LABELS[restriction.tipo] ?? restriction.tipo}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-text-secondary">
                      <time dateTime={restriction.startsAt}>
                        {formatDate(restriction.startsAt)}
                      </time>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-text-secondary">
                      {restriction.until ? (
                        <time dateTime={restriction.until}>{formatDate(restriction.until)}</time>
                      ) : (
                        'Sin vencimiento'
                      )}
                    </TableCell>
                    <TableCell>{excerpt(restriction.motivo, 160)}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <form action={revokeRestrictionAction}>
                        <input type="hidden" name="restrictionId" value={restriction.id} />
                        {restriction.handle ? (
                          <input type="hidden" name="handle" value={restriction.handle} />
                        ) : null}
                        <Button type="submit" variant="secondary">
                          Revocar
                        </Button>
                      </form>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Historial de una cuenta                                             */}
      {/* ------------------------------------------------------------------ */}
      <section className="mt-8 border-t border-border pt-6">
        <h2 className="text-base font-semibold text-text-primary">Historial de una cuenta</h2>

        <form method="get" action="/mod/usuarios" className="mt-3 flex flex-wrap items-end gap-3">
          <Field
            label="Seudónimo"
            htmlFor="buscar-handle"
            className="w-72"
            hint="Sin arroba. De 3 a 24 letras, números o guion bajo."
          >
            <Input
              id="buscar-handle"
              name="handle"
              defaultValue={handle ?? ''}
              autoComplete="off"
              maxLength={24}
              placeholder="MateConBizcochos"
            />
          </Field>
          <Button type="submit" variant="secondary" className="mb-6">
            Ver historial
          </Button>
        </form>

        {handleRaw && !handle ? (
          <p className="text-m text-danger">
            El seudónimo puede tener de 3 a 24 letras, números o guion bajo.
          </p>
        ) : null}

        {handle ? (
          history.length === 0 ? (
            <EmptyState
              title={`${handle} no tiene acciones registradas.`}
              description="O la cuenta está limpia, o el seudónimo no existe: el panel no distingue entre las dos cosas, y está bien que no lo haga."
            />
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Fecha</TableHeaderCell>
                  <TableHeaderCell>Acción</TableHeaderCell>
                  <TableHeaderCell>Objetivo</TableHeaderCell>
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
                    <TableCell className="whitespace-nowrap text-text-secondary">
                      {action.targetPublicId}
                    </TableCell>
                    <TableCell>{excerpt(action.motivoPublico, 160)}</TableCell>
                    <TableCell className="text-text-secondary">
                      {action.notasInternas ? excerpt(action.notasInternas, 160) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )
        ) : null}
      </section>
    </div>
  )
}
