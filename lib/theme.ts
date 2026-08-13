/**
 * lib/theme.ts — tema claro/oscuro leído en el servidor (PART 18 §18.7).
 *
 * El modo oscuro sale el día uno (D8) y el tema elegido se guarda en una cookie
 * para que el HTML del SSR ya venga con el `data-theme` correcto: sin script de
 * tema en el camino crítico y sin destello del tema equivocado.
 *
 * Los tres valores viven en es-AR porque la cookie es visible para el usuario en
 * las herramientas del navegador y porque el toggle escribe exactamente esto:
 *
 *     theme=auto    → sigue a `prefers-color-scheme` (sin atributo en <html>)
 *     theme=claro   → data-theme="light"
 *     theme=oscuro  → data-theme="dark"
 *
 * Los nombres del atributo son `light`/`dark` y no se traducen: son la clave que
 * `app/tokens.css` usa en `[data-theme='dark']` y en la media query.
 */

/** Los tres estados posibles del tema. */
export type Theme = 'auto' | 'claro' | 'oscuro'

/** Nombre de la cookie de tema (§0.5-R23). */
export const THEME_COOKIE = 'theme'

/**
 * Lee el tema de la cookie. Cualquier valor desconocido cae en `auto`, que es el
 * comportamiento correcto para un usuario que nunca eligió.
 *
 * `next/headers` se importa de forma diferida a propósito: así el toggle cliente
 * puede importar `THEME_COOKIE` desde este mismo módulo sin arrastrar una API de
 * servidor a su bundle. La constante y el lector viven juntos porque son la
 * misma decisión.
 */
export async function getTheme(): Promise<Theme> {
  const { cookies } = await import('next/headers')
  const store = await cookies()
  const value = store.get(THEME_COOKIE)?.value

  return value === 'claro' || value === 'oscuro' ? value : 'auto'
}

/**
 * Valor del atributo `data-theme` del `<html>`.
 *
 * `auto` devuelve `undefined` — la ausencia del atributo es lo que deja mandar a
 * `prefers-color-scheme` en `tokens.css`. React omite el atributo cuando el
 * valor es `undefined`, así que se pasa directo: `<html data-theme={...}>`.
 */
export function themeAttribute(theme: Theme): 'light' | 'dark' | undefined {
  if (theme === 'claro') return 'light'
  if (theme === 'oscuro') return 'dark'
  return undefined
}
