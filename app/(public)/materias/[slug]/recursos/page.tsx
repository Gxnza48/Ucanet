/**
 * app/(public)/materias/[slug]/recursos/page.tsx — la pestaña Recursos de una materia
 * (PART 17 §17.4.1).
 *
 * §17.4.1 dice que las pestañas son direccionables, así que "Recursos" es una RUTA, no un
 * estado de cliente: se comparte por WhatsApp, la indexa Google como landing propia de las
 * consultas "parcial <materia> uca" (§23.6) y el botón "atrás" hace lo que se espera. El
 * costo de esa decisión es que el encabezado de la materia está duplicado con la pestaña
 * hermana; el beneficio es cero JavaScript de ruta.
 *
 * Los filtros por tipo también son enlaces (`?tipo=parcial`): la estantería filtrada por
 * parciales es la página que se busca en época de finales, y merece URL propia.
 *
 * La lectura sale de `features/recursos` con `listResources({ materiaId })`, que ya ordena
 * como manda §14.7 dentro de una materia (votos → descargas → recencia) y ya pagina por
 * keyset. Así la fila que se pinta es exactamente `ResourceRow`, sin tipos intermedios.
 *
 * RENDERIZADO: ISR 300 s, igual que la pestaña de publicaciones (PART 20 §20.2), con la
 * misma salvedad sobre la lectura de sesión anotada en la página hermana.
 */
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'

import { Breadcrumb } from '@/components/ui/breadcrumb'
import { ButtonLink } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { EmptyState } from '@/components/ui/empty-state'
import { Pagination } from '@/components/ui/pagination'
import { Tabs } from '@/components/ui/tabs'
import { FollowButton } from '@/features/materias/components/follow-button'
import type { MateriaDetail } from '@/features/materias/queries'
import { getMateria, isFollowing } from '@/features/materias/queries'
import { ResourceRow } from '@/features/recursos/components/resource-row'
import { listResources } from '@/features/recursos/queries'
import {
  RESOURCE_TIPOS,
  TIPO_CHIP_LABELS,
  TIPO_PLURALS,
  isResourceTipo,
} from '@/features/recursos/schemas'
import { cn } from '@/lib/cn'
import { SITE_NAME } from '@/lib/config'
import { absoluteUrl } from '@/lib/env'
import { getProfile } from '@/lib/supabase/server'

export const revalidate = 300

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const materia = await getMateria(slug)

  if (!materia) {
    return { title: { absolute: `Materia no encontrada | ${SITE_NAME}` }, robots: { index: false } }
  }

  const title = `Recursos de ${materia.nombre} — Resúmenes, apuntes y parciales | ${SITE_NAME}`
  const description =
    `Resúmenes, apuntes, parciales y finales de ${materia.nombre} en UCA Rosario, ` +
    `subidos por estudiantes. ` +
    `${plural(materia.resourcesCount, 'recurso disponible', 'recursos disponibles')}.`
  const canonical = absoluteUrl(`/materias/${materia.slug}/recursos`)

  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    openGraph: { type: 'website', url: canonical, title, description },
  }
}

export default async function MateriaRecursosPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams])
  const cursor = typeof sp.cursor === 'string' ? sp.cursor : undefined
  // Un `tipo` inventado se ignora en vez de romper: la estantería completa es la degradación
  // correcta de un filtro que no existe.
  const tipo = typeof sp.tipo === 'string' && isResourceTipo(sp.tipo) ? sp.tipo : undefined

  const materia = await getMateria(slug)
  if (!materia) notFound()

  const [recursos, profile] = await Promise.all([
    listResources({ materiaId: materia.id, tipo, cursor }),
    getProfile(),
  ])
  const siguiendo = profile ? await isFollowing(materia.id) : false

  const subirHref = `/recursos/subir?materia=${materia.slug}`
  const baseHref = `/materias/${materia.slug}/recursos`
  const filtroHref = tipo ? `${baseHref}?tipo=${tipo}&` : `${baseHref}?`

  return (
    <div className="flex w-full flex-col gap-8 py-6 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1 lg:max-w-170">
        <Breadcrumb items={breadcrumbItems(materia)} />

        <MateriaHeader materia={materia} siguiendo={siguiendo} logueado={profile !== null} />

        <Tabs
          className="mt-6"
          activeHref={baseHref}
          items={[
            { href: `/materias/${materia.slug}`, label: 'Publicaciones' },
            { href: baseHref, label: 'Recursos' },
          ]}
        />

        <div className="flex flex-wrap items-center gap-4 py-3">
          <ButtonLink href={subirHref}>Subí un recurso</ButtonLink>
        </div>

        <nav aria-label="Filtrar por tipo" className="flex flex-wrap items-center gap-2 pb-3">
          <Chip variant={tipo === undefined ? 'accent' : 'neutral'} href={baseHref}>
            Todos
          </Chip>
          {RESOURCE_TIPOS.map((valor) => (
            <Chip
              key={valor}
              variant={tipo === valor ? 'accent' : 'neutral'}
              href={`${baseHref}?tipo=${valor}`}
            >
              {TIPO_CHIP_LABELS[valor]}
            </Chip>
          ))}
        </nav>

        <h2 className="sr-only">Recursos de {materia.nombre}</h2>
        {recursos.items.length === 0 ? (
          <EmptyState
            title={
              tipo
                ? `Todavía no hay ${TIPO_PLURALS[tipo]} de esta materia.`
                : 'Todavía no hay recursos de esta materia.'
            }
            description="Si tenés un resumen o un parcial viejo, subilo: le sirve a toda la camada."
            action={<ButtonLink href={subirHref}>Subí un recurso</ButtonLink>}
          />
        ) : (
          <ul className="border-t border-border">
            {recursos.items.map((recurso) => (
              <ResourceRow key={recurso.publicId} resource={recurso} />
            ))}
          </ul>
        )}

        <Pagination
          nextHref={
            recursos.nextCursor
              ? `${filtroHref}cursor=${encodeURIComponent(recursos.nextCursor)}`
              : undefined
          }
        />
      </div>

      <Rail>
        <MateriaFacts materia={materia} />

        <RailSection title="Cómo se sube">
          <li className="text-m text-text-secondary">
            PDF o imágenes, hasta 10 MB por archivo y 3 archivos por recurso. Subí lo que escribiste
            vos: nada de libros escaneados ni PDF de editoriales.
          </li>
        </RailSection>

        <RailSection title={SITE_NAME}>
          <RailLink href="/reglas">Reglas</RailLink>
          <RailLink href="/recursos">Todos los recursos</RailLink>
        </RailSection>
      </Rail>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Encabezado y datos — copia idéntica a la de la pestaña Publicaciones (ver nota allá)
// ---------------------------------------------------------------------------

function MateriaHeader({
  materia,
  siguiendo,
  logueado,
}: {
  materia: MateriaDetail
  siguiendo: boolean
  logueado: boolean
}) {
  return (
    <header className="mt-3">
      <h1 className="font-serif text-2xl font-semibold text-text-primary">{materia.nombre}</h1>

      {materia.carreras.length > 0 ? (
        <p className="mt-2 flex flex-wrap items-center gap-2 text-m text-text-secondary">
          {materia.carreras.map((carrera) => (
            <Chip key={`${carrera.slug}-${carrera.anio}`} href={`/carreras/${carrera.slug}`}>
              {carrera.nombre} ({planLabel(carrera.anio, carrera.cuatrimestre)})
            </Chip>
          ))}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-4">
        {logueado ? (
          <FollowButton materiaId={materia.id} nombre={materia.nombre} following={siguiendo} />
        ) : (
          <ButtonLink
            variant="secondary"
            href={`/ingresar?next=/materias/${materia.slug}/recursos`}
          >
            Seguir
          </ButtonLink>
        )}
        <span className="text-m text-text-secondary">
          {plural(materia.followersCount, 'seguidor', 'seguidores')}
        </span>
      </div>
    </header>
  )
}

function MateriaFacts({ materia }: { materia: MateriaDetail }) {
  const facultades = facultadesDe(materia)

  return (
    <section className="mt-6 first:mt-0">
      <h2 className="text-s font-semibold text-text-secondary">Datos</h2>
      <dl className="mt-2 flex flex-col gap-2 text-m">
        {facultades.length > 0 ? (
          <div>
            <dt className="text-text-secondary">
              {facultades.length === 1 ? 'Facultad' : 'Facultades'}
            </dt>
            <dd className="flex flex-col">
              {facultades.map((facultad) => (
                <Link
                  key={facultad.slug}
                  href={`/facultades/${facultad.slug}`}
                  className="truncate text-text-primary hover:text-accent"
                >
                  {facultad.nombre}
                </Link>
              ))}
            </dd>
          </div>
        ) : null}

        {materia.carreras.length > 0 ? (
          <div>
            <dt className="text-text-secondary">
              {materia.carreras.length === 1 ? 'Carrera' : 'Carreras'}
            </dt>
            <dd className="flex flex-col">
              {materia.carreras.map((carrera) => (
                <Link
                  key={`${carrera.slug}-${carrera.anio}`}
                  href={`/carreras/${carrera.slug}`}
                  className="truncate text-text-primary hover:text-accent"
                >
                  {carrera.nombre} · {planLabel(carrera.anio, carrera.cuatrimestre)}
                </Link>
              ))}
            </dd>
          </div>
        ) : null}

        <div>
          <dt className="text-text-secondary">Comunidad</dt>
          <dd className="text-text-primary">
            {plural(materia.followersCount, 'seguidor', 'seguidores')} ·{' '}
            {plural(materia.postsCount, 'publicación', 'publicaciones')} ·{' '}
            {plural(materia.resourcesCount, 'recurso', 'recursos')}
          </dd>
        </div>
      </dl>
    </section>
  )
}

function breadcrumbItems(materia: MateriaDetail): Array<{ href?: string; label: string }> {
  const items: Array<{ href?: string; label: string }> = [
    { href: '/', label: 'Inicio' },
    { href: '/materias', label: 'Materias' },
  ]

  const principal = materia.carreras[0]
  if (principal) {
    items.push({ href: `/carreras/${principal.slug}`, label: principal.nombre })
  }

  items.push({ href: `/materias/${materia.slug}`, label: materia.nombre })
  items.push({ label: 'Recursos' })
  return items
}

function facultadesDe(materia: MateriaDetail): Array<{ slug: string; nombre: string }> {
  const vistas = new Map<string, string>()
  for (const carrera of materia.carreras) {
    vistas.set(carrera.facultad.slug, carrera.facultad.nombre)
  }
  return [...vistas.entries()].map(([slug, nombre]) => ({ slug, nombre }))
}

function planLabel(anio: number, cuatrimestre: number): string {
  const cuatri =
    cuatrimestre === 0 ? 'anual' : cuatrimestre === 1 ? '1er cuatrimestre' : '2° cuatrimestre'
  return `${anio === 1 ? '1er' : anio === 3 ? '3er' : `${anio}°`} año, ${cuatri}`
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`
}

// ---------------------------------------------------------------------------
// Riel derecho (§17.1.1)
// ---------------------------------------------------------------------------
//
// Copia local de `app/_components/right-rail.tsx`, con la misma forma y las mismas clases.
// No se importa aquel porque la regla `boundaries/element-types` de `eslint.config.mjs` no
// habilita app → app y falla en CI para todo archivo que no esté en la raíz de `app/`
// (verificado: `app/layout.tsx` puede, `app/(public)/**` no). Cuando la configuración agregue
// la política app → app, este bloque se borra y se reemplaza por el import — la duplicación
// es temporal y deliberada, no un olvido.
//
// El bloque "Explorar" es permanente en todas las páginas (§0.5-R19): sin columna izquierda y
// con un header de cinco ranuras, es el camino de un clic hacia `/materias` y `/recursos` en
// escritorio, igual que la barra inferior en mobile.

function Rail({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <aside aria-label="Contexto" className={cn('w-full lg:w-75 lg:shrink-0', className)}>
      <RailSection title="Explorar">
        <RailLink href="/materias">Materias</RailLink>
        <RailLink href="/recursos">Recursos</RailLink>
      </RailSection>
      {children}
    </aside>
  )
}

function RailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6 first:mt-0">
      <h2 className="text-s font-semibold text-text-secondary">{title}</h2>
      <ul className="mt-2">{children}</ul>
    </section>
  )
}

function RailLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="flex min-h-11 items-center gap-3 rounded-input py-1 text-m text-text-primary hover:text-accent lg:min-h-8"
      >
        <span className="min-w-0 truncate">{children}</span>
      </Link>
    </li>
  )
}
