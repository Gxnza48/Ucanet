import type { MetadataRoute } from 'next'

import { getSitemapData, type SitemapEntry } from '@/features/sitemap/queries'
import { absoluteUrl } from '@/lib/env'

/**
 * app/sitemap.ts — `/sitemap.xml` (PART 23 §23.5).
 *
 * El sitemap es la lista de lo que queremos que Google encuentre, y en este producto
 * eso es la dimensión SIEMPRE de D1: un estudiante de 2036 llega a 2026 por acá.
 * Entra el contenido; no entra la identidad.
 *
 * QUÉ ENTRA: home, `/reciente`, los índices, todas las materias, todas las carreras,
 * todas las facultades, los recursos activos y los posts activos.
 *
 * QUÉ NO ENTRA, y por qué:
 * - **`/u/[handle]`** — los perfiles van `noindex` (§23.1, C16). El historial agregado
 *   de un seudónimo en un buscador es un amplificador de linkeo. `robots.ts` sí los
 *   deja rastrear, para que el crawler pueda leer ese `noindex`.
 * - **Lo removido y lo borrado** — no hace falta filtrarlo acá: las lecturas pasan por
 *   las vistas `_public`, que ya sólo muestran `status = 'activo'` (migración 0010).
 *   El contenido que se cae del sitemap devuelve 410 en su URL y se desindexa solo
 *   (§0.5-R23c). El 410 es el que desindexa; el sitemap sólo deja de insistir.
 * - **`/buscar`, `/avisos`, `/ajustes`, `/mod/*`, los flujos de alta** — bloqueados en
 *   `robots.ts`; listarlos acá sería contradecirse.
 *
 * CACHÉ: ISR de 24 h (§23.5). El sitemap se regenera en el primer pedido después de
 * que vence, que operativamente es lo mismo que "regenerado a diario" y no consume el
 * único cron que Hobby permite (§20.9) — ese ya está tomado por `/api/cron/aggregates`.
 * `features/sitemap/queries.ts` lee con un cliente anónimo sin cookies justamente para
 * que esta ruta pueda seguir siendo cacheable.
 *
 * SÓLO SE EMITE `lastmod`. `priority` y `changefreq` los ignora Google desde 2015 y
 * son ruido que hay que mantener sincronizado con la realidad; `lastmod` sí lo usa
 * para priorizar el rastreo, y acá sale de datos reales (última actividad del
 * contenido), no de la hora en que se regeneró el archivo.
 *
 * CUANDO ESTO CREZCA: el límite del protocolo son 50.000 URLs por archivo y los topes
 * de `SITEMAP_LIMITS` suman bastante menos. El paso siguiente ya está diseñado en
 * §23.5 — índice + segmentos, con los posts en baldes mensuales para que lo viejo se
 * vuelva byte-estable — y en Next se implementa con `generateSitemaps()` sin tocar el
 * módulo de lecturas.
 */
export const revalidate = 86_400

/**
 * Tope duro del protocolo (sitemaps.org). Si alguna vez se toca, lo que sobra se
 * recorta acá en vez de servir un XML que Google descarta entero.
 */
const MAX_URLS = 50_000

/**
 * Fecha de la última edición de las páginas estáticas (legales, `/acerca`).
 * Es una constante y no `new Date()` a propósito: con la fecha de render, cada
 * regeneración del ISR le diría a Google que los Términos cambiaron hoy. Se actualiza
 * a mano cuando el texto cambia de verdad — que es lo que `lastmod` significa.
 */
const STATIC_LAST_MODIFIED = '2026-08-13'

/**
 * Rutas fijas del mapa de URLs (D7). `/carreras` y `/facultades` no figuran: el
 * contrato de rutas (BUILD CONTRACT §6) define `/carreras/[slug]` y
 * `/facultades/[slug]`, pero no una página índice para ninguna de las dos. Sus
 * páginas individuales entran igual, una por una, más abajo.
 */
const STATIC_PATHS = ['/acerca', '/reglas', '/terminos', '/privacidad'] as const

function toEntry(entry: SitemapEntry): MetadataRoute.Sitemap[number] {
  return { url: absoluteUrl(entry.path), lastModified: entry.lastModified }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const data = await getSitemapData()

  // Sin actividad todavía (catálogo recién sembrado, antes de la beta) la home y los
  // índices se fechan con la fecha de las páginas estáticas: es lo último que cambió
  // de verdad en ellas.
  const activity = data.latestActivity ?? STATIC_LAST_MODIFIED

  const hubs: MetadataRoute.Sitemap = [
    { url: absoluteUrl('/'), lastModified: activity },
    { url: absoluteUrl('/reciente'), lastModified: activity },
    { url: absoluteUrl('/materias'), lastModified: activity },
    { url: absoluteUrl('/recursos'), lastModified: activity },
  ]

  const staticPages: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
    url: absoluteUrl(path),
    lastModified: STATIC_LAST_MODIFIED,
  }))

  // El orden es el de la malla de enlaces de §23.7: primero los hubs, después el
  // catálogo permanente (materias, carreras, facultades) y al final el contenido.
  // Si alguna vez hay que recortar por el tope, se cae lo más efímero.
  const entries: MetadataRoute.Sitemap = [
    ...hubs,
    ...staticPages,
    ...data.materias.map(toEntry),
    ...data.carreras.map(toEntry),
    ...data.facultades.map(toEntry),
    ...data.recursos.map(toEntry),
    ...data.posts.map(toEntry),
  ]

  return entries.slice(0, MAX_URLS)
}
