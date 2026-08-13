import 'server-only'

/**
 * features/sitemap/queries.ts — las lecturas del sitemap (PART 23 §23.5).
 *
 * Existe como módulo aparte por dos razones que no son de estilo:
 *
 * 1. BUILD CONTRACT §7.1 (y la regla 2 de `scripts/forbidden.sh`) prohíben
 *    `supabase.from()` fuera de los `queries.ts` y `actions.ts` de cada feature y de
 *    `lib/supabase/*`. `app/sitemap.ts` no puede consultar la base por su cuenta, y
 *    ninguna feature del contrato expone "todas las materias / todos los posts
 *    activos": las lecturas de PART 23 son enumeraciones completas, no páginas con
 *    cursor. Este archivo llena ese hueco sin tocar el resto del contrato.
 *
 * 2. **El cliente no lleva la sesión, a propósito.** Es un cliente anónimo, sin
 *    cookies, igual que el de `lib/analytics.ts`. Dos consecuencias buscadas:
 *    - El sitemap ve EXACTAMENTE lo que ve un crawler sin cuenta. Las vistas
 *      `_public` ya filtran `status = 'activo'` (migración 0010), así que lo
 *      removido y lo borrado sale solo del sitemap y el 410 hace el resto (§23.5).
 *    - No se llama a `cookies()`, así que `app/sitemap.ts` puede quedarse en ISR de
 *      24 h (§23.5: "sitemaps con caché ISR de 24 horas — ningún cron consumido").
 *      Leer la sesión lo volvería dinámico y regeneraría el XML en cada visita de
 *      bot, que es justo lo que §23.5 evita.
 *
 * PERFILES NO ESTÁN ACÁ, y no es un olvido: `/u/[handle]` va `noindex` (§23.1, C16).
 * El historial agregado de un seudónimo en Google es un amplificador de linkeo.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { publicEnv } from '@/lib/env'
import type { Database } from '@/lib/types.gen'

/**
 * Topes por segmento. El límite duro de un sitemap son 50.000 URLs y 50 MB
 * (protocolo sitemaps.org); estos números suman bastante menos y dejan margen para
 * la década. Cuando alguno se toque de verdad, el paso siguiente ya está diseñado:
 * índice + segmentos mensuales de posts (§23.5), que en Next se implementa con
 * `generateSitemaps()` sin cambiar este módulo.
 */
export const SITEMAP_LIMITS = {
  materias: 5_000,
  carreras: 5_000,
  facultades: 1_000,
  recursos: 10_000,
  posts: 20_000,
} as const

/** Una URL del sitemap. `lastModified` en ISO 8601; nunca vacío. */
export type SitemapEntry = {
  /** Ruta absoluta dentro del sitio, con barra inicial. */
  path: string
  lastModified: string
}

export type SitemapData = {
  materias: SitemapEntry[]
  carreras: SitemapEntry[]
  facultades: SitemapEntry[]
  recursos: SitemapEntry[]
  posts: SitemapEntry[]
  /** Última actividad de contenido conocida: `lastmod` de la home y de los índices. */
  latestActivity: string | null
}

let anonClient: SupabaseClient<Database> | null = null

/** Cliente anónimo perezoso, sin sesión y sin cookies (ver el encabezado). */
function getAnonClient(): SupabaseClient<Database> {
  if (anonClient) return anonClient

  anonClient = createClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    },
  )

  return anonClient
}

/** Se queda con la más reciente de dos fechas ISO. Tolera nulos de las vistas. */
function newer(a: string | null | undefined, b: string | null | undefined): string | null {
  if (!a) return b ?? null
  if (!b) return a
  return a >= b ? a : b
}

/**
 * Todo lo indexable, en cinco consultas paralelas.
 *
 * Si una consulta falla, ese segmento sale vacío y el resto del sitemap se sirve
 * igual: un sitemap incompleto es una molestia de rastreo, un sitemap que tira 500
 * es una URL rota en Search Console. Nunca lanza.
 */
export async function getSitemapData(): Promise<SitemapData> {
  if (!publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return {
      materias: [],
      carreras: [],
      facultades: [],
      recursos: [],
      posts: [],
      latestActivity: null,
    }
  }

  const supabase = getAnonClient()

  const [materiaRows, carreraRows, facultadRows, recursoRows, postRows] = await Promise.all([
    supabase
      .from('materias')
      .select('id, slug, created_at')
      .order('slug', { ascending: true })
      .limit(SITEMAP_LIMITS.materias),
    supabase
      .from('carreras')
      .select('slug, created_at')
      .order('slug', { ascending: true })
      .limit(SITEMAP_LIMITS.carreras),
    supabase
      .from('facultades')
      .select('slug, created_at')
      .order('slug', { ascending: true })
      .limit(SITEMAP_LIMITS.facultades),
    supabase
      .from('resources_public')
      .select('public_id, materia_id, created_at, edited_at')
      .order('created_at', { ascending: false })
      .limit(SITEMAP_LIMITS.recursos),
    // Ordenados por última actividad: si algún día hay que recortar, lo que se cae
    // es lo más viejo y quieto, que es lo que un crawler ya visitó hace rato.
    supabase
      .from('posts_public')
      .select('public_id, materia_id, created_at, edited_at, last_activity_at')
      .order('last_activity_at', { ascending: false })
      .limit(SITEMAP_LIMITS.posts),
  ])

  // `lastmod` de cada materia = la actividad más nueva que le conocemos (§23.5).
  // Sale gratis: son los mismos posts y recursos que ya trajimos para el sitemap.
  const activityByMateria = new Map<number, string>()
  let latestActivity: string | null = null

  const recordActivity = (materiaId: number | null, iso: string | null): void => {
    if (!iso) return
    latestActivity = newer(latestActivity, iso)
    if (materiaId === null) return
    const current = activityByMateria.get(materiaId)
    const best = newer(current, iso)
    if (best) activityByMateria.set(materiaId, best)
  }

  const posts: SitemapEntry[] = []
  for (const row of postRows.data ?? []) {
    const lastModified = newer(newer(row.last_activity_at, row.edited_at), row.created_at)
    recordActivity(row.materia_id, lastModified)
    if (!row.public_id || !lastModified) continue
    posts.push({ path: `/p/${row.public_id}`, lastModified })
  }

  const recursos: SitemapEntry[] = []
  for (const row of recursoRows.data ?? []) {
    const lastModified = newer(row.edited_at, row.created_at)
    recordActivity(row.materia_id, lastModified)
    if (!row.public_id || !lastModified) continue
    recursos.push({ path: `/recursos/${row.public_id}`, lastModified })
  }

  const materias: SitemapEntry[] = (materiaRows.data ?? []).map((row) => ({
    path: `/materias/${row.slug}`,
    // Sin actividad, la fecha de alta de la materia: una materia recién sembrada es
    // una página legítima y vacía, no una página desactualizada.
    lastModified: activityByMateria.get(row.id) ?? row.created_at,
  }))

  const carreras: SitemapEntry[] = (carreraRows.data ?? []).map((row) => ({
    path: `/carreras/${row.slug}`,
    lastModified: row.created_at,
  }))

  const facultades: SitemapEntry[] = (facultadRows.data ?? []).map((row) => ({
    path: `/facultades/${row.slug}`,
    lastModified: row.created_at,
  }))

  return { materias, carreras, facultades, recursos, posts, latestActivity }
}
