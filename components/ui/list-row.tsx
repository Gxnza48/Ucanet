/**
 * components/ui/list-row.tsx — PART 18 §18.4 fila 9, "Fila de lista".
 *
 * La fila de trabajo del producto (feed, avisos, resultados de búsqueda, materias, recursos):
 * full-bleed, 12px de padding vertical, hairline abajo, sin radio ni sombra. El hover con fondo
 * raised solo aplica en punteros (Tailwind v4 envuelve `hover:` en `@media (hover: hover)`).
 *
 * Markup sin anchors anidados: el link de la fila estira un `::after` sobre toda la fila, y las
 * paradas interactivas internas son links hermanos que quedan por encima de esa capa.
 *
 * Ranuras:
 * - `meta`     línea de meta (13px, secundaria). Por encima del link de fila: puede llevar chips y links.
 * - `title`    el destino de la fila. Es el link.
 * - `children` cuerpo o preview no interactivo. Queda por debajo: al tocarlo se abre la fila.
 * - `trailing` línea de acciones al pie (13px). Por encima del link: acá van "12 comentarios" y demás.
 *
 * Renderiza un `<li>`: usalo dentro de un `<ul>` (PART 17 §17.7 pide listas reales).
 * El padding lateral lo pone la columna de contenido, no la fila.
 */
import Link from 'next/link'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function ListRow({
  href,
  title,
  meta,
  trailing,
  children,
  className,
}: {
  href: string
  title: ReactNode
  meta?: ReactNode
  trailing?: ReactNode
  children?: ReactNode
  className?: string
}) {
  return (
    <li
      className={cn(
        'relative border-b border-border py-3 transition-colors duration-150 ease-out hover:bg-surface-raised',
        className,
      )}
    >
      {meta ? <div className="relative z-10 text-s text-text-secondary">{meta}</div> : null}
      <Link
        href={href}
        className="block text-base font-semibold text-text-primary after:absolute after:inset-0"
      >
        {title}
      </Link>
      {children ? <div className="mt-1 text-base text-text-secondary">{children}</div> : null}
      {trailing ? (
        <div className="relative z-10 mt-2 text-s text-text-secondary">{trailing}</div>
      ) : null}
    </li>
  )
}
