/**
 * FLUJO DORADO 4 (PART 25 §25.4): buscar "constitucional" → abrir la materia →
 * descargar un recurso. Incluye —como manda §25.4— la lectura DESLOGUEADA de la
 * página de materia y de la ficha de un recurso, con sus aserciones de SEO, y el
 * flujo de SUBIDA que produce el archivo que después se baja.
 *
 * PRECONDICIÓN DE DATOS
 * ---------------------
 * `supabase db reset` con catálogo + fixtures. Se apoya en:
 *   · La materia "Derecho Constitucional" (`derecho-constitucional`) del catálogo
 *     y su alias de búsqueda "constitucional"
 *     (supabase/seed/catalog/99_aliases.sql).
 *   · `seedres001` — "Resumen completo de Derecho Constitucional (Plan 2013)",
 *     un PDF de 1,5 MB firmado por ApunteDeUltimoMomento (supabase/seed.sql §8).
 *   · `bruno@ucanet.test` para la parte con sesión: sin sesión no hay bytes (§14.5).
 *
 * PRECONDICIÓN DE INFRAESTRUCTURA (R2)
 * ------------------------------------
 * Los objetos de las fixtures NO existen en Cloudflare R2 (§0.5-R17: las claves
 * del seed son ficticias) y `presignGet` necesita credenciales de un bucket de
 * desarrollo. Por eso:
 *   · lo que se afirma SIEMPRE es la puerta de descarga: el enlace, su destino y
 *     el muro de sesión, que es lo que gobierna el producto;
 *   · el 302 a la URL firmada y la subida real de bytes se corren sólo con
 *     `E2E_R2=1` y las variables de R2 en `.env.local`. Sin eso se saltean con
 *     un mensaje explícito en vez de fallar por falta de infraestructura.
 */
import { expect, test } from '@playwright/test'

import {
  R2_READY,
  SEED,
  USERS,
  expectCanonicalPath,
  expectNoSeriousA11yViolations,
  resourcePublicIdFromUrl,
  signIn,
  unique,
} from './helpers'

const MATERIA = SEED.materias.constitucional

test('buscar «constitucional» lleva a la materia y desde ahí al recurso descargable', async ({
  page,
}) => {
  await signIn(page, USERS.bruno)

  // ---------------------------------------------------------------------
  // Búsqueda: la página completa, no el typeahead. Enter dispara la consulta y
  // aterriza en la URL durable `/buscar?q=…` (§13.6, D7).
  // ---------------------------------------------------------------------
  await page.goto('/buscar')
  const buscador = page.getByRole('main').getByLabel('Buscar en el sitio')
  await buscador.fill('constitucional')
  await buscador.press('Enter')

  await page.waitForURL(/\/buscar\?q=constitucional/)

  // Orden de grupos fijo: Materias primero, porque la intención es navegacional
  // (§13.4). La materia tiene que estar en el grupo "Materias".
  await expect(page.getByRole('heading', { name: 'Materias' })).toBeVisible()
  const resultadoMateria = page
    .getByRole('main')
    .getByRole('link', { name: MATERIA.nombre, exact: true })
    .first()
  await expect(resultadoMateria).toBeVisible()
  await resultadoMateria.click()

  // ---------------------------------------------------------------------
  // Página de materia: el activo permanente del producto (D1, §17.4.1).
  // ---------------------------------------------------------------------
  await page.waitForURL(new RegExp(`/materias/${MATERIA.slug}$`))
  await expect(page.getByRole('heading', { name: MATERIA.nombre, level: 1 })).toBeVisible()
  await expectCanonicalPath(page, `/materias/${MATERIA.slug}`)

  // Gate de accesibilidad de la pantalla principal de este flujo (§25.5).
  await expectNoSeriousA11yViolations(page, `/materias/${MATERIA.slug}`)

  // ---------------------------------------------------------------------
  // Pestaña Recursos: es una RUTA, no un estado de cliente (§17.4.1).
  // El `and(...)` desambigua del enlace "Recursos" del riel, que va a /recursos.
  // ---------------------------------------------------------------------
  const pestanaRecursos = page
    .getByRole('link', { name: 'Recursos', exact: true })
    .and(page.locator(`[href="/materias/${MATERIA.slug}/recursos"]`))
  await pestanaRecursos.click()
  await page.waitForURL(new RegExp(`/materias/${MATERIA.slug}/recursos$`))

  const recurso = page.getByRole('link', { name: SEED.resources.consti.title })
  await expect(recurso).toBeVisible()
  await recurso.click()

  // ---------------------------------------------------------------------
  // Ficha del recurso: metadatos públicos, bytes detrás de la sesión (§14.5).
  // ---------------------------------------------------------------------
  await page.waitForURL(new RegExp(`/recursos/${SEED.resources.consti.publicId}$`))
  await expect(
    page.getByRole('heading', { name: SEED.resources.consti.title, level: 1 }),
  ).toBeVisible()
  await expect(page.getByText(`Subido por ${USERS.ana.handle}`)).toBeVisible()

  const descargar = page.getByRole('link', { name: /^Descargar/ })
  await expect(descargar).toBeVisible()
  await expect(descargar).toHaveAttribute(
    'href',
    `/recursos/${SEED.resources.consti.publicId}/descargar`,
  )
  // La ruta de descarga escribe en download_log: no la rastrea nadie (§14.5).
  await expect(descargar).toHaveAttribute('rel', /nofollow/)

  await expectCanonicalPath(page, `/recursos/${SEED.resources.consti.publicId}`)

  // ---------------------------------------------------------------------
  // La descarga en sí: 302 a una URL firmada de 120 s, servida por R2 y no por
  // Vercel. Se pide sin seguir el redirect para no golpear el bucket.
  // ---------------------------------------------------------------------
  if (!R2_READY) {
    test.info().annotations.push({
      type: 'paso omitido',
      description:
        'El 302 firmado necesita un bucket de R2 de desarrollo (E2E_R2=1 + credenciales en .env.local): sin R2, presignGet no puede firmar. El resto del flujo sí se verificó.',
    })
    return
  }

  const respuesta = await page.request.get(
    `/recursos/${SEED.resources.consti.publicId}/descargar`,
    { maxRedirects: 0 },
  )
  expect(respuesta.status()).toBe(302)
  const location = respuesta.headers()['location'] ?? ''
  expect(location, 'el 302 tiene que apuntar a una URL firmada de R2').toMatch(/X-Amz-Signature=/)
  expect(respuesta.headers()['cache-control'] ?? '').toContain('no-store')
})

test('sin sesión el recurso se lee entero pero no entrega bytes', async ({ page }) => {
  await page.goto(`/recursos/${SEED.resources.consti.publicId}`)

  // Los metadatos son públicos e indexables: título, materia, tipo, archivos.
  await expect(
    page.getByRole('heading', { name: SEED.resources.consti.title, level: 1 }),
  ).toBeVisible()
  // `.first()`: la materia aparece dos veces, en las migas y en la línea de datos.
  await expect(page.getByRole('link', { name: MATERIA.nombre }).first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Archivo' })).toBeVisible()

  // Los bytes, no: el botón invita a entrar y vuelve a la ficha (§14.5).
  const puerta = page.getByRole('link', { name: 'Ingresá para descargar' })
  await expect(puerta).toBeVisible()
  await puerta.click()
  await page.waitForURL(/\/ingresar\?next=/)
  expect(new URL(page.url()).searchParams.get('next')).toBe(
    `/recursos/${SEED.resources.consti.publicId}`,
  )

  // El recurso anónimo tampoco expone a quien lo subió (D3, §14.6).
  await page.goto(`/recursos/${SEED.resources.anonimo.publicId}`)
  await expect(page.getByText('Subido por Anónimo')).toBeVisible()
  await expect(page.getByRole('link', { name: USERS.bruno.handle })).toHaveCount(0)
})

test('subir un recurso y descargarlo de punta a punta', async ({ page }) => {
  test.skip(
    !R2_READY,
    'El pipeline de subida sube los bytes DIRECTO a R2 (§14.3): sin bucket de desarrollo no hay adónde escribir. Corré con E2E_R2=1 y las variables de R2 en .env.local.',
  )

  const titulo = `Apunte E2E de Constitucional ${unique()}`

  await signIn(page, USERS.ana)
  await page.goto(`/recursos/subir?materia=${MATERIA.slug}`)

  await expect(page.getByRole('heading', { name: 'Subí un recurso', level: 1 })).toBeVisible()
  await expectNoSeriousA11yViolations(page, '/recursos/subir (formulario de subida)')

  await page.getByLabel('Título').fill(titulo)
  await page.getByLabel('Materia').selectOption({ label: MATERIA.nombre })
  await page.getByLabel('Tipo').selectOption({ label: 'Resumen' })
  await page.getByLabel('Descripción').fill('Archivo mínimo generado por la suite E2E.')
  await page.getByLabel('Archivos').setInputFiles({
    name: 'apunte-e2e.pdf',
    mimeType: 'application/pdf',
    // PDF válido mínimo: encabezado + trailer. Alcanza para el chequeo de MIME
    // y de tamaño; lo que se prueba es el pipeline, no el contenido.
    buffer: Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n', 'utf8'),
  })
  await expect(page.getByText('apunte-e2e.pdf')).toBeVisible()

  await page.getByRole('button', { name: 'Publicá el recurso' }).click()

  await page.waitForURL(/\/recursos\/[a-z0-9]{10}$/, { timeout: 60_000 })
  const publicId = resourcePublicIdFromUrl(page)

  await expect(page.getByRole('heading', { name: titulo, level: 1 })).toBeVisible()
  await expect(page.getByText(`Subido por ${USERS.ana.handle}`)).toBeVisible()
  await expect(page.getByText('apunte-e2e.pdf')).toBeVisible()

  const respuesta = await page.request.get(`/recursos/${publicId}/descargar`, { maxRedirects: 0 })
  expect(respuesta.status()).toBe(302)
  expect(respuesta.headers()['location'] ?? '').toMatch(/X-Amz-Signature=/)
})
