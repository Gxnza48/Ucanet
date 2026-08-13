import 'server-only'

/**
 * lib/supabase/cron-log.ts — el registro en `events` de los pasos del cron diario.
 *
 * Vive acá y no dentro de `app/api/cron/aggregates/route.ts` por la regla 2 de
 * `scripts/forbidden.sh` (BUILD CONTRACT §7.1): `supabase.from()` sólo puede
 * aparecer en los `queries.ts` y `actions.ts` de cada feature y en `lib/supabase`.
 * Este módulo NO monta ningún cliente: recibe el que ya armó el route handler, así
 * que no toca la service-role key ni puede ser el atajo por el que alguien la
 * consiga desde otro lado (D14.3).
 *
 * POR QUÉ NO PASA POR `track_event`: los nombres que escribe (`cron_keepalive`,
 * `cron_reconcile`, `cron_purge`) son contadores OPERATIVOS, no producto. El
 * catálogo cerrado de 14 eventos de PART 24 §24.3 no los incluye, y la migración
 * 0013 ya deja escrito que `cron_heartbeat` es de la misma familia: "queda fuera
 * del catálogo cerrado… y nunca lo escribe `track_event`, que valida su allowlist".
 *
 * POR QUÉ `count = 1` Y NO UN INCREMENTO: el cron corre una vez por día (Hobby
 * permite exactamente eso, §20.9). La fila responde "¿corrió hoy este paso y cómo
 * salió?", no "¿cuántas veces?" — y así el upsert es idempotente si alguien
 * reintenta la corrida a mano. PostgREST tampoco sabe expresar
 * `set count = count + 1`: eso lo hacen las RPC SECURITY DEFINER, no este módulo.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/types.gen'

/** Los pasos de §20.9, en el orden en que corren. */
export type CronStep = 'cron_keepalive' | 'cron_reconcile' | 'cron_purge'

/** `dim` del contador: la lista es cerrada y de cardinalidad 2, como manda §24.2. */
export type CronStepOutcome = 'ok' | 'error'

/**
 * Deja la marca del paso `(name = step, day = hoy, dim = resultado)`.
 *
 * `day` va sin valor a propósito: lo pone el default `current_date` de la tabla
 * (migración 0009), que es el mismo reloj con el que `cron_heartbeat()` escribe su
 * fila. Calcularlo acá con la zona de Buenos Aires abriría la posibilidad de que
 * dos filas de la misma corrida cayeran en días distintos.
 *
 * Nunca lanza: el registro del cron no puede ser el motivo por el que falla el cron.
 * Devuelve si pudo escribir, para que el JSON de respuesta no mienta.
 */
export async function logCronStep(
  supabase: SupabaseClient<Database>,
  step: CronStep,
  outcome: CronStepOutcome,
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('events')
      .upsert({ name: step, dim: outcome, count: 1 }, { onConflict: 'name,day,dim' })
    return !error
  } catch {
    return false
  }
}
