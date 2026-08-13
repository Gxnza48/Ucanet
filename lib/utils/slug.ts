/**
 * lib/utils/slug.ts — slugs de catálogo (materias, carreras, facultades, sedes).
 *
 * El contrato es el CHECK de PART 8 §8.2.1, verbatim:
 *
 *     slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80
 *
 * Si `slugify` produjera algo que ese CHECK rechaza, el insert falla en la base:
 * esta función y el CHECK tienen que decir exactamente lo mismo. No hay librería
 * de slugify en el proyecto a propósito (PART 19 §19.12) — son quince líneas y
 * duplicar la regla en una dependencia externa la volvería inauditable.
 *
 * Los slugs son parte del contrato de URLs a diez años (D7): una vez publicado,
 * un slug no se cambia. Esta función solo se usa para *proponer* el slug inicial.
 */

/** Máximo del CHECK de PART 8. */
export const SLUG_MAX_LENGTH = 80

/** La misma expresión que valida el CHECK de SQL. Sin flag `g`: `test` no debe tener estado. */
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

/** Marcas diacríticas combinantes que deja `normalize('NFD')`. */
const COMBINING_MARKS = /[\u0300-\u036f]/g

/**
 * Convierte texto libre en un slug válido para el CHECK de PART 8.
 *
 * Pasos: minúsculas → ñ/Ñ a `n` → NFD y borrado de diacríticos (á → a, ü → u) →
 * todo lo que no sea `[a-z0-9]` pasa a guion → guiones colapsados y recortados →
 * corte duro a 80 caracteres sin dejar guion al final.
 *
 * Entradas sin ningún carácter alfanumérico latino (solo emoji, solo cirílico)
 * devuelven cadena vacía: el llamador debe tratar `''` como "no pude derivar un
 * slug" y pedir uno a mano. Nunca inventamos un slug al azar — un slug es una
 * promesa pública, no un identificador (para eso está `newPublicId`).
 *
 * @example slugify('Álgebra y Geometría Analítica') // 'algebra-y-geometria-analitica'
 * @example slugify('Introducción al Derecho')       // 'introduccion-al-derecho'
 */
export function slugify(input: string): string {
  const withoutEnie = input.toLowerCase().replace(/ñ/g, 'n')

  const withoutDiacritics = withoutEnie.normalize('NFD').replace(COMBINING_MARKS, '')

  const hyphenated = withoutDiacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')

  if (hyphenated.length <= SLUG_MAX_LENGTH) return hyphenated

  // El corte puede caer justo sobre un guion o dejar uno huérfano al final.
  return hyphenated.slice(0, SLUG_MAX_LENGTH).replace(/-+$/, '')
}

/**
 * true si el valor es un slug que la base aceptaría tal cual.
 *
 * Se usa como guarda de ruta antes de tocar la base: `/materias/[slug]` valida
 * la forma y devuelve 404 sin gastar una consulta si no cierra.
 */
export function isSlug(value: string): boolean {
  return value.length <= SLUG_MAX_LENGTH && SLUG_PATTERN.test(value)
}
