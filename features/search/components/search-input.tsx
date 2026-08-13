'use client'

/**
 * features/search/components/search-input.tsx — el buscador del header (PART 13 §13.6).
 *
 * Está en la lista blanca de cliente de PART 19 §19.3 ("search typeahead") y hace
 * exactamente lo que esa lista autoriza:
 *
 * - Sugiere SOLO materias, con 2 caracteres mínimo, 150 ms de debounce y 8 ítems
 *   como tope. Nada de publicaciones ni recursos: eso sería FTS por tecla, que es
 *   el costo que §13.5 rechaza de plano [FREE-TIER RISK].
 * - NO busca mientras se escribe. La búsqueda completa se dispara con Enter y va
 *   a `/buscar?q=…`, que es la URL durable del producto (D7).
 * - Elegir una sugerencia navega directo a la página de la materia; Enter sin
 *   selección envía la consulta.
 *
 * Sin JS el `<form method="get" action="/buscar">` sigue funcionando: el input es
 * progresivo, no un widget. Las sugerencias se guardan junto al término que las
 * produjo, así el estado visible se deriva del render y el efecto no llama a
 * `setState` de forma sincrónica (regla del compilador de React).
 */
import { Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'

import { cn } from '@/lib/cn'
import { suggestMateriasAction } from '../actions'

type Suggestion = { slug: string; nombre: string }

const MIN_LENGTH = 2
const DEBOUNCE_MS = 150

export function SearchInput({
  defaultValue = '',
  autoFocus = false,
  className,
}: {
  defaultValue?: string
  autoFocus?: boolean
  className?: string
}) {
  const router = useRouter()
  const inputId = useId()
  const listId = useId()

  const [value, setValue] = useState(defaultValue)
  const [suggestions, setSuggestions] = useState<{ term: string; items: Suggestion[] }>({
    term: '',
    items: [],
  })
  const [dismissed, setDismissed] = useState(true)
  const [active, setActive] = useState(-1)

  // Contador de pedidos: la respuesta vieja de una tecla anterior no puede pisar
  // a la nueva (las Server Actions no se cancelan).
  const requestSeq = useRef(0)

  const term = value.trim()
  const enabled = term.length >= MIN_LENGTH
  // Las sugerencias sólo valen para el término que las pidió: al borrar letras no
  // queda un resto de la búsqueda anterior colgando.
  const items = suggestions.term === term ? suggestions.items : []
  const open = enabled && !dismissed && items.length > 0
  const activeIndex = active >= 0 && active < items.length ? active : -1

  useEffect(() => {
    if (!enabled) return

    const seq = ++requestSeq.current
    const timer = setTimeout(() => {
      suggestMateriasAction(term)
        .then((rows) => {
          if (requestSeq.current !== seq) return
          setSuggestions({ term, items: rows })
        })
        .catch(() => {
          if (requestSeq.current !== seq) return
          setSuggestions({ term, items: [] })
        })
    }, DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [term, enabled])

  function goToMateria(slug: string) {
    setDismissed(true)
    setActive(-1)
    router.push(`/materias/${slug}`)
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (term.length === 0) return
    setDismissed(true)
    setActive(-1)
    router.push(`/buscar?q=${encodeURIComponent(term)}`)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setDismissed(true)
      setActive(-1)
      return
    }
    if (event.key === 'ArrowDown' && items.length > 0) {
      event.preventDefault()
      setDismissed(false)
      setActive((index) => (index + 1) % items.length)
      return
    }
    if (event.key === 'ArrowUp' && items.length > 0) {
      event.preventDefault()
      setDismissed(false)
      setActive((index) => (index <= 0 ? items.length - 1 : index - 1))
      return
    }
    if (event.key === 'Enter' && open && activeIndex >= 0) {
      const picked = items[activeIndex]
      if (picked) {
        event.preventDefault()
        goToMateria(picked.slug)
      }
    }
  }

  return (
    <form
      role="search"
      action="/buscar"
      method="get"
      onSubmit={onSubmit}
      className={cn('relative w-full', className)}
    >
      <label htmlFor={inputId} className="sr-only">
        Buscar en el sitio
      </label>
      <Search
        aria-hidden="true"
        size={16}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
      />
      <input
        id={inputId}
        name="q"
        type="search"
        value={value}
        autoFocus={autoFocus}
        autoComplete="off"
        spellCheck={false}
        placeholder="Buscar materias, publicaciones, recursos"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
        onChange={(event) => {
          setValue(event.target.value)
          setDismissed(false)
          setActive(-1)
        }}
        onKeyDown={onKeyDown}
        onFocus={() => setDismissed(false)}
        onBlur={() => setDismissed(true)}
        className={cn(
          'h-11 w-full rounded-input border border-border bg-surface pl-9 pr-3 lg:h-9',
          'text-base text-text-primary placeholder:text-text-secondary focus:border-accent',
        )}
      />

      <ul
        id={listId}
        role="listbox"
        aria-label="Materias sugeridas"
        className={cn(
          'absolute inset-x-0 top-full z-50 mt-1 rounded-container border border-border bg-bg p-1 shadow-overlay',
          open ? 'block' : 'hidden',
        )}
      >
        {items.map((item, index) => (
          <li
            key={item.slug}
            id={`${listId}-${index}`}
            role="option"
            aria-selected={index === activeIndex}
            // onMouseDown antes que el blur del input: si no, la lista se cierra
            // antes de que llegue el click.
            onMouseDown={(event) => {
              event.preventDefault()
              goToMateria(item.slug)
            }}
            onMouseEnter={() => setActive(index)}
            className={cn(
              'flex h-11 cursor-pointer items-center truncate rounded-input px-3 text-m text-text-primary sm:h-9',
              index === activeIndex ? 'bg-surface-raised' : null,
            )}
          >
            {item.nombre}
          </li>
        ))}
      </ul>
    </form>
  )
}
