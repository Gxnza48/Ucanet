/**
 * components/ui/select.tsx — Select nativo estilado (PART 18 §18.4 fila 6).
 *
 * `<select>` nativo con las métricas del Input y un chevron-down de Lucide como
 * única decoración. El picker del sistema queda intacto a propósito: en mobile le
 * gana a cualquier dropdown propio en accesibilidad y en peso. El ícono es
 * decorativo (aria-hidden) porque el nombre accesible lo da el `<label>` del Field.
 */
import { ChevronDown } from 'lucide-react'
import type { SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'
import { controlClasses, controlHeightClasses } from './input'

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  /** Marca el control como inválido: borde danger + aria-invalid. */
  invalid?: boolean
}

export function Select({
  invalid,
  className,
  children,
  'aria-invalid': ariaInvalid,
  ...rest
}: SelectProps) {
  return (
    <div className="relative w-full">
      <select
        {...rest}
        aria-invalid={invalid ? true : ariaInvalid}
        className={cn(
          controlClasses,
          controlHeightClasses,
          // pr-9 deja libres los 12px de margen más los 16px del ícono.
          'cursor-pointer appearance-none py-0 pl-3 pr-9',
          invalid ? 'border-danger' : 'border-border',
          className,
        )}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        size={16}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary"
      />
    </div>
  )
}
