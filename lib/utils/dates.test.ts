import { describe, expect, it } from 'vitest'

import { formatDate, formatMonthYear, isoDay, relativeTime } from './dates'

/** ISO de hace `ms` milisegundos, para no depender de timers falsos. */
function haceMs(ms: number): string {
  return new Date(Date.now() - ms).toISOString()
}

const SEGUNDO = 1_000
const MINUTO = 60 * SEGUNDO
const HORA = 60 * MINUTO
const DIA = 24 * HORA

describe('relativeTime', () => {
  it('dice "recién" abajo del minuto', () => {
    expect(relativeTime(haceMs(0))).toBe('recién')
    expect(relativeTime(haceMs(10 * SEGUNDO))).toBe('recién')
    expect(relativeTime(haceMs(59 * SEGUNDO))).toBe('recién')
  })

  it('trata una fecha futura como "recién" (desfase de reloj, no error)', () => {
    expect(relativeTime(new Date(Date.now() + 30 * SEGUNDO).toISOString())).toBe('recién')
  })

  it('usa minutos abreviados abajo de la hora', () => {
    expect(relativeTime(haceMs(MINUTO))).toBe('hace 1 min')
    expect(relativeTime(haceMs(5 * MINUTO))).toBe('hace 5 min')
    expect(relativeTime(haceMs(59 * MINUTO))).toBe('hace 59 min')
  })

  it('usa horas abreviadas abajo del día', () => {
    expect(relativeTime(haceMs(HORA))).toBe('hace 1 h')
    expect(relativeTime(haceMs(3 * HORA))).toBe('hace 3 h')
    expect(relativeTime(haceMs(23 * HORA))).toBe('hace 23 h')
  })

  it('usa días en palabra completa, con el singular correcto', () => {
    expect(relativeTime(haceMs(DIA))).toBe('hace 1 día')
    expect(relativeTime(haceMs(2 * DIA))).toBe('hace 2 días')
    expect(relativeTime(haceMs(30 * DIA))).toBe('hace 30 días')
  })

  it('pasa a fecha absoluta después de 30 días', () => {
    const viejo = haceMs(31 * DIA)
    expect(relativeTime(viejo)).toBe(formatDate(viejo))

    expect(relativeTime('2020-05-10T15:00:00.000Z')).toBe('10 de mayo de 2020')
  })

  it('devuelve cadena vacía con una fecha inválida', () => {
    expect(relativeTime('')).toBe('')
    expect(relativeTime('no es una fecha')).toBe('')
  })
})

describe('formatDate', () => {
  it('escribe la fecha completa en es-AR', () => {
    expect(formatDate('2027-03-14T12:00:00-03:00')).toBe('14 de marzo de 2027')
    expect(formatDate('2027-08-01T09:30:00-03:00')).toBe('1 de agosto de 2027')
  })

  it('resuelve el día en la zona de Rosario, no en UTC', () => {
    // 15/03 02:00 UTC son las 23:00 del 14/03 en Argentina.
    expect(formatDate('2027-03-15T02:00:00.000Z')).toBe('14 de marzo de 2027')
  })

  it('devuelve cadena vacía con una fecha inválida', () => {
    expect(formatDate('no es una fecha')).toBe('')
  })
})

describe('formatMonthYear', () => {
  it('escribe mes y año', () => {
    expect(formatMonthYear('2027-03-14T12:00:00-03:00')).toBe('marzo de 2027')
    expect(formatMonthYear('2026-12-31T23:00:00-03:00')).toBe('diciembre de 2026')
  })

  it('devuelve cadena vacía con una fecha inválida', () => {
    expect(formatMonthYear('no es una fecha')).toBe('')
  })
})

describe('isoDay', () => {
  it('devuelve el día calendario en formato ISO', () => {
    expect(isoDay('2027-03-14T12:00:00-03:00')).toBe('2027-03-14')
    expect(isoDay('2027-08-01T09:30:00-03:00')).toBe('2027-08-01')
  })

  it('corta el día por la medianoche argentina, no por la de UTC', () => {
    expect(isoDay('2027-03-15T02:00:00.000Z')).toBe('2027-03-14')
    expect(isoDay('2027-03-15T03:00:00.000Z')).toBe('2027-03-15')
  })

  it('devuelve cadena vacía con una fecha inválida', () => {
    expect(isoDay('no es una fecha')).toBe('')
  })
})
