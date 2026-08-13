/**
 * FLUJO DORADO 2 (PART 25 §25.4): crear una publicación anónima → aparece en
 * Reciente firmada "Anónimo" → el perfil de su autora no muestra nada.
 * Incluye el voto de otra cuenta y —como manda §25.4— la lectura DESLOGUEADA de
 * la home y de la página de una publicación, con sus aserciones de SEO.
 *
 * PRECONDICIÓN DE DATOS
 * ---------------------
 * `supabase db reset` con catálogo + fixtures. Se apoya en:
 *   · `ana@ucanet.test` / `bruno@ucanet.test` con perfil `activo`
 *     (supabase/seed.sql §2). Sin `activo`, `create_post` rechaza con NOT_ONBOARDED.
 *   · La materia "Derecho Romano" del catálogo, que es la que se etiqueta.
 *   · `seedpost03`: publicación ANÓNIMA de ApunteDeUltimoMomento con un
 *     comentario anónimo de MateConBizcochos que toma el alias 1
 *     (supabase/seed.sql §5 y §6). Es la fixture de anonimato del producto.
 *
 * El voto lo pone Bruno porque la RPC rechaza el auto-voto y el control ni
 * siquiera se ofrece al autor (§17.6).
 */
import { expect, test } from '@playwright/test'

import {
  COMPOSER_PLACEHOLDER,
  SEED,
  USERS,
  expectCanonicalPath,
  expectNoSeriousA11yViolations,
  openComposer,
  publish,
  signIn,
  signOut,
  unique,
} from './helpers'

test('lo anónimo se publica, se lee y se vota sin que aparezca nunca su autora', async ({
  page,
}) => {
  const titulo = `Duda anónima de prueba ${unique()}`
  const cuerpo =
    'Publico esto en anónimo desde la suite E2E. Si aparece mi seudónimo en algún lado, el test tiene que fallar.'

  await signIn(page, USERS.ana)

  // ---------------------------------------------------------------------
  // Compositor: el explicador de anonimato es una cadena protegida (D3).
  // ---------------------------------------------------------------------
  await openComposer(page, COMPOSER_PLACEHOLDER.home)
  await expect(
    page.getByText('Tu nombre no se muestra. El equipo de moderación puede ver el autor.'),
  ).toBeVisible()

  const publicId = await publish(page, {
    body: cuerpo,
    title: titulo,
    materiaNombre: SEED.materias.romano.nombre,
    anonymous: true,
  })

  // ---------------------------------------------------------------------
  // Página de la publicación: firma "Anónimo" y NINGÚN camino al perfil (D3).
  // ---------------------------------------------------------------------
  await expect(page.getByRole('heading', { name: titulo, level: 1 })).toBeVisible()
  await expect(page.getByText(cuerpo)).toBeVisible()
  await expect(page.getByText('Anónimo', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: USERS.ana.handle })).toHaveCount(0)

  // Gate de accesibilidad sobre la página del hilo (§25.5: "post page with comments").
  await expectNoSeriousA11yViolations(page, `/p/${publicId} (publicación + comentarios)`)

  // ---------------------------------------------------------------------
  // Reciente: la fila la firma "Anónimo".
  // ---------------------------------------------------------------------
  await page.goto('/reciente')
  const fila = page
    .getByRole('main')
    .getByRole('listitem')
    .filter({ has: page.getByRole('link', { name: titulo }) })
  await expect(fila).toHaveCount(1)
  await expect(fila.getByText('Anónimo', { exact: true })).toBeVisible()
  await expect(fila.getByRole('link', { name: USERS.ana.handle })).toHaveCount(0)

  // ---------------------------------------------------------------------
  // Perfil propio: lo anónimo no se lista ni para su autora (§17.4.4).
  // ---------------------------------------------------------------------
  await page.goto(`/u/${USERS.ana.handle}`)
  await expect(
    page.getByText('Tus publicaciones anónimas no aparecen acá ni en tu perfil público.'),
  ).toBeVisible()
  await expect(page.getByText(titulo)).toHaveCount(0)
  await expect(page.getByText(cuerpo)).toHaveCount(0)

  // ---------------------------------------------------------------------
  // Voto: lo pone Bruno. El número se mueve al instante y el servidor confirma.
  // ---------------------------------------------------------------------
  await signOut(page, USERS.ana)
  await signIn(page, USERS.bruno)
  await page.goto(`/p/${publicId}`)

  const votar = page.getByRole('button', { name: 'Votar publicación' })
  await expect(votar).toHaveAttribute('aria-pressed', 'false')
  await votar.click()
  await expect(votar).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('1 voto', { exact: true })).toBeVisible()
})

test('sin sesión se lee la home y el hilo anónimo, y el contenido anónimo no expone autor', async ({
  page,
}) => {
  // ---------------------------------------------------------------------
  // Home deslogueada (§17.3): franja de dos líneas y CONTENIDO real debajo,
  // no una landing.
  // ---------------------------------------------------------------------
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'La comunidad estudiantil de la UCA Rosario.', level: 1 }),
  ).toBeVisible()
  await expect(
    page.getByText('Publicaciones anónimas, apuntes y parciales viejos, materia por materia.'),
  ).toBeVisible()
  await expect(page.getByRole('main').getByRole('link', { name: 'Crear cuenta' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Ya tengo cuenta' })).toBeVisible()
  // Contenido de verdad dentro del primer viewport: el feed Reciente sembrado.
  await expect(page.getByRole('link', { name: SEED.posts.consti.title })).toBeVisible()

  await expectCanonicalPath(page, '/')
  await expectNoSeriousA11yViolations(page, '/ sin sesión')

  // ---------------------------------------------------------------------
  // Hilo anónimo sembrado: ni el autor del post ni el del comentario salen.
  // ---------------------------------------------------------------------
  await page.goto(`/p/${SEED.posts.anonimo.publicId}`)
  await expect(page.getByText(SEED.posts.anonimo.bodyStart)).toBeVisible()
  await expect(page.getByText('Anónimo', { exact: true }).first()).toBeVisible()
  // El comentarista anónimo se muestra con su alias POR HILO (§8.3.4).
  await expect(page.getByText(SEED.posts.anonimo.aliasComentario)).toBeVisible()
  // Ninguno de los dos seudónimos reales aparece en la página, ni como texto.
  await expect(page.getByText(USERS.ana.handle)).toHaveCount(0)
  await expect(page.getByText(USERS.fundador.handle)).toHaveCount(0)

  // Sin sesión no se comenta: la caja invita a entrar (§17.4.2).
  await expect(page.getByRole('link', { name: 'Ingresá para comentar' })).toBeVisible()

  // SEO (§23.2): canónico a la forma corta, sin sufijo de slug ni parámetros.
  await expectCanonicalPath(page, `/p/${SEED.posts.anonimo.publicId}`)

  // El sufijo de slug es decoración: misma página, mismo canónico (D7).
  await page.goto(`/p/${SEED.posts.anonimo.publicId}/una-duda-de-penal`)
  await expect(page.getByText(SEED.posts.anonimo.bodyStart)).toBeVisible()
  await expectCanonicalPath(page, `/p/${SEED.posts.anonimo.publicId}`)

  // El perfil público de la autora sigue sin mostrar lo anónimo, y no se indexa (C16).
  await page.goto(`/u/${USERS.ana.handle}`)
  await expect(page.getByText(SEED.posts.anonimo.bodyStart)).toHaveCount(0)
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute('content', /noindex/)
})
