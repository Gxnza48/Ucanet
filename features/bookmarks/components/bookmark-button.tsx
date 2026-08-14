'use client'

/**
 * features/bookmarks/components/bookmark-button.tsx — el control de guardar.
 *
 * Es el único componente de cliente de esta feature. Aparece en dos lugares y por eso
 * tiene dos formas:
 *
 *   · dentro de una fila de lista → solo el ícono, sin texto. La fila es densa (D8) y una
 *     palabra más por renglón la convierte en tarjeta. El nombre accesible lo pone el
 *     `aria-label`, que es obligatorio en todo ícono suelto (§18.5, anti-checklist 15).
 *   · en la página de la publicación (`conEtiqueta`) → ícono + palabra, con las métricas
 *     del botón terciario, para que entre en la misma barra que "Comentar" y "Compartir"
 *     sin desalinearse.
 *
 * COPY, exacta y fija: "Guardar publicación" para guardar, "Quitar de guardados" para
 * sacar. Los dos estados tienen nombre accesible distinto a propósito: el botón dice lo
 * que va a hacer, no lo que pasó.
 *
 * ÍCONO: `bookmark` de Lucide. PART 18 §18.5 cierra el set en 15 íconos y `bookmark` no
 * estaba: la ampliación a 16 está registrada en `docs/decisions.md` (los documentos del
 * plan no se editan). Relleno con `fill-current` cuando está guardado — es el único
 * cambio de forma del ícono en todo el producto, y existe porque un marcador se lee de un
 * vistazo por su silueta, no por su color.
 *
 * ESTADO. Optimista con `useTransition`: el ícono cambia al instante, la Server Action
 * corre en segundo plano y, si falla, el estado vuelve solo con un toast. No usa
 * `useOptimistic` porque hay dos fuentes de verdad que reconciliar: el `{ guardado }`
 * autoritativo que devuelve la acción y la prop nueva que llega cuando `/guardados` se
 * revalida. La resincronización durante el render (el patrón oficial de React para estado
 * derivado) hace que gane siempre el servidor. Es el mismo mecanismo que `VoteButton` y
 * `FollowButton`, deliberadamente.
 */

import { Bookmark } from 'lucide-react'
import { useState, useTransition } from 'react'

import { buttonClasses } from '@/components/ui/button-styles'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/cn'
import { GENERIC_ERROR } from '@/lib/errors'

import { toggleBookmark } from '../actions'

/** Nombre accesible de cada estado. Es también la etiqueta visible recortada a una palabra. */
const LABEL_GUARDAR = 'Guardar publicación'
const LABEL_QUITAR = 'Quitar de guardados'

export function BookmarkButton({
  publicId,
  guardado,
  conEtiqueta = false,
  className,
}: {
  /** nanoid de la publicación. Es lo único que viaja al navegador (D14.7). */
  publicId: string
  /** Estado según el servidor en este render. */
  guardado: boolean
  /** Con texto visible al lado del ícono. Para la página de la publicación. */
  conEtiqueta?: boolean
  className?: string
}) {
  const toast = useToast()
  const [, startTransition] = useTransition()
  const [serverState, setServerState] = useState(guardado)
  const [state, setState] = useState(guardado)

  // Si la página volvió con datos nuevos, ganan ellos.
  if (serverState !== guardado) {
    setServerState(guardado)
    setState(guardado)
  }

  function handleClick() {
    const anterior = state
    setState(!anterior)

    startTransition(async () => {
      const result = await toggleBookmark(publicId)

      if (!result.ok) {
        setState(anterior)
        toast.show(result.error === GENERIC_ERROR ? 'No pudimos guardar el cambio.' : result.error)
        return
      }

      setState(result.data.guardado)
    })
  }

  const label = state ? LABEL_QUITAR : LABEL_GUARDAR

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={label}
      aria-pressed={state}
      className={cn(
        conEtiqueta
          ? buttonClasses('tertiary', state ? 'text-accent' : 'text-text-secondary')
          : // Ícono solo: 44px táctil hasta 1023px y 36px de 1024px en adelante (§17.6),
            // las mismas métricas que el disparador del menú de desborde de la publicación.
            cn(
              'inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-input',
              'transition-colors duration-150 ease-out hover:bg-surface-raised lg:h-9 lg:w-9',
              state ? 'text-accent' : 'text-text-secondary hover:text-text-primary',
            ),
        className,
      )}
    >
      <Bookmark
        aria-hidden="true"
        size={16}
        strokeWidth={2}
        className={state ? 'fill-current' : undefined}
      />
      {/* La etiqueta visible nombra el ESTADO ("Guardado") y el `aria-label` nombra la
          ACCIÓN ("Quitar de guardados"), igual que `FollowButton` con "Siguiendo" /
          "Dejar de seguir". Es una divergencia consciente entre nombre visible y nombre
          accesible: el estado es lo que hay que poder leer de un vistazo, y el ícono
          relleno lo confirma. */}
      {conEtiqueta ? <span>{state ? 'Guardado' : 'Guardar'}</span> : null}
    </button>
  )
}
