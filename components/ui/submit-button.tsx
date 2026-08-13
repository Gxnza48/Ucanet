'use client'

/**
 * components/ui/submit-button.tsx — botón de envío atado al form padre.
 *
 * Único componente de botón en el cliente (PART 19 §19.3): `useFormStatus` sólo
 * funciona dentro de un `<form>` y sólo en el cliente. Se reexporta desde
 * `button.tsx`, que es el módulo que fija el BUILD-CONTRACT §4.4, para que
 * `Button` y `ButtonLink` sigan siendo Server Components.
 */
import type { ButtonHTMLAttributes } from 'react'
import { useFormStatus } from 'react-dom'
import {
  ButtonLabel,
  buttonClasses,
  DEFAULT_PENDING_LABEL,
  type ButtonVariant,
} from './button-styles'

export type SubmitButtonProps = {
  variant?: ButtonVariant
  /** Texto mientras el form está enviando. Por defecto "Publicando…". */
  pendingLabel?: string
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'>

export function SubmitButton({
  variant = 'primary',
  pendingLabel = DEFAULT_PENDING_LABEL,
  className,
  children,
  disabled,
  ...rest
}: SubmitButtonProps) {
  const { pending } = useFormStatus()

  return (
    <button
      {...rest}
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={buttonClasses(variant, className)}
    >
      <ButtonLabel pending={pending} pendingLabel={pendingLabel}>
        {children}
      </ButtonLabel>
    </button>
  )
}
