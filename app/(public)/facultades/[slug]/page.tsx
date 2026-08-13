/**
 * app/(public)/facultades/[slug]/page.tsx — la página de facultad (D7, PART 23 §23.7).
 *
 * Es el nodo más alto del mesh de enlaces: facultad → carreras → materias. No compite por
 * ninguna consulta caliente (la universidad es dueña de "Facultad de Derecho UCA") y no
 * pretende hacerlo: existe para que ningún rastreador —ni ningún estudiante que llegó por
 * una materia y quiere subir un nivel— se quede sin camino hacia arriba.
 *
 * Las carreras se agrupan por nivel (grado / pregrado / posgrado) porque es la distinción
 * que el estudiante usa para saber si la lista lo incluye, y porque `carreras.nivel` ya la
 * modela con un CHECK cerrado (§8.2.2).
 *
 * RENDERIZADO: ISR 3600 s (PART 20 §20.2). Como la de carrera, no lee la sesión: es catálogo
 * puro y se mantiene realmente estática para todo el mundo.
 */
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'

import { Breadcrumb } from '@/components/ui/breadcrumb'
import { ButtonLink } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import type { FacultadDetail } from '@/features/materias/queries'
import { getFacultad } from '@/features/materias/queries'
import { cn } from '@/lib/cn'
import { SITE_NAME } from '@/lib/config'
import { absoluteUrl } from '@/lib/env'

export const revalidate = 3600

/** Orden de presentación de los niveles; el CHECK de `carreras.nivel` los fija (§8.2.2). */
const NIVELES = [
  { valor: 'grado', titulo: 'Carreras de grado' },
  { valor: 'pregrado', titulo: 'Carreras de pregrado' },
  { valor: 'posgrado', titulo: 'Posgrados' },
] as const

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const facultad = await getFacultad(slug)

  if (!facultad) {
    return {
      title: { absolute: `Facultad no encontrada | ${SITE_NAME}` },
      robots: { index: false },
    }
  }

  const title = `${facultad.nombre} — Carreras y actividad | ${SITE_NAME}`
  const description =
    `Las carreras de ${facultad.nombre} en UCA Rosario y sus materias, con apuntes, ` +
    `parciales y publicaciones de estudiantes. ` +
    `${plural(facultad.carreras.length, 'carrera', 'carreras')}.`
  const canonical = absoluteUrl(`/facultades/${facultad.slug}`)

  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    openGraph: { type: 'website', url: canonical, title, description },
  }
}

export default async function FacultadPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const facultad = await getFacultad(slug)
  if (!facultad) notFound()

  const grupos = agruparPorNivel(facultad)

  return (
    <div className="flex w-full flex-col gap-8 py-6 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1 lg:max-w-170">
        <Breadcrumb items={[{ href: '/', label: 'Inicio' }, { label: facultad.nombre }]} />

        <header className="mt-3">
          <h1 className="font-serif text-2xl font-semibold text-text-primary">{facultad.nombre}</h1>
          <p className="mt-2 text-m text-text-secondary">
            {facultad.sede ? <>{facultad.sede.nombre} · </> : null}
            {plural(facultad.carreras.length, 'carrera', 'carreras')}
          </p>
        </header>

        {facultad.carreras.length === 0 ? (
          <EmptyState
            className="mt-6"
            title="Todavía no cargamos las carreras de esta facultad."
            description="El catálogo se completa por migración antes de abrir el sitio."
            action={
              <ButtonLink variant="secondary" href="/materias">
                Ver todas las materias
              </ButtonLink>
            }
          />
        ) : (
          <div className="mt-6 flex flex-col gap-6">
            {grupos.map((grupo) => (
              <section key={grupo.valor}>
                <h2 className="font-serif text-xl font-semibold text-text-primary">
                  {grupo.titulo}
                </h2>
                <ul className="mt-3 border-t border-border">
                  {grupo.carreras.map((carrera) => (
                    <li key={carrera.slug} className="border-b border-border">
                      <Link
                        href={`/carreras/${carrera.slug}`}
                        className="flex flex-wrap items-baseline justify-between gap-x-4 py-3 transition-colors duration-150 ease-out hover:text-accent"
                      >
                        <span className="text-base font-semibold text-text-primary">
                          {carrera.nombre}
                        </span>
                        <span className="text-s text-text-secondary">
                          {plural(carrera.materiasCount, 'materia', 'materias')}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      <Rail>
        <section className="mt-6 first:mt-0">
          <h2 className="text-s font-semibold text-text-secondary">Datos</h2>
          <dl className="mt-2 flex flex-col gap-2 text-m">
            {facultad.sede ? (
              <div>
                <dt className="text-text-secondary">Sede</dt>
                <dd className="text-text-primary">
                  {facultad.sede.nombre} · {facultad.sede.ciudad}
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="text-text-secondary">Carreras</dt>
              <dd className="text-text-primary">{facultad.carreras.length}</dd>
            </div>
          </dl>
        </section>

        <RailSection title="Carreras">
          {facultad.carreras.length === 0 ? (
            <li className="text-m text-text-secondary">El catálogo todavía no está cargado.</li>
          ) : (
            facultad.carreras.map((carrera) => (
              <RailLink key={carrera.slug} href={`/carreras/${carrera.slug}`}>
                {carrera.nombre}
              </RailLink>
            ))
          )}
        </RailSection>

        <RailSection title={SITE_NAME}>
          <RailLink href="/reciente">Reciente</RailLink>
          <RailLink href="/reglas">Reglas</RailLink>
          <RailLink href="/acerca">Acerca de</RailLink>
        </RailSection>
      </Rail>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Agrupación por nivel
// ---------------------------------------------------------------------------

type CarreraDeFacultad = FacultadDetail['carreras'][number]
type NivelGroup = { valor: string; titulo: string; carreras: CarreraDeFacultad[] }

/**
 * Agrupa por nivel en el orden de `NIVELES` y deja al final cualquier nivel que aparezca en
 * los datos sin estar en esa lista: si una migración amplía el CHECK, la carrera sigue
 * apareciendo en vez de desaparecer en silencio de la página de su facultad.
 */
function agruparPorNivel(facultad: FacultadDetail): NivelGroup[] {
  const grupos: NivelGroup[] = []
  const usados = new Set<string>()

  for (const nivel of NIVELES) {
    const carreras = facultad.carreras.filter((carrera) => carrera.nivel === nivel.valor)
    if (carreras.length === 0) continue
    usados.add(nivel.valor)
    grupos.push({ valor: nivel.valor, titulo: nivel.titulo, carreras: ordenar(carreras) })
  }

  const resto = facultad.carreras.filter((carrera) => !usados.has(carrera.nivel))
  if (resto.length > 0) {
    grupos.push({ valor: 'otros', titulo: 'Otras carreras', carreras: ordenar(resto) })
  }

  return grupos
}

function ordenar(carreras: CarreraDeFacultad[]): CarreraDeFacultad[] {
  return [...carreras].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es-AR'))
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
