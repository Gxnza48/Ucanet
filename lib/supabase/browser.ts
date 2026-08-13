/**
 * lib/supabase/browser.ts — el cliente de Supabase del navegador.
 *
 * Lo usan MUY pocos archivos. La lista de componentes cliente es cerrada (PART 19
 * §19.3) y casi ninguno habla con la base: escribir es siempre una Server Action,
 * que valida con Zod y llama UNA RPC (BUILD CONTRACT §4.6). Este cliente existe
 * para lo que necesita el navegador de verdad:
 *
 *   - el typeahead de búsqueda, que llama `search_catalog` mientras se tipea sin
 *     pagar un round-trip de Server Action por tecla;
 *   - el flujo de recuperación de contraseña, donde el token llega en el fragmento
 *     `#` de la URL y el servidor no lo ve nunca.
 *
 * Lleva la anon key, que es pública por diseño: viaja en el bundle de todos los
 * visitantes y la seguridad la pone RLS, no la clave (D5). Cualquier cosa que
 * requiera privilegio pasa por una RPC SECURITY DEFINER que revalida `auth.uid()`.
 *
 * `createBrowserClient` es singleton por defecto: llamar `createClient()` en varios
 * componentes devuelve la MISMA instancia, con un solo listener de auth y una sola
 * lectura de cookies. Por eso no hace falta memorizarlo del lado de la app.
 */
import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

import { assertSupabaseEnv, publicEnv } from '@/lib/env'
import type { Database } from '@/lib/types.gen'

/**
 * Cliente de Supabase para código que corre en el navegador.
 *
 * Sin adaptador de cookies propio: en el navegador la librería usa
 * `document.cookie`, que es el mismo almacén que escribe `@supabase/ssr` del lado
 * del servidor. Es lo que mantiene una sola sesión entre SSR y cliente.
 */
export function createClient(): SupabaseClient<Database> {
  assertSupabaseEnv()

  return createBrowserClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )
}
