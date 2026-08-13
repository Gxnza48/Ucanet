/**
 * features/posts/components/post-row.tsx — la fila del feed.
 *
 * Contrato de contenido: PART 12 §12.5. Forma: PART 17 §17.2.3 — fila compacta,
 * no tarjeta (D8: densidad por filas). Se reusa igual en el feed, en la página de
 * materia, en el perfil y en los resultados de búsqueda.
 *
 * Sin control de voto (§0.5-R20): el score va como texto y votar sólo existe en
 * la página del post. Eso deja la fila 100% Server Component, sin un solo byte de
 * JS de cliente, que es lo que hace baratas las listas largas.
 *
 * Renderiza un `<li>` (viene de `ListRow`): usalo dentro de un `<ul>`.
 */
import { Chip } from '@/components/ui/chip'
import { ListRow } from '@/components/ui/list-row'
import { formatDate, relativeTime } from '@/lib/utils/dates'
import { excerpt } from '@/lib/utils/text'
import type { PostListItem } from '../queries'

/** Sin título, el cuerpo hace de renglón de título (PART 12 §12.5). */
const TITLE_FALLBACK_LENGTH = 120
/** Con título, el cuerpo se muestra recortado debajo. */
const PREVIEW_LENGTH = 160

export function PostRow({ post }: { post: PostListItem }) {
  const href = `/p/${post.publicId}`
  const body = post.body ?? ''
  const ownTitle = post.title?.trim() ?? ''
  const title = ownTitle.length > 0 ? ownTitle : excerpt(body, TITLE_FALLBACK_LENGTH)
  const preview = ownTitle.length > 0 ? excerpt(body, PREVIEW_LENGTH) : ''
  const scope = post.materia ?? post.carrera
  const scopeHref = post.materia
    ? `/materias/${post.materia.slug}`
    : post.carrera
      ? `/carreras/${post.carrera.slug}`
      : undefined

  return (
    <ListRow
      href={href}
      meta={
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {/* El handle no es link en el feed: el único link anidado de la fila es
              el chip de materia (PART 12 §12.5). `is_anonymous` se consulta
              primero y `author_handle` después: la vista ya anula el segundo en
              lo anónimo, y mirar los dos deja la fila a salvo de cualquier
              origen futuro (D3). */}
          <span>{post.isAnonymous ? 'Anónimo' : (post.authorHandle ?? 'Anónimo')}</span>
          {scope && scopeHref ? (
            <>
              <span aria-hidden="true">·</span>
              <Chip href={scopeHref}>{scope.nombre}</Chip>
            </>
          ) : null}
          <span aria-hidden="true">·</span>
          <time dateTime={post.createdAt} title={formatDate(post.createdAt)}>
            {relativeTime(post.createdAt)}
          </time>
        </span>
      }
      title={
        post.kind === 'pregunta' ? (
          <span className="flex flex-wrap items-baseline gap-2">
            <Chip variant="neutral">Pregunta</Chip>
            <span>{title}</span>
          </span>
        ) : (
          title
        )
      }
      trailing={
        post.score > 0 || post.commentsCount > 0 ? (
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {/* "Sin comentarios" no se muestra: la ausencia es silenciosa (§12.5). */}
            {post.score > 0 ? <span>{plural(post.score, 'voto', 'votos')}</span> : null}
            {post.commentsCount > 0 ? (
              <a href={href} className="hover:underline">
                {plural(post.commentsCount, 'comentario', 'comentarios')}
              </a>
            ) : null}
          </span>
        ) : null
      }
    >
      {preview ? <p className="line-clamp-3">{preview}</p> : null}
    </ListRow>
  )
}

function plural(count: number, one: string, many: string): string {
  return `${count.toLocaleString('es-AR')} ${count === 1 ? one : many}`
}
