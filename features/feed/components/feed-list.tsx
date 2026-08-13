/**
 * features/feed/components/feed-list.tsx — la lista de publicaciones (PART 12 §12.5).
 *
 * Una publicación = una fila compacta, nunca una tarjeta (D8: densidad por filas). El
 * contrato de contenido de la fila lo fija §12.5 y se cumple literal acá:
 *
 * | Rótulo de tipo | "Pregunta" solo cuando `kind = 'pregunta'`; el resto no lleva nada     |
 * | Título         | Completo. Si no hay título, los primeros 120 caracteres del cuerpo     |
 * | Preview        | Solo si HAY título: 160 caracteres, saltos aplastados, "…"             |
 * | Autor          | Handle o "Anónimo". Ningún otro dato de autor, nunca (D3)              |
 * | Chip de scope  | Materia → /materias/[slug]; si no hay materia, la carrera; si no, nada |
 * | Tiempo         | Relativo, dentro de un <time dateTime> con el timestamp completo       |
 * | Votos          | "12 votos"; se oculta en cero (una pared de "0 votos" se lee a fracaso)|
 * | Comentarios    | "8 comentarios"; el cero es silencio, no se escribe "Sin comentarios"  |
 *
 * Toda la fila es UN destino de link a `/p/[publicId]`; el chip de materia es el único link
 * anidado. No hay miniaturas ni botones de voto en el feed (§12.5, §17.5.1: se vota en la
 * página del post) — así la fila es estática y barata de renderizar, y esta lista puede ser
 * Server Component puro, sin JavaScript de ruta.
 *
 * Es la misma lista que usan la página de materia y la de carrera: recibe filas con la
 * forma de `PostListItem` y no le importa de qué consulta salieron.
 */
import type { ReactNode } from 'react'

import { Chip } from '@/components/ui/chip'
import { cn } from '@/lib/cn'
import { ListRow } from '@/components/ui/list-row'
import { formatDate, relativeTime } from '@/lib/utils/dates'
import { excerpt } from '@/lib/utils/text'

import type { PostListItem } from '../queries'

/** §12.5: sin título, el cuerpo hace de título hasta 120 caracteres. */
const TITLE_FALLBACK_CHARS = 120

/** §12.5: con título, el preview del cuerpo llega hasta 160. */
const PREVIEW_CHARS = 160

function votosLabel(score: number): string {
  return score === 1 ? '1 voto' : `${score} votos`
}

function comentariosLabel(count: number): string {
  return count === 1 ? '1 comentario' : `${count} comentarios`
}

/** El punto medio que separa los datos de la línea de meta. Decorativo: no se lee. */
function Separator() {
  return (
    <span aria-hidden="true" className="px-1">
      ·
    </span>
  )
}

export function FeedRow({ post, showScope = true }: { post: PostListItem; showScope?: boolean }) {
  const scope = post.materia ?? post.carrera
  const scopeHref = post.materia
    ? `/materias/${post.materia.slug}`
    : post.carrera
      ? `/carreras/${post.carrera.slug}`
      : null

  const hasTitle = post.title !== null && post.title.length > 0
  const titleLine = hasTitle ? post.title : excerpt(post.body, TITLE_FALLBACK_CHARS)
  const preview = hasTitle ? excerpt(post.body, PREVIEW_CHARS) : null

  return (
    <ListRow
      href={`/p/${post.publicId}`}
      meta={
        <>
          <span>{post.isAnonymous ? 'Anónimo' : (post.authorHandle ?? 'Anónimo')}</span>
          {showScope && scope && scopeHref ? (
            <>
              <Separator />
              <Chip href={scopeHref}>{scope.nombre}</Chip>
            </>
          ) : null}
          <Separator />
          <time dateTime={post.createdAt} title={formatDate(post.createdAt)}>
            {relativeTime(post.createdAt)}
          </time>
        </>
      }
      title={
        <>
          {post.kind === 'pregunta' ? (
            <Chip variant="neutral" className="mr-2 align-middle">
              Pregunta
            </Chip>
          ) : null}
          {titleLine}
        </>
      }
      trailing={
        post.score > 0 || post.commentsCount > 0 ? (
          <>
            {post.score > 0 ? <span>{votosLabel(post.score)}</span> : null}
            {post.score > 0 && post.commentsCount > 0 ? <Separator /> : null}
            {post.commentsCount > 0 ? <span>{comentariosLabel(post.commentsCount)}</span> : null}
          </>
        ) : null
      }
    >
      {/* line-clamp-3 (§17.2.3): el preview se corta a tres líneas sin "ver más" —
          el destino de la fila entera ya es el post. */}
      {preview ? <span className="line-clamp-3">{preview}</span> : null}
    </ListRow>
  )
}

export function FeedList({
  items,
  showScope = true,
  emptyState,
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
  className?: string
}) {
  if (items.length === 0) return emptyState ?? null

  return (
    <ul className={cn('border-t border-border', className)}>
      {items.map((post) => (
        <FeedRow key={post.publicId} post={post} showScope={showScope} />
      ))}
    </ul>
  )
}
