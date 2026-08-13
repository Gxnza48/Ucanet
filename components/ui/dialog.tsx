'use client'

// components/ui/dialog.tsx — PART 18 §18.4 fila 13 ("Diálogo").
// Radix es la única dependencia de UI permitida (PART 19 §19.5): trampa de foco, Esc,
// scroll lock y aria-modal correctos. No sobreescribimos ese comportamiento.

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { isValidElement, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export { DialogClose } from '@radix-ui/react-dialog'

export function Dialog({
  trigger,
  title,
  description,
  children,
  open,
  onOpenChange,
  className,
}: {
  trigger: ReactNode
  title: string
  description?: string
  children: ReactNode
  open?: boolean
  onOpenChange?: (o: boolean) => void
  className?: string
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {/* asChild solo cuando el trigger ya es un elemento (Button, ButtonLink…);
          si es texto suelto, Radix necesita renderizar su propio <button>. */}
      {trigger == null ? null : isValidElement(trigger) ? (
        <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>
      ) : (
        <DialogPrimitive.Trigger>{trigger}</DialogPrimitive.Trigger>
      )}

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay transition duration-150 ease-out starting:opacity-0" />

        {/* Base = hoja inferior (mobile, <640px): pegada abajo, ancho completo, radio 4 arriba.
            sm+ = panel centrado de 400px máximo vía inset + margin auto (sin transform,
            para no pisar el desplazamiento de 2px de la entrada). */}
        <DialogPrimitive.Content
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 flex max-h-dvh w-full flex-col overflow-y-auto',
            'rounded-t-container border border-border bg-bg p-4 shadow-overlay',
            'transition duration-150 ease-out starting:translate-y-0.5 starting:opacity-0',
            'sm:inset-4 sm:m-auto sm:h-fit sm:max-w-100 sm:rounded-container sm:p-5',
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <DialogPrimitive.Title className="text-l font-semibold text-text-primary">
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              aria-label="Cerrar"
              className="-mt-2 -mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-input text-text-secondary hover:bg-surface-raised hover:text-text-primary sm:h-9 sm:w-9"
            >
              <X size={16} aria-hidden="true" />
            </DialogPrimitive.Close>
          </div>

          {description ? (
            <DialogPrimitive.Description className="mt-2 text-base text-text-secondary">
              {description}
            </DialogPrimitive.Description>
          ) : null}

          <div className="mt-4 text-base text-text-primary">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

// Contenedor de acciones del diálogo: alineadas a la derecha, la primaria va última
// en el DOM y por lo tanto más a la derecha (PART 18 §18.4 fila 13).
export function DialogActions({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('mt-5 flex flex-wrap items-center justify-end gap-2', className)}>
      {children}
    </div>
  )
}
