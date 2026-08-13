/**
 * app/auth/signout/route.ts — cierre de sesión por POST (D7).
 *
 * Existe además de `signOutAction()` (features/auth/actions.ts) porque no toda salida ocurre
 * dentro de un componente de cliente: `/ajustes` cierra sesión con un `<form method="post">`
 * pelado, sin una sola línea de JS. Es la versión que funciona incluso si el bundle nunca cargó.
 *
 * `auth.signOut()` de supabase-js usa scope 'global' por defecto: revoca TODOS los refresh
 * tokens de la cuenta, no solo el de este navegador. Por eso el botón de `/ajustes` puede
 * prometer "en todos los dispositivos" sin mentir.
 *
 * ORIGEN: un POST entre sitios que desloguea a alguien es un CSRF menor pero gratuito de
 * evitar. Los formularios mandan siempre `Origin`, así que se compara contra el host del
 * request y contra el sitio configurado; si no coincide, 403. Sin header `Origin` se sigue
 * adelante: hay clientes que no lo mandan y bloquear ahí rompería el cierre de sesión sin
 * ganar nada (quien puede omitir el header ya no está en un navegador ajeno).
 *
 * Redirección 303: después de un POST corresponde See Other, que obliga al navegador a pedir
 * la home con GET. Con 302 algunos clientes reenvían el POST a `/`.
 */
import { revalidatePath } from 'next/cache'
import { NextResponse, type NextRequest } from 'next/server'

import { absoluteUrl, siteUrl } from '@/lib/env'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function origenPermitido(request: NextRequest): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return true

  try {
    const permitidos = new Set([request.nextUrl.host, new URL(siteUrl).host])
    return permitidos.has(new URL(origin).host)
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  if (!origenPermitido(request)) {
    return new NextResponse(null, { status: 403 })
  }

  const supabase = await createClient()
  await supabase.auth.signOut()

  // La sesión cambia el shell entero: header, avisos, botones de acción.
  revalidatePath('/', 'layout')

  return NextResponse.redirect(absoluteUrl('/'), { status: 303 })
}
