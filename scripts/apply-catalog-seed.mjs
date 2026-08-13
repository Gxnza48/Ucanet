#!/usr/bin/env node
/**
 * scripts/apply-catalog-seed.mjs — aplica la semilla del catálogo académico.
 *
 * Recorre supabase/seed/catalog/*.sql en orden lexicográfico (00_, 10_, 20_, 30_,
 * 40_, 41_, 99_ — el orden ES la dependencia: universidad → sede → facultades →
 * carreras → materias → alias) y ejecuta cada archivo con `psql`.
 *
 * Las semillas son upserts idempotentes por slug (PART 8 §8.10.2): correr esto
 * dos veces no duplica nada y no toca contenido de usuarios. Es el mecanismo de
 * corrección del catálogo — se edita el .sql y se vuelve a correr.
 *
 * NO aplica supabase/seed.sql: eso son fixtures de desarrollo y jamás salen de
 * la máquina local.
 *
 * Uso:
 *   SUPABASE_DB_URL=postgresql://... node scripts/apply-catalog-seed.mjs
 *   npm run db:seed:catalog
 *
 * Opciones:
 *   --dry-run          lista los archivos y sale, sin conectarse a nada
 *   --db-url=<url>     cadena de conexión (pisa a SUPABASE_DB_URL)
 *   --psql=<ruta>      binario de psql a usar (por defecto: "psql" del PATH)
 *   -h, --help         esta ayuda
 *
 * Sin dependencias externas: solo módulos nativos de Node (D14.8 — ninguna
 * dependencia nueva sin entrada en docs/decisions.md).
 */

import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..')
const CATALOG_DIR = join(REPO_ROOT, 'supabase', 'seed', 'catalog')

// ---------------------------------------------------------------------------
// Argumentos
// ---------------------------------------------------------------------------

const args = process.argv.slice(2)

function flagValue(name) {
  const prefix = `--${name}=`
  const hit = args.find((a) => a.startsWith(prefix))
  return hit ? hit.slice(prefix.length) : undefined
}

const wantsHelp = args.includes('--help') || args.includes('-h')
const dryRun = args.includes('--dry-run')
const psqlBin = flagValue('psql') ?? process.env.PSQL_BIN ?? 'psql'
const dbUrl = flagValue('db-url') ?? process.env.SUPABASE_DB_URL ?? ''

const HELP = `
uca.net · aplicar semilla de catálogo

  node scripts/apply-catalog-seed.mjs [opciones]

  --dry-run        lista los archivos y sale
  --db-url=<url>   cadena de conexión (pisa a SUPABASE_DB_URL)
  --psql=<ruta>    binario de psql (por defecto: el del PATH)
  -h, --help       esta ayuda

Variables de entorno:
  SUPABASE_DB_URL  cadena de conexión de Postgres. Para la base local del CLI:
                   postgresql://postgres:postgres@127.0.0.1:54322/postgres
`

if (wantsHelp) {
  process.stdout.write(HELP)
  process.exit(0)
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function fail(message, hint) {
  console.error(`\n  ERROR  ${message}`)
  if (hint) console.error(`         ${hint}`)
  console.error('')
  process.exit(1)
}

/** Nunca imprimimos la contraseña de la cadena de conexión. */
function describeTarget(url) {
  try {
    const u = new URL(url)
    const user = u.username ? `${decodeURIComponent(u.username)}@` : ''
    const port = u.port ? `:${u.port}` : ''
    const db = u.pathname.replace(/^\//, '') || '(por defecto)'
    return `${user}${u.hostname}${port}/${db}`
  } catch {
    return '(cadena de conexión no parseable)'
  }
}

/**
 * Traduce la URL a variables PG* en vez de pasarla por argv: así la contraseña
 * no queda visible en la lista de procesos de la máquina.
 * Si la URL no se puede parsear, se devuelve null y se cae a pasarla a psql.
 */
function envFromUrl(url) {
  let u
  try {
    u = new URL(url)
  } catch {
    return null
  }
  if (!/^postgres(ql)?:$/.test(u.protocol)) return null

  const env = {}
  if (u.hostname) env.PGHOST = decodeURIComponent(u.hostname)
  if (u.port) env.PGPORT = u.port
  if (u.username) env.PGUSER = decodeURIComponent(u.username)
  if (u.password) env.PGPASSWORD = decodeURIComponent(u.password)
  const db = u.pathname.replace(/^\//, '')
  if (db) env.PGDATABASE = decodeURIComponent(db)
  const sslmode = u.searchParams.get('sslmode')
  if (sslmode) env.PGSSLMODE = sslmode
  const options = u.searchParams.get('options')
  if (options) env.PGOPTIONS = options
  return env
}

function isLocalTarget(url) {
  try {
    const host = new URL(url).hostname
    return host === 'localhost' || host === '127.0.0.1' || host === '::1'
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Archivos de semilla
// ---------------------------------------------------------------------------

if (!existsSync(CATALOG_DIR) || !statSync(CATALOG_DIR).isDirectory()) {
  fail(
    `No existe el directorio de semillas: ${CATALOG_DIR}`,
    'Se esperaba supabase/seed/catalog/ en la raíz del repo.',
  )
}

const files = readdirSync(CATALOG_DIR)
  .filter((name) => name.toLowerCase().endsWith('.sql'))
  .sort()

if (files.length === 0) {
  fail(`No hay archivos .sql en ${CATALOG_DIR}`)
}

console.log('')
console.log('  uca.net · semilla del catálogo académico (APPENDIX A)')
console.log(`  Origen : ${CATALOG_DIR}`)
console.log(`  Archivos (${files.length}), en orden de aplicación:`)
for (const [i, name] of files.entries()) {
  console.log(`    ${String(i + 1).padStart(2, ' ')}. ${name}`)
}

if (dryRun) {
  console.log('\n  --dry-run: no se aplicó nada.\n')
  process.exit(0)
}

// ---------------------------------------------------------------------------
// Conexión
// ---------------------------------------------------------------------------

if (!dbUrl) {
  fail(
    'Falta SUPABASE_DB_URL (o --db-url=<url>).',
    'Base local del CLI: SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres',
  )
}

const version = spawnSync(psqlBin, ['--version'], { encoding: 'utf8' })
if (version.error || version.status !== 0) {
  fail(
    `No se pudo ejecutar "${psqlBin}".`,
    'Instalá el cliente de PostgreSQL (psql) o pasá su ruta con --psql=<ruta>. ' +
      'Alternativa sin psql: declarar ./seed/catalog/*.sql en [db.seed].sql_paths de supabase/config.toml y correr `supabase db reset`.',
  )
}

const target = describeTarget(dbUrl)
const local = isLocalTarget(dbUrl)

console.log('')
console.log(`  psql   : ${(version.stdout || '').trim()}`)
console.log(`  Destino: ${target}${local ? '  (local)' : '  ← NO es local: revisá que sea el proyecto correcto'}`)
console.log('')

const pgEnv = envFromUrl(dbUrl)
const childEnv = { ...process.env, ...(pgEnv ?? {}) }
// Si la URL no se pudo traducir a PG*, se la pasamos a psql tal cual (último recurso).
const connArgs = pgEnv ? [] : ['-d', dbUrl]

// ---------------------------------------------------------------------------
// Aplicación
// ---------------------------------------------------------------------------

const startedAll = Date.now()
let applied = 0

for (const name of files) {
  const path = join(CATALOG_DIR, name)
  process.stdout.write(`  → ${name} ... `)
  const started = Date.now()

  const run = spawnSync(
    psqlBin,
    [
      ...connArgs,
      '--no-psqlrc',
      '--quiet',
      '--single-transaction',
      '--variable=ON_ERROR_STOP=1',
      '--file',
      path,
    ],
    { env: childEnv, stdio: ['ignore', 'inherit', 'inherit'] },
  )

  const ms = Date.now() - started

  if (run.error) {
    console.error(`\n\n  ERROR  No se pudo lanzar psql para ${name}: ${run.error.message}\n`)
    process.exit(1)
  }
  if (run.status !== 0) {
    console.error(
      `\n\n  ERROR  ${name} falló (psql salió con código ${run.status}). ` +
        'La transacción de ese archivo se revirtió entera; los archivos anteriores ya están aplicados.\n' +
        '         Corregí el .sql y volvé a correr: las semillas son idempotentes.\n',
    )
    process.exit(run.status ?? 1)
  }

  applied += 1
  console.log(`ok (${ms} ms)`)
}

console.log('')
console.log(`  Listo: ${applied}/${files.length} archivos aplicados en ${Date.now() - startedAll} ms.`)
console.log('  El catálogo es idempotente: podés volver a correr esto cuando corrijas APPENDIX A.')
console.log('')
