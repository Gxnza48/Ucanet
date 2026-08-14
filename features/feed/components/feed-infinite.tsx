'use client'

/**
 * features/feed/components/feed-infinite.tsx — la cola del feed que se sigue sola.
 *
 * PART 17 §17.5.2 evaluó tres paginaciones y eligió la tercera: sentinel que auto-carga las
 * primeras 3 páginas y después botón explícito. Las razones están escritas ahí y se cumplen
 * literal acá:
 *
 *   - El scroll infinito puro deja el footer —que lleva el descargo legal (D10)— inalcanzable,
 *     y premia el doomscroll que la institución rechaza. Por eso el tope de `AUTO_LOAD_MAX`.
 *   - El botón solo agrega fricción al chequeo de dos minutos, que es el uso central.
 *
 * EL OBSERVER ES UNA MEJORA, NO EL CAMINO. El botón "Cargar más" está SIEMPRE montado y
 * siempre funciona: con teclado, con lector de pantalla, con JS a medio cargar, en un
 * navegador sin `IntersectionObserver`. Si el observer no puede existir, la paginación no se
 * degrada — simplemente queda manual. Un feed cuya única forma de avanzar es scrollear con
 * el mouse no cumple §17.7, y esto no es negociable.
 *
 * Sin autoplay, sin animación de entrada, sin "cargando…" a pantalla completa (§17.5.4): las
 * filas nuevas aparecen y el foco no se mueve. El botón queda DEBAJO de las filas nuevas, así
 * que después de "Cargar más" el foco sigue en el mismo botón y se puede volver a apretar sin
 * volver a tabular — es la razón por la que las filas se insertan antes y no después.
 *
 * Renderiza `<li>`: vive adentro del `<ul>` de `FeedList`, no al lado. Las filas cargadas
 * pertenecen a la misma lista que las que trajo el servidor, y un lector de pantalla las
 * cuenta juntas.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import type { ActionResult } from '@/lib/result'

import type { FeedPage, PostListItem } from '../queries'
import { FeedRow } from './feed-row'

/** La firma de `loadMoreParaVos` / `loadMoreReciente` / `loadMoreMisMaterias`. */
export type LoadMoreFeed = (cursor: string) => Promise<ActionResult<FeedPage>>

/**
 * Cuántas páginas se cargan solas antes de exigir un clic (§17.5.2). Son ~75 filas más allá
 * de la primera: bastante para una sesión de lectura larga, poco para que el footer se vuelva
 * inalcanzable. El número está declarado acá, en un solo lugar, porque §17.5.2 lo marca como
 * "a magic number to tune" y la próxima persona tiene que poder encontrarlo.
 */
const AUTO_LOAD_MAX = 3

/** El sentinel dispara ~600px antes del final de la lista, como pide §17.5.2. */
const SENTINEL_ROOT_MARGIN = '600px 0px'

/** Último recurso: si la action explota, el lector igual recibe una oración accionable. */
const FALLBACK_ERROR = 'No pudimos cargar más publicaciones. Probá de nuevo.'

/** El texto que se le anuncia al lector de pantalla después de cada carga. */
function announce(added: number, done: boolean): string {
  const cuenta =
    added === 0
      ? 'No se agregaron publicaciones.'
      : added === 1
        ? 'Se agregó 1 publicación.'
        : `Se agregaron ${added.toLocaleString('es-AR')} publicaciones.`

  return done ? `${cuenta} Llegaste al final.` : cuenta
}

export function FeedInfinite({
  initialCursor,
  loadMore,
  showScope = true,
}: {
  /**
   * El `nextCursor` de la primera página. Si es null, `FeedList` ni monta este componente.
   *
   * `FeedList` lo usa además como `key`, y eso es parte del contrato de este componente: si
   * el servidor vuelve con una primera página distinta —se publicó algo, se revalidó la
   * ruta— el cursor cambia, React desmonta y remonta, y la cola acumulada se va con él. Sin
   * eso quedarían pegadas abajo las filas de la consulta anterior, duplicadas y fuera de orden.
   */
  initialCursor: string
  /** La Server Action de la pestaña. Cruza la frontera como referencia, no como código. */
  loadMore: LoadMoreFeed
  showScope?: boolean
}) {
  const [items, setItems] = useState<PostListItem[]>([])
  const [cursor, setCursor] = useState<string | null>(initialCursor)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [autoLoads, setAutoLoads] = useState(0)
  const [announcement, setAnnouncement] = useState('')

  const sentinelRef = useRef<HTMLDivElement>(null)
  // Espejos en refs de lo que el callback necesita leer sin volver a crearse: así `load`
  // depende solo de `loadMore` y el observer no se desarma en cada render.
  const cursorRef = useRef<string | null>(initialCursor)
  const pendingRef = useRef(false)
  // Guarda contra la fila repetida entre páginas. Con el keyset no debería pasar nunca, pero
  // una clave de React duplicada rompe la lista entera y el costo de prevenirlo es un Set.
  const seenRef = useRef(new Set<string>())

  const load = useCallback(
    async (source: 'auto' | 'manual') => {
      const next = cursorRef.current
      if (next === null || pendingRef.current) return

      pendingRef.current = true
      setPending(true)
      setError(null)

      try {
        const result = await loadMore(next)
        if (!result.ok) {
          setError(result.error)
          return
        }

        const page = result.data
        const nuevas = page.items.filter((item) => !seenRef.current.has(item.publicId))
        for (const item of nuevas) seenRef.current.add(item.publicId)

        cursorRef.current = page.nextCursor
        setCursor(page.nextCursor)
        setItems((prev) => [...prev, ...nuevas])
        setAnnouncement(announce(nuevas.length, page.nextCursor === null))
        if (source === 'auto') setAutoLoads((count) => count + 1)
      } catch {
        // La action ya devuelve `{ ok: false }` para lo esperable; acá cae lo que no lo es
        // (la red se cortó a mitad del POST). El botón pasa a "Reintentar" y no se pierde
        // nada: el cursor no se movió.
        setError(FALLBACK_ERROR)
      } finally {
        pendingRef.current = false
        setPending(false)
      }
    },
    [loadMore],
  )

  useEffect(() => {
    if (cursor === null || error !== null || autoLoads >= AUTO_LOAD_MAX) return
    // Navegador sin IntersectionObserver: no pasa nada, queda el botón.
    if (typeof IntersectionObserver === 'undefined') return

    const node = sentinelRef.current
    if (node === null) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void load('auto')
      },
      { rootMargin: SENTINEL_ROOT_MARGIN },
    )
    observer.observe(node)

    return () => observer.disconnect()
  }, [autoLoads, cursor, error, load])

  const agotado = cursor === null

  return (
    <>
      {items.map((post) => (
        <FeedRow key={post.publicId} post={post} showScope={showScope} />
      ))}

      <li className="relative flex flex-col items-start gap-3 py-6">
        {/* El sentinel es el punto que el observer mira, no un elemento de la interfaz: va
            absoluto para no ocupar una ranura del flex (si no, el `gap-3` abriría 12px de
            aire fantasma), y mide 1px de alto y no 0 porque un objetivo de área cero no
            reporta intersección de forma confiable en todos los navegadores. */}
        <div ref={sentinelRef} aria-hidden="true" className="absolute inset-x-0 top-0 h-px" />

        {/* Región viva: anuncia cuántas filas entraron. Va vacía hasta la primera carga, así
            no dice nada al montarse. `polite` y no `assertive` — esto no interrumpe. */}
        <p aria-live="polite" className="sr-only">
          {announcement}
        </p>

        {error !== null ? <p className="text-m text-danger">{error}</p> : null}

        {agotado ? (
          <p className="text-m text-text-secondary">No hay más publicaciones.</p>
        ) : (
          <Button
            variant="secondary"
            onClick={() => void load('manual')}
            pending={pending}
            pendingLabel="Cargando…"
          >
            {error !== null ? 'Reintentar' : 'Cargar más'}
          </Button>
        )}
      </li>
    </>
  )
}
