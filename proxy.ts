/**
 * proxy.ts — el middleware de Next 16 (PART 20 §20.5).
 *
 * En Next 16 el archivo raíz es `proxy.ts` con `export default function proxy(...)`;
 * `middleware.ts` quedó deprecado y ni siquiera se levanta (BUILD CONTRACT §0).
 *
 * TRES DEBERES Y NADA MÁS. Esto corre en el camino crítico de cada request de
 * página, de datos y de Server Action, así que todo lo que se agregue acá se paga
 * en TTFB y en invocaciones facturables por cada visitante:
 *
 *   1. REFRESCO DE SESIÓN — la razón por la que el middleware existe. Los Server
 *      Components no pueden escribir cookies; si nadie rota el access token acá,
 *      la sesión se cae sola a mitad de una navegación (PART 15 §15.2). Lo hace
 *      `updateSession()`, y su respuesta es la que hay que devolver: una respuesta
 *      nueva creada después pierde los `Set-Cookie` del refresco.
 *
 *   2. CORTINA DE IP — un balde de fichas en memoria de instancia (sin Redis, D6)
 *      que responde 429 a ráfagas evidentes. Es una CORTINA, no el muro: los
 *      límites de tasa reales viven dentro de las funciones SECURITY DEFINER de la
 *      base (D14.9) y siguen valiendo aunque esto se saltee o la instancia arranque
 *      en frío. Va primero porque es lo único gratis del archivo: descartar una
 *      ráfaga antes del round-trip al servidor de auth es justamente el punto.
 *
 *   3. PUERTA DE /mod — saca de `/mod/*` a quien no tiene sesión, barato y sin
 *      tocar la base. La autorización de verdad es RLS más el chequeo de rol en
 *      cada consulta de moderación, y el filtro por rol lo hace `requireMod()` en
 *      el servidor (redirige a `/` para no confirmarle a nadie que `/mod` existe).
 *      Acá no se lee el rol a propósito: exigiría un `supabase.from('profiles')`
 *      fuera de las tres capas de datos que autoriza BUILD CONTRACT §7.1, y una
 *      consulta más en el camino caliente, que es exactamente lo que §20.5 prohíbe.
 */
import { NextResponse, type NextRequest } from 'next/server'

import { shouldThrottle } from '@/lib/ip-curtain'
import { updateSession } from '@/lib/supabase/middleware'

/** Métodos que escriben. Las Server Actions son POST, así que quedan adentro. */
const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/**
 * Cookies de sesión de @supabase/ssr: `sb-<project-ref>-auth-token`, con sufijo
 * `.0`, `.1`… cuando el token viene partido por el límite de 4 KB por cookie.
 */
const SESSION_COOKIE = /^sb-.+-auth-token(\.\d+)?$/

/** Copia es-AR del 429. Corta y sin culpar a nadie: casi siempre es un script. */
const THROTTLED_BODY = 'Estás yendo demasiado rápido. Esperá un momento y probá de nuevo.\n'

export default async function proxy(request: NextRequest): Promise<NextResponse> {
  // ─── 1. Cortina de IP ────────────────────────────────────────────────────────
  const isMutation = MUTATION_METHODS.has(request.method) || request.headers.has('next-action')

  if (shouldThrottle(clientIp(request), isMutation)) {
    return new NextResponse(THROTTLED_BODY, {
      status: 429,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'retry-after': '60',
        'cache-control': 'no-store',
      },
    })
  }

  // ─── 2. Refresco de sesión ───────────────────────────────────────────────────
  const response = await updateSession(request)

  // ─── 3. Puerta de /mod ───────────────────────────────────────────────────────
  const { pathname, search } = request.nextUrl
  if (pathname === '/mod' || pathname.startsWith('/mod/')) {
    // Se mira DESPUÉS del refresco: si el token estaba vencido y no se pudo
    // renovar, `updateSession()` ya limpió las cookies del request.
    const signedIn = request.cookies.getAll().some((cookie) => SESSION_COOKIE.test(cookie.name))

    if (!signedIn) {
      const target = request.nextUrl.clone()
      target.pathname = '/ingresar'
      target.search = ''
      target.searchParams.set('next', `${pathname}${search}`)

      const redirect = NextResponse.redirect(target)

      // Las cookies del refresco viajan con el redirect: perderlas acá dejaría al
      // usuario deslogueado justo cuando lo estamos mandando a ingresar.
      for (const cookie of response.cookies.getAll()) {
        redirect.cookies.set(cookie)
      }
      // Una respuesta con Set-Cookie de sesión nunca puede quedar en un CDN.
      redirect.headers.set('cache-control', 'no-store')

      return redirect
    }
  }

  return response
}

/**
 * IP del cliente según los headers del proxy de Vercel. `NextRequest.ip` ya no
 * existe en Next 16. Sin header no se limita: un balde compartido por todos los
 * "desconocidos" castigaría gente real por una cabecera ausente (ver `lib/ip-curtain`).
 */
function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]
    if (first) return first.trim()
  }
  return request.headers.get('x-real-ip')?.trim() ?? ''
}

/**
 * El matcher es disciplina de costo (§20.5): el middleware tiene que correr solo
 * en requests de página, de datos y de acción. Quedan afuera `_next/static`,
 * `_next/image`, `favicon.ico` y cualquier asset de `public/` — se reconocen por
 * extensión, que es lo único que se puede mirar sin tocar el disco.
 */
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpe?g|gif|svg|webp|avif|ico|txt|xml|json|webmanifest|woff2?|ttf|otf|map)$).*)',
  ],
}
