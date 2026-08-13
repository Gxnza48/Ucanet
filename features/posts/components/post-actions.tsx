'use client'

/**
 * features/posts/components/post-actions.tsx — la barra de acciones de la página
 * del post (PART 17 §17.4.2).
 *
 * Orden fijo: voto · "Comentar" · "Compartir" · menú de desborde. "Reportar" vive
 * en el desborde a propósito: visible para quien lo busca, no tan a mano como
 * para volverse un reflejo en medio de una discusión (§17.4.2).
 *
 * "Comentar" es un `<a href="#comentar">` y no un botón con JS: la navegación por
 * fragmento del navegador ya desplaza Y enfoca el textarea, gratis y sin bundle.
 *
 * El diálogo de reporte lo provee features/mod y entra por la ranura
 * `reportDialog`. Como los límites de import prohíben que una feature importe a
 * otra, acá no se sabe nada de él: si el nodo es un elemento, se le inyectan
 * `open`/`onOpenChange` con `cloneElement` —el mismo patrón que ya usa
 * `components/ui/field.tsx`— para que el ítem "Reportar" del menú lo abra. Si el
 * nodo ignora esas props, sigue funcionando con su propio disparador.
 */
import { MoreHorizontal } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cloneElement, isValidElement, useActionState, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Button, SubmitButton } from '@/components/ui/button'
import { buttonClasses } from '@/components/ui/button-styles'
import { Dialog, DialogActions, DialogClose } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Menu, type MenuItem } from '@/components/ui/menu'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { LIMITS } from '@/lib/config'
import { absoluteUrl } from '@/lib/env'
import { cn } from '@/lib/cn'
import { deletePost, updatePost } from '../actions'
import { VoteButton } from './vote-button'

/** Props que `PostActions` intenta inyectarle a la ranura del diálogo de reporte. */
type ControllableSlot = {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function PostActions({
  publicId,
  title,
  body,
  label,
  score,
  voted,
  signedIn,
  isAuthor = false,
  isMod = false,
  locked = false,
  materiaSlug,
  moderateHref,
  reportDialog,
  className,
}: {
  publicId: string
  /** Título actual, para precargar el formulario de edición. */
  title?: string | null
  /** Cuerpo actual, para precargar el formulario de edición. */
  body?: string | null
  /** Nombre del objeto en el diálogo de borrado ("¿Eliminar la publicación «…»?"). */
  label: string
  score: number
  voted: boolean
  signedIn: boolean
  /** Habilita "Editar" y "Eliminar". La RPC vuelve a verificar autoría y ventana. */
  isAuthor?: boolean
  isMod?: boolean
  /** Hilo bloqueado (§0.5-R5): sin comentarios nuevos. */
  locked?: boolean
  /** Slug de la materia, para invalidar `materia:<slug>` al editar o eliminar. */
  materiaSlug?: string
  /** Destino de "Moderar" para el panel de moderación. */
  moderateHref?: string
  /** Diálogo de reporte (features/mod). Ver el encabezado del archivo. */
  reportDialog?: ReactNode
  className?: string
}) {
  const router = useRouter()
  const toast = useToast()
  const [reportOpen, setReportOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const [editState, editAction] = useActionState(updatePost, null)
  const [deleteState, deleteAction] = useActionState(deletePost, null)

  // Cerrar el diálogo al guardar es un ajuste de estado derivado, no un efecto:
  // se compara la identidad del resultado durante el render (patrón oficial de
  // React) para no encadenar un render extra por cada guardado.
  const [lastEdit, setLastEdit] = useState(editState)
  if (lastEdit !== editState) {
    setLastEdit(editState)
    if (editState?.ok) setEditOpen(false)
  }

  useEffect(() => {
    if (deleteState?.ok) {
      // La publicación ya no existe: su URL responde 410 (§0.5-R23c), así que no
      // se puede volver atrás a ella. `replace` la saca del historial.
      router.replace('/')
    }
  }, [deleteState, router])

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(absoluteUrl(`/p/${publicId}`))
      toast.show('Link copiado')
    } catch {
      toast.show('No pudimos copiar el link.')
    }
  }

  const items: MenuItem[] = []
  if (reportDialog && signedIn) {
    items.push({ label: 'Reportar', onSelect: () => setReportOpen(true) })
  }
  if (isAuthor) {
    items.push({ label: 'Editar', onSelect: () => setEditOpen(true) })
    items.push({ label: 'Eliminar', onSelect: () => setDeleteOpen(true), danger: true })
  }
  if (isMod && moderateHref) {
    items.push({ label: 'Moderar', href: moderateHref })
  }

  const report = isValidElement<ControllableSlot>(reportDialog)
    ? cloneElement(reportDialog, { open: reportOpen, onOpenChange: setReportOpen })
    : reportDialog

  return (
    <div className={cn('flex flex-wrap items-center gap-1', className)}>
      <VoteButton
        target="publicacion"
        publicId={publicId}
        score={score}
        voted={voted}
        signedIn={signedIn}
        disabled={isAuthor}
        className="mr-2"
      />

      {locked ? null : (
        <a href="#comentar" className={buttonClasses('tertiary')}>
          Comentar
        </a>
      )}

      <Button variant="tertiary" onClick={copyLink}>
        Compartir
      </Button>

      {items.length > 0 ? (
        <Menu
          trigger={
            <button
              type="button"
              aria-label="Más opciones"
              className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-input text-text-secondary transition-colors duration-150 ease-out hover:bg-surface-raised hover:text-text-primary lg:h-9 lg:w-9"
            >
              <MoreHorizontal aria-hidden="true" size={16} />
            </button>
          }
          items={items}
        />
      ) : null}

      {report}

      {isAuthor ? (
        <>
          <Dialog
            trigger={null}
            open={editOpen}
            onOpenChange={setEditOpen}
            title="Editar la publicación"
          >
            <form action={editAction} className="flex flex-col gap-3">
              <input type="hidden" name="publicId" value={publicId} />
              {materiaSlug ? <input type="hidden" name="materiaSlug" value={materiaSlug} /> : null}

              <Field label="Título (opcional)" htmlFor="editar-titulo">
                <Input
                  name="title"
                  defaultValue={title ?? ''}
                  maxLength={LIMITS.postTitle}
                  autoComplete="off"
                />
              </Field>

              <Field label="Publicación" htmlFor="editar-cuerpo" required>
                <Textarea
                  name="body"
                  defaultValue={body ?? ''}
                  rows={6}
                  maxLength={LIMITS.postBody}
                  required
                />
              </Field>

              {editState && !editState.ok ? (
                <p role="alert" className="text-s text-danger">
                  {editState.error}
                </p>
              ) : null}

              <DialogActions>
                <DialogClose asChild>
                  <Button variant="tertiary">Cancelar</Button>
                </DialogClose>
                <SubmitButton pendingLabel="Guardando…">Guardar</SubmitButton>
              </DialogActions>
            </form>
          </Dialog>

          <Dialog
            trigger={null}
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            title={`¿Eliminar la publicación «${label}»?`}
            description="No se puede deshacer."
          >
            <form action={deleteAction}>
              <input type="hidden" name="publicId" value={publicId} />
              {materiaSlug ? <input type="hidden" name="materiaSlug" value={materiaSlug} /> : null}

              {deleteState && !deleteState.ok ? (
                <p role="alert" className="text-s text-danger">
                  {deleteState.error}
                </p>
              ) : null}

              <DialogActions>
                <DialogClose asChild>
                  <Button variant="tertiary">Cancelar</Button>
                </DialogClose>
                <SubmitButton variant="danger" pendingLabel="Eliminando…">
                  Eliminá
                </SubmitButton>
              </DialogActions>
            </form>
          </Dialog>
        </>
      ) : null}
    </div>
  )
}
