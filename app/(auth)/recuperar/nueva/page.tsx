/**
 * app/(auth)/recuperar/nueva/page.tsx — la segunda mitad de la recuperación (PART 6 §6.8).
 *
 * Se llega desde el link del correo: `/auth/callback` canjea el código, deja la sesión activa y
 * manda acá. `updatePassword` solo tiene que llamar a `auth.updateUser({ password })`, y
 * Supabase revoca el resto de las sesiones al cambiarla (PART 9 §9.3).
 *
 * Sin sesión no hay nada que hacer: el link vence a la hora y se usa una sola vez. En vez de un
 * formulario que va a fallar, se muestra el borde con la salida — pedir uno nuevo. El copy no
 * distingue "venció" de "ya se usó" porque desde acá no se puede saber cuál de las dos pasó, y
 * fingir precisión sobre eso solo sirve para confundir.
 *
 * `updatePassword` no redirige: el formulario muestra "Listo. Ya podés ingresar." con un botón
 * al inicio (features/auth/components/reset-password-form.tsx).
 */
import type { Metadata } from 'next'

import { ButtonLink } from '@/components/ui/button'
import { ResetPasswordForm } from '@/features/auth/components/reset-password-form'
import { SITE_NAME } from '@/lib/config'
import { getUser } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: `Contraseña nueva · ${SITE_NAME}`,
  robots: { index: false, follow: false },
}

export default async function NuevaContrasenaPage() {
  const user = await getUser()

  if (!user) {
    return (
      <section className="flex flex-col items-start gap-4">
        <header className="flex flex-col gap-1">
          <h1 className="font-serif text-xl font-semibold text-text-primary">
            El link ya no sirve
          </h1>
          <p className="text-s text-text-secondary">
            Los links de recuperación vencen a la hora y se usan una sola vez.
          </p>
        </header>

        <p>Pedí uno nuevo y volvé a abrirlo desde tu casilla.</p>

        <ButtonLink href="/recuperar">Pedir otro link</ButtonLink>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-serif text-xl font-semibold text-text-primary">
          Creá tu contraseña nueva
        </h1>
        <p className="text-s text-text-secondary">
          Tu seudónimo, tu karma y las materias que seguís quedan como estaban.
        </p>
      </header>

      <ResetPasswordForm />
    </section>
  )
}
