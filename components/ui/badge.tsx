/**
 * components/ui/badge.tsx — PART 18 §18.4 fila 12, "Badge de avisos".
 *
 * Contador numérico: 11px/600, fondo acento, texto on-accent, radio 2px, ancho mínimo 16px.
 * El radio de 2px es firma deliberada frente a la píldora universal (§18.3, anti-checklist 3).
 * Tope visual "9+"; el lector de pantalla recibe el número real más `label`
 * (por ejemplo: `label="avisos sin leer"` → "12 avisos sin leer").
 * Con `count` en cero no renderiza nada.
 */
import { cn } from '@/lib/cn'

export function Badge({
  count,
  label,
  className,
}: {
  count: number
  label: string
  className?: string
}) {
  if (!Number.isFinite(count) || count <= 0) return null

  const display = count > 9 ? '9+' : String(count)

  return (
    <span
      className={cn(
        'inline-flex h-4 min-w-4 items-center justify-center rounded-input bg-accent px-1',
        'text-xs font-semibold text-on-accent',
        className,
      )}
    >
      <span aria-hidden="true">{display}</span>
      <span className="sr-only">
        {count} {label}
      </span>
    </span>
  )
}
