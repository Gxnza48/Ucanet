/**
 * app/(auth)/registro/continuar/page.tsx — `/registro/continuar`
 * (PART 6 §6.1 S3 y S4, PART 17 §17.4.9, D7).
 *
 * Es adonde vuelve la persona después de confirmar el correo: `signUp` fija
 * `emailRedirectTo` en `/auth/callback?next=/registro/continuar`, así que al llegar acá ya hay
 * sesión y hay una fila de `profiles` con handle placeholder y `status = 'nuevo'` (la escribe
 * el trigger `handle_new_user`, migración 0004).
 *
 * Dos pantallas —seudónimo, y carrera + año— pero un solo envío: `complete_onboarding` escribe
 * las tres cosas y pasa el perfil a `activo` en una transacción. Por eso el paso 1 vive en el
 * cliente y no en otra ruta. La acción redirige a `/` al terminar (features/auth/actions.ts).
 *
 * Guardas de la ruta, en orden:
 *   sin sesión           → `/ingresar?next=/registro/continuar` (lo arma `requireUser`)
 *   perfil ya terminado  → `/` — `complete_onboarding` levanta NOT_ALLOWED si el status no es
 *                          'nuevo', así que dejar entrar sería ofrecer un formulario que la
 *                          base va a rechazar. El seudónimo se cambia en `/ajustes`.
 */
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { OnboardingForm } from '@/features/auth/components/onboarding-form'
import { getCarreraOptions } from '@/features/auth/queries'
import { SITE_NAME } from '@/lib/config'
import { getProfile, requireUser } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: `Terminá de crear tu cuenta · ${SITE_NAME}`,
  robots: { index: false, follow: false },
}

export default async function ContinuarPage() {
  const user = await requireUser()

  const profile = await getProfile()
  if (profile && profile.status !== 'nuevo') redirect('/')

  const carreras = await getCarreraOptions()

  return (
    <section className="flex flex-col gap-4">
      {/*
        El encabezado visible de cada paso lo pone el formulario ("Elegí tu seudónimo",
        "¿Qué estudiás?"), que es el que sabe en cuál está. El h1 existe igual para que la
        página tenga un título en el árbol de accesibilidad y no arranque en un h2.
      */}
      <h1 className="sr-only">Terminá de crear tu cuenta</h1>

      {/*
        La semilla del generador de seudónimos es el uuid del usuario: estable entre el render
        del servidor y la hidratación (nada de Math.random en el medio) y distinta por persona,
        así dos ingresantes no ven la misma terna sugerida.
      */}
      <OnboardingForm carreras={carreras} seed={user.id} />
    </section>
  )
}
