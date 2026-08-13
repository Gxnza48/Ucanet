/**
 * lib/ip-curtain.ts — la cortina, no el muro (PART 20 §20.5, D14.9).
 *
 * ESTO NO ES EL LÍMITE DE TASA DEL PRODUCTO. Los límites reales viven dentro de
 * las funciones SECURITY DEFINER de la base (`rate_limits()`, PART 8 §8.1 y
 * PART 11 §11.6): valen aunque alguien saltee `proxy.ts` y le pegue a PostgREST
 * con una sesión robada. Esto de acá solo tira al piso ráfagas obvias antes de
 * que consuman invocaciones de función.
 *
 * Es porosa por diseño y así se documenta:
 *
 * - El estado vive en memoria de la instancia. Vercel corre varias instancias y
 *   las recicla: cada arranque en frío regala un balde nuevo. Sin Redis (D6 lo
 *   rechazó explícitamente); pagar por precisión acá sería pagar por una segunda
 *   copia peor del límite que la base ya aplica bien.
 * - Una IP no es una persona. En la sede de UCA cientos de estudiantes salen por
 *   el mismo NAT. Por eso el presupuesto de lectura es holgado y solo las
 *   mutaciones tienen el límite ajustado de 60/min que fija PART 20 §20.5.
 * - Ante la duda, deja pasar. Un abuso que se cuela lo frena la base; un usuario
 *   legítimo bloqueado acá no tiene a quién apelar.
 */

/** Mutaciones: 60 por minuto por IP — el número vinculante de PART 20 §20.5. */
const MUTATION_LIMIT = 60

/** Lecturas: presupuesto amplio, solo para inundaciones evidentes (ver NAT arriba). */
const READ_LIMIT = 600

/** Ventana de recarga del balde. */
const WINDOW_MS = 60_000

/** Tope de baldes vivos: la memoria de la instancia no es un almacén. */
const MAX_BUCKETS = 5_000

/** Un balde que ya se recargó del todo y hace rato que nadie toca es descartable. */
const IDLE_MS = 5 * WINDOW_MS

type Bucket = {
  /** Fichas disponibles; se recargan de forma continua, no por ventana fija. */
  tokens: number
  /** Último momento en que se recalculó el balde. */
  updatedAt: number
}

const buckets = new Map<string, Bucket>()

/**
 * ¿Hay que responder 429 a este request?
 *
 * @param ip IP del cliente (de `x-forwarded-for`, ya normalizada por `proxy.ts`).
 *           Vacía o desconocida: no se limita — un balde compartido por todos los
 *           "desconocidos" castigaría a usuarios reales por un header ausente.
 * @param isMutation true en POST/PUT/PATCH/DELETE y en llamadas a Server Actions.
 */
export function shouldThrottle(ip: string, isMutation: boolean): boolean {
  const client = ip.trim()
  if (!client) return false

  const limit = isMutation ? MUTATION_LIMIT : READ_LIMIT
  const key = `${isMutation ? 'm' : 'r'}:${client}`
  const now = Date.now()

  const bucket = buckets.get(key)
  if (!bucket) {
    if (buckets.size >= MAX_BUCKETS) sweep(now)
    buckets.set(key, { tokens: limit - 1, updatedAt: now })
    return false
  }

  // Recarga continua: `limit` fichas por ventana, prorrateadas al tiempo pasado.
  const refill = ((now - bucket.updatedAt) * limit) / WINDOW_MS
  const tokens = Math.min(limit, bucket.tokens + refill)
  bucket.updatedAt = now

  if (tokens < 1) {
    bucket.tokens = tokens
    return true
  }

  bucket.tokens = tokens - 1
  return false
}

/**
 * Descarta los baldes ociosos y ya recargados. Si aun así no baja del tope, se
 * vacía todo: perder el estado significa, como mucho, un minuto de cortina
 * abierta, y eso es preferible a que la instancia crezca sin techo.
 */
function sweep(now: number): void {
  for (const [key, bucket] of buckets) {
    if (now - bucket.updatedAt > IDLE_MS) buckets.delete(key)
  }
  if (buckets.size >= MAX_BUCKETS) buckets.clear()
}
