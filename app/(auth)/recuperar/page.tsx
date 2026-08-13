/**
 * app/(auth)/recuperar/page.tsx — `/recuperar`, el pedido de reseteo (PART 6 §6.8, PART 9 §9.8).
 *
 * Esta pantalla solo PIDE el link. La contraseña nueva se escribe en `/recuperar/nueva`, que es
 * la mitad que exige una sesión de recuperación activa.
 *
 * Antienumeración: el formulario responde siempre lo mismo exista o no la cuenta. Eso lo
 * resuelve `requestPasswordReset`; acá lo único que importa es no agregar señales — por eso la
 * página no dice nada distinto según haya o no sesión abierta más allá del atajo de abajo.
 *
 * ATAJO CON SESIÓN ABIERTA. `requestPasswordReset` fija `redirectTo` en
 * `/auth/callback?next=/recuperar`, así que quien vuelve del correo puede aterrizar acá con la
 * sesión de recuperación ya canjeada. En ese caso mostrarle otra vez el formulario de pedido
 * sería un callejón: se le ofrece el paso siguiente. No se redirige solo, a propósito —
 * `/ajustes` enlaza acá para cambiar la contraseña, y una redirección automática convertiría
 * una visita normal en un cambio de contraseña inesperado.
 */
import type { Metadata } from 'next'

import { ButtonLink } from '@/components/ui/button'
import { RecoverForm } from '@/features/auth/components/recover-form'
import { SITE_NAME } from '@/lib/config'
import { getUser } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: `Recuperar cuenta · ${SITE_NAME}`,
  description: 'Pedí un link para crear una contraseña nueva.',
  robots: { index: false, follow: false },
}

export default async function RecuperarPage() {
  const user = await getUser()

  return (
    <section className="flex flex-col gap-4">
      <header>
        <h1 className="font-serif text-xl font-semibold text-text-primary">Recuperá tu cuenta</h1>
      </header>

      {user ? (
        <div className="flex flex-col items-start gap-3 border-b border-border pb-4">
          <p className="text-m text-text-primary">
            Tenés una sesión abierta: podés crear tu contraseña nueva ahora mismo.
          </p>
          <ButtonLink href="/recuperar/nueva">Crear contraseña nueva</ButtonLink>
        </div>
      ) : null}

      <RecoverForm />
    </section>
  )
}
