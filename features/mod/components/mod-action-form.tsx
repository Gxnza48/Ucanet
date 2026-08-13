'use client'

/**
 * features/mod/components/mod-action-form.tsx — S2, el bloque de acciones (§11.4.1).
 *
 * Está en la lista blanca de cliente por "dialog" (PART 19 §19.3): toda acción
 * destructiva confirma en un diálogo con el recorte del objetivo delante (§17.4.10),
 * y el motivo público se comparte entre todas las acciones para no reescribirlo en
 * cada formulario. El panel no es una página de contenido, así que este JS no pisa
 * el piso de rendimiento del producto público.
 *
 * El motivo público es obligatorio siempre: es lo que va a leer la persona
 * afectada, y una sanción sin motivo legible no es una sanción, es un misterio
 * (D3, §11.5.3). Las notas internas nunca salen del panel.
 *
 * "Ver autor" no es un botón directo. Es un diálogo que dice, antes de ejecutarse,
 * que la acción queda auditada — porque la fila `revelar_autor` que escribe la RPC
 * ES la auditoría (§11.4.2).
 */
import { useState, useTransition, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogActions, DialogClose } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { ActionResult } from '@/lib/result'
import {
  modLegalTakedown,
  modLockThread,
  modRemoveContent,
  modResolveReport,
  modRestoreContent,
  modRestrictUser,
  modRevealAuthor,
  modWarnUser,
} from '../actions'
import { RESTRICTION_DURATIONS, type TargetKind } from '../schemas'

type AnyResult = ActionResult<unknown>
type ActionFn = (prev: never, formData: FormData) => Promise<AnyResult>

export function ModActionForm({
  targetKind,
  publicId,
  excerpt,
  isAnonymous = false,
  authorHandle = null,
  reportId,
}: {
  targetKind: TargetKind
  /** `public_id` del contenido, o el handle si el objetivo es un perfil. */
  publicId: string
  /** Recorte del contenido: se muestra en cada confirmación destructiva. */
  excerpt?: string
  isAnonymous?: boolean
  /** Handle del autor, si es conocido (contenido firmado o perfil). */
  authorHandle?: string | null
  /** Reporte que originó la revisión, para poder cerrarlo desde acá. */
  reportId?: number
}) {
  const [motivo, setMotivo] = useState('')
  const [notas, setNotas] = useState('')
  const [state, setState] = useState<AnyResult | null>(null)
  const [pending, startTransition] = useTransition()
  const [revelado, setRevelado] = useState<string | null>(null)

  const esContenido = targetKind !== 'profile'
  const handle = authorHandle ?? revelado ?? (targetKind === 'profile' ? publicId : null)

  function run(action: ActionFn, fields: Record<string, string>, onDone?: (r: AnyResult) => void) {
    startTransition(async () => {
      const formData = new FormData()
      for (const [key, value] of Object.entries(fields)) formData.set(key, value)
      // Las Server Actions se llaman con `prev = null`: acá el estado lo maneja el
      // componente, no `useActionState`, porque un mismo motivo alimenta varias.
      const result = await action(null as never, formData)
      setState(result)
      if (result.ok) {
        setMotivo('')
        setNotas('')
      }
      onDone?.(result)
    })
  }

  const contenidoFields = { targetKind, publicId, motivo, notas }

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="text-s font-semibold text-text-secondary">Motivo</h2>
        <Field
          label="Motivo público"
          htmlFor="mod-motivo"
          required
          hint="Lo lee la persona afectada. Citá la regla: «Regla 4 — ataques a personas»."
          className="mt-2"
        >
          <Textarea
            id="mod-motivo"
            rows={3}
            maxLength={500}
            value={motivo}
            onChange={(event) => setMotivo(event.target.value)}
            placeholder="Se removió tu publicación por…"
          />
        </Field>
        <Field
          label="Notas internas"
          htmlFor="mod-notas"
          hint="No sale del panel: no va al aviso, ni a las vistas públicas, ni a la apelación."
          className="mt-3"
        >
          <Textarea
            id="mod-notas"
            rows={2}
            maxLength={2000}
            value={notas}
            onChange={(event) => setNotas(event.target.value)}
          />
        </Field>
      </section>

      {esContenido ? (
        <section>
          <h2 className="text-s font-semibold text-text-secondary">Contenido</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            <ConfirmButton
              label="Quitar"
              variant="danger"
              title="¿Quitar este contenido?"
              excerpt={excerpt}
              description="El contenido deja de verse en todo el sitio y la persona recibe el motivo en sus avisos. Puede apelar."
              confirmLabel="Quitar"
              disabled={pending || motivo.trim().length < 3}
              onConfirm={() => run(modRemoveContent, contenidoFields)}
            />

            <Button
              variant="secondary"
              type="button"
              disabled={pending || motivo.trim().length < 3}
              onClick={() => run(modRestoreContent, contenidoFields)}
            >
              Restaurar
            </Button>

            {targetKind === 'post' ? (
              <ConfirmButton
                label="Bloquear hilo"
                variant="secondary"
                title="¿Bloquear el hilo?"
                excerpt={excerpt}
                description="El contenido queda visible, pero no admite comentarios nuevos."
                confirmLabel="Bloquear"
                disabled={pending || motivo.trim().length < 3}
                onConfirm={() => run(modLockThread, { publicId, motivo, notas })}
              />
            ) : null}

            {targetKind === 'resource' ? (
              <ConfirmButton
                label="Retiro legal"
                variant="danger"
                title="¿Retirar el recurso por reclamo legal?"
                excerpt={excerpt}
                description="Usalo sólo para reclamos formales de derechos de autor (Ley 11.723). Queda registrado como retiro legal, no como remoción común."
                confirmLabel="Retirar"
                disabled={pending || motivo.trim().length < 3}
                onConfirm={() => run(modLegalTakedown, { publicId, motivo, notas })}
              />
            ) : null}
          </div>
        </section>
      ) : null}

      {isAnonymous && esContenido ? (
        <section>
          <h2 className="text-s font-semibold text-text-secondary">Autoría</h2>
          {revelado ? (
            <p className="mt-2 text-base text-text-primary">
              Autor: <span className="font-semibold">{revelado}</span>
              <span className="mt-1 block text-s text-text-secondary">
                Esta consulta quedó registrada en la auditoría.
              </span>
            </p>
          ) : (
            <div className="mt-2">
              <ConfirmButton
                label="Ver autor"
                variant="secondary"
                title="¿Ver el autor?"
                excerpt={excerpt}
                description="Ver el autor de contenido anónimo queda registrado en la auditoría."
                confirmLabel="Ver autor"
                disabled={pending || motivo.trim().length < 3}
                onConfirm={() =>
                  run(modRevealAuthor, { targetKind, publicId, motivo, notas }, (result) => {
                    const data = result.ok ? result.data : null
                    if (data && typeof data === 'object' && 'handle' in data) {
                      const value = (data as { handle: unknown }).handle
                      if (typeof value === 'string') setRevelado(value)
                    }
                  })
                }
              />
              <p className="mt-2 text-s text-text-secondary">
                Se pide el motivo porque esa fila es el registro: el equipo revisa las consultas sin
                acción asociada.
              </p>
            </div>
          )}
        </section>
      ) : null}

      {handle ? (
        <section>
          <h2 className="text-s font-semibold text-text-secondary">Cuenta</h2>
          <p className="mt-1 text-s text-text-secondary">{handle}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              type="button"
              disabled={pending || motivo.trim().length < 3}
              onClick={() => run(modWarnUser, { handle, motivo })}
            >
              Advertir
            </Button>

            {RESTRICTION_DURATIONS.map((duration) => (
              <ConfirmButton
                key={duration.value}
                label={`Suspender ${duration.label}`}
                variant="secondary"
                title={`¿Suspender la cuenta ${duration.label}?`}
                excerpt={handle}
                description="Durante la suspensión la persona puede leer, pero no publicar, comentar, votar, subir ni reportar. Recibe el motivo y puede apelar."
                confirmLabel="Suspender"
                disabled={pending || motivo.trim().length < 3}
                onConfirm={() =>
                  run(modRestrictUser, {
                    handle,
                    tipo: 'suspension',
                    dias: String(duration.value),
                    motivo,
                  })
                }
              />
            ))}

            <ConfirmButton
              label="Inhabilitar"
              variant="danger"
              title="¿Inhabilitar la cuenta de forma permanente?"
              excerpt={handle}
              description="Es la sanción máxima y no vence sola. La persona puede apelar dentro de los 30 días."
              confirmLabel="Inhabilitar"
              disabled={pending || motivo.trim().length < 3}
              onConfirm={() => run(modRestrictUser, { handle, tipo: 'ban', motivo })}
            />
          </div>
        </section>
      ) : null}

      {reportId ? (
        <section>
          <h2 className="text-s font-semibold text-text-secondary">Cerrar el reporte</h2>
          <p className="mt-1 text-s text-text-secondary">
            Cerrarlo avisa a quien reportó. El aviso es neutro y nunca cuenta la sanción.
          </p>
          <ResolveReport
            reportId={reportId}
            pending={pending}
            onResolve={(resolution) =>
              run(modResolveReport, { reportId: String(reportId), resolution })
            }
          />
        </section>
      ) : null}

      {state ? (
        <p role="status" className={state.ok ? 'text-s text-text-secondary' : 'text-s text-danger'}>
          {state.ok ? 'Listo. La acción quedó registrada.' : state.error}
        </p>
      ) : null}
    </div>
  )
}

function ResolveReport({
  reportId,
  pending,
  onResolve,
}: {
  reportId: number
  pending: boolean
  onResolve: (resolution: string) => void
}) {
  const [resolution, setResolution] = useState('resuelto')

  return (
    <div className="mt-2 flex flex-wrap items-end gap-2">
      <Field label="Resultado" htmlFor={`resolucion-${reportId}`} className="w-60">
        <Select
          id={`resolucion-${reportId}`}
          value={resolution}
          onChange={(event) => setResolution(event.target.value)}
        >
          <option value="resuelto">Se tomó una acción</option>
          <option value="desestimado">No hubo incumplimiento</option>
          <option value="resuelto_duplicado">Duplicado: ya se había revisado</option>
        </Select>
      </Field>
      <Button
        variant="secondary"
        type="button"
        disabled={pending}
        onClick={() => onResolve(resolution)}
        className="mb-6"
      >
        Cerrar reporte
      </Button>
    </div>
  )
}

/** Botón con confirmación: el recorte del objetivo va adentro del diálogo (§17.4.10). */
function ConfirmButton({
  label,
  title,
  description,
  excerpt,
  confirmLabel,
  variant,
  disabled,
  onConfirm,
}: {
  label: string
  title: string
  description: string
  excerpt?: string
  confirmLabel: string
  variant: 'primary' | 'secondary' | 'tertiary' | 'danger'
  disabled?: boolean
  onConfirm: () => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title={title}
      description={description}
      trigger={
        <Button variant={variant} type="button" disabled={disabled}>
          {label}
        </Button>
      }
    >
      {excerpt ? (
        <blockquote className="border-l border-border pl-3 text-base text-text-secondary">
          {excerpt}
        </blockquote>
      ) : null}
      <DialogActions>
        <DialogClose asChild>
          <Button variant="tertiary" type="button">
            Cancelar
          </Button>
        </DialogClose>
        <Button
          variant={variant === 'danger' ? 'danger' : 'primary'}
          type="button"
          onClick={() => {
            setOpen(false)
            onConfirm()
          }}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

/** Ranura para pasar contenido extra debajo del bloque de acciones. */
export function ModActionNote({ children }: { children: ReactNode }) {
  return <p className="text-s text-text-secondary">{children}</p>
}
