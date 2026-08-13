/**
 * app/_components/site-footer.tsx — el pie de todas las páginas (PART 17 §17.1.1).
 *
 * El descargo de independencia NO es texto de relleno: es chrome no removible (D8,
 * D10) y en la home deslogueada es copia legal que carga peso (§17.3.4). Sale de
 * `FOOTER_DISCLAIMER` en `lib/config.ts`, que es su única fuente.
 *
 * Ancho de la columna principal (680px) y no del contenedor entero: el pie cierra
 * la columna de lectura, no la página.
 *
 * El control de tema vive acá y no solo en el menú de cuenta porque un visitante
 * sin sesión también tiene que poder pasar a oscuro: el modo oscuro sale el día uno
 * y es del producto, no de las cuentas (D8, §18.7).
 */
import Link from 'next/link'

import { FOOTER_DISCLAIMER } from '@/lib/config'
import { type Theme } from '@/lib/theme'

import { ThemeToggle } from './theme-toggle'

const LINKS: ReadonlyArray<{ href: string; label: string }> = [
  { href: '/reglas', label: 'Reglas' },
  { href: '/terminos', label: 'Términos' },
  { href: '/privacidad', label: 'Privacidad' },
  { href: '/acerca', label: 'Acerca de' },
]

export function SiteFooter({ theme }: { theme: Theme }) {
  return (
    <footer className="mx-auto w-full max-w-253 px-4 lg:px-6">
      <div className="w-full max-w-170 border-t border-border py-6">
        <p className="text-s text-text-secondary">{FOOTER_DISCLAIMER}</p>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Legal" className="flex flex-wrap items-center gap-2 text-s">
            {LINKS.map((link, index) => (
              <span key={link.href} className="flex items-center gap-2">
                {index > 0 ? (
                  <span aria-hidden="true" className="text-text-secondary">
                    ·
                  </span>
                ) : null}
                <Link
                  href={link.href}
                  className="inline-flex min-h-11 items-center rounded-input text-text-secondary hover:text-text-primary lg:min-h-9"
                >
                  {link.label}
                </Link>
              </span>
            ))}
          </nav>

          <ThemeToggle theme={theme} />
        </div>
      </div>
    </footer>
  )
}
