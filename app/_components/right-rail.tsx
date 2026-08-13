/**
 * app/_components/right-rail.tsx — el riel derecho (PART 17 §17.1.1).
 *
 * 300px, alineado arriba y NO pegajoso: un riel que persigue el scroll es
 * decoración; este es contexto que se consulta y se deja (§17.1.1).
 *
 * El primer bloque es permanente en TODAS las páginas: "Explorar". No es adorno —
 * es el camino de alcanzabilidad de los índices en escritorio (§0.5-R19). Sin
 * columna izquierda y con un header de cinco slots, `/materias` y `/recursos`
 * quedarían a dos clics; con este bloque están a uno, igual que en la barra
 * inferior de mobile.
 *
 * "Archivo" (`/archivo`) es el tercer renglón de ese bloque en el plan, y entra
 * cuando exista la ruta en P3 (D2, D7). Está comentado abajo, en su lugar exacto,
 * para que agregarlo sea descomentar una línea y no redescubrir la decisión.
 *
 * Los bloques específicos de cada página (materia, publicación, home) los pasa la
 * página como `children`: el riel es el encuadre, no el catálogo de contenidos.
 * Renderizarlo o no en mobile también lo decide la página (§17.6: se descarta en
 * la home y baja debajo del contenido en materia y publicación).
 */
import Link from 'next/link'
import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

/** Renglón compacto del riel: un enlace de una línea, con meta opcional a la derecha. */
export function RailLink({
  href,
  children,
  meta,
}: {
  href: string
  children: ReactNode
  meta?: ReactNode
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex min-h-11 items-center justify-between gap-3 rounded-input py-1 text-m text-text-primary hover:text-accent lg:min-h-8"
      >
        <span className="min-w-0 truncate">{children}</span>
        {meta ? <span className="shrink-0 text-s text-text-secondary">{meta}</span> : null}
      </Link>
    </li>
  )
}

/** Bloque del riel: rótulo de 13px en secundario y debajo los renglones. */
export function RailSection({
  title,
  children,
  className,
}: {
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('mt-6 first:mt-0', className)}>
      <h2 className="text-s font-semibold text-text-secondary">{title}</h2>
      <ul className="mt-2">{children}</ul>
    </section>
  )
}

export function RightRail({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <aside aria-label="Contexto" className={cn('w-full lg:w-75 lg:shrink-0', className)}>
      <RailSection title="Explorar">
        <RailLink href="/materias">Materias</RailLink>
        <RailLink href="/recursos">Recursos</RailLink>
        {/* P3, cuando exista la ruta `/archivo` (D2, D7):
        <RailLink href="/archivo">Archivo</RailLink>
        */}
      </RailSection>

      {children}
    </aside>
  )
}
