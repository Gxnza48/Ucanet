/**
 * app/auth/callback/route.ts — el canje del link del correo por una sesión (D7, PART 9 §9.2).
 *
 * Es el `redirectTo` de las tres cosas que Supabase manda por mail: la confirmación del alta
 * (`signUp`), el link de recuperación (`requestPasswordReset`) y, el día que exista, el cambio
 * de correo. Un solo endpoint para las tres porque el trabajo es el mismo: canjear lo que vino
 * en la URL, dejar la cookie de sesión escrita y mandar a la persona adonde iba.
 *
 * Soporta las DOS formas que emite Supabase, porque cuál llega depende de la plantilla del
 * correo y del flujo configurado en el proyecto:
 *
 *   ?code=<uuid>                    flujo PKCE → `exchangeCodeForSession`
 *   ?token_hash=<hash>&type=<tipo>  link de OTP por correo → `verifyOtp`
 *
 * Soportar solo una es la forma más común de que "el link del mail no hace nada": la plantilla
 * por defecto de Supabase usa `{{ .ConfirmationURL }}` (PKCE) pero cualquier plantilla editada
 * a mano suele quedar con `token_hash`, y el síntoma es idéntico en las dos direcciones.
 *
 * ESCRITURA DE COOKIES: un route handler SÍ puede escribir cookies, así que el `setAll` de
 * `lib/supabase/server.ts` funciona de verdad acá y la sesión queda persistida. Ese es el
 * motivo de que el canje viva en una ruta y no en un Server Component.
 *
 * El destino se sanea siempre: `?next=` viene de una URL, y una redirección a `//otro-sitio`
 * con nuestro dominio adelante es phishing con la marca puesta. Solo rutas internas de una
 * sola barra; cualquier otra cosa cae en la home. La base absoluta sale de
 * `NEXT_PUBLIC_SITE_URL` (lib/env) y no del header Host, que lo controla quien hace el pedido.
 */
import type { EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

import { absoluteUrl } from '@/lib/env'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/** Tipos de OTP por correo que acepta `verifyOtp`. Cualquier otro valor se ignora. */
const OTP_TYPES: readonly EmailOtpType[] = [
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
] as const

/** Adonde va una sesión de recuperación, pase lo que pase con `?next=`. */
const RECOVERY_PATH = '/recuperar/nueva'

/** `/ingresar` con el aviso de link vencido: el único borde visible de este endpoint. */
const ERROR_PATH = '/ingresar?error=link'

function esOtpType(valor: string | null): valor is EmailOtpType {
  return valor !== null && (OTP_TYPES as readonly string[]).includes(valor)
}

/** Ruta interna de una sola barra, o la home. Mismo criterio que `requireUser()`. */
function destinoSeguro(valor: string | null): string {
  return valor !== null && /^\/[^/\\]/.test(valor) ? valor : '/'
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  // Supabase puede rebotar el error en la propia URL (link vencido, ya usado, revocado).
  if (params.get('error') ?? params.get('error_code')) {
    return NextResponse.redirect(absoluteUrl(ERROR_PATH))
  }

  const code = params.get('code')
  const tokenHash = params.get('token_hash')
  const tipo = params.get('type')

  let destino = destinoSeguro(params.get('next'))

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) return NextResponse.redirect(absoluteUrl(ERROR_PATH))
  } else if (tokenHash && esOtpType(tipo)) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type: tipo, token_hash: tokenHash })
    if (error) return NextResponse.redirect(absoluteUrl(ERROR_PATH))

    // Una sesión de recuperación existe para una sola cosa. Mandarla al feed dejaría a la
    // persona adentro sin haber elegido contraseña nueva, que es justo lo que vino a hacer.
    if (tipo === 'recovery') destino = RECOVERY_PATH
  } else {
    // Sin código y sin token no hay nada que canjear: alguien abrió la URL a mano.
    return NextResponse.redirect(absoluteUrl(ERROR_PATH))
  }

  return NextResponse.redirect(absoluteUrl(destino))
}
