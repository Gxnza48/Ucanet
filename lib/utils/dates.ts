/**
 * lib/utils/dates.ts — fechas en es-AR, sin librería de fechas.
 *
 * PART 19 §19.12 prohíbe explícitamente una dependencia de fechas: `Intl` nativo
 * ya renderiza "hace 3 h" y "14 de marzo de 2027". Todo el producto vive en una
 * sola zona horaria (Rosario) y en un solo locale (es-AR) — no hay i18n ni
 * selector de huso, así que la zona se fija acá y no se pasa por parámetro.
 *
 * Regla de estilo (PART 17 §17.x): tiempo relativo mientras es útil, fecha
 * absoluta cuando deja de serlo. Un lector del archivo en 2036 necesita el año,
 * no "hace 3.421 días".
 *
 * Todas las funciones reciben un ISO 8601 (lo que devuelve Postgres para
 * `timestamptz`) y devuelven cadena vacía si la fecha es inválida: un renglón de
 * metadatos vacío es preferible a una excepción en una página de contenido.
 */

const LOCALE = 'es-AR'

/** Zona única del producto. Rosario no tiene huso propio; usa el de Buenos Aires. */
export const TIME_ZONE = 'America/Argentina/Buenos_Aires'

/** A partir de acá el tiempo relativo pierde sentido y mostramos la fecha. */
const RELATIVE_MAX_DAYS = 30

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

// Los formateadores de Intl son caros de construir y se reutilizan; se crean en
// el primer uso para no pagarlos en módulos que solo importan una función.
let relativeShortFormatter: Intl.RelativeTimeFormat | null = null
let relativeLongFormatter: Intl.RelativeTimeFormat | null = null
let dateFormatter: Intl.DateTimeFormat | null = null
let monthYearFormatter: Intl.DateTimeFormat | null = null
let isoFormatter: Intl.DateTimeFormat | null = null

/** Estilo corto: "hace 5 min", "hace 3 h". */
function relativeShort(): Intl.RelativeTimeFormat {
  relativeShortFormatter ??= new Intl.RelativeTimeFormat(LOCALE, {
    numeric: 'always',
    style: 'short',
  })
  return relativeShortFormatter
}

/**
 * Estilo largo, solo para días: en es-AR el estilo corto pluraliza mal el
 * singular ("hace 1 días"). Con `long` sale "hace 1 día" / "hace 2 días".
 */
function relativeLong(): Intl.RelativeTimeFormat {
  relativeLongFormatter ??= new Intl.RelativeTimeFormat(LOCALE, {
    numeric: 'always',
    style: 'long',
  })
  return relativeLongFormatter
}

function absoluteDate(): Intl.DateTimeFormat {
  dateFormatter ??= new Intl.DateTimeFormat(LOCALE, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: TIME_ZONE,
  })
  return dateFormatter
}

function absoluteMonthYear(): Intl.DateTimeFormat {
  monthYearFormatter ??= new Intl.DateTimeFormat(LOCALE, {
    month: 'long',
    year: 'numeric',
    timeZone: TIME_ZONE,
  })
  return monthYearFormatter
}

function isoParts(): Intl.DateTimeFormat {
  isoFormatter ??= new Intl.DateTimeFormat(LOCALE, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: TIME_ZONE,
  })
  return isoFormatter
}

/** Parsea el ISO; null si la fecha es inválida. */
function parse(iso: string): Date | null {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * Tiempo transcurrido, en la voz del producto.
 *
 * - menos de un minuto (o fecha futura por desfase de reloj): "recién"
 * - menos de una hora: "hace 5 min"
 * - menos de un día: "hace 3 h"
 * - hasta 30 días: "hace 2 días"
 * - más de 30 días: la fecha absoluta ("14 de marzo de 2027")
 *
 * Los días se cuentan en tramos de 24 h, no en días calendario: "hace 1 día"
 * significa hace veinticuatro horas, que es lo que el lector interpreta en un
 * renglón de metadatos junto al autor y la materia.
 *
 * Quien la use debería envolver el resultado en `<time dateTime={iso}>` con la
 * fecha absoluta en `title` (PART 17): el texto relativo es para el humano, el
 * atributo es para las máquinas y para el que quiere el dato exacto.
 */
export function relativeTime(iso: string): string {
  const date = parse(iso)
  if (!date) return ''

  const elapsed = Date.now() - date.getTime()
  if (elapsed < MINUTE_MS) return 'recién'

  const minutes = Math.floor(elapsed / MINUTE_MS)
  if (minutes < 60) return relativeShort().format(-minutes, 'minute')

  const hours = Math.floor(elapsed / HOUR_MS)
  if (hours < 24) return relativeShort().format(-hours, 'hour')

  const days = Math.floor(elapsed / DAY_MS)
  if (days <= RELATIVE_MAX_DAYS) return relativeLong().format(-days, 'day')

  return formatDate(iso)
}

/** Fecha completa con año: "14 de marzo de 2027". El año va siempre (D1: el archivo cruza años). */
export function formatDate(iso: string): string {
  const date = parse(iso)
  return date ? absoluteDate().format(date) : ''
}

/** Mes y año: "marzo de 2027". Para encabezados de agrupación y metadatos de recursos. */
export function formatMonthYear(iso: string): string {
  const date = parse(iso)
  return date ? absoluteMonthYear().format(date) : ''
}

/**
 * Día calendario en Rosario, formato ISO: "2027-03-14".
 *
 * Para `<time dateTime>`, sitemaps y agrupación por día. Se calcula con `Intl`
 * y no con `toISOString()` a propósito: `toISOString()` responde en UTC, y todo
 * lo publicado entre las 21:00 y la medianoche caería en el día siguiente.
 */
export function isoDay(iso: string): string {
  const date = parse(iso)
  if (!date) return ''

  const parts = isoParts().formatToParts(date)
  const value = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? ''

  const year = value('year')
  const month = value('month')
  const day = value('day')
  if (!year || !month || !day) return ''

  return `${year}-${month}-${day}`
}
