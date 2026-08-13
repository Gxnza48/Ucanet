/**
 * components/ui/button-styles.tsx — métricas y variantes compartidas de los botones
 * (PART 18 §18.4 filas 1-3).
 *
 * Vive en su propio módulo, sin directiva, para que `button.tsx` (Server Component)
 * y `submit-button.tsx` ('use client') compartan las clases sin generar un ciclo de
 * imports entre el grafo de servidor y el de cliente.
 *
 * Las clases se escriben literales: Tailwind v4 escanea el texto fuente, así que
 * cualquier nombre de clase construido por concatenación no se generaría.
 */
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger'

/** Texto de progreso por defecto (PART 17 §17.5.4 y PART 18 §18.4 fila 1). */
export const DEFAULT_PENDING_LABEL = 'Publicando…'

/**
 * Alto 44px táctil hasta 1023px y 36px de 1024px en adelante (PART 17 §17.6),
 * radio 2px, borde 1px, 14px/600, deshabilitado al 40% con cursor not-allowed.
 * El anillo de foco lo pone la regla global :focus-visible de globals.css.
 */
const BASE =
  'inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-input border ' +
  'text-m font-semibold no-underline transition-colors duration-150 lg:h-9 ' +
  'disabled:cursor-not-allowed disabled:opacity-40'

/**
 * Las reglas `disabled:hover:*` neutralizan el hover en estado deshabilitado por
 * especificidad (dos pseudoclases le ganan a una), y son inertes en un `<a>`, que
 * nunca matchea `:disabled`. Así una sola tabla sirve para botón y para link.
 */
const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'border-accent bg-accent px-4 text-on-accent hover:border-accent-hover hover:bg-accent-hover ' +
    'disabled:hover:border-accent disabled:hover:bg-accent',
  secondary:
    'border-border bg-transparent px-4 text-text-primary hover:border-text-secondary hover:bg-surface-raised ' +
    'disabled:hover:border-border disabled:hover:bg-transparent',
  tertiary:
    'border-transparent bg-transparent px-2 text-accent hover:underline disabled:hover:no-underline',
  danger:
    'border-transparent bg-transparent px-2 text-danger hover:underline disabled:hover:no-underline',
}

export function buttonClasses(variant: ButtonVariant, className?: string): string {
  return cn(BASE, VARIANTS[variant], className)
}

/**
 * Contenido del botón con el ancho bloqueado (PART 18 §18.4 fila 1: "Loading:
 * label swaps to progress text, width locked").
 *
 * Cuando el consumidor declara un estado pendiente, ambos textos ocupan la misma
 * celda de grilla: el botón mide siempre lo mismo que el más largo de los dos y no
 * salta al empezar el envío. `invisible` (visibility: hidden) además saca el texto
 * oculto del árbol de accesibilidad, así el lector de pantalla anuncia sólo el
 * texto de progreso mientras dura el envío (PART 17 §17.5.4).
 */
export function ButtonLabel({
  pending,
  pendingLabel,
  children,
}: {
  pending?: boolean
  pendingLabel?: string
  children?: ReactNode
}) {
  if (pending === undefined) return <>{children}</>

  return (
    <span className="grid place-items-center">
      <span className={cn('col-start-1 row-start-1', pending && 'invisible')}>{children}</span>
      <span className={cn('col-start-1 row-start-1', !pending && 'invisible')}>
        {pendingLabel ?? DEFAULT_PENDING_LABEL}
      </span>
    </span>
  )
}
