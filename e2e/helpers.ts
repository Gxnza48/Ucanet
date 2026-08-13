/**
 * e2e/helpers.ts — datos de prueba y ayudantes compartidos de la suite E2E
 * (PART 25 §25.4 y §25.5).
 *
 * REGLAS DE ESTE ARCHIVO
 *
 * 1. NO importa nada de la aplicación. Ni `@/lib/config`, ni `features/*`, ni
 *    `components/*`. Dos razones: `tsconfig.json` excluye `e2e/` del programa de
 *    TypeScript (así el alias `@/` no está garantizado acá), y un E2E que importa
 *    las constantes del código bajo prueba deja de probar el copy — si alguien
 *    cambia una cadena, el test la sigue en silencio en vez de fallar. Los textos
 *    que se afirman están escritos a mano, copiados del código, a propósito.
 * 2. Todo lo que se afirma es accesible: `getByRole`, `getByLabel`, `getByText`
 *    con el copy es-AR real. Cero selectores CSS de estructura.
 * 3. Los datos de abajo son EXACTAMENTE los de `supabase/seed.sql` +
 *    `supabase/seed/catalog/*.sql`. Si cambian ahí, cambian acá.
 */
import { AxeBuilder } from '@axe-core/playwright'
import { expect, type APIRequestContext, type Page } from '@playwright/test'

// ---------------------------------------------------------------------------
// Datos sembrados (supabase/seed.sql)
// ---------------------------------------------------------------------------

/** Contraseña única de todas las cuentas de fixture. Nunca sale de local/CI. */
export const SEED_PASSWORD = 'ucanet-local-2026'

export type SeedUser = {
  email: string
  password: string
  handle: string
  /** Carrera del perfil, tal como se ve en el catálogo. */
  carrera: string
}

/** Las cuatro cuentas que crea `supabase/seed.sql` (sección 1 y 2). */
export const USERS = {
  /** admin · Abogacía. Autor de seedpost01. */
  fundador: {
    email: 'fundador@ucanet.test',
    password: SEED_PASSWORD,
    handle: 'MateConBizcochos',
    carrera: 'Abogacía',
  },
  /** mod · Abogacía. La única cuenta que puede entrar a `/mod`. */
  mod: {
    email: 'mod@ucanet.test',
    password: SEED_PASSWORD,
    handle: 'FiscalDelTercerPiso',
    carrera: 'Abogacía',
  },
  /** user · Abogacía. Autora de seedpost02 y seedpost03 (este último, anónimo). */
  ana: {
    email: 'ana@ucanet.test',
    password: SEED_PASSWORD,
    handle: 'ApunteDeUltimoMomento',
    carrera: 'Abogacía',
  },
  /** user · Contador Público. Autor de seedpost04 y seedpost05. */
  bruno: {
    email: 'bruno@ucanet.test',
    password: SEED_PASSWORD,
    handle: 'CafeDeLaMaquina',
    carrera: 'Contador Público',
  },
} as const satisfies Record<string, SeedUser>

/** Invitación abierta de desarrollo: 25 usos, creada por MateConBizcochos. */
export const INVITE_CODE = 'devinv01'

/** Fixtures a las que apunta la suite, por `public_id` (nunca por id interno). */
export const SEED = {
  posts: {
    /** Firmado por MateConBizcochos, en Derecho Constitucional. Tiene 2 comentarios. */
    consti: {
      publicId: 'seedpost01',
      title: '¿Alguien rindió Consti con la cátedra de la mañana?',
    },
    /** Firmado por ApunteDeUltimoMomento, en Derecho Romano. */
    romano: {
      publicId: 'seedpost02',
      title: 'Subí el resumen de Romano, bolillas 1 a 5',
    },
    /** ANÓNIMO, de ApunteDeUltimoMomento, en Derecho Penal Parte General. Sin título. */
    anonimo: {
      publicId: 'seedpost03',
      bodyStart: 'Publico anónimo porque me da vergüenza preguntarlo',
      /** Comentario anónimo de MateConBizcochos en ese hilo: alias 1. */
      aliasComentario: 'Anónimo 1',
    },
    /** Hilo bloqueado por moderación: no admite comentarios nuevos. */
    bloqueado: { publicId: 'seedpost05', title: 'Hilo general de dudas de Conta 1' },
  },
  resources: {
    /** Firmado por ApunteDeUltimoMomento, en Derecho Constitucional. Un PDF. */
    consti: {
      publicId: 'seedres001',
      title: 'Resumen completo de Derecho Constitucional (Plan 2013)',
    },
    /** ANÓNIMO, de CafeDeLaMaquina, en Contabilidad. */
    anonimo: {
      publicId: 'seedres002',
      title: 'Primer parcial de Contabilidad resuelto',
    },
  },
  materias: {
    constitucional: { slug: 'derecho-constitucional', nombre: 'Derecho Constitucional' },
    romano: { slug: 'derecho-romano', nombre: 'Derecho Romano' },
    penal: { slug: 'derecho-penal-parte-general', nombre: 'Derecho Penal Parte General' },
    contabilidad: { slug: 'contabilidad', nombre: 'Contabilidad' },
  },
} as const

/** Placeholders del compositor: son el nombre accesible de la caja colapsada. */
export const COMPOSER_PLACEHOLDER = {
  home: '¿Qué está pasando en tu carrera?',
  materia: 'Preguntale algo a los que ya la cursaron',
} as const

/**
 * Buzón local de Supabase (Mailpit en el CLI 2.x, Inbucket en los viejos). Los
 * mails de autenticación nunca salen a internet: caen acá.
 */
export const MAILBOX_URL = process.env.E2E_MAILBOX_URL ?? 'http://127.0.0.1:54324'

/**
 * ¿Hay un bucket de R2 de desarrollo configurado?
 *
 * Sin R2, `request_upload` no puede firmar y `presignGet` tira: el pipeline de
 * subida y la ruta `/recursos/[publicId]/descargar` fallan por falta de
 * infraestructura, no por un bug del producto. Los pasos que dependen de eso se
 * saltean con un mensaje explícito en vez de fallar en rojo.
 */
export const R2_READY = process.env.E2E_R2 === '1'

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/**
 * Sufijo único por corrida. La suite corre en dos proyectos (mobile y desktop)
 * contra la MISMA base sembrada: todo lo que se crea tiene que poder convivir
 * con lo que creó el otro proyecto y con lo que quedó de la corrida anterior.
 */
export function unique(prefix = ''): string {
  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  return prefix ? `${prefix}${stamp}` : stamp
}

/** Correo descartable para el alta. El dominio .test nunca resuelve. */
export function uniqueEmail(): string {
  return `e2e-${unique()}@ucanet.test`
}

/** Seudónimo válido: 3–24 de `[A-Za-z0-9_]` (PART 9 §9.5). */
export function uniqueHandle(): string {
  return `Prueba_${unique()}`.slice(0, 24)
}

/** `public_id` de la publicación abierta: 10 caracteres de `[a-z0-9]` (D7). */
export function postPublicIdFromUrl(page: Page): string {
  const match = /\/p\/([a-z0-9]{10})/.exec(page.url())
  expect(match, `la URL ${page.url()} no es la de una publicación`).not.toBeNull()
  return match![1]!
}

/** Lo mismo para la ficha de un recurso. */
export function resourcePublicIdFromUrl(page: Page): string {
  const match = /\/recursos\/([a-z0-9]{10})/.exec(page.url())
  expect(match, `la URL ${page.url()} no es la de un recurso`).not.toBeNull()
  return match![1]!
}

// ---------------------------------------------------------------------------
// Sesión
// ---------------------------------------------------------------------------

/**
 * Ingresa con una cuenta de fixture por el formulario real de `/ingresar`
 * (nada de inyectar cookies: el alta de sesión es parte de lo que se prueba).
 *
 * La confirmación de que hay sesión es el slot 5 del header: el disparador del
 * menú de cuenta, cuyo nombre accesible es `Cuenta de <seudónimo>` y que existe
 * igual en mobile y en escritorio (PART 17 §17.1.1 y §17.1.2).
 */
export async function signIn(page: Page, user: SeedUser, next = '/'): Promise<void> {
  const query = next === '/' ? '' : `?next=${encodeURIComponent(next)}`
  await page.goto(`/ingresar${query}`)

  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Contraseña').fill(user.password)
  await page.getByRole('button', { name: 'Ingresar' }).click()

  await expectSignedIn(page, user)
}

/** Afirma que la sesión visible es la de `user`. */
export async function expectSignedIn(page: Page, user: SeedUser): Promise<void> {
  await expect(page.getByRole('button', { name: `Cuenta de ${user.handle}` })).toBeVisible()
}

/** Cierra sesión desde el menú de cuenta y espera el retorno a la home pública. */
export async function signOut(page: Page, user: SeedUser): Promise<void> {
  await page.getByRole('button', { name: `Cuenta de ${user.handle}` }).click()
  await page.getByRole('menuitem', { name: 'Cerrar sesión' }).click()

  await expect(page.getByRole('link', { name: 'Ingresá' })).toBeVisible()
}

// ---------------------------------------------------------------------------
// Accesibilidad (PART 25 §25.5)
// ---------------------------------------------------------------------------

/**
 * Corre axe sobre la página actual y falla si hay violaciones `serious` o
 * `critical`. Las `moderate` y `minor` se reportan en el mensaje sólo cuando el
 * test ya está fallando por otra cosa: son backlog, no gate (§25.5).
 *
 * El conjunto de reglas es WCAG 2.1 A + AA, que es el piso que fija PART 17 §17.7.
 */
export async function expectNoSeriousA11yViolations(page: Page, context: string): Promise<void> {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()

  const graves = violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  )

  const detalle = graves.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    nodos: violation.nodes.map((node) => node.target.join(' ')),
  }))

  expect(detalle, `Violaciones serias o críticas de accesibilidad en ${context}`).toEqual([])
}

// ---------------------------------------------------------------------------
// SEO (PART 23 §23.1-23.2)
// ---------------------------------------------------------------------------

/** El canónico apunta a `path` exacto: sin sufijo de slug y sin parámetros (§23.2). */
export async function expectCanonicalPath(page: Page, path: string): Promise<void> {
  const href = await page.locator('link[rel="canonical"]').first().getAttribute('href')
  expect(href, 'la página no declara canónico').toBeTruthy()
  expect(new URL(href!).pathname).toBe(path)
}

/** El `<meta name="robots">` dice lo que se espera (o no existe, si `esperado` es null). */
export async function expectRobots(page: Page, esperado: RegExp | null): Promise<void> {
  const meta = page.locator('meta[name="robots"]').first()
  if (esperado === null) {
    await expect(meta).toHaveCount(0)
    return
  }
  await expect(meta).toHaveAttribute('content', esperado)
}

// ---------------------------------------------------------------------------
// Compositor de publicaciones (PART 17 §17.4.3)
// ---------------------------------------------------------------------------

export type NuevaPublicacion = {
  body: string
  title?: string
  /** Nombre EXACTO de la materia del catálogo; sólo donde el compositor la ofrece. */
  materiaNombre?: string
  anonymous?: boolean
  pregunta?: boolean
}

/**
 * Abre la caja colapsada del compositor. Colapsado es un `<button>` cuyo nombre
 * accesible es el placeholder (§17.2.1); expandido aparece el textarea con el
 * rótulo sr-only "Tu publicación".
 */
export async function openComposer(page: Page, placeholder: string): Promise<void> {
  await page.getByRole('button', { name: placeholder }).click()
  await expect(page.getByLabel('Tu publicación')).toBeVisible()
}

/**
 * Publica y espera el aterrizaje en `/p/<publicId>`, que es lo que hace el
 * compositor al recibir el `ok()` de la Server Action. Devuelve el `public_id`.
 */
export async function publish(page: Page, post: NuevaPublicacion): Promise<string> {
  await page.getByLabel('Tu publicación').fill(post.body)

  if (post.title !== undefined) {
    await page.getByRole('button', { name: '+ Agregar título' }).click()
    await page.getByLabel('Título (opcional)').fill(post.title)
  }

  if (post.materiaNombre !== undefined) {
    // `<input list>` + `<datalist>`: el compositor toma la materia cuando el texto
    // coincide EXACTO con un nombre del catálogo, y reemplaza el campo por un chip
    // removible. Ese chip —y no el texto suelto, que también está en el riel— es
    // la señal de que la etiqueta quedó puesta.
    await page.getByLabel('Materia (opcional)').fill(post.materiaNombre)
    await expect(page.getByRole('button', { name: 'Quitar materia' })).toBeVisible()
  }

  if (post.pregunta) {
    await page.getByLabel('Es una pregunta').check()
  }

  if (post.anonymous) {
    await page.getByLabel('Publicar como anónimo').check()
    await expect(page.getByText('Publicás como Anónimo')).toBeVisible()
  }

  await page.getByRole('button', { name: 'Publicá' }).click()

  await page.waitForURL(/\/p\/[a-z0-9]{10}/)
  return postPublicIdFromUrl(page)
}

/**
 * Atajo del flujo completo desde la página de una materia: ahí el compositor ya
 * viene con el chip de la materia puesto, así que no hace falta el datalist.
 */
export async function publishFromMateria(
  page: Page,
  materiaSlug: string,
  post: Omit<NuevaPublicacion, 'materiaNombre'>,
): Promise<string> {
  await page.goto(`/materias/${materiaSlug}`)
  await openComposer(page, COMPOSER_PLACEHOLDER.materia)
  return publish(page, post)
}

// ---------------------------------------------------------------------------
// Buzón local: el link de confirmación del alta
// ---------------------------------------------------------------------------

type MailpitSearch = { messages?: Array<{ ID?: string }> }
type MailpitMessage = { Text?: string; HTML?: string }
type InbucketList = Array<{ id?: string }>
type InbucketMessage = { body?: { text?: string; html?: string } }

/** Primera URL de confirmación de GoTrue que aparezca en el cuerpo del mail. */
function extractVerifyLink(body: string): string | null {
  const texto = body.replace(/&amp;/g, '&')
  const urls = texto.match(/https?:\/\/[^\s"'<>()[\]]+/g) ?? []
  return (
    urls.find((url) => url.includes('/auth/v1/verify') || url.includes('/auth/callback')) ?? null
  )
}

async function readMailpit(request: APIRequestContext, email: string): Promise<string | null> {
  const search = await request.get(
    `${MAILBOX_URL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
    { failOnStatusCode: false },
  )
  if (!search.ok()) return null

  const { messages } = (await search.json()) as MailpitSearch
  const id = messages?.[0]?.ID
  if (!id) return null

  const detail = await request.get(`${MAILBOX_URL}/api/v1/message/${id}`, {
    failOnStatusCode: false,
  })
  if (!detail.ok()) return null

  const message = (await detail.json()) as MailpitMessage
  return extractVerifyLink(`${message.Text ?? ''}\n${message.HTML ?? ''}`)
}

async function readInbucket(request: APIRequestContext, email: string): Promise<string | null> {
  const mailbox = email.split('@')[0]
  if (!mailbox) return null

  const list = await request.get(`${MAILBOX_URL}/api/v1/mailbox/${mailbox}`, {
    failOnStatusCode: false,
  })
  if (!list.ok()) return null

  const messages = (await list.json()) as InbucketList
  const id = messages[messages.length - 1]?.id
  if (!id) return null

  const detail = await request.get(`${MAILBOX_URL}/api/v1/mailbox/${mailbox}/${id}`, {
    failOnStatusCode: false,
  })
  if (!detail.ok()) return null

  const message = (await detail.json()) as InbucketMessage
  return extractVerifyLink(`${message.body?.text ?? ''}\n${message.body?.html ?? ''}`)
}

/**
 * Busca en el buzón local el link de confirmación del alta.
 *
 * Devuelve `null` —y NO falla— cuando no aparece: con
 * `[auth.email] enable_confirmations = false` en `supabase/config.toml`, GoTrue
 * autoconfirma y no manda nada. Ese caso es legítimo en local y el flujo 01 lo
 * resuelve navegando directo a `/registro/continuar`, que es exactamente adonde
 * lleva el link.
 */
export async function findConfirmationLink(
  request: APIRequestContext,
  email: string,
  { intentos = 10, esperaMs = 500 }: { intentos?: number; esperaMs?: number } = {},
): Promise<string | null> {
  for (let intento = 0; intento < intentos; intento += 1) {
    try {
      const link = (await readMailpit(request, email)) ?? (await readInbucket(request, email))
      if (link) return link
    } catch {
      // Buzón apagado o API distinta: se cae al camino de autoconfirmación.
      return null
    }
    await new Promise((resolve) => setTimeout(resolve, esperaMs))
  }
  return null
}
