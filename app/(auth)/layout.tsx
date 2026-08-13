/**
 * app/(auth)/layout.tsx — la caja de las pantallas de identidad (PART 17 §17.4.9).
 *
 * Tratamiento visual fijado por §17.4.9: "single centered column, max-width 400px, one
 * question per screen, progress as plain text «Paso 1 de 2», wordmark small at top".
 * `max-w-100` son 400px exactos con la base de 4px de `app/globals.css` — el ancho no se
 * escribe como valor arbitrario, se deriva del token de espaciado.
 *
 * No hay `<main>` ni pie acá: el esqueleto único del producto (§17.1) los pone una sola vez
 * más arriba, y anidar landmarks es un error de accesibilidad, no una decoración de más.
 * Lo único que este layout agrega es la columna angosta y el wordmark, que en estas pantallas
 * cumple una función concreta: la persona llega desde un mail o un link de invitación y tiene
 * que ver de entrada en qué sitio está.
 *
 * Server Component: en toda esta rama el único JS es el de los formularios.
 */
import Link from 'next/link'
import type { ReactNode } from 'react'

import { Wordmark } from '@/components/ui/wordmark'
import { SITE_NAME } from '@/lib/config'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-100 flex-col gap-6 py-6">
      <header>
        <Link
          href="/"
          aria-label={`Ir al inicio de ${SITE_NAME}`}
          className="inline-block no-underline"
        >
          <Wordmark className="text-m" />
        </Link>
      </header>

      <div className="flex flex-col gap-4">{children}</div>
    </div>
  )
}
