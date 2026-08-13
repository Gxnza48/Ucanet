/**
 * app/(public)/materias/[slug]/page.tsx — la página de materia, pestaña Publicaciones
 * (PART 17 §17.4.1).
 *
 * Es LA página del producto: el activo permanente (D1) y el caballo de batalla de SEO
 * (PART 23 §23.6 — "resumen <materia> uca"). Todo lo demás del sitio existe para llenarla
 * y para enlazarla.
 *
 * Estructura, de arriba abajo (§17.4.1):
 *   1. Migas facultad › carrera › materia (§23.4: el BreadcrumbList visible y el estructurado
 *      dicen lo mismo; el JSON-LD lo emite la capa de SEO, no esta página).
 *   2. Nombre como h1, línea de datos con las carreras que la incluyen (año y cuatrimestre),
 *      seguidores y el botón de seguir.
 *   3. Pestañas Publicaciones | Recursos — son ENLACES con URL propia (§17.4.1: son
 *      direccionables), no un widget de JavaScript. La de recursos es
 *      `/materias/[slug]/recursos`.
 *   4. Composer precargado con esta materia y el feed de la materia.
 *
 * RENDERIZADO: ISR 300 s + invalidación por etiqueta `materia:<slug>` cuando se publica algo
 * acá (PART 20 §20.2/§20.3). El TTL corto es para el rastreador y el visitante sin sesión; la
 * etiqueta es la que mantiene la página correcta después de una escritura.
 * Mismo desajuste que la home: leer la sesión —imprescindible para el estado de seguimiento y
 * para el composer— marca la ruta como dinámica para todos en Next 16 sin PPR.
 *
 * `notFound()` cuando el slug no existe: una materia no se elimina nunca (§8.3.1), así que
 * acá no hay lápida 410 que rendir — o el slug está en el catálogo o nunca estuvo.
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
import { FeedList } from '@/features/feed/components/feed-list'
import { FollowButton } from '@/features/materias/components/follow-button'
import type { MateriaDetail } from '@/features/materias/queries'
import { getMateria, getMateriaPosts, isFollowing } from '@/features/materias/queries'
import { Composer } from '@/features/posts/components/composer'
import { listResources } from '@/features/recursos/queries'
import { cn } from '@/lib/cn'
import { SITE_NAME } from '@/lib/config'
import { absoluteUrl } from '@/lib/env'
import { getProfile } from '@/lib/supabase/server'

export const revalidate = 300

/** Cuántos recursos muestra el riel (§17.4.1: tres recursos recientes). */
const RAIL_RESOURCES = 3

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

  const title = `${materia.nombre} — Resúmenes, parciales y discusión | ${SITE_NAME}`
  const description = materiaDescription(materia)
  const canonical = absoluteUrl(`/materias/${materia.slug}`)

  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    openGraph: { type: 'website', url: canonical, title, description },
  }
}

export default async function MateriaPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams])
  const cursor = typeof sp.cursor === 'string' ? sp.cursor : undefined

  const materia = await getMateria(slug)
  if (!materia) notFound()

  const [posts, recursos, profile] = await Promise.all([
    getMateriaPosts(materia.id, { cursor }),
    listResources({ materiaId: materia.id, limit: RAIL_RESOURCES }),
    getProfile(),
  ])
  const siguiendo = profile ? await isFollowing(materia.id) : false

  return (
    <div className="flex w-full flex-col gap-8 py-6 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1 lg:max-w-170">
        <Breadcrumb items={breadcrumbItems(materia)} />

        <MateriaHeader materia={materia} siguiendo={siguiendo} logueado={profile !== null} />

        <Tabs
          className="mt-6"
          activeHref={`/materias/${materia.slug}`}
          items={[
            { href: `/materias/${materia.slug}`, label: 'Publicaciones' },
            { href: `/materias/${materia.slug}/recursos`, label: 'Recursos' },
          ]}
        />

        {profile ? (
          <div className="border-b border-border py-3">
            {/*
              El composer recibe SOLO esta materia: la página ya fija el contexto y traerse
              el catálogo entero por si alguien saca el chip serían 110 filas para un caso de
              borde. Si lo saca, la publicación queda sin etiquetar, que es exactamente lo
              que la persona pidió al sacarlo.
            */}
            <Composer
              materias={[{ slug: materia.slug, nombre: materia.nombre }]}
              defaultMateriaSlug={materia.slug}
              handle={profile.handle}
              placeholder="Preguntale algo a los que ya la cursaron"
            />
          </div>
        ) : null}

        <h2 className="sr-only">Publicaciones de {materia.nombre}</h2>
        {/* showScope={false}: el chip de esta materia sobra cuando ya estás en su página. */}
        <FeedList
          items={posts.items}
          showScope={false}
          className="-mt-px"
          emptyState={
            <EmptyState
              title="Nadie publicó en esta materia todavía."
              description="Sé la primera persona."
              action={
                profile ? undefined : (
                  <ButtonLink href={`/ingresar?next=/materias/${materia.slug}`}>
                    Ingresá para publicar
                  </ButtonLink>
                )
              }
            />
          }
        />
        <Pagination
          nextHref={
            posts.nextCursor
              ? `/materias/${materia.slug}?cursor=${encodeURIComponent(posts.nextCursor)}`
              : undefined
          }
        />
      </div>

      <Rail>
        <MateriaFacts materia={materia} />

        <RailSection title="Recursos recientes">
          {recursos.items.length === 0 ? (
            <li className="text-m text-text-secondary">
              Todavía no hay recursos de esta materia.{' '}
              <Link
                href={`/recursos/subir?materia=${materia.slug}`}
                className="text-accent hover:underline"
              >
                Subí el primero
              </Link>
              .
            </li>
          ) : (
            recursos.items.map((recurso) => (
              <RailLink key={recurso.publicId} href={`/recursos/${recurso.publicId}`}>
                {recurso.title}
              </RailLink>
            ))
          )}
        </RailSection>

        <RailSection title={SITE_NAME}>
          <RailLink href="/reglas">Reglas</RailLink>
          <RailLink href="/materias">Todas las materias</RailLink>
        </RailSection>
      </Rail>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Bloques de la materia — duplicados a propósito en la pestaña de recursos
// ---------------------------------------------------------------------------
//
// El encabezado y el bloque de datos viven en las dos rutas de la materia. No se factorizan
// a un componente compartido porque `components/ui` no puede conocer features y una feature
// no puede importar otra: el hogar correcto es `features/materias/components/`, y ese archivo
// lo escribe quien es dueño de esa feature. Mientras tanto, las dos copias son idénticas y
// cambian juntas.

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

      {materia.descripcion ? (
        <p className="mt-3 text-base text-text-secondary">{materia.descripcion}</p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-4">
        {logueado ? (
          <FollowButton materiaId={materia.id} nombre={materia.nombre} following={siguiendo} />
        ) : (
          <ButtonLink variant="secondary" href={`/ingresar?next=/materias/${materia.slug}`}>
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

/**
 * Bloque de datos del riel (§17.4.1: facultad, carreras, seguidores).
 *
 * Va con la misma cromía que `RailSection` pero con un `<dl>` adentro en vez de un `<ul>`:
 * son pares dato/valor, no una lista de enlaces, y meter un `<dl>` dentro de un `<ul>` sería
 * markup inválido.
 */
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

// ---------------------------------------------------------------------------
// Helpers de presentación
// ---------------------------------------------------------------------------

/** Migas: facultad › carrera de la PRIMERA carrera del plan, que es la principal. */
function breadcrumbItems(materia: MateriaDetail): Array<{ href?: string; label: string }> {
  const items: Array<{ href?: string; label: string }> = [
    { href: '/', label: 'Inicio' },
    { href: '/materias', label: 'Materias' },
  ]

  const principal = materia.carreras[0]
  if (principal) {
    items.push({ href: `/facultades/${principal.facultad.slug}`, label: principal.facultad.nombre })
    items.push({ href: `/carreras/${principal.slug}`, label: principal.nombre })
  }

  items.push({ label: materia.nombre })
  return items
}

/** Facultades distintas que dictan la materia, deduplicadas por slug. */
function facultadesDe(materia: MateriaDetail): Array<{ slug: string; nombre: string }> {
  const vistas = new Map<string, string>()
  for (const carrera of materia.carreras) {
    vistas.set(carrera.facultad.slug, carrera.facultad.nombre)
  }
  return [...vistas.entries()].map(([slug, nombre]) => ({ slug, nombre }))
}

/**
 * Descripción de PART 23 §23.2: plantilla determinista con los contadores vivos.
 * Los números son una función de CTR ("34 recursos" le gana a la prosa) y se leen del
 * render cacheado, nunca de una consulta por visita de bot.
 */
function materiaDescription(materia: MateriaDetail): string {
  return (
    `Resúmenes, apuntes, parciales y publicaciones de ${materia.nombre} en UCA Rosario. ` +
    `${plural(materia.resourcesCount, 'recurso', 'recursos')}, ` +
    `${plural(materia.postsCount, 'publicación', 'publicaciones')} de estudiantes.`
  )
}

/** "2° año, 1er cuatrimestre" — el formato exacto de la línea de datos de §17.4.1. */
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
