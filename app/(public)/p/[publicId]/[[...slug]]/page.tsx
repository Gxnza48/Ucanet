/**
 * app/(public)/p/[publicId]/[[...slug]]/page.tsx — la página de la publicación
 * (PART 17 §17.4.2, D7, PART 23 §23.1-23.2).
 *
 * SUFIJO DE SLUG IGNORADO (D7). La ruta es `[[...slug]]` opcional: `/p/a1b2c3d4e5`
 * y `/p/a1b2c3d4e5/conviene-cursar-romano-en-verano` renderizan exactamente lo
 * mismo. El slug existe para que un link pegado en WhatsApp diga de qué habla; el
 * `public_id` es lo único que resuelve. Por eso el canonical apunta SIEMPRE a la
 * forma corta (§23.2): es la promesa de diez años, el slug es decoración.
 *
 * LÁPIDA (§0.5-R23c, PART 23 §23.1). `getPost` devuelve `null` tanto si el id no
 * existió nunca como si la publicación fue eliminada — `posts_public` filtra
 * `status = 'activo'`, así que desde acá son indistinguibles. La ruta corta ese
 * nudo por la forma del id: si no parece un `public_id`, es basura y va 404; si
 * lo parece, se asume contenido que existió y se sirve la lápida.
 *
 * DEUDA CONOCIDA — el estado HTTP de la lápida. §0.5-R23c pide 410 Gone y una
 * página del App Router no puede fijar el código de respuesta: Next 16 solo
 * expone `notFound()` (404), `forbidden()` (403) y `unauthorized()` (401). Hasta
 * que el 410 lo emita `proxy.ts` (o un route handler dedicado), la lápida
 * responde 200 con `robots: noindex, nofollow`, que consigue el objetivo real de
 * la regla —desindexar— aunque no su código exacto. Está reportado.
 *
 * AUTORÍA. `isAuthor` sale de `isOwnPost` (RPC `is_own_content`, migración
 * 0014), no de comparar `authorHandle` con el seudónimo de quien mira: en una
 * publicación ANÓNIMA `authorHandle` es null por construcción, así que esa
 * comparación le negaba a su propio autor editar y borrar (C6, Ley 25.326) y
 * encima le ofrecía votarse a sí mismo. LÍMITE CONOCIDO: el árbol de comentarios
 * sigue resolviendo la autoría por handle (`viewerHandle`), porque preguntarlo
 * de a uno sería una consulta por fila; mientras no exista una RPC por lote, un
 * comentario anónimo propio no muestra sus acciones de autor. Está reportado.
 *
 * RENDERIZADO: dinámica (PART 20 §20.2). Un hilo tiene que ser correcto AHORA:
 * si moderación borró un comentario hace diez segundos, no puede seguir en
 * pantalla. Las escrituras invalidan la etiqueta `post:<publicId>`
 * (`features/posts/actions.ts`), que es el vocabulario del contrato §4.6.
 *
 * Cliente: la página en sí es un Server Component. Las islas son el voto, el
 * menú de acciones, el compositor de comentarios y el diálogo de reporte — las
 * cuatro están en la lista blanca de PART 19 §19.3.
 */
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'

import { Breadcrumb } from '@/components/ui/breadcrumb'
import { ButtonLink } from '@/components/ui/button'
import { Pagination } from '@/components/ui/pagination'
import { ReportDialog } from '@/features/mod/components/report-dialog'
import { CommentForm } from '@/features/posts/components/comment-form'
import { CommentThread } from '@/features/posts/components/comment-thread'
import { PostActions } from '@/features/posts/components/post-actions'
import { PostView } from '@/features/posts/components/post-view'
import {
  getComments,
  getPost,
  getViewerCommentVotes,
  getViewerPostVotes,
  isOwnPost,
  type CommentNode,
  type PostDetail,
} from '@/features/posts/queries'
import { SITE_NAME } from '@/lib/config'
import { absoluteUrl } from '@/lib/env'
import { getProfile, getUser } from '@/lib/supabase/server'
import { isPublicId } from '@/lib/utils/public-id'
import { excerpt, truncate } from '@/lib/utils/text'

export const dynamic = 'force-dynamic'

/** Largo del título derivado del cuerpo cuando la publicación no tiene uno (§23.2). */
const TITLE_FROM_BODY = 55

/** Largo de la meta description y del extracto de Open Graph (§23.2, D11). */
const DESCRIPTION_LENGTH = 155

/** Parámetro del cursor de comentarios. Keyset, no número de página (§4.5). */
const COMMENTS_CURSOR_PARAM = 'comentarios'

type PageParams = { publicId: string; slug?: string[] }
type PageSearchParams = { [key: string]: string | string[] | undefined }

type PageProps = {
  params: Promise<PageParams>
  searchParams: Promise<PageSearchParams>
}

/**
 * `generateMetadata` y el render son dos pasadas del mismo request y las dos
 * necesitan la publicación. `cache()` de React memoriza por request, así que la
 * consulta se hace una sola vez (la feature no la memoriza por su cuenta).
 */
const loadPost = cache(getPost)

/** Título visible de la publicación: el propio, o el cuerpo recortado. */
function headline(post: PostDetail, max: number): string {
  const own = post.title?.trim() ?? ''
  if (own.length > 0) return truncate(own, max)
  return excerpt(post.body ?? '', max) || 'Publicación'
}

function readParam(params: PageSearchParams, key: string): string | undefined {
  const value = params[key]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { publicId } = await params

  if (!isPublicId(publicId)) {
    return { title: { absolute: `Publicación | ${SITE_NAME}` }, robots: { index: false } }
  }

  const post = await loadPost(publicId)

  if (!post) {
    // La lápida no se indexa: es justamente la señal de que esto se fue (§23.1).
    return {
      title: { absolute: `Publicación eliminada | ${SITE_NAME}` },
      robots: { index: false, follow: true },
    }
  }

  // El canonical descarta el sufijo de slug y cualquier parámetro (§23.2).
  const canonical = absoluteUrl(`/p/${post.publicId}`)
  const title = `${headline(post, TITLE_FROM_BODY)} | ${SITE_NAME}`
  // La descripción es lo que se lee en la tarjeta de WhatsApp (D11): el cuerpo
  // aplastado a una línea y cortado en límite de palabra, nunca a mitad.
  const description = excerpt(post.body ?? '', DESCRIPTION_LENGTH) || SITE_NAME

  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    openGraph: {
      type: 'article',
      locale: 'es_AR',
      siteName: SITE_NAME,
      url: canonical,
      title,
      description,
      publishedTime: post.createdAt,
      modifiedTime: post.editedAt ?? undefined,
    },
    twitter: { card: 'summary', title, description },
  }
}

export default async function PostPage({ params, searchParams }: PageProps) {
  const { publicId } = await params

  // Forma inválida = nunca existió. 404 y no lápida: no hay nada que desindexar.
  if (!isPublicId(publicId)) notFound()

  const post = await loadPost(publicId)
  if (!post) return <Tombstone />

  const sp = await searchParams
  const cursor = readParam(sp, COMMENTS_CURSOR_PARAM)

  // `isOwnPost` va en el mismo lote que el resto: es una RPC más contra la misma
  // conexión y no depende de nada de acá abajo, así que no suma latencia serie.
  const [user, profile, comments, isAuthor] = await Promise.all([
    getUser(),
    getProfile(),
    getComments(post.id, { cursor }),
    isOwnPost(post.publicId),
  ])

  const signedIn = user !== null
  const viewerHandle = profile?.handle ?? null
  const isMod = profile?.role === 'mod' || profile?.role === 'admin'

  // Los ids internos se usan sólo acá adentro para resolver el voto propio; a los
  // componentes de cliente viaja `public_id`, nunca el bigint (D14.7).
  const commentIds = comments.items.flatMap((comment) => [
    comment.id,
    ...comment.replies.map((reply) => reply.id),
  ])

  const [postVotes, commentVotes] = await Promise.all([
    getViewerPostVotes([post.id]),
    getViewerCommentVotes(commentIds),
  ])

  const scope = post.materia ?? post.carrera
  const scopeHref = post.materia
    ? `/materias/${post.materia.slug}`
    : post.carrera
      ? `/carreras/${post.carrera.slug}`
      : undefined

  const nextHref = comments.nextCursor
    ? `/p/${post.publicId}?${COMMENTS_CURSOR_PARAM}=${encodeURIComponent(comments.nextCursor)}`
    : undefined

  return (
    <div className="mx-auto w-full max-w-170 py-6">
      <Breadcrumb
        items={[
          { href: '/', label: 'Inicio' },
          ...(scope && scopeHref ? [{ href: scopeHref, label: scope.nombre }] : []),
          { label: 'Publicación' },
        ]}
      />

      <PostView
        post={post}
        actions={
          <div className="flex flex-wrap items-center gap-1">
            <PostActions
              publicId={post.publicId}
              title={post.title}
              body={post.body}
              label={truncate(headline(post, 60), 60)}
              score={post.score}
              voted={postVotes.has(post.id)}
              signedIn={signedIn}
              isAuthor={isAuthor}
              isMod={isMod}
              locked={post.lockedAt !== null}
              materiaSlug={post.materia?.slug}
            />
            {/* "Reportar" va como control propio y no dentro del menú: el diálogo
                de features/mod trae su propio disparador y no acepta que lo abran
                desde afuera (no expone `open`/`onOpenChange`). Reportado. */}
            {signedIn ? <ReportDialog targetKind="post" targetPublicId={post.publicId} /> : null}
          </div>
        }
      />

      <section className="mt-8" aria-labelledby="comentarios">
        <h2 id="comentarios" className="text-m font-semibold text-text-secondary">
          {post.commentsCount === 1 ? '1 comentario' : `${post.commentsCount} comentarios`}
        </h2>

        <CommentForm
          postPublicId={post.publicId}
          signedIn={signedIn}
          locked={post.lockedAt !== null}
          className="mt-3"
        />

        <CommentThread
          postPublicId={post.publicId}
          comments={comments.items}
          votedIds={commentVotes}
          signedIn={signedIn}
          locked={post.lockedAt !== null}
          viewerHandle={viewerHandle}
          commentActions={(comment: CommentNode) =>
            signedIn ? (
              <ReportDialog targetKind="comment" targetPublicId={comment.publicId} />
            ) : null
          }
          className="mt-5"
        />

        <Pagination className="mt-2" nextHref={nextHref} />
      </section>
    </div>
  )
}

/**
 * Lápida (§0.5-R23c). Se dice qué pasó y no se ofrece nada más: la dirección no
 * se recicla y el contenido no vuelve. El tono es el de §17.5.6 — una frase y una
 * salida.
 */
function Tombstone() {
  return (
    <div className="mx-auto w-full max-w-170 py-6">
      <h1 className="font-serif text-xl font-semibold text-text-primary">
        Esta publicación ya no está.
      </h1>
      <p className="mt-3 text-base text-text-secondary">
        La eliminó su autor o el equipo de moderación. Esta dirección queda como está: no la
        reutilizamos para otra cosa.
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <ButtonLink variant="secondary" href="/reciente">
          Ver lo reciente
        </ButtonLink>
        <Link
          href="/reglas"
          className="text-m font-semibold text-accent transition-colors duration-150 ease-out hover:text-accent-hover hover:underline"
        >
          Leer las reglas
        </Link>
      </div>
    </div>
  )
}
