'use client'

/**
 * features/auth/components/recover-form.tsx — `/recuperar` (PART 6 §6.8, PART 9 §9.8).
 *
 * La respuesta es siempre la misma exista o no la cuenta: el formulario no puede convertirse
 * en un verificador de direcciones registradas. Por eso el estado de éxito no dice "te
 * mandamos" sino "si existe una cuenta con ese email".
 *
 * El texto de abajo es la parte incómoda y va igual: sin acceso al correo la cuenta no vuelve.
 * Es el precio de no guardar ninguna identidad real, y decirlo antes es mejor que descubrirlo
 * después.
 */
import Link from 'next/link'
import { useActionState } from 'react'
import { SubmitButton } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import type { ActionResult } from '@/lib/result'
import { requestPasswordReset } from '../actions'

export function RecoverForm() {
  const [estado, enviar] = useActionState<ActionResult | null, FormData>(requestPasswordReset, null)
  const error = estado && !estado.ok ? estado.error : null

  if (estado?.ok) {
    return (
      <section aria-live="polite" className="flex flex-col gap-3">
        <p>Si existe una cuenta con ese email, te va a llegar un link en unos minutos.</p>
        <p className="text-s text-text-secondary">
          Revisá también el correo no deseado. El link vence en una hora y se usa una sola vez.
        </p>
      </section>
    )
  }

  return (
    <form action={enviar} className="flex flex-col gap-4">
      <p>
        Ingresá el email con el que te registraste y te mandamos un link para crear una contraseña
        nueva.
      </p>

      <Field label="Email" htmlFor="email" required>
        <Input
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          autoFocus
        />
      </Field>

      {error ? (
        <p role="alert" className="text-s text-danger">
          {error}
        </p>
      ) : null}

      <SubmitButton pendingLabel="Enviando…">Enviar link</SubmitButton>

      <p className="text-s text-text-secondary">
        Si ya no tenés acceso a ese email, no podemos verificar que la cuenta sea tuya y no vamos a
        poder recuperarla. Podés{' '}
        <Link href="/registro" className="text-accent">
          crear una cuenta nueva
        </Link>
        .
      </p>
    </form>
  )
}
