/**
 * features/search/components/search-results.tsx — la página de resultados (§17.4.6).
 *
 * Server Component puro: cero JS de ruta. Los grupos salen siempre en el mismo
 * orden — Materias, Carreras, Recursos, Publicaciones — porque la precedencia de
 * grupo ES el impulso por tipo (§13.4): para "constitucional", la página de la
 * materia y su estante de recursos le ganan a cualquier publicación suelta. Un
 * grupo sin resultados se colapsa en silencio; los grupos no se reordenan solos,
 * así que dos búsquedas iguales dan una página con la misma forma.
 *
 * Sin resaltado de términos (el `ts_headline` es una gentileza de P2, §17.4.6).
 */
import Link from 'next/link'
import type { ReactNode } from 'react'

import { ButtonLink } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { EmptyState } from '@/components/ui/empty-state'
import { ListRow } from '@/components/ui/list-row'
import { relativeTime } from '@/lib/utils/dates'
import { excerpt, truncate } from '@/lib/utils/text'
import {
  SEARCH_GROUP_LIMITS,
  SEARCH_MIN_LENGTH,
  type CatalogRef,
  type PostHit,
  type ResourceHit,
  type SearchResults as SearchResultsData,
} from '../queries'

/** Etiquetas de `resources.tipo` (CHECK de la migración 0007), en es-AR. */
const TIPO_RECURSO_LABEL: Record<string, string> = {
  resumen: 'Resumen',
  apunte: 'Apunte',
  parcial: 'Parcial',
  final: 'Final',
  guia: 'Guía',
  otro: 'Otro',
}

/** Largo del título cuando la publicación no tiene título propio (§12.5). */
const TITLE_FROM_BODY = 120
/** Largo de la vista previa del cuerpo, sólo cuando sí hay título (§12.5). */
const BODY_PREVIEW = 160

function moreHref(q: string, tipo: string): string {
  return `/buscar?q=${encodeURIComponent(q)}&tipo=${tipo}`
}

function Group({
  label,
  moreLabel,
  href,
  children,
}: {
  label: string
  moreLabel?: string
  href?: string
  children: ReactNode
}) {
  return (
    <section className="mt-6 first:mt-0">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-s font-semibold text-text-secondary">{label}</h2>
        {href && moreLabel ? (
          <Link
            href={href}
            className="text-s font-semibold text-accent hover:text-accent-hover hover:underline"
          >
            {moreLabel}
          </Link>
        ) : null}
      </div>
      <ul className="mt-2 border-t border-border">{children}</ul>
    </section>
  )
}

function CatalogRow({ item, href }: { item: CatalogRef; href: string }) {
  return <ListRow href={href} title={item.nombre} />
}

function PostRow({ post }: { post: PostHit }) {
  const body = post.body ?? ''
  const title = post.title ?? truncate(excerpt(body, TITLE_FROM_BODY), TITLE_FROM_BODY)
  const preview = post.title ? excerpt(body, BODY_PREVIEW) : ''
  const scope = post.materia ?? post.carrera
  const scopeHref = post.materia
    ? `/materias/${post.materia.slug}`
    : post.carrera
      ? `/carreras/${post.carrera.slug}`
      : undefined

  return (
    <ListRow
      href={`/p/${post.publicId}`}
      title={title || 'Publicación'}
      meta={
        post.kind === 'pregunta' || scope ? (
          <span className="flex flex-wrap items-center gap-2">
            {post.kind === 'pregunta' ? <Chip variant="neutral">Pregunta</Chip> : null}
            {scope && scopeHref ? <Chip href={scopeHref}>{scope.nombre}</Chip> : null}
          </span>
        ) : undefined
      }
      trailing={
        <span>
          {post.isAnonymous ? 'Anónimo' : (post.authorHandle ?? 'Anónimo')}
          {' · '}
          <time dateTime={post.createdAt}>{relativeTime(post.createdAt)}</time>
          {post.score > 0 ? ` · ${post.score} votos` : ''}
          {post.commentsCount > 0 ? ` · ${post.commentsCount} comentarios` : ''}
        </span>
      }
    >
      {preview || undefined}
    </ListRow>
  )
}

function ResourceRow({ resource }: { resource: ResourceHit }) {
  return (
    <ListRow
      href={`/recursos/${resource.publicId}`}
      title={resource.title}
      meta={
        <span className="flex flex-wrap items-center gap-2">
          <Chip variant="neutral">{TIPO_RECURSO_LABEL[resource.tipo] ?? 'Otro'}</Chip>
          {resource.materia ? (
            <Chip href={`/materias/${resource.materia.slug}`}>{resource.materia.nombre}</Chip>
          ) : null}
        </span>
      }
      trailing={
        <span>
          {resource.anio ? `${resource.anio} · ` : ''}
          {resource.downloadsCount} descargas
          {resource.score > 0 ? ` · ${resource.score} votos` : ''}
        </span>
      }
    />
  )
}

export function SearchResults({ results }: { results: SearchResultsData }) {
  const { q, tipo, materias, carreras, recursos, publicaciones, total } = results

  if (q.length < SEARCH_MIN_LENGTH) {
    return (
      <EmptyState
        title="Escribí qué estás buscando."
        description="Probá con el nombre de una materia, un parcial o un resumen."
        action={
          <ButtonLink variant="secondary" href="/materias">
            Ver todas las materias
          </ButtonLink>
        }
      />
    )
  }

  if (total === 0) {
    return (
      <EmptyState
        title={`Sin resultados para «${q}».`}
        description="Probá con menos palabras, sin abreviaturas, o revisá la ortografía."
        action={
          <div className="flex flex-wrap items-center gap-4">
            <ButtonLink variant="secondary" href="/materias">
              Ver todas las materias
            </ButtonLink>
            <Link
              href="/"
              className="text-m font-semibold text-accent hover:text-accent-hover hover:underline"
            >
              ¿No encontraste respuesta? Preguntale a la comunidad
            </Link>
          </div>
        }
      />
    )
  }

  const showMore = tipo === 'todo'

  return (
    <div>
      {materias.length > 0 ? (
        <Group
          label="Materias"
          moreLabel={
            showMore && materias.length >= SEARCH_GROUP_LIMITS.materias ? 'Ver más' : undefined
          }
          href={showMore ? moreHref(q, 'materias') : undefined}
        >
          {materias.map((item) => (
            <CatalogRow key={item.slug} item={item} href={`/materias/${item.slug}`} />
          ))}
        </Group>
      ) : null}

      {carreras.length > 0 ? (
        <Group label="Carreras">
          {carreras.map((item) => (
            <CatalogRow key={item.slug} item={item} href={`/carreras/${item.slug}`} />
          ))}
        </Group>
      ) : null}

      {recursos.length > 0 ? (
        <Group
          label="Recursos"
          moreLabel={
            showMore && recursos.length >= SEARCH_GROUP_LIMITS.recursos ? 'Ver más' : undefined
          }
          href={showMore ? moreHref(q, 'recursos') : undefined}
        >
          {recursos.map((item) => (
            <ResourceRow key={item.publicId} resource={item} />
          ))}
        </Group>
      ) : null}

      {publicaciones.length > 0 ? (
        <Group
          label="Publicaciones"
          moreLabel={
            showMore && publicaciones.length >= SEARCH_GROUP_LIMITS.publicaciones
              ? 'Ver más'
              : undefined
          }
          href={showMore ? moreHref(q, 'publicaciones') : undefined}
        >
          {publicaciones.map((item) => (
            <PostRow key={item.publicId} post={item} />
          ))}
        </Group>
      ) : null}
    </div>
  )
}
