import type { Metadata } from 'next'
import { headers } from 'next/headers'
import type { ReactNode } from 'react'

import { Tabs } from '@/components/ui/tabs'
import { requireMod } from '@/lib/supabase/server'
import { PATHNAME_HEADER } from '@/lib/supabase/middleware'

/**
 * app/(mod)/layout.tsx — la carcasa del panel de moderación (PART 11 §11.4).
 *
 * TRES CAPAS DE AUTORIZACIÓN, Y NINGUNA ES ESTA SOLA:
 *   1. `proxy.ts` saca de `/mod/*` a las sesiones sin rol antes de renderizar nada
 *      (§20.5, cortina barata).
 *   2. `requireMod()` acá: redirige a `/` en vez de tirar 403, para que el panel no
 *      le confirme a nadie que existe.
 *   3. Las políticas RLS de `reports`, `mod_actions`, `user_restrictions`, `appeals`
 *      y `events` (migraciones 0008 y 0009), que devuelven cero filas a quien no sea
 *      `mod` o `admin`, y las RPC de la migración 0012, que vuelven a chequear rol y
 *      estado antes de escribir. Si esta capa se cayera entera, el panel se vería
 *      vacío y ninguna acción prosperaría (D14: las guardas de frontend no se creen).
 *
 * NUNCA CACHEADO (§20.3): el panel muestra la cola en vivo y decide sobre contenido
 * que otro moderador puede haber tocado hace diez segundos. Una cola servida desde el
 * caché es trabajo duplicado o —peor— una sanción aplicada dos veces.
 *
 * ES UNA CARCASA ANIDADA, no un layout raíz: no lleva `<html>` ni `<body>`. La
 * cabecera y el pie del producto los pone `app/layout.tsx`.
 */

/** §20.2: `/mod/*` es dinámico y no se cachea jamás. */
export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: { default: 'Moderación', template: '%s · Moderación' },
  // Cinturón sobre el tirante del `Disallow: /mod/` de `robots.ts` (§23.1): si algún
  // día un enlace se escapa, el meta tag lo saca igual del índice.
  robots: { index: false, follow: false },
}

/** Las cuatro pantallas de §11.4.1. Más que esto no entra en el MVP. */
const NAV = [
  { href: '/mod', label: 'Cola' },
  { href: '/mod/apelaciones', label: 'Apelaciones' },
  { href: '/mod/usuarios', label: 'Usuarios' },
  { href: '/mod/metricas', label: 'Métricas' },
] as const

/**
 * Ruta actual, para marcar la pestaña activa.
 *
 * Sale del header que publica `proxy.ts` porque Next no le pasa el pathname a los
 * layouts. Si el header no está, no se marca ninguna pestaña y la navegación sigue
 * funcionando igual: degradación, no error (mismo criterio que `requireUser()`).
 */
async function activeHref(): Promise<string> {
  let path = ''
  try {
    path = (await headers()).get(PATHNAME_HEADER)?.split('?')[0] ?? ''
  } catch {
    return ''
  }

  // La coincidencia es por prefijo para que `/mod/reportes/12` marque "Cola". Se
  // ordena de más largo a más corto: si no, `/mod` se quedaría con todo.
  const match = [...NAV]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => path === item.href || path.startsWith(`${item.href}/`))

  return match?.href ?? ''
}

export default async function ModLayout({ children }: { children: ReactNode }) {
  const profile = await requireMod()
  const active = await activeHref()

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <header>
        <h1 className="text-xl font-semibold text-text-primary">Moderación</h1>
        <p className="mt-1 text-s text-text-secondary">
          Entrás como {profile.handle} ({profile.role === 'admin' ? 'admin' : 'moderación'}). Cada
          acción queda registrada con tu nombre en la auditoría.
        </p>
      </header>

      <Tabs items={[...NAV]} activeHref={active} className="mt-4" />

      <main className="mt-6">{children}</main>
    </div>
  )
}
