'use client'

/**
 * features/mod/components/appeal-form.tsx — el formulario de `/apelacion` (§11.5.2).
 *
 * Una apelación por decisión, dentro de los 30 días, un solo campo. La revisa
 * alguien distinto del que decidió; mientras el equipo sea chico puede tocarle a
 * la misma persona, y eso está dicho en `/reglas` sin adornos.
 *
 * Cliente por la misma razón que el compositor (PART 19 §19.3): el error del
 * servidor se muestra al lado del campo sin perder lo escrito. Una cuenta
 * suspendida o baneada llega hasta acá: la restricción corta la participación, no
 * el debido proceso.
 */
import { useActionState } from 'react'
import Link from 'next/link'

import { SubmitButton } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { LIMITS } from '@/lib/config'
import type { ActionResult } from '@/lib/result'
import { createAppeal } from '../actions'

export function AppealForm({ modActionId }: { modActionId?: number }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(createAppeal, null)

  // Sin decisión asociada no hay nada que apelar: cada apelación cuelga de una
  // acción concreta, y el enlace con el id llega desde el aviso de la sanción.
  if (!modActionId) {
    return (
      <div>
        <p className="text-base text-text-primary">
          Para apelar, entrá desde el aviso de la decisión que querés revisar.
        </p>
        <p className="mt-3">
          <Link
            href="/avisos"
            className="text-m font-semibold text-accent hover:text-accent-hover hover:underline"
          >
            Ir a mis avisos
          </Link>
        </p>
      </div>
    )
  }

  if (state?.ok) {
    return (
      <div>
        <p className="text-base text-text-primary">
          Recibimos tu apelación. La revisa una persona distinta de la que tomó la decisión.
        </p>
        <p className="mt-2 text-s text-text-secondary">
          Te vamos a avisar el resultado. Se apela una sola vez por decisión.
        </p>
      </div>
    )
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="modActionId" value={modActionId} />
      <Field
        label="Contanos por qué creés que la decisión fue un error"
        htmlFor="apelacion-body"
        required
        error={state && !state.ok ? state.error : undefined}
        hint={`Máximo ${LIMITS.appealBody.toLocaleString('es-AR')} caracteres. La lee una persona.`}
      >
        <Textarea id="apelacion-body" name="body" rows={6} maxLength={LIMITS.appealBody} required />
      </Field>
      <div className="mt-4">
        <SubmitButton pendingLabel="Enviando…">Enviar la apelación</SubmitButton>
      </div>
    </form>
  )
}
