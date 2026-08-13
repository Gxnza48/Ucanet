/**
 * components/ui/button.tsx — Botón primario / secundario / terciario / danger
 * (BUILD-CONTRACT §4.4, PART 18 §18.4 filas 1-3).
 *
 * `Button` y `ButtonLink` son Server Components: las páginas de contenido no
 * pueden pagar JS de cliente por un botón (BUILD-CONTRACT §8). El único que cruza
 * al cliente es `SubmitButton`, reexportado más abajo desde su propio módulo.
 *
 * La variante `danger` es la variante peligrosa del botón terciario que fija
 * PART 18 §18.4 fila 3: texto en --color-danger, sin relleno ("Eliminá").
 */
import Link from 'next/link'
import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react'
import { ButtonLabel, buttonClasses, type ButtonVariant } from './button-styles'

export { SubmitButton, type SubmitButtonProps } from './submit-button'
export type { ButtonVariant }

export type ButtonProps = {
  variant?: ButtonVariant
  /** Estado de envío controlado por el consumidor. Bloquea el ancho y deshabilita. */
  pending?: boolean
  /** Texto de progreso. Por defecto "Publicando…". */
  pendingLabel?: string
} & ButtonHTMLAttributes<HTMLButtonElement>

/**
 * `type` es "button" por defecto, no "submit" como manda el HTML: dentro de un
 * form el que envía es `SubmitButton`, y así el "Cancelar" del compositor (PART 17
 * §17.4.3) no manda la publicación de casualidad. Para enviar: `SubmitButton`, o
 * `type="submit"` explícito.
 */
export function Button({
  variant = 'primary',
  pending,
  pendingLabel,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={buttonClasses(variant, className)}
    >
      <ButtonLabel pending={pending} pendingLabel={pendingLabel}>
        {children}
      </ButtonLabel>
    </button>
  )
}

export type ButtonLinkProps = {
  variant?: ButtonVariant
} & AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }

/**
 * Link con apariencia de botón. Usa `next/link` para navegar sin recarga: las
 * URLs son parte del contrato del producto (D7) y un `<a>` pelado tiraría abajo
 * el árbol de React en cada "Crear cuenta" o "Subí un recurso".
 */
export function ButtonLink({
  variant = 'primary',
  className,
  href,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link {...rest} href={href} className={buttonClasses(variant, className)}>
      {children}
    </Link>
  )
}
