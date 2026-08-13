# e2e — los seis flujos dorados

Suite de Playwright de PART 25 §25.4: **6 flujos × 2 viewports** (`mobile` = Pixel 7,
`desktop` = Chromium 1280×800), con una aserción de accesibilidad de `@axe-core/playwright`
por flujo (§25.5). Locale `es-AR` y zona horaria de Buenos Aires: los tests afirman el copy
en castellano tal como está escrito en `app/` y `features/`, no traducciones ni ids.

> **Estado: escritos, nunca ejecutados.** Se escribieron leyendo las rutas reales sin Docker
> en el entorno. La primera corrida contra un stack local es la que los valida — esperá
> ajustes de timing y de desambiguación de selectores en esa primera pasada, igual que pasó
> con las migraciones (ver el README raíz).

---

## Correrlos

```bash
# 1. Base local con migraciones + catálogo + fixtures (ver "Precondiciones")
npm run db:reset

# 2. La suite entera: 6 flujos × 2 proyectos
npm run test:e2e

# Un solo flujo, un solo viewport
npx playwright test e2e/02-publicar-anonimo-y-votar.spec.ts --project=desktop

# Con interfaz, para depurar
npx playwright test --ui

# Contra un deploy ya levantado (preview de Vercel), sin webServer local
PLAYWRIGHT_BASE_URL=https://<preview>.vercel.app npx playwright test
```

Sin `PLAYWRIGHT_BASE_URL`, `playwright.config.ts` levanta la app por su cuenta con
`npm run build && npm run start` en `http://localhost:3000`. El build tarda: el timeout del
`webServer` es de 180 s.

---

## Precondiciones

### 1. Base local sembrada — **obligatoria**

Todo lo que la suite afirma sale de `supabase/seed.sql` sobre el catálogo académico. El orden
importa: el catálogo primero, las fixtures después. En `supabase/config.toml` (lo crea
`supabase init`, no está commiteado):

```toml
[db.seed]
enabled   = true
sql_paths = ["./seed/catalog/*.sql", "./seed.sql"]
```

y después:

```bash
npm run db:start
npm run db:reset
```

**Corré `db:reset` antes de cada pasada completa de la suite.** Los flujos crean contenido y
uno de ellos remueve una publicación: la base queda usable, pero las listas se van llenando y
la invitación de desarrollo se va gastando (25 usos, uno por corrida y por viewport).

Lo que la suite usa del seed:

| Fixture                                                                                  | Qué es                                                         | Quién la usa       |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------ |
| `fundador@ucanet.test` · `MateConBizcochos` · admin                                      | Autor de `seedpost01` y del comentario anónimo de `seedpost03` | 02                 |
| `mod@ucanet.test` · `FiscalDelTercerPiso` · **mod**                                      | La única cuenta que entra a `/mod`                             | 06                 |
| `ana@ucanet.test` · `ApunteDeUltimoMomento` · user                                       | Publica, comenta, sube, sigue materias                         | 02, 03, 04, 05, 06 |
| `bruno@ucanet.test` · `CafeDeLaMaquina` · user                                           | Vota, comenta, reporta, descarga                               | 02, 03, 04, 05, 06 |
| Contraseña de todas                                                                      | `ucanet-local-2026`                                            | `helpers.ts`       |
| `invites.code = 'devinv01'`                                                              | Invitación viva, 25 usos                                       | 01                 |
| `seedpost01` "¿Alguien rindió Consti…"                                                   | Publicación firmada en Derecho Constitucional                  | 01, 02             |
| `seedpost02` "Subí el resumen de Romano…"                                                | Publicación firmada de Ana, **sin avisos pendientes**          | 03                 |
| `seedpost03`                                                                             | Publicación **anónima** con comentario anónimo alias 1         | 02                 |
| `seedpost05`                                                                             | Hilo **bloqueado** por moderación                              | 03                 |
| `seedres001`                                                                             | Recurso PDF de Derecho Constitucional, firmado                 | 04                 |
| `seedres002`                                                                             | Recurso **anónimo** de Contabilidad                            | 04                 |
| Catálogo: `derecho-constitucional`, `derecho-romano`, `contabilidad`, carrera `Abogacía` | Materias y carrera que se eligen en los formularios            | 01, 02, 04, 05     |

Todos los perfiles del seed están en `status = 'activo'`: sin eso, las RPC de contenido
rechazan con `NOT_ONBOARDED` y **todos** los flujos de escritura fallan.

### 2. Variables de entorno

`.env.local` con `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`NEXT_PUBLIC_SITE_URL=http://localhost:3000` y `CRON_SECRET`. Es lo mismo que pide el README
raíz para `npm run dev`.

### 3. Buzón local — sólo si la confirmación de correo está encendida

El flujo 01 crea una cuenta de verdad. Si el proyecto local tiene
`[auth.email] enable_confirmations = true`, el link de confirmación se busca en el buzón local
(Mailpit en el CLI 2.x, Inbucket en los viejos) en `http://127.0.0.1:54324`; se puede mover con
`E2E_MAILBOX_URL`. Si no aparece ningún mail —porque la confirmación está apagada y GoTrue
autoconfirma— el test sigue por el camino de la sesión ya abierta y navega directo a
`/registro/continuar`. Las dos variantes están cubiertas: no hay que configurar nada.

### 4. Cloudflare R2 — opcional, sólo para los bytes

Las claves de objeto del seed son **ficticias** (§0.5-R17) y `presignGet` necesita credenciales
de un bucket de desarrollo. Por eso los pasos que tocan bytes de verdad —el 302 firmado de
`/recursos/[publicId]/descargar` y la subida completa de `04`— se corren sólo con:

```bash
E2E_R2=1 npm run test:e2e     # + las variables de R2 en .env.local
```

Sin `E2E_R2=1` la suite **no falla**: el test de subida se marca como omitido con su motivo y
el de descarga verifica igual lo que gobierna el producto (el enlace, su destino, el `nofollow`
y el muro de sesión de §14.5), que es lo que se rompe por un bug nuestro. Lo que se saltea es
infraestructura de terceros.

---

## Los seis archivos

La numeración es la de PART 25 §25.4, que es donde el plan enumera los flujos. Entre paréntesis,
cómo se reparten los temas que también aparecen sueltos en el brief.

| Archivo                                     | Flujo (§25.4)                                                                                                                                                                            | Precondición de datos propia                                                                                                                                      |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `01-invitacion-registro-onboarding.spec.ts` | Invitación → registro → onboarding → feed "Mis materias" poblado                                                                                                                         | `devinv01` viva; carrera **Abogacía**; `seedpost01` en Derecho Constitucional (para que el feed se pueble al seguirla); buzón local si hay confirmación de correo |
| `02-publicar-anonimo-y-votar.spec.ts`       | Crear post **anónimo** → aparece en Reciente como "Anónimo" → el perfil de su autora no lo muestra (+ **voto** de otra cuenta, + **recorrido deslogueado** de home y post con canónicos) | `ana` y `bruno` activos; materia **Derecho Romano**; `seedpost03` anónimo con su comentario alias 1                                                               |
| `03-comentar-y-aviso.spec.ts`               | Comentar → la autora ve el aviso y llega al hilo (+ hilo bloqueado)                                                                                                                      | `seedpost02` (elegido porque **no** tiene avisos sin leer sembrados, a diferencia de `seedpost01`); `ana.notif_respuestas = true`; `seedpost05` bloqueado         |
| `04-buscar-materia-y-descargar.spec.ts`     | Buscar "constitucional" → abrir la materia → **descargar** un recurso (+ **subir** uno de punta a punta, + ficha pública del recurso anónimo)                                            | `seedres001`, `seedres002`; materia **Derecho Constitucional** y su alias "constitucional"; `bruno` activo; **R2 para los bytes**                                 |
| `05-seguir-materia-y-feed.spec.ts`          | Seguir una materia → una publicación nueva de esa materia aparece en "Mis materias"                                                                                                      | Materia **Contabilidad**, que `ana` **no** sigue en el seed; `bruno` (Contador Público) activo                                                                    |
| `06-reportar-y-moderar.spec.ts`             | Reportar → el mod entra al panel → remueve → **lápida** para el visitante                                                                                                                | `mod@ucanet.test` con `role = 'mod'`; `ana` y `bruno` activos; materia **Derecho Romano**                                                                         |

`helpers.ts` concentra las cuentas, los `public_id` del seed, el ingreso/salida por el
formulario real, el compositor, el gate de axe y las aserciones de SEO.

### Dónde está cada aserción del gate de accesibilidad (§25.5)

Las cinco pantallas que pide §25.5, repartidas para no correr axe dos veces sobre la misma:

| Pantalla                                    | Archivo                           |
| ------------------------------------------- | --------------------------------- |
| Alta / formulario de identidad              | `01` (`/registro` con invitación) |
| Home sin sesión                             | `02`                              |
| Página de publicación con comentarios       | `02`                              |
| Página de materia                           | `04`                              |
| Formulario de subida                        | `04` (sólo con `E2E_R2=1`)        |
| Feed "Mis materias" + compositor desplegado | `05`                              |
| Cola de moderación                          | `06`                              |

El gate es **cero violaciones `serious` o `critical`** con las reglas WCAG 2.1 A + AA. Las
`moderate` y `minor` no fallan: son backlog (§25.5). El chequeo humano de teclado y foco no lo
reemplaza axe y vive en la definición de terminado (PART 26).

---

## Reglas de la suite

1. **Selectores accesibles, siempre.** `getByRole`, `getByLabel`, `getByText` con el copy es-AR
   real. Nada de clases de Tailwind ni de estructura del DOM. Las dos excepciones son
   selectores por `href`, que es contrato de producto (D7), y por `meta[name="robots"]` /
   `link[rel="canonical"]`, que son la salida de SEO que se está verificando.
2. **`e2e/` no importa código de la aplicación.** El alias `@/` no está garantizado acá
   (`tsconfig.json` excluye este directorio) y, sobre todo: un test que importa la constante que
   afirma no prueba nada. El copy está escrito a mano, copiado de `app/` y `features/`. Si
   alguien cambia una cadena visible, el test **tiene** que fallar.
3. **Cero dependencias nuevas.** Sólo `@playwright/test` y `@axe-core/playwright`, ya en el
   `package.json`.
4. **Los flujos no se pisan.** Los dos proyectos (mobile y desktop) corren en paralelo contra la
   **misma** base. Por eso: todo lo que se crea lleva un sufijo único, el seguimiento de una
   materia es idempotente, el flujo que remueve contenido crea el suyo en vez de destruir una
   fixture compartida, y las aserciones sobre avisos toleran la agrupación (`respondió` /
   `respondieron`).
5. **Los textos protegidos se afirman literales.** El explicador de anonimato
   ("Tu nombre no se muestra. El equipo de moderación puede ver el autor.") y el aviso del
   perfil ("Tus publicaciones anónimas no aparecen acá ni en tu perfil público.") son promesas
   del producto (D3): están en los tests para que cambiarlas cueste una enmienda.

---

## Depurar una falla

```bash
npx playwright test --ui                       # inspector, paso a paso
npx playwright test --headed --project=mobile  # ver el navegador
npx playwright show-report                     # último reporte HTML
npx playwright show-trace test-results/**/trace.zip
```

En CI, `retries: 2` y `trace: 'on-first-retry'`: la traza del primer reintento queda como
artefacto del job.

Si una falla no se entiende, el primer sospechoso es la base: `npm run db:reset` y de nuevo. El
segundo es el modo estricto de Playwright (dos elementos con el mismo nombre accesible, casi
siempre el riel de escritorio duplicando un texto del contenido) — se resuelve acotando con
`getByRole('main')` o con `.first()`, nunca bajando a un selector CSS.
