'use client'

/**
 * features/posts/components/vote-button.tsx — el control de voto (PART 17 §17.6).
 *
 * Se usa en la página del post (barra de acciones y árbol de comentarios) y, desde
 * la enmienda del 2026-08-14 a §0.5-R20, también en la fila del feed con
 * `tamano="compacto"`. Está en la lista blanca de componentes de cliente de PART
 * 19 §19.3.
 *
 * Comportamiento fijado por §17.6: el toque actualiza el número al instante,
 * dispara la Server Action y, si falla, el número se corrige solo con un toast.
 * Sin spinner: un spinner sobre un contador que ya se movió es ruido.
 *
 * El estado se sincroniza con el servidor por dos vías, y por eso no usa
 * `useOptimistic`: la action devuelve el `{ score, voted }` autoritativo (que se
 * aplica al terminar), y si además la página se re-renderiza por la invalidación
 * de `post:<publicId>`, las props nuevas pisan el estado local. Así el control es
 * correcto tanto si la página está cacheada por etiqueta como si no.
 *
 * Las medidas viven en `vote-styles.ts`, no acá: la fila del feed necesita las
 * mismas clases para su versión sin sesión, que es un link y se renderiza en el
 * servidor. Ver el encabezado de ese archivo.
 */
import { ArrowUp } from 'lucide-react'
import { useState, useTransition } from 'react'
import { Button, ButtonLink } from '@/components/ui/button'
import { Dialog, DialogActions, DialogClose } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/cn'
import { GENERIC_ERROR } from '@/lib/errors'
import { toggleCommentVote, togglePostVote } from '../actions'
import { VOTE_ICON_SIZE, voteControlClasses, type VoteSize } from './vote-styles'

export type VoteTarget = 'publicacion' | 'comentario'

type VoteState = { score: number; voted: boolean }

export function VoteButton({
  target,
  publicId,
  score,
  voted,
  signedIn,
  disabled,
  tamano = 'normal',
  className,
}: {
  target: VoteTarget
  publicId: string
  score: number
  voted: boolean
  /** Sin sesión el toque abre la puerta de registro en vez de votar (§17.3). */
  signedIn: boolean
  /** Para el autor: la RPC rechaza el auto-voto, así que no se ofrece. */
  disabled?: boolean
  /**
   * `normal` (default) es el control de la página del post; `compacto` es el de
   * una fila de feed: más chico a la vista, con los mismos 44px tocables en
   * mobile (PART 18 §18.4). Ver `vote-styles.ts`.
   */
  tamano?: VoteSize
  className?: string
}) {
  const toast = useToast()
  const [, startTransition] = useTransition()
  const [gateOpen, setGateOpen] = useState(false)
  const [serverState, setServerState] = useState<VoteState>({ score, voted })
  const [state, setState] = useState<VoteState>({ score, voted })

  // Resincronización con el servidor durante el render (patrón oficial de React
  // para estado derivado): si la página volvió con datos nuevos, ganan ellos.
  if (serverState.score !== score || serverState.voted !== voted) {
    setServerState({ score, voted })
    setState({ score, voted })
  }

  function handleClick() {
    if (!signedIn) {
      setGateOpen(true)
      return
    }

    const previous = state
    setState({
      score: state.voted ? Math.max(state.score - 1, 0) : state.score + 1,
      voted: !state.voted,
    })

    startTransition(async () => {
      const result =
        target === 'publicacion'
          ? await togglePostVote(publicId)
          : await toggleCommentVote(publicId)

      if (result.ok) {
        setState(result.data)
      } else {
        setState(previous)
        // Cuando el motivo es accionable (auto-voto, límite de tasa) se muestra
        // tal cual; para el fallo sin nombre va la copy de §17.5.1.
        toast.show(result.error === GENERIC_ERROR ? 'No pudimos registrar tu voto.' : result.error)
      }
    })
  }

  const label = target === 'publicacion' ? 'Votar publicación' : 'Votar comentario'

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        aria-label={label}
        aria-pressed={state.voted}
        className={voteControlClasses(tamano, state.voted)}
      >
        <ArrowUp aria-hidden="true" size={VOTE_ICON_SIZE[tamano]} strokeWidth={2} />
        <span aria-hidden="true">{state.score.toLocaleString('es-AR')}</span>
      </button>
      {/* El conteo va como texto adyacente al botón, no adentro: el aria-label del
          botón taparía cualquier contenido interno (PART 17 §17.7). */}
      <span className="sr-only">
        {state.score === 1 ? '1 voto' : `${state.score.toLocaleString('es-AR')} votos`}
      </span>

      <Dialog
        trigger={null}
        open={gateOpen}
        onOpenChange={setGateOpen}
        title="Para votar necesitás una cuenta."
      >
        <DialogActions>
          <DialogClose asChild>
            <Button variant="tertiary">Cancelar</Button>
          </DialogClose>
          <ButtonLink href="/registro">Crear cuenta</ButtonLink>
        </DialogActions>
      </Dialog>
    </span>
  )
}
