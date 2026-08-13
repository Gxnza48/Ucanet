/**
 * app/_components/mobile-tab-bar.tsx — la barra inferior de mobile (PART 17 §17.1.2).
 *
 * CINCO SLOTS, con su justificación de la tabla de §17.1.2:
 *
 *   1. Inicio    `/`          → el feed es la superficie del chequeo diario; el pulgar empieza por la izquierda.
 *   2. Materias  `/materias`  → sin acceso de un toque, los recursos se mueren en mobile.
 *   3. Publicar  compositor   → EL CENTRO es donde descansa el pulgar en cualquier agarre; crear tiene que ser lo más barato.
 *   4. Buscar    `/buscar`    → página completa con el input enfocado, mejor que un input encogido en el header.
 *   5. Avisos    `/avisos`    → duplicado del header a propósito: el gancho de retención va al alcance del pulgar.
 *
 * Cuenta NO tiene slot: perfil y ajustes son destinos semanales, no diarios, y
 * viven detrás del seudónimo de la barra superior (§17.1.2).
 *
 * Deslogueado, los slots 3 y 5 se reemplazan por una sola acción "Crear cuenta"
 * que ocupa el centro (§17.1.2). Por eso la grilla es de 5 columnas en los dos
 * casos: logueado son cinco slots de una columna; deslogueado, tres de una y el
 * alta ocupando dos.
 *
 * Es un Server Component sin estado activo. Marcar la pestaña actual exigiría
 * `usePathname()`, y la barra de navegación NO está en la lista blanca de cliente
 * de PART 19 §19.3: el precio serían kilobytes de JavaScript en todas las páginas
 * de contenido a cambio de un subrayado. La ubicación en la pantalla ya dice dónde
 * está uno.
 *
 * "Publicar" no es un FAB flotante: los FAB son la estética de dashboard que §5
 * prohíbe. Es un slot más, con el ícono en acento dentro de un cuadrado de 2px de
 * radio (§17.1.2).
 */
import { Bell, BookOpen, Home, Plus, Search } from 'lucide-react'
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { Suspense, type ReactNode } from 'react'

import { cn } from '@/lib/cn'
import { getProfile } from '@/lib/supabase/server'

import { COMPOSER_HREF, ChromeUnreadBadge } from './site-header'

/** Alto de la barra: 56px (§17.1.2). El hueco que deja abajo lo suma el inset seguro. */
const BAR_HEIGHT_PX = 56

/**
 * Caja táctil de cada slot: ocupa la celda entera de la grilla, con 44px de alto
 * mínimo — el piso de objetivo táctil de §17.7 — dentro de una barra de 56px.
 */
const SLOT =
  'flex h-full min-h-11 w-full flex-col items-center justify-center gap-0.5 rounded-input px-1'

function TabIcon({ icon: Icon }: { icon: LucideIcon }) {
  // 18px es la medida de íconos en barras de navegación (§18.5).
  return <Icon aria-hidden="true" size={18} />
}

function TabLabel({ children }: { children: ReactNode }) {
  return <span className="text-xs">{children}</span>
}

export async function MobileTabBar() {
  const profile = await getProfile()

  return (
    <>
      {/*
        Hueco al final del documento: la barra es `fixed`, así que sin esto taparía
        el pie — y el pie lleva el descargo de independencia, que es texto legal
        no removible (§17.1.1, D8). §17.5.2 lo dice explícito: el pie tiene que
        seguir siendo alcanzable.
      */}
      <div
        aria-hidden="true"
        className="md:hidden"
        style={{ height: `calc(${BAR_HEIGHT_PX}px + env(safe-area-inset-bottom))` }}
      />

      <nav
        // El header ya se llama "Principal"; en mobile los dos conviven en el árbol
        // de accesibilidad y dos landmarks con el mismo nombre no se distinguen.
        aria-label="Secciones"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface md:hidden"
        // La barra de gestos de iOS se come los últimos píxeles: el relleno los
        // devuelve. Funciona porque el layout raíz declara `viewportFit: 'cover'`.
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <ul className="grid grid-cols-5" style={{ height: `${BAR_HEIGHT_PX}px` }}>
          <li className="flex">
            <Link href="/" className={cn(SLOT, 'text-text-secondary')}>
              <TabIcon icon={Home} />
              <TabLabel>Inicio</TabLabel>
            </Link>
          </li>

          <li className="flex">
            <Link href="/materias" className={cn(SLOT, 'text-text-secondary')}>
              <TabIcon icon={BookOpen} />
              <TabLabel>Materias</TabLabel>
            </Link>
          </li>

          {profile ? (
            <li className="flex">
              <Link href={COMPOSER_HREF} className={cn(SLOT, 'text-accent')}>
                <span className="flex h-5 w-5 items-center justify-center rounded-input border border-accent">
                  <Plus aria-hidden="true" size={14} />
                </span>
                <TabLabel>Publicar</TabLabel>
              </Link>
            </li>
          ) : (
            <li className="col-span-2 flex">
              <Link href="/registro" className={cn(SLOT, 'font-semibold text-accent')}>
                <TabLabel>Crear cuenta</TabLabel>
              </Link>
            </li>
          )}

          <li className="flex">
            <Link href="/buscar" className={cn(SLOT, 'text-text-secondary')}>
              <TabIcon icon={Search} />
              <TabLabel>Buscar</TabLabel>
            </Link>
          </li>

          {profile ? (
            <li className="flex">
              <Link href="/avisos" className={cn(SLOT, 'relative text-text-secondary')}>
                <TabIcon icon={Bell} />
                <TabLabel>Avisos</TabLabel>
                <Suspense fallback={null}>
                  <ChromeUnreadBadge className="absolute right-3 top-2" />
                </Suspense>
              </Link>
            </li>
          ) : null}
        </ul>
      </nav>
    </>
  )
}
