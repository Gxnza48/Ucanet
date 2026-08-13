/**
 * features/materias/components/materia-header.tsx — el bloque de encabezado de la materia
 * (PART 17 §17.4.1).
 *
 * Estructura literal de la spec, de arriba abajo:
 *   1. el nombre como `h1` en serif (28px/600, `text-2xl font-serif`, PART 18 tipografía);
 *   2. la línea de datos: las carreras que la incluyen como chips con año y cuatrimestre,
 *      cada uno linkeando su carrera — "Abogacía (2° año, 1er cuatrimestre)";
 *   3. la descripción editorial, si el catálogo la tiene;
 *   4. el botón de seguir y el conteo de seguidores.
 *
 * Sin sesión el botón se reemplaza por una puerta a `/ingresar?next=…` (un `ButtonLink`, no un
 * botón muerto): la página es pública y legible para cualquiera (C16), pero seguir una materia
 * necesita cuenta. Así el visitante sin sesión no descubre que el botón no hace nada recién
 * después de tocarlo.
 *
 * Server Component: lo único que cruza al cliente es `FollowButton`.
 */
import { Chip } from '@/components/ui/chip'
import { ButtonLink } from '@/components/ui/button'
import { cn } from '@/lib/cn'

import type { MateriaCarrera, MateriaDetail } from '../queries'
import { FollowButton } from './follow-button'

export function MateriaHeader({
  materia,
  siguiendo,
  logueado,
  nextHref,
  className,
}: {
  materia: MateriaDetail
  siguiendo: boolean
  logueado: boolean
  /** A dónde volver después de ingresar. Por defecto, la propia página de la materia. */
  nextHref?: string
  className?: string
}) {
  const volverA = nextHref ?? `/materias/${materia.slug}`

  return (
    <header className={cn('mt-3', className)}>
      <h1 className="font-serif text-2xl font-semibold text-text-primary">{materia.nombre}</h1>

      {materia.carreras.length > 0 ? (
        <p className="mt-2 flex flex-wrap items-center gap-2 text-m text-text-secondary">
          {materia.carreras.map((carrera) => (
            <Chip key={`${carrera.slug}-${carrera.anio}`} href={`/carreras/${carrera.slug}`}>
              {carrera.nombre} ({planLabel(carrera)})
            </Chip>
          ))}
        </p>
      ) : null}

      {materia.descripcion ? (
        <p className="mt-3 text-base text-text-secondary">{materia.descripcion}</p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-4">
        {logueado ? (
          <FollowButton materiaId={materia.id} nombre={materia.nombre} following={siguiendo} />
        ) : (
          <ButtonLink variant="secondary" href={`/ingresar?next=${volverA}`}>
            Seguir
          </ButtonLink>
        )}
        <span className="text-m text-text-secondary">
          {seguidoresLabel(materia.followersCount)}
        </span>
      </div>
    </header>
  )
}

/** "2° año, 1er cuatrimestre" — el formato exacto de la línea de datos de §17.4.1. */
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

function seguidoresLabel(count: number): string {
  return count === 1 ? '1 seguidor' : `${count} seguidores`
}
