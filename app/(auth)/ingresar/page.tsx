/**
 * app/(auth)/ingresar/page.tsx — `/ingresar` (PART 6 §6.1, PART 9 §9.2.2, D7).
 *
 * Soporta `?next=` para devolver a la persona exactamente adonde estaba: lo escribe
 * `requireUser()` (lib/supabase/server.ts) cuando un guard corta una navegación, y lo consume
 * `signIn` después de crear la sesión. Acá se sanea igual antes de mostrarlo, porque el
 * parámetro viene de la URL y la URL la escribe cualquiera: solo se aceptan rutas internas de
 * una sola barra. `//otro-sitio` y `/\otro-sitio` los resuelve el navegador como host, así que
 * dejarlos pasar sería una redirección abierta con la marca del sitio adelante.
 *
 * También recibe `?error=link`, que es adonde manda `/auth/callback` cuando el canje del
 * código falla: el link del correo venció, ya se usó, o alguien lo abrió dos veces.
 *
 * Server Component. El único JS de la ruta es el del formulario, que necesita `useActionState`.
 */
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { SignInForm } from '@/features/auth/components/sign-in-form'
import { SITE_NAME } from '@/lib/config'
import { getUser } from '@/lib/supabase/server'

/** La página se bifurca según la sesión: no puede quedar en ninguna caché. */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: `Ingresar · ${SITE_NAME}`,
  description: 'Ingresá a tu cuenta con tu email y tu contraseña.',
  robots: { index: false, follow: false },
}

type SearchParams = Record<string, string | string[] | undefined>

/** Primer valor de un parámetro repetido: `?next=/a&next=/b` no puede romper la página. */
function uno(valor: string | string[] | undefined): string | undefined {
  if (typeof valor === 'string') return valor
  return Array.isArray(valor) ? valor[0] : undefined
}

/** Destino interno seguro. Todo lo demás cae en la home. */
function destinoSeguro(valor: string | undefined): string {
  return valor !== undefined && /^\/[^/\\]/.test(valor) ? valor : '/'
}

const LINK_VENCIDO =
  'Ese link ya no sirve: vence a la hora y se usa una sola vez. Pedí uno nuevo desde «¿Olvidaste tu contraseña?», o ingresá con tu contraseña de siempre.'

export default async function IngresarPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams
  const destino = destinoSeguro(uno(sp.next))

  // Con sesión abierta esta pantalla no tiene nada que ofrecer: se sigue de largo.
  const user = await getUser()
  if (user) redirect(destino)

  const linkVencido = uno(sp.error) === 'link'

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-serif text-xl font-semibold text-text-primary">Ingresá a tu cuenta</h1>
        <p className="text-s text-text-secondary">
          Con el email y la contraseña que usaste para registrarte.
        </p>
      </header>

      {linkVencido ? (
        <p role="alert" className="text-s text-danger">
          {LINK_VENCIDO}
        </p>
      ) : null}

      {/* `destino` solo viaja si no es la home: el campo oculto vacío no aporta nada. */}
      <SignInForm redirectTo={destino === '/' ? undefined : destino} />

      <p className="text-s text-text-secondary">
        ¿Todavía no tenés cuenta?{' '}
        <Link href="/registro" className="text-accent">
          Crear cuenta
        </Link>
      </p>
    </section>
  )
}
