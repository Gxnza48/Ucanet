/**
 * features/posts/components/comment-thread.tsx — el árbol de comentarios
 * (PART 17 §17.4.2).
 *
 * Profundidad máxima 2 (D2): comentarios de primer nivel y sus respuestas. Las
 * respuestas se indentan 24px detrás de una línea vertical de 1px, que es el
 * ÚNICO indicio de jerarquía — sin curvas conectoras, sin avatares, sin fondos.
 *
 * Orden cronológico ascendente en los dos niveles: lo arma `getComments`. Un
 * archivo que se lee de arriba abajo dentro de diez años vale más que un orden
 * por engagement (D1).
 *
 * Server Component: las únicas islas de cliente son el botón de voto y el
 * "Responder", que montan su propio JS.
 */
import type { ReactNode } from 'react'
import { EmptyState } from '@/components/ui/empty-state'
import { formatDate, relativeTime } from '@/lib/utils/dates'
import type { CommentNode } from '../queries'
import { CommentReply } from './comment-form'
import { ContentBody } from './post-view'
import { VoteButton } from './vote-button'

export function CommentThread({
  postPublicId,
  comments,
  votedIds,
  signedIn,
  locked = false,
  viewerHandle,
  commentActions,
  className,
}: {
  postPublicId: string
  comments: CommentNode[]
  /** Ids internos de los comentarios que ya votó quien mira (`getViewerCommentVotes`). */
  votedIds: Set<number>
  signedIn: boolean
  locked?: boolean
  /** Seudónimo de quien mira, para no ofrecerle votar lo suyo (la RPC lo rechaza igual). */
  viewerHandle?: string | null
  /**
   * Ranura por comentario: el menú de desborde con "Reportar" lo provee quien
   * arma la página, porque el diálogo de reporte vive en otra feature.
   */
  commentActions?: (comment: CommentNode) => ReactNode
  className?: string
}) {
  return (
    <section aria-labelledby="comentarios-titulo" className={className}>
      <h2 id="comentarios-titulo" className="sr-only">
        Comentarios
      </h2>

      {comments.length === 0 ? (
        <EmptyState title="Todavía no hay comentarios." />
      ) : (
        <ul className="flex flex-col">
          {comments.map((comment) => (
            <li key={comment.publicId} className="border-b border-border py-3">
              <CommentBlock
                comment={comment}
                postPublicId={postPublicId}
                votedIds={votedIds}
                signedIn={signedIn}
                locked={locked}
                viewerHandle={viewerHandle}
                commentActions={commentActions}
                canReply
              />

              {comment.replies.length > 0 ? (
                // 24px de sangría detrás de una línea de 1px: el único indicio de
                // jerarquía del hilo (§17.4.2).
                <ul className="mt-3 flex flex-col gap-3 border-l border-border pl-6">
                  {comment.replies.map((reply) => (
                    <li key={reply.publicId}>
                      <CommentBlock
                        comment={reply}
                        postPublicId={postPublicId}
                        votedIds={votedIds}
                        signedIn={signedIn}
                        locked={locked}
                        viewerHandle={viewerHandle}
                        commentActions={commentActions}
                      />
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function CommentBlock({
  comment,
  postPublicId,
  votedIds,
  signedIn,
  locked,
  viewerHandle,
  commentActions,
  canReply = false,
}: {
  comment: CommentNode
  postPublicId: string
  votedIds: Set<number>
  signedIn: boolean
  locked: boolean
  viewerHandle?: string | null
  commentActions?: (comment: CommentNode) => ReactNode
  canReply?: boolean
}) {
  // Lápida: la fila sobrevive para que las respuestas conserven contexto, pero no
  // hay ni cuerpo, ni autor, ni acciones (§8.7).
  if (comment.status !== 'activo') {
    return (
      <p className="text-m text-text-secondary">
        {comment.status === 'eliminado_mod'
          ? 'Comentario eliminado por moderación.'
          : 'Comentario eliminado por su autor.'}
      </p>
    )
  }

  const isOwn = comment.authorHandle !== null && comment.authorHandle === viewerHandle

  return (
    <div className="flex flex-col gap-2">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-s text-text-secondary">
        <AuthorName comment={comment} />
        <span aria-hidden="true">·</span>
        <time dateTime={comment.createdAt} title={formatDate(comment.createdAt)}>
          {relativeTime(comment.createdAt)}
        </time>
        {comment.editedAt ? (
          <>
            <span aria-hidden="true">·</span>
            <span title={formatDate(comment.editedAt)}>editado</span>
          </>
        ) : null}
      </p>

      <ContentBody text={comment.body ?? ''} />

      <div className="flex flex-wrap items-center gap-2">
        <VoteButton
          target="comentario"
          publicId={comment.publicId}
          score={comment.score}
          voted={votedIds.has(comment.id)}
          signedIn={signedIn}
          disabled={isOwn}
        />
        {canReply ? (
          <CommentReply
            postPublicId={postPublicId}
            parentPublicId={comment.publicId}
            signedIn={signedIn}
            locked={locked}
          />
        ) : null}
        {commentActions?.(comment)}
      </div>
    </div>
  )
}

/**
 * Los anónimos se muestran con su alias por hilo y NUNCA se linkean: no hay
 * perfil detrás (D3). El alias 0 está reservado a quien escribió la publicación,
 * que en su propio hilo aparece como "Anónimo (autor)" (§8.3.4, PART 9 §9.6.2).
 */
function AuthorName({ comment }: { comment: CommentNode }) {
  // Se exigen las dos señales antes de imprimir un seudónimo: `comments_public`
  // ya anula `author_handle` en lo anónimo y en las lápidas, y `is_anonymous` es
  // la bandera explícita. Un handle sin su bandera en falso no se renderiza.
  if (!comment.isAnonymous && comment.authorHandle) {
    return (
      <a href={`/u/${comment.authorHandle}`} className="hover:underline">
        {comment.authorHandle}
      </a>
    )
  }

  if (comment.anonAliasNum === null) return <span>Anónimo</span>
  return (
    <span>
      {comment.anonAliasNum === 0 ? 'Anónimo (autor)' : `Anónimo ${comment.anonAliasNum}`}
    </span>
  )
}
