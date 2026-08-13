/**
 * app/_components/site-header.tsx — la barra superior (PART 17 §17.1.1 y §17.1.2).
 *
 * CINCO SLOTS, ni uno más (§17.1.1). Cada uno se ganó el lugar y agregar un sexto
 * exige enmendar esa tabla:
 *
 *   1. Wordmark          → identidad y camino a casa, en la posición de barrido fuerte.
 *   2. Buscar            → la puerta de entrada del imán de utilidad (D1), input siempre visible.
 *   3. "Publicá"         → la acción más importante del producto; el único relleno de acento del chrome.
 *   4. Avisos            → el gancho de retención tiene que estar a un clic desde cualquier lado.
 *   5. Cuenta            → seudónimo como texto, con menú; nunca un avatar (D2).
 *
 * Deslogueado, los slots 3-5 se reemplazan por "Ingresá" y "Crear cuenta" (§17.1.1).
 *
 * MOBILE (<768px): la barra mide 48px y conserva wordmark + avisos + cuenta. La
 * búsqueda y "Publicar" se van a la barra inferior a propósito: metidas acá, todos
 * los objetivos táctiles quedarían por debajo de 44px (§17.1.2).
 *
 * Es un Server Component: la sesión se lee en el servidor y el header no manda
 * JavaScript de ruta. Lo único que cruza al cliente es el menú de cuenta y el
 * input de búsqueda, ambos en la lista blanca de PART 19 §19.3.
 */
import { Bell } from 'lucide-react'
import Link from 'next/link'
import { Suspense, cache } from 'react'

import { ButtonLink } from '@/components/ui/button'
import { Wordmark } from '@/components/ui/wordmark'
import { NotificationsBadge } from '@/features/notifications/components/notifications-badge'
import { getUnreadCount } from '@/features/notifications/queries'
import { SearchInput } from '@/features/search/components/search-input'
import { cn } from '@/lib/cn'
import { SITE_NAME } from '@/lib/config'
import { getProfile } from '@/lib/supabase/server'
import { type Theme } from '@/lib/theme'

import { UserMenu } from './user-menu'

/**
 * Destino de "Publicá".
 *
 * El mapa de URLs de D7 no tiene una ruta de composición: el compositor es la caja
 * en línea del feed (§17.2.1). El ancla apunta a esa caja; si la página de destino
 * todavía no la marcó con ese id, el navegador simplemente deja al visitante en el
 * inicio, que es donde está el compositor igual. Degradación, no error.
 */
export const COMPOSER_HREF = '/#componer'

/** Alto de la caja táctil de los íconos del header: 44px en mobile, 36px en escritorio. */
const ICON_BOX = 'inline-flex h-11 w-11 items-center justify-center rounded-input lg:h-9 lg:w-9'

/**
 * Contador de avisos memorizado por request.
 *
 * En mobile el badge aparece dos veces a propósito (§17.1.2 slot 5: "duplicado del
 * top bar deliberadamente"), y la barra inferior se renderiza igual en escritorio
 * aunque esté oculta. Sin esta memorización serían dos `count` idénticos por
 * navegación, y el inventario de consultas por ruta de PART 21 es corto: una
 * consulta secuencial de más se come el objetivo de TTFB.
 */
const unreadCount = cache(getUnreadCount)

/**
 * El badge de avisos del chrome. Es async: va siempre dentro de un `<Suspense>`
 * para no retrasar el resto de la barra, y como está superpuesto, aparecer tarde
 * no desplaza nada (§17.5.4).
 */
export async function ChromeUnreadBadge({ className }: { className?: string }) {
  return <NotificationsBadge count={await unreadCount()} className={className} />
}

export async function SiteHeader({ theme }: { theme: Theme }) {
  const profile = await getProfile()

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface">
      <div className="mx-auto flex h-12 w-full max-w-253 items-center gap-3 px-4 md:h-14 lg:px-6">
        {/* Slot 1 — wordmark */}
        <Link
          href="/"
          aria-label={`${SITE_NAME}, ir al inicio`}
          className="flex shrink-0 items-center rounded-input"
        >
          <Wordmark />
        </Link>

        {/* Slot 2 — buscar: 240px en tablet, 320px de 1024px en adelante (§17.6). */}
        <div className="hidden md:block md:w-60 lg:w-80">
          <SearchInput />
        </div>

        <nav aria-label="Principal" className="ml-auto flex items-center gap-1 md:gap-2">
          {profile ? (
            <>
              {/* Slot 3 — la única acción con relleno de acento del chrome. */}
              <span className="hidden md:block">
                <ButtonLink href={COMPOSER_HREF}>Publicá</ButtonLink>
              </span>

              {/* Slot 4 — avisos con contador */}
              <Link
                href="/avisos"
                className={cn('relative', ICON_BOX, 'text-text-primary hover:bg-surface-raised')}
              >
                <Bell aria-hidden="true" size={18} />
                <span className="sr-only">Avisos</span>
                <Suspense fallback={null}>
                  <ChromeUnreadBadge className="absolute right-1 top-1.5" />
                </Suspense>
              </Link>

              {/* Slot 5 — cuenta */}
              <UserMenu
                handle={profile.handle}
                isMod={profile.role === 'mod' || profile.role === 'admin'}
                theme={theme}
              />
            </>
          ) : (
            <>
              <ButtonLink href="/ingresar" variant="tertiary">
                Ingresá
              </ButtonLink>
              {/* En pantallas chicas el alta la ofrece la barra inferior (§17.1.2):
                  duplicarla acá empujaría el wordmark contra el borde. */}
              <span className="hidden sm:block">
                <ButtonLink href="/registro">Crear cuenta</ButtonLink>
              </span>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
