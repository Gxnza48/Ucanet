/**
 * app/(public)/recursos/[publicId]/descargar/route.ts — la autorización de
 * descarga (PART 14 §14.5, §0.5-R12/R17, BUILD-CONTRACT §6).
 *
 * Los bytes NUNCA pasan por Vercel. Esta ruta hace tres cosas y responde 302:
 *
 *   1. Exige sesión. Sin sesión no descarga: manda a `/ingresar?next=…`, que es
 *      el momento de conversión más fuerte del producto (§14.5). Los metadatos
 *      del recurso son públicos e indexables; el archivo, no.
 *   2. Llama a `register_download`, la función SECURITY DEFINER que aplica el
 *      límite horario, escribe en `download_log` (efímero, 7 días, §0.5-R9),
 *      incrementa `downloads_count` una sola vez por usuario-día y devuelve las
 *      claves de objeto vivas. `storage_path` no está en ninguna vista `_public`:
 *      esta función es su única salida autorizada.
 *   3. Firma una URL de R2 de 120 s y redirige. Cloudflare sirve el archivo
 *      directo; el egreso no toca ni Vercel ni Supabase.
 *
 * `Cache-Control: private, no-store` es obligatorio: la respuesta contiene una
 * URL firmada. Si un proxy o el propio navegador la guardara, el link seguiría
 * sirviendo el archivo a cualquiera que lo pidiera de nuevo, sin pasar por el
 * límite de tasa ni por el contador.
 *
 * MÉTODO GET y no una Server Action: la descarga tiene que andar sin JavaScript
 * y ser un `<a href>` de verdad (ver `features/recursos/components/download-button.tsx`).
 * Un route handler es la única forma de emitir un 302 y de responder 429 con su
 * propio código de estado.
 *
 * SOBRE `supabase.rpc` ACÁ: BUILD-CONTRACT §7.1 encierra el acceso a datos en
 * `features/*\/queries.ts`, `features/*\/actions.ts` y `lib/supabase/*`. Ninguna
 * de las dos primeras expone hoy `register_download` (features/recursos/actions.ts
 * tiene draft, finalize, delete y voto), y la ruta no puede inventarse una
 * feature. Se llama la RPC desde acá, sin `.from()` y sin SQL, y queda reportado
 * como hueco del contrato.
 *
 * CONVENCIÓN `?archivo=N`: la fija el botón de descarga. `register_download`
 * devuelve las filas ordenadas por `position` (y sin las reemplazadas), así que
 * N es la enésima fila devuelta, empezando en 1. Sin parámetro, se sirve la
 * primera.
 */
import { after, NextResponse } from 'next/server'

import { getResourceTipo } from '@/features/recursos/queries'
import { trackEvent } from '@/lib/analytics'
import { GENERIC_ERROR, RPC_ERROR_CODES, messageForCode, type RpcErrorCode } from '@/lib/errors'
import { absoluteUrl } from '@/lib/env'
import { SIGNED_URL_TTL_SECONDS, presignGet } from '@/lib/r2'
import { createClient, getUser } from '@/lib/supabase/server'
import { isPublicId } from '@/lib/utils/public-id'

export const dynamic = 'force-dynamic'

/** Estado HTTP por código de error de la RPC. Lo que no está acá es un 500. */
const ERROR_STATUS: Partial<Record<RpcErrorCode, number>> = {
  RATE_LIMIT: 429,
  TARGET_NOT_FOUND: 404,
  NOT_AUTHENTICATED: 401,
  NOT_ONBOARDED: 403,
  RESTRICTED: 403,
  NOT_ALLOWED: 403,
  KILL_SWITCH: 503,
}

/** El límite de descargas es por hora (migración 0011): eso es lo que se sugiere esperar. */
const RATE_LIMIT_RETRY_SECONDS = 3600

type RouteContext = { params: Promise<{ publicId: string }> }

/**
 * Respuesta de error en texto plano y en es-AR. No es una página: quien llega acá
 * venía a buscar un archivo, y el navegador muestra el texto tal cual.
 */
function errorResponse(status: number, message: string, retryAfter?: number): NextResponse {
  const headers = new Headers({
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': 'noindex',
  })
  if (retryAfter !== undefined) headers.set('Retry-After', String(retryAfter))

  return new NextResponse(`${message}\n`, { status, headers })
}

/** El código estable que levantó la RPC (`raise exception 'RATE_LIMIT'`), si lo reconocemos. */
function rpcCode(message: string | undefined): RpcErrorCode | null {
  const token = (message ?? '').trim().split(/[\s:]+/)[0] ?? ''
  return (RPC_ERROR_CODES as readonly string[]).includes(token) ? (token as RpcErrorCode) : null
}

export async function GET(request: Request, { params }: RouteContext): Promise<NextResponse> {
  const { publicId } = await params

  // Guarda de forma: descarta basura antes de tocar la base (D14.7).
  if (!isPublicId(publicId)) {
    return errorResponse(404, 'No encontramos ese recurso.')
  }

  const user = await getUser()
  if (!user) {
    // Los metadatos son públicos; los bytes no (§14.5). Se vuelve a la ficha
    // después de ingresar, no a esta ruta: nadie quiere aterrizar en un 302.
    const next = encodeURIComponent(`/recursos/${publicId}`)
    return NextResponse.redirect(absoluteUrl(`/ingresar?next=${next}`), {
      status: 302,
      headers: { 'Cache-Control': 'private, no-store' },
    })
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('register_download', {
    p_resource_public_id: publicId,
  })

  if (error) {
    const code = rpcCode(error.message)
    const status = (code && ERROR_STATUS[code]) || 500

    if (code === 'RATE_LIMIT') {
      return errorResponse(
        429,
        'Estás descargando muy seguido. Esperá un rato y volvé a intentar.',
        RATE_LIMIT_RETRY_SECONDS,
      )
    }

    return errorResponse(status, code ? messageForCode(code) : GENERIC_ERROR)
  }

  const files = data ?? []
  const requested = new URL(request.url).searchParams.get('archivo')
  const index = requested === null ? 0 : Number.parseInt(requested, 10) - 1
  const file = Number.isInteger(index) && index >= 0 ? files[index] : undefined

  if (!file) {
    return errorResponse(404, 'Ese archivo ya no está disponible.')
  }

  // 120 s: alcanza para cualquier cadena de redirecciones y se muere antes de
  // que una URL compartida llegue a otro lado (§0.5-R12).
  const signedUrl = await presignGet(file.storage_path, file.original_name, SIGNED_URL_TTL_SECONDS)

  // Después de responder: una métrica no puede demorar una descarga (PART 24).
  //
  // El `dim` NO es opcional acá: `track_event` exige para `recurso_descargado` un
  // tipo de recurso ('resumen','apunte','parcial','final','guia','otro') y sin él
  // levanta INVALID_INPUT, que `trackEvent` se traga en silencio — así es como la
  // métrica de descargas de /mod/metricas venía siendo cero permanente.
  //
  // `register_download` devuelve storage_path/original_name/mime/size_bytes y no el
  // tipo, así que cuesta una consulta más: un select de una sola columna sobre
  // `resources_public` por `public_id` (índice único). Corre dentro de `after()`, o
  // sea después del 302: no le agrega latencia a la descarga. Si el recurso
  // desapareció entre medio, no se cuenta nada — un evento sin dim la RPC lo
  // rechazaría igual.
  after(async () => {
    const tipo = await getResourceTipo(publicId)
    if (tipo) await trackEvent('recurso_descargado', tipo)
  })

  return new NextResponse(null, {
    status: 302,
    headers: {
      Location: signedUrl,
      // La respuesta lleva una URL firmada: nadie la guarda, ni el navegador ni
      // un proxy intermedio.
      'Cache-Control': 'private, no-store, max-age=0',
      // Que R2 no reciba de dónde salió el pedido.
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex',
    },
  })
}
