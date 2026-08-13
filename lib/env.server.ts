/**
 * lib/env.server.ts — secretos del servidor (PART 20 §20.6).
 *
 * `server-only` convierte cualquier import desde el cliente en un error de build.
 * La lectura es perezosa a propósito: `next build` no debe exigir credenciales de R2
 * ni la service-role key, pero el primer uso real falla fuerte si faltan (D14.3).
 */
import 'server-only'
import { z } from 'zod'

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}.`)
  }
  return value
}

/**
 * Service-role key. Solo puede usarse desde `app/api/cron/*` y scripts de admin (D14.3).
 * Nunca desde código alcanzable por un request de usuario.
 */
export function getServiceRoleKey(): string {
  return required('SUPABASE_SERVICE_ROLE_KEY')
}

/** Secreto que Vercel inyecta en los requests de cron. */
export function getCronSecret(): string {
  return required('CRON_SECRET')
}

const r2Schema = z.object({
  accountId: z.string().min(1),
  accessKeyId: z.string().min(1),
  secretAccessKey: z.string().min(1),
  bucket: z.string().min(1),
  endpoint: z.string().min(1),
})

export type R2Config = z.infer<typeof r2Schema>

/** Credenciales de Cloudflare R2 (§0.5-R17). Nunca con prefijo NEXT_PUBLIC_. */
export function getR2Config(): R2Config {
  const accountId = required('R2_ACCOUNT_ID')
  return r2Schema.parse({
    accountId,
    accessKeyId: required('R2_ACCESS_KEY_ID'),
    secretAccessKey: required('R2_SECRET_ACCESS_KEY'),
    bucket: required('R2_BUCKET'),
    endpoint: process.env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`,
  })
}

/** true si R2 está configurado; permite degradar la UI de subida sin romper el build. */
export function hasR2Config(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET,
  )
}
