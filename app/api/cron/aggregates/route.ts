/**
 * app/api/cron/aggregates/route.ts — EL cron. Uno solo, diario (§0.5-R16, §20.9).
 *
 * Vercel Hobby permite como máximo una corrida por día y la dispara con ±59 min de
 * jitter, así que todo lo programado del producto entra por acá: no hay un segundo
 * cron al que mandar nada. `vercel.json` lo agenda a las 07:00 UTC (madrugada en
 * Rosario). Los backups son la otra pata y viven en GitHub Actions, semanales.
 *
 * TRES PASOS, EN ORDEN, Y NINGUNO PUEDE VOLTEAR A LOS SIGUIENTES:
 *
 *   1. Keepalive (§21.5) — un SELECT real contra una tabla real (`app_setting`, que
 *      lee `app_settings`) más la fila de heartbeat que escribe `cron_heartbeat()`.
 *      El proyecto Supabase Free se pausa tras ~una semana sin actividad, y la
 *      ventana peligrosa es enero-febrero, cuando no hay estudiantes (C7, C14).
 *      Va primero a propósito: es el paso que no puede dejar de correr, y si algo
 *      más adelante explota, la evidencia de actividad ya quedó escrita.
 *   2. `reconcile_counters()` — recuento nocturno de score / comments_count /
 *      downloads_count, recompute uniforme de karma (§0.5-R7: el karma del contenido
 *      anónimo entra en el total sin quedar correlacionable en el tiempo, C5) y
 *      re-derivación de `profiles.status` cuando vence una suspensión.
 *   3. `purge_retention()` — la matriz de retención de §8.7. `events` no se purga
 *      nunca (§0.5-R11).
 *
 * Cada paso corre en su propio try/catch y su resultado queda en `events` con
 * `dim = 'ok' | 'error'`. Un paso que falla no aborta los que siguen: si el
 * recuento de contadores se cae, la purga de retención igual tiene que correr, y al
 * revés. El endpoint devuelve 200 con el detalle por paso incluso si alguno falló —
 * el estado se lee en el JSON y en `/mod/metricas`, no en el código HTTP, porque un
 * 500 haría que Vercel reintente una corrida que ya hizo la mitad del trabajo.
 *
 * ES EL ÚNICO ARCHIVO DE LA APLICACIÓN QUE PUEDE USAR `createAdminClient()`
 * (D14.3, BUILD CONTRACT §7.4). Las tres funciones de la migración 0013 tienen
 * EXECUTE revocado a `anon` y `authenticated` y otorgado sólo a `service_role`:
 * tocan filas de todos los usuarios y no hay ningún `auth.uid()` con el que
 * autorizarlas. `scripts/forbidden.sh` (regla 1) rompe el build si la service-role
 * aparece en cualquier otro módulo alcanzable desde un request.
 */
import { timingSafeEqual } from 'node:crypto'

import { getCronSecret } from '@/lib/env.server'
import { logCronStep, type CronStep } from '@/lib/supabase/cron-log'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/lib/types.gen'

/** Nunca cacheado ni prerenderizado: es un trabajo, no una página. */
export const dynamic = 'force-dynamic'

/** Techo de Vercel Hobby. El recuento nocturno sube su propio statement_timeout a 120 s. */
export const maxDuration = 60

/** Clave que el keepalive lee. No hace falta que exista: `app_setting` devuelve null. */
const KEEPALIVE_SETTING_KEY = 'cron_keepalive'

type StepReport = {
  ok: boolean
  /** El jsonb que devolvió la función, cuando salió bien. */
  result?: Json
  /** Código de error de Postgres o mensaje corto. Nunca el detalle crudo. */
  error?: string
  /** Si se pudo dejar la marca del paso en `events`. */
  logged: boolean
}

/**
 * Compara el token del header contra el secreto sin filtrar información por tiempo.
 * Con longitudes distintas devuelve false antes de comparar: `timingSafeEqual`
 * lanza si los buffers no miden lo mismo, y esa excepción sería el canal lateral
 * que la función viene a cerrar.
 */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/** Respuesta sin cuerpo útil: al que no trae el secreto no se le cuenta nada. */
function unauthorized(): Response {
  return Response.json(
    { error: 'No autorizado.' },
    { status: 401, headers: { 'Cache-Control': 'no-store' } },
  )
}

export async function GET(request: Request): Promise<Response> {
  let secret: string
  try {
    secret = getCronSecret()
  } catch {
    // Falta CRON_SECRET en el entorno. Se responde 401 igual que a un intruso: un
    // 500 con detalle le contaría a cualquiera que el endpoint existe y está mal
    // configurado. El deploy roto se ve en los logs, no en la respuesta.
    console.error('[cron/aggregates] falta CRON_SECRET en el entorno')
    return unauthorized()
  }

  const header = request.headers.get('authorization') ?? ''
  const [scheme, token] = header.split(' ')
  if (scheme !== 'Bearer' || !token || !secretMatches(token, secret)) {
    return unauthorized()
  }

  const startedAt = Date.now()
  const supabase = createAdminClient()

  // ---------------------------------------------------------------------------
  // 1. Keepalive: un SELECT real + la fila de heartbeat (§21.5)
  // ---------------------------------------------------------------------------
  const keepalive = await runStep(supabase, 'cron_keepalive', async () => {
    // El SELECT real: `app_setting` lee `app_settings` y devuelve null si la clave
    // no existe. Lo que importa es que haya ido y vuelto de Postgres — eso es lo
    // que Supabase cuenta como actividad del proyecto.
    const probe = await supabase.rpc('app_setting', { p_key: KEEPALIVE_SETTING_KEY })
    if (probe.error) throw probe.error

    const heartbeat = await supabase.rpc('cron_heartbeat')
    if (heartbeat.error) throw heartbeat.error

    return heartbeat.data
  })

  // ---------------------------------------------------------------------------
  // 2. Recuento nocturno (§8.5.6)
  // ---------------------------------------------------------------------------
  const reconcile = await runStep(supabase, 'cron_reconcile', async () => {
    const { data, error } = await supabase.rpc('reconcile_counters')
    if (error) throw error
    return data
  })

  // ---------------------------------------------------------------------------
  // 3. Purga de retención (§8.7, §0.5-R11)
  // ---------------------------------------------------------------------------
  const purge = await runStep(supabase, 'cron_purge', async () => {
    const { data, error } = await supabase.rpc('purge_retention')
    if (error) throw error
    return data
  })

  const steps = { keepalive, reconcile, purge }
  const ok = keepalive.ok && reconcile.ok && purge.ok

  // Log estructurado de §24.7: una línea JSON por corrida. Sin ids de usuario, sin
  // cuerpos de contenido — sólo conteos, que es todo lo que devuelven las RPC.
  const summary = {
    ts: new Date().toISOString(),
    action: 'cron/aggregates',
    outcome: ok ? 'ok' : 'partial',
    duration_ms: Date.now() - startedAt,
    steps,
  }
  if (ok) console.info(JSON.stringify(summary))
  else console.error(JSON.stringify(summary))

  // 200 aun con pasos caídos: ver el encabezado. El detalle viaja en el cuerpo.
  return Response.json(
    { ok, ranAt: summary.ts, durationMs: summary.duration_ms, steps },
    { status: 200, headers: { 'Cache-Control': 'no-store' } },
  )
}

/**
 * Corre un paso, lo registra en `events` y devuelve su parte del informe.
 *
 * El registro se hace pase lo que pase, incluso cuando el paso falló: una fila
 * `(cron_purge, hoy, 'error')` en `/mod/metricas` es exactamente la señal que hace
 * falta el viernes en la revisión semanal (§24.8). Si ni siquiera se puede escribir
 * esa marca, queda `logged: false` en la respuesta y no se insiste: el paso
 * siguiente vale más que el registro del anterior.
 */
async function runStep(
  supabase: ReturnType<typeof createAdminClient>,
  step: CronStep,
  run: () => Promise<Json>,
): Promise<StepReport> {
  try {
    const result = await run()
    const logged = await logCronStep(supabase, step, 'ok')
    return { ok: true, result, logged }
  } catch (error) {
    const code =
      error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
        ? error.code
        : 'unknown'
    console.error(`[cron/aggregates] ${step} falló (${code})`)
    const logged = await logCronStep(supabase, step, 'error')
    return { ok: false, error: code, logged }
  }
}
