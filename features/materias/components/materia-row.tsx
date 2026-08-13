/**
 * features/materias/components/materia-row.tsx — la materia como fila de listado
 * (PART 18 §18.4 fila 9, PART 17 §17.7).
 *
 * Fila compacta, nunca tarjeta (D8: densidad por filas). Toda la fila es un link a
 * `/materias/[slug]`; la línea de meta lleva las carreras que la incluyen, cada una linkeando su
 * propia página — son links hermanos que quedan por encima de la capa que estira `ListRow`, así
 * que no hay anchors anidados.
 *
 * Se muestran hasta `MAX_CARRERAS` carreras y el resto se resume como "+2": una materia que
 * aparece en seis planes convertiría la línea de meta en un párrafo, y el dato completo está a
 * un clic, en la página de la materia.
 *
 * Renderiza un `<li>`: va dentro de un `<ul>`. Server Component puro.
 */
import Link from 'next/link'

import { ListRow } from '@/components/ui/list-row'

import type { MateriaCarrera, MateriaListItem } from '../queries'

/** Cuántas carreras se nombran antes de resumir el resto. */
const MAX_CARRERAS = 2

export function MateriaRow({
  materia,
  className,
}: {
  materia: MateriaListItem
  className?: string
}) {
  const visibles = materia.carreras.slice(0, MAX_CARRERAS)
  const ocultas = materia.carreras.length - visibles.length

  return (
    <ListRow
      className={className}
      href={`/materias/${materia.slug}`}
      title={materia.nombre}
      meta={
        materia.carreras.length > 0 ? (
          <span className="flex flex-wrap items-baseline gap-x-1">
            {visibles.map((carrera, index) => (
              <span key={`${carrera.slug}-${carrera.anio}`}>
                {index > 0 ? <span aria-hidden="true">· </span> : null}
                <Link href={`/carreras/${carrera.slug}`} className="hover:text-accent">
                  {carrera.nombre}
                </Link>{' '}
                <span>{planLabel(carrera)}</span>
              </span>
            ))}
            {ocultas > 0 ? <span>{`+${ocultas}`}</span> : null}
          </span>
        ) : null
      }
    />
  )
}

/** "2° año, 1er cuatrimestre" — el mismo formato que la línea de datos de §17.4.1. */
function planLabel(carrera: MateriaCarrera): string {
  // `cuatrimestre = 0` es materia anual (CHECK `cuatrimestre in (0,1,2)`, migración 0002).
  const cuatri =
    carrera.cuatrimestre === 0
      ? 'anual'
      : carrera.cuatrimestre === 1
        ? '1er cuatrimestre'
        : '2° cuatrimestre'
  const anio = carrera.anio === 1 ? '1er' : carrera.anio === 3 ? '3er' : `${carrera.anio}°`

  return `${anio} año, ${cuatri}`
}
