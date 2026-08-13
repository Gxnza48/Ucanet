/**
 * components/ui/textarea.tsx — Textarea (PART 18 §18.4 fila 5).
 *
 * Mismas reglas que el Input, con alto mínimo de 3 filas. El auto-grow hasta 12
 * filas y el contador de caracteres son del compositor (PART 17 §17.4.3), que es
 * un componente de cliente: la primitiva no los implementa ni los necesita.
 */
import type { TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'
import { controlClasses } from './input'

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  /** Marca el control como inválido: borde danger + aria-invalid. */
  invalid?: boolean
}

export function Textarea({
  invalid,
  className,
  rows,
  'aria-invalid': ariaInvalid,
  ...rest
}: TextareaProps) {
  return (
    <textarea
      {...rest}
      rows={Math.max(3, rows ?? 3)}
      aria-invalid={invalid ? true : ariaInvalid}
      className={cn(
        controlClasses,
        'resize-y px-3 py-2',
        invalid ? 'border-danger' : 'border-border',
        className,
      )}
    />
  )
}
