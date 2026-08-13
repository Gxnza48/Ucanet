/**
 * components/ui/wordmark.tsx — PART 18 §18.6.
 *
 * El wordmark es texto vivo, no imagen: serif 600 a 18px, letter-spacing -0.01em, color primario,
 * y el punto en acento — el único gesto de marca del producto.
 *
 * D10 (vinculante): el nombre sale de `SITE_NAME_PARTS`, derivado de la constante única
 * `SITE_NAME`. Renombrar a cualquier `palabra.tld` es un cambio de config y cero trabajo de
 * assets. Si el nombre no tiene punto, `tld` viene vacío y esto renderiza texto plano.
 *
 * El letter-spacing va en `style` a propósito: -0.01em es un valor de PART 18 que no tiene token
 * ni utilidad equivalente, y un valor arbitrario de Tailwind está prohibido.
 */
import { SITE_NAME_PARTS } from '@/lib/config'
import { cn } from '@/lib/cn'

export function Wordmark({ className }: { className?: string }) {
  const { head, tld } = SITE_NAME_PARTS

  return (
    <span
      style={{ letterSpacing: '-0.01em' }}
      className={cn('font-serif text-l font-semibold text-text-primary', className)}
    >
      {head}
      {tld ? (
        <>
          <span className="text-accent">.</span>
          {tld}
        </>
      ) : null}
    </span>
  )
}
