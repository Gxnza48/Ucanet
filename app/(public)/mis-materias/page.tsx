/**
 * app/(public)/mis-materias/page.tsx — la pestaña Mis materias (PART 12 §12.2, D7).
 *
 * ESTE FEED VIVÍA EN `/`. La home logueada pasó a ser "Para vos" (feed rankeado de todo el
 * sitio, con motivo por fila) y "Mis materias" —el recorte a lo que seguís— se mudó acá con
 * su URL propia. Es un movimiento del mapa de URLs, no un rediseño: misma consulta
 * (`getMisMateriasFeed`), mismos dos estados vacíos, misma paginación por cursor. La
 * enmienda del mapa está registrada en `docs/decisions.md` porque D7 es un contrato de diez
 * años, y `/` sigue existiendo: no se rompió ninguna dirección vieja.
 *
 * LA REGLA DE INCLUSIÓN, para no tener que abrir la consulta (§12.2): entra un post si está
 * etiquetado con una materia que seguís, O BIEN si no tiene materia y es de tu carrera. Es
 * una unión de conjuntos; quien no sigue nada y no tiene carrera ve la pestaña vacía, y ese
 * vacío es una superficie de onboarding, no un error (§12.6).
 *
 * GUARD. `requireProfile()` y no `getProfile()`: sin sesión esta página no tiene contenido
 * posible, así que redirige a `/ingresar?next=/mis-materias` en vez de mostrar una lista
 * vacía que se lee como "no hay nada publicado". Con la cuenta a medio crear
 * (`status = 'nuevo'`) manda a elegir seudónimo, que es el paso que falta para poder seguir
 * materias.
 *
 * RENDERIZADO (PART 20 §20.2). `force-dynamic`: el feed es por persona y no se cachea de
 * forma compartida NUNCA (§12.8). Su baratura viene del alcance —dos scans de índice sobre
 * una ventana de 400 filas—, no del caché.
 *
 * PAGINACIÓN. Enlaces con el cursor en la URL (`<Pagination>`), igual que antes de la
 * mudanza y que `/reciente`. `features/feed/actions.ts` ya expone `loadMoreMisMaterias` por
 * si esta pestaña pasa al scroll infinito de §17.5.2; hoy el scroll infinito está solo en
 * "Para vos", que es la superficie de lectura larga. Cambiarlo es pasarle `loadMore` y
 * `nextCursor` a `<FeedList>` y borrar el `<Pagination>`.
 */
import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { Breadcrumb } from '@/components/ui/breadcrumb'
import { ButtonLink } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Pagination } from '@/components/ui/pagination'
import { FeedList } from '@/features/feed/components/feed-list'
import { FeedTabs } from '@/features/feed/components/feed-tabs'
import { getMisMateriasFeed, getRecentFeed } from '@/features/feed/queries'
import { getFollowedMateriaIds, listMaterias } from '@/features/materias/queries'
import { cn } from '@/lib/cn'
import { SITE_NAME } from '@/lib/config'
import { requireProfile } from '@/lib/supabase/server'
import { excerpt } from '@/lib/utils/text'

export const dynamic = 'force-dynamic'

/** Cuántas publicaciones lleva el bloque "Actividad" del riel (§17.1.1). */
const RAIL_ACTIVITY_SIZE = 5

/** Largo del título prestado del cuerpo en los renglones del riel. */
const RAIL_TITLE_CHARS = 80

const TITLE = `Mis materias | ${SITE_NAME}`
const DESCRIPTION = 'Lo que se publica en las materias que seguís y en tu carrera.'

export async function generateMetadata(): Promise<Metadata> {
  return {
    // `absolute` porque el layout raíz aplica la plantilla `%s · uca.net` (PART 23 §23.2).
    title: { absolute: TITLE },
    description: DESCRIPTION,
    // Pantalla detrás de sesión: no hay nada que indexar y el contenido ya es alcanzable
    // por `/reciente` y por la página de cada materia (§23.1).
    robots: { index: false, follow: false },
  }
}

export default async function MisMateriasPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  // Redirige a /ingresar?next=/mis-materias sin sesión, y a /registro/continuar si la
  // cuenta todavía no eligió seudónimo.
  await requireProfile()

  const sp = await searchParams
  const cursor = typeof sp.cursor === 'string' ? sp.cursor : undefined

  const [feed, actividad, seguidas, catalogo] = await Promise.all([
    getMisMateriasFeed({ cursor }),
    getRecentFeed({ limit: RAIL_ACTIVITY_SIZE }),
    getFollowedMateriaIds(),
    listMaterias(),
  ])

  // Los ids internos se cruzan acá, del lado del servidor: al navegador viajan slug y
  // nombre (D14.7).
  const seguidasSet = new Set(seguidas)
  const misMaterias = catalogo.filter((materia) => seguidasSet.has(materia.id))

  return (
    <div className="flex w-full flex-col gap-8 py-6 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1 lg:max-w-170">
        <Breadcrumb items={[{ href: '/', label: 'Inicio' }, { label: 'Mis materias' }]} />
        <h1 className="mt-3 font-serif text-2xl font-semibold text-text-primary">Mis materias</h1>
        <p className="mt-2 text-m text-text-secondary">
          Las publicaciones de las materias que seguís, más lo de tu carrera que no está etiquetado
          en ninguna.
        </p>

        <FeedTabs activeHref="/mis-materias" className="mt-6" />

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
        <Pagination
          nextHref={
            feed.nextCursor
              ? `/mis-materias?cursor=${encodeURIComponent(feed.nextCursor)}`
              : undefined
          }
        />
      </div>

      {/* §17.6: el riel se descarta en mobile — las materias que seguís ya están a un toque
          desde la barra inferior y repetirlas abajo del feed es ruido. */}
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

// ---------------------------------------------------------------------------
// Riel derecho (§17.1.1)
// ---------------------------------------------------------------------------
//
// Copia local de `app/_components/right-rail.tsx`, con la misma forma y las mismas clases,
// idéntica a la que ya llevan `/` y `/reciente`. No se importa aquel porque la regla
// `boundaries/element-types` de `eslint.config.mjs` clasifica como elemento `app` solo lo que
// está en la raíz de `app/` (verificado: `app/layout.tsx` puede, `app/(public)/**` no).
// Cuando la configuración clasifique las rutas anidadas, los tres bloques se borran juntos y
// se reemplazan por el import — la duplicación es temporal, deliberada y está registrada.

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
