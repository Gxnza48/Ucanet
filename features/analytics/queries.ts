import 'server-only'

/**
 * features/analytics/queries.ts — la lectura de `/mod/metricas` (PART 24 §24.6).
 *
 * La analítica entera del producto es una tabla de contadores por día
 * (`events`: name, day, dim, count). No hay filas por usuario, ni cookies, ni SDK
 * de cliente, ni session replay: esta tabla no puede reconstruir la conducta de
 * nadie, y eso es el objetivo de diseño, no una limitación (§24.1).
 *
 * La política de RLS `events_select_mod` acota la lectura a `role in ('mod','admin')`:
 * para cualquier otra cuenta esto devuelve cero filas sin necesidad de redirigir.
 *
 * `dim` se colapsa al agregar: el panel muestra el evento por día. El desglose por
 * dimensión existe en la tabla y se consulta con SQL cuando hace falta — el panel
 * no necesita una UI para eso (§24.6: una tabla y nada más, sin librería de charts).
 */
import { createClient } from '@/lib/supabase/server'
import { isoDay } from '@/lib/utils/dates'

/** Ventana del panel: 14 días, como fija §24.6. */
export const METRICS_WINDOW_DAYS = 14

const DAY_MS = 24 * 60 * 60 * 1000

export type MetricsDay = {
  /** Día en formato ISO corto (`2027-03-14`), zona horaria de Buenos Aires. */
  day: string
  name: string
  count: number
}

export type Metrics = {
  daily: MetricsDay[]
  /** Total por evento en la ventana. */
  totals: Record<string, number>
}

/**
 * Catálogo cerrado de PART 24 §24.3, con su rótulo en es-AR. Agregar un evento
 * exige una línea en `docs/decisions.md` (D14.8 por analogía): la lista corta es
 * la que hace que el panel entre en una pantalla.
 */
export const EVENT_LABELS: Record<string, string> = {
  registro_completado: 'Registros completados',
  invitacion_usada: 'Invitaciones usadas',
  post_creado: 'Publicaciones creadas',
  post_anonimo: 'Publicaciones anónimas',
  comentario_creado: 'Comentarios creados',
  voto_emitido: 'Votos emitidos',
  recurso_subido: 'Recursos subidos',
  recurso_descargado: 'Recursos descargados',
  busqueda: 'Búsquedas',
  busqueda_sin_resultados: 'Búsquedas sin resultados',
  materia_seguida: 'Materias seguidas',
  reporte_creado: 'Reportes creados',
  cuenta_eliminada: 'Cuentas eliminadas',
  dau: 'Activos por día',
}

export async function getMetrics(): Promise<Metrics> {
  const supabase = await createClient()
  const since = isoDay(new Date(Date.now() - (METRICS_WINDOW_DAYS - 1) * DAY_MS).toISOString())

  const { data, error } = await supabase
    .from('events')
    .select('name, day, count')
    .gte('day', since)
    .order('day', { ascending: false })
    .order('name', { ascending: true })

  if (error || !data) return { daily: [], totals: {} }

  // Se suman las dimensiones: `post_creado` es la suma de `texto` y `pregunta`.
  const byDayAndName = new Map<string, MetricsDay>()
  const totals: Record<string, number> = {}

  for (const row of data) {
    const key = `${row.day}|${row.name}`
    const existing = byDayAndName.get(key)
    if (existing) {
      existing.count += row.count
    } else {
      byDayAndName.set(key, { day: row.day, name: row.name, count: row.count })
    }
    totals[row.name] = (totals[row.name] ?? 0) + row.count
  }

  const daily = [...byDayAndName.values()].sort((a, b) => {
    if (a.day !== b.day) return b.day.localeCompare(a.day)
    return a.name.localeCompare(b.name)
  })

  return { daily, totals }
}
