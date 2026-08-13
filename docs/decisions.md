# Log de decisiones — uca.net

ADR-lite (PART 26 §26.3). Un solo archivo, se agrega arriba, **nunca se edita hacia atrás**: una decisión revertida se registra como entrada nueva que cita la vieja. Cuatro líneas por entrada: título con fecha, **Decisión**, **Por qué**, **Salida** (cómo se deshace o se cambia de proveedor).

Qué se gana una entrada: toda dependencia nueva (D14.8) · toda elección que da forma al esquema y no estaba ya en el plan · todo desvío de una PART del plan, citando el número · toda excepción de emergencia al proceso (por ejemplo, un push directo a `main`) · todo gatillo de cuota o monetización que se dispara (D13) · el resultado de cada simulacro de restauración (`docs/runbooks/restauracion.md`) · toda flip de kill-switch en un incidente.

Este archivo es la memoria del próximo mantenedor. Escribí para alguien que llega en 2031 sin contexto.

Lo que está roto o a medias, con su causa verificada, vive en **[`docs/deuda-conocida.md`](./deuda-conocida.md)**. Acá van las decisiones tomadas; allá lo que sigue abierto.

---

## 2026-08-13 — `is_own_content`: la autoría se pregunta a la base, no se deduce del seudónimo

**Decisión:** se agrega `public.is_own_content(p_kind text, p_public_id text) returns boolean` en la migración `20260901000014_rpc_gaps.sql` (STABLE, SECURITY DEFINER, otorgada solo a `authenticated`), y `app/(public)/p/[publicId]/[[...slug]]/page.tsx` calcula `isAuthor` con ella —vía `isOwnPost()` en `features/posts/queries.ts`— en vez de comparar `post.authorHandle === viewerHandle`.

**Por qué:** para contenido anónimo `author_handle` es null por construcción (las vistas `_public` de 0010 lo anulan cuando `is_anonymous`), así que la comparación por handle daba `false` **para el propio autor**: quien publicaba en anónimo no podía editar ni **borrar** lo suyo, y encima se le ofrecía el botón de votar, que `toggle_post_vote` rechaza con `SELF_VOTE`. El derecho de supresión que C6 (Ley 25.326) trata como vinculante no puede depender de que el autor haya firmado. La función es SECURITY DEFINER justamente porque las tablas base no otorgan SELECT a nadie: es la única manera de mirar `author_id` sin exponerlo. Devuelve **solo un booleano**, nunca el autor —devolver el uid, aunque fuera únicamente al coincidir, la volvería la fuga que las vistas `_public` existen para evitar—, y responde `false` igual ante un id ajeno que ante uno inexistente, así que tampoco sirve para enumerar. Develar un autor de verdad sigue siendo exclusivo de `mod_reveal_author` (0012), que deja registro.

**Límite conocido que queda abierto:** el árbol de comentarios de esa página sigue resolviendo la autoría por handle. Preguntar de a uno sería una consulta por fila sobre una página de hasta 25 comentarios con sus respuestas, y hoy no hay RPC por lote. Consecuencia: un comentario anónimo propio no muestra sus acciones de autor. La salida es una migración que agregue `own_content_ids(p_kind text, p_public_ids text[]) returns text[]` y una lectura `getOwnCommentIds()` que la página consulte una sola vez.

**Salida:** es aditiva. Si algún día las vistas `_public` incorporaran un flag `is_own` calculado contra `auth.uid()`, esta función y su llamada desaparecen sin migración de datos.

## 2026-08-13 — `update_notification_prefs`: el único interruptor de /ajustes no tenía cómo escribirse

**Decisión:** se agrega `public.update_notification_prefs(p_notif_respuestas boolean) returns void` en `20260901000014_rpc_gaps.sql` y `updateNotificationPrefs` (`features/auth/actions.ts`) pasa a llamarla en vez de hacer `.from('profiles').update({ notif_respuestas })`.

**Por qué:** `profiles` tiene exactamente una política (`profiles_select_self`) y exactamente un grant (`select`) desde la migración 0004; el rol `authenticated` no puede escribir la tabla y ninguna RPC de 0011–0013 tocaba esa columna. El UPDATE directo, entonces, fallaba **siempre**, y el único control de notificaciones de v1 (§0.5-R14) mostraba el error genérico cada vez que alguien lo usaba. Que la escritura sea una función y no un grant es además la regla general del esquema (tenet 6: _writes are functions, not table grants_): abrir UPDATE sobre `profiles` para un booleano habría dejado alcanzables desde el cliente `role`, `status` y `karma`, que es exactamente lo que esa regla evita.

**Por qué no exige `status = 'activo'`:** no llama a `assert_can_write()`, por el mismo motivo que `delete_account`. Silenciar los propios avisos no es publicar; negárselo a una cuenta suspendida sería un castigo que ninguna regla de PART 11 §11.8 establece. El único guard es que haya sesión (`NOT_AUTHENTICATED`), más `INVALID_INPUT` si llega null, porque la columna es NOT NULL y sin ese chequeo un error crudo de Postgres llegaría a la pantalla.

**Salida:** si las preferencias crecen más allá de ese booleano (§0.5-R14 dice que v1 es uno solo), la función se reemplaza por una que reciba el conjunto completo en una migración forward; la firma actual queda deprecada, no editada.

## 2026-08-13 — Los límites de import pasaban en verde sin revisar nada

**Decisión:** en `settings['boundaries/elements']`, los patrones son de **carpeta** (`'app'`, `'features/*'`, `'components/ui'`, `'lib'`), no de archivo (`'app/**/*'`), y la regla es `boundaries/dependencies` con `policies` (la sintaxis de eslint-plugin-boundaries v7), no la vieja `boundaries/element-types` con `rules`.

**Por qué:** la primera versión de la config usaba patrones de archivo y la sintaxis v5. `npx eslint` salía **verde**, y era mentira: con patrones de archivo, el plugin v7 no clasificaba **ningún** archivo del proyecto, así que la regla no evaluaba un solo import. Se descubrió metiendo violaciones deliberadas (`features/posts` importando `features/auth`, y `lib` importando `features`) y viendo que ESLint no decía nada; se confirmó con `boundaries/no-unknown-files`, que marcó como "no pertenece a ningún elemento conocido" a archivos que claramente pertenecían.

**Por qué importa más de lo que parece:** PART 27 §27.4 llama a estos límites "reglas como configuración, no como convención", y §27.4 los describe como las dos prohibiciones que sostienen la arquitectura (una feature nunca importa otra; `lib` no sabe qué app sirve). Un gate de calidad que pasa sin ejecutarse es peor que no tenerlo, porque produce confianza sin evidencia — y este en particular es el único que impide que las features se enreden entre sí con el tiempo.

**Cómo verificar que sigue vivo (hacelo si tocás esta config):** creá un archivo temporal en `features/posts/` que importe `@/features/auth/queries` y confirmá que `npx eslint` lo marca con `boundaries/dependencies`. Si pasa en verde, la regla se volvió a apagar. Con la config actual, el código real da cero violaciones — esta vez de verdad.

## 2026-08-13 — DEUDA ABIERTA: el ISR de PART 20 §20.2 no se cumple; todas las rutas rendean dinámicas [FREE-TIER RISK]

**Estado:** deuda conocida, sin resolver. **Requiere decisión del fundador antes del lanzamiento público.**

**Qué pasa:** el primer `next build` del proyecto reporta las 39 rutas como `ƒ (Dynamic)`. La tabla de PART 20 §20.2 pide ISR para `/` deslogueado (60 s), `/reciente` (60 s), `/materias` (3600 s), `/materias/[slug]` (300 s), `/carreras` y `/facultades` (3600 s) y `/recursos` (300 s). Las páginas declaran su `export const revalidate` correcto, pero no tiene efecto.

**Por qué:** `app/layout.tsx` renderiza `SiteHeader`, que llama `getProfile()` para mostrar el seudónimo y el badge de avisos (los slots 4 y 5 del header de §17.1.1). Leer la sesión es leer cookies, y en el App Router **leer cookies en el layout raíz vuelve dinámica toda ruta que lo use**. No es un bug de una página: es la consecuencia de que el chrome sea consciente de la sesión y se renderice en el servidor.

**Por qué importa:** §20.2 cierra con un chequeo de presupuesto explícito — "cualquier cambio que vuelva dinámicas las páginas de listado públicas para anónimos multiplica las invocaciones ~5×" — y §21.2 modela quedarse por debajo del 15% del millón de invocaciones de Vercel Hobby **apoyándose en que el CDN absorbe el tráfico anónimo y de crawlers**. Con todo dinámico, cada visita de un crawler ejecuta una función. No rompe nada hoy con decenas de usuarios; sí mueve el gatillo de Vercel Pro de D13 hacia adelante en el tiempo, y ese es justamente el tipo de cosa que el plan quiere decidida con anticipación y no bajo presión.

**Las tres salidas, en orden de cuánto cuestan:**

1. **PPR (Partial Prerendering).** Envolver los slots del header que dependen de sesión en `<Suspense>` y habilitar PPR: Next prerenderiza la cáscara estática y streamea lo dinámico. Es exactamente el problema que PPR resuelve y no toca ni el diseño ni la regla de cero JS de cliente de PART 22. Costo: es una bandera experimental, y D14.8 pide decisión explícita antes de apoyar un producto de diez años en una API experimental. **Recomendada, pero es [HUMAN DECISION].**
2. **Chrome partido por grupo de rutas.** Que las rutas públicas de contenido usen un layout con header anónimo y que el estado de sesión llegue por un componente de cliente. Costo: rompe la regla de PART 22 de cero JS de ruta en páginas de contenido, que es la decisión de rendimiento más apalancada del plan. **No recomendada.**
3. **Aceptarlo y medirlo.** Dejar todo dinámico, instrumentar las invocaciones desde el primer día y disparar el gatillo de Vercel Pro (USD 20) cuando toque. Costo: adelanta el primer dólar pago sin ganar nada a cambio. **Es el default si nadie decide.**

**Cómo verificar que se arregló:** `npx next build` y mirar la columna de la tabla de rutas: `/materias`, `/materias/[slug]`, `/carreras/[slug]`, `/facultades/[slug]`, `/recursos` y `/reciente` tienen que aparecer con revalidate y no como `ƒ`.

## 2026-08-13 — Las páginas legales no son `force-static`

**Decisión:** `/acerca`, `/reglas`, `/terminos` y `/privacidad` llevan `export const revalidate = 86_400`, no `export const dynamic = 'force-static'`.
**Por qué:** `force-static` congela el HTML entero, header incluido. Como el header muestra el seudónimo y el contador de avisos de quien está logueado, una persona con sesión habría recibido el chrome del visitante anónimo — y en `/privacidad`, que es donde le explicamos qué guardamos de ella, parecer deslogueado es exactamente el lugar donde peor se ve. Además, con la configuración actual `force-static` hace fallar el build entero al prerenderizar (la fábrica de clientes de Supabase corre en una fase donde no hay sesión ni credenciales).
**Salida:** si algún día el chrome deja de depender de la sesión (ver la entrada de PPR de arriba), estas cuatro páginas pueden volver a ser estáticas puras, que es lo que pide §20.2.

## 2026-08-13 — Seis RPC que el plan da por existentes y PART 8 §8.5 no enumeró

**Decisión:** se agregan a `20260901000011_rpc_core.sql`: `track_event`, `touch_last_seen`, `check_invite`, `join_waitlist`, `materia_follower_count`, y a `20260901000013_scheduled_jobs.sql`: `compute_activity_rollups`.
**Por qué:** una revisión adversarial del set de migraciones encontró que tres tablas quedaban **sin ningún camino de escritura**: `events` (PART 8 §8.3.7 dice "se incrementa vía `track_event`"), `waitlist` (§0.5-R22 dice "se escribe desde la función SECURITY DEFINER que llama el formulario público") y la validación previa del código de invitación que §0.5-R18 anuncia explícitamente. PART 8 las describe en prosa al definir las tablas pero nunca las listó en su inventario de funciones de §8.5, así que ningún agente las escribió. `materia_follower_count` resuelve una contradicción interna de PART 8 §8.3.4, que pide a la vez que `materia_follows` solo exponga las filas propias y que la página de materia muestre "128 seguidores" con un `count(*)` barato: con esa política el conteo da 0 o 1. `compute_activity_rollups` implementa el WAU/MAU/cohortes que PART 24 §24.4 asigna al cron nocturno.
**Salida:** ninguna. Son funciones aditivas; si el plan se corrige y decide otra forma para alguna, se reemplaza con una migración forward. El catálogo de eventos de `track_event` es una allowlist cerrada dentro de la función: agregar un evento es migración nueva más entrada acá (D14.8).

## 2026-08-13 — `profiles.last_seen_day`: una columna que PART 8 no tiene y PART 24 exige

**Decisión:** `profiles` gana `last_seen_day date null`, que PART 8 §8.3.2 no declara.
**Por qué:** PART 24 §24.4 especifica textualmente "a single `last_seen_day` date column on profiles" como el mecanismo entero de DAU/WAU/MAU, y de ahí salen las cohortes de retorno semanal que miden el **portón de D11** ("≥40% de la beta vuelve en la semana 2"). Sin la columna, el evento `dau` del catálogo de §24.3 no es implementable y el portón que decide si se abre el registro no se puede medir. Es un hueco entre partes del plan, no una decisión de producto: PART 8 no absorbió el requisito de PART 24.
**Salida:** es una columna nullable sin FK; sacarla es un `alter table drop column` más borrar `touch_last_seen` y `compute_activity_rollups`. Su semántica de privacidad —se pisa en el lugar, el valor de ayer se destruye, no hay historial— está declarada en la Política de Privacidad y en el `COMMENT ON COLUMN`, y romper esa promesa exigiría una decisión nueva acá.

## 2026-08-13 — Nombres canónicos de los kill-switches y quién los lee

**Decisión:** las cuatro claves de `app_settings` son `registro_abierto`, `publicaciones_pausadas`, `subidas_pausadas` y `sitio_solo_lectura`, todas en castellano. Lectores: `handle_new_user` lee la primera; `create_post` y `create_comment` la segunda; `request_upload` y `finalize_upload` la tercera; `create_report` y `create_appeal` la cuarta. Las RPC de moderación no leen ninguna.
**Por qué:** convivían dos juegos de nombres —uno en castellano sembrado en 0009, otro en inglés (`read_only`, `signups_paused`, `uploads_paused`) documentado en 0001 y consultado en 0012— y el resultado era que **los interruptores no hacían nada**: 0012 consultaba una clave que nadie sembraba, y `publicaciones_pausadas` no tenía ningún lector pese a que su comentario decía lo contrario. Un kill-switch que no corta es peor que no tenerlo, porque en un incidente se lo prende y se cree que funcionó. Que las RPC de moderación ignoren `sitio_solo_lectura` es deliberado: el modo lectura se prende justamente durante un incidente, que es cuando moderación más tiene que poder actuar (PART 10 §10.14).
**Salida:** agregar un interruptor es sembrar la clave en una migración y agregar su lectura en las RPC que corresponda; cada flip en un incidente se registra acá.

## 2026-08-13 — `lib/analytics.ts` vive en `lib`, no en `features/analytics`

**Decisión:** el wrapper de eventos (`trackEvent`, el union cerrado `EventName`) se implementa en `lib/analytics.ts` con `import 'server-only'`; `features/analytics/` queda solo con la lectura de `/mod/metricas`.
**Por qué:** los límites de import de PART 27 §27.4 prohíben que una feature importe otra, y `trackEvent` lo llaman posts, recursos, búsqueda, auth y moderación. En `features/analytics` habría que romper la regla o duplicar el módulo cinco veces; la regla de promoción del plan ("usado por 2+ features → se promueve a `lib`") lo decide sin debate.
**Salida:** ninguna migración de código pendiente. Si el catálogo de eventos crece hasta necesitar su propia superficie de escritura, se parte `lib/analytics.ts` en varios módulos dentro de `lib/`, no en una feature.

## 2026-08-13 — `lib/types.gen.ts` escrito a mano, regenerado por CI

**Decisión:** `lib/types.gen.ts` se autora a mano contra `supabase/migrations/*.sql`, con la forma exacta que emite `supabase gen types typescript` para poder reemplazarlo 1:1.
**Por qué:** el entorno donde se construyó este repositorio no tiene Docker, así que no existe stack local contra el cual generar los tipos; sin ese archivo no compila nada y el build entero queda bloqueado. La alternativa —tipar con `any` hasta tener base— habría contaminado cada `queries.ts` con casts que después nadie saca.
**Salida:** `npm run gen:types` lo sobreescribe en la primera máquina con Docker; el job `db` de CI lo regenera y falla ante cualquier drift (`git diff --exit-code`). Hasta esa primera corrida, el archivo es sospechoso por definición: cada diferencia que aparezca es un error de la mano o una migración que no dice lo que creíamos.

## 2026-08-13 — `resource_votes` se crea en la migración 0007, no en la 0006

**Decisión:** `resource_votes` se declara en `20260901000007_resources.sql`, junto a `resources`. En `20260901000006_votes_and_follows.sql` quedan `post_votes`, `comment_votes` y `materia_follows`.
**Por qué:** su clave foránea apunta a `resources`, que nace recién en 0007. Declararla antes rompe el replay desde cero (`supabase db reset`), que es justamente la propiedad que hace portable el esquema a diez años. `docs/BUILD-CONTRACT.md` §5 la listaba en 0006: es un error de la tabla del contrato, no del orden de las migraciones, y hay que corregir el contrato.
**Salida:** ninguna; es orden de dependencias, no diseño. El conjunto ordinal de PART 8 §8.10.1 se mantiene sin cambios.

## 2026-08-13 — La migración 0011 se parte en dos archivos

**Decisión:** las RPC se reparten en `20260901000011_rpc_core.sql` (identidad, contenido, votos, búsqueda) y `20260901000012_rpc_moderation.sql` (reportes, apelaciones, moderación, invitaciones); los trabajos programados pasan a `20260901000013_scheduled_jobs.sql`.
**Por qué:** revisabilidad. Las funciones de la 0011 conceptual pasan las 2.500 líneas en un solo archivo, y el diff de un PR de ese tamaño es exactamente donde se cuela un `security definer` sin `set search_path` o un `grant` de más. Dos archivos temáticos se leen; uno solo se aprueba sin leer.
**Salida:** ninguna. El conjunto ordinal de PART 8 §8.10.1 no cambia (0011 sigue siendo "las RPC"); el orden lexicográfico de los nombres preserva las dependencias y las migraciones siguen siendo forward-only.

## 2026-08-13 — `proxy.ts` en lugar de `middleware.ts` (Next 16)

**Decisión:** el archivo raíz de middleware se llama `proxy.ts` y exporta `export default async function proxy(request: NextRequest)` más `export const config = { matcher: [...] }`.
**Por qué:** Next 16.3 deprecó `middleware.ts`. Un archivo con el nombre viejo no se levanta y las tres funciones del middleware —refresh de sesión de `@supabase/ssr`, cortina de IP, redirección barata de `/mod`— quedarían sin ejecutar. Es una falla silenciosa, no un error de build: la app parece andar y las sesiones dejan de renovarse. PART 20 §20.5 habla de "middleware" como concepto; el nombre del archivo pertenece a la versión.
**Salida:** si una versión futura revierte el nombre, es renombrar un archivo: la lógica vive en `lib/supabase/middleware.ts` y `lib/ip-curtain.ts`, ambos agnósticos del framework.

## 2026-08-13 — Las 14 dependencias de producción quedan cerradas

**Decisión:** el `package.json` de producción es exactamente el de PART 19 §19.12: `next`, `react`, `react-dom`, `@supabase/supabase-js`, `@supabase/ssr`, `zod`, `nanoid`, `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `lucide-react`, `@sentry/nextjs`, `server-only`, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`. Techo declarado: 20.
**Por qué:** el presupuesto de dependencias es una decisión de seguridad, no de gusto — cada paquete es un autor en quien confiamos con las identidades de los usuarios (PART 10 §10.13), y los asistentes de IA resuelven todo problema agregando un paquete. Las ausencias son deliberadas: sin librería de fechas (`Intl.RelativeTimeFormat` alcanza), sin slugify (el nuestro tiene que coincidir con la función SQL), sin parser de markdown (los cuerpos son texto plano y el escape de React es el sanitizador), sin manejo de estado, sin librería de componentes (la identidad visual es el producto).
**Salida:** cada alta futura exige una entrada nueva acá con qué, por qué y salida (D14.8), y se re-tipea a mano desde el README oficial del paquete, nunca copiada de la salida de un modelo (el squatting de nombres alucinados es un ataque documentado). Dar de baja una es borrar su módulo en `lib/`.
