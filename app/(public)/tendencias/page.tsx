/**
 * app/(public)/tendencias/page.tsx — la pestaña Tendencias (PART 12 §12.1, D7).
 *
 * Lo que se está moviendo AHORA: `feed_tendencias` ordena por velocidad —actividad por
 * unidad de tiempo sobre las últimas 48 h— y no por acumulado. Por eso la página no tiene
 * paginación y no es un olvido: son 25 filas y se termina. Una tendencia con scroll infinito
 * deja de ser una tendencia y se vuelve un ranking histórico, que es justo la mecánica de
 * vitrina que el producto no quiere (D2, D8). Se lee de un vistazo y se vuelve al feed.
 *
 * EL ENCABEZADO EXPLICA LA FÓRMULA, y eso es producto y no cortesía: el compromiso que
 * /acerca publica es que el orden se pueda explicar en una línea. Acá la línea está impresa
 * arriba de la lista, no escondida en una ayuda.
 *
 * CUÁNDO ES ADELANTO DEL PLAN: D2 mandaba "Tendencias" a fase 3. El fundador la adelantó
 * junto con "Para vos" porque la home pasó a ser una superficie de uso diario; el carácter no
 * cambia (filas densas, sin métricas de ranking a la vista, sin gamificación).
 *
 * RENDERIZADO (PART 20 §20.2). Es la misma consulta para todo el mundo —lo único personal es
 * el cromo— así que la ruta es cacheable: ISR 60 s, igual que `/reciente`. Vale el mismo
 * desajuste conocido que la home: leer la sesión para decidir si se montan las pestañas marca
 * la ruta como dinámica en Next 16 para todos, no solo para quien trae cookie. El
 * `revalidate` declara el TTL que §20.2 pide; el split real necesita PPR o una separación en
 * el proxy.
 *
 * Las pestañas solo se montan con sesión: "Para vos" y "Mis materias" no existen para quien
 * no tiene cuenta, y ofrecérselas sería un enlace a una pared de ingreso. Sin sesión la
 * página es la lista y el riel, y no lleva un byte de JavaScript de ruta.
 */
import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { Breadcrumb } from '@/components/ui/breadcrumb'
import { ButtonLink } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { getCarreraOptions } from '@/features/auth/queries'
import { FeedList } from '@/features/feed/components/feed-list'
import { FeedTabs } from '@/features/feed/components/feed-tabs'
import { getTendenciasFeed } from '@/features/feed/queries'
import { cn } from '@/lib/cn'
import { SITE_NAME } from '@/lib/config'
import { absoluteUrl } from '@/lib/env'
import { getUser } from '@/lib/supabase/server'

export const revalidate = 60

const TITLE = `Tendencias — Lo que se está moviendo | ${SITE_NAME}`
const DESCRIPTION =
  'Las publicaciones con más actividad de las últimas 48 horas en UCA Rosario: preguntas ' +
  'de cursada, apuntes y experiencias que se están comentando ahora.'

/**
 * La explicación del orden, palabra por palabra. Es copy de producto y no relleno: una lista
 * ordenada por una fórmula que nadie enuncia es una caja negra (D8).
 */
const EXPLICACION =
  'Lo que se está moviendo ahora en UCA Rosario. Se calcula por actividad de las últimas 48 horas.'

export async function generateMetadata(): Promise<Metadata> {
  const canonical = absoluteUrl('/tendencias')

  return {
    // `absolute` porque el layout raíz aplica la plantilla `%s · uca.net` y este título ya
    // nombra al producto: sin esto quedaría duplicado (PART 23 §23.2).
    title: { absolute: TITLE },
    description: DESCRIPTION,
    alternates: { canonical },
    openGraph: { type: 'website', url: canonical, title: TITLE, description: DESCRIPTION },
  }
}

export default async function TendenciasPage() {
  // Sin argumentos: `getTendenciasFeed` usa `PAGE_SIZE` (25) y esa es toda la lista.
  const [feed, user, carreras] = await Promise.all([
    getTendenciasFeed(),
    getUser(),
    getCarreraOptions(),
  ])

  return (
    <div className="flex w-full flex-col gap-8 py-6 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1 lg:max-w-170">
        <Breadcrumb items={[{ href: '/', label: 'Inicio' }, { label: 'Tendencias' }]} />
        <h1 className="mt-3 font-serif text-2xl font-semibold text-text-primary">Tendencias</h1>
        <p className="mt-2 text-m text-text-secondary">{EXPLICACION}</p>

        {user ? <FeedTabs activeHref="/tendencias" className="mt-6" /> : null}

        {/* -mt-px monta la hairline de la lista sobre la de las pestañas cuando están. */}
        <FeedList
          items={feed.items}
          className={user ? '-mt-px' : 'mt-6'}
          emptyState={
            <EmptyState
              title="No se movió nada en las últimas 48 horas."
              description="Cuando algo se empiece a comentar, aparece acá."
              action={
                <ButtonLink variant="secondary" href="/reciente">
                  Ver todo lo reciente
                </ButtonLink>
              }
            />
          }
        />
        {/* Sin `<Pagination>`: la lista no continúa. Ver el encabezado. */}
      </div>

      <Rail>
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
// Riel derecho (§17.1.1)
// ---------------------------------------------------------------------------
//
// Copia local de `app/_components/right-rail.tsx`, con la misma forma y las mismas clases,
// idéntica a la que ya llevan `/` y `/reciente`. No se importa aquel porque la regla
// `boundaries/element-types` de `eslint.config.mjs` clasifica como elemento `app` solo lo que
// está en la raíz de `app/` (verificado: `app/layout.tsx` puede, `app/(public)/**` no).
// Cuando la configuración clasifique las rutas anidadas, los tres bloques se borran juntos y
// se reemplazan por el import — la duplicación es temporal, deliberada y está registrada.
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
