'use client'

/**
 * features/mod/components/report-dialog.tsx — el flujo de dos toques (§11.3.2).
 *
 * "···" → "Reportar" → una radio list con las 12 categorías de §11.3.1 y un campo
 * de detalle → "Enviar reporte". Nada más: si reportar cuesta más que eso, la
 * gente no reporta, y a nuestra escala los reportes son casi el 100% de la
 * detección de abuso (§11.3.4).
 *
 * Está en la lista blanca de cliente por "dialog" (PART 19 §19.3). El detalle es
 * obligatorio en las tres categorías inaccionables sin texto; el mismo chequeo lo
 * repite el esquema en el servidor y el CHECK de la base.
 */
import { useActionState, useState, type ReactNode } from 'react'

import { Button, SubmitButton } from '@/components/ui/button'
import { Dialog, DialogActions, DialogClose } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { LIMITS } from '@/lib/config'
import type { ActionResult } from '@/lib/result'
import { createReport } from '../actions'
import {
  CATEGORIAS_CON_DETALLE_OBLIGATORIO,
  CONTENT_KIND_LABELS,
  REPORT_CATEGORIAS,
  type ReportCategoria,
  type TargetKind,
} from '../schemas'

export function ReportDialog({
  targetKind,
  targetPublicId,
  trigger,
}: {
  targetKind: TargetKind
  /** `public_id` del contenido, o el handle cuando se reporta un perfil. */
  targetPublicId: string
  trigger?: ReactNode
}) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(createReport, null)
  const [categoria, setCategoria] = useState<ReportCategoria | ''>('')
  const [open, setOpen] = useState(false)

  const detalleObligatorio =
    categoria !== '' && CATEGORIAS_CON_DETALLE_OBLIGATORIO.includes(categoria)
  const enviado = state?.ok === true

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title={`Reportar ${CONTENT_KIND_LABELS[targetKind].toLowerCase()}`}
      description={
        enviado
          ? undefined
          : 'Elegí el motivo que mejor describa el problema. Lo revisa una persona.'
      }
      trigger={
        trigger ?? (
          <Button variant="tertiary" type="button">
            Reportar
          </Button>
        )
      }
    >
      {enviado ? (
        <div>
          <p className="text-base text-text-primary">
            Recibimos tu reporte. Te vamos a avisar cuando lo revisemos.
          </p>
          <DialogActions>
            <DialogClose asChild>
              <Button variant="secondary" type="button">
                Cerrar
              </Button>
            </DialogClose>
          </DialogActions>
        </div>
      ) : (
        <form action={formAction}>
          <input type="hidden" name="targetKind" value={targetKind} />
          <input type="hidden" name="targetPublicId" value={targetPublicId} />

          <fieldset className="border-0 p-0">
            <legend className="sr-only">Motivo del reporte</legend>
            <ul>
              {REPORT_CATEGORIAS.map((item) => (
                <li key={item.value}>
                  <label className="flex cursor-pointer items-center gap-2 py-2 text-base text-text-primary">
                    <input
                      type="radio"
                      name="categoria"
                      value={item.value}
                      checked={categoria === item.value}
                      onChange={() => setCategoria(item.value)}
                      className="size-4 shrink-0"
                      required
                    />
                    <span>{item.label}</span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>

          <Field
            label="Contanos más"
            htmlFor="reporte-detalle"
            required={detalleObligatorio}
            hint={
              detalleObligatorio
                ? 'En esta categoría el detalle es obligatorio: sin él no se puede accionar.'
                : 'Opcional. Ayuda a entender el problema más rápido.'
            }
            className="mt-3"
          >
            <Textarea
              id="reporte-detalle"
              name="detalle"
              rows={3}
              maxLength={LIMITS.reportDetail}
              placeholder="Qué pasó, en pocas palabras"
            />
          </Field>

          {state && !state.ok ? (
            <p role="alert" className="mt-3 text-s text-danger">
              {state.error}
            </p>
          ) : null}

          <DialogActions>
            <DialogClose asChild>
              <Button variant="tertiary" type="button">
                Cancelar
              </Button>
            </DialogClose>
            <SubmitButton pendingLabel="Enviando…">Enviar reporte</SubmitButton>
          </DialogActions>
        </form>
      )}
    </Dialog>
  )
}
