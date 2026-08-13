/**
 * app/(me)/ajustes/page.tsx — `/ajustes` (PART 17 §17.4.8, PART 6 §6.9, PART 9 §9.5 y §9.9, D7).
 *
 * `force-dynamic`: acá se ve el correo, el seudónimo y el estado de la cuenta de UNA persona.
 * Es la página que nunca puede quedar en una caché compartida.
 *
 * Una sola página con secciones apiladas y rótulos de 13px, sin sub-navegación: el MVP tiene
 * muy pocos ajustes como para justificar otro nivel de navegación (§17.4.8).
 *
 * Orden: Perfil · Cuenta · Avisos · Apariencia · Mis recursos · Invitaciones (según el rol) ·
 * Zona de peligro. Lo destructivo va último y detrás de un `<details>` cerrado — no por
 * oscurecerlo, sino porque nadie entra a Ajustes buscando borrarse la cuenta, y `<details>`
 * nativo no cuesta un solo byte de JS.
 *
 * DESAJUSTES CONOCIDOS CONTRA LAS MIGRACIONES (0001–0013), todos anotados en su sección:
 *   1. Carrera y año de ingreso no se pueden editar. `complete_onboarding` levanta NOT_ALLOWED
 *      si el perfil ya no está en `status = 'nuevo'` (migración 0011) y `profiles` no tiene ni
 *      grant de update ni política de escritura (migración 0004). Se muestran, no se editan.
 *   2. El correo no se puede cambiar: no hay acción ni RPC para eso todavía.
 *   3. "Mis recursos" no puede listar los recursos propios: no existe una lectura por autor en
 *      features/recursos/queries.ts.
 *   4. Las invitaciones se crean con `createInvite`, que vive en features/mod y responde con el
 *      código; sin una lectura de invitaciones propias no hay dónde volver a verlo, así que la
 *      sección enlaza al panel en vez de ofrecer un formulario que pierde su resultado.
 */
import type { Metadata } from 'next'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { z } from 'zod'

import { ButtonLink, SubmitButton } from '@/components/ui/button'
import {
  DeleteAccountForm,
  NotificationPrefsForm,
  RenameHandleForm,
} from '@/features/auth/components/settings-forms'
import { getSettings } from '@/features/auth/queries'
import { getQuotaUsage } from '@/features/recursos/queries'
import { LIMITS, SITE_NAME } from '@/lib/config'
import { getUser } from '@/lib/supabase/server'
import { getTheme, THEME_COOKIE, type Theme } from '@/lib/theme'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: `Ajustes · ${SITE_NAME}`,
  robots: { index: false, follow: false },
}

// ---------------------------------------------------------------------------
// Apariencia: la única escritura propia de esta página.
// ---------------------------------------------------------------------------

const temaSchema = z.enum(['auto', 'claro', 'oscuro'], { error: 'Elegí una de las tres opciones.' })

const TEMAS: ReadonlyArray<{ value: Theme; label: string }> = [
  { value: 'auto', label: 'Automático' },
  { value: 'claro', label: 'Claro' },
  { value: 'oscuro', label: 'Oscuro' },
]

/**
 * Guarda el tema en su cookie (§0.5-R23, lib/theme.ts).
 *
 * Es una Server Action inline y no un `actions.ts` de feature porque el tema no es un dato de
 * dominio: no toca la base, no tiene RPC, no pertenece a ninguna feature y no hay estado que
 * sincronizar entre dispositivos. De los cinco pasos de PART 20 §20.4 cumple los que aplican —
 * `safeParse` primero, invalidación después—; el paso de la RPC no existe porque no hay
 * escritura en Postgres que hacer.
 *
 * Radios nativos + envío normal: el tema se elige una vez cada tanto y no merece un componente
 * de cliente. `revalidatePath('/', 'layout')` porque el atributo `data-theme` lo pinta el
 * layout raíz y hay que rehacerlo entero.
 */
async function guardarTema(formData: FormData) {
  'use server'

  const parsed = temaSchema.safeParse(formData.get('tema'))
  if (!parsed.success) return

  const store = await cookies()
  store.set(THEME_COOKIE, parsed.data, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    // Legible desde el navegador a propósito: la cookie no es un secreto y un toggle de
    // cliente tiene que poder escribirla sin pasar por el servidor.
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
  })

  revalidatePath('/', 'layout')
}

// ---------------------------------------------------------------------------
// Ayudantes de presentación
// ---------------------------------------------------------------------------

const MB = 1024 * 1024

function enMegas(bytes: number): string {
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 }).format(bytes / MB)
}

/**
 * Correo enmascarado, formato "a•••@•••.com" (§17.4.8). No es seguridad: es no imprimir la
 * dirección entera en una pantalla que alguien puede estar mirando por encima del hombro.
 */
function enmascararEmail(email: string | undefined): string {
  if (!email) return 'Sin correo'

  const arroba = email.lastIndexOf('@')
  if (arroba <= 0) return '•••'

  const inicial = email.slice(0, 1)
  const dominio = email.slice(arroba + 1)
  const punto = dominio.lastIndexOf('.')

  return `${inicial}•••@•••${punto > 0 ? dominio.slice(punto) : ''}`
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="border-b border-border py-6">
      <h2 className="text-s font-semibold text-text-secondary">{titulo}</h2>
      <div className="mt-3 flex flex-col gap-3">{children}</div>
    </section>
  )
}

/** Fila de dato de solo lectura: rótulo arriba, valor abajo. */
function Dato({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <p className="text-m">
      <span className="text-text-secondary">{rotulo}: </span>
      <span className="text-text-primary">{valor}</span>
    </p>
  )
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------

export default async function AjustesPage() {
  const [{ profile, carreras, canRename, renameAvailableAt }, user, tema, cuota] =
    await Promise.all([getSettings(), getUser(), getTheme(), getQuotaUsage()])

  const carrera = carreras.find((opcion) => opcion.id === profile.carrera_id)
  const esMod = profile.role === 'mod' || profile.role === 'admin'

  return (
    <div className="flex flex-col">
      <header className="pb-2">
        <h1 className="font-serif text-2xl font-semibold text-text-primary">Ajustes</h1>
      </header>

      {/* ------------------------------------------------------------------ */}
      <Seccion titulo="Perfil">
        <RenameHandleForm
          handle={profile.handle}
          canRename={canRename}
          renameAvailableAt={renameAvailableAt}
        />

        <div className="flex flex-col gap-1 border-t border-border pt-3">
          <Dato rotulo="Carrera" valor={carrera?.nombre ?? 'Preferís no decirla'} />
          <Dato
            rotulo="Año de ingreso"
            valor={profile.ingreso_year !== null ? String(profile.ingreso_year) : 'Sin especificar'}
          />
          <p className="text-s text-text-secondary">
            Por ahora la carrera y el año se eligen una sola vez, al crear la cuenta. Las materias
            que seguís sí las podés cambiar cuando quieras desde{' '}
            <Link href="/materias" className="text-accent">
              Materias
            </Link>
            .
          </p>
        </div>
      </Seccion>

      {/* ------------------------------------------------------------------ */}
      <Seccion titulo="Cuenta">
        <Dato rotulo="Email" valor={enmascararEmail(user?.email)} />
        <p className="text-s text-text-secondary">
          Tu correo no se muestra nunca en el sitio y no está conectado públicamente con tu
          seudónimo. Es lo único con lo que podés recuperar la cuenta: si perdés el acceso a esa
          casilla, no vamos a poder devolvértela.
        </p>

        <div>
          <ButtonLink href="/recuperar" variant="secondary">
            Cambiar contraseña
          </ButtonLink>
        </div>
        <p className="text-s text-text-secondary">
          Te mandamos un link a tu casilla. Al cambiarla se cierran las sesiones de todos tus
          dispositivos.
        </p>
      </Seccion>

      {/* ------------------------------------------------------------------ */}
      <Seccion titulo="Avisos">
        <NotificationPrefsForm respuestas={profile.notif_respuestas} />
      </Seccion>

      {/* ------------------------------------------------------------------ */}
      <Seccion titulo="Apariencia">
        <form action={guardarTema} className="flex flex-col gap-3">
          <fieldset className="flex flex-col gap-2 border-0 p-0">
            <legend className="sr-only">Tema del sitio</legend>
            {TEMAS.map(({ value, label }) => (
              <label key={value} className="flex items-center gap-2 text-m text-text-primary">
                <input
                  type="radio"
                  name="tema"
                  value={value}
                  defaultChecked={value === tema}
                  className="size-4 shrink-0 accent-accent"
                />
                {label}
              </label>
            ))}
          </fieldset>

          <p className="text-s text-text-secondary">
            «Automático» sigue lo que tenga configurado tu sistema.
          </p>

          <div>
            <SubmitButton variant="secondary" pendingLabel="Guardando…">
              Guardar
            </SubmitButton>
          </div>
        </form>
      </Seccion>

      {/* ------------------------------------------------------------------ */}
      <Seccion titulo="Mis recursos">
        <p className="text-m text-text-primary">
          Usás {enMegas(cuota.usedBytes)} MB de {enMegas(cuota.limitBytes)} MB. Cada archivo puede
          pesar hasta {enMegas(LIMITS.fileMaxBytes)} MB, y cada recurso lleva hasta{' '}
          {LIMITS.filesPerResource} archivos.
        </p>

        <p className="text-s text-text-secondary">
          Editar y eliminar están en la página de cada recurso, en el menú «⋯». Borrar uno libera su
          espacio en el momento.
        </p>

        {/*
          DESAJUSTE 3 (ver el encabezado del archivo). Acá tendría que ir la lista de los
          recursos propios de §14.10 —con votos, descargas, estado y las acciones "Editar" y
          "Eliminar" por fila, incluidos los anónimos, que solo ve su autor—. No se puede
          construir todavía: features/recursos/queries.ts expone listResources (filtra por
          materia y tipo, no por autor), getResource y getQuotaUsage, y una consulta directa
          acá violaría BUILD-CONTRACT §7.1 (nada de supabase.from fuera de las capas de datos).
          Falta una lectura del tipo listOwnResources() en esa feature; el día que exista, esta
          sección pasa a ser la lista y estos enlaces se vuelven su cabecera.
        */}
        <div className="flex flex-wrap items-center gap-3">
          <ButtonLink href="/recursos/subir" variant="secondary">
            Subir un recurso
          </ButtonLink>
          <Link href={`/u/${profile.handle}`} className="text-m font-semibold text-accent">
            Ver los que publicaste
          </Link>
        </div>

        <p className="text-s text-text-secondary">
          Lo que publicaste como anónimo no aparece en tu perfil, ni siquiera para vos: se llega
          desde el aviso de la respuesta o desde el link del propio recurso.
        </p>
      </Seccion>

      {/* ------------------------------------------------------------------ */}
      {esMod ? (
        <Seccion titulo="Invitaciones">
          <p className="text-m text-text-primary">
            {SITE_NAME} está en beta cerrada: se entra con invitación, y las invitaciones las emite
            el equipo de moderación.
          </p>
          <div>
            <ButtonLink href="/mod" variant="secondary">
              Ir al panel de moderación
            </ButtonLink>
          </div>
          <p className="text-s text-text-secondary">
            Cada código queda atado a quien lo creó: es la señal que permite abrir carrera por
            carrera y cortar una cadena de altas si algo sale mal.
          </p>
        </Seccion>
      ) : null}

      {/* ------------------------------------------------------------------ */}
      <section className="py-6">
        <h2 className="text-s font-semibold text-text-secondary">Zona de peligro</h2>

        <form action="/auth/signout" method="post" className="mt-3">
          <SubmitButton variant="secondary" pendingLabel="Cerrando sesión…">
            Cerrar sesión en todos los dispositivos
          </SubmitButton>
        </form>

        <details className="mt-6 border-t border-border pt-4">
          <summary className="cursor-pointer text-m font-semibold text-danger">
            Borrar mi cuenta
          </summary>

          <div className="mt-4 flex flex-col gap-4">
            <h3 className="font-serif text-l font-semibold text-text-primary">Borrar tu cuenta</h3>
            <DeleteAccountForm handle={profile.handle} />
          </div>
        </details>
      </section>
    </div>
  )
}
