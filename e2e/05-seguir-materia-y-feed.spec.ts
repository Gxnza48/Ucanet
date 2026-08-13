/**
 * FLUJO DORADO 5 (PART 25 §25.4): seguir una materia → una publicación nueva de
 * esa materia aparece en el feed "Mis materias".
 *
 * PRECONDICIÓN DE DATOS
 * ---------------------
 * `supabase db reset` con catálogo + fixtures. Se apoya en:
 *   · La materia "Contabilidad" (`contabilidad`) del catálogo. Se eligió porque
 *     `ana@ucanet.test` NO la sigue en el seed (§3 sigue derecho-romano y
 *     derecho-penal-parte-general): el test tiene que poder pasar de "no
 *     seguida" a "seguida". El seguimiento se hace idempotente igual, para que
 *     la segunda corrida contra la misma base no falle.
 *   · `bruno@ucanet.test` (CafeDeLaMaquina, Contador Público), que publica en
 *     esa materia. Con perfil `activo`, como pide `create_post`.
 *
 * Acá va también el gate de accesibilidad del FEED con el compositor desplegado
 * (§25.5: "feed" y "composer form" son dos de las cinco pantallas del gate).
 */
import { expect, test } from '@playwright/test'

import {
  COMPOSER_PLACEHOLDER,
  SEED,
  USERS,
  expectNoSeriousA11yViolations,
  openComposer,
  publishFromMateria,
  signIn,
  signOut,
  unique,
} from './helpers'

const MATERIA = SEED.materias.contabilidad

test('al seguir una materia, lo que se publica ahí entra al feed Mis materias', async ({
  page,
}) => {
  const titulo = `Consulta de cursada E2E ${unique()}`

  // ---------------------------------------------------------------------
  // Ana sigue la materia. El botón es un toggle optimista con nombre accesible
  // estable (§17.4.1), así que el estado se lee por su aria-label y aria-pressed.
  // ---------------------------------------------------------------------
  await signIn(page, USERS.ana)
  await page.goto(`/materias/${MATERIA.slug}`)

  const seguir = page.getByRole('button', { name: `Seguir ${MATERIA.nombre}` })
  if (await seguir.isVisible()) {
    await seguir.click()
  }
  await expect(
    page.getByRole('button', { name: `Dejar de seguir ${MATERIA.nombre}` }),
  ).toHaveAttribute('aria-pressed', 'true')

  // Con la materia seguida, el feed de Ana ya es "Mis materias" de verdad.
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Mis materias' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await expect(page.getByRole('link', { name: 'Reciente' })).toBeVisible()

  // Gate de accesibilidad del feed CON el compositor desplegado (§25.5).
  await openComposer(page, COMPOSER_PLACEHOLDER.home)
  await expectNoSeriousA11yViolations(page, '/ (feed Mis materias + compositor)')

  await signOut(page, USERS.ana)

  // ---------------------------------------------------------------------
  // Bruno publica en esa materia. El compositor de la página de materia ya trae
  // el chip puesto: la publicación queda etiquetada sin tocar el buscador.
  // ---------------------------------------------------------------------
  await signIn(page, USERS.bruno)
  const publicId = await publishFromMateria(page, MATERIA.slug, {
    body: 'Publicación de prueba E2E para verificar que el feed de quien sigue la materia la levanta.',
    title: titulo,
    pregunta: true,
  })
  await expect(page.getByText('Pregunta')).toBeVisible()

  // Y también aparece en la propia página de la materia.
  await page.goto(`/materias/${MATERIA.slug}`)
  await expect(page.getByRole('link', { name: titulo })).toBeVisible()

  await signOut(page, USERS.bruno)

  // ---------------------------------------------------------------------
  // Ana la encuentra en su feed sin haber ido a buscarla.
  // ---------------------------------------------------------------------
  await signIn(page, USERS.ana)
  await page.goto('/')

  const fila = page
    .getByRole('main')
    .getByRole('listitem')
    .filter({ has: page.getByRole('link', { name: titulo }) })
  await expect(fila).toHaveCount(1)
  // La fila del feed muestra el seudónimo del autor y el chip de la materia,
  // pero NO lleva control de voto (§0.5-R20).
  await expect(fila.getByText(USERS.bruno.handle)).toBeVisible()
  await expect(fila.getByRole('link', { name: MATERIA.nombre })).toBeVisible()
  await expect(fila.getByRole('button', { name: 'Votar publicación' })).toHaveCount(0)

  await fila.getByRole('link', { name: titulo }).click()
  await page.waitForURL(new RegExp(`/p/${publicId}`))
  await expect(page.getByRole('heading', { name: titulo, level: 1 })).toBeVisible()
})
