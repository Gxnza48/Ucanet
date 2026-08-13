import { describe, expect, it } from 'vitest'

import { excerpt, EXCERPT_LENGTH, truncate } from './text'

describe('truncate', () => {
  it('deja intacto lo que ya entra', () => {
    expect(truncate('Resumen de Civil', 40)).toBe('Resumen de Civil')
    expect(truncate('exacto', 6)).toBe('exacto')
    expect(truncate('', 10)).toBe('')
  })

  it('corta y marca el corte sin pasarse del máximo', () => {
    const cortado = truncate('Resumen de Derecho Constitucional', 20)

    expect(cortado).toBe('Resumen de Derecho…')
    expect(cortado.length).toBeLessThanOrEqual(20)
    expect(cortado.endsWith('…')).toBe(true)
  })

  it('no deja espacio colgando antes de los puntos suspensivos', () => {
    expect(truncate('Derecho Constitucional', 9)).toBe('Derecho…')
  })

  it('con máximo no positivo devuelve vacío', () => {
    expect(truncate('Derecho', 0)).toBe('')
    expect(truncate('Derecho', -3)).toBe('')
  })
})

describe('excerpt', () => {
  it('aplasta saltos de línea y espacios repetidos', () => {
    expect(excerpt('Primera línea.\n\nSegunda línea.')).toBe('Primera línea. Segunda línea.')
    expect(excerpt('  Hola   \t che  \n ')).toBe('Hola che')
  })

  it('no agrega puntos suspensivos si no cortó', () => {
    expect(excerpt('Un cuerpo corto.')).toBe('Un cuerpo corto.')
    expect(excerpt('Un cuerpo corto.').endsWith('…')).toBe(false)
  })

  it('corta en límite de palabra y marca el corte', () => {
    const cortado = excerpt('Alguien sabe cómo tomó el final de Constitucional ayer', 20)

    expect(cortado).toBe('Alguien sabe cómo…')
    expect(cortado.length).toBeLessThanOrEqual(20)
  })

  it('corta duro cuando no hay ningún espacio donde cortar', () => {
    const cortado = excerpt('a'.repeat(50), 10)

    expect(cortado).toHaveLength(10)
    expect(cortado).toBe(`${'a'.repeat(9)}…`)
  })

  it('usa 200 caracteres por defecto', () => {
    const largo = Array.from({ length: 100 }, (_, i) => `palabra${i}`).join(' ')
    const cortado = excerpt(largo)

    expect(largo.length).toBeGreaterThan(EXCERPT_LENGTH)
    expect(cortado.length).toBeLessThanOrEqual(EXCERPT_LENGTH)
    expect(cortado.endsWith('…')).toBe(true)
    expect(cortado.includes('\n')).toBe(false)
  })

  it('cuenta un párrafo aplastado, no el original, contra el máximo', () => {
    const conSaltos = `${'a'.repeat(90)}\n\n${'b'.repeat(90)}`
    expect(excerpt(conSaltos, EXCERPT_LENGTH)).toBe(`${'a'.repeat(90)} ${'b'.repeat(90)}`)
  })

  it('con máximo no positivo devuelve vacío', () => {
    expect(excerpt('lo que sea', 0)).toBe('')
  })
})
