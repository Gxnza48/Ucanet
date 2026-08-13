/**
 * lib/cn.ts — concatenación de clases, sin dependencias (BUILD-CONTRACT §4.3).
 *
 * Filtra los valores falsy y une con un espacio. Deliberadamente NO resuelve
 * conflictos entre utilidades de Tailwind (no es `tailwind-merge`, y agregar una
 * dependencia exigiría una entrada en docs/decisions.md — D14 regla 8). La
 * convención de `components/ui/` es: clases base primero, `className` del
 * consumidor al final, y las utilidades en conflicto se evitan pasando el ancho
 * o el color desde un contenedor, no pisando la clase base.
 *
 * También sirve para armar listas de ids separadas por espacio (`aria-describedby`).
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter((value): value is string => Boolean(value)).join(' ')
}
