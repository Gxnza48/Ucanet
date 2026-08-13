/**
 * lib/config.ts — la constante única de nombre (D10) y las constantes de producto.
 *
 * D10 es vinculante: el nombre del producto aparece EXACTAMENTE acá y en el componente
 * de wordmark que lo consume. Renombrar el producto debe ser un cambio de un día.
 * No imprimas el nombre en contenido durable (nada de marcas de agua en PDFs).
 */

/** El nombre del producto. Cambiar acá renombra todo el sitio. */
export const SITE_NAME = 'uca.net'

/** Nombre partido para el wordmark: `{head}` + punto acento + `{tld}` (PART 18 §18.6). */
export const SITE_NAME_PARTS = (() => {
  const dot = SITE_NAME.lastIndexOf('.')
  if (dot <= 0) return { head: SITE_NAME, tld: '' }
  return { head: SITE_NAME.slice(0, dot), tld: SITE_NAME.slice(dot + 1) }
})()

export const SITE_TAGLINE = 'La capa estudiantil de UCA Rosario'

export const SITE_DESCRIPTION =
  'Comunidad estudiantil de UCA Rosario: publicaciones, materias y recursos académicos. ' +
  'Independiente, hecho por estudiantes.'

/** Va en el pie de todas las páginas (D8, vinculante). */
export const FOOTER_DISCLAIMER =
  'Sitio independiente hecho por estudiantes. Sin afiliación con la Universidad Católica Argentina.'

/** Paginación única en todo el producto (§0.5-R23). */
export const PAGE_SIZE = 25

/** Límites de contenido, espejados en los CHECK de PART 8. */
export const LIMITS = {
  postTitle: 120,
  postBody: 10_000,
  commentBody: 5_000,
  resourceTitleMin: 8,
  resourceTitle: 120,
  resourceDescription: 2_000,
  reportDetail: 1_000,
  appealBody: 2_000,
  handleMin: 3,
  handleMax: 24,
  passwordMin: 10,
  fileMaxBytes: 10 * 1024 * 1024,
  filesPerResource: 3,
  userQuotaBytes: 100 * 1024 * 1024,
  commentDepthMax: 2,
} as const

/** Tipos MIME aceptados en subidas (PART 8 §8.3.5). */
export const ACCEPTED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const

export type AcceptedMime = (typeof ACCEPTED_MIME)[number]
