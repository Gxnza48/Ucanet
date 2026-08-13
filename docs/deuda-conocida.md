# Deuda conocida — uca.net

> Defectos y desajustes **encontrados y verificados** durante la construcción inicial (2026-08-13),
> que quedaron sin arreglar a propósito porque el arreglo exige una decisión, una migración, o un
> rediseño que no corresponde tomar sin el fundador. Ninguno es una sospecha: cada uno se confirmó
> leyendo el código y el esquema.
>
> Esto NO reemplaza a `docs/decisions.md`: allá van las decisiones tomadas, acá lo que sigue abierto.
> Cuando uno de estos se resuelva, se borra de acá y se registra allá.
>
> **Contexto que hay que tener presente al leerlo:** este repositorio nunca corrió contra una base
> de datos. No hubo Docker en el entorno donde se construyó, así que las 14 migraciones, el seed del
> catálogo y la suite pgTAP están escritos a spec y verificados con el parser real de PostgreSQL
> (sentencias y cuerpos plpgsql), pero **jamás se ejecutaron**. El primer `supabase db reset` es el
> que los valida de verdad, y es razonable esperar que aparezcan errores ahí.

---

## Bloqueantes antes del lanzamiento público

### D1 · El ISR de PART 20 §20.2 no se cumple: las 39 rutas rendean dinámicas [FREE-TIER RISK]

Registrado en detalle en `docs/decisions.md`. Causa raíz: el header lee la sesión en el layout raíz,
y leer cookies en el layout vuelve dinámica toda ruta. Consecuencia presupuestaria: el modelo de
§21.2 asume que el CDN absorbe el tráfico anónimo y de crawlers; hoy cada visita de bot ejecuta una
función. Tres salidas evaluadas en el log; la recomendada (PPR) es **[HUMAN DECISION]** porque apoya
un producto de diez años en una API experimental.

### D2 · El vocabulario de cache tags está escrito pero nunca registrado

Hay 12 llamadas a `updateTag('post:…')` / `updateTag('materia:…')` / `updateTag('recurso:…')` en
`features/posts/actions.ts`, `features/recursos/actions.ts`, `features/materias/actions.ts` y
`features/mod/actions.ts`. No existe ni una sola llamada a `cacheTag()` ni una directiva `'use cache'`
en todo el repositorio, así que **ninguna entrada de caché lleva esas etiquetas y las invalidaciones
no invalidan nada**.

Hoy queda enmascarado por D1: como todo rendea dinámico, no hay caché que refrescar. Es una trampa
latente: el día que alguien envuelva una query en `'use cache'` sin agregar `cacheTag`, la
invalidación seguirá sin ocurrir y no habrá ninguna señal. Se arregla junto con D1, no antes.

Consecuencia hoy visible: `features/posts/actions.ts` no llama `revalidatePath` ni una vez, así que
una publicación borrada por su autor sigue apareciendo en `/reciente` y en la página de su materia
hasta que expire el tiempo (60 s / 300 s).

### D3 · `/apelacion?accion=<id>` expone un id de secuencia en una URL pública — viola D14.7

`features/notifications/queries.ts` arma el link como `/apelacion?accion=` + `mod_action_id`, que es
un `bigint identity`. `mod_actions` **no tiene columna `public_id`** (verificado en la migración
0008), y el mapa de URLs de D7 lista `/apelacion` sin parámetro.

Impacto acotado: `create_appeal` verifica que quien llama sea el destinatario de la acción, así que
enumerar ids solo da un oráculo de "existe / es mía", nunca datos ajenos. Pero es la violación de
D14.7 más clara que queda y la única en una ruta pública.

Arreglo: migración que agregue `public_id text not null unique default public.nanoid()` a
`mod_actions`, más cambiar las tres referencias en TypeScript.

---

## Funcionalidad parcial o inconsistente

### D4 · La moderación pierde el "Ver autor" auditado sobre comentarios ya removidos

`comments_public` define `is_anonymous` como `(status = 'activo' and c.is_anonymous)` y anula
`author_handle` cuando el comentario no está activo. Entonces, para un comentario **removido** —sea
anónimo o firmado— el panel recibe `isAnonymous: false, authorHandle: null`. Dos efectos en
`app/(mod)/mod/reportes/[id]/page.tsx`:

- El bloque "Historial de la cuenta" afirma que el objetivo es anónimo incluso cuando estaba firmado
  (copy falsa).
- El botón "Ver autor" solo se renderiza si `isAnonymous`, así que sobre un comentario removido
  **no queda ningún camino a la revelación auditada** de §11.4.2 — justo después de la acción que la
  hace necesaria.

Falla hacia el lado seguro (menos revelación). Arreglarlo exige decidir si `comments_public` debe
exponer el `is_anonymous` crudo o si el panel necesita otra lectura definer.

### D5 · Nueve de los catorce eventos de PART 24 §24.3 no se emiten desde ningún lado

Faltan llamadas para `registro_completado`, `invitacion_usada`, `post_creado`, `post_anonimo`,
`comentario_creado`, `voto_emitido`, `recurso_subido`, `cuenta_eliminada` y `dau`. La función
`track_event` existe y valida; el catálogo está completo del lado de la base. Lo que falta son las
llamadas en las Server Actions correspondientes.

Consecuencia directa: **el portón de D11 no se puede medir todavía** ("≥40% de la beta vuelve en la
semana 2" sale de `dau` vía `touch_last_seen`, que tampoco se llama desde ningún request). Hay que
cerrarlo antes de la beta cerrada, no antes del primer deploy.

### D6 · `getQuotaUsage` subestima la cuota del usuario

`features/recursos/queries.ts` suma bytes filtrando por `author_handle`, así que **no cuenta los
recursos que el usuario subió como anónimo** (no hay handle contra el cual comparar). La UI muestra
un número menor al real.

No es un agujero de seguridad: `request_upload` y `finalize_upload` calculan la cuota contra
`author_id` dentro de la base y levantan `QUOTA_EXCEEDED` con el número verdadero. Es una
consecuencia esperada del anonimato, y el arreglo sería una función definer que devuelva solo el
total de bytes.

### D7 · El onboarding manda el `carreras.id` al navegador

`features/auth/components/onboarding-form.tsx` usa `<option value={carrera.id}>`, y ese bigint viaja
al HTML y vuelve en el `FormData`. No es un descuido: `complete_onboarding(p_carrera_id bigint)`
recibe el id, así que sacarlo exige o cambiar la firma de la RPC a slug, o resolver slug→id dentro de
la Server Action. Es una contradicción del contrato consigo mismo (dos archivos al lado usan el slug).

---

## Huecos de proceso

### D8 · `scripts/forbidden.sh` no detecta `.rpc()` fuera de las capas permitidas

La regla 2 busca `.from(` pero no `.rpc(`. Por eso no marca
`app/(public)/recursos/[publicId]/descargar/route.ts`, que llama `register_download` directo desde un
route handler. Ese caso está declarado y justificado en el encabezado del propio archivo (la descarga
tiene que ser un `<a>` que funcione sin JS), pero la regla debería marcarlo y el archivo debería
llevar una excepción explícita, en vez de pasar por un agujero del grep.

### D9 · Los tests nunca corrieron

Las 63 pruebas de Vitest sí corren y pasan (son lógica pura). La suite pgTAP y los 6 flujos de
Playwright están escritos pero **nunca se ejecutaron**: pgTAP necesita `supabase start` y Playwright
necesita el stack local sembrado. Hasta esa primera corrida, la afirmación "las políticas RLS están
probadas" es una intención, no un hecho. Es lo primero que hay que hacer en una máquina con Docker,
antes que cualquier feature nueva.
