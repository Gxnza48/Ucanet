/**
 * app/(public)/materias/page.tsx — el índice del catálogo (D7, PART 23 §23.7).
 *
 * Es la página hub del mesh de enlaces: desde acá se llega a TODAS las materias en un clic, y
 * las materias son el activo permanente del producto (D1). Por eso está agrupada por facultad
 * y carrera en vez de ser una lista alfabética de 110 filas — la jerarquía es la que el
 * estudiante tiene en la cabeza ("las materias de segundo de Abogacía") y es la que le da
 * sentido semántico al enlazado interno.
 *
 * BUSCADOR SIN JAVASCRIPT: un `<form method="get">` que recarga con `?q=`. No hay typeahead
 * acá a propósito — el typeahead vive en el buscador del header (PART 13 §13.6) y esta es una
 * página de contenido, que según BUILD-CONTRACT §8 no puede embarcar JS de ruta. Sin `q` se
 * sirve el catálogo entero, que a escala del MVP son ~110 filas: filtrar en el servidor es más
 * barato que mandarle un filtro al navegador.
 *
 * RENDERIZADO: ISR 3600 s (PART 20 §20.2) — el catálogo cambia por migración o por seed, o
 * sea casi nunca, y la ruta se invalida con la etiqueta `catalog`. Esta página NO lee la
 * sesión: no tiene nada que personalizar, y así se mantiene realmente estática para el
 * anónimo y para el bot. La única fuga de estaticidad es `?q=`, que al leer `searchParams`
 * fuerza render dinámico en esa variante (la vista sin consulta, que es la que indexa Google,
 * sigue cacheada).
 */
import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { Breadcrumb } from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { getCarreraOptions } from '@/features/auth/queries'
import { listMaterias, type MateriaListItem } from '@/features/materias/queries'
import { cn } from '@/lib/cn'
import { SITE_NAME } from '@/lib/config'
import { absoluteUrl } from '@/lib/env'

export const revalidate = 3600

/** Tope defensivo del término: 120 caracteres no son una búsqueda, son ruido. */
const MAX_QUERY = 120

const TITLE = `Materias de UCA Rosario — Resúmenes, parciales y apuntes | ${SITE_NAME}`
const DESCRIPTION =
  'El catálogo completo de materias de UCA Rosario, por facultad y por carrera. Cada materia ' +
  'tiene su página con apuntes, parciales viejos y publicaciones de quienes la cursaron.'

export async function generateMetadata(): Promise<Metadata> {
  // Canónica siempre a la vista sin filtro: `?q=` es una herramienta de navegación,
  // no una página distinta, y no debería competir consigo misma en el índice.
  const canonical = absoluteUrl('/materias')

  return {
    title: { absolute: TITLE },
    description: DESCRIPTION,
    alternates: { canonical },
    openGraph: { type: 'website', url: canonical, title: TITLE, description: DESCRIPTION },
  }
}

export default async function MateriasPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const sp = await searchParams
  const q = (typeof sp.q === 'string' ? sp.q.trim() : '').slice(0, MAX_QUERY)

  const [materias, carreras] = await Promise.all([
    listMaterias(q.length > 0 ? q : undefined),
    getCarreraOptions(),
  ])

  const facultades = agrupar(materias)

  return (
    <div className="flex w-full flex-col gap-8 py-6 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1 lg:max-w-170">
        <Breadcrumb items={[{ href: '/', label: 'Inicio' }, { label: 'Materias' }]} />
        <h1 className="mt-3 font-serif text-2xl font-semibold text-text-primary">Materias</h1>
        <p className="mt-2 text-m text-text-secondary">
          Cada materia tiene una página propia y permanente. Seguí las que cursás y tu feed se arma
          solo.
        </p>

        <form role="search" method="get" action="/materias" className="mt-6 flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <label htmlFor="q" className="sr-only">
              Buscar una materia
            </label>
            <Input
              id="q"
              name="q"
              type="search"
              defaultValue={q}
              autoComplete="off"
              maxLength={MAX_QUERY}
              placeholder="Buscá una materia por nombre"
            />
          </div>
          <Button type="submit" variant="secondary">
            Buscar
          </Button>
        </form>

        {q.length > 0 ? (
          <p className="mt-3 text-m text-text-secondary">
            {materias.length === 1 ? '1 materia' : `${materias.length} materias`} para «{q}».{' '}
            <Link href="/materias" className="text-accent hover:underline">
              Ver todas
            </Link>
          </p>
        ) : null}

        {materias.length === 0 ? (
          <EmptyState
            className="mt-6"
            title={
              q.length > 0
                ? `No encontramos ninguna materia con «${q}».`
                : 'Todavía no hay materias cargadas.'
            }
            description={
              q.length > 0
                ? 'Probá con menos palabras o con el nombre completo.'
                : 'El catálogo se carga por migración antes de abrir el sitio.'
            }
          />
        ) : (
          <div className="mt-6 flex flex-col gap-8">
            {facultades.map((facultad) => (
              <section key={facultad.slug}>
                <h2 className="font-serif text-xl font-semibold text-text-primary">
                  {facultad.slug === SIN_FACULTAD ? (
                    facultad.nombre
                  ) : (
                    <Link href={`/facultades/${facultad.slug}`} className="hover:underline">
                      {facultad.nombre}
                    </Link>
                  )}
                </h2>

                <div className="mt-3 flex flex-col gap-6">
                  {facultad.carreras.map((carrera) => (
                    <section key={carrera.slug}>
                      <h3 className="text-s font-semibold text-text-secondary">
                        {carrera.slug === SIN_CARRERA ? (
                          carrera.nombre
                        ) : (
                          <Link href={`/carreras/${carrera.slug}`} className="hover:underline">
                            {carrera.nombre}
                          </Link>
                        )}
                      </h3>
                      <ul className="mt-1 border-t border-border">
                        {carrera.materias.map((materia) => (
                          <li key={materia.slug} className="border-b border-border">
                            <Link
                              href={`/materias/${materia.slug}`}
                              className="flex flex-wrap items-baseline gap-x-2 py-3 transition-colors duration-150 ease-out hover:text-accent"
                            >
                              <span className="text-base font-semibold text-text-primary">
                                {materia.nombre}
                              </span>
                              {materia.plan ? (
                                <span className="text-s text-text-secondary">{materia.plan}</span>
                              ) : null}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
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
          <RailLink href="/reciente">Reciente</RailLink>
          <RailLink href="/reglas">Reglas</RailLink>
          <RailLink href="/acerca">Acerca de</RailLink>
        </RailSection>
      </Rail>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Agrupación facultad › carrera › materia
// ---------------------------------------------------------------------------

/** Claves sintéticas para lo que el catálogo todavía no ubicó en un plan. */
const SIN_FACULTAD = '__sin-facultad'
const SIN_CARRERA = '__sin-carrera'

type MateriaEnCarrera = { slug: string; nombre: string; plan: string | null }
type CarreraGroup = { slug: string; nombre: string; materias: MateriaEnCarrera[] }
type FacultadGroup = { slug: string; nombre: string; carreras: CarreraGroup[] }

/**
 * Arma el árbol facultad › carrera › materias.
 *
 * Una materia aparece bajo CADA carrera que la incluye: el mismo programa cursado por dos
 * carreras es una sola página (slug global, §8.3.1) pero dos caminos de navegación, y
 * esconder uno de los dos rompería el mesh de enlaces que hace rankear a la materia.
 * Las materias que ningún plan referencia caen en "Otras materias": no se pierden nunca,
 * porque una materia huérfana en el índice es una página huérfana en Google.
 */
function agrupar(materias: MateriaListItem[]): FacultadGroup[] {
  const facultades = new Map<string, { nombre: string; carreras: Map<string, CarreraGroup> }>()

  function bucket(
    facultadSlug: string,
    facultadNombre: string,
    carreraSlug: string,
    carreraNombre: string,
  ): CarreraGroup {
    let facultad = facultades.get(facultadSlug)
    if (!facultad) {
      facultad = { nombre: facultadNombre, carreras: new Map() }
      facultades.set(facultadSlug, facultad)
    }
    let carrera = facultad.carreras.get(carreraSlug)
    if (!carrera) {
      carrera = { slug: carreraSlug, nombre: carreraNombre, materias: [] }
      facultad.carreras.set(carreraSlug, carrera)
    }
    return carrera
  }

  for (const materia of materias) {
    if (materia.carreras.length === 0) {
      bucket(SIN_FACULTAD, 'Otras materias', SIN_CARRERA, 'Sin carrera asignada').materias.push({
        slug: materia.slug,
        nombre: materia.nombre,
        plan: null,
      })
      continue
    }

    for (const carrera of materia.carreras) {
      bucket(
        carrera.facultad.slug,
        carrera.facultad.nombre,
        carrera.slug,
        carrera.nombre,
      ).materias.push({
        slug: materia.slug,
        nombre: materia.nombre,
        plan: planLabel(carrera.anio, carrera.cuatrimestre),
      })
    }
  }

  return [...facultades.entries()]
    .map(([slug, facultad]) => ({
      slug,
      nombre: facultad.nombre,
      carreras: [...facultad.carreras.values()]
        .map((carrera) => ({
          ...carrera,
          materias: [...carrera.materias].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es-AR')),
        }))
        .sort((a, b) => ordenSintetico(a.slug, b.slug, a.nombre, b.nombre)),
    }))
    .sort((a, b) => ordenSintetico(a.slug, b.slug, a.nombre, b.nombre))
}

/** Los grupos sintéticos van siempre últimos; el resto, alfabético en es-AR. */
function ordenSintetico(slugA: string, slugB: string, nombreA: string, nombreB: string): number {
  const sinteticoA = slugA.startsWith('__') ? 1 : 0
  const sinteticoB = slugB.startsWith('__') ? 1 : 0
  if (sinteticoA !== sinteticoB) return sinteticoA - sinteticoB
  return nombreA.localeCompare(nombreB, 'es-AR')
}

/** "2° año · 1er cuatrimestre" / "3er año · anual" (cuatrimestre 0 = materia anual). */
function planLabel(anio: number, cuatrimestre: number): string {
  const cuatri =
    cuatrimestre === 0 ? 'anual' : cuatrimestre === 1 ? '1er cuatrimestre' : '2° cuatrimestre'
  return `${ordinalAnio(anio)} año · ${cuatri}`
}

function ordinalAnio(anio: number): string {
  return anio === 1 ? '1er' : anio === 3 ? '3er' : `${anio}°`
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
