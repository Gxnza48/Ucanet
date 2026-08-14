/**
 * features/bookmarks/components/guardados-list.tsx — la lista de `/guardados`.
 *
 * Server Component. El único JavaScript que embarca es el botón de guardar de cada fila,
 * que es lo que convierte la lista en accionable: desde acá se quita, no hace falta entrar
 * a la publicación para deshacer.
 *
 * FORMA. La misma fila densa del feed (PART 12 §12.5, D8: densidad por filas, nunca
 * tarjetas), con una diferencia: el pie lleva "Guardado hace 2 días". Ese dato no es
 * decorativo — es lo que explica el orden de la lista, que es por fecha de guardado y no
 * por fecha de publicación ni por ranking. Sin él, una lista donde un post de marzo aparece
 * arriba de uno de agosto se lee como un bug.
 *
 * La fila es una copia estructural de `FeedRow` (features/feed) y no un import: una feature
 * nunca importa otra (BUILD-CONTRACT §2), y no existe `features/shared/`. Si algún día una
 * tercera feature necesita la misma fila, se promueve a `components/ui`.
 */

import { Chip } from '@/components/ui/chip'
import { EmptyState } from '@/components/ui/empty-state'
import { ListRow } from '@/components/ui/list-row'
import { cn } from '@/lib/cn'
import { formatDate, relativeTime } from '@/lib/utils/dates'
import { excerpt } from '@/lib/utils/text'

import type { GuardadoItem } from '../queries'
import { BookmarkButton } from './bookmark-button'

/** §12.5: sin título, el cuerpo hace de título hasta 120 caracteres. */
const TITLE_FALLBACK_CHARS = 120

/** §12.5: con título, el preview del cuerpo llega hasta 160. */
const PREVIEW_CHARS = 160

function votosLabel(score: number): string {
  return score === 1 ? '1 voto' : `${score.toLocaleString('es-AR')} votos`
}

function comentariosLabel(count: number): string {
  return count === 1 ? '1 comentario' : `${count.toLocaleString('es-AR')} comentarios`
}

/** El punto medio que separa los datos de una línea de meta. Decorativo: no se lee. */
function Separator() {
  return (
    <span aria-hidden="true" className="px-1">
      ·
    </span>
  )
}

function GuardadoRow({ item }: { item: GuardadoItem }) {
  const scope = item.materia ?? item.carrera
  const scopeHref = item.materia
    ? `/materias/${item.materia.slug}`
    : item.carrera
      ? `/carreras/${item.carrera.slug}`
      : null

  const hasTitle = item.title !== null && item.title.length > 0
  const titleLine = hasTitle ? item.title : excerpt(item.body, TITLE_FALLBACK_CHARS)
  const preview = hasTitle ? excerpt(item.body, PREVIEW_CHARS) : null

  const hasCounters = item.score > 0 || item.commentsCount > 0

  return (
    <ListRow
      href={`/p/${item.publicId}`}
      meta={
        <>
          {/* `is_anonymous` se consulta primero y `author_handle` después: la vista ya
              anula el segundo en lo anónimo, y mirar los dos deja la fila a salvo de
              cualquier origen futuro (D3). */}
          <span>{item.isAnonymous ? 'Anónimo' : (item.authorHandle ?? 'Anónimo')}</span>
          {scope && scopeHref ? (
            <>
              <Separator />
              <Chip href={scopeHref}>{scope.nombre}</Chip>
            </>
          ) : null}
          <Separator />
          <time dateTime={item.createdAt} title={formatDate(item.createdAt)}>
            {relativeTime(item.createdAt)}
          </time>
        </>
      }
      title={
        <>
          {item.kind === 'pregunta' ? (
            <Chip variant="neutral" className="mr-2 align-middle">
              Pregunta
            </Chip>
          ) : null}
          {titleLine}
        </>
      }
      trailing={
        <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span className="flex flex-wrap items-center">
            {item.score > 0 ? <span>{votosLabel(item.score)}</span> : null}
            {item.score > 0 && item.commentsCount > 0 ? <Separator /> : null}
            {item.commentsCount > 0 ? <span>{comentariosLabel(item.commentsCount)}</span> : null}
            {hasCounters ? <Separator /> : null}
            <span>
              Guardado{' '}
              <time dateTime={item.savedAt} title={formatDate(item.savedAt)}>
                {relativeTime(item.savedAt)}
              </time>
            </span>
          </span>
          <BookmarkButton publicId={item.publicId} guardado />
        </span>
      }
    >
      {/* line-clamp-3 (§17.2.3): el preview se corta a tres líneas sin "ver más" — el
          destino de la fila entera ya es la publicación. */}
      {preview ? <span className="line-clamp-3">{preview}</span> : null}
    </ListRow>
  )
}

export function GuardadosList({ items, className }: { items: GuardadoItem[]; className?: string }) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="Todavía no guardaste nada."
        description="Tocá el ícono de guardar en cualquier publicación."
        className={className}
      />
    )
  }

  return (
    <ul className={cn('border-t border-border', className)}>
      {items.map((item) => (
        <GuardadoRow key={item.publicId} item={item} />
      ))}
    </ul>
  )
}
