/**
 * lib/env.ts — variables públicas, validadas una sola vez (PART 19 §19.8).
 *
 * Solo `NEXT_PUBLIC_*` vive acá: este módulo puede importarse desde el cliente.
 * Los secretos del servidor están en `lib/env.server.ts`, que lleva `server-only`.
 *
 * Las referencias a `process.env.X` son literales a propósito: Next las inlinea
 * en el bundle del cliente en tiempo de build y un acceso dinámico rompería eso.
 */
import { z } from 'zod'

const publicSchema = z.object({
  // Defaults tolerantes para que `next build` corra sin un proyecto Supabase.
  // La verificación dura sucede en tiempo de request (ver `assertSupabaseEnv`).
  NEXT_PUBLIC_SUPABASE_URL: z.url().default('http://127.0.0.1:54321'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().default(''),
  NEXT_PUBLIC_SITE_URL: z.url().default('http://localhost:3000'),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
})

export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
})

/** true si Supabase está configurado. Sirve para degradar en vez de romper. */
export const supabaseConfigured = Boolean(publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY)

/**
 * `next build` prerenderiza las páginas públicas. Un build de CI que solo verifica que
 * el proyecto compila no tiene por qué llevar credenciales, así que durante esa fase la
 * ausencia de configuración degrada a "visitante deslogueado" en vez de abortar el build.
 * En tiempo de ejecución la regla es la contraria: falla ruidoso.
 */
const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build'

/**
 * Falla ruidosamente si falta la configuración de Supabase en tiempo de ejecución.
 * La llaman las fábricas de clientes: un deploy mal configurado debe romperse
 * con un mensaje claro, no devolver datos vacíos en silencio.
 */
export function assertSupabaseEnv(): void {
  if (supabaseConfigured || isBuildPhase) return
  throw new Error(
    'Falta NEXT_PUBLIC_SUPABASE_ANON_KEY. Copiá .env.example a .env.local y completá los valores.',
  )
}

/** URL absoluta canónica, sin barra final. */
export const siteUrl = publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')

/** Construye una URL absoluta para metadata, sitemap y previews de WhatsApp. */
export function absoluteUrl(path: string): string {
  return `${siteUrl}${path.startsWith('/') ? path : `/${path}`}`
}
