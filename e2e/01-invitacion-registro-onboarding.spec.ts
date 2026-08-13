/**
 * FLUJO DORADO 1 (PART 25 §25.4): invitación → registro → onboarding → feed
 * "Mis materias" poblado.
 *
 * PRECONDICIÓN DE DATOS
 * ---------------------
 * `supabase db reset` con el catálogo académico aplicado antes que las fixtures
 * (ver e2e/README.md). De ahí salen:
 *   · `invites.code = 'devinv01'`, viva, 25 usos, creada por MateConBizcochos
 *     (supabase/seed.sql §11). Cada corrida consume UNO: con las dos vistas del
 *     config (mobile + desktop) alcanza para ~12 corridas antes de otro reset.
 *   · La carrera "Abogacía" y la materia "Derecho Constitucional" del catálogo
 *     (supabase/seed/catalog/30_carreras.sql y 40_materias_abogacia.sql).
 *   · `seedpost01` publicado en Derecho Constitucional, para que el feed de la
 *     cuenta recién creada tenga algo que mostrar apenas sigue la materia.
 *
 * Además necesita el buzón local (Mailpit/Inbucket en 127.0.0.1:54324) SI el
 * proyecto tiene `enable_confirmations = true`. Con la confirmación apagada el
 * test sigue de largo por el camino de autoconfirmación; las dos variantes están
 * cubiertas y ninguna de las dos ensucia el resultado.
 *
 * Este flujo CREA una cuenta nueva por corrida y no la borra: son filas de
 * fixture en una base local que se rehace con `db reset`.
 */
import { expect, test } from '@playwright/test'

import {
  INVITE_CODE,
  SEED,
  SEED_PASSWORD,
  expectNoSeriousA11yViolations,
  expectSignedIn,
  findConfirmationLink,
  uniqueEmail,
  uniqueHandle,
} from './helpers'

test('con una invitación viva se crea la cuenta, se elige seudónimo y el feed queda armado', async ({
  page,
  request,
}) => {
  const email = uniqueEmail()
  const handle = uniqueHandle()

  // ---------------------------------------------------------------------
  // S1 — la invitación no dibuja nada propio: redirige al alta con el código
  // precargado (PART 6 §6.1 S1).
  // ---------------------------------------------------------------------
  await page.goto(`/invitacion/${INVITE_CODE}`)
  await expect(page).toHaveURL(new RegExp(`/registro\\?invitacion=${INVITE_CODE}$`))
  await expect(page.getByRole('heading', { name: 'Te invitaron a uca.net' })).toBeVisible()

  // El alta es la pantalla principal de este flujo: acá va el gate de axe (§25.5).
  await expectNoSeriousA11yViolations(page, '/registro con invitación válida')

  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña').fill(SEED_PASSWORD)
  await page.getByLabel('Tengo 16 años o más').check()
  await page.getByRole('button', { name: 'Crear cuenta' }).click()

  // ---------------------------------------------------------------------
  // S2 — intersticial. Con confirmación obligatoria todavía no hay sesión: lo
  // único que se puede hacer es ir a la casilla.
  // ---------------------------------------------------------------------
  await expect(page.getByRole('heading', { name: 'Revisá tu casilla' })).toBeVisible()
  await expect(page.getByText(email, { exact: true })).toBeVisible()

  const confirmLink = await findConfirmationLink(request, email)
  if (confirmLink) {
    // El link de GoTrue pasa por /auth/callback y aterriza en /registro/continuar.
    await page.goto(confirmLink)
  } else {
    // Sin confirmación de correo, `signUp` ya dejó la sesión abierta: se entra
    // directo al mismo destino al que llevaría el link.
    await page.goto('/registro/continuar')
  }
  await page.waitForURL(/\/registro\/continuar/)

  // ---------------------------------------------------------------------
  // S3 — seudónimo. Dos pantallas, un solo envío (PART 6 §6.1 S3 y S4).
  // ---------------------------------------------------------------------
  await expect(page.getByText('Paso 1 de 2')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Elegí tu seudónimo' })).toBeVisible()
  await expect(page.getByText('Tu nombre real no se pide nunca.')).toBeVisible()

  await page.getByLabel('Seudónimo').fill(handle)
  await page.getByRole('button', { name: 'Continuar' }).click()

  // ---------------------------------------------------------------------
  // S4 — carrera y año.
  // ---------------------------------------------------------------------
  await expect(page.getByRole('heading', { name: '¿Qué estudiás?' })).toBeVisible()
  await expect(page.getByText('Paso 2 de 2')).toBeVisible()

  await page.getByLabel('Carrera').selectOption({ label: 'Abogacía' })
  await page.getByLabel('Año de ingreso').selectOption({ label: String(new Date().getFullYear()) })
  await page.getByRole('button', { name: 'Ir al feed' }).click()

  // ---------------------------------------------------------------------
  // Feed. La cuenta es nueva y todavía no sigue nada: §17.2 muestra el vacío
  // que empuja a seguir materias, no una pantalla en blanco.
  // ---------------------------------------------------------------------
  await page.waitForURL(/\/$/)
  await expectSignedIn(page, { email, password: SEED_PASSWORD, handle, carrera: 'Abogacía' })

  // `level: 1` desambigua del bloque "Mis materias" del riel, que es un h2.
  await expect(page.getByRole('heading', { name: 'Mis materias', level: 1 })).toBeVisible()
  await expect(page.getByText('Todavía no seguís ninguna materia.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Explorar materias' })).toBeVisible()
  // El compositor ya está disponible: la cuenta quedó `activo`, no `nuevo`.
  await expect(page.getByRole('button', { name: '¿Qué está pasando en tu carrera?' })).toBeVisible()

  // ---------------------------------------------------------------------
  // …y con una materia seguida, el feed se puebla (§25.4: "feed Mis materias
  // populated"). Derecho Constitucional trae seedpost01.
  // ---------------------------------------------------------------------
  await page.goto(`/materias/${SEED.materias.constitucional.slug}`)
  await page.getByRole('button', { name: `Seguir ${SEED.materias.constitucional.nombre}` }).click()
  await expect(
    page.getByRole('button', { name: `Dejar de seguir ${SEED.materias.constitucional.nombre}` }),
  ).toHaveAttribute('aria-pressed', 'true')

  await page.goto('/')
  await expect(page.getByRole('link', { name: SEED.posts.consti.title })).toBeVisible()
  await expect(page.getByText('Todavía no seguís ninguna materia.')).toHaveCount(0)
})
