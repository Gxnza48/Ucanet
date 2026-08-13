# uca.net

**uca.net es la capa estudiantil de UCA Rosario**: una comunidad pseudónima donde cada materia y cada carrera tienen una página pública permanente.
Ahí conviven dos cosas al mismo tiempo: la conversación de tu cohorte _ahora_ ("¿se sabe algo del parcial?") y el conocimiento acumulado de todas las cohortes anteriores _siempre_ (resúmenes, parciales viejos, experiencias).
Sitio independiente hecho por estudiantes. Sin afiliación con la Universidad Católica Argentina.

Este README te deja el proyecto andando en local en unos 30 minutos. La fuente normativa de todo lo demás es `docs/plan/` (PART 0 manda) y `docs/BUILD-CONTRACT.md` (las firmas de los módulos).

---

## Estado del repositorio (leelo antes de empezar)

Honestidad primero, porque cambia lo que vas a encontrar:

- **Las migraciones nunca se ejecutaron contra una base real.** Los catorce archivos de `supabase/migrations/` se escribieron contra la especificación de PART 8, sin Docker en el entorno de build. **El primer `supabase db reset` que corras es el que las valida.** Esperá errores de sintaxis, de orden de dependencias o de grants en esa primera pasada, y arreglalos hacia adelante (una migración nueva, nunca editando una ya aplicada — salvo que estés antes del primer apply de tu vida, que es exactamente el caso hoy).
- **`lib/types.gen.ts` está escrito a mano** para que el proyecto tipe antes de que exista una base. Se regenera de verdad con `npm run gen:types` en cuanto tengas el stack local levantado, y CI falla si hay drift. Ver `docs/decisions.md`.
- **La suite pgTAP y los seis flujos de Playwright tampoco corrieron nunca**, por el mismo motivo. Los 66 tests de Vitest sí (son lógica pura). Ver `docs/deuda-conocida.md`.
- **Lo que está roto o a medias vive en `docs/deuda-conocida.md`**, con la causa verificada de cada cosa. El bloqueante para el lanzamiento público es D1.

---

## Stack

Fijo y cerrado. No se sustituye ni se agrega nada sin una entrada en `docs/decisions.md` (D14.8).

| Pieza                       | Versión         | Nota                                                                                     |
| --------------------------- | --------------- | ---------------------------------------------------------------------------------------- |
| Next.js                     | 16.3.0          | App Router. En Next 16 el archivo raíz es **`proxy.ts`**, no `middleware.ts`             |
| React / React DOM           | 19.2.8          | Server Components por defecto                                                            |
| TypeScript                  | 5.x             | `strict` + `noUncheckedIndexedAccess`                                                    |
| Tailwind CSS                | 4.3.3           | CSS-first: el único tema es el bloque `@theme inline` de `app/globals.css`               |
| Zod                         | 4.4.3           | API de Zod 4: `z.email()`, `result.error.issues`                                         |
| Supabase                    | Postgres + Auth | `@supabase/ssr` 0.12.4, `@supabase/supabase-js` 2.112.3, migraciones SQL planas, sin ORM |
| Cloudflare R2               | S3 API          | Todos los archivos de recursos viven acá (§0.5-R17). Supabase Storage no se usa          |
| Vitest / Playwright / pgTAP | —               | Unidad / E2E / políticas RLS                                                             |

Catorce dependencias de producción, ni una más (PART 19 §19.12).

---

## Prerequisitos

| Requisito           | Versión    | Para qué                                                                                                    |
| ------------------- | ---------- | ----------------------------------------------------------------------------------------------------------- |
| **Node.js**         | ≥ 20.9.0   | El `engines` del `package.json` lo exige                                                                    |
| **Docker Desktop**  | corriendo  | El stack local de Supabase (Postgres, Auth, Studio, Mailpit) son contenedores. Sin Docker no hay base local |
| **CLI de Supabase** | 2.114.0    | Ya viene como devDependency: usá `npx supabase <cmd>` y no instales nada global                             |
| **Git**             | cualquiera | —                                                                                                           |

Opcional: una cuenta de Cloudflare R2 con un bucket de desarrollo si vas a probar subidas de archivos a mano. Sin R2 configurado, la app arranca igual y el pipeline de subida falla de forma limpia.

---

## Setup paso a paso

### 1. Cloná e instalá

```bash
git clone <url-del-repo> ucanet
cd ucanet
npm install
```

### 2. Variables de entorno

```bash
cp .env.example .env.local
```

`.env.example` documenta cada variable y de dónde sale. Para local necesitás cuatro: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (las imprime el paso 4), `NEXT_PUBLIC_SITE_URL=http://localhost:3000` y un `CRON_SECRET` cualquiera. Las de R2 y Sentry son opcionales en local. **`SUPABASE_SERVICE_ROLE_KEY` solo la leen `app/api/cron/*` y los scripts de admin** (D14.3): si tu código de request path la necesita, el código está mal.

### 3. Inicializá el stack local de Supabase

Si `supabase/config.toml` no existe todavía:

`supabase/config.toml` ya está en el repo, con los seeds declarados en orden — el catálogo académico primero, las fixtures de desarrollo después:

```toml
[db.seed]
enabled   = true
sql_paths = ["./seed/catalog/*.sql", "./seed.sql"]
```

Ese orden importa: `seed.sql` crea publicaciones y recursos que cuelgan de materias que tienen que existir antes, y aborta a propósito con "el catálogo académico está vacío" si se aplica solo.

### 4. Levantá la base

```bash
npm run db:start        # supabase start — tarda unos minutos la primera vez
```

Copiá a `.env.local` la `API URL` (`http://127.0.0.1:54321`) y la `anon key` que imprime el comando.

### 5. Aplicá migraciones y semillas

```bash
npm run db:reset        # supabase db reset — replay de las 13 migraciones + seeds
```

Esto es lo que valida por primera vez el esquema entero. Si algo revienta, el mensaje de Postgres dice qué migración y qué línea; corregí y volvé a correr `db:reset` (rehace todo desde cero, es idempotente por diseño).

Si preferís no declarar los globs del catálogo en `config.toml` (o estás apuntando a una base remota de prueba), aplicalo aparte:

```bash
npm run db:seed:catalog # scripts/apply-catalog-seed.mjs
```

### 6. Regenerá los tipos

```bash
npm run gen:types       # supabase gen types typescript --local > lib/types.gen.ts
```

Esta es la primera vez que `lib/types.gen.ts` deja de ser un archivo escrito a mano. Revisá el diff con atención: cada diferencia es un lugar donde la mano se equivocó o donde una migración no dice lo que creíamos.

### 7. Arrancá la app

```bash
npm run dev             # http://localhost:3000
```

**Cuentas de prueba** que crea `supabase/seed.sql` (contraseña única `ucanet-local-2026`):

| Email                  | Handle                | Rol   |
| ---------------------- | --------------------- | ----- |
| `fundador@ucanet.test` | MateConBizcochos      | admin |
| `mod@ucanet.test`      | FiscalDelTercerPiso   | mod   |
| `ana@ucanet.test`      | ApunteDeUltimoMomento | user  |
| `bruno@ucanet.test`    | CafeDeLaMaquina       | user  |

Los mails de autenticación no salen a internet: caen en el buzón local de Mailpit/Inbucket, en `http://127.0.0.1:54324`. Supabase Studio está en `http://127.0.0.1:54323` — miralo, pero **no toques el esquema desde ahí** (D14.1).

### 8. Antes de tu primer commit

```bash
npm run check           # typecheck + lint + greps prohibidos + vitest
npm run db:test         # pgTAP
```

---

## Scripts de npm

| Script            | Comando                                 | Para qué                                                                        |
| ----------------- | --------------------------------------- | ------------------------------------------------------------------------------- |
| `dev`             | `next dev`                              | Servidor de desarrollo en `:3000`                                               |
| `build`           | `next build`                            | Build de producción (lo corre Vercel; corrélo local antes de un PR grande)      |
| `start`           | `next start`                            | Sirve el build ya hecho                                                         |
| `lint`            | `eslint`                                | Incluye los límites de import de `eslint-plugin-boundaries`                     |
| `typecheck`       | `tsc --noEmit`                          | `strict` + `noUncheckedIndexedAccess`                                           |
| `format`          | `prettier --write`                      | Formatea ts/tsx/css/md/json                                                     |
| `format:check`    | `prettier --check`                      | Lo mismo, en modo verificación (CI)                                             |
| `test`            | `vitest run`                            | Unidad: schemas Zod, slugs, ids, fechas, texto                                  |
| `test:watch`      | `vitest`                                | Unidad en watch                                                                 |
| `test:e2e`        | `playwright test`                       | Los 6 flujos dorados × 2 viewports + axe                                        |
| `db:start`        | `supabase start`                        | Levanta Postgres, Auth, Studio y Mailpit en Docker                              |
| `db:reset`        | `supabase db reset`                     | Rehace la base desde cero: migraciones + seeds. **El comando central del loop** |
| `db:test`         | `supabase test db`                      | Suite pgTAP de políticas RLS (allow y deny)                                     |
| `db:seed:catalog` | `node scripts/apply-catalog-seed.mjs`   | Aplica `supabase/seed/catalog/*.sql` fuera del CLI (staging, CI con psql)       |
| `gen:types`       | `supabase gen types typescript --local` | Regenera `lib/types.gen.ts`. CI falla si hay drift                              |
| `forbidden`       | `bash scripts/forbidden.sh`             | Los greps prohibidos de PART 25 §25.8                                           |
| `check`           | typecheck + lint + forbidden + test     | Lo que corre CI en el job `check`. Corrélo antes de cada push                   |

El loop de desarrollo (PART 20 §20.7), en una línea: `db:start` → `db:reset` → `gen:types` → `dev` → `db:test` + `test` + `test:e2e` antes de push.
Migración nueva: `npx supabase migration new <nombre>` → escribís el SQL → `db:reset` → `gen:types` → tests. El dashboard nunca es el editor.

---

## Mapa del repositorio

```
ucanet/
├── app/                      Rutas y nada más: archivos finos que componen features
│   ├── (public)/             /, reciente, materias, carreras, facultades, recursos, p/, u/, buscar, legales
│   ├── (auth)/               ingresar, registro, registro/continuar, recuperar, invitacion/[code]
│   ├── (me)/                 avisos, ajustes
│   ├── (mod)/mod/            panel de moderación + /mod/metricas
│   ├── api/                  health/route.ts, cron/aggregates/route.ts
│   ├── auth/                 callback (GET), signout (POST)
│   ├── sitemap.ts robots.ts  Salidas de PART 23, como código
│   ├── layout.tsx            Layout raíz: tema, header, pie con el disclaimer (D8)
│   ├── globals.css           Entrada de Tailwind v4 + el bloque @theme (NO editar sin PART 18)
│   └── tokens.css            Los tokens de diseño (NO editar sin PART 18)
├── components/ui/            Primitivas compartidas sin ningún conocimiento de dominio
├── features/<dominio>/       auth · posts · feed · materias · recursos · search · notifications · mod · analytics
│   ├── components/           Componentes de la feature
│   ├── actions.ts            'use server' — mutaciones validadas con Zod
│   ├── queries.ts            Lecturas server-side por las vistas _public / RPC
│   └── schemas.ts            Schemas Zod que comparten acciones y formularios
├── lib/                      Infraestructura: supabase/, config.ts, env.ts, result.ts, errors.ts,
│                             analytics.ts, r2.ts, theme.ts, cn.ts, utils/, types.gen.ts
├── supabase/                 La capa de base de datos (directorio del CLI)
│   ├── migrations/           0001–0013. La única fuente de verdad del esquema (D14.1)
│   ├── seed/catalog/         Catálogo académico real (APPENDIX A). Va a todos los entornos
│   ├── seed.sql              Fixtures locales. NUNCA a producción
│   └── tests/                Suite pgTAP
├── e2e/                      Playwright: 6 flujos dorados × 2 viewports + axe
├── docs/                     BUILD-CONTRACT.md · plan/ · decisions.md · runbooks/
├── scripts/                  forbidden.sh, apply-catalog-seed.mjs
├── public/                   og-default, favicons, wordmark. Solo estáticos
├── .github/workflows/        ci.yml (PART 25 §25.7) + backup semanal
├── proxy.ts                  Reemplazo de middleware.ts en Next 16: sesión, cortina de IP, gate de /mod
├── CLAUDE.md                 El contrato de trabajo para sesiones asistidas por IA
└── .env.example              Cada variable nombrada y de dónde sale. Sin valores
```

**Límites de import** (los verifica ESLint, fallan CI):

| De ↓ puede importar → | app   | features           | components/ui | lib |
| --------------------- | ----- | ------------------ | ------------- | --- |
| `app/`                | —     | sí                 | sí            | sí  |
| `features/*`          | nunca | **solo la propia** | sí            | sí  |
| `components/ui/`      | nunca | nunca              | sí            | sí  |
| `lib/`                | nunca | nunca              | nunca         | sí  |

Lo que dos features necesitan se promueve a `lib/` o a `components/ui/`. **No existe `features/shared/`, nunca.**

---

## El plan, por tema

`docs/plan/` es la fuente normativa. Si el código y el plan discrepan, gana el plan hasta que se enmiende el plan.

| Buscás                                                               | Andá a                                                       | Partes      |
| -------------------------------------------------------------------- | ------------------------------------------------------------ | ----------- |
| Las decisiones que mandan sobre todo lo demás (D1–D14)               | `docs/plan/00-core-decisions.md`                             | PART 0      |
| Visión, principios, personas                                         | `docs/plan/01-vision-principles-personas.md`                 | PARTS 1–3   |
| Mapa de producto, corte del MVP, flujos, arquitectura de información | `docs/plan/02-product-map-mvp-flows-ia.md`                   | PARTS 4–7   |
| Esquema, RLS, RPC, vistas `_public`, orden de migraciones            | `docs/plan/03-database.md`                                   | PART 8      |
| Autenticación, anonimato, seguridad, respuesta a incidentes          | `docs/plan/04-identity-security.md`                          | PARTS 9–10  |
| Moderación, reportes, rate limits, anti-abuso                        | `docs/plan/05-moderation-antiabuse.md`                       | PART 11     |
| Feed, búsqueda, avisos                                               | `docs/plan/06-feed-search-notifications.md`                  | PARTS 12–13 |
| Recursos y archivos, marketplace (futuro), archivo                   | `docs/plan/07-resources-marketplace-archive.md`              | PARTS 14–16 |
| UX pantalla por pantalla, tokens, inventario de componentes          | `docs/plan/08-ui-ux-design-system.md`                        | PARTS 17–18 |
| Stack, Vercel + Supabase, free tier, performance                     | `docs/plan/09-stack-infra-freetier-performance.md`           | PARTS 19–22 |
| SEO, analytics, testing, workflow, estructura del repo               | `docs/plan/10-seo-analytics-testing-devflow-repo.md`         | PARTS 23–27 |
| Roadmap, lanzamiento, crecimiento, monetización                      | `docs/plan/11-roadmap-launch-growth-monetization.md`         | PARTS 28–31 |
| Visión a 10 años, riesgos, preguntas abiertas                        | `docs/plan/12-vision-risks-open-questions-recommendation.md` | PARTS 32–35 |
| Catálogo académico de UCA Rosario (la investigación)                 | `docs/plan/13-appendix-uca-academico.md`                     | APPENDIX A  |
| El brief original                                                    | `docs/plan/BRIEF.md`                                         | —           |

Además: **`docs/BUILD-CONTRACT.md`** fija las firmas exactas de cada módulo (es vinculante), `docs/decisions.md` es el log de decisiones y `docs/runbooks/` tiene los tres procedimientos operativos (restauración, incidentes, cuotas).

---

## Antes de tu primer PR

### Las diez reglas de D14 (no negociables)

1. Cambios de esquema solo por migraciones SQL commiteadas — nunca desde el dashboard.
2. RLS prendida en toda tabla; toda política con un test pgTAP que prueba el permitir **y** el negar.
3. La service-role key nunca en runtime de la app; secretos nunca en código de cliente; prefijo `NEXT_PUBLIC_` auditado.
4. Toda escritura validada del lado del servidor con Zod; el cliente no se cree, nunca.
5. Lecturas públicas solo por las vistas `_public`; los campos de autor de contenido anónimo no salen de la base.
6. Toda cadena visible en es-AR; nada de texto de UI en inglés hardcodeado.
7. IDs públicos (nanoid/slugs) en las URLs; los IDs de secuencia de la base no salen del servidor.
8. Ninguna dependencia nueva sin una línea en `docs/decisions.md` (qué, por qué, salida).
9. Los rate limits se aplican en la función de base de datos, no solo en el middleware.
10. Toda feature sale con su superficie de moderación (¿se puede reportar? ¿remover? ¿auditar?) o no sale.

### Definición de terminado (nueve casillas, van en la descripción del PR)

Anda deslogueado donde es público · mobile a 390 px verificado · navegable por teclado con foco visible · políticas RLS nuevas con test pgTAP allow+deny · con rate limit si escribe · reportable/removible/auditable si crea contenido · copy es-AR leído en voz alta una vez · evento de analytics si está en el catálogo de PART 24 §24.3 · `docs/decisions.md` actualizado si se tomó una decisión.

### Disciplina de rama y commit

`main` es producción y siempre desplegable. Trabajás en ramas cortas (`feat/…`, `fix/…`, `db/…`, `docs/…`) que viven días, no semanas, y mergeás por PR aunque no haya un segundo humano: el PR es donde corre CI y donde el preview de Vercel te da un entorno real para clickear en escritorio y en teléfono. Commits convencionales: `feat:`, `fix:`, `db:`, `test:`, `docs:`, `chore:`, `revert:`. Squash-merge con el título convencional.

### Los greps que fallan la revisión

`npm run forbidden` (y CI) buscan: `service_role` en código de app · `dangerouslySetInnerHTML` · variables `NEXT_PUBLIC_` nuevas · lecturas de tablas base en componentes cliente · `security definer` sin `set search_path` · DDL fuera de `supabase/migrations/` · `@ts-ignore` · `eslint-disable` · `TODO` sin referencia · cadenas en inglés en posición de texto JSX.

### Protocolo de migración (siempre, en este orden)

`supabase migration new` → escribís el SQL → `db:reset` local → pgTAP en verde → `gen:types` y commiteás el diff → PR con CI verde → aplicás a producción con `supabase db push` desde el commit tagueado. **Nunca edites una migración ya aplicada; escribí una nueva.** Toda migración es aditiva y compatible con la app desplegada (expand/contract en dos releases para cualquier cambio destructivo).

---

## Rituales operativos

| Cuándo                      | Qué                                                                                                | Dónde está escrito                       |
| --------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Viernes, 15 min             | Revisión de operaciones: cuotas, Sentry, cola de moderación, métricas, una línea en `decisions.md` | PART 24 §24.8, `docs/runbooks/cuotas.md` |
| Cuando se dispara un umbral | Playbook de gatillos de costo (D13)                                                                | `docs/runbooks/cuotas.md`                |
| Cada febrero                | Simulacro de restauración: un backup que nunca se restauró es un deseo                             | `docs/runbooks/restauracion.md`          |
| Cuando se rompe algo feo    | Fuga de datos, contenido ilegal, brigada de spam, caída de Supabase                                | `docs/runbooks/incidentes.md`            |

---

## Cuando tengas dudas

No inventes esquema, endpoints ni copy. Abrí `docs/BUILD-CONTRACT.md` para firmas, `docs/plan/` para decisiones, y si nada de eso lo resuelve, preguntá. Una suposición silenciosa en este repositorio termina siendo una columna que no existe o una cadena en inglés en producción.
