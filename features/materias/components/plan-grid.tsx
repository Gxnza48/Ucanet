/**
 * features/materias/components/plan-grid.tsx — la grilla del plan de estudios
 * (PART 23 §23.6/§23.7).
 *
 * Es LA respuesta a "plan de estudios <carrera> uca rosario" y, sobre todo, el nodo que reparte
 * autoridad de enlace hacia las ~110 páginas de materia: cada fila es un link a
 * `/materias/[slug]`, sin excepciones y sin JavaScript de por medio.
 *
 * ORDEN, que es el que se cursa: año ascendente y, dentro de cada año, anuales primero (arrancan
 * en marzo y no terminan hasta noviembre), después 1er y 2° cuatrimestre, y al final las
 * optativas del año en su propio bloque. Las optativas van separadas porque así las modela
 * `plan_materias.optativa` (§8.3.1) y porque mezclarlas haría leer un plan que nadie cursa así.
 *
 * Una materia puede aparecer en dos versiones de plan de la misma carrera con año distinto (en
 * Abogacía conviven 2013 y 2020, §8.3.1): por eso la key de React lleva año y cuatrimestre además
 * del slug.
 *
 * Server Component puro: cero JavaScript de ruta.
 */
import Link from 'next/link'

import { cn } from '@/lib/cn'

import type { PlanEntry } from '../queries'

/** `cuatrimestre = 0` es materia anual (CHECK `cuatrimestre in (0,1,2)`, migración 0002). */
const ANUAL = 0

type Bloque = { clave: string; titulo: string; materias: PlanEntry[] }
type AnioGroup = { anio: number; bloques: Bloque[] }

export function PlanGrid({ materias, className }: { materias: PlanEntry[]; className?: string }) {
  const anios = agruparPorAnio(materias)
  if (anios.length === 0) return null

  return (
    <div className={cn('flex flex-col gap-6', className)}>
      {anios.map((grupo) => (
        <section key={grupo.anio}>
          <h3 className="text-s font-semibold text-text-secondary">
            {ordinalAnio(grupo.anio)} año
          </h3>
          <div className="mt-2 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {grupo.bloques.map((bloque) => (
              <div key={bloque.clave}>
                <h4 className="text-s text-text-secondary">{bloque.titulo}</h4>
                <ul className="mt-1 border-t border-border">
                  {bloque.materias.map((materia) => (
                    <li
                      key={`${materia.slug}-${materia.anio}-${materia.cuatrimestre}`}
                      className="border-b border-border"
                    >
                      <Link
                        href={`/materias/${materia.slug}`}
                        className="flex flex-wrap items-baseline gap-x-2 py-2 transition-colors duration-150 ease-out hover:text-accent"
                      >
                        <span className="text-m font-semibold text-text-primary">
                          {materia.nombre}
                        </span>
                        {materia.codigo ? (
                          <span className="text-s text-text-secondary">{materia.codigo}</span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function agruparPorAnio(materias: PlanEntry[]): AnioGroup[] {
  const porAnio = new Map<number, PlanEntry[]>()
  for (const materia of materias) {
    const lista = porAnio.get(materia.anio)
    if (lista) lista.push(materia)
    else porAnio.set(materia.anio, [materia])
  }

  return [...porAnio.entries()]
    .sort(([a], [b]) => a - b)
    .map(([anio, delAnio]) => {
      const obligatorias = delAnio.filter((materia) => !materia.optativa)
      const optativas = delAnio.filter((materia) => materia.optativa)

      const bloques: Bloque[] = []
      for (const [cuatrimestre, titulo] of [
        [ANUAL, 'Anuales'],
        [1, '1er cuatrimestre'],
        [2, '2° cuatrimestre'],
      ] as const) {
        const delBloque = obligatorias.filter((materia) => materia.cuatrimestre === cuatrimestre)
        if (delBloque.length > 0) {
          bloques.push({ clave: `c${cuatrimestre}`, titulo, materias: ordenar(delBloque) })
        }
      }

      if (optativas.length > 0) {
        bloques.push({ clave: 'optativas', titulo: 'Optativas', materias: ordenar(optativas) })
      }

      return { anio, bloques }
    })
}

function ordenar(materias: PlanEntry[]): PlanEntry[] {
  return [...materias].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es-AR'))
}

function ordinalAnio(anio: number): string {
  return anio === 1 ? '1er' : anio === 3 ? '3er' : `${anio}°`
}
