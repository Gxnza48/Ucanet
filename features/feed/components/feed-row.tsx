/**
 * features/feed/components/feed-row.tsx — la fila del feed (PART 12 §12.5).
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
 * | Motivo         | Solo en "Para vos": por qué esta fila está acá (§12.3)                 |
 * | Votos          | "12 votos"; se oculta en cero (una pared de "0 votos" se lee a fracaso)|
 * | Comentarios    | "8 comentarios"; el cero es silencio, no se escribe "Sin comentarios"  |
 *
 * Toda la fila es UN destino de link a `/p/[publicId]`; el chip de materia es el único link
 * anidado. No hay miniaturas ni botones de voto en el feed (§12.5, §17.5.1: se vota en la
 * página del post) — así la fila es estática, barata de renderizar y sin estado.
 *
 * ARCHIVO PROPIO, separado de `feed-list.tsx`, por una razón de frontera y no de gusto: el
 * scroll infinito (`feed-infinite.tsx`, `'use client'`) renderiza filas nuevas en el
 * navegador y necesita ESTE componente. Si viviera en `feed-list.tsx` —que importa el
 * scroller— los dos módulos se importarían en círculo. Acá el grafo es una línea recta:
 * `feed-list` → `feed-row`, `feed-list` → `feed-infinite` → `feed-row`.
 *
 * El módulo es NEUTRO: no lleva `'use client'` y no importa nada de `server-only`. El import
 * de `PostListItem` es `import type`, que TypeScript borra en la compilación, así que arrastrar
 * este archivo al bundle del cliente no arrastra `queries.ts` con él. El rótulo del motivo sí
 * es un valor en tiempo de ejecución y por eso sale de `../motivos`, que es puro a propósito.
 */
import { Chip } from '@/components/ui/chip'
import { ListRow } from '@/components/ui/list-row'
import { formatDate, relativeTime } from '@/lib/utils/dates'
import { excerpt } from '@/lib/utils/text'

import { MOTIVO_LABEL } from '../motivos'
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
          {/* La línea de meta se lee "quién · dónde · cuándo · por qué está acá". El motivo
              va último porque es el dato menos urgente de los cuatro, y va SIEMPRE que
              venga: es texto plano en la fila, no un tooltip ni un ícono (§12.3). Sin chip
              —un tercer chip competiría con el de materia— y en color secundario. */}
          {post.motivo ? (
            <>
              <Separator />
              <span>{MOTIVO_LABEL[post.motivo]}</span>
            </>
          ) : null}
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
