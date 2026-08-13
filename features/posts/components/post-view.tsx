/**
 * features/posts/components/post-view.tsx — el bloque de la publicación en su
 * página (PART 17 §17.4.2).
 *
 * Server Component puro: cero JS de cliente. La barra de acciones (voto,
 * compartir, menú) es una isla aparte y entra por la ranura `actions`, así la
 * página decide qué permisos tiene quien mira sin que este componente sepa nada
 * de sesiones.
 */
import type { ReactNode } from 'react'
import { Chip } from '@/components/ui/chip'
import { cn } from '@/lib/cn'
import { formatDate, relativeTime } from '@/lib/utils/dates'
import type { PostDetail } from '../queries'

export function PostView({
  post,
  actions,
  className,
}: {
  post: PostDetail
  /** Ranura de la barra de acciones (`<PostActions />`). */
  actions?: ReactNode
  className?: string
}) {
  const title = post.title?.trim() ?? ''
  const scope = post.materia ?? post.carrera
  const scopeHref = post.materia
    ? `/materias/${post.materia.slug}`
    : post.carrera
      ? `/carreras/${post.carrera.slug}`
      : undefined

  return (
    <article className={cn('py-4', className)}>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-s text-text-secondary">
        {/* El autor anónimo NUNCA se linkea: no hay perfil que abrir (D3). Se
            miran las DOS señales — `posts_public` ya anula `author_handle` en lo
            anónimo, y `is_anonymous` es la bandera explícita: si alguna vez
            llegara un handle junto a un post anónimo, acá no se imprime. */}
        {!post.isAnonymous && post.authorHandle ? (
          <a href={`/u/${post.authorHandle}`} className="hover:underline">
            {post.authorHandle}
          </a>
        ) : (
          <span>Anónimo</span>
        )}
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
        {post.editedAt ? (
          <>
            <span aria-hidden="true">·</span>
            <span title={formatDate(post.editedAt)}>editado</span>
          </>
        ) : null}
        {post.lockedAt ? (
          <>
            <span aria-hidden="true">·</span>
            <Chip variant="neutral">Hilo bloqueado</Chip>
          </>
        ) : null}
      </p>

      {title ? (
        <h1 className="mt-2 flex flex-wrap items-baseline gap-2 text-xl font-semibold text-text-primary">
          {post.kind === 'pregunta' ? <Chip variant="neutral">Pregunta</Chip> : null}
          <span>{title}</span>
        </h1>
      ) : post.kind === 'pregunta' ? (
        <p className="mt-2">
          <Chip variant="neutral">Pregunta</Chip>
        </p>
      ) : null}

      <ContentBody text={post.body ?? ''} className="mt-3" />

      {actions ? <div className="mt-4">{actions}</div> : null}
    </article>
  )
}

/**
 * Cuerpo de contenido escrito por una persona: texto plano con los saltos de
 * línea conservados (`.user-content` pone `white-space: pre-wrap`) y las URLs
 * detectadas y convertidas en links. No hay Markdown ni HTML en el MVP, y no se
 * inyecta HTML crudo en ninguna parte: el escapado de React es el sanitizador
 * (PART 19 §19.12, PART 25 §25.8).
 *
 * Lo comparte `comment-thread.tsx`, que renderiza cuerpos con las mismas reglas.
 */
export function ContentBody({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn('user-content text-base text-text-primary', className)}>{linkify(text)}</div>
  )
}

/** URLs absolutas; los dominios sueltos ("uca.edu.ar") no se autolinkean a propósito. */
const LINK_PATTERN = /https?:\/\/[^\s<>"']+/g

/** Puntuación que suele quedar pegada al final de una URL en una oración. */
const TRAILING_PUNCTUATION = /[.,;:!?)\]}»"']+$/

function linkify(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let cursor = 0

  for (const match of text.matchAll(LINK_PATTERN)) {
    const start = match.index
    if (start === undefined) continue

    const trailing = TRAILING_PUNCTUATION.exec(match[0])?.[0] ?? ''
    const url = trailing ? match[0].slice(0, match[0].length - trailing.length) : match[0]
    if (url.length === 0) continue

    if (start > cursor) nodes.push(text.slice(cursor, start))
    nodes.push(
      <a
        key={`${start}-${url}`}
        href={url}
        target="_blank"
        // `ugc` + `nofollow` porque es contenido de terceros; `noreferrer` para no
        // filtrar la URL de origen a un sitio ajeno.
        rel="nofollow ugc noopener noreferrer"
        className="text-accent"
      >
        {url}
      </a>,
    )
    cursor = start + url.length
  }

  if (cursor < text.length) nodes.push(text.slice(cursor))
  return nodes
}
