/**
 * app/api/health/route.ts — el endpoint de uptime (PART 24 §24.7).
 *
 * UptimeRobot le pega cada 5 minutos y le avisa al fundador por mail cuando deja de
 * responder 200. Por eso NO alcanza con devolver 200 estático: la caída que hay que
 * detectar no es la de Vercel (que se cae poco y avisa solo) sino la de Supabase, y
 * sobre todo la PAUSA del proyecto Free tras una semana sin actividad (C7, §21.5).
 * Un health check que no toca la base sería verde con la base dormida.
 *
 * Así que el chequeo es un ida y vuelta real a Postgres: `app_setting()` hace un
 * `select` de una fila sobre `app_settings`. Se llama por RPC y no con
 * `supabase.from()` por la regla 2 de `scripts/forbidden.sh` (BUILD CONTRACT §7.1),
 * que reserva el acceso directo a tablas para las capas de datos — y de paso queda
 * mejor: la función es `stable`, `security definer` y está otorgada al rol anónimo,
 * así que el monitor no necesita ninguna credencial ni sesión.
 *
 * La respuesta no dice NADA del estado interno: ni versión, ni conteos, ni el mensaje
 * de error de Postgres. Es una URL pública sin autenticación; lo único que publica es
 * si el sistema está en pie. El detalle del fallo va a los logs y a Sentry (§24.7).
 *
 * `robots.ts` bloquea `/api/` entero, así que este endpoint no entra en ningún índice.
 */
import { createClient } from '@supabase/supabase-js'

import { publicEnv } from '@/lib/env'
import type { Database } from '@/lib/types.gen'

/** Nunca cacheado: un health check cacheado miente por definición. */
export const dynamic = 'force-dynamic'

/** Si la base no contesta en este tiempo, la damos por caída. */
const TIMEOUT_MS = 8_000

/** Clave sonda. No hace falta que exista: `app_setting` devuelve null, no error. */
const PROBE_KEY = 'health'

const NO_STORE = { 'Cache-Control': 'no-store' } as const

export async function GET(): Promise<Response> {
  if (!publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('[health] falta NEXT_PUBLIC_SUPABASE_ANON_KEY')
    return Response.json({ status: 'error', db: 'error' }, { status: 503, headers: NO_STORE })
  }

  // Cliente anónimo y sin sesión: el monitor no tiene cuenta y no debe tenerla.
  // Tampoco se lee `cookies()`, que volvería dinámica la ruta por otro motivo y
  // ataría el chequeo a una sesión que en el caso real no existe.
  const supabase = createClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } },
  )

  const startedAt = Date.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const { error } = await supabase
      .rpc('app_setting', { p_key: PROBE_KEY })
      .abortSignal(controller.signal)

    if (error) {
      console.error(`[health] la base no respondió (${error.code ?? 'sin código'})`)
      return Response.json({ status: 'error', db: 'error' }, { status: 503, headers: NO_STORE })
    }

    return Response.json(
      { status: 'ok', db: 'ok', latencyMs: Date.now() - startedAt },
      { status: 200, headers: NO_STORE },
    )
  } catch {
    // Timeout, DNS, TLS: para el monitor son todos el mismo evento.
    console.error('[health] la base no respondió antes del timeout')
    return Response.json({ status: 'error', db: 'error' }, { status: 503, headers: NO_STORE })
  } finally {
    clearTimeout(timeout)
  }
}
