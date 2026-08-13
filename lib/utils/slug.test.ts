import { describe, expect, it } from 'vitest'

import { isSlug, slugify, SLUG_MAX_LENGTH } from './slug'

describe('slugify', () => {
  it('resuelve los nombres reales del catálogo de UCA Rosario', () => {
    expect(slugify('Álgebra y Geometría Analítica')).toBe('algebra-y-geometria-analitica')
    expect(slugify('Introducción al Derecho')).toBe('introduccion-al-derecho')
    expect(slugify('Derecho Constitucional')).toBe('derecho-constitucional')
    expect(slugify('Teoría y Técnica Impositiva I')).toBe('teoria-y-tecnica-impositiva-i')
  })

  it('mapea ñ y ü sin perder la letra', () => {
    expect(slugify('Diseño de Sistemas')).toBe('diseno-de-sistemas')
    expect(slugify('Enseñanza del Español')).toBe('ensenanza-del-espanol')
    expect(slugify('Lingüística General')).toBe('linguistica-general')
  })

  it('colapsa separadores y no deja guiones sueltos en los extremos', () => {
    expect(slugify('  Práctica   Profesional  ')).toBe('practica-profesional')
    expect(slugify('¿Qué es el Derecho?')).toBe('que-es-el-derecho')
    expect(slugify('Contabilidad I — Básica')).toBe('contabilidad-i-basica')
    expect(slugify('Historia (Argentina) / Americana')).toBe('historia-argentina-americana')
    expect(slugify('---Economía---')).toBe('economia')
  })

  it('recorta a 80 caracteres sin dejar guion al final', () => {
    const largo = slugify(`${'a'.repeat(50)} ${'b'.repeat(50)}`)
    expect(largo).toHaveLength(SLUG_MAX_LENGTH)
    expect(largo.endsWith('-')).toBe(false)

    // El corte cae justo sobre el guion: se descarta, no se deja huérfano.
    const enElGuion = slugify(`${'a'.repeat(79)} ${'b'.repeat(10)}`)
    expect(enElGuion).toBe('a'.repeat(79))
  })

  it('devuelve cadena vacía cuando no hay nada alfanumérico que rescatar', () => {
    expect(slugify('')).toBe('')
    expect(slugify('   ')).toBe('')
    expect(slugify('¿¡...!?')).toBe('')
  })

  it('produce siempre algo que el CHECK de SQL acepta', () => {
    const entradas = [
      'Álgebra y Geometría Analítica',
      'Introducción al Derecho',
      'Diseño de Sistemas',
      'Contabilidad I — Básica',
      '  Práctica   Profesional  ',
      `${'a'.repeat(50)} ${'b'.repeat(50)}`,
      'C++ y Algoritmos',
      'Ética, Política & Sociedad',
    ]

    for (const entrada of entradas) {
      expect(isSlug(slugify(entrada))).toBe(true)
    }
  })

  it('es idempotente: slugificar un slug no lo cambia', () => {
    const slug = slugify('Álgebra y Geometría Analítica')
    expect(slugify(slug)).toBe(slug)
  })
})

describe('isSlug', () => {
  it('acepta la forma del CHECK ^[a-z0-9]+(-[a-z0-9]+)*$', () => {
    expect(isSlug('derecho-constitucional')).toBe(true)
    expect(isSlug('contabilidad-i')).toBe(true)
    expect(isSlug('a')).toBe(true)
    expect(isSlug('2026')).toBe(true)
    expect(isSlug('a'.repeat(SLUG_MAX_LENGTH))).toBe(true)
  })

  it('rechaza todo lo que la base rechazaría', () => {
    expect(isSlug('')).toBe(false)
    expect(isSlug('Derecho')).toBe(false)
    expect(isSlug('-derecho')).toBe(false)
    expect(isSlug('derecho-')).toBe(false)
    expect(isSlug('derecho--constitucional')).toBe(false)
    expect(isSlug('derecho constitucional')).toBe(false)
    expect(isSlug('derecho_constitucional')).toBe(false)
    expect(isSlug('economía')).toBe(false)
    expect(isSlug('a'.repeat(SLUG_MAX_LENGTH + 1))).toBe(false)
  })
})
