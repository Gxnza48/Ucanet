'use client'

// components/ui/toast.tsx — PART 18 §18.4 fila 15 ("Toast").
// Sin dependencias nuevas (D14.8): la cola es useState + useRef, no un paquete de toasts.
// Confirmaciones efímeras únicamente; los errores de formulario van inline (PART 17 §17.5.6).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

const TOAST_DURATION_MS = 5000

export type ToastAction = { label: string; onClick: () => void }

type ToastItem = { id: number; message: string; action?: ToastAction }

type ToastContextValue = { show: (message: string, action?: ToastAction) => void }

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (context === null) {
    throw new Error('useToast() requiere que el árbol esté dentro de <ToastProvider>.')
  }
  return context
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<ToastItem[]>([])
  const [paused, setPaused] = useState(false)
  const lastId = useRef(0)
  const remaining = useRef(TOAST_DURATION_MS)

  const show = useCallback((message: string, action?: ToastAction) => {
    lastId.current += 1
    setQueue((previous) => [...previous, { id: lastId.current, message, action }])
  }, [])

  const dismiss = useCallback(() => {
    setQueue((previous) => previous.slice(1))
    setPaused(false)
  }, [])

  // Máximo 1 visible; el resto espera en la cola (PART 18 §18.4 fila 15).
  const current = queue[0]
  const currentId = current?.id

  // Cada toast nuevo arranca con los 5 s completos.
  useEffect(() => {
    remaining.current = TOAST_DURATION_MS
  }, [currentId])

  // Auto-cierre a los 5 s; en pausa se guarda el tiempo restante y se retoma desde ahí.
  useEffect(() => {
    if (currentId === undefined || paused) return
    const startedAt = Date.now()
    const timer = window.setTimeout(dismiss, remaining.current)
    return () => {
      window.clearTimeout(timer)
      remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt))
    }
  }, [currentId, paused, dismiss])

  const value = useMemo<ToastContextValue>(() => ({ show }), [show])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* La región viva se monta siempre: si apareciera junto con el mensaje,
          varios lectores de pantalla no lo anunciarían. */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-18 z-50 flex justify-center md:bottom-4 md:justify-start"
      >
        {current ? (
          <div
            key={current.id}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
            className="pointer-events-auto flex w-full max-w-90 items-center gap-3 rounded-container border border-border bg-surface-raised px-4 py-3 text-m text-text-primary shadow-overlay transition duration-150 ease-out starting:translate-y-0.5 starting:opacity-0"
          >
            <span className="min-w-0 flex-1">{current.message}</span>
            {current.action ? (
              <button
                type="button"
                onClick={() => {
                  current.action?.onClick()
                  dismiss()
                }}
                className="-my-2 flex min-h-11 shrink-0 items-center rounded-input px-2 text-m font-semibold text-accent hover:underline md:my-0 md:min-h-9"
              >
                {current.action.label}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </ToastContext.Provider>
  )
}
