'use client'

/**
 * features/materias/components/follow-button.tsx — el botón de seguir (PART 17 §17.4.1).
 *
 * Es el ÚNICO componente de cliente de esta feature: la página de materia es una página de
 * contenido y BUILD-CONTRACT §8 le prohíbe embarcar JavaScript de ruta más allá de la lista
 * blanca de PART 19 §19.3. Todo lo demás de `features/materias` es Server Component.
 *
 * Comportamiento exacto de §17.4.1:
 *   · sin seguir  → botón secundario "Seguir".
 *   · siguiendo   → "Siguiendo" con ícono de check.
 *   · hover sobre el estado seguido → la etiqueta pasa a "Dejar de seguir". SOLO en escritorio:
 *     Tailwind v4 envuelve `hover:` en `@media (hover: hover)`, así que en un teléfono la
 *     etiqueta nunca cambia sola y el toque togglea directo, que es lo que pide la spec. No hay
 *     detección de dispositivo en JavaScript: la distinción la hace el medio, que es quien la
 *     sabe.
 *   · al dejar de seguir aparece un toast "Dejaste de seguir X" con "Deshacer".
 *
 * El toast se muestra en las dos plataformas aunque §17.4.1 lo pida para mobile: en escritorio
 * el click también es un toggle inmediato y sin confirmación, así que la red de seguridad hace
 * exactamente la misma falta.
 *
 * ESTADO. Optimista con `useTransition`: el botón cambia al instante, la Server Action corre
 * en segundo plano y, si falla, el estado vuelve solo con un toast. No usa `useOptimistic`
 * porque hay dos fuentes de verdad que reconciliar: el `{ following }` autoritativo que
 * devuelve la acción y la prop nueva que llega cuando `updateTag('materia:<slug>')` re-renderiza
 * la página. La resincronización durante el render (el patrón oficial de React para estado
 * derivado) hace que gane siempre el servidor.
 */

import { Check } from 'lucide-react'
import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { GENERIC_ERROR } from '@/lib/errors'

import { toggleFollow } from '../actions'

export function FollowButton({
  materiaId,
  nombre,
  following,
  className,
}: {
  /** Id interno de la materia. Es el único bigint que cruza al cliente, y es deliberado (D14.7). */
  materiaId: number
  /** Nombre de la materia, para el texto del toast. */
  nombre: string
  /** Estado según el servidor en este render. */
  following: boolean
  className?: string
}) {
  const toast = useToast()
  const [, startTransition] = useTransition()
  const [serverState, setServerState] = useState(following)
  const [state, setState] = useState(following)

  // Si la página volvió con datos nuevos, ganan ellos.
  if (serverState !== following) {
    setServerState(following)
    setState(following)
  }

  /**
   * @param deseado  El estado al que se quiere llegar; se pinta antes de que el servidor conteste.
   * @param avisar   Si un "dejé de seguir" ofrece el toast con "Deshacer". El propio "Deshacer"
   *                 lo pasa en falso: encadenar toasts sería una escalera sin fin.
   */
  function enviar(deseado: boolean, avisar: boolean) {
    const anterior = state
    setState(deseado)

    startTransition(async () => {
      const result = await toggleFollow(materiaId)

      if (!result.ok) {
        setState(anterior)
        toast.show(result.error === GENERIC_ERROR ? 'No pudimos guardar el cambio.' : result.error)
        return
      }

      setState(result.data.following)

      if (avisar && !result.data.following) {
        toast.show(`Dejaste de seguir ${nombre}`, {
          label: 'Deshacer',
          onClick: () => enviar(true, false),
        })
      }
    })
  }

  return (
    <Button
      variant="secondary"
      className={className ? `group ${className}` : 'group'}
      onClick={() => enviar(!state, true)}
      aria-pressed={state}
      // El nombre accesible es estable: el intercambio de etiqueta al pasar el mouse es un
      // afordance visual y no debería reescribirle el botón a quien usa lector de pantalla.
      aria-label={state ? `Dejar de seguir ${nombre}` : `Seguir ${nombre}`}
    >
      {state ? (
        <>
          <Check aria-hidden="true" size={16} strokeWidth={2} className="group-hover:hidden" />
          <span className="group-hover:hidden">Siguiendo</span>
          <span className="hidden group-hover:inline">Dejar de seguir</span>
        </>
      ) : (
        'Seguir'
      )}
    </Button>
  )
}
