/**
 * components/ui/input.tsx — Input de texto (PART 18 §18.4 fila 4).
 *
 * Borde 1px, radio 2px, alto 36px (44px táctil hasta 1023px), padding 8×12,
 * texto de 16px —el mínimo que evita el zoom automático de iOS al enfocar— y
 * fondo --color-surface. El anillo de foco lo pone la regla global
 * :focus-visible de globals.css; acá sólo se cambia el borde a acento.
 */
import type { InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

/**
 * Métricas comunes a Input, Textarea y Select. PART 18 §18.4 fila 5 dice
 * literalmente que el textarea sigue las reglas del input, y la fila 6 que el
 * select nativo se estila "to input metrics": una sola cadena evita que los tres
 * controles se desincronicen. El borde (border-border / border-danger) lo agrega
 * cada componente según `invalid`.
 */
export const controlClasses =
  'w-full rounded-input border bg-surface text-base text-text-primary ' +
  'placeholder:text-text-secondary focus:border-accent ' +
  'disabled:cursor-not-allowed disabled:bg-surface-raised disabled:text-text-secondary'

/** Alto del control de una línea: 44px táctil, 36px de escritorio. */
export const controlHeightClasses = 'h-11 lg:h-9'

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  /** Marca el control como inválido: borde danger + aria-invalid. */
  invalid?: boolean
}

export function Input({ invalid, className, 'aria-invalid': ariaInvalid, ...rest }: InputProps) {
  return (
    <input
      {...rest}
      aria-invalid={invalid ? true : ariaInvalid}
      className={cn(
        controlClasses,
        controlHeightClasses,
        'px-3',
        invalid ? 'border-danger' : 'border-border',
        className,
      )}
    />
  )
}
