'use client'

/**
 * features/posts/components/composer.tsx — el compositor de publicaciones
 * (PART 17 §17.4.3, colapsado según §17.2.1).
 *
 * Está en la lista blanca de Client Components de PART 19 §19.3. Todo lo que
 * necesita JS está acá adentro y en ningún otro lado de la página: crecer el
 * textarea, el contador que aparece pasando los 9.000, el título que se despliega,
 * el chip de materia y el diálogo de descarte.
 *
 * Los campos son controlados a propósito. React 19 resetea los formularios
 * cuando termina una `action`, y §17.4.3 es explícito: ante un rechazo del
 * servidor el contenido NO se pierde. Con estado propio, el error se pinta arriba
 * de las acciones y lo escrito sigue ahí.
 *
 * `defaultExpanded` sirve para la ruta de composición a pantalla completa de
 * mobile; en escritorio la caja colapsada se expande en el lugar, sin modal.
 */
import { useActionState, useEffect, useId, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { useRouter } from 'next/navigation'
import { Button, SubmitButton } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Chip } from '@/components/ui/chip'
import { Dialog, DialogActions } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { LIMITS } from '@/lib/config'
import { cn } from '@/lib/cn'
import { createPost } from '../actions'
import { ANON_EXPLAINER, ANON_LABEL } from './comment-form'

/** El contador aparece recién acá: antes es ruido (§17.4.3). */
const COUNTER_THRESHOLD = 9_000

/** Por debajo de esto, "Cancelar" descarta sin preguntar (§17.4.3). */
const DISCARD_CONFIRM_THRESHOLD = 20

/** Tope de crecimiento del textarea antes de pasar a scroll interno (PART 18 §18.4 fila 5). */
const MAX_ROWS = 12

const NUMBER_FORMAT = new Intl.NumberFormat('es-AR')

export type MateriaOption = {
  slug: string
  nombre: string
}

export function Composer({
  materias,
  handle,
  defaultMateriaSlug,
  placeholder = '¿Qué está pasando en tu carrera?',
  defaultExpanded = false,
  className,
}: {
  /** Catálogo para el selector. Lo trae la página: una feature no importa a otra. */
  materias: MateriaOption[]
  /** Seudónimo de quien escribe, para la previsualización de firma. */
  handle?: string
  /** Materia pre-etiquetada (composer de la página de una materia). */
  defaultMateriaSlug?: string
  placeholder?: string
  defaultExpanded?: boolean
  className?: string
}) {
  const router = useRouter()
  const fieldId = useId()
  // `Textarea` es un componente de `components/ui` sin ref reenviada, así que el
  // acceso al nodo va por su contenedor. No es un rodeo caprichoso: modificar la
  // primitiva es tocar un archivo de otro dueño.
  const bodyBoxRef = useRef<HTMLDivElement>(null)
  const [state, formAction] = useActionState(createPost, null)

  const [expanded, setExpanded] = useState(defaultExpanded)
  const [body, setBody] = useState('')
  const [title, setTitle] = useState('')
  const [showTitle, setShowTitle] = useState(false)
  const [anonymous, setAnonymous] = useState(false)
  const [materia, setMateria] = useState<MateriaOption | null>(
    () => materias.find((option) => option.slug === defaultMateriaSlug) ?? null,
  )
  const [discardOpen, setDiscardOpen] = useState(false)

  // Publicada: se va a su página. El feed no tiene etiqueta de caché propia, así
  // que quedarse acá mostraría una lista sin la publicación recién escrita.
  useEffect(() => {
    if (state?.ok) router.push(`/p/${state.data.publicId}`)
  }, [state, router])

  useEffect(() => {
    if (expanded) bodyBoxRef.current?.querySelector('textarea')?.focus()
  }, [expanded])

  useAutoGrow(bodyBoxRef, body, expanded)

  function reset() {
    setBody('')
    setTitle('')
    setShowTitle(false)
    setAnonymous(false)
    setMateria(materias.find((option) => option.slug === defaultMateriaSlug) ?? null)
    setExpanded(defaultExpanded)
    setDiscardOpen(false)
  }

  function handleCancel() {
    if (body.trim().length > DISCARD_CONFIRM_THRESHOLD) {
      setDiscardOpen(true)
      return
    }
    reset()
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        onFocus={() => setExpanded(true)}
        className={cn(
          'flex h-11 w-full cursor-text items-center rounded-input border border-border bg-surface px-3',
          'text-base text-text-secondary transition-colors duration-150 ease-out hover:border-text-secondary lg:h-11',
          className,
        )}
      >
        {placeholder}
      </button>
    )
  }

  const overThreshold = body.length > COUNTER_THRESHOLD

  return (
    <form action={formAction} className={cn('flex flex-col gap-3 py-3', className)}>
      {handle ? (
        <p className="text-s text-text-secondary">
          Publicás como <span className="text-text-primary">{anonymous ? 'Anónimo' : handle}</span>
        </p>
      ) : null}

      <label htmlFor={`${fieldId}-body`} className="sr-only">
        Tu publicación
      </label>
      <div ref={bodyBoxRef}>
        <Textarea
          id={`${fieldId}-body`}
          name="body"
          rows={3}
          required
          value={body}
          maxLength={LIMITS.postBody}
          placeholder={placeholder}
          onChange={(event) => setBody(event.target.value)}
          invalid={state !== null && !state.ok}
        />
      </div>

      {overThreshold ? (
        <p className="text-right text-s text-text-secondary" aria-live="polite">
          {NUMBER_FORMAT.format(body.length)}/{NUMBER_FORMAT.format(LIMITS.postBody)}
        </p>
      ) : null}

      {showTitle || title.length > 0 ? (
        <>
          <label htmlFor={`${fieldId}-title`} className="sr-only">
            Título (opcional)
          </label>
          <Input
            id={`${fieldId}-title`}
            name="title"
            value={title}
            maxLength={LIMITS.postTitle}
            autoComplete="off"
            placeholder="Título (opcional)"
            onChange={(event) => setTitle(event.target.value)}
          />
        </>
      ) : (
        // La mayoría de las publicaciones cortas no necesitan título y un campo
        // vacío a la vista sólo insiste (§17.4.3).
        <Button variant="tertiary" onClick={() => setShowTitle(true)} className="self-start">
          + Agregar título
        </Button>
      )}

      <div className="flex flex-col gap-3">
        <input type="hidden" name="materiaSlug" value={materia?.slug ?? ''} />
        {materia ? (
          <Chip onRemove={() => setMateria(null)} className="self-start">
            {materia.nombre}
          </Chip>
        ) : (
          <>
            <label htmlFor={`${fieldId}-materia`} className="sr-only">
              Materia (opcional)
            </label>
            {/* `<input list>` + `<datalist>`: buscador nativo, accesible y sin un
                solo byte de librería (D14.8). */}
            <Input
              id={`${fieldId}-materia`}
              list={`${fieldId}-materias`}
              autoComplete="off"
              placeholder="Materia (opcional)"
              onChange={(event) => setMateria(matchMateria(materias, event.target.value))}
            />
            <datalist id={`${fieldId}-materias`}>
              {materias.map((option) => (
                <option key={option.slug} value={option.nombre} />
              ))}
            </datalist>
            <p className="text-s text-text-secondary">
              Etiquetá una materia para que tu publicación quede en su página. Los posts sin materia
              se muestran a tu carrera.
            </p>
          </>
        )}

        <Checkbox name="kind" value="pregunta" label="Es una pregunta" />

        <Checkbox
          name="anonymous"
          label={ANON_LABEL}
          hint={ANON_EXPLAINER}
          checked={anonymous}
          onChange={(event) => setAnonymous(event.target.checked)}
        />
      </div>

      {/* El rechazo del servidor se pinta acá, arriba de las acciones, y lo
          escrito no se pierde (§17.4.3). */}
      {state && !state.ok ? (
        <p role="alert" className="text-s text-danger">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <SubmitButton disabled={body.trim().length === 0}>Publicá</SubmitButton>
        <Button variant="tertiary" onClick={handleCancel}>
          Cancelar
        </Button>
      </div>

      <Dialog
        trigger={null}
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title="¿Descartar la publicación?"
      >
        <DialogActions>
          <Button variant="tertiary" onClick={() => setDiscardOpen(false)}>
            Seguir escribiendo
          </Button>
          <Button variant="danger" onClick={reset}>
            Descartar
          </Button>
        </DialogActions>
      </Dialog>
    </form>
  )
}

/** Coincidencia exacta por nombre: lo que el `<datalist>` deja elegir. */
function matchMateria(materias: MateriaOption[], value: string): MateriaOption | null {
  const needle = value.trim().toLocaleLowerCase('es-AR')
  if (needle.length === 0) return null
  return materias.find((option) => option.nombre.toLocaleLowerCase('es-AR') === needle) ?? null
}

/**
 * Crece de 3 filas hasta 12 y ahí pasa a scroll interno. El tope se deriva del
 * line-height computado (que sale de los tokens), no de un número mágico.
 */
function useAutoGrow(ref: RefObject<HTMLDivElement | null>, value: string, enabled: boolean) {
  useEffect(() => {
    const element = ref.current?.querySelector('textarea')
    if (!element || !enabled) return

    const styles = getComputedStyle(element)
    const lineHeight = Number.parseFloat(styles.lineHeight)
    const padding =
      Number.parseFloat(styles.paddingTop) +
      Number.parseFloat(styles.paddingBottom) +
      Number.parseFloat(styles.borderTopWidth) +
      Number.parseFloat(styles.borderBottomWidth)

    if (Number.isFinite(lineHeight)) {
      element.style.maxHeight = `${lineHeight * MAX_ROWS + padding}px`
    }

    element.style.height = 'auto'
    element.style.height = `${element.scrollHeight}px`
  }, [ref, value, enabled])
}
