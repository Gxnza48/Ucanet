import { describe, expect, it } from 'vitest'

import {
  INVITE_CODE_SIZE,
  isPublicId,
  newInviteCode,
  newPublicId,
  PUBLIC_ID_ALPHABET,
  PUBLIC_ID_SIZE,
} from './public-id'

/** Los caracteres ambiguos que D7 excluye a mano, para probarlos por nombre. */
const AMBIGUOS = ['0', '1', 'i', 'l', 'o']

describe('el alfabeto', () => {
  it('es exactamente el de public.nanoid() en la migración 0001', () => {
    expect(PUBLIC_ID_ALPHABET).toBe('23456789abcdefghjkmnpqrstuvwxyz')
    expect(PUBLIC_ID_ALPHABET).toHaveLength(31)
  })

  it('no contiene ningún carácter ambiguo', () => {
    for (const caracter of AMBIGUOS) {
      expect(PUBLIC_ID_ALPHABET).not.toContain(caracter)
    }
  })
})

describe('newPublicId', () => {
  it('genera 10 caracteres que matchean ^[a-z0-9]{10}$', () => {
    for (let i = 0; i < 500; i += 1) {
      const id = newPublicId()
      expect(id).toHaveLength(PUBLIC_ID_SIZE)
      expect(id).toMatch(/^[a-z0-9]{10}$/)
    }
  })

  it('nunca emite 0, 1, i, l ni o', () => {
    const muestra = Array.from({ length: 500 }, () => newPublicId()).join('')

    for (const caracter of AMBIGUOS) {
      expect(muestra).not.toContain(caracter)
    }
    for (const caracter of muestra) {
      expect(PUBLIC_ID_ALPHABET).toContain(caracter)
    }
  })

  it('respeta el tamaño pedido', () => {
    expect(newPublicId(4)).toHaveLength(4)
    expect(newPublicId(6)).toHaveLength(6)
    expect(newPublicId(21)).toHaveLength(21)
  })

  it('no repite ids en un lote grande', () => {
    const ids = new Set(Array.from({ length: 2_000 }, () => newPublicId()))
    expect(ids.size).toBe(2_000)
  })
})

describe('newInviteCode', () => {
  it('genera 8 caracteres del mismo alfabeto', () => {
    for (let i = 0; i < 200; i += 1) {
      const code = newInviteCode()
      expect(code).toHaveLength(INVITE_CODE_SIZE)
      for (const caracter of code) {
        expect(PUBLIC_ID_ALPHABET).toContain(caracter)
      }
    }
  })
})

describe('isPublicId', () => {
  it('acepta todo lo que genera newPublicId', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(isPublicId(newPublicId())).toBe(true)
    }
  })

  it('rechaza cualquier cosa que no sea la forma de una URL de post', () => {
    expect(isPublicId('')).toBe(false)
    expect(isPublicId('abc')).toBe(false)
    expect(isPublicId('abcdefghij1')).toBe(false)
    expect(isPublicId('ABCDEFGHIJ')).toBe(false)
    expect(isPublicId('abcdef-hij')).toBe(false)
    expect(isPublicId('abcdefghi ')).toBe(false)
    expect(isPublicId(newInviteCode())).toBe(false)
  })

  it('es más ancha que el alfabeto a propósito: no rechaza ids con 0/1/i/l/o', () => {
    expect(isPublicId('0123456789')).toBe(true)
    expect(isPublicId('iiiillllo1')).toBe(true)
  })
})
