'use client'

/**
 * app/_components/tab-bar-link.tsx — un slot de la barra inferior que sabe si es
 * el destino actual (PART 17 §17.1.2).
 *
 * POR QUÉ ESTE ARCHIVO ES DE CLIENTE, que es la única decisión que hay acá.
 * Marcar la pestaña actual exige el pathname, y en el App Router el pathname sólo
 * existe del lado del navegador (`usePathname`): la barra la monta el layout raíz,
 * que no recibe ruta, y `aria-current` es un ATRIBUTO — no se puede pintar con CSS
 * ni deducir del contenido, así que no hay variante servidor de esto. La lista
 * blanca de clientes de PART 19 §19.3 no lo tenía; la ampliación está registrada en
 * docs/decisions.md, que es el mecanismo del proyecto para desviarse de una PART.
 *
 * Lo que cruza al navegador es ESTE archivo y nada más. El ícono, el rótulo y el
 * badge de avisos se renderizan en el servidor y viajan como `children`, de modo
 * que el chunk nuevo es un cálculo de tres líneas y no la barra entera.
 *
 * `aria-current` con el valor que corresponde, que no siempre es "page":
 *
 *   - `"page"` cuando el destino ES la página actual (`Materias` estando en
 *     `/materias`).
 *   - `"true"` cuando el slot representa la sección en la que estoy pero no esa URL
 *     exacta (`Inicio` estando en `/mis-materias`, `Materias` estando en
 *     `/materias/derecho-constitucional`). Decir "page" ahí sería mentirle al lector
 *     de pantalla: la página actual es otra, y en esas rutas el `aria-current="page"`
 *     ya lo lleva la pestaña de `components/ui/tabs`, que sí apunta a la URL exacta.
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

export function TabBarLink({
  href,
  matches,
  className,
  activeClassName,
  inactiveClassName,
  children,
}: {
  href: string
  /**
   * Rutas que también cuentan como "estoy acá", además de `href`. Coincide la ruta
   * exacta y todo lo que cuelga de ella (`/materias` marca `/materias/[slug]`); `/`
   * sólo coincide exacto, porque como prefijo marcaría el sitio entero.
   */
  matches?: readonly string[]
  className?: string
  /** Clases del slot actual. */
  activeClassName?: string
  /** Clases del slot que no es el actual. */
  inactiveClassName?: string
  children: ReactNode
}) {
  const pathname = usePathname()
  const isActive = [href, ...(matches ?? [])].some((route) => covers(route, pathname))

  return (
    <Link
      href={href}
      aria-current={isActive ? (pathname === href ? 'page' : 'true') : undefined}
      className={cn(className, isActive ? activeClassName : inactiveClassName)}
    >
      {children}
    </Link>
  )
}

/** Coincidencia por SEGMENTO, nunca por caracteres: `/materias` no marca `/materiales`. */
function covers(route: string, pathname: string): boolean {
  if (route === pathname) return true
  return route !== '/' && pathname.startsWith(`${route}/`)
}
