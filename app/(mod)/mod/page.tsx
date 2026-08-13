import type { Metadata } from 'next'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Select } from '@/components/ui/select'
import { ModQueueTable } from '@/features/mod/components/mod-queue-table'
import { getReportQueue } from '@/features/mod/queries'
import {
  CONTENT_KIND_LABELS,
  REPORT_CATEGORIA_LABELS,
  REPORT_CATEGORIA_VALUES,
  REPORT_STATUS_LABELS,
  REPORT_STATUS_VALUES,
  TARGET_KINDS,
  type ReportCategoria,
  type ReportStatus,
  type TargetKind,
} from '@/features/mod/schemas'

/**
 * app/(mod)/mod/page.tsx — S1, la cola (PART 11 §11.4.1).
 *
 * La vista por defecto del panel: lo abierto, ordenado por lo que importa. El orden
 * lo decide `getReportQueue()` y es normativo — categorías prioritarias (`amenazas`,
 * `datos_personales`, `contenido_ilegal`) primero, después cantidad de denunciantes,
 * después el más viejo. Un moderador que abre esta pantalla y trabaja de arriba hacia
 * abajo está cumpliendo el SLA de §11.4.3 sin tener que pensarlo.
 *
 * FILTROS SIN JAVASCRIPT (§11.4.1: "query-param, no JS state"). Un `<form method="get">`
 * con tres `<select>` nativos: cada combinación es una URL que se puede compartir,
 * marcar y volver con el botón atrás. Nada de estado de cliente para una pantalla
 * interna que ven tres personas.
 *
 * El filtro de ESTADO baja a la base (`getReportQueue(status)`); los de CATEGORÍA y
 * TIPO se aplican acá sobre el resultado. No es una inconsistencia: la cola ya viene
 * agrupada por objetivo, y un mismo objetivo puede acumular varias categorías —
 * filtrar eso en SQL exigiría rehacer la agrupación en la consulta para ganar nada,
 * porque la cola está topeada en 200 filas por diseño.
 *
 * LO QUE ESTA PANTALLA NO MUESTRA, siempre: quién reportó (§11.4.1) y la autoría de
 * contenido anónimo (§11.4.2). Eso último se destapa de a una pieza, con motivo, y
 * queda auditado.
 */
export const metadata: Metadata = {
  title: 'Cola',
}

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

/** Primer valor de un parámetro repetible, o undefined. */
function param(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value
  const trimmed = raw?.trim()
  return trimmed ? trimmed : undefined
}

function asStatus(value: string | undefined): ReportStatus | undefined {
  return value && (REPORT_STATUS_VALUES as readonly string[]).includes(value)
    ? (value as ReportStatus)
    : undefined
}

function asCategoria(value: string | undefined): ReportCategoria | undefined {
  return value && (REPORT_CATEGORIA_VALUES as readonly string[]).includes(value)
    ? (value as ReportCategoria)
    : undefined
}

function asTipo(value: string | undefined): TargetKind | undefined {
  return value && (TARGET_KINDS as readonly string[]).includes(value)
    ? (value as TargetKind)
    : undefined
}

export default async function ModQueuePage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const estado = asStatus(param(sp.estado))
  const categoria = asCategoria(param(sp.categoria))
  const tipo = asTipo(param(sp.tipo))

  const queue = await getReportQueue(estado)
  const items = queue.filter(
    (item) =>
      (!categoria || item.categorias.includes(categoria)) && (!tipo || item.targetKind === tipo),
  )

  const filtrando = Boolean(estado || categoria || tipo)

  return (
    <div>
      <form method="get" action="/mod" className="flex flex-wrap items-end gap-3">
        <Field label="Estado" htmlFor="filtro-estado" className="w-48">
          <Select id="filtro-estado" name="estado" defaultValue={estado ?? ''}>
            <option value="">Abiertos y en revisión</option>
            {REPORT_STATUS_VALUES.map((value) => (
              <option key={value} value={value}>
                {REPORT_STATUS_LABELS[value]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Categoría" htmlFor="filtro-categoria" className="w-64">
          <Select id="filtro-categoria" name="categoria" defaultValue={categoria ?? ''}>
            <option value="">Todas</option>
            {REPORT_CATEGORIA_VALUES.map((value) => (
              <option key={value} value={value}>
                {REPORT_CATEGORIA_LABELS[value]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Tipo" htmlFor="filtro-tipo" className="w-48">
          <Select id="filtro-tipo" name="tipo" defaultValue={tipo ?? ''}>
            <option value="">Todos</option>
            {TARGET_KINDS.map((value) => (
              <option key={value} value={value}>
                {CONTENT_KIND_LABELS[value]}
              </option>
            ))}
          </Select>
        </Field>

        {/* mb-6 alinea el botón con la base del control, salteando el renglón de
            error que `Field` reserva siempre para la live region. */}
        <Button type="submit" variant="secondary" className="mb-6">
          Filtrar
        </Button>

        {filtrando ? (
          <Link href="/mod" className="mb-6 self-center text-s text-accent hover:underline">
            Limpiar
          </Link>
        ) : null}
      </form>

      <div className="mt-6">
        <ModQueueTable items={items} />
      </div>

      <p className="mt-6 text-s text-text-secondary">
        La cola trae hasta 200 objetivos. Si llega a ese tope de forma sostenida, el cuello de
        botella es el equipo, no la pantalla: es el disparador de reclutamiento de §11.8.2.
      </p>
    </div>
  )
}
