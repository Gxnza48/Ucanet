/**
 * app/(public)/reciente/page.tsx — la pestaña Reciente (PART 12 §12.1, PART 17 §17.2).
 *
 * Todo el sitio en orden estrictamente cronológico. Es la misma consulta para todo el mundo
 * —lo único personal es el cromo— así que la ruta es cacheable: ISR 60 s (PART 20 §20.2).
 * Sesenta segundos de desfase son invisibles en una lista cronológica y ahorran el grueso de
 * las invocaciones que §21.2 presupuesta.
 *
 * Las pestañas solo se montan con sesión: "Mis materias" no existe para quien no tiene
 * cuenta, y ofrecérsela sería un enlace a una pared de ingreso. El visitante sin sesión ve la
 * lista y el riel, que es exactamente lo que §17.3 le da en `/`.
 *
 * Mismo desajuste conocido que la home: leer la sesión marca la ruta como dinámica en Next 16
 * para todos, no solo para quien trae cookie. El `revalidate` declara el TTL que §20.2 pide;
 * el split real necesita PPR o una separación en el proxy.
 *
 * SEO (PART 23 §23.1): indexable, canónica siempre a la página 1 — las páginas profundas se
 * descubren por sitemap, no por variantes canónicas del cursor.
 */
import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { Breadcrumb } from '@/components/ui/breadcrumb'
import { ButtonLink } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Pagination } from '@/components/ui/pagination'
import { getCarreraOptions } from '@/features/auth/queries'
import { FeedList } from '@/features/feed/components/feed-list'
import { FeedTabs } from '@/features/feed/components/feed-tabs'
import { getRecentFeed } from '@/features/feed/queries'
import { cn } from '@/lib/cn'
import { SITE_NAME } from '@/lib/config'
import { absoluteUrl } from '@/lib/env'
import { getUser } from '@/lib/supabase/server'

export const revalidate = 60

const TITLE = `Reciente — Lo último que se publicó | ${SITE_NAME}`
const DESCRIPTION =
  'Todo lo que se publica en UCA Rosario, en orden cronológico: preguntas de cursada, ' +
  'apuntes, parciales y experiencias de estudiantes.'

export async function generateMetadata(): Promise<Metadata> {
  const canonical = absoluteUrl('/reciente')

  return {
    title: { absolute: TITLE },
    description: DESCRIPTION,
    alternates: { canonical },
    openGraph: { type: 'website', url: canonical, title: TITLE, description: DESCRIPTION },
  }
}

export default async function RecientePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const sp = await searchParams
  const cursor = typeof sp.cursor === 'string' ? sp.cursor : undefined

  const [feed, user, carreras] = await Promise.all([
    getRecentFeed({ cursor }),
    getUser(),
    getCarreraOptions(),
  ])

  return (
    <div className="flex w-full flex-col gap-8 py-6 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1 lg:max-w-170">
        <Breadcrumb items={[{ href: '/', label: 'Inicio' }, { label: 'Reciente' }]} />
        <h1 className="mt-3 font-serif text-2xl font-semibold text-text-primary">Reciente</h1>
        <p className="mt-2 text-m text-text-secondary">
          Todo el sitio, de lo más nuevo a lo más viejo. Los comentarios no reordenan la lista.
        </p>

        {user ? <FeedTabs activeHref="/reciente" className="mt-6" /> : null}

        {/* -mt-px monta la hairline de la lista sobre la de las pestañas cuando están. */}
        <FeedList
          items={feed.items}
          className={user ? '-mt-px' : 'mt-6'}
          emptyState={
            <EmptyState
              title="Todavía no hay publicaciones."
              description="Empezá vos."
              action={
                user ? (
                  <ButtonLink href="/">Ir al feed</ButtonLink>
                ) : (
                  <ButtonLink href="/registro">Crear cuenta</ButtonLink>
                )
              }
            />
          }
        />
        <Pagination
          nextHref={
            feed.nextCursor ? `/reciente?cursor=${encodeURIComponent(feed.nextCursor)}` : undefined
          }
        />
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
