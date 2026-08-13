/**
 * components/ui/breadcrumb.tsx — la ruta jerárquica (facultad › carrera › materia).
 *
 * `<nav aria-label="Ruta">` con `<ol>`: el orden importa y los lectores de pantalla lo anuncian
 * como lista. El último ítem es la página actual — nunca es link y lleva `aria-current="page"`.
 * Los separadores son decorativos (`aria-hidden`) y usan "/" porque la ruta espeja la URL (D7).
 */
import Link from 'next/link'
import { cn } from '@/lib/cn'

export function Breadcrumb({
  items,
  className,
}: {
  items: Array<{ href?: string; label: string }>
  className?: string
}) {
  if (items.length === 0) return null

  return (
    <nav aria-label="Ruta" className={cn('text-s text-text-secondary', className)}>
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <li key={`${index}-${item.label}`} className="flex items-center gap-2">
              {index > 0 ? <span aria-hidden="true">/</span> : null}
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="text-accent transition-colors duration-150 ease-out hover:text-accent-hover hover:underline"
                >
                  {item.label}
                </Link>
              ) : (
                <span aria-current={isLast ? 'page' : undefined} className="text-text-primary">
                  {item.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
