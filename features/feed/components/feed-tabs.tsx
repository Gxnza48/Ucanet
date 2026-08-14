/**
 * features/feed/components/feed-tabs.tsx — las cuatro pestañas del feed (PART 12 §12.1).
 *
 * Son links, no un widget de JS: cada pestaña tiene su URL propia y durable (D7), así el
 * back del navegador funciona, el link se puede compartir y la página no paga un gramo de
 * JavaScript de cliente por cambiar de solapa (BUILD-CONTRACT §8).
 *
 * EL ORDEN NO ES ARBITRARIO. Es de más personal a más público, que es el orden en que se
 * usan: "Para vos" es la home de todos los días; "Mis materias" es la vista acotada a lo que
 * seguís, para cuando querés solo eso; "Reciente" es el sitio entero sin filtro; "Tendencias"
 * es la consulta ocasional. La primera es la que se lee sin pensar, la última es la que se
 * elige a propósito.
 *
 * `flex-wrap` en vez de scroll horizontal: a 360px (el piso de diseño, §17.6) los cuatro
 * rótulos suman unos 356px contra 328px de columna útil, así que "Tendencias" baja a una
 * segunda línea. Se descartó `overflow-x-auto` porque el `-mb-px` de la pestaña activa —el
 * que monta el subrayado de 2px sobre la hairline— queda 1px fuera de la caja de relleno y
 * un contenedor con overflow se lo come. Envolver no rompe nada y el sitio nunca desplaza
 * horizontalmente, que es la regla dura de §17.6.
 *
 * Quién ve qué lo decide la página, no este componente: el visitante sin sesión ve el feed
 * Reciente en `/` y ahí la página directamente no monta estas pestañas (§12.1), porque
 * "Para vos" sin señales del lector no tiene nada que ofrecer.
 */
import { Tabs } from '@/components/ui/tabs'
import { cn } from '@/lib/cn'

/** Las cuatro rutas de feed. El orden es el de la barra, de más personal a más público. */
export const FEED_TABS = [
  { href: '/', label: 'Para vos' },
  { href: '/mis-materias', label: 'Mis materias' },
  { href: '/reciente', label: 'Reciente' },
  { href: '/tendencias', label: 'Tendencias' },
] as const

export type FeedTabHref = (typeof FEED_TABS)[number]['href']

export function FeedTabs({
  activeHref,
  className,
}: {
  activeHref: FeedTabHref
  className?: string
}) {
  return (
    <Tabs items={[...FEED_TABS]} activeHref={activeHref} className={cn('flex-wrap', className)} />
  )
}
