/**
 * components/ui/empty-state.tsx — PART 17 §17.5.6.
 *
 * Estado vacío: una frase y, como mucho, una acción. Nunca ilustraciones (anti-checklist 8).
 * Los estados vacíos son las pantallas más vistas del arranque en frío (PART 2 §2.x), así que
 * viven alineados a la izquierda, en el mismo eje que las filas de la lista que reemplazan.
 */
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('py-6', className)}>
      <p className="text-base font-semibold text-text-primary">{title}</p>
      {description ? <p className="mt-1 text-m text-text-secondary">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  )
}
