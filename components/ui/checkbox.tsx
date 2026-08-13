/**
 * components/ui/checkbox.tsx — Checkbox (PART 18 §18.4 fila 7).
 *
 * Caja de 16px, borde 1px, radio 2px; tildado = relleno acento + check de Lucide
 * en --color-on-accent. El input nativo NO se esconde: se le saca la apariencia
 * con `appearance-none` y él mismo es la caja, así el `:focus-visible` global le
 * cae encima sin reimplementar el anillo y la barra espaciadora sigue funcionando.
 *
 * El `<label>` envuelve al input, así que todo el rótulo es clickeable. El `hint`
 * queda FUERA del label y se ata con aria-describedby: si estuviera adentro
 * pasaría a formar parte del nombre accesible del control, y PART 17 §17.7 pide
 * exactamente lo contrario para el explicador de "Publicar como anónimo".
 *
 * `className` se aplica al contenedor (la fila completa), que es lo que el
 * consumidor necesita posicionar.
 */
import { Check } from 'lucide-react'
import type { InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export type CheckboxProps = InputHTMLAttributes<HTMLInputElement> & {
  /** Rótulo visible, siempre clickeable. */
  label: string
  /** Texto de ayuda de 13px bajo el rótulo, atado por aria-describedby. */
  hint?: string
}

export function Checkbox({
  label,
  hint,
  className,
  id,
  name,
  'aria-describedby': ariaDescribedBy,
  ...rest
}: CheckboxProps) {
  // El id del hint se deriva del id (o del name, que en un form siempre está).
  const anchorId = id ?? name
  const hintId = hint && anchorId ? `${anchorId}-hint` : undefined

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label className="relative flex cursor-pointer items-start gap-2 text-m text-text-primary">
        <input
          {...rest}
          id={id}
          name={name}
          type="checkbox"
          aria-describedby={cn(ariaDescribedBy, hintId) || undefined}
          className={cn(
            'peer mt-0.5 size-4 shrink-0 cursor-pointer appearance-none rounded-input border border-border bg-surface',
            'checked:border-accent checked:bg-accent',
            'disabled:cursor-not-allowed disabled:opacity-40',
          )}
        />
        <Check
          aria-hidden="true"
          size={16}
          className="pointer-events-none absolute left-0 top-0.5 hidden text-on-accent peer-checked:block peer-disabled:opacity-40"
        />
        <span className="peer-disabled:opacity-40">{label}</span>
      </label>
      {hint ? (
        <p id={hintId} className="pl-6 text-s text-text-secondary">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
