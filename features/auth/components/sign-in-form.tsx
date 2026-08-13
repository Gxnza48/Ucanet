'use client'

/**
 * features/auth/components/sign-in-form.tsx — `/ingresar` (PART 6 §6.1, PART 9 §9.2.2).
 *
 * Cliente porque `useActionState` necesita estado de formulario en el navegador.
 * Una sola pantalla, dos campos, sin proveedores externos: cada proveedor OAuth sería
 * superficie nueva y ataría la cuenta a una identidad real, que es exactamente lo que este
 * producto no hace (PART 9 §9.2.2).
 *
 * El error de credenciales es siempre el mismo texto, sin distinguir correo de contraseña.
 */
import Link from 'next/link'
import { useActionState } from 'react'
import { SubmitButton } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import type { ActionResult } from '@/lib/result'
import { signIn } from '../actions'

export type SignInFormProps = {
  /** Ruta interna a la que volver después de ingresar. La acción la valida igual. */
  redirectTo?: string
}

export function SignInForm({ redirectTo }: SignInFormProps) {
  const [estado, enviar] = useActionState<ActionResult | null, FormData>(signIn, null)
  const error = estado && !estado.ok ? estado.error : null

  return (
    <form action={enviar} className="flex flex-col gap-4">
      {redirectTo ? <input type="hidden" name="redirectTo" value={redirectTo} /> : null}

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

      <Field label="Contraseña" htmlFor="password" required>
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>

      {error ? (
        <p role="alert" className="text-s text-danger">
          {error}
        </p>
      ) : null}

      <SubmitButton pendingLabel="Ingresando…">Ingresar</SubmitButton>

      <p className="text-s text-text-secondary">
        <Link href="/recuperar" className="text-accent">
          ¿Olvidaste tu contraseña?
        </Link>
      </p>
    </form>
  )
}
