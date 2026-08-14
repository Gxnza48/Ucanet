/**
 * app/(public)/page.tsx — la home (PART 17 §17.2 y §17.3).
 *
 * Una ruta, dos páginas distintas, decididas por la sesión:
 *
 *   Sin sesión (§17.3) → franja explicativa (copy exacto y protegido), después el feed
 *     Reciente REAL —contenido de verdad dentro del primer viewport, no una landing— y el
 *     directorio de carreras en el riel. Esos enlaces de carrera son el esqueleto de rastreo
 *     de PART 23 §23.7: cada visita de un bot a `/` alcanza todas las carreras, y desde
 *     ahí todas las materias. Esta mitad NO se tocó y no se toca: es la superficie de SEO.
 *   Con sesión (§17.2) → composer colapsado, las cuatro pestañas y el feed "Para vos", con
 *     el motivo por fila y scroll infinito. Nada más: sin banners, sin tips de onboarding,
 *     sin contadores de racha (D8).
 *
 * QUÉ CAMBIÓ Y POR QUÉ (enmienda del mapa de URLs, registrada en `docs/decisions.md`).
 * Hasta ahora `/` con sesión mostraba "Mis materias". Pasa a mostrar "Para vos"
 * (`feed_para_vos`), y "Mis materias" se mudó a `/mis-materias` con su consulta y sus
 * estados vacíos intactos. El fundador pidió una home de uso diario: "Mis materias" es un
 * recorte que puede estar tranquilo días enteros, y una home que suele estar vacía no se
 * visita. "Para vos" mezcla lo que seguís, lo que se parece a lo que leés, lo de tu carrera
 * y una cuota de descubrimiento, y CADA FILA VIAJA CON SU MOTIVO: es la diferencia entre un
 * feed auditable y una caja negra (§12.3). D2 mandaba esto a fase 3; se adelanta sin cambiar
 * el carácter del producto — filas densas, una sola tipografía, sin emoji en el cromo.
 *
 * PAGINACIÓN. La home logueada es la única superficie de lectura larga, así que es la única
 * con el scroll infinito de §17.5.2: `<FeedList>` recibe `loadMoreParaVos` y monta el
 * scroller, que auto-carga tres páginas y después pide un clic. Las otras tres pestañas
 * paginan con enlaces. El reloj de la sesión de scroll viaja adentro del cursor, así que las
 * páginas siguientes se puntúan contra el MISMO instante y no aparecen filas repetidas.
 *
 * LÍMITE CONOCIDO, escrito acá para que no se descubra en producción: las filas de esta
 * home todavía NO llevan voto en línea ni botón de guardar, aunque los dos controles existen
 * (`features/posts/components/post-row.tsx` con su ranura `acciones`, y
 * `features/bookmarks/components/bookmark-button.tsx`). Falta un dato, no una pieza: pintar
 * esos controles con el estado correcto exige saber qué votó y qué guardó el lector, y las
 * dos lecturas por lote —`getViewerPostVotes(ids)` y `getBookmarkedIds(ids)`— toman los
 * `bigint` internos, que `features/feed/queries.ts` descarta al armar su `PostListItem`.
 * Con `voted`/`guardado` en falso por defecto, un toque sobre algo ya votado lo DESVOTA
 * mostrando +1: peor que no ofrecer el control. La salida es una línea en la otra feature —
 * sumar `id` a su `PostListItem` (solo servidor, como ya hace `features/posts`)— y entonces
 * esta página cambia `<FeedList>` por su propio `<ul>` de `<PostRow signedIn voted acciones>`.
 *
 * RENDERIZADO (PART 20 §20.2). La tabla pide ISR 60 s para el visitante sin sesión y
 * render dinámico para el que tiene sesión. `export const revalidate = 60` declara ese TTL.
 * DESAJUSTE CONOCIDO: leer la sesión (`getProfile()` → `cookies()`) marca la ruta como
 * dinámica en Next 16 para todo el mundo, no solo para quien trae cookie. El split "estático
 * para anónimos, dinámico para logueados" necesita PPR (apagado en `next.config.ts`) o una
 * separación a nivel proxy. Hasta entonces el `revalidate` documenta la intención y el TTL
 * real lo aporta la CDN sobre las respuestas sin cookie. Es el [FREE-TIER RISK] que §20.2
 * marca; queda anotado, no resuelto acá.
 *
 * JavaScript de ruta: el composer y el scroller del feed, los dos en la lista blanca de
 * PART 19 §19.3. Las pestañas son enlaces (`FeedTabs`). La home SIN sesión sigue en cero.
 */
import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { ButtonLink } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Pagination } from '@/components/ui/pagination'
import { getCarreraOptions } from '@/features/auth/queries'
import { loadMoreParaVos } from '@/features/feed/actions'
import { FeedList } from '@/features/feed/components/feed-list'
import { FeedTabs } from '@/features/feed/components/feed-tabs'
import { getParaVosFeed, getRecentFeed } from '@/features/feed/queries'
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
  // El cursor de la URL no se le pasa a "Para vos": esa mitad pagina con el scroller, que
  // arrastra su propio cursor (con el reloj de la sesión adentro) sin tocar la dirección.
  return <LoggedInHome handle={profile.handle} />
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
// Con sesión (§17.2) — "Para vos"
// ---------------------------------------------------------------------------

async function LoggedInHome({ handle }: { handle: string }) {
  const [feed, actividad, seguidas, catalogo] = await Promise.all([
    getParaVosFeed(),
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
        <h1 className="sr-only">Para vos</h1>
        <div className="py-3">
          <Composer
            materias={catalogo.map((materia) => ({ slug: materia.slug, nombre: materia.nombre }))}
            handle={handle}
          />
        </div>

        <FeedTabs activeHref="/" />
        {/* -mt-px: la hairline superior de la lista se monta sobre la de las pestañas.
            `loadMore` + `nextCursor` son lo que monta el scroller al pie de la lista; sin
            página siguiente no se monta nada. */}
        <FeedList
          items={feed.items}
          className="-mt-px"
          loadMore={loadMoreParaVos}
          nextCursor={feed.nextCursor}
          emptyState={
            seguidas.length === 0 ? (
              <EmptyState
                title="Todavía no seguís ninguna materia."
                description="Seguí las que cursás y tu feed se arma solo."
                action={<ButtonLink href="/materias">Explorar materias</ButtonLink>}
              />
            ) : (
              <EmptyState
                title="Por ahora no tenemos nada nuevo para vos."
                description="Volvé en un rato, o mirá todo lo que se publicó en el sitio."
                action={
                  <ButtonLink variant="secondary" href="/reciente">
                    Ver todo lo reciente
                  </ButtonLink>
                }
              />
            )
          }
        />
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
