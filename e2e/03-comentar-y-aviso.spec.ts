/**
 * FLUJO DORADO 3 (PART 25 §25.4): comentar una publicación → la autora ve el
 * aviso y desde ahí navega al hilo.
 *
 * PRECONDICIÓN DE DATOS
 * ---------------------
 * `supabase db reset` con catálogo + fixtures. Se apoya en:
 *   · `seedpost02` ("Subí el resumen de Romano, bolillas 1 a 5"), firmado por
 *     ApunteDeUltimoMomento (supabase/seed.sql §4). Se eligió ESTE y no
 *     seedpost01 a propósito: seedpost01 ya trae un aviso SIN LEER sembrado con
 *     `group_key = 'respuesta_post:<id>'` (§10 del seed), y un comentario nuevo
 *     se agruparía en esa fila en vez de crear una — el aviso diría "X y 1 más
 *     respondieron". seedpost02 no tiene avisos pendientes.
 *   · `bruno@ucanet.test` (CafeDeLaMaquina), que no es el autor: la RPC no
 *     notifica a nadie por comentarse a sí mismo.
 *   · El perfil de ana con `notif_respuestas = true` (seed §2). Con el
 *     interruptor apagado, `create_comment` no inserta el aviso.
 *
 * La aserción del texto va con expresión regular a propósito: si la suite corre
 * dos veces contra la misma base (o los dos proyectos, mobile y desktop, tocan
 * el mismo hilo), el aviso se agrupa y el verbo pasa a plural. Lo que importa es
 * que el aviso exista, nombre al actor y lleve al hilo.
 */
import { expect, test } from '@playwright/test'

import { SEED, USERS, expectNoSeriousA11yViolations, signIn, signOut, unique } from './helpers'

test('un comentario nuevo le llega como aviso a la autora y la lleva al hilo', async ({ page }) => {
  const comentario = `Comentario de prueba E2E ${unique()}: ¿está actualizado con la bolilla 6?`

  // ---------------------------------------------------------------------
  // Bruno comenta el hilo de Ana.
  // ---------------------------------------------------------------------
  await signIn(page, USERS.bruno)
  await page.goto(`/p/${SEED.posts.romano.publicId}`)

  await expect(page.getByRole('heading', { name: SEED.posts.romano.title, level: 1 })).toBeVisible()

  await page.getByLabel('Tu comentario').fill(comentario)
  await page.getByRole('button', { name: 'Comentar' }).click()

  // El árbol lo arma el servidor: la acción refresca la ruta y el comentario aparece.
  await expect(page.getByText(comentario)).toBeVisible()
  // Firmado, no anónimo: se ve el seudónimo y enlaza al perfil.
  await expect(page.getByRole('link', { name: USERS.bruno.handle }).first()).toBeVisible()

  await signOut(page, USERS.bruno)

  // ---------------------------------------------------------------------
  // Ana entra y encuentra el aviso. La visita marca todo leído DESPUÉS de
  // renderizar (§17.4.7), así que en esta primera vista todavía se ve sin leer.
  // ---------------------------------------------------------------------
  await signIn(page, USERS.ana)
  await page.goto('/avisos')

  await expect(page.getByRole('heading', { name: 'Avisos', level: 1 })).toBeVisible()

  // Gate de accesibilidad de la pantalla principal de este flujo (§25.5).
  await expectNoSeriousA11yViolations(page, '/avisos')

  const aviso = page
    .getByRole('main')
    .getByRole('listitem')
    .filter({
      hasText: new RegExp(`${USERS.bruno.handle}.*(respondió|respondieron) tu publicación.*Romano`),
    })
  await expect(aviso).toHaveCount(1)

  // La fila es un enlace al hilo (§17.4.7): el aviso lleva adonde pasó la cosa.
  const enlace = aviso.getByRole('link').first()
  await expect(enlace).toHaveAttribute('href', new RegExp(`/p/${SEED.posts.romano.publicId}`))
  await enlace.click()

  await page.waitForURL(new RegExp(`/p/${SEED.posts.romano.publicId}`))
  await expect(page.getByText(comentario)).toBeVisible()
})

test('el hilo bloqueado por moderación no admite comentarios nuevos', async ({ page }) => {
  // §0.5-R5: `seedpost05` quedó bloqueado por una acción de moderación sembrada
  // (seed §4 y §9). El compositor de comentarios se reemplaza por el aviso.
  await signIn(page, USERS.ana)
  await page.goto(`/p/${SEED.posts.bloqueado.publicId}`)

  await expect(
    page.getByText('El hilo está bloqueado: no admite comentarios nuevos.'),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Comentar' })).toHaveCount(0)
  await expect(page.getByText('Hilo bloqueado')).toBeVisible()
})
