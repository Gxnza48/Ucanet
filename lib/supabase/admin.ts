/**
 * =============================================================================
 *  SOLO app/api/cron/*.  NADA MÁS PUEDE IMPORTAR ESTE ARCHIVO.
 * =============================================================================
 *
 * Este cliente lleva la SERVICE ROLE KEY y por lo tanto SALTEA ROW LEVEL SECURITY
 * POR COMPLETO. Con él, `select * from posts` devuelve el `author_id` de cada
 * publicación anónima: es literalmente la llave que rompe la promesa central del
 * producto (D3, D5).
 *
 * La regla es de una línea y no tiene excepciones (D14.3, BUILD CONTRACT §7.4):
 *
 *     si el código es alcanzable desde un request de usuario, no puede importar
 *     este módulo.
 *
 * Alcanzable = páginas, layouts, Server Actions, features, componentes, cualquier
 * route handler que no sea `app/api/cron/*`. Los cron corren con el `CRON_SECRET`
 * de Vercel en el header, sin sesión de usuario y sin input del usuario: por eso
 * son el único lugar donde un cliente sin RLS no tiene con qué ser abusado.
 * `scripts/` también puede usar la clave, pero por su propia vía: los scripts no
 * son parte del bundle de la app.
 *
 * Esto no es una convención de estilo. `scripts/forbidden.sh` (regla 1) rompe el
 * build si `createAdminClient`, `getServiceRoleKey` o el string `supabase/admin`
 * aparecen fuera de `app/api/cron/`, de este archivo y de `lib/env.server.ts`.
 *
 * Qué hacen los cron con esto, y por qué necesitan saltear RLS: `reconcile_counters`
 * y `purge_retention` (migración 0013) tocan filas de todos los usuarios y no hay
 * ningún `auth.uid()` con el que autorizarlas. `cron_heartbeat` mantiene despierto
 * el proyecto Free (§21.5). Nada de eso tiene dueño.
 */
import 'server-only'

import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'

import { publicEnv } from '@/lib/env'
import { getServiceRoleKey } from '@/lib/env.server'
import type { Database } from '@/lib/types.gen'

/**
 * Cliente con service role. Leé el encabezado entero antes de usarlo.
 *
 * `autoRefreshToken: false` y `persistSession: false` porque la service role no es
 * una sesión: es una clave estática que no vence, y un timer de refresco en un
 * runtime serverless sería un handle colgado que mantiene viva la invocación.
 * `detectSessionInUrl: false` por lo mismo — no hay URL ni navegador acá.
 *
 * Uno nuevo por invocación: un singleton a nivel de módulo en un runtime que se
 * reusa entre requests es exactamente cómo un cliente sin RLS termina sobreviviendo
 * más allá del cron que lo pidió.
 */
export function createAdminClient(): SupabaseClient<Database> {
  return createSupabaseClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, getServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      // Marca en los logs de Supabase. Si aparece tráfico con este cliente fuera de
      // la ventana del cron, es un incidente: alguien lo importó donde no va.
      headers: { 'x-client-info': 'ucanet-cron' },
    },
  })
}
