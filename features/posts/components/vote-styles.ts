/**
 * features/posts/components/vote-styles.ts — las métricas del control de voto,
 * compartidas entre el botón interactivo y su versión de solo lectura.
 *
 * Vive en su propio módulo, SIN directiva, por la misma razón que
 * `components/ui/button-styles.tsx`: `vote-button.tsx` es `'use client'` y en
 * Next todo lo que exporta un módulo de cliente se vuelve una referencia de
 * cliente — un Server Component no puede llamar a una función que viva ahí. La
 * fila del feed (`post-row.tsx`, Server Component) necesita exactamente estas
 * clases para pintar el link de "ingresá para votar" idéntico al botón real, así
 * que las clases tienen que estar en un módulo neutro que los dos puedan importar.
 *
 * Las clases se escriben literales y completas: Tailwind v4 escanea el texto
 * fuente, y un nombre de clase armado por concatenación no se generaría nunca.
 */
import { cn } from '@/lib/cn'

/**
 * Dos tamaños, dos contextos:
 * - `normal`: la barra de acciones de la página del post (PART 17 §17.4.2).
 * - `compacto`: la línea de acciones de una fila de feed, donde el control convive
 *   con texto de 13px y no puede dominar la fila.
 */
export type VoteSize = 'normal' | 'compacto'

/** Tamaño de la flecha de cada variante (PART 18 §18.5: lucide, stroke 2, currentColor). */
export const VOTE_ICON_SIZE: Record<VoteSize, number> = {
  normal: 14,
  compacto: 12,
}

const BASE =
  'inline-flex cursor-pointer items-center gap-1 rounded-input border no-underline ' +
  'transition-colors duration-150 ease-out ' +
  'disabled:cursor-not-allowed disabled:opacity-40'

/**
 * `normal` conserva las medidas originales del control: 44px táctiles hasta
 * 1023px y 32px de 1024px en adelante (PART 17 §17.6).
 *
 * `compacto` mide 28px de alto SIEMPRE —una fila de feed con un control de 44px
 * deja de ser una fila densa y pasa a ser una tarjeta (D8)— y recupera el área
 * táctil con un pseudo-elemento: `-inset-y-2` suma 8px arriba y 8px abajo, o sea
 * 28 + 16 = **44px de alto tocable**, y `-inset-x-1` deja el ancho por encima de
 * 44px incluso con un score de un solo dígito. Es el mismo truco que ya usa la x
 * del chip removible (`components/ui/chip.tsx`): el área crece, el dibujo no.
 * El área ampliada queda dentro de la ranura `trailing` de `ListRow`, que va en
 * `z-10`, así que gana contra el `::after` que estira el link de la fila.
 */
const SIZES: Record<VoteSize, string> = {
  normal: 'h-11 px-2 text-m lg:h-8',
  compacto: 'relative h-7 px-2 text-s after:absolute after:-inset-x-1 after:-inset-y-2',
}

/** Votado: relleno sutil de acento. Sin votar: hairline neutra que se aviva en hover. */
const TONES = {
  voted: 'border-accent bg-accent-subtle text-accent',
  idle: 'border-border text-text-secondary hover:border-text-secondary hover:bg-surface-raised',
}

export function voteControlClasses(tamano: VoteSize, voted: boolean, className?: string): string {
  return cn(BASE, SIZES[tamano], voted ? TONES.voted : TONES.idle, className)
}
