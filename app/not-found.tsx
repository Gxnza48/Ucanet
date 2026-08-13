/**
 * app/not-found.tsx — 404 (PART 17 §17.5.6).
 *
 * Una frase y salidas concretas. No es un chiste ni una ilustración: el 404 lo ve
 * alguien que quería llegar a algo, y lo único útil es decirle qué pasó y darle
 * tres caminos cortos.
 *
 * Ojo con la distinción de §0.5-R23c: esto es "esta dirección no corresponde a
 * nada". El contenido que existió y fue eliminado NO cae acá — responde 410 con la
 * lápida de `app/_components/tombstone.tsx`.
 */
import type { Metadata } from 'next'
import Link from 'next/link'

import { ButtonLink } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Página no encontrada',
  robots: { index: false, follow: false },
}

export default function NotFound() {
  return (
    <div className="w-full max-w-170 py-6">
      <h1 className="font-serif text-xl font-semibold text-text-primary">
        No encontramos esta página.
      </h1>

      <p className="mt-3 text-base text-text-secondary">
        Puede que el enlace esté mal copiado o que la dirección nunca haya existido.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <ButtonLink href="/" variant="secondary">
          Ir al inicio
        </ButtonLink>
        <Link href="/materias" className="text-m text-accent hover:underline">
          Ver materias
        </Link>
        <Link href="/buscar" className="text-m text-accent hover:underline">
          Buscar en el sitio
        </Link>
      </div>
    </div>
  )
}
