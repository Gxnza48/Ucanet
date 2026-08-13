/**
 * app/(public)/page.tsx — la home (PART 17 §17.2 y §17.3).
 *
 * Una ruta, dos páginas distintas, decididas por la sesión:
 *
 *   Sin sesión (§17.3) → franja explicativa (copy exacto y protegido), después el feed
 *     Reciente REAL —contenido de verdad dentro del primer viewport, no una landing— y el
 *     directorio de carreras en el riel. Esos enlaces de carrera son el esqueleto de rastreo
 *     de PART 23 §23.7: cada visita de un bot a `/` alcanza todas las carreras, y desde
 *     ahí todas las materias.
 *   Con sesión (§17.2) → composer colapsado, las dos pestañas y el feed Mis materias.
 *     Nada más: sin banners, sin tips de onboarding, sin módulo de tendencias (D2).
 *
 * RENDERIZADO (PART 20 §20.2). La tabla pide ISR 60 s para el visitante sin sesión y
 * render dinámico para el que tiene sesión. `export const revalidate = 60` declara ese TTL.
 * DESAJUSTE CONOCIDO, escrito acá para que no se descubra en producción: leer la sesión
 * (`getProfile()` → `cookies()`) marca la ruta como dinámica en Next 16 para todo el mundo,
 * no solo para quien trae cookie. El split "estático para anónimos, dinámico para logueados"
 * necesita PPR (apagado en `next.config.ts`) o una separación a nivel proxy. Hasta entonces
 * el `revalidate` documenta la intención y el TTL real lo aporta la CDN sobre las respuestas
 * sin cookie. Es el [FREE-TIER RISK] que §20.2 marca; queda anotado, no resuelto acá.
 *
 * Cero JavaScript de ruta salvo el composer, que está en la lista blanca de PART 19 §19.3.
 * Las pestañas son enlaces (`FeedTabs`) y las filas del feed no llevan control de voto (R20).
 */
import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { ButtonLink } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Pagination } from '@/components/ui/pagination'
import { getCarreraOptions } from '@/features/auth/queries'
import { FeedList } from '@/features/feed/components/feed-list'
import { FeedTabs } from '@/features/feed/components/feed-tabs'
import { getMisMateriasFeed, getRecentFeed } from '@/features/feed/queries'
import { getFollowedMateriaIds, listMaterias } from '@/features/materias/queries'
import { Composer } from '@/features/posts/components/composer'
import { cn } from '@/lib/cn'
import { SITE_DESCRIPTION, SITE_NAME } from '@/lib/config'
import { absoluteUrl } from '@/lib/env'
import { getProfile } from '@/lib/supabase/server'
import { excerpt } from '@/lib/utils/text'

export const revalidate = 60

/** Cuántas publicaciones lleva el bloque "Actividad" del riel (§17.1.1). */
const RAIL_ACTIVITY_SIZE = 5

/** Largo del título prestado del cuerpo en los renglones del riel. */
const RAIL_TITLE_CHARS = 80

export async function generateMetadata(): Promise<Metadata> {
  const canonical = absoluteUrl('/')
  const title = `${SITE_NAME} — La comunidad estudiantil de UCA Rosario`

  return {
    // `absolute` porque el layout raíz aplica la plantilla `%s · uca.net`, y este
    // título ya nombra al producto: sin esto quedaría duplicado (PART 23 §23.2).
    title: { absolute: title },
    description: SITE_DESCRIPTION,
    alternates: { canonical },
    openGraph: { type: 'website', url: canonical, title, description: SITE_DESCRIPTION },
  }
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const [sp, profile] = await Promise.all([searchParams, getProfile()])
  const cursor = typeof sp.cursor === 'string' ? sp.cursor : undefined

  if (!profile) return <LoggedOutHome cursor={cursor} />
  return <LoggedInHome cursor={cursor} handle={profile.handle} />
}

// ---------------------------------------------------------------------------
// Sin sesión (§17.3)
// ---------------------------------------------------------------------------

async function LoggedOutHome({ cursor }: { cursor?: string }) {
  const [feed, carreras] = await Promise.all([getRecentFeed({ cursor }), getCarreraOptions()])

  return (
    <div className="flex w-full flex-col gap-8 py-6 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1 lg:max-w-170">
        {/* Franja, no hero (§17.3.1): dos líneas, dos acciones, hairline abajo. */}
        <section className="border-b border-border py-6">
          <h1 className="text-xl font-semibold text-text-primary">
            La comunidad estudiantil de la UCA Rosario.
          </h1>
          <p className="mt-2 text-base text-text-secondary">
            Publicaciones anónimas, apuntes y parciales viejos, materia por materia.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <ButtonLink href="/registro">Crear cuenta</ButtonLink>
            <Link
              href="/ingresar"
              className="text-m font-semibold text-accent transition-colors duration-150 ease-out hover:text-accent-hover hover:underline"
            >
              Ya tengo cuenta
            </Link>
          </div>
        </section>

        <h2 className="sr-only">Publicaciones recientes</h2>
        {/* -mt-px monta la hairline superior de la lista sobre la de la franja: una sola línea. */}
        <FeedList
          items={feed.items}
          className="-mt-px"
          emptyState={
            <EmptyState
              title="Todavía no hay publicaciones."
              description="Empezá vos."
              action={<ButtonLink href="/registro">Crear cuenta</ButtonLink>}
            />
          }
        />
        <Pagination nextHref={nextHref('/', feed.nextCursor)} />
      </div>

      {/* En mobile el riel baja debajo del feed y se queda: el directorio de carreras
          es el camino de descubrimiento del visitante sin cuenta (§17.3.3). */}
      <Rail>
        <RailSection title="Qué es esto">
          <li className="text-m text-text-secondary">
            Cada materia y cada carrera tienen su página pública. Lo que se publica queda: la camada
            que viene lo encuentra.
          </li>
        </RailSection>
        <RailSection title="Carreras">
          {carreras.length === 0 ? (
            <li className="text-m text-text-secondary">El catálogo todavía no está cargado.</li>
          ) : (
            carreras.map((carrera) => (
              <RailLink key={carrera.slug} href={`/carreras/${carrera.slug}`}>
                {carrera.nombre}
              </RailLink>
            ))
          )}
        </RailSection>
        <RailSection title={SITE_NAME}>
          <RailLink href="/reglas">Reglas</RailLink>
          <RailLink href="/acerca">Acerca de</RailLink>
        </RailSection>
      </Rail>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Con sesión (§17.2)
// ---------------------------------------------------------------------------

async function LoggedInHome({ cursor, handle }: { cursor?: string; handle: string }) {
  const [feed, actividad, seguidas, catalogo] = await Promise.all([
    getMisMateriasFeed({ cursor }),
    getRecentFeed({ limit: RAIL_ACTIVITY_SIZE }),
    getFollowedMateriaIds(),
    listMaterias(),
  ])

  // Una sola lectura del catálogo sirve a dos consumidores: el `<datalist>` del composer y
  // el bloque "Mis materias" del riel. Los ids internos se cruzan acá, del lado del servidor:
  // al navegador viajan slug y nombre (D14.7).
  const seguidasSet = new Set(seguidas)
  const misMaterias = catalogo.filter((materia) => seguidasSet.has(materia.id))

  return (
    <div className="flex w-full flex-col gap-8 py-6 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1 lg:max-w-170">
        <h1 className="sr-only">Mis materias</h1>
        <div className="py-3">
          <Composer
            materias={catalogo.map((materia) => ({ slug: materia.slug, nombre: materia.nombre }))}
            handle={handle}
          />
        </div>

        <FeedTabs activeHref="/" />
        {/* -mt-px: la hairline superior de la lista se monta sobre la de las pestañas. */}
        <FeedList
          items={feed.items}
          className="-mt-px"
          emptyState={
            seguidas.length === 0 ? (
              <EmptyState
                title="Todavía no seguís ninguna materia."
                description="Buscá las tuyas y seguilas para armar tu feed."
                action={<ButtonLink href="/materias">Explorar materias</ButtonLink>}
              />
            ) : (
              <EmptyState
                title="Tus materias están tranquilas por ahora."
                description="Rompé el hielo: preguntá algo o compartí un apunte."
                action={
                  <ButtonLink variant="secondary" href="/reciente">
                    Ver todo lo reciente
                  </ButtonLink>
                }
              />
            )
          }
        />
        <Pagination nextHref={nextHref('/', feed.nextCursor)} />
      </div>

      {/* §17.6: en la home logueada el riel se descarta en mobile — "Mis materias" ya está
          a un toque desde la barra inferior y repetirlo abajo del feed es ruido. */}
      <Rail className="hidden lg:block">
        <RailSection title="Mis materias">
          {misMaterias.length === 0 ? (
            <li className="text-m text-text-secondary">
              Todavía no seguís ninguna.{' '}
              <Link href="/materias" className="text-accent hover:underline">
                Explorá el catálogo
              </Link>
              .
            </li>
          ) : (
            misMaterias.map((materia) => (
              <RailLink key={materia.slug} href={`/materias/${materia.slug}`}>
                {materia.nombre}
              </RailLink>
            ))
          )}
        </RailSection>
        <RailSection title="Actividad">
          {actividad.items.length === 0 ? (
            <li className="text-m text-text-secondary">Sin movimiento por ahora.</li>
          ) : (
            actividad.items.map((post) => (
              <RailLink key={post.publicId} href={`/p/${post.publicId}`}>
                {post.title ?? excerpt(post.body, RAIL_TITLE_CHARS)}
              </RailLink>
            ))
          )}
        </RailSection>
        <RailSection title={SITE_NAME}>
          <RailLink href="/reglas">Reglas</RailLink>
          <RailLink href="/acerca">Acerca de</RailLink>
        </RailSection>
      </Rail>
    </div>
  )
}

/** El cursor keyset viaja en el query string; sin próxima página no hay enlace. */
function nextHref(base: string, cursor: string | null): string | undefined {
  if (!cursor) return undefined
  return `${base}?cursor=${encodeURIComponent(cursor)}`
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
