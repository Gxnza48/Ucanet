/**
 * features/feed/ranking.ts — la fórmula de "Mis materias" (PART 12 §12.3), aislada y pura.
 *
 * POR QUÉ ESTE ARCHIVO EXISTE Y NO ES PARTE DE `queries.ts`:
 * `queries.ts` abre con `import 'server-only'`, y ese paquete TIRA una excepción apenas
 * se lo importa fuera de un entorno React Server Component — Vitest corre en `node`, así
 * que un test que importara `queries.ts` fallaría en el import, antes de la primera
 * aserción. La fórmula es la única parte del feed que se puede probar de verdad sin base
 * de datos (PART 25: Vitest cubre lógica pura), así que vive acá: CERO imports, cero
 * efectos, entrada y salida numéricas. `queries.ts` la reexporta para que el resto de la
 * aplicación la consuma desde un solo lugar.
 *
 * La fórmula, verbatim de §12.3:
 *
 *     E     = upvotes + 2 * comments_count
 *     h_eff = max( horas(t0 - last_activity_at), horas(t0 - created_at) - 48 )   -- >= 0
 *     rank  = (10 + min(E, 40)) / (h_eff + 2)^1.5
 *
 * Orden final: `rank DESC, id DESC`.
 *
 * Las constantes no son folclore; cada una sostiene una promesa que el producto publica
 * en /acerca ("Ordenamos por lo más nuevo; los votos y comentarios pueden adelantar una
 * publicación unas horas, nunca días"):
 *
 * - `+10` en el numerador: un post recién nacido sin nada de engagement vale 10/2^1.5 ≈ 3,54,
 *   por encima de casi todo lo que tenga más de unas horas. La recencia domina por diseño.
 * - `min(E, 40)`: el numerador llega como mucho a 50, o sea 5× la base. Resolviendo
 *   50/(h+2)^1.5 = 10/2^1.5 da h ≈ 3,85: NINGUNA cantidad de votos sostiene un post callado
 *   por encima de uno nuevo más de ~4 horas. Esa es la garantía anti-viralidad.
 * - `^1.5`: más empinado que lineal, más suave que cuadrático. El `+2` evita la división
 *   por cero y deja las dos primeras horas casi planas.
 * - El tope de 48 h sobre el bump: la actividad puede hacer que un post PAREZCA hasta dos
 *   días más joven, nunca más. Resucita hilos vivos sin permitir secuestrar el feed desde
 *   un hilo de 2024.
 *
 * Si la implementación deja de cumplir la frase de /acerca, la implementación está mal.
 */

/** Lo mínimo que hace falta para puntuar una fila. Cualquier objeto con esta forma sirve. */
export type RankablePost = {
  /** Upvotes cacheados (`posts.score`). */
  score: number
  /** Comentarios activos cacheados (`posts.comments_count`). */
  commentsCount: number
  /** ISO 8601 de `created_at`. */
  createdAt: string
  /** ISO 8601 de `last_activity_at` (creación, o el último comentario). */
  lastActivityAt: string
}

/** Numerador base: el piso que le garantiza el primer puesto a lo recién publicado. */
export const BASE_NUMERATOR = 10

/** Tope del término de engagement. Por encima de esto, votar de más no mueve nada. */
export const ENGAGEMENT_CAP = 40

/** Un comentario pesa el doble que un voto: responder es señal más fuerte de hilo vivo. */
export const COMMENT_WEIGHT = 2

/** La actividad puede rejuvenecer un post hasta 48 h, ni una más. */
export const BUMP_CAP_HOURS = 48

/** Piso de edad del denominador: evita la división por cero y aplana las primeras horas. */
export const AGE_FLOOR_HOURS = 2

/** Exponente de decaimiento. */
export const DECAY_EXPONENT = 1.5

const HOUR_MS = 3_600_000

function toMillis(now: Date | number): number {
  return typeof now === 'number' ? now : now.getTime()
}

/**
 * Horas transcurridas desde `iso` hasta `nowMs`. Puede dar negativo (reloj corrido, fila
 * del futuro); el recorte a cero lo hace `effectiveAgeHours`, sobre el máximo, tal como
 * dice §12.3. Una fecha inválida cuenta como cero horas: una fila con timestamp roto no
 * puede tirar abajo el render del feed.
 */
function hoursSince(iso: string, nowMs: number): number {
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return 0
  return (nowMs - then) / HOUR_MS
}

/** `E = upvotes + 2 * comments_count`, sin tope (el tope se aplica en `rankPost`). */
export function engagement(post: RankablePost): number {
  return post.score + COMMENT_WEIGHT * post.commentsCount
}

/**
 * `h_eff = max( horas desde last_activity_at, horas desde created_at - 48 )`, nunca negativo.
 *
 * Leído al derecho: la edad efectiva es la que marca la última actividad, salvo que eso
 * implique rejuvenecer el post más de 48 h respecto de su fecha real, en cuyo caso manda
 * el piso de `created_at - 48`.
 */
export function effectiveAgeHours(post: RankablePost, now: Date | number = Date.now()): number {
  const nowMs = toMillis(now)
  const sinceActivity = hoursSince(post.lastActivityAt, nowMs)
  const sinceCreation = hoursSince(post.createdAt, nowMs)
  return Math.max(0, Math.max(sinceActivity, sinceCreation - BUMP_CAP_HOURS))
}

/**
 * El rank de §12.3. Más alto es más arriba.
 *
 * `now` es el `t0` de la consulta: en una sesión de paginación se fija una sola vez y se
 * arrastra en el cursor, para que todas las páginas calculen ranks idénticos y no haya
 * filas repetidas ni agujeros entre página y página (§12.4).
 */
export function rankPost(post: RankablePost, now: Date | number = Date.now()): number {
  const cappedEngagement = Math.min(engagement(post), ENGAGEMENT_CAP)
  const hEff = effectiveAgeHours(post, now)
  return (BASE_NUMERATOR + cappedEngagement) / (hEff + AGE_FLOOR_HOURS) ** DECAY_EXPONENT
}

/**
 * Comparador del orden final: `rank DESC, id DESC` (§12.3).
 *
 * El desempate por id descendente no es decorativo: hace el orden total y determinista,
 * que es lo que permite paginar por keyset sobre el resultado puntuado sin repetir filas.
 */
export function compareRanked(
  a: { rank: number; id: number },
  b: { rank: number; id: number },
): number {
  if (a.rank !== b.rank) return b.rank - a.rank
  return b.id - a.id
}
