/**
 * features/feed/components/feed-list.tsx — la lista de publicaciones (PART 12 §12.5).
 *
 * Un `<ul>` de filas compactas, nunca tarjetas (D8: densidad por filas). El contrato de
 * contenido de cada fila lo cumple `FeedRow` (ver `feed-row.tsx`, que lo documenta tabla por
 * tabla); esta lista solo las ubica y decide qué va debajo.
 *
 * Es la misma lista que usan la página de materia, la de carrera y el perfil: recibe filas
 * con la forma de `PostListItem` y no le importa de qué consulta salieron.
 *
 * DOS MODOS, y el segundo es opcional a propósito:
 *
 *   - Sin `loadMore` (materia, carrera, perfil, y la home del visitante sin sesión): la lista
 *     es Server Component puro, sin un byte de JavaScript de ruta, y la página siguiente se
 *     alcanza con `<Pagination>` —links de verdad, con el cursor en la URL—. Es el modo que
 *     mantiene la promesa de BUILD-CONTRACT §8 en las páginas de contenido.
 *   - Con `loadMore` (las pestañas del feed): se monta `FeedInfinite` al pie, que carga solo
 *     las primeras páginas y después ofrece un botón (§17.5.2). El scroller vive DENTRO del
 *     `<ul>` porque las filas que trae pertenecen a la misma lista, no a una segunda.
 *
 * El scroller solo se monta si además hay `nextCursor`: sin página siguiente no hay nada que
 * cargar y montar un botón muerto sería peor que no montarlo.
 */
import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

import type { PostListItem } from '../queries'
import { FeedInfinite, type LoadMoreFeed } from './feed-infinite'
import { FeedRow } from './feed-row'

export { FeedRow } from './feed-row'
export type { LoadMoreFeed } from './feed-infinite'

export function FeedList({
  items,
  showScope = true,
  emptyState,
  loadMore,
  nextCursor = null,
  className,
}: {
  items: PostListItem[]
  /**
   * En la página de una materia el chip de esa materia sobra: ya sabés dónde estás.
   * Ponelo en false ahí; en el feed y en el perfil va en true.
   */
  showScope?: boolean
  /**
   * Qué mostrar cuando no hay filas. Los estados vacíos del feed son superficies de
   * onboarding con copy vinculante (§12.6) y sus acciones cruzan a otras features
   * (el composer, `/materias`), así que los arma la página y este componente solo los ubica.
   */
  emptyState?: ReactNode
  /**
   * La Server Action de `../actions` que devuelve la página siguiente. Cuando viene, la
   * lista pagina sola; cuando no, la página se encarga con `<Pagination>`.
   */
  loadMore?: LoadMoreFeed
  /** El `nextCursor` de la primera página. Solo se usa junto con `loadMore`. */
  nextCursor?: string | null
  className?: string
}) {
  if (items.length === 0) return emptyState ?? null

  return (
    <ul className={cn('border-t border-border', className)}>
      {items.map((post) => (
        <FeedRow key={post.publicId} post={post} showScope={showScope} />
      ))}
      {/* `key={nextCursor}`: cuando el servidor entrega una primera página nueva, el scroller
          se remonta y tira la cola que había acumulado de la consulta anterior. */}
      {loadMore && nextCursor !== null ? (
        <FeedInfinite
          key={nextCursor}
          initialCursor={nextCursor}
          loadMore={loadMore}
          showScope={showScope}
        />
      ) : null}
    </ul>
  )
}
