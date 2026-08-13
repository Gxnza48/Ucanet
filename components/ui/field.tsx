/**
 * components/ui/field.tsx — rótulo, ayuda y error de un control (PART 18 §18.4 fila 4).
 *
 * Estructura fija: rótulo de 13px/600 arriba, hint de 13px secundario debajo del
 * rótulo (el patrón del explicador de "Publicar como anónimo", PART 17 §17.4.3),
 * el control, y el mensaje de error de 13px en danger abajo.
 *
 * Field cablea la accesibilidad por su cuenta en lugar de confiar en que cada
 * formulario se acuerde: si `children` es un único elemento, le inyecta `id`,
 * `aria-describedby`, `aria-invalid` y `aria-required` conservando lo que el
 * consumidor ya haya puesto. PART 17 §17.7 exige errores atados por
 * aria-describedby y anunciados por una live region cortés: de ahí el
 * role="status" del párrafo de error, que se renderiza siempre (vacío se oculta)
 * para que la región exista en el DOM antes de que aparezca el mensaje.
 */
import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

type WiredControlProps = {
  id?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
  'aria-required'?: boolean
}

export type FieldProps = {
  label: string
  htmlFor: string
  error?: string
  hint?: string
  children: ReactNode
  required?: boolean
  className?: string
}

export function Field({ label, htmlFor, error, hint, children, required, className }: FieldProps) {
  const hintId = `${htmlFor}-hint`
  const errorId = `${htmlFor}-error`
  const describedBy = cn(hint && hintId, error && errorId)

  let control: ReactNode = children
  if (isValidElement<WiredControlProps>(children)) {
    const element: ReactElement<WiredControlProps> = children
    control = cloneElement(element, {
      id: element.props.id ?? htmlFor,
      'aria-describedby': cn(element.props['aria-describedby'], describedBy) || undefined,
      'aria-invalid': error ? true : element.props['aria-invalid'],
      'aria-required': required ? true : element.props['aria-required'],
    })
  }

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={htmlFor} className="text-s font-semibold text-text-primary">
        {label}
        {required ? (
          <>
            <span aria-hidden="true" className="text-accent">
              {' *'}
            </span>
            <span className="sr-only"> (obligatorio)</span>
          </>
        ) : null}
      </label>
      {hint ? (
        <p id={hintId} className="text-s text-text-secondary">
          {hint}
        </p>
      ) : null}
      {control}
      <p id={errorId} role="status" className="text-s text-danger empty:hidden">
        {error}
      </p>
    </div>
  )
}
