/**
 * app/(auth)/registro/page.tsx — `/registro` (PART 6 §6.1 S1 y §6.10, PART 17 §17.3, D7).
 *
 * Una sola URL, tres estados, elegidos por la presencia y la validez del código de invitación
 * que trae `?invitacion=`:
 *
 *   A. código válido      → el alta de PART 6 §6.1 S1, con el código precargado y oculto.
 *   B. código inválido    → el copy exacto de INVITE_INVALID + la lista de espera (§6.1 S1).
 *   C. sin código         → §17.3: "Por ahora, el registro es con invitación…" + lista de espera.
 *
 * El estado C es también el estado A de §6.10 (beta cerrada). El interruptor que abriría el
 * registro sin invitación es `app_setting('registro_abierto')`, y esta página NO lo consulta a
 * propósito: la tabla `app_settings` tiene grant de select solo para `authenticated` y política
 * solo para `role = 'admin'` (migración 0009), y el helper `app_setting()` está revocado para
 * `anon` (migración 0001). Quien abre `/registro` sin cuenta es `anon` y no puede leer la
 * bandera de ninguna forma legítima. Mientras no exista una RPC pública que la exponga, la
 * pantalla asume beta cerrada, que es el estado real del producto y el más conservador: si el
 * registro estuviera abierto, `handle_new_user` acepta igual el alta sin código.
 *
 * Server Component. El JS lo ponen los formularios importados, no la ruta.
 */
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { SignUpForm } from '@/features/auth/components/sign-up-form'
import { WaitlistForm } from '@/features/auth/components/waitlist-form'
import { getCarreraOptions, getInvite } from '@/features/auth/queries'
import { SITE_NAME } from '@/lib/config'
import { messageForCode } from '@/lib/errors'
import { getProfile, getUser } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: `Crear cuenta · ${SITE_NAME}`,
  description: `Cómo entrar a ${SITE_NAME}: por invitación, o anotándote en la lista de espera.`,
  robots: { index: false, follow: false },
}

type SearchParams = Record<string, string | string[] | undefined>

function uno(valor: string | string[] | undefined): string | undefined {
  if (typeof valor === 'string') return valor
  return Array.isArray(valor) ? valor[0] : undefined
}

export default async function RegistroPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams

  // Ya hay sesión: o falta terminar el alta, o no hay nada que crear.
  const user = await getUser()
  if (user) {
    const profile = await getProfile()
    redirect(profile && profile.status !== 'nuevo' ? '/' : '/registro/continuar')
  }

  // El código se normaliza igual que en la base: `invites.code` es minúscula, 8 caracteres.
  const codigo = uno(sp.invitacion)?.trim().toLowerCase()
  const invitacion = codigo ? await getInvite(codigo) : null

  // ---------------------------------------------------------------------------
  // A. Con invitación válida: el alta de §6.1 S1.
  // ---------------------------------------------------------------------------
  if (codigo && invitacion?.valid) {
    return (
      <section className="flex flex-col gap-4">
        <header className="flex flex-col gap-1">
          <h1 className="font-serif text-xl font-semibold text-text-primary">
            Te invitaron a {SITE_NAME}
          </h1>
          <p className="text-s text-text-secondary">
            La comunidad estudiantil de la UCA Rosario. Anónima, hecha por estudiantes.
          </p>
        </header>

        <SignUpForm inviteCode={codigo} />

        <p className="text-s text-text-secondary">
          ¿Ya tenés cuenta?{' '}
          <Link href="/ingresar" className="text-accent">
            Ingresar
          </Link>
        </p>
      </section>
    )
  }

  // Proyección explícita: `getCarreraOptions()` trae el `id` bigint de cada carrera y
  // `WaitlistForm` es un componente de cliente. Todo lo que entra por sus props se
  // serializa al navegador, así que el id se queda acá (D14.7, BUILD-CONTRACT §7.3).
  const carreras = (await getCarreraOptions()).map((carrera) => ({
    slug: carrera.slug,
    nombre: carrera.nombre,
  }))

  // ---------------------------------------------------------------------------
  // B. Con invitación que no sirve: el borde de §6.1 S1, con salida a la lista de espera.
  // ---------------------------------------------------------------------------
  if (codigo) {
    return (
      <section className="flex flex-col gap-4">
        <header className="flex flex-col gap-1">
          <h1 className="font-serif text-xl font-semibold text-text-primary">
            Esa invitación ya no sirve
          </h1>
          <p role="alert" className="text-s text-text-secondary">
            {invitacion?.reason ?? messageForCode('INVITE_INVALID')}
          </p>
        </header>

        <WaitlistForm carreras={carreras} />

        <p className="text-s text-text-secondary">
          ¿Ya tenés cuenta?{' '}
          <Link href="/ingresar" className="text-accent">
            Ingresar
          </Link>
        </p>
      </section>
    )
  }

  // ---------------------------------------------------------------------------
  // C. Sin código: beta cerrada (§17.3 y §6.10 estado A).
  // ---------------------------------------------------------------------------
  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-serif text-xl font-semibold text-text-primary">Crear cuenta</h1>
        <p className="text-s text-text-secondary">
          Por ahora, el registro es con invitación. Pedile el link a quien te contó de {SITE_NAME}.
        </p>
      </header>

      <WaitlistForm carreras={carreras} />

      <p className="text-s text-text-secondary">
        Leer el sitio no necesita cuenta: todo lo que se publica es público. La invitación hace
        falta para publicar, comentar y descargar.
      </p>

      <p className="text-s text-text-secondary">
        ¿Ya tenés cuenta?{' '}
        <Link href="/ingresar" className="text-accent">
          Ingresar
        </Link>
      </p>
    </section>
  )
}
