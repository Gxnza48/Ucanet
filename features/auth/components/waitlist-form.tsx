'use client'

/**
 * features/auth/components/waitlist-form.tsx — `/registro` en beta cerrada
 * (PART 6 §6.10, estado A).
 *
 * La beta abre carrera por carrera (D11), así que la carrera es el único dato útil además del
 * correo — y es opcional. No se guarda como texto libre: la Server Action la convierte en la
 * etiqueta corta de `waitlist.source`.
 *
 * Anotarse dos veces no es un error: la acción responde igual, sin decir si el correo ya
 * estaba. El estado B (registro abierto) no usa este formulario sino el de alta.
 */
import { useActionState } from 'react'
import { SubmitButton } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { ActionResult } from '@/lib/result'
import { joinWaitlist } from '../actions'
import type { CarreraOption } from '../queries'

/**
 * Lo único que el navegador necesita de una carrera acá: el slug (que es el valor que
 * viaja en el formulario) y el nombre. El `id` de `CarreraOption` es un bigint interno y
 * D14.7 lo deja del lado del servidor, así que no entra en las props de un componente de
 * cliente — todo lo que se le pasa a uno se serializa al navegador, se use o no.
 */
export type WaitlistCarrera = Pick<CarreraOption, 'slug' | 'nombre'>

export type WaitlistFormProps = {
  /** Catálogo para el select. Vacío deja el formulario en un solo campo. */
  carreras?: WaitlistCarrera[]
}

export function WaitlistForm({ carreras = [] }: WaitlistFormProps) {
  const [estado, enviar] = useActionState<ActionResult | null, FormData>(joinWaitlist, null)
  const error = estado && !estado.ok ? estado.error : null

  if (estado?.ok) {
    return <p aria-live="polite">Listo. Te avisamos apenas abra tu carrera.</p>
  }

  return (
    <form action={enviar} className="flex flex-col gap-4">
      <p>
        Estamos abriendo carrera por carrera para que la comunidad arranque con vida. Dejanos tu
        email y te avisamos cuando abra la tuya.
      </p>

      <Field label="Email" htmlFor="email" required>
        <Input name="email" type="email" autoComplete="email" inputMode="email" required />
      </Field>

      {carreras.length > 0 ? (
        <Field
          label="Carrera"
          htmlFor="carrera"
          hint="Opcional. Nos ayuda a saber por dónde abrir."
        >
          <Select name="carrera" defaultValue="">
            <option value="">Prefiero no decirla</option>
            {carreras.map((carrera) => (
              <option key={carrera.slug} value={carrera.slug}>
                {carrera.nombre}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      {error ? (
        <p role="alert" className="text-s text-danger">
          {error}
        </p>
      ) : null}

      <SubmitButton pendingLabel="Anotando…">Anotarme en la lista de espera</SubmitButton>
    </form>
  )
}
