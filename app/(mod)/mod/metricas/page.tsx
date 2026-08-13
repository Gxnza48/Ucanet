import type { Metadata } from 'next'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@/components/ui/table'
import { EVENT_LABELS, METRICS_WINDOW_DAYS, getMetrics } from '@/features/analytics/queries'
import { isoDay } from '@/lib/utils/dates'

/**
 * app/(mod)/mod/metricas/page.tsx — el tablero (PART 24 §24.6).
 *
 * Es la analítica entera del producto, y entra en una pantalla porque la analítica
 * entera del producto es una tabla de contadores por día: `events (name, day, dim,
 * count)`. No hay cookie de seguimiento, ni script de terceros, ni session replay, ni
 * embudo por usuario. Esta tabla NO PUEDE reconstruir la conducta de nadie, y ese es
 * el objetivo de diseño (§24.1), no una limitación que algún día se arregla.
 *
 * SIN LIBRERÍA DE GRÁFICOS (§24.6, textual: "No charting library; a `<table>` and
 * inline SVG suffice"). Los sparklines son catorce `<rect>` de SVG en línea pintados
 * con `currentColor`: pesan bytes, respetan el modo oscuro solos y no agregan una
 * dependencia con la que después hay que convivir diez años (D14.8).
 *
 * ARRIBA VAN LAS MÉTRICAS DE PUERTA (§24.5), no los totales más grandes. Lo que se
 * mira los viernes en quince minutos (§24.8) es si la cohorte está viva y si el imán
 * de utilidad tira; el resto es contexto. Todos los números se comparan contra la
 * misma semana del calendario académico, nunca contra febrero (C14).
 *
 * Los contadores OPERATIVOS (`cron_*`) van en su propia tabla abajo. No son producto:
 * son la evidencia de que el cron diario corrió. Una fila `cron_purge` con dimensión
 * de error, o directamente la ausencia de `cron_heartbeat` de hoy, es la señal más
 * barata que existe de que el proyecto Free se está por dormir (§21.5, C7).
 *
 * La lectura pasa por la política `events_select_mod`: para cualquier cuenta que no
 * sea `mod` o `admin` esto devuelve cero filas, aunque alguien llegue a renderizarlo.
 */
export const metadata: Metadata = {
  title: 'Métricas',
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Ventana corta de las métricas de puerta: la semana. */
const WEEK_DAYS = 7

/** Contadores que escribe la infraestructura, fuera del catálogo cerrado de §24.3. */
const OPERATIONAL_LABELS: Record<string, string> = {
  cron_heartbeat: 'Latido del cron',
  cron_keepalive: 'Cron · keepalive',
  cron_reconcile: 'Cron · recuento',
  cron_purge: 'Cron · purga',
}

type Row = {
  name: string
  label: string
  total: number
  week: number
  today: number
  series: number[]
}

/** Días de la ventana, del más viejo al más nuevo. Los huecos valen 0, no "sin dato". */
function windowDays(): string[] {
  const now = Date.now()
  const days: string[] = []
  for (let offset = METRICS_WINDOW_DAYS - 1; offset >= 0; offset -= 1) {
    days.push(isoDay(new Date(now - offset * DAY_MS).toISOString()))
  }
  return days
}

function percent(part: number, whole: number): string {
  if (whole <= 0) return '—'
  return `${Math.round((part / whole) * 100)}%`
}

/** Sparkline de barras. Catorce rectángulos y ni un byte de JavaScript. */
function Sparkline({ values, label }: { values: number[]; label: string }) {
  const height = 16
  const barWidth = 4
  const gap = 1
  const width = values.length * (barWidth + gap)
  const max = Math.max(1, ...values)

  return (
    <svg
      role="img"
      aria-label={label}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="text-accent"
    >
      {values.map((value, index) => {
        // Altura mínima 1px: un día en cero tiene que verse como una línea, no como
        // un hueco — leer "no pasó nada" es tan informativo como leer el pico.
        const barHeight = Math.max(1, Math.round((value / max) * height))
        return (
          <rect
            key={index}
            x={index * (barWidth + gap)}
            y={height - barHeight}
            width={barWidth}
            height={barHeight}
            fill="currentColor"
          />
        )
      })}
    </svg>
  )
}

function MetricsTable({ rows, caption }: { rows: Row[]; caption: string }) {
  return (
    <Table>
      <caption className="sr-only">{caption}</caption>
      <TableHead>
        <TableRow>
          <TableHeaderCell>Evento</TableHeaderCell>
          <TableHeaderCell>{METRICS_WINDOW_DAYS} días</TableHeaderCell>
          <TableHeaderCell>7 días</TableHeaderCell>
          <TableHeaderCell>Hoy</TableHeaderCell>
          <TableHeaderCell>Tendencia</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.name}>
            <TableCell>{row.label}</TableCell>
            <TableCell className="tabular-nums">{row.total.toLocaleString('es-AR')}</TableCell>
            <TableCell className="tabular-nums">{row.week.toLocaleString('es-AR')}</TableCell>
            <TableCell className="tabular-nums">{row.today.toLocaleString('es-AR')}</TableCell>
            <TableCell>
              <Sparkline
                values={row.series}
                label={`${row.label}: ${METRICS_WINDOW_DAYS} días, del más viejo al más nuevo`}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

/** Número grande con su rótulo y una línea de contexto. Sin tarjetas ni sombras (D8). */
function Gate({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="border-l border-border pl-3">
      <p className="text-s text-text-secondary">{label}</p>
      <p className="text-l font-semibold tabular-nums text-text-primary">{value}</p>
      <p className="mt-1 text-s text-text-secondary">{note}</p>
    </div>
  )
}

export default async function MetricsPage() {
  const { daily, totals } = await getMetrics()
  const days = windowDays()
  const today = days[days.length - 1] ?? ''
  const weekStart = days[Math.max(0, days.length - WEEK_DAYS)] ?? ''

  // (evento, día) → conteo. `daily` ya viene con las dimensiones sumadas.
  const byName = new Map<string, Map<string, number>>()
  for (const entry of daily) {
    const series = byName.get(entry.name) ?? new Map<string, number>()
    series.set(entry.day, (series.get(entry.day) ?? 0) + entry.count)
    byName.set(entry.name, series)
  }

  const names = [...new Set([...Object.keys(EVENT_LABELS), ...byName.keys()])]

  const rows: Row[] = names.map((name) => {
    const series = byName.get(name)
    const values = days.map((day) => series?.get(day) ?? 0)
    return {
      name,
      label: EVENT_LABELS[name] ?? OPERATIONAL_LABELS[name] ?? name,
      total: totals[name] ?? 0,
      week: days.reduce(
        (sum, day, index) => (day >= weekStart ? sum + (values[index] ?? 0) : sum),
        0,
      ),
      today: series?.get(today) ?? 0,
      series: values,
    }
  })

  const product = rows.filter((row) => row.name in EVENT_LABELS)
  const operational = rows.filter((row) => !(row.name in EVENT_LABELS))

  const find = (name: string): Row | undefined => rows.find((row) => row.name === name)
  const posts = find('post_creado')
  const anonimos = find('post_anonimo')
  const busquedas = find('busqueda')
  const sinResultados = find('busqueda_sin_resultados')
  const descargas = find('recurso_descargado')
  const dau = find('dau')

  return (
    <div>
      <section>
        <h2 className="text-base font-semibold text-text-primary">Métricas de puerta</h2>
        <p className="mt-1 text-s text-text-secondary">
          Las de §24.5, sobre los últimos 7 días. La puerta a registro abierto son 30 publicaciones
          orgánicas por semana y 40% de retorno en la segunda semana (D11).
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Gate
            label="Publicaciones (7 días)"
            value={(posts?.week ?? 0).toLocaleString('es-AR')}
            note="Puerta: 30 por semana, sin contar lo que sembró el equipo."
          />
          <Gate
            label="Activos ayer"
            value={(dau?.today ?? 0).toLocaleString('es-AR')}
            note="Se cuenta cuando la cuenta avanza su last_seen_day. Sin historial por persona."
          />
          <Gate
            label="Descargas (7 días)"
            value={(descargas?.week ?? 0).toLocaleString('es-AR')}
            note="Objetivo: 100 en semana de parciales. Es el imán de utilidad."
          />
          <Gate
            label="Búsquedas sin resultados"
            value={percent(sinResultados?.total ?? 0, busquedas?.total ?? 0)}
            note="Objetivo: 30% o menos, bajando. Es la lista de contenido que falta sembrar."
          />
          <Gate
            label="Publicaciones anónimas"
            value={percent(anonimos?.total ?? 0, posts?.total ?? 0)}
            note="Banda sana: 10% a 40%. Cerca de 0% la función no se usa; cerca de 100% falló la capa de seudónimos."
          />
          <Gate
            label="Latido del cron"
            value={(find('cron_heartbeat')?.today ?? 0) > 0 ? 'Hoy' : 'Sin latido hoy'}
            note="Sin latido varios días seguidos, el proyecto Free se pausa (§21.5)."
          />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-base font-semibold text-text-primary">
          Eventos de producto · últimos {METRICS_WINDOW_DAYS} días
        </h2>
        <p className="mt-1 text-s text-text-secondary">
          El catálogo cerrado de §24.3. Las dimensiones se suman: agregar un evento pide una línea
          en `docs/decisions.md`.
        </p>
        <div className="mt-3">
          <MetricsTable rows={product} caption="Eventos de producto por día" />
        </div>
      </section>

      {operational.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-base font-semibold text-text-primary">Operación</h2>
          <p className="mt-1 text-s text-text-secondary">
            Contadores que escribe la infraestructura, fuera del catálogo de producto. Los pasos del
            cron dejan su marca con dimensión de resultado; acá se ven sumados.
          </p>
          <div className="mt-3">
            <MetricsTable rows={operational} caption="Contadores operativos por día" />
          </div>
        </section>
      ) : null}

      <section className="mt-8 border-t border-border pt-6">
        <h2 className="text-base font-semibold text-text-primary">Lo que no está acá</h2>
        <ul className="mt-2 flex flex-col gap-2 text-m text-text-secondary">
          <li>
            <span className="font-semibold text-text-primary">Cuotas del plan gratuito.</span> El
            tamaño de la base, los bytes en R2 y el egreso se leen en los paneles de Supabase y
            Cloudflare en la revisión de los viernes (§24.8). Los disparadores de pago están
            pre-decididos: 70% de cualquiera de los tres (D13).
          </li>
          <li>
            <span className="font-semibold text-text-primary">Tráfico orgánico.</span> Lo mide
            Google Search Console, que es externo al producto y no toca a ningún usuario. Esa es
            justamente la razón por la que se usa (§23.8).
          </li>
          <li>
            <span className="font-semibold text-text-primary">Retorno por cohorte.</span> §24.4 lo
            deja escrito como snapshots semanales (`retorno_semanal`, `wau`, `mau`) que calcularía
            el cron diario. Todavía no los escribe nadie: cuando la migración de `track_event` y el
            paso de agregados existan, van a aparecer solos en la tabla de operación.
          </li>
        </ul>
      </section>
    </div>
  )
}
