/**
 * components/ui/chip.tsx — PART 18 §18.4 fila 8, "Chip de materia".
 *
 * Chip de texto en línea: 13px, padding 2×8, radio 2px.
 * - `accent`  (default): fondo `--color-accent-subtle`, texto `--color-accent`. Es el chip de materia.
 * - `neutral`: fondo `--color-surface-raised`, texto secundario (tipo de recurso, "Pregunta").
 * Con `href` se vuelve link y el fondo se profundiza un paso en hover.
 * Con `onRemove` aparece la x de la variante removible del composer.
 *
 * Sin 'use client': el archivo es neutro. `onRemove` solo puede pasarse desde un
 * Client Component (el composer), que arrastra este módulo a su propio bundle.
 */
import Link from 'next/link'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type ChipVariant = 'accent' | 'neutral'

export function Chip({
  variant = 'accent',
  href,
  onRemove,
  children,
  className,
}: {
  variant?: ChipVariant
  href?: string
  onRemove?: () => void
  children: ReactNode
  className?: string
}) {
  // Sin radio de píldora (anti-checklist 3): el chip usa el mismo radio de 2px que los inputs.
  const base = 'inline-flex max-w-full items-center gap-1 rounded-input px-2 py-0.5 text-s'
  const tone =
    variant === 'neutral' ? 'bg-surface-raised text-text-secondary' : 'bg-accent-subtle text-accent'
  // "El fondo se profundiza un paso": el wash más denso sale del mismo token, sin valores crudos.
  const deepen = variant === 'neutral' ? 'hover:bg-border' : 'hover:bg-accent/15'

  if (onRemove) {
    return (
      <span className={cn(base, tone, className)}>
        {href ? (
          <Link href={href} className="truncate hover:underline">
            {children}
          </Link>
        ) : (
          <span className="truncate">{children}</span>
        )}
        <button
          type="button"
          onClick={onRemove}
          aria-label="Quitar materia"
          // after:-inset-2 agranda el área de toque a ~36px sin agrandar el chip.
          className={cn(
            'relative -mr-1 inline-flex shrink-0 items-center rounded-input p-0.5',
            'transition-colors duration-150 ease-out after:absolute after:-inset-2',
            deepen,
          )}
        >
          <X aria-hidden="true" strokeWidth={2} className="size-4" />
        </button>
      </span>
    )
  }

  if (href) {
    return (
      <Link
        href={href}
        className={cn(base, tone, deepen, 'transition-colors duration-150 ease-out', className)}
      >
        <span className="truncate">{children}</span>
      </Link>
    )
  }

  return <span className={cn(base, tone, className)}>{children}</span>
}
