/**
 * app/_components/mobile-tab-bar.tsx — la barra inferior de mobile (PART 17 §17.1.2).
 *
 * CINCO SLOTS, con su justificación de la tabla de §17.1.2:
 *
 *   1. Inicio    `/`          → el feed es la superficie del chequeo diario; el pulgar empieza por la izquierda.
 *                               Lleva a "Para vos" y se marca activo en las cuatro rutas de feed (ver INICIO_ROUTES).
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
 * ESTADO ACTIVO (2026-08-14). Hasta esta versión la barra no marcaba la pestaña
 * actual, y el encabezado explicaba por qué: saberlo exige `usePathname()`, o sea
 * un Client Component, y la barra no estaba en la lista blanca de PART 19 §19.3.
 * La home de uso diario cambió el cálculo — con cuatro pestañas de feed detrás del
 * mismo slot, no decir dónde está uno es una barra que miente por omisión — así que
 * el estado se marca, y se paga lo mínimo: el único archivo de cliente es
 * `./tab-bar-link`, que resuelve el pathname y pone `aria-current`; el ícono, el
 * rótulo y el badge siguen renderizándose en el servidor y viajan como `children`.
 * La ampliación de la lista blanca está registrada en docs/decisions.md.
 *
 * "Publicar" no es un FAB flotante: los FAB son la estética de dashboard que §5
 * prohíbe. Es un slot más, con el ícono en acento dentro de un cuadrado de 2px de
 * radio (§17.1.2). Tampoco se marca nunca como activo: es una acción, no una
 * sección, y su destino es el ancla del compositor.
 */
import { Bell, BookOpen, Home, Plus, Search } from 'lucide-react'
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { Suspense, type ReactNode } from 'react'

import { cn } from '@/lib/cn'
import { getProfile } from '@/lib/supabase/server'

import { COMPOSER_HREF, ChromeUnreadBadge } from './site-header'
import { TabBarLink } from './tab-bar-link'

/** Alto de la barra: 56px (§17.1.2). El hueco que deja abajo lo suma el inset seguro. */
const BAR_HEIGHT_PX = 56

/**
 * Caja táctil de cada slot: ocupa la celda entera de la grilla, con 44px de alto
 * mínimo — el piso de objetivo táctil de §17.7 — dentro de una barra de 56px.
 * `relative` es el ancla de dos hijos posicionados: el badge de avisos y la marca
 * de 2px del slot actual.
 */
const SLOT =
  'relative flex h-full min-h-11 w-full flex-col items-center justify-center gap-0.5 rounded-input px-1'

/**
 * El slot actual: el texto sube de secundario a primario y una barra de 2px en
 * acento se apoya contra el borde superior de la barra.
 *
 * Es el mismo vocabulario que la pestaña activa de `components/ui/tabs` (2px de
 * acento sobre el borde que da al contenido), espejado hacia arriba porque acá el
 * contenido está arriba. Va como pseudo-elemento y no como borde para que el ícono
 * y el rótulo queden a la misma altura que en los slots inactivos: un `border-t-2`
 * les correría 2px la caja de contenido.
 *
 * El color NO es el único portador del estado (§17.7): la marca de 2px lo dice por
 * forma y posición, y el `aria-current` que pone `TabBarLink` lo dice por nombre.
 */
const SLOT_ACTIVE =
  'text-text-primary before:absolute before:inset-x-4 before:top-0 before:h-0.5 before:bg-accent'

const SLOT_INACTIVE = 'text-text-secondary'

/**
 * Todo esto es "Inicio". Las cuatro pestañas del feed —"Para vos" (`/`), "Mis
 * materias", "Reciente" y "Tendencias", ver `FEED_TABS` en
 * features/feed/components/feed-tabs.tsx— son un solo destino conceptual: se llega
 * a las cuatro desde este slot y ninguna se gana una ranura propia, porque un sexto
 * slot dejaría los objetivos táctiles por debajo de 44px (§17.1.2).
 *
 * La lista se repite acá en vez de importarse de la feature: importar el módulo de
 * las pestañas metería el componente `Tabs` en el bundle de cliente de TODAS las
 * páginas para leer cuatro cadenas. Si alguna vez se agrega una quinta pestaña de
 * feed, va también en esta lista.
 */
const INICIO_ROUTES = ['/mis-materias', '/reciente', '/tendencias'] as const

function TabIcon({ icon: Icon }: { icon: LucideIcon }) {
  // 18px es la medida de íconos en barras de navegación (§18.5).
  return <Icon aria-hidden="true" size={18} />
}

function TabLabel({ children }: { children: ReactNode }) {
  return <span className="text-xs">{children}</span>
}

/**
 * Un slot de navegación: la celda de la grilla más el link que se marca solo.
 *
 * Los slots que NO son navegación —"Publicar" y, sin sesión, "Crear cuenta"— no
 * pasan por acá: son acciones, van en acento y nunca llevan `aria-current`.
 */
function TabSlot({
  href,
  matches,
  children,
}: {
  href: string
  matches?: readonly string[]
  children: ReactNode
}) {
  return (
    <li className="flex">
      <TabBarLink
        href={href}
        matches={matches}
        className={SLOT}
        activeClassName={SLOT_ACTIVE}
        inactiveClassName={SLOT_INACTIVE}
      >
        {children}
      </TabBarLink>
    </li>
  )
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
          <TabSlot href="/" matches={INICIO_ROUTES}>
            <TabIcon icon={Home} />
            <TabLabel>Inicio</TabLabel>
          </TabSlot>

          {/* El prefijo marca también `/materias/[slug]` y su pestaña de recursos:
              seguir dentro del catálogo es seguir en esta sección. */}
          <TabSlot href="/materias">
            <TabIcon icon={BookOpen} />
            <TabLabel>Materias</TabLabel>
          </TabSlot>

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

          <TabSlot href="/buscar">
            <TabIcon icon={Search} />
            <TabLabel>Buscar</TabLabel>
          </TabSlot>

          {profile ? (
            <TabSlot href="/avisos">
              <TabIcon icon={Bell} />
              <TabLabel>Avisos</TabLabel>
              <Suspense fallback={null}>
                <ChromeUnreadBadge className="absolute right-3 top-2" />
              </Suspense>
            </TabSlot>
          ) : null}
        </ul>
      </nav>
    </>
  )
}
