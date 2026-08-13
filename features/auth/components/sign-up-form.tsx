'use client'

/**
 * features/auth/components/sign-up-form.tsx — `/invitacion/[code]` y `/registro`
 * (PART 6 §6.1 S1 y S2, PART 9 §9.2.1).
 *
 * Dos estados en un solo componente: el formulario y, cuando el alta sale bien, el
 * intersticial "Revisá tu casilla". No hay redirección en el medio porque con confirmación de
 * correo obligatoria todavía no existe sesión: lo único que puede hacer la persona es ir a su
 * casilla. El correo escrito se conserva en estado local para poder mostrárselo.
 *
 * El código de invitación llega por prop desde la página, que ya lo validó de solo lectura
 * (§0.5-R18); viaja oculto y lo vuelve a validar la Server Action antes de crear nada.
 */
import Link from 'next/link'
import { useActionState, useState } from 'react'
import { SubmitButton } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { LIMITS } from '@/lib/config'
import type { ActionResult } from '@/lib/result'
import { signUp } from '../actions'

export type SignUpFormProps = {
  /** Código de la invitación abierta. Ausente cuando el registro está abierto (PART 6 §6.10-B). */
  inviteCode?: string
}

export function SignUpForm({ inviteCode }: SignUpFormProps) {
  const [estado, enviar] = useActionState<ActionResult | null, FormData>(signUp, null)
  const [email, setEmail] = useState('')

  const errorDe = (nombre: string) =>
    estado && !estado.ok && estado.field === nombre ? estado.error : undefined
  // El código viaja oculto: su error no tiene campo visible donde colgarse, va con los generales.
  const errorGeneral =
    estado && !estado.ok && (estado.field === undefined || estado.field === 'inviteCode')
      ? estado.error
      : null

  if (estado?.ok) {
    return (
      <section aria-live="polite" className="flex flex-col gap-3">
        <h2 className="font-serif text-l font-semibold text-text-primary">Revisá tu casilla</h2>
        <p>
          Te mandamos un email a <span className="font-semibold">{email}</span> para confirmar tu
          cuenta. Abrí el link para seguir.
        </p>
        <p className="text-s text-text-secondary">Fijate también en correo no deseado.</p>
      </section>
    )
  }

  return (
    <form action={enviar} className="flex flex-col gap-4">
      {inviteCode ? <input type="hidden" name="inviteCode" value={inviteCode} /> : null}

      <Field
        label="Email"
        htmlFor="email"
        hint="Usá el que quieras. Nunca se muestra públicamente."
        error={errorDe('email')}
        required
      >
        <Input
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          autoFocus
          value={email}
          onChange={(evento) => setEmail(evento.target.value)}
        />
      </Field>

      <Field
        label="Contraseña"
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
        />
      </Field>

      <div className="flex flex-col gap-2">
        <Checkbox
          name="terminos"
          id="terminos"
          label="Tengo 16 años o más y acepto los Términos y la Política de Privacidad."
          required
        />
        {errorDe('terminos') ? (
          <p role="alert" className="text-s text-danger">
            {errorDe('terminos')}
          </p>
        ) : null}
        <p className="text-s text-text-secondary">
          Leé los{' '}
          <Link href="/terminos" className="text-accent">
            Términos
          </Link>{' '}
          y la{' '}
          <Link href="/privacidad" className="text-accent">
            Política de Privacidad
          </Link>
          .
        </p>
      </div>

      {errorGeneral ? (
        <p role="alert" className="text-s text-danger">
          {errorGeneral}
          {/* La cuenta ya existente es el único error que tiene una salida obvia (PART 6 §6.1). */}
          {errorGeneral.startsWith('Ya existe una cuenta') ? (
            <>
              {' '}
              <Link href="/ingresar" className="text-accent">
                Ingresar
              </Link>
            </>
          ) : null}
        </p>
      ) : null}

      <SubmitButton pendingLabel="Creando la cuenta…">Crear cuenta</SubmitButton>
    </form>
  )
}
