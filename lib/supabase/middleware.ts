/**
 * lib/supabase/middleware.ts — el refresco de sesión que corre antes de todo.
 *
 * Lo llama `proxy.ts` (Next 16 reemplazó `middleware.ts` en la raíz por `proxy.ts`,
 * BUILD CONTRACT §0). Es el único lugar del sistema donde se puede escribir la
 * cookie de sesión con garantía: los Server Components NO pueden escribir cookies,
 * así que si el access token vence durante una navegación y nadie lo refresca acá,
 * el usuario se desloguea solo. Ese es el bug clásico de @supabase/ssr y este
 * archivo existe para no tenerlo (PART 15 §15.2).
 *
 * El baile de las cookies es exactamente el que documenta @supabase/ssr y no
 * admite atajos:
 *
 *   1. Se crea una respuesta de paso (`NextResponse.next`) llevando el request.
 *   2. `getAll` lee las cookies del REQUEST (lo que el navegador mandó).
 *   3. Si hay refresco, `setAll` las escribe en DOS lados: en el request (para que
 *      el render de esta misma navegación ya vea el token nuevo) y en la RESPUESTA
 *      (para que el navegador se lo guarde).
 *   4. `supabase.auth.getUser()` fuerza el refresco. Sin esta llamada el cliente es
 *      perezoso (`skipAutoInitialize`) y nunca toca la sesión: el paso entero sería
 *      decorativo.
 *   5. Se devuelve esa respuesta, con sus `Set-Cookie` intactos.
 *
 * En @supabase/ssr 0.12 `setAll` recibe un SEGUNDO argumento con headers de
 * no-cachear (`Cache-Control: private, no-cache, no-store…`). Hay que copiarlos:
 * una respuesta con `Set-Cookie` de sesión cacheada por el CDN de Vercel le sirve
 * el token de una persona a otra. Es la falla más grave que este archivo puede
 * tener, así que los headers se aplican siempre que se escriben cookies.
 *
 * ADEMÁS este paso publica el pathname en un header de request (`x-pathname`),
 * porque Next no expone la ruta actual a los Server Components y `requireUser()`
 * lo necesita para armar `/ingresar?next=<destino>`. Ver `lib/supabase/server.ts`.
 */
import 'server-only'

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { publicEnv } from '@/lib/env'
import type { Database } from '@/lib/types.gen'

/**
 * Header donde este paso deja el pathname (+ query) del request.
 *
 * Existe porque `headers()` de Next no incluye la ruta en una navegación dura, y
 * sin la ruta no hay forma de que un guard de servidor arme el `?next=` que
 * devuelve al usuario adonde iba después de ingresar. Lo lee
 * `lib/supabase/server.ts`; si `proxy.ts` no corrió para esa ruta, el header no
 * está y los guards redirigen sin `?next=` — degradación, no error.
 */
export const PATHNAME_HEADER = 'x-pathname'

/** Clona los headers del request agregando el pathname actual. */
function headersWithPathname(request: NextRequest): Headers {
  const headers = new Headers(request.headers)
  headers.set(PATHNAME_HEADER, `${request.nextUrl.pathname}${request.nextUrl.search}`)
  return headers
}

/**
 * Refresca el token de sesión y devuelve la respuesta con las cookies al día.
 *
 * `proxy.ts` tiene que devolver ESTA respuesta (o copiarle las cookies a la suya):
 * una respuesta nueva creada después pierde los `Set-Cookie` del refresco y el
 * usuario vuelve a quedar deslogueado en la navegación siguiente.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request: { headers: headersWithPathname(request) } })

  // Sin credenciales no hay sesión que refrescar. Se deja pasar en silencio a
  // propósito: el proxy corre en TODAS las rutas y hacerlo explotar acá dejaría
  // el sitio entero en 500 sin siquiera renderizar la página de error. El grito
  // fuerte lo da `assertSupabaseEnv()` en el primer cliente de servidor real.
  if (!publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return response
  }

  const supabase = createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          // 1. En el request: el render de esta misma navegación ve el token nuevo.
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }

          // 2. Respuesta nueva sobre el request YA actualizado (`request.cookies.set`
          //    reescribe el header `cookie`, así que el clon de headers lo lleva).
          response = NextResponse.next({ request: { headers: headersWithPathname(request) } })

          // 3. En la respuesta: el navegador se guarda el token nuevo.
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }

          // 4. Anti-caché. Una respuesta con Set-Cookie de sesión NUNCA puede
          //    quedar en un CDN: sería servirle la sesión de alguien a otra persona.
          for (const [key, value] of Object.entries(headers)) {
            response.headers.set(key, value)
          }
        },
      },
    },
  )

  // Dispara el refresco. Es `getUser()` y no `getSession()` a propósito: valida el
  // JWT contra el servidor de auth en lugar de confiar en lo que trae la cookie.
  // El resultado se descarta: el efecto que importa son las cookies escritas.
  // Si Supabase está caído o la red falla, seguimos con la sesión vieja en vez de
  // tirar abajo la navegación — el error real reaparece en la página.
  try {
    await supabase.auth.getUser()
  } catch {
    // Sin telemetría acá: este camino corre en cada request y un log por request
    // se come la cuota de Vercel sin decir nada nuevo.
  }

  return response
}
