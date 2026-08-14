/**
 * features/posts/components/post-row.tsx — la fila del feed.
 *
 * Contrato de contenido: PART 12 §12.5. Forma: PART 17 §17.2.3 — fila compacta,
 * no tarjeta (D8: densidad por filas). Se reusa igual en el feed, en la página de
 * materia, en el perfil y en los resultados de búsqueda.
 *
 * VOTO EN LÍNEA (enmienda del 2026-08-14 a §0.5-R20, registrada en
 * docs/decisions.md). El score dejó de ser texto estático: ahora ES el control de
 * voto. Votar sin navegar es lo que convierte al feed en una superficie de uso
 * diario; §0.5-R20 lo prohibía para que la fila fuera 100% servidor, y ese costo
 * se paga ahora sólo donde hace falta:
 *
 *   - Sin sesión (`signedIn` en false, el default) la fila NO monta el componente
 *     de cliente: el control se dibuja como un link a `/ingresar` con las mismas
 *     clases (`vote-styles.ts`) y el score a la vista. Un botón muerto que abre un
 *     diálogo para decir "necesitás cuenta" cuesta JS y no dice nada que el link
 *     no diga antes de tocarlo. La home deslogueada —la superficie de rastreo de
 *     PART 23— sigue sin un byte de JS de ruta.
 *   - Con sesión, la fila monta `VoteButton` en su variante compacta. Ese chunk se
 *     descarga porque está en el payload, no por estar importado acá.
 *
 * El score se muestra SIEMPRE, también en cero: §12.5 lo ocultaba porque una pared
 * de "0 votos" se lee a fracaso, pero un control que desaparece en cero es un
 * control que no puede recibir el primer voto. El cero de comentarios sigue siendo
 * silencio, que ahí no hay nada que accionar.
 *
 * AUTO-VOTO. La fila no sabe quién es el autor —resolverlo por fila costaría una
 * consulta por fila— así que el control se ofrece igual y `toggle_post_vote`
 * rechaza el intento con `SELF_VOTE`; el toast lo dice con todas las letras. En la
 * página del post, donde la autoría ya se sabe (`isOwnPost`), el control sigue
 * llegando deshabilitado.
 *
 * LÍMITES DE IMPORT. Acá no se importa `features/bookmarks` ni ninguna otra
 * feature (BUILD-CONTRACT §2): lo que se quiera agregar a la línea de acciones
 * entra por la ranura `acciones`, y lo compone la página.
 *
 * Renderiza un `<li>` (viene de `ListRow`): usalo dentro de un `<ul>`.
 */
import { ArrowUp } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { Chip } from '@/components/ui/chip'
import { ListRow } from '@/components/ui/list-row'
import { formatDate, relativeTime } from '@/lib/utils/dates'
import { excerpt } from '@/lib/utils/text'
import type { PostListItem } from '../queries'
import { VoteButton } from './vote-button'
import { VOTE_ICON_SIZE, voteControlClasses } from './vote-styles'

/** Sin título, el cuerpo hace de renglón de título (PART 12 §12.5). */
const TITLE_FALLBACK_LENGTH = 120
/** Con título, el cuerpo se muestra recortado debajo. */
const PREVIEW_LENGTH = 160

/**
 * `feed_para_vos` devuelve el motivo como código (`seguis` | `te_interesa` |
 * `tu_carrera` | `descubrimiento`). La fila muestra prosa, así que si lo que llega
 * es uno de esos códigos se traduce acá; cualquier otra cadena pasa tal cual, que
 * es el caso normal cuando quien llama ya la humanizó. Es una red de seguridad
 * para que un código crudo no termine impreso en la pantalla, no la traducción
 * canónica: esa la decide quien arma el feed.
 */
const MOTIVO_COPY: Record<string, string> = {
  seguis: 'De una materia que seguís',
  te_interesa: 'Parecido a lo que seguís',
  tu_carrera: 'De tu carrera',
  descubrimiento: 'Para descubrir',
}

export function PostRow({
  post,
  signedIn = false,
  voted = false,
  motivo,
  acciones,
}: {
  post: PostListItem
  /**
   * Quién mira. Con sesión el score es un botón de voto; sin ella, un link a
   * `/ingresar`. El default es `false` porque una fila que no sabe quién la mira
   * no puede prometer que el voto va a entrar.
   */
  signedIn?: boolean
  /** Si el lector ya votó esta publicación. La página lo resuelve con `getViewerPostVotes`. */
  voted?: boolean
  /**
   * Por qué esta fila está en este feed ("De una materia que seguís"). Va al final
   * de la línea de meta, en el mismo gris de 13px que el resto: es contexto, no
   * una etiqueta, así que no lleva chip ni color propio.
   */
  motivo?: string
  /**
   * Ranura al final de la línea de acciones — ahí entra, por ejemplo, el botón de
   * guardar. Lo inyecta la página: esta fila no puede importar otra feature.
   */
  acciones?: ReactNode
}) {
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
  const razon = motivo === undefined ? undefined : (MOTIVO_COPY[motivo] ?? motivo)

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
          {razon ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{razon}</span>
            </>
          ) : null}
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
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {signedIn ? (
            <VoteButton
              target="publicacion"
              publicId={post.publicId}
              score={post.score}
              voted={voted}
              signedIn
              tamano="compacto"
            />
          ) : (
            <Link
              href={`/ingresar?next=${encodeURIComponent(href)}`}
              aria-label={`Ingresá para votar. ${plural(post.score, 'voto', 'votos')}`}
              className={voteControlClasses('compacto', false)}
            >
              <ArrowUp aria-hidden="true" size={VOTE_ICON_SIZE.compacto} strokeWidth={2} />
              <span aria-hidden="true">{post.score.toLocaleString('es-AR')}</span>
            </Link>
          )}
          {/* "Sin comentarios" no se muestra: la ausencia es silenciosa (§12.5). */}
          {post.commentsCount > 0 ? (
            <a href={href} className="hover:underline">
              {plural(post.commentsCount, 'comentario', 'comentarios')}
            </a>
          ) : null}
          {acciones}
        </span>
      }
    >
      {preview ? <p className="line-clamp-3">{preview}</p> : null}
    </ListRow>
  )
}

function plural(count: number, one: string, many: string): string {
  return `${count.toLocaleString('es-AR')} ${count === 1 ? one : many}`
}
