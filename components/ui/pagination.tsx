/**
 * components/ui/pagination.tsx — paginación sin JS, el piso de PART 17 §17.5.2.
 *
 * Dos links y nada más: el cursor es keyset (`created_at,id` en base64, BUILD-CONTRACT §4.5),
 * así que no existen números de página ni un total que mostrar. El auto-load con sentinel se
 * monta encima de esto en las listas que lo usan; sin JS, estos links siguen paginando.
 * Sin hrefs no renderiza nada.
 */
import Link from 'next/link'
import { cn } from '@/lib/cn'

export function Pagination({
  prevHref,
  nextHref,
  className,
}: {
  prevHref?: string
  nextHref?: string
  className?: string
}) {
  if (!prevHref && !nextHref) return null

  // Estilo de botón terciario: solo texto en acento, subrayado en hover (§18.4 fila 3).
  const link =
    'py-3 text-m font-semibold text-accent transition-colors duration-150 ease-out hover:text-accent-hover hover:underline'

  return (
    <nav aria-label="Paginación" className={cn('flex items-center gap-4', className)}>
      {prevHref ? (
        <Link href={prevHref} rel="prev" className={link}>
          Anteriores
        </Link>
      ) : null}
      {nextHref ? (
        <Link href={nextHref} rel="next" className={cn(link, 'ml-auto')}>
          Siguientes
        </Link>
      ) : null}
    </nav>
  )
}
