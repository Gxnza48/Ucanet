/**
 * app/(public)/carreras/[slug]/page.tsx — la página de carrera (D7, PART 23 §23.6/§23.7).
 *
 * Dos trabajos, en este orden:
 *
 *   1. Ser LA respuesta a "plan de estudios <carrera> uca rosario". La grilla completa por
 *      año y cuatrimestre, con cada materia enlazada a su página, es el activo que nadie más
 *      publica en un formato navegable — y es el nodo que reparte autoridad de enlace hacia
 *      las 110 páginas de materia (§23.7: por eso las materias rankean).
 *   2. Mostrar que atrás hay gente: la actividad reciente de la carrera, que es lo que
 *      convierte a un visitante que googleó un plan de estudios en alguien que vuelve.
 *
 * Las optativas van en su propio bloque, separadas de las obligatorias, tal como modela
 * `plan_materias.optativa` (§8.3.1): mezclarlas haría leer un plan que nadie cursa así.
 *
 * RENDERIZADO: ISR 3600 s (PART 20 §20.2) con invalidación por la etiqueta `carrera:<slug>`.
 * Esta página NO lee la sesión —no hay nada personalizable en un plan de estudios— así que
 * se mantiene genuinamente estática para el anónimo, para el bot y para el logueado.
 */
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'

import { Breadcrumb } from '@/components/ui/breadcrumb'
import { ButtonLink } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { FeedList } from '@/features/feed/components/feed-list'
import type { CarreraDetail } from '@/features/materias/queries'
import { getCarrera } from '@/features/materias/queries'
import { cn } from '@/lib/cn'
import { SITE_NAME } from '@/lib/config'
import { absoluteUrl } from '@/lib/env'

export const revalidate = 3600

/** Cuatrimestre 0 = materia anual (CHECK `cuatrimestre in (0,1,2)`, migración 0002). */
const ANUAL = 0

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const carrera = await getCarrera(slug)

  if (!carrera) {
    return { title: { absolute: `Carrera no encontrada | ${SITE_NAME}` }, robots: { index: false } }
  }

  const title = `${carrera.nombre} en UCA Rosario — Plan de estudios y comunidad | ${SITE_NAME}`
  const description =
    `Plan de estudios de ${carrera.nombre} en UCA Rosario, materia por materia. ` +
    `${plural(carrera.materias.length, 'materia', 'materias')} con apuntes, parciales viejos ` +
    'y publicaciones de estudiantes que ya las cursaron.'
  const canonical = absoluteUrl(`/carreras/${carrera.slug}`)

  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    openGraph: { type: 'website', url: canonical, title, description },
  }
}

export default async function CarreraPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const carrera = await getCarrera(slug)
  if (!carrera) notFound()

  const anios = agruparPorAnio(carrera)

  return (
    <div className="flex w-full flex-col gap-8 py-6 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1 lg:max-w-170">
        <Breadcrumb
          items={[
            { href: '/', label: 'Inicio' },
            { href: `/facultades/${carrera.facultad.slug}`, label: carrera.facultad.nombre },
            { label: carrera.nombre },
          ]}
        />

        <header className="mt-3">
          <h1 className="font-serif text-2xl font-semibold text-text-primary">{carrera.nombre}</h1>
          <p className="mt-2 text-m text-text-secondary">
            <Link href={`/facultades/${carrera.facultad.slug}`} className="hover:underline">
              {carrera.facultad.nombre}
            </Link>
            {carrera.duracionAnios !== null ? (
              <> · {plural(carrera.duracionAnios, 'año', 'años')}</>
            ) : null}
            {' · '}
            {plural(carrera.materias.length, 'materia', 'materias')}
          </p>
        </header>

        <section className="mt-6">
          <h2 className="font-serif text-xl font-semibold text-text-primary">Plan de estudios</h2>

          {anios.length === 0 ? (
            <EmptyState
              title="Todavía no cargamos el plan de esta carrera."
              description="Mientras tanto, buscá la materia que cursás en el catálogo."
              action={
                <ButtonLink variant="secondary" href="/materias">
                  Ver todas las materias
                </ButtonLink>
              }
            />
          ) : (
            <div className="mt-3 flex flex-col gap-6">
              {anios.map((anio) => (
                <section key={anio.anio}>
                  <h3 className="text-s font-semibold text-text-secondary">
                    {ordinalAnio(anio.anio)} año
                  </h3>
                  <div className="mt-2 grid grid-cols-1 gap-6 sm:grid-cols-2">
                    {anio.bloques.map((bloque) => (
                      <div key={bloque.clave}>
                        <h4 className="text-s text-text-secondary">{bloque.titulo}</h4>
                        <ul className="mt-1 border-t border-border">
                          {bloque.materias.map((materia) => (
                            <li
                              key={`${materia.slug}-${materia.anio}-${materia.cuatrimestre}`}
                              className="border-b border-border"
                            >
                              <Link
                                href={`/materias/${materia.slug}`}
                                className="flex flex-wrap items-baseline gap-x-2 py-2 transition-colors duration-150 ease-out hover:text-accent"
                              >
                                <span className="text-m font-semibold text-text-primary">
                                  {materia.nombre}
                                </span>
                                {materia.codigo ? (
                                  <span className="text-s text-text-secondary">
                                    {materia.codigo}
                                  </span>
                                ) : null}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>

        <section className="mt-8">
          <h2 className="font-serif text-xl font-semibold text-text-primary">Actividad reciente</h2>
          <FeedList
            items={carrera.actividad}
            className="mt-3"
            emptyState={
              <EmptyState
                title="Todavía no hay publicaciones de esta carrera."
                description="Si estás cursando, contá cómo viene el cuatrimestre."
                action={<ButtonLink href="/registro">Crear cuenta</ButtonLink>}
              />
            }
          />
          {carrera.actividad.length > 0 ? (
            <p className="mt-3 text-m">
              <Link href="/reciente" className="text-accent hover:underline">
                Ver todo lo reciente del sitio
              </Link>
            </p>
          ) : null}
        </section>
      </div>

      <Rail>
        <section className="mt-6 first:mt-0">
          <h2 className="text-s font-semibold text-text-secondary">Datos</h2>
          <dl className="mt-2 flex flex-col gap-2 text-m">
            <div>
              <dt className="text-text-secondary">Facultad</dt>
              <dd>
                <Link
                  href={`/facultades/${carrera.facultad.slug}`}
                  className="text-text-primary hover:text-accent"
                >
                  {carrera.facultad.nombre}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-text-secondary">Nivel</dt>
              <dd className="text-text-primary">{nivelLabel(carrera.nivel)}</dd>
            </div>
            {carrera.duracionAnios !== null ? (
              <div>
                <dt className="text-text-secondary">Duración</dt>
                <dd className="text-text-primary">
                  {plural(carrera.duracionAnios, 'año', 'años')}
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="text-text-secondary">Materias en el plan</dt>
              <dd className="text-text-primary">{carrera.materias.length}</dd>
            </div>
          </dl>
        </section>

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
// La grilla
// ---------------------------------------------------------------------------

type PlanMateria = CarreraDetail['materias'][number]
type Bloque = { clave: string; titulo: string; materias: PlanMateria[] }
type AnioGroup = { anio: number; bloques: Bloque[] }

/**
 * Ordena el plan como se cursa: año ascendente y, dentro de cada año, anuales primero
 * (arrancan en marzo y no terminan hasta noviembre), después 1er y 2° cuatrimestre, y al
 * final las optativas del año en su propio bloque.
 *
 * Una materia puede aparecer en dos versiones de plan de la misma carrera con año distinto
 * (§8.3.1: en Abogacía conviven 2013 y 2020); por eso la clave de React lleva año y
 * cuatrimestre además del slug.
 */
function agruparPorAnio(carrera: CarreraDetail): AnioGroup[] {
  const porAnio = new Map<number, PlanMateria[]>()
  for (const materia of carrera.materias) {
    const lista = porAnio.get(materia.anio) ?? []
    lista.push(materia)
    porAnio.set(materia.anio, lista)
  }

  return [...porAnio.entries()]
    .sort(([a], [b]) => a - b)
    .map(([anio, materias]) => {
      const obligatorias = materias.filter((materia) => !materia.optativa)
      const optativas = materias.filter((materia) => materia.optativa)

      const bloques: Bloque[] = []
      for (const [cuatrimestre, titulo] of [
        [ANUAL, 'Anuales'],
        [1, '1er cuatrimestre'],
        [2, '2° cuatrimestre'],
      ] as const) {
        const delBloque = obligatorias.filter((materia) => materia.cuatrimestre === cuatrimestre)
        if (delBloque.length > 0) {
          bloques.push({ clave: `c${cuatrimestre}`, titulo, materias: ordenar(delBloque) })
        }
      }
      if (optativas.length > 0) {
        bloques.push({ clave: 'optativas', titulo: 'Optativas', materias: ordenar(optativas) })
      }

      return { anio, bloques }
    })
}

function ordenar(materias: PlanMateria[]): PlanMateria[] {
  return [...materias].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es-AR'))
}

/** `carreras.nivel` es texto con CHECK ('pregrado','grado','posgrado'), no enum (§8.2.2). */
function nivelLabel(nivel: string): string {
  if (nivel === 'pregrado') return 'Pregrado'
  if (nivel === 'posgrado') return 'Posgrado'
  return 'Grado'
}

function ordinalAnio(anio: number): string {
  return anio === 1 ? '1er' : anio === 3 ? '3er' : `${anio}°`
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
