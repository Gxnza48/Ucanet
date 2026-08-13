/**
 * app/(public)/buscar/page.tsx — la búsqueda del sitio (PART 17 §17.4.6, PART 13).
 *
 * `force-dynamic` y nada de caché: el espacio de consultas es infinito y cachear
 * resultados de búsqueda es pagar almacenamiento por páginas que nadie vuelve a
 * pedir (PART 20 §20.2). Tampoco se indexa — `robots.txt` la excluye y acá va la
 * meta por si algún rastreador llega igual (§23.1): parámetros infinitos, cero
 * valor de aterrizaje.
 *
 * ORDEN DE GRUPOS FIJO (§17.4.6, §13.4-13.5): Materias (5) → Carreras (3) →
 * Recursos (5) → Publicaciones (10). Las materias van primero porque son la
 * intención navegacional —quien escribe "constitucional" quiere la materia, no
 * una charla sobre ella— y los recursos le ganan a las publicaciones porque para
 * el que busca la utilidad manda sobre la conversación (D1). El orden lo hace
 * `SearchResults`; esta página no reordena nada.
 *
 * SIN BÚSQUEDA MIENTRAS SE ESCRIBE (§17.4.6). El input sugiere materias con
 * debounce, pero la búsqueda completa se dispara con Enter y aterriza en esta
 * URL: cada tecla contra el índice de texto completo es el costo que §13.5
 * rechaza [FREE-TIER RISK].
 *
 * El estado vacío usa la copy exacta de §17.4.6 y no la de `SearchResults`, que
 * dice otra cosa; la diferencia está reportada.
 */
import type { Metadata } from 'next'

import { EmptyState } from '@/components/ui/empty-state'
import { ButtonLink } from '@/components/ui/button'
import { Tabs } from '@/components/ui/tabs'
import { SearchInput } from '@/features/search/components/search-input'
import { SearchResults } from '@/features/search/components/search-results'
import {
  searchAll,
  normalizeQuery,
  SEARCH_MIN_LENGTH,
  type SearchTipo,
} from '@/features/search/queries'
import { SITE_NAME } from '@/lib/config'

export const dynamic = 'force-dynamic'

/** Los cuatro filtros de §13.5, en el orden en que se muestran. */
const TIPO_TABS: ReadonlyArray<{ tipo: SearchTipo; label: string }> = [
  { tipo: 'todo', label: 'Todo' },
  { tipo: 'materias', label: 'Materias' },
  { tipo: 'recursos', label: 'Recursos' },
  { tipo: 'publicaciones', label: 'Publicaciones' },
]

type PageSearchParams = { [key: string]: string | string[] | undefined }

type PageProps = {
  searchParams: Promise<PageSearchParams>
}

function readParam(params: PageSearchParams, key: string): string {
  const value = params[key]
  return typeof value === 'string' ? value : ''
}

function readTipo(params: PageSearchParams): SearchTipo {
  const value = readParam(params, 'tipo')
  const match = TIPO_TABS.find((tab) => tab.tipo === value)
  return match ? match.tipo : 'todo'
}

/** `/buscar?q=…&tipo=…`, con "todo" implícito para no ensuciar la URL por defecto. */
function searchHref(q: string, tipo: SearchTipo): string {
  const base = `/buscar?q=${encodeURIComponent(q)}`
  return tipo === 'todo' ? base : `${base}&tipo=${tipo}`
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const sp = await searchParams
  const q = normalizeQuery(readParam(sp, 'q'))

  return {
    title: { absolute: q ? `«${q}» — Buscar | ${SITE_NAME}` : `Buscar | ${SITE_NAME}` },
    description: `Buscá materias, publicaciones y recursos de estudio en ${SITE_NAME}.`,
    robots: { index: false, follow: true },
  }
}

export default async function BuscarPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const raw = readParam(sp, 'q')
  const tipo = readTipo(sp)

  // Una sola llamada por request: `generateMetadata` no busca, sólo normaliza el
  // término, así que no hay riesgo de contar dos veces la misma consulta en
  // `search_queries` (§13.8). `searchAll` está envuelta en `cache()` de todos
  // modos, que es el seguro si algún día la metadata necesita los resultados.
  const results = await searchAll(raw, tipo)
  const hasQuery = results.q.length >= SEARCH_MIN_LENGTH

  return (
    <div className="mx-auto w-full max-w-170 py-6">
      <h1 className="font-serif text-2xl font-semibold text-text-primary">Buscar</h1>

      {/* Autofoco al llegar (§17.4.6): a esta página se entra para escribir. */}
      <SearchInput defaultValue={results.q} autoFocus className="mt-4" />

      {hasQuery ? (
        <Tabs
          className="mt-5"
          activeHref={searchHref(results.q, tipo)}
          items={TIPO_TABS.map((tab) => ({
            href: searchHref(results.q, tab.tipo),
            label: tab.label,
          }))}
        />
      ) : null}

      <div className="mt-5">
        {hasQuery && results.total === 0 ? (
          // Copy exacta de §17.4.6, con la consulta entre comillas angulares.
          <EmptyState
            title={`No encontramos nada con «${results.q}».`}
            description="Probá con menos palabras."
            action={
              <ButtonLink variant="secondary" href="/materias">
                Ver todas las materias
              </ButtonLink>
            }
          />
        ) : (
          <SearchResults results={results} />
        )}
      </div>
    </div>
  )
}
