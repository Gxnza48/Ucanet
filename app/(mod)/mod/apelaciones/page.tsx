import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Field } from '@/components/ui/field'
import { Select } from '@/components/ui/select'
import { modReviewAppeal } from '@/features/mod/actions'
import { listAppeals } from '@/features/mod/queries'
import { CONTENT_KIND_LABELS, MOD_ACTION_LABELS } from '@/features/mod/schemas'
import { formatDate, relativeTime } from '@/lib/utils/dates'

/**
 * app/(mod)/mod/apelaciones/page.tsx — la cola de apelaciones (PART 11 §11.5.2).
 *
 * Una apelación por decisión, dentro de los 30 días, un solo campo de texto. Lo que
 * hace que sea una apelación y no un segundo "no" es quién la revisa: **alguien
 * distinto del que tomó la decisión original**. Esa regla la aplica la base —
 * `mod_review_appeal` compara `mod_actions.actor_id` con `auth.uid()` y levanta
 * `NOT_ALLOWED` si son la misma persona (migración 0012). No es una validación de
 * pantalla que se pueda saltear: es la función la que se niega.
 *
 * El panel NO puede filtrar de antemano las apelaciones propias, y es un límite real
 * y anotado: `AppealItem` (BUILD CONTRACT §4.5) no expone el `actor_id` de la acción
 * original, así que esta pantalla no sabe cuáles te va a rechazar. Se avisa en el copy
 * y la base hace de pared. Mientras el equipo sea el fundador solo, la mayoría de las
 * apelaciones no van a tener segundo revisor — eso está dicho sin adornos en `/reglas`
 * ("mientras el equipo sea chico, puede revisar la misma persona"), y la salida no es
 * esconder el botón sino sumar moderadores (§11.8.2).
 *
 * SIN JAVASCRIPT DE RUTA. El formulario de revisión es un `<form>` nativo contra una
 * Server Action, y el resultado vuelve por la URL (patrón POST → redirect → GET). Una
 * pantalla interna que se usa quince veces por semana no justifica un componente de
 * cliente, y la lista blanca de PART 19 §19.3 no lo incluye.
 *
 * La revisión REGISTRA la decisión; no la ejecuta. Aceptar una apelación escribe la
 * fila `restaurar` y le avisa a la persona, pero restaurar el contenido de verdad o
 * revocar la restricción son acciones explícitas y aparte (§11.5.2) — el paso
 * material lo da un humano mirando el contenido, no un efecto colateral.
 */
export const metadata: Metadata = {
  title: 'Apelaciones',
}

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

const ESTADOS = ['pendiente', 'aceptada', 'rechazada'] as const
type AppealStatus = (typeof ESTADOS)[number]

const ESTADO_LABELS: Record<AppealStatus, string> = {
  pendiente: 'Pendientes',
  aceptada: 'Aceptadas',
  rechazada: 'Rechazadas',
}

/** Tope del mensaje de error que vuelve por la URL. Se renderiza como texto plano. */
const MAX_MESSAGE = 200

function param(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value
  const trimmed = raw?.trim()
  return trimmed ? trimmed : undefined
}

function asEstado(value: string | undefined): AppealStatus {
  return value && (ESTADOS as readonly string[]).includes(value)
    ? (value as AppealStatus)
    : 'pendiente'
}

/**
 * Envuelve `modReviewAppeal` para que un `<form action>` la pueda usar: la acción de
 * la feature devuelve `ActionResult` (la firma de `useActionState`) y un formulario
 * nativo espera `void`. El resultado se devuelve por la URL en lugar de por estado de
 * cliente. La validación, la sesión, la RPC y la revalidación siguen estando donde
 * corresponde — acá no hay lógica, hay traducción de forma.
 */
async function reviewAppealAction(formData: FormData): Promise<void> {
  'use server'

  const result = await modReviewAppeal(null, formData)

  const query = new URLSearchParams()
  const estado = formData.get('estado')
  if (typeof estado === 'string' && estado) query.set('estado', estado)
  if (result.ok) query.set('r', 'ok')
  else {
    query.set('r', 'error')
    query.set('m', result.error.slice(0, MAX_MESSAGE))
  }

  redirect(`/mod/apelaciones?${query.toString()}`)
}

/** Enlace público al objetivo de la acción original, cuando existe uno directo. */
function targetHref(kind: string, publicId: string): string | null {
  if (kind === 'post') return `/p/${publicId}`
  if (kind === 'resource') return `/recursos/${publicId}`
  if (kind === 'profile') return `/u/${publicId}`
  // Un comentario necesita el `public_id` de su publicación para el permalink, y la
  // acción original no lo guarda. Se muestra sin enlace antes que con uno roto.
  return null
}

export default async function AppealsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const estado = asEstado(param(sp.estado))
  const resultado = param(sp.r)
  const mensaje = param(sp.m)?.slice(0, MAX_MESSAGE)

  const appeals = await listAppeals(estado)

  return (
    <div>
      <form method="get" action="/mod/apelaciones" className="flex flex-wrap items-end gap-3">
        <Field label="Estado" htmlFor="filtro-estado-apelacion" className="w-56">
          <Select id="filtro-estado-apelacion" name="estado" defaultValue={estado}>
            {ESTADOS.map((value) => (
              <option key={value} value={value}>
                {ESTADO_LABELS[value]}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" variant="secondary" className="mb-6">
          Filtrar
        </Button>
      </form>

      {resultado === 'ok' ? (
        <p role="status" className="mt-2 text-m text-text-secondary">
          Listo. La revisión quedó registrada y la persona ya tiene el aviso.
        </p>
      ) : null}
      {resultado === 'error' ? (
        <p role="status" className="mt-2 text-m text-danger">
          {mensaje ?? 'No pudimos registrar la revisión.'} Si la decisión la tomaste vos, la
          revisión le toca a otra persona.
        </p>
      ) : null}

      <div className="mt-6">
        {appeals.length === 0 ? (
          <EmptyState
            title="No hay apelaciones en este estado."
            description="Cada sanción sale con su enlace para apelar. Cuando alguien lo use, la apelación aparece acá."
          />
        ) : (
          <ul className="flex flex-col gap-4">
            {appeals.map((appeal) => {
              const href = targetHref(appeal.targetKind, appeal.targetPublicId)
              const kindLabel =
                CONTENT_KIND_LABELS[appeal.targetKind as keyof typeof CONTENT_KIND_LABELS] ??
                appeal.targetKind

              return (
                <li key={appeal.id} className="rounded-container border border-border p-4">
                  <header>
                    <h2 className="text-base font-semibold text-text-primary">
                      {MOD_ACTION_LABELS[appeal.action] ?? appeal.action} · {kindLabel}
                    </h2>
                    <p className="mt-1 text-s text-text-secondary">
                      Apelación #{appeal.id} sobre la acción #{appeal.modActionId} ·{' '}
                      <time dateTime={appeal.createdAt} title={formatDate(appeal.createdAt)}>
                        {relativeTime(appeal.createdAt)}
                      </time>
                      {href ? (
                        <>
                          {' · '}
                          <Link href={href} className="text-accent hover:underline">
                            Ver el objetivo
                          </Link>
                        </>
                      ) : null}
                    </p>
                  </header>

                  <div className="mt-3">
                    <h3 className="text-s font-semibold text-text-secondary">
                      Motivo que se le dio en su momento
                    </h3>
                    <p className="user-content mt-1 text-base text-text-primary">
                      {appeal.motivoPublico}
                    </p>
                  </div>

                  <div className="mt-3">
                    <h3 className="text-s font-semibold text-text-secondary">Lo que apela</h3>
                    <blockquote className="user-content mt-1 border-l border-border pl-3 text-base text-text-primary">
                      {appeal.body}
                    </blockquote>
                  </div>

                  {appeal.status === 'pendiente' ? (
                    <form
                      action={reviewAppealAction}
                      className="mt-4 flex flex-wrap items-end gap-3"
                    >
                      <input type="hidden" name="appealId" value={appeal.id} />
                      <input type="hidden" name="estado" value={estado} />
                      <Field
                        label="Resultado"
                        htmlFor={`resolucion-${appeal.id}`}
                        className="w-64"
                        hint="Aceptar registra la marcha atrás; revertirla de verdad es una acción aparte."
                      >
                        <Select
                          id={`resolucion-${appeal.id}`}
                          name="resolucion"
                          defaultValue="rechazada"
                        >
                          <option value="rechazada">Se mantiene la decisión</option>
                          <option value="aceptada">Se da marcha atrás</option>
                        </Select>
                      </Field>
                      <Button type="submit" variant="secondary" className="mb-6">
                        Registrar la revisión
                      </Button>
                    </form>
                  ) : (
                    <p className="mt-4 text-s text-text-secondary">
                      Ya revisada:{' '}
                      {appeal.status === 'aceptada'
                        ? 'se dio marcha atrás'
                        : 'se mantuvo la decisión'}
                      . Se apela una sola vez por decisión.
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
