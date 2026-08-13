'use client'

/**
 * features/auth/components/settings-forms.tsx — los tres formularios de `/ajustes`
 * (PART 17 §17.4.8, PART 6 §6.9, PART 9 §9.5 y §9.9).
 *
 * Tres componentes en un archivo porque son tres secciones de una misma página y comparten
 * exactamente nada más que eso; separarlos en tres archivos sería tres importaciones para el
 * mismo `page.tsx`. La apariencia (Automático / Claro / Oscuro) NO está acá: es el toggle de
 * tema de components/ui, que no toca la cuenta.
 *
 * Ninguno de los tres confía en lo que manda el navegador: el cooldown de 90 días, la
 * blocklist y la confirmación escrita se vuelven a verificar del lado del servidor.
 */
import { useActionState } from 'react'
import { SubmitButton } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { LIMITS } from '@/lib/config'
import type { ActionResult } from '@/lib/result'
import { formatDate } from '@/lib/utils/dates'
import { deleteAccount, renameHandle, updateNotificationPrefs } from '../actions'

// ---------------------------------------------------------------------------
// Perfil — cambio de seudónimo
// ---------------------------------------------------------------------------

export type RenameHandleFormProps = {
  /** Seudónimo actual, tal como lo tipeó la persona. */
  handle: string
  /** false mientras corre el cooldown de 90 días (features/auth/queries.ts). */
  canRename: boolean
  /** ISO del día en que se habilita de nuevo. null cuando ya está habilitado. */
  renameAvailableAt: string | null
}

export function RenameHandleForm({ handle, canRename, renameAvailableAt }: RenameHandleFormProps) {
  const [estado, enviar] = useActionState<ActionResult | null, FormData>(renameHandle, null)
  const error = estado && !estado.ok ? estado.error : undefined

  return (
    <form action={enviar} className="flex flex-col gap-3">
      <Field
        label="Seudónimo"
        htmlFor="handle"
        hint="Podés cambiarlo cada 90 días. Se actualiza en todo lo que publicaste."
        error={error}
      >
        <Input
          name="handle"
          type="text"
          defaultValue={handle}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          minLength={LIMITS.handleMin}
          maxLength={LIMITS.handleMax}
          disabled={!canRename}
          required
        />
      </Field>

      {/* PART 9 §9.5: el renombre es un refresco de identidad, no una herramienta de privacidad.
          Decirlo acá, al lado del botón, es parte del contrato honesto del producto. */}
      <p className="text-s text-text-secondary">
        Cambiar tu nombre no borra el pasado: una página guardada puede vincular tu nombre viejo con
        el nuevo. Para publicar algo delicado, usá la opción Anónimo.
      </p>

      {!canRename && renameAvailableAt ? (
        <p className="text-s text-text-secondary">
          Vas a poder cambiarlo a partir del {formatDate(renameAvailableAt)}.
        </p>
      ) : null}

      {estado?.ok ? (
        <p aria-live="polite" className="text-s text-success">
          Listo. Cambiamos tu seudónimo en todo el sitio.
        </p>
      ) : null}

      <div>
        <SubmitButton variant="secondary" disabled={!canRename} pendingLabel="Guardando…">
          Cambiar seudónimo
        </SubmitButton>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Notificaciones — §0.5-R14: un solo interruptor
// ---------------------------------------------------------------------------

export type NotificationPrefsFormProps = {
  /** Valor actual de `profiles.notif_respuestas`. */
  respuestas: boolean
}

export function NotificationPrefsForm({ respuestas }: NotificationPrefsFormProps) {
  const [estado, enviar] = useActionState<ActionResult | null, FormData>(
    updateNotificationPrefs,
    null,
  )
  const error = estado && !estado.ok ? estado.error : null

  return (
    <form action={enviar} className="flex flex-col gap-3">
      <Checkbox
        name="respuestas"
        id="respuestas"
        label="Respuestas a mis publicaciones y comentarios"
        defaultChecked={respuestas}
      />

      <p className="text-s text-text-secondary">
        Las decisiones de moderación y el resultado de tus reportes se avisan siempre.
      </p>

      {error ? (
        <p role="alert" className="text-s text-danger">
          {error}
        </p>
      ) : null}

      {estado?.ok ? (
        <p aria-live="polite" className="text-s text-success">
          Guardamos tu preferencia.
        </p>
      ) : null}

      <div>
        <SubmitButton variant="secondary" pendingLabel="Guardando…">
          Guardar
        </SubmitButton>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Baja de cuenta — PART 6 §6.9
// ---------------------------------------------------------------------------

export type DeleteAccountFormProps = {
  /** Seudónimo que hay que escribir para confirmar. */
  handle: string
}

export function DeleteAccountForm({ handle }: DeleteAccountFormProps) {
  const [estado, enviar] = useActionState<ActionResult | null, FormData>(deleteAccount, null)

  const errorDe = (nombre: string) =>
    estado && !estado.ok && estado.field === nombre ? estado.error : undefined
  const errorGeneral = estado && !estado.ok && estado.field === undefined ? estado.error : null

  return (
    <form action={enviar} className="flex flex-col gap-4">
      <p>
        Esta acción es permanente. Tu email y tus datos de acceso se eliminan. Elegí qué pasa con lo
        que publicaste:
      </p>

      <fieldset className="flex flex-col gap-3 border-0 p-0">
        <legend className="text-s font-semibold text-text-primary">
          ¿Qué hacemos con lo que publicaste?
        </legend>

        <label className="flex items-start gap-2 text-m text-text-primary">
          <input
            type="radio"
            name="modo"
            value="borrar"
            required
            className="mt-1 size-4 shrink-0 accent-accent"
          />
          <span>
            <span className="font-semibold">
              Borrar también mis publicaciones, comentarios y recursos.
            </span>{' '}
            Desaparecen del sitio. Los hilos donde participaste mostrarán «comentario eliminado».
          </span>
        </label>

        <label className="flex items-start gap-2 text-m text-text-primary">
          <input
            type="radio"
            name="modo"
            value="conservar"
            required
            className="mt-1 size-4 shrink-0 accent-accent"
          />
          <span>
            <span className="font-semibold">Conservar mi contenido como usuario eliminado.</span>{' '}
            Tus publicaciones quedan, atribuidas a «usuario eliminado», sin conexión con tu
            seudónimo.{' '}
            <span className="text-text-secondary">
              Esto ayuda a que las respuestas útiles sigan sirviendo a otros estudiantes.
            </span>
          </span>
        </label>

        {errorDe('modo') ? (
          <p role="alert" className="text-s text-danger">
            {errorDe('modo')}
          </p>
        ) : null}
      </fieldset>

      <Field
        label="Escribí tu seudónimo para confirmar"
        htmlFor="confirmacion"
        hint={handle}
        error={errorDe('confirmacion')}
        required
      >
        <Input
          name="confirmacion"
          type="text"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          required
        />
      </Field>

      {errorGeneral ? (
        <p role="alert" className="text-s text-danger">
          {errorGeneral}
        </p>
      ) : null}

      <div>
        <SubmitButton variant="danger" pendingLabel="Borrando…">
          Borrar mi cuenta definitivamente
        </SubmitButton>
      </div>
    </form>
  )
}
