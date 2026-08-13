'use client'

/**
 * features/posts/components/comment-form.tsx — el compositor de comentarios y el
 * de respuestas (PART 17 §17.4.2).
 *
 * Dos exports:
 * - `CommentForm`: la caja principal del hilo. Su textarea lleva `id="comentar"`,
 *   que es el destino del ancla "Comentar" de la barra de acciones.
 * - `CommentReply`: el botón "Responder" de un comentario de primer nivel, que
 *   monta el formulario recién al abrirse. Se hace así y no con `<details>`
 *   porque `<details>` dejaría un formulario hidratado por cada comentario de la
 *   página; el botón deja uno solo, el que la persona abrió.
 *
 * El checkbox Anónimo usa el MISMO componente y el MISMO texto que el composer de
 * publicaciones (§17.4.3): ese explicador es el contrato de honestidad del
 * producto (D3) y es una cadena protegida.
 */
import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useRef, useState } from 'react'
import { SubmitButton } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { LIMITS } from '@/lib/config'
import { cn } from '@/lib/cn'
import { createComment } from '../actions'

/**
 * CADENA PROTEGIDA (PART 17 §17.4.3, D3, brief §8). Cambiarla exige una enmienda
 * a la columna vertebral: es la promesa exacta que el producto hace sobre el
 * anonimato. Se declara una sola vez y la importa también `composer.tsx`.
 */
export const ANON_EXPLAINER = 'Tu nombre no se muestra. El equipo de moderación puede ver el autor.'

/** Rótulo del checkbox de anonimato, idéntico en publicaciones y comentarios. */
export const ANON_LABEL = 'Publicar como anónimo'

/** Id del textarea principal: el ancla "Comentar" de la barra de acciones apunta acá. */
export const COMMENT_ANCHOR_ID = 'comentar'

export function CommentForm({
  postPublicId,
  parentPublicId,
  signedIn,
  locked = false,
  textareaId = COMMENT_ANCHOR_ID,
  autoFocus = false,
  onDone,
  className,
}: {
  postPublicId: string
  /** Presente = respuesta a un comentario de primer nivel (profundidad 2, D2). */
  parentPublicId?: string
  signedIn: boolean
  locked?: boolean
  textareaId?: string
  autoFocus?: boolean
  /** Se llama al guardar; lo usa `CommentReply` para cerrarse. */
  onDone?: () => void
  className?: string
}) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [state, formAction] = useActionState(createComment, null)

  useEffect(() => {
    if (!state?.ok) return
    formRef.current?.reset()
    // El árbol lo arma el servidor: hay que volver a pedirlo para ver el
    // comentario recién escrito, esté o no cacheada la página por etiqueta.
    router.refresh()
    onDone?.()
  }, [state, router, onDone])

  if (locked) {
    return (
      <p className={cn('text-m text-text-secondary', className)}>
        El hilo está bloqueado: no admite comentarios nuevos.
      </p>
    )
  }

  if (!signedIn) {
    return (
      <div className={cn('flex flex-col gap-2', className)}>
        <Textarea
          id={textareaId}
          rows={3}
          placeholder="Escribí un comentario"
          disabled
          aria-describedby={`${textareaId}-ingresar`}
        />
        <p id={`${textareaId}-ingresar`} className="text-m">
          <a href="/ingresar" className="text-accent hover:underline">
            Ingresá para comentar
          </a>
        </p>
      </div>
    )
  }

  const anonymousId = `${textareaId}-anonimo`

  return (
    <form ref={formRef} action={formAction} className={cn('flex flex-col gap-3', className)}>
      <input type="hidden" name="postPublicId" value={postPublicId} />
      {parentPublicId ? <input type="hidden" name="parentPublicId" value={parentPublicId} /> : null}

      <label htmlFor={textareaId} className="sr-only">
        {parentPublicId ? 'Tu respuesta' : 'Tu comentario'}
      </label>
      <Textarea
        id={textareaId}
        name="body"
        rows={3}
        required
        maxLength={LIMITS.commentBody}
        autoFocus={autoFocus}
        placeholder="Escribí un comentario"
        invalid={state !== null && !state.ok}
        aria-describedby={state && !state.ok ? `${textareaId}-error` : undefined}
      />

      <Checkbox id={anonymousId} name="anonymous" label={ANON_LABEL} hint={ANON_EXPLAINER} />

      {/* Los errores de formulario van inline y junto a su causa, nunca sólo en un
          toast (§17.5.6). El contenido escrito no se pierde. */}
      {state && !state.ok ? (
        <p id={`${textareaId}-error`} role="alert" className="text-s text-danger">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <SubmitButton pendingLabel="Enviando…">Comentar</SubmitButton>
        {onDone ? (
          <button
            type="button"
            onClick={onDone}
            className="inline-flex h-11 cursor-pointer items-center rounded-input px-2 text-m font-semibold text-accent hover:underline lg:h-9"
          >
            Cancelar
          </button>
        ) : null}
      </div>
    </form>
  )
}

/**
 * "Responder" sólo existe en los comentarios de primer nivel: la profundidad
 * máxima es 2 (D2), así que una respuesta no tiene a su vez botón de responder.
 */
export function CommentReply({
  postPublicId,
  parentPublicId,
  signedIn,
  locked = false,
}: {
  postPublicId: string
  parentPublicId: string
  signedIn: boolean
  locked?: boolean
}) {
  const [open, setOpen] = useState(false)

  if (locked) return null

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 cursor-pointer items-center rounded-input text-s text-text-secondary hover:underline lg:h-8"
      >
        Responder
      </button>
    )
  }

  return (
    <CommentForm
      postPublicId={postPublicId}
      parentPublicId={parentPublicId}
      signedIn={signedIn}
      textareaId={`responder-${parentPublicId}`}
      autoFocus
      onDone={() => setOpen(false)}
      className="mt-2"
    />
  )
}
