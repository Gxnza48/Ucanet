'use client'

/**
 * app/_components/theme-toggle.tsx — el control de tema (PART 18 §18.7, §17.4.8).
 *
 * Está en la lista blanca de cliente de PART 19 §19.3 ("theme toggle") y hace lo
 * mínimo que justifica ese permiso:
 *
 * 1. Escribe la cookie `theme` — la misma que lee `getTheme()` en el servidor, así
 *    que la próxima navegación ya llega con el `data-theme` correcto y sin
 *    destello (§18.7).
 * 2. Estampa el atributo en el `<html>` en el acto, para que el cambio se vea
 *    antes de que vuelva nada del servidor.
 * 3. Pide un `router.refresh()` para que el árbol servidor (este mismo control,
 *    que muestra el estado actual) quede en sincronía.
 *
 * La cookie se escribe desde el cliente y no con una Server Action a propósito: es
 * una preferencia de presentación, no toca la base, no tiene nada que validar y una
 * acción de servidor le costaría un round-trip a cada cambio de tema.
 *
 * `applyTheme` se exporta porque el ítem "Modo oscuro" del menú de cuenta
 * (§17.1.1, slot 5) es el mismo control con otra carcasa: el menú de Radix no puede
 * contener un botón propio, así que reusa la función y no el componente.
 */
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

import { cn } from '@/lib/cn'
import { THEME_COOKIE, themeAttribute, type Theme } from '@/lib/theme'

/** Un año: la preferencia de tema no caduca en la práctica. */
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

/** Orden del ciclo, igual al de los radios de Ajustes (§17.4.8). */
const CYCLE: readonly Theme[] = ['auto', 'claro', 'oscuro']

const LABELS: Record<Theme, string> = {
  auto: 'automático',
  claro: 'claro',
  oscuro: 'oscuro',
}

/** El siguiente tema del ciclo automático → claro → oscuro → automático. */
export function nextTheme(current: Theme): Theme {
  const index = CYCLE.indexOf(current)
  return CYCLE[(index + 1) % CYCLE.length] ?? 'auto'
}

/**
 * Guarda el tema y lo aplica al documento en el acto.
 *
 * `samesite=lax` y sin `httponly`: la cookie la escribe el cliente y la lee el
 * servidor; no protege nada, solo recuerda una preferencia. `secure` solo cuando
 * la página ya está en https, para que siga funcionando en `localhost`.
 */
export function applyTheme(theme: Theme): void {
  const secure = window.location.protocol === 'https:' ? '; secure' : ''
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax${secure}`

  const attribute = themeAttribute(theme)
  if (attribute) {
    document.documentElement.dataset.theme = attribute
  } else {
    // `auto` es la ausencia del atributo: así vuelve a mandar `prefers-color-scheme`.
    delete document.documentElement.dataset.theme
  }
}

/**
 * Botón que cicla el tema. Muestra el estado actual como texto visible — un ícono
 * de sol/luna solo tendría sentido con dos estados, y acá son tres (§17.4.8).
 */
export function ThemeToggle({ theme, className }: { theme: Theme; className?: string }) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const target = nextTheme(theme)

  return (
    <button
      type="button"
      // El nombre accesible dice qué hace el botón, no solo en qué estado está:
      // el texto visible por sí solo se leería como una etiqueta, no como acción.
      aria-label={`Tema: ${LABELS[theme]}. Cambiar a ${LABELS[target]}.`}
      onClick={() => {
        applyTheme(target)
        startTransition(() => router.refresh())
      }}
      className={cn(
        'inline-flex min-h-11 cursor-pointer items-center rounded-input px-2 text-s',
        'text-text-secondary hover:text-text-primary lg:min-h-9',
        className,
      )}
    >
      <span aria-hidden="true">Tema: {LABELS[theme]}</span>
    </button>
  )
}
