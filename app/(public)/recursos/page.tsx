/**
 * app/(public)/recursos/page.tsx — la estantería global (PART 17 §17.4.5, PART 14).
 *
 * Es el imán de utilidad (§14.1): la página que le da valor a alguien que llega
 * de Google sin conocer a nadie. Metadatos públicos e indexables; los bytes,
 * detrás de la sesión (§14.5).
 *
 * ISR de 300 s. La estantería cambia cuando alguien sube algo, no cuando alguien
 * la mira: cinco minutos de desfasaje es exactamente lo que nadie nota y lo que
 * ahorra una invocación por visita (PART 20 §20.2). Nota operativa: el cliente de
 * Supabase lee cookies, así que en la práctica Next sirve esta ruta de forma
 * dinámica; el `revalidate` queda declarado porque es el contrato de la ruta y
 * porque vuelve a valer solo el día que la lectura pública no toque cookies.
 *
 * FILTROS SIN JAVASCRIPT. El de materia es un `<form method="get">` con un
 * `<select>` nativo y un botón: funciona sin bundle, es una URL compartible y el
 * back del navegador hace lo que tiene que hacer. Los de tipo son chips que son
 * links (§17.4.5) y conservan la materia elegida. Toda la página es un Server
 * Component: cero JS de ruta.
 *
 * EL ID DE LA MATERIA NO VIAJA (D14.7). La URL lleva el slug; el `bigint` lo
 * resuelve el servidor con `getMateria`, que además valida que la materia exista
 * — un slug inventado no filtra nada, simplemente no filtra.
 */
import type { Metadata } from 'next'

import { Button, ButtonLink } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { EmptyState } from '@/components/ui/empty-state'
import { Field } from '@/components/ui/field'
import { Pagination } from '@/components/ui/pagination'
import { Select } from '@/components/ui/select'
import { getMateria, listMaterias } from '@/features/materias/queries'
import { ResourceRow } from '@/features/recursos/components/resource-row'
import { listResources } from '@/features/recursos/queries'
import { RESOURCE_TIPOS, TIPO_CHIP_LABELS, isResourceTipo } from '@/features/recursos/schemas'
import { SITE_NAME } from '@/lib/config'
import { isSlug } from '@/lib/utils/slug'

export const revalidate = 300

const CURSOR_PARAM = 'cursor'
const MATERIA_PARAM = 'materia'
const TIPO_PARAM = 'tipo'

type PageSearchParams = { [key: string]: string | string[] | undefined }

type PageProps = {
  searchParams: Promise<PageSearchParams>
}

export const metadata: Metadata = {
  title: { absolute: `Recursos de estudio — Resúmenes, apuntes y parciales | ${SITE_NAME}` },
  description:
    'Resúmenes, apuntes, parciales y finales de las materias de la UCA Rosario, subidos por estudiantes. Filtrá por materia y por tipo.',
  alternates: { canonical: '/recursos' },
}

function readParam(params: PageSearchParams, key: string): string | undefined {
  const value = params[key]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

/**
 * `/recursos` con los filtros vigentes. Los chips de tipo lo llaman SIN cursor a
 * propósito: cambiar de filtro reinicia la paginación, porque un cursor keyset
 * pertenece al conjunto que lo produjo.
 */
function shelfHref(materiaSlug?: string, tipo?: string, cursor?: string): string {
  const query = new URLSearchParams()
  if (materiaSlug) query.set(MATERIA_PARAM, materiaSlug)
  if (tipo) query.set(TIPO_PARAM, tipo)
  if (cursor) query.set(CURSOR_PARAM, cursor)
  const search = query.toString()
  return search ? `/recursos?${search}` : '/recursos'
}

export default async function RecursosPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const cursor = readParam(sp, CURSOR_PARAM)
  const rawMateria = readParam(sp, MATERIA_PARAM)
  const rawTipo = readParam(sp, TIPO_PARAM)

  const materiaSlug = rawMateria && isSlug(rawMateria) ? rawMateria : undefined
  const tipo = rawTipo && isResourceTipo(rawTipo) ? rawTipo : undefined

  const [materias, materia] = await Promise.all([
    listMaterias(),
    materiaSlug ? getMateria(materiaSlug) : Promise.resolve(null),
  ])

  const page = await listResources({
    materiaId: materia?.id,
    tipo,
    cursor,
  })

  const nextHref = page.nextCursor ? shelfHref(materiaSlug, tipo, page.nextCursor) : undefined

  return (
    <div className="mx-auto w-full max-w-170 py-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-text-primary">
            Recursos de estudio
          </h1>
          <p className="mt-2 text-m text-text-secondary">
            Resúmenes, apuntes, parciales y finales, materia por materia.
          </p>
        </div>
        <ButtonLink href="/recursos/subir">Subí un recurso</ButtonLink>
      </header>

      <form action="/recursos" method="get" className="mt-6 flex flex-wrap items-end gap-3">
        <Field label="Materia" htmlFor={MATERIA_PARAM} className="min-w-60 flex-1">
          <Select name={MATERIA_PARAM} defaultValue={materiaSlug ?? ''}>
            <option value="">Todas las materias</option>
            {materias.map((option) => (
              <option key={option.slug} value={option.slug}>
                {option.nombre}
              </option>
            ))}
          </Select>
        </Field>
        {tipo ? <input type="hidden" name={TIPO_PARAM} value={tipo} /> : null}
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
      </form>

      <nav aria-label="Tipo de recurso" className="mt-4 flex flex-wrap items-center gap-2">
        <Chip href={shelfHref(materiaSlug)} variant={tipo ? 'neutral' : 'accent'}>
          Todos
        </Chip>
        {RESOURCE_TIPOS.map((value) => (
          <Chip
            key={value}
            href={shelfHref(materiaSlug, value)}
            variant={tipo === value ? 'accent' : 'neutral'}
          >
            {TIPO_CHIP_LABELS[value]}
          </Chip>
        ))}
      </nav>

      {materiaSlug && !materia ? (
        <p className="mt-4 text-s text-text-secondary">
          No encontramos esa materia. Te mostramos todos los recursos.
        </p>
      ) : null}

      {page.items.length === 0 ? (
        <EmptyState
          className="mt-4"
          title="Todavía no hay recursos con estos filtros."
          description="Probá sin filtros, o subí el primero."
          action={
            <ButtonLink variant="secondary" href="/recursos/subir">
              Subí un recurso
            </ButtonLink>
          }
        />
      ) : (
        <ul className="mt-4 border-t border-border">
          {page.items.map((resource) => (
            <ResourceRow key={resource.publicId} resource={resource} />
          ))}
        </ul>
      )}

      <Pagination className="mt-2" nextHref={nextHref} />
    </div>
  )
}
