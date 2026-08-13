/**
 * lib/analytics.ts — la analítica entera del producto (PART 24).
 *
 * Son contadores por día en la tabla `events`: `(name, day, dim) → count`. No hay
 * cookie de seguimiento, ni script de terceros, ni beacon de pageview, ni una sola
 * fila por usuario. La tabla NO PUEDE reconstruir la conducta de nadie, y eso es el
 * objetivo de diseño (D4, §24.1). Lo que se promete en `/privacidad` es exactamente
 * lo que este archivo puede hacer, ni un evento más.
 *
 * TRES REGLAS QUE NO SE NEGOCIAN
 *
 * 1. NUNCA TIRA. Un contador roto no puede voltear una publicación, una descarga ni
 *    una página. Todo va adentro de un try/catch que se traga el error sin ruido
 *    (§24.2: "A failed track must never fail the user's action").
 *
 * 2. LISTA CERRADA. `EventName` son los 14 eventos de §24.3, literales. Agregar uno
 *    pide una línea en `docs/decisions.md`. Los nombres son en castellano porque son
 *    los mismos que se leen en `/mod/metricas`.
 *
 * 3. `dim` DE BAJA CARDINALIDAD. Nunca un id de usuario, nunca un id de materia,
 *    nunca texto libre, nunca una consulta de búsqueda. Un `dim` con cardinalidad
 *    alta convierte `events` en un registro de conducta por la puerta de atrás: es
 *    la única forma en que esta tabla puede traicionar la promesa. Por eso hay una
 *    allowlist por evento acá abajo, aunque la RPC también valide. El texto de las
 *    búsquedas tiene su propia tabla, `search_queries`, sin vínculo con la cuenta.
 *
 * SIN SESIÓN, A PROPÓSITO
 *
 * El cliente que se usa acá no lleva las cookies del request: es anónimo y no sabe
 * quién es el usuario. Dos consecuencias, ambas buscadas:
 *   - Estructuralmente imposible que la analítica se ate a una persona, ni por error
 *     ni por un cambio futuro descuidado. La promesa la sostiene el tipo del cliente,
 *     no la disciplina de quien escribe el próximo `trackEvent`.
 *   - No llama a `cookies()`, así que contar un evento no vuelve dinámica una página
 *     estática ni ISR (PART 20 §20.2). `track_event` está otorgada a `anon`
 *     justamente para esto (BUILD CONTRACT §5).
 */
import 'server-only'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { publicEnv } from '@/lib/env'
import type { Database } from '@/lib/types.gen'

/**
 * Los 14 eventos de PART 24 §24.3. Lista cerrada.
 *
 * Fuera de acá quedan los contadores OPERATIVOS que escribe la base y no esta
 * función: `cron_heartbeat` (§21.5, migración 0013) y los snapshots `wau` / `mau` /
 * `retorno_semanal` del §24.4. Nadie los llama desde la aplicación.
 */
export const EVENT_NAMES = [
  /** Onboarding terminado: el seudónimo quedó elegido. */
  'registro_completado',
  /** Un código de invitación válido se consumió en el alta. */
  'invitacion_usada',
  /** Se creó una publicación. dim: texto | pregunta. */
  'post_creado',
  /** La publicación se creó anónima (además de `post_creado`). */
  'post_anonimo',
  /** Se creó un comentario. dim: anonimo | firmado. */
  'comentario_creado',
  /** Se emitió un voto (no cuando se retira). dim: post | comentario | recurso. */
  'voto_emitido',
  /** Un recurso pasó subida y validación. dim: tipo del recurso. */
  'recurso_subido',
  /** Se emitió una URL firmada de descarga. dim: tipo del recurso. */
  'recurso_descargado',
  /** Se ejecutó una búsqueda. */
  'busqueda',
  /** La búsqueda no devolvió nada: el generador de la lista de contenido faltante. */
  'busqueda_sin_resultados',
  /** Alguien empezó a seguir una materia. */
  'materia_seguida',
  /** Se envió un reporte. dim: categoría del reporte. */
  'reporte_creado',
  /** Se completó una baja de cuenta. dim: borrar | conservar (la elección de D3). */
  'cuenta_eliminada',
  /** Usuario activo del día (§24.4: lo dispara el avance de `last_seen_day`). */
  'dau',
] as const

export type EventName = (typeof EVENT_NAMES)[number]

/** `resources.tipo`, espejo del CHECK de la migración 0007. */
const RESOURCE_TIPOS = ['resumen', 'apunte', 'parcial', 'final', 'guia', 'otro'] as const

/** `reports.categoria`, espejo del CHECK de la migración 0008. */
const REPORT_CATEGORIAS = [
  'spam',
  'acoso',
  'amenazas',
  'datos_personales',
  'ataque_persona',
  'suplantacion',
  'contenido_ilegal',
  'compraventa',
  'infraccion_autor',
  'contenido_sexual',
  'manipulacion',
  'otro',
] as const

/**
 * Valores permitidos de `dim`, por evento. Lista vacía = el evento no lleva `dim`.
 *
 * Esta tabla ES la garantía de cardinalidad acotada: 14 eventos × pocos valores ×
 * 365 días son decenas de miles de filas por año, kilobytes. Un `dim` libre serían
 * millones y un registro de conducta encubierto.
 */
const DIM_ALLOWLIST: Record<EventName, readonly string[]> = {
  registro_completado: [],
  invitacion_usada: [],
  post_creado: ['texto', 'pregunta'],
  post_anonimo: [],
  comentario_creado: ['anonimo', 'firmado'],
  voto_emitido: ['post', 'comentario', 'recurso'],
  recurso_subido: RESOURCE_TIPOS,
  recurso_descargado: RESOURCE_TIPOS,
  busqueda: [],
  busqueda_sin_resultados: [],
  materia_seguida: [],
  reporte_creado: REPORT_CATEGORIAS,
  cuenta_eliminada: ['borrar', 'conservar'],
  dau: [],
}

let anonClient: SupabaseClient<Database> | null = null

/** Cliente anónimo perezoso, sin sesión y sin cookies (ver el encabezado). */
function getAnonClient(): SupabaseClient<Database> {
  if (anonClient) return anonClient

  anonClient = createClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    },
  )

  return anonClient
}

/**
 * Devuelve el `dim` si está en la allowlist del evento, o `''`.
 *
 * Espejo exacto de la allowlist de `track_event` (migración 0011): esta tabla filtra
 * antes de salir a la red, la RPC decide. Y la RPC es estricta en los dos sentidos —
 * si el evento LLEVA `dim`, un `''` es tan inválido como un valor de más y levanta
 * INVALID_INPUT, que el catch de `trackEvent` se traga sin ruido. Traducción: en los
 * eventos con allowlist no vacía, llamar sin `dim` (o con uno que no está en la
 * lista) no cuenta el evento sin dimensión: no lo cuenta nunca. Por eso el `dim`
 * correcto es responsabilidad de quien llama, y esto es la última red.
 */
function normalizeDim(name: EventName, dim: string | undefined): string {
  if (!dim) return ''

  const allowed = DIM_ALLOWLIST[name]
  if (allowed.length === 0) return ''

  const value = dim.trim().toLowerCase()
  return allowed.includes(value) ? value : ''
}

/**
 * Incrementa el contador `(name, hoy, dim)`. No devuelve nada y no falla nunca.
 *
 * Se llama desde la Server Action que hizo la escritura de verdad, después de que
 * commiteó, o al pasar tras una lectura como `busqueda`. No se le hace `await` por
 * su resultado: no hay resultado.
 *
 * NO llamar desde una página estática o ISR: una escritura por render no dice nada
 * útil (el caché sirve la misma página muchas veces sin volver a ejecutarla) y en
 * PART 24 no existen los eventos de pageview.
 */
export async function trackEvent(name: EventName, dim?: string): Promise<void> {
  try {
    // Guarda en runtime además de la de tipos: el nombre puede venir de una variable
    // y la lista cerrada tiene que valer también ahí.
    if (!(EVENT_NAMES as readonly string[]).includes(name)) return
    if (!publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY) return

    const supabase = getAnonClient()
    await supabase.rpc('track_event', { p_name: name, p_dim: normalizeDim(name, dim) })
  } catch {
    // Regla 1: la analítica no rompe nada. Ni siquiera se loguea — este camino corre
    // en cada escritura y un error repetido llenaría los logs sin agregar información
    // que Sentry no tenga ya por el lado de la acción que sí importa.
  }
}
