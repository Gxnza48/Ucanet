/**
 * components/ui/tabs.tsx — PART 18 §18.4 fila 11, "Tabs".
 *
 * Tabs de links, no widget de JS (PART 27 §8: "Tabs are links"). Cada tab es una URL propia,
 * así el back del navegador y el link compartido funcionan. La activa lleva `aria-current="page"`,
 * color primario y subrayado de 2px en acento; la inactiva va en color secundario.
 */
import Link from 'next/link'
import { cn } from '@/lib/cn'

export function Tabs({
  items,
  activeHref,
  className,
}: {
  items: Array<{ href: string; label: string }>
  activeHref: string
  className?: string
}) {
  return (
    <nav aria-label="Secciones" className={cn('flex gap-4 border-b border-border', className)}>
      {items.map((item) => {
        const isActive = item.href === activeHref
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              // -mb-px monta el subrayado de 2px sobre la hairline del contenedor;
              // py-3 deja la fila en 44px de alto táctil.
              '-mb-px border-b-2 px-1 py-3 text-m font-semibold transition-colors duration-150 ease-out',
              isActive
                ? 'border-accent text-text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary',
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
