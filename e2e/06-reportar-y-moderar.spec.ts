/**
 * FLUJO DORADO 6 (PART 25 §25.4): reportar una publicación → el moderador entra
 * al panel → la remueve → el visitante ve la lápida.
 *
 * PRECONDICIÓN DE DATOS
 * ---------------------
 * `supabase db reset` con catálogo + fixtures. Se apoya en:
 *   · `mod@ucanet.test` con `role = 'mod'` (supabase/seed.sql §2). Es la única
 *     cuenta del seed que atraviesa las tres capas de autorización de `/mod`:
 *     el gate de `proxy.ts`, `requireMod()` en el layout y las políticas RLS.
 *   · `ana@ucanet.test` y `bruno@ucanet.test` con perfil `activo`: una publica,
 *     el otro reporta. Reportar contenido propio no es el caso a probar.
 *   · La materia "Derecho Romano" del catálogo, para etiquetar la publicación.
 *
 * El flujo CREA su propia publicación en vez de moderar una del seed: removerla
 * es destructivo, y las fixtures las comparten los otros cinco flujos y las dos
 * vistas (mobile y desktop) que corren en paralelo contra la misma base.
 *
 * Nota sobre la lápida: §0.5-R23c pide 410 Gone, pero una página del App Router
 * no puede fijar el código de respuesta (deuda anotada en la propia ruta). Lo que
 * se afirma acá es el objetivo real de la regla —el texto de lápida y el
 * `noindex`—, no el status HTTP.
 */
import { expect, test } from '@playwright/test'

import {
  COMPOSER_PLACEHOLDER,
  SEED,
  USERS,
  expectNoSeriousA11yViolations,
  expectRobots,
  openComposer,
  publish,
  signIn,
  signOut,
  unique,
} from './helpers'

test('lo reportado se modera y la publicación removida deja una lápida', async ({ page }) => {
  const titulo = `Publicación reportable E2E ${unique()}`

  // ---------------------------------------------------------------------
  // 1. Ana publica.
  // ---------------------------------------------------------------------
  await signIn(page, USERS.ana)
  await openComposer(page, COMPOSER_PLACEHOLDER.home)
  const publicId = await publish(page, {
    body: 'Contenido de prueba creado por la suite E2E para ejercitar el circuito de reporte y moderación.',
    title: titulo,
    materiaNombre: SEED.materias.romano.nombre,
  })
  await signOut(page, USERS.ana)

  // ---------------------------------------------------------------------
  // 2. Bruno reporta: dos toques, doce categorías, una persona lo revisa
  //    (§11.3.2).
  // ---------------------------------------------------------------------
  await signIn(page, USERS.bruno)
  await page.goto(`/p/${publicId}`)

  await page.getByRole('button', { name: 'Reportar' }).click()

  const reporte = page.getByRole('dialog')
  await expect(reporte.getByText('Reportar publicación')).toBeVisible()
  await expect(
    reporte.getByText('Elegí el motivo que mejor describa el problema. Lo revisa una persona.'),
  ).toBeVisible()

  await reporte.getByRole('radio', { name: 'Spam o publicidad' }).check()
  await reporte.getByLabel('Contanos más').fill('Reporte generado por la suite E2E.')
  await reporte.getByRole('button', { name: 'Enviar reporte' }).click()

  await expect(
    reporte.getByText('Recibimos tu reporte. Te vamos a avisar cuando lo revisemos.'),
  ).toBeVisible()
  // Esc y no un click: el diálogo tiene DOS controles llamados "Cerrar" (la X de
  // la cabecera y el botón de acciones), y Radix ya garantiza el cierre por Esc.
  await page.keyboard.press('Escape')
  await expect(reporte).toHaveCount(0)

  await signOut(page, USERS.bruno)

  // ---------------------------------------------------------------------
  // 3. El moderador abre la cola. Lo que esta pantalla NO muestra es tan
  //    normativo como lo que muestra: quién reportó, nunca (§11.4.1).
  // ---------------------------------------------------------------------
  await signIn(page, USERS.mod)
  await page.goto('/mod')

  await expect(page.getByRole('heading', { name: 'Moderación', level: 1 })).toBeVisible()
  await expect(page.getByText(`Entrás como ${USERS.mod.handle}`)).toBeVisible()
  await expect(page.getByText(USERS.bruno.handle)).toHaveCount(0)

  // Gate de accesibilidad de la pantalla principal de este flujo (§25.5).
  await expectNoSeriousA11yViolations(page, '/mod (cola de moderación)')

  await page.getByRole('link', { name: titulo }).click()
  await page.waitForURL(/\/mod\/reportes\/\d+$/)

  // ---------------------------------------------------------------------
  // 4. Detalle: el contenido tal como lo ve cualquiera, los reportes sin
  //    denunciante, y recién abajo las acciones.
  // ---------------------------------------------------------------------
  await expect(page.getByText('Contenido denunciado')).toBeVisible()
  await expect(page.getByText(titulo)).toBeVisible()
  await expect(page.getByText('Spam o publicidad')).toBeVisible()
  await expect(
    page.getByText('Quién reportó no se muestra en ningún lado del panel.'),
  ).toBeVisible()
  await expect(page.getByText(`Autor: ${USERS.ana.handle}`)).toBeVisible()

  // El motivo público es obligatorio: sin él las acciones están deshabilitadas.
  const quitar = page.getByRole('button', { name: 'Quitar', exact: true })
  await expect(quitar).toBeDisabled()

  await page
    .getByLabel('Motivo público')
    .fill('Regla 5 — spam. Removido durante la verificación E2E del panel.')
  await page.getByLabel('Notas internas').fill('Fixture de la suite E2E.')
  await expect(quitar).toBeEnabled()

  // ---------------------------------------------------------------------
  // 5. Toda acción destructiva confirma con el recorte del objetivo delante
  //    (§17.4.10).
  // ---------------------------------------------------------------------
  await quitar.click()
  const confirmacion = page.getByRole('dialog')
  await expect(confirmacion.getByText('¿Quitar este contenido?')).toBeVisible()
  await expect(confirmacion.getByText(titulo)).toBeVisible()
  await confirmacion.getByRole('button', { name: 'Quitar', exact: true }).click()

  await expect(page.getByText('Listo. La acción quedó registrada.')).toBeVisible()

  // Y el reporte se cierra: el aviso a quien reportó es neutro y no cuenta la
  // sanción (§11.3.4).
  await page.getByLabel('Resultado').selectOption({ label: 'Se tomó una acción' })
  await page.getByRole('button', { name: 'Cerrar reporte' }).click()
  await expect(page.getByText('Listo. La acción quedó registrada.')).toBeVisible()

  await signOut(page, USERS.mod)

  // ---------------------------------------------------------------------
  // 6. Para el visitante, la dirección queda como lápida: se dice qué pasó, no
  //    se recicla la URL y no se indexa (§0.5-R23c, §23.1).
  // ---------------------------------------------------------------------
  await page.goto(`/p/${publicId}`)
  await expect(
    page.getByRole('heading', { name: 'Esta publicación ya no está.', level: 1 }),
  ).toBeVisible()
  await expect(page.getByText('La eliminó su autor o el equipo de moderación.')).toBeVisible()
  await expect(page.getByText(titulo)).toHaveCount(0)
  await expectRobots(page, /noindex/)

  // Tampoco sigue en las listas públicas.
  await page.goto('/reciente')
  await expect(page.getByRole('link', { name: titulo })).toHaveCount(0)
})
