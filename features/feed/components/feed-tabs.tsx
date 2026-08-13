/**
 * features/feed/components/feed-tabs.tsx — las dos pestañas del feed (PART 12 §12.1).
 *
 * Son links, no un widget de JS: cada pestaña tiene su URL propia y durable (D7), así el
 * back del navegador funciona, el link se puede compartir y la página no paga un gramo de
 * JavaScript de cliente por cambiar de solapa (BUILD-CONTRACT §8).
 *
 * Quién ve qué lo decide la página, no este componente: el lector con sesión aterriza en
 * "Mis materias" (`/`) y "Reciente" vive en `/reciente`; el visitante sin sesión ve
 * contenido de Reciente en `/` porque no hay nada que personalizarle (§12.1), y ahí la
 * página directamente no monta estas pestañas.
 */
import { Tabs } from '@/components/ui/tabs'

/** Las dos únicas rutas de feed del MVP (D2). No hay "Para vos" ni "Tendencias". */
export const FEED_TABS = [
  { href: '/', label: 'Mis materias' },
  { href: '/reciente', label: 'Reciente' },
] as const

export type FeedTabHref = (typeof FEED_TABS)[number]['href']

export function FeedTabs({
  activeHref,
  className,
}: {
  activeHref: FeedTabHref
  className?: string
}) {
  return <Tabs items={[...FEED_TABS]} activeHref={activeHref} className={className} />
}
