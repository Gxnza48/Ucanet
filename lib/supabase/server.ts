/**
 * lib/supabase/server.ts — el cliente de servidor y los cuatro guards de sesión.
 *
 * Todo lo que lee o escribe la base desde el servidor (Server Components, Server
 * Actions, route handlers) sale de acá. El cliente lleva SOLO la anon key: la
 * seguridad es RLS, no la clave (D5). La service-role vive en `admin.ts` y no la
 * toca nada que un request pueda alcanzar (D14.3).
 *
 * COOKIES (BUILD CONTRACT §0, @supabase/ssr 0.12): el adaptador es `getAll`/`setAll`.
 * El viejo `get`/`set`/`remove` ya no existe en la librería. `setAll` va envuelto en
 * try/catch porque un Server Component NO puede escribir cookies: cuando el token
 * se refresca durante un render, la escritura falla y hay que ignorarla — el
 * refresco de verdad lo hace `proxy.ts` vía `lib/supabase/middleware.ts`, que sí
 * puede escribirlas. Sin ese try/catch, cada render con token vencido sería un 500.
 *
 * DEDUPLICACIÓN: `getUser()` no lee una cookie, le pega al servidor de auth para
 * validar el JWT. Un layout, una página y una acción del mismo request pedirían lo
 * mismo tres veces. Por eso la resolución va detrás de `cache()` de React, que
 * memoriza por request. Consecuencia a tener presente: si dentro del MISMO request
 * se cambia la sesión (`signInWithPassword`, `signOut`), lo que devuelvan estas
 * funciones después es el estado ANTERIOR. Las acciones de auth de PART 15
 * redirigen inmediatamente después de mutar, así que el caso no aparece; si alguna
 * dejara de redirigir, tiene que releer con su propio `createClient()`.
 */
import 'server-only'

import { createServerClient } from '@supabase/ssr'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'

import { assertSupabaseEnv, publicEnv } from '@/lib/env'
import { PATHNAME_HEADER } from '@/lib/supabase/middleware'
import type { Database } from '@/lib/types.gen'

/** La fila propia de `profiles`. Es el tipo que devuelven los tres `require*`. */
export type ProfileRow = Database['public']['Tables']['profiles']['Row']

/**
 * Columnas de `profiles`, enumeradas.
 *
 * Nunca `select('*')` sobre una tabla base (D14.5, BUILD CONTRACT §7.2): el
 * asterisco arrastra lo que se agregue mañana sin que nadie lo revise. Acá el
 * riesgo es bajo —es la fila propia, la lee la política `profiles_select_self`—
 * pero la regla no tiene excepciones cómodas. La lista espeja exactamente
 * `ProfileRow`: si la migración agrega una columna, TypeScript rompe acá.
 */
const PROFILE_COLUMNS =
  'id, handle, handle_changed_at, carrera_id, ingreso_year, karma, last_seen_day, notif_respuestas, role, status, invited_with, created_at, updated_at' as const

/** Rutas de auth: nunca son un destino válido para `?next=`. */
const AUTH_PATHS = ['/ingresar', '/registro', '/recuperar', '/invitacion', '/auth'] as const

/** Ruta de ingreso (D7: el mapa de URLs es una promesa de diez años). */
const SIGN_IN_PATH = '/ingresar'

/** Ruta de onboarding: donde termina toda cuenta con `status = 'nuevo'`. */
const ONBOARDING_PATH = '/registro/continuar'

/**
 * Crea un cliente de Supabase atado a las cookies de este request.
 *
 * Uno nuevo por llamada, a propósito: el cliente encapsula la sesión del request
 * y compartirlo entre requests es la forma más directa de servirle la sesión de
 * una persona a otra.
 */
export async function createClient(): Promise<SupabaseClient<Database>> {
  assertSupabaseEnv()

  const store = await cookies()

  return createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return store.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              store.set(name, value, options)
            }
          } catch {
            // Server Component: las cookies son de solo lectura. Es esperable y no
            // se pierde nada — `updateSession()` en el proxy ya refrescó el token
            // para esta navegación y volverá a hacerlo en la próxima.
          }
        },
      },
    },
  )
}

/** Resolución de usuario, memorizada por request (ver el encabezado). */
const resolveUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error) return null
  return data.user
})

/**
 * El usuario autenticado, o null.
 *
 * `auth.getUser()` y no `auth.getSession()`: getSession confía en la cookie, que
 * el cliente controla. Todo guard de servidor tiene que validar contra el servidor
 * de auth (D14.5: nunca se le cree al cliente).
 */
export async function getUser(): Promise<User | null> {
  return resolveUser()
}

/** Resolución de perfil, memorizada por request. */
const resolveProfile = cache(async (): Promise<ProfileRow | null> => {
  const user = await resolveUser()
  if (!user) return null

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', user.id)
    .maybeSingle()

  if (error || !data) return null
  return data
})

/**
 * La fila propia de `profiles`, o null si no hay sesión.
 *
 * Pasa por la política RLS `profiles_select_self` (migración 0004), la única
 * política de lectura de la tabla: nadie ve el perfil de nadie más por acá. Los
 * perfiles ajenos se leen por la vista `profiles_public`.
 *
 * Devuelve null también cuando hay sesión pero la fila no existe todavía: el
 * trigger `handle_new_user` la crea en el alta, así que ese hueco es un alta a
 * medio terminar, no un usuario sin perfil.
 */
export async function getProfile(): Promise<ProfileRow | null> {
  return resolveProfile()
}

/**
 * Exige sesión. Sin sesión redirige a `/ingresar?next=<destino>`.
 *
 * El `?next=` se arma con el pathname que publicó `updateSession()`. Si el header
 * no está (el proxy no corrió para esa ruta), se redirige pelado: perder el
 * destino es molesto, inventarlo sería un redirect abierto.
 */
export async function requireUser(): Promise<User> {
  const user = await resolveUser()
  if (user) return user
  redirect(await signInHref())
}

/**
 * Exige una cuenta con onboarding terminado.
 *
 * Sin sesión → `/ingresar`. Con sesión pero `status = 'nuevo'` (o sin fila de
 * perfil, que es el mismo estado visto desde otro ángulo) → `/registro/continuar`,
 * que es la pantalla donde se elige el seudónimo.
 *
 * NO redirige por `suspendido`, `baneado` ni `eliminado`: esas cuentas siguen
 * pudiendo leer, ver sus avisos y apelar (PART 11 §11.8). El bloqueo de escritura
 * lo aplica `assert_can_write()` dentro de cada RPC, que es donde no se puede
 * saltear.
 */
export async function requireProfile(): Promise<ProfileRow> {
  await requireUser()

  const profile = await resolveProfile()
  if (!profile || profile.status === 'nuevo') {
    redirect(ONBOARDING_PATH)
  }

  return profile
}

/**
 * Exige rol `mod` o `admin`. Cualquier otro rol se va a la home.
 *
 * Redirige en vez de tirar 403 a propósito: `/mod/*` no debe confirmarle a nadie
 * que existe. Esto es UNA de las dos capas — la otra son las políticas RLS de
 * `reports`, `mod_actions` y `user_restrictions`, que niegan los datos aunque
 * alguien llegue a renderizar la página.
 */
export async function requireMod(): Promise<ProfileRow> {
  const profile = await requireProfile()

  if (profile.role !== 'mod' && profile.role !== 'admin') {
    redirect('/')
  }

  return profile
}

/** `/ingresar` con el destino actual en `?next=`, cuando se puede saber cuál es. */
async function signInHref(): Promise<string> {
  const target = await currentPath()
  if (!target) return SIGN_IN_PATH
  return `${SIGN_IN_PATH}?next=${encodeURIComponent(target)}`
}

/**
 * Pathname (+ query) del request actual, saneado, o null.
 *
 * Devuelve solo rutas internas: tiene que empezar con `/` y no seguir con `/` ni
 * con `\` — `//evil.com` y `/\evil.com` los toma el navegador como host y serían
 * un redirect abierto. Las rutas de auth se descartan para no encadenar
 * `/ingresar?next=/ingresar`.
 */
async function currentPath(): Promise<string | null> {
  let raw: string | null = null
  try {
    raw = (await headers()).get(PATHNAME_HEADER)
  } catch {
    // Fuera de un request (build, prerender): no hay ruta que preservar.
    return null
  }

  if (!raw || raw.length > 512) return null
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return null

  const path = raw.split('?')[0] ?? ''
  if (AUTH_PATHS.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) return null

  return raw
}
