/**
 * features/feed/queries.test.ts — la fórmula de ranking de "Mis materias" (PART 12 §12.3).
 *
 * PART 25 reparte las pruebas así: Vitest cubre lógica pura, pgTAP cubre RLS y Playwright
 * cubre los flujos. El ranking del feed es lógica pura, y es además la única parte del feed
 * que el producto le PROMETE al usuario por escrito en /acerca:
 *
 *   "Ordenamos por lo más nuevo; los votos y comentarios pueden adelantar una publicación
 *    unas horas, nunca días."
 *
 * Estos tests son esa frase, ejecutable. Si alguno se pone en rojo, o cambió la fórmula (y
 * entonces hay que cambiar /acerca y enmendar la espina) o se rompió algo.
 *
 * Se importa `./ranking` y no `./queries`: `queries.ts` abre con `import 'server-only'`,
 * paquete que tira apenas se lo importa fuera de un React Server Component, y Vitest corre
 * en `node`. La fórmula vive aislada justamente para poder probarse; `queries.ts` la
 * reexporta para el resto de la aplicación.
 */
import { describe, expect, it } from 'vitest'

import {
  BUMP_CAP_HOURS,
  ENGAGEMENT_CAP,
  compareRanked,
  effectiveAgeHours,
  engagement,
  rankPost,
  type RankablePost,
} from './ranking'

/** t0 fijo: el ranking depende del reloj, así que el reloj es un parámetro del test. */
const NOW = new Date('2026-08-13T12:00:00.000Z')
const HOUR_MS = 3_600_000

function hoursAgo(hours: number): string {
  return new Date(NOW.getTime() - hours * HOUR_MS).toISOString()
}

/**
 * Arma una fila puntuable a partir de horas de antigüedad. `activityHours` por defecto es
 * igual a `ageHours`: un post sin comentarios tiene `last_activity_at = created_at`.
 */
function makePost(input: {
  ageHours: number
  activityHours?: number
  score?: number
  comments?: number
}): RankablePost {
  return {
    score: input.score ?? 0,
    commentsCount: input.comments ?? 0,
    createdAt: hoursAgo(input.ageHours),
    lastActivityAt: hoursAgo(input.activityHours ?? input.ageHours),
  }
}

describe('engagement', () => {
  it('pesa un comentario como dos votos', () => {
    expect(engagement(makePost({ ageHours: 1, score: 4, comments: 3 }))).toBe(10)
  })

  it('vale cero cuando no pasó nada', () => {
    expect(engagement(makePost({ ageHours: 1 }))).toBe(0)
  })
})

describe('effectiveAgeHours', () => {
  it('usa la última actividad cuando el bump entra en el tope de 48 h', () => {
    // Hilo de 3 días con una respuesta hace 1 h: rankea como uno de 24 h (72 - 48).
    const post = makePost({ ageHours: 72, activityHours: 1 })
    expect(effectiveAgeHours(post, NOW)).toBeCloseTo(24, 6)
  })

  it('deja invisible un hilo viejo aunque le respondan hoy', () => {
    // Hilo de 30 días con respuesta reciente: rankea como uno de 27 días. El archivo
    // permite agradecer en un hilo de 2024; el feed de hoy no se secuestra desde ahí.
    const post = makePost({ ageHours: 30 * 24, activityHours: 0.5 })
    expect(effectiveAgeHours(post, NOW)).toBeCloseTo(30 * 24 - BUMP_CAP_HOURS, 6)
  })

  it('respeta el bump entero mientras el post es más joven que el tope', () => {
    // 12 h de antigüedad, comentario hace 1 h: max(1, 12 - 48) = 1.
    const post = makePost({ ageHours: 12, activityHours: 1 })
    expect(effectiveAgeHours(post, NOW)).toBeCloseTo(1, 6)
  })

  it('nunca devuelve una edad negativa', () => {
    // Reloj corrido: la fila dice que la actividad es del futuro.
    const post = makePost({ ageHours: -3 })
    expect(effectiveAgeHours(post, NOW)).toBe(0)
  })
})

describe('rankPost — la garantía anti-viralidad de §12.3', () => {
  it('le da ~3,54 a un post recién publicado sin engagement', () => {
    // 10 / 2^1.5 — el piso que hace que la recencia domine por construcción.
    expect(rankPost(makePost({ ageHours: 0 }), NOW)).toBeCloseTo(10 / 2 ** 1.5, 6)
  })

  it('a las ~4 horas, un post nuevo sin nada le gana a uno con 40 de engagement', () => {
    const fresco = makePost({ ageHours: 0 })
    const viejoConEngagement = makePost({ ageHours: 4, score: 40 })

    expect(engagement(viejoConEngagement)).toBe(ENGAGEMENT_CAP)
    expect(rankPost(fresco, NOW)).toBeGreaterThan(rankPost(viejoConEngagement, NOW))
  })

  it('antes del cruce (~3,85 h) el post con engagement todavía va arriba', () => {
    // La promesa es "unas horas", no "ninguna hora": el engagement sí adelanta contenido,
    // durante un rato acotado. A las 3 h el post votado sigue ganando.
    const fresco = makePost({ ageHours: 0 })
    const votado = makePost({ ageHours: 3, score: 40 })

    expect(rankPost(votado, NOW)).toBeGreaterThan(rankPost(fresco, NOW))
  })

  it('no hay cantidad de votos que sostenga un post callado más allá del cruce', () => {
    const fresco = rankPost(makePost({ ageHours: 0 }), NOW)
    // 400 votos y 200 comentarios: E = 800, topeado en 40. Mismo rank que con 40.
    const inflado = makePost({ ageHours: 4, score: 400, comments: 200 })

    expect(rankPost(inflado, NOW)).toBe(rankPost(makePost({ ageHours: 4, score: 40 }), NOW))
    expect(rankPost(inflado, NOW)).toBeLessThan(fresco)
  })

  it('topea el engagement en 40: un voto 41 no mueve nada', () => {
    const conTope = rankPost(makePost({ ageHours: 6, score: ENGAGEMENT_CAP }), NOW)
    const excedido = rankPost(makePost({ ageHours: 6, score: ENGAGEMENT_CAP + 1 }), NOW)

    expect(excedido).toBe(conTope)
  })

  it('a igual antigüedad, más engagement rankea más alto', () => {
    const callado = rankPost(makePost({ ageHours: 5 }), NOW)
    const conversado = rankPost(makePost({ ageHours: 5, comments: 3 }), NOW)

    expect(conversado).toBeGreaterThan(callado)
  })

  it('resucita un hilo de dos días que recibe una respuesta', () => {
    // El bucle preguntar → responder → volver: la respuesta tardía tiene que reaparecer
    // para la cohorte de quien preguntó.
    const dormido = makePost({ ageHours: 48 })
    const respondido = makePost({ ageHours: 48, activityHours: 0.25, comments: 1 })

    expect(rankPost(respondido, NOW)).toBeGreaterThan(rankPost(dormido, NOW))
  })

  it('decae de forma monótona con el tiempo', () => {
    const ranks = [0, 1, 6, 24, 72, 240].map((hours) =>
      rankPost(makePost({ ageHours: hours }), NOW),
    )
    const ordenado = [...ranks].sort((a, b) => b - a)

    expect(ranks).toEqual(ordenado)
  })

  it('acepta el reloj como número de milisegundos, igual que como Date', () => {
    const post = makePost({ ageHours: 7, score: 3, comments: 1 })
    expect(rankPost(post, NOW.getTime())).toBe(rankPost(post, NOW))
  })

  it('no explota con timestamps inválidos', () => {
    const roto: RankablePost = {
      score: 1,
      commentsCount: 0,
      createdAt: 'no es una fecha',
      lastActivityAt: 'tampoco',
    }
    expect(Number.isFinite(rankPost(roto, NOW))).toBe(true)
  })
})

describe('compareRanked — rank DESC, id DESC', () => {
  it('ordena por rank descendente', () => {
    const entradas = [
      { id: 1, rank: 1.5 },
      { id: 2, rank: 9 },
      { id: 3, rank: 4 },
    ]
    expect([...entradas].sort(compareRanked).map((entrada) => entrada.id)).toEqual([2, 3, 1])
  })

  it('desempata por id descendente, para que el orden sea total y el keyset no repita filas', () => {
    const entradas = [
      { id: 7, rank: 2 },
      { id: 9, rank: 2 },
      { id: 8, rank: 2 },
    ]
    expect([...entradas].sort(compareRanked).map((entrada) => entrada.id)).toEqual([9, 8, 7])
  })
})
