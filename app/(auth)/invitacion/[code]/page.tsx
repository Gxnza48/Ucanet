/**
 * app/(auth)/invitacion/[code]/page.tsx — `/invitacion/[code]` (PART 6 §6.1 S1, D7).
 *
 * Es la puerta de entrada del producto en beta: alguien comparte el link y del otro lado tiene
 * que aparecer el alta, no una landing. Por eso, con el código válido, esta ruta no dibuja nada
 * propio — valida y sigue derecho a `/registro?invitacion=<code>`, que es la pantalla S1 con el
 * código ya precargado. Una sola superficie de alta, un solo formulario que mantener.
 *
 * La validación es de SOLO LECTURA (§0.5-R18): `getInvite` mira forma y estado sin consumir
 * nada. La palabra final la tiene `handle_new_user`, que canjea el código con el
 * `update … returning` atómico dentro de la misma transacción que crea el usuario. Acá lo único
 * que se gana es avisar antes de que la persona tipee un correo y una contraseña para nada.
 *
 * Con el código roto —inexistente, vencido, revocado o agotado— se muestra el mismo texto para
 * los cuatro casos: distinguirlos le daría a un bot un oráculo para barrer códigos.
 */
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { ButtonLink } from '@/components/ui/button'
import { getInvite } from '@/features/auth/queries'
import { SITE_NAME } from '@/lib/config'
import { messageForCode } from '@/lib/errors'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: `Invitación · ${SITE_NAME}`,
  robots: { index: false, follow: false },
}

export default async function InvitacionPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const codigo = code.trim().toLowerCase()

  const invitacion = await getInvite(codigo)

  // `redirect` tira NEXT_REDIRECT: va fuera de cualquier try/catch, al tope del flujo.
  if (invitacion.valid) {
    redirect(`/registro?invitacion=${encodeURIComponent(codigo)}`)
  }

  return (
    <section className="flex flex-col items-start gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-serif text-xl font-semibold text-text-primary">
          Esa invitación ya no sirve
        </h1>
        <p role="alert" className="text-s text-text-secondary">
          {invitacion.reason ?? messageForCode('INVITE_INVALID')}
        </p>
      </header>

      <ButtonLink href="/registro">Anotarme en la lista de espera</ButtonLink>

      <p className="text-s text-text-secondary">
        Podés leer todo el sitio sin cuenta.{' '}
        <Link href="/" className="text-accent">
          Ir al inicio
        </Link>
      </p>
    </section>
  )
}
