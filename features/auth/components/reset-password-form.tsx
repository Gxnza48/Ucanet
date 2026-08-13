'use client'

/**
 * features/auth/components/reset-password-form.tsx — la segunda mitad de `/recuperar`
 * (PART 6 §6.8).
 *
 * Se renderiza cuando la persona vuelve del link del correo: `/auth/callback` ya canjeó el
 * código y dejó una sesión de recuperación activa, así que `updatePassword` solo tiene que
 * llamar a `updateUser`. Supabase revoca el resto de las sesiones al cambiarla (PART 9 §9.3).
 *
 * La contraseña se pide dos veces a propósito: un error de tipeo acá deja a la persona afuera
 * de una cuenta que, por diseño, nadie puede devolverle (PART 9 §9.8).
 */
import { useActionState } from 'react'
import { ButtonLink, SubmitButton } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { LIMITS } from '@/lib/config'
import type { ActionResult } from '@/lib/result'
import { updatePassword } from '../actions'

export function ResetPasswordForm() {
  const [estado, enviar] = useActionState<ActionResult | null, FormData>(updatePassword, null)

  const errorDe = (nombre: string) =>
    estado && !estado.ok && estado.field === nombre ? estado.error : undefined
  const errorGeneral = estado && !estado.ok && estado.field === undefined ? estado.error : null

  if (estado?.ok) {
    return (
      <section aria-live="polite" className="flex flex-col items-start gap-3">
        <p>Listo. Ya podés ingresar.</p>
        <ButtonLink href="/">Ir al inicio</ButtonLink>
      </section>
    )
  }

  return (
    <form action={enviar} className="flex flex-col gap-4">
      <Field
        label="Contraseña nueva"
        htmlFor="password"
        hint={`Al menos ${LIMITS.passwordMin} caracteres.`}
        error={errorDe('password')}
        required
      >
        <Input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={LIMITS.passwordMin}
          required
          autoFocus
        />
      </Field>

      <Field
        label="Repetí la contraseña"
        htmlFor="confirmacion"
        error={errorDe('confirmacion')}
        required
      >
        <Input name="confirmacion" type="password" autoComplete="new-password" required />
      </Field>

      {errorGeneral ? (
        <p role="alert" className="text-s text-danger">
          {errorGeneral}
        </p>
      ) : null}

      <SubmitButton pendingLabel="Guardando…">Guardar contraseña</SubmitButton>
    </form>
  )
}
