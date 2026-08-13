/**
 * app/_components/tombstone.tsx — la lápida de contenido eliminado (§0.5-R23c).
 *
 * POR QUÉ 410 Y NO 404: un 404 dice "acá nunca hubo nada" y le pide a Google que
 * vuelva a intentar. Un 410 dice "acá hubo algo y ya no está", que es la verdad, y
 * saca la URL del índice de una vez. En un producto cuyo valor es un archivo de
 * diez años con direcciones estables (D1, D7), mentir sobre por qué una dirección
 * dejó de responder es corroer justamente lo que se está construyendo.
 *
 * QUÉ NO LLEVA (PART 14 §14.x): cero contenido y cero autoría. Una lápida que
 * dijera "eliminado por su autor" sobre una publicación anónima no revela nada que
 * no se supiera; una que mostrara el texto borrado sería no haberlo borrado. El
 * motivo se muestra solo cuando el consumidor lo tiene y es público.
 *
 * CÓMO SE SIRVE EL 410: este componente es la vista, no el estado HTTP. Next 16 no
 * expone un `gone()` equivalente a `notFound()`, así que la ruta que renderiza esta
 * lápida es la que fija el código — y mientras no lo haga, la página responde 200
 * con el cuerpo correcto. Está anotado en el resumen de entrega como desajuste
 * abierto entre §0.5-R23c y lo que el framework permite hoy.
 */
import type { Metadata } from 'next'
import Link from 'next/link'

import { ButtonLink } from '@/components/ui/button'
import { cn } from '@/lib/cn'

export type TombstoneKind = 'publicacion' | 'comentario' | 'recurso'

/** Motivo, cuando el consumidor lo conoce. Las vistas `_public` no lo distinguen. */
export type TombstoneReason = 'autor' | 'moderacion'

type Copy = {
  /** Sustantivo con artículo, tal como abre el título. */
  titulo: string
  /** Pronombre de objeto concordado: "La eliminó…" / "Lo eliminó…". */
  pronombre: 'La' | 'Lo'
  /** Nombre para la metadata de la pestaña. */
  meta: string
}

const COPY: Record<TombstoneKind, Copy> = {
  publicacion: {
    titulo: 'Esta publicación ya no está disponible.',
    pronombre: 'La',
    meta: 'Publicación eliminada',
  },
  comentario: {
    titulo: 'Este comentario ya no está disponible.',
    pronombre: 'Lo',
    meta: 'Comentario eliminado',
  },
  recurso: {
    titulo: 'Este recurso ya no está disponible.',
    pronombre: 'Lo',
    meta: 'Recurso eliminado',
  },
}

/**
 * Metadata de una página lápida. `noindex` además del 410: mientras el buscador no
 * vuelva a pasar, la etiqueta le dice lo mismo por el otro canal.
 */
export function tombstoneMetadata(kind: TombstoneKind): Metadata {
  return {
    title: COPY[kind].meta,
    robots: { index: false, follow: false },
  }
}

export function Tombstone({
  kind,
  reason,
  className,
}: {
  kind: TombstoneKind
  reason?: TombstoneReason
  className?: string
}) {
  const copy = COPY[kind]
  // Concordancia de género: "La eliminó quien la publicó" / "Lo eliminó quien lo publicó".
  const pron = copy.pronombre
  const pronMinuscula = pron.toLowerCase()

  const motivo =
    reason === 'autor'
      ? `${pron} eliminó quien ${pronMinuscula} publicó.`
      : reason === 'moderacion'
        ? `${pron} retiró el equipo de moderación.`
        : `${pron} eliminó quien ${pronMinuscula} publicó, o ${pronMinuscula} retiró el equipo de moderación.`

  return (
    <div className={cn('w-full max-w-170 py-6', className)}>
      <h1 className="font-serif text-xl font-semibold text-text-primary">{copy.titulo}</h1>

      <p className="mt-3 text-base text-text-secondary">{motivo}</p>
      <p className="mt-3 text-base text-text-secondary">
        La dirección queda como está: en uca.net los enlaces no se reciclan, así que este link va a
        seguir diciendo lo mismo dentro de diez años.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <ButtonLink href="/" variant="secondary">
          Ir al inicio
        </ButtonLink>
        <Link href="/materias" className="text-m text-accent hover:underline">
          Ver materias
        </Link>
        {reason === 'moderacion' ? (
          <Link href="/apelacion" className="text-m text-accent hover:underline">
            Apelar la decisión
          </Link>
        ) : null}
      </div>
    </div>
  )
}
