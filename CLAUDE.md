# CLAUDE.md — uca.net working rules

The contract every AI-assisted session loads before writing a line. Bilingual on purpose: rules in English, user-facing copy in es-AR because that is what ships.

## What this is

Pseudonymous student community for UCA Rosario. Code name `ucanet`; the public name is a config constant (`SITE_NAME` in `lib/config.ts`) — **never hardcode it anywhere else**. One developer, AI-assisted, free tiers (Vercel Hobby + Supabase Free + Cloudflare R2).

Sources of truth, in this order:

1. **`docs/BUILD-CONTRACT.md`** — exact module boundaries and signatures. When it pins a name, the name is binding. **This is the file to open before writing any module.**
2. **`docs/plan/00-core-decisions.md`** — the spine (D1–D14). If code and plan disagree, the plan wins until the plan is amended.
3. `docs/plan/` PARTS 1–35 — the reasoning behind every decision. Cite the PART, don't re-litigate it.
4. `docs/decisions.md` — what this build already decided and why.

## Stack — do not substitute

| Package                                                                      | Version          | Consequence                                                              |
| ---------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------ |
| `next`                                                                       | 16.3.0           | App Router, Server Components by default                                 |
| `react` / `react-dom`                                                        | 19.2.8           | `'use client'` only where this file allows it                            |
| `typescript`                                                                 | 5.x              | `strict` + `noUncheckedIndexedAccess`                                    |
| `tailwindcss`                                                                | 4.3.3            | CSS-first; the only theme config is `@theme inline` in `app/globals.css` |
| `zod`                                                                        | 4.4.3            | Zod **4** API, not 3                                                     |
| `@supabase/ssr` / `@supabase/supabase-js`                                    | 0.12.4 / 2.112.3 | `getAll`/`setAll` cookie adapter                                         |
| `@aws-sdk/client-s3` + `s3-request-presigner`                                | 3.1109.0         | R2 presigning, server-only                                               |
| `lucide-react` / `nanoid` / `server-only` / `@radix-ui/*` / `@sentry/nextjs` | pinned           | —                                                                        |

Fourteen production dependencies. **No new dependency, ever, without a `docs/decisions.md` entry stating what, why, and the exit path (D14.8).** If the answer to a problem is "install a package", the answer is wrong until that entry exists. Deliberate absences: no date library (`Intl.RelativeTimeFormat`), no slugify (`lib/utils/slug.ts` must match the SQL rule), no markdown parser (bodies are plain text; React's escaping is the sanitizer), no state management, no component library.

## Non-negotiable rules (spine D14 — verbatim, binding)

1. Schema changes only via committed SQL migrations — never the dashboard.
2. RLS on for every table; every policy has a pgTAP test proving both the allow and the deny.
3. Service-role key never in app runtime; secrets never in client code; `NEXT_PUBLIC_` prefix audited.
4. All writes validated server-side with Zod; the client is untrusted, always.
5. Public reads only through the `_public` views; author fields of anonymous content never leave the database.
6. Every user-visible string in es-AR; no hardcoded English UI text.
7. Public IDs (nanoid/slugs) in URLs; DB sequence IDs never leave the server.
8. No new dependency without a line in `docs/decisions.md` (what, why, exit path).
9. Rate limits enforced in the database function, not only in middleware.
10. Every feature ships with its moderation surface (can it be reported? removed? audited?) or it does not ship.

## Traps specific to THIS version of the stack

These are the mistakes a model trained on older docs makes by default. Every one of them is a build error or a silent bug here.

**Next 16 — the root middleware file is `proxy.ts`, not `middleware.ts`.**

```ts
// proxy.ts (repo root)
export default async function proxy(request: NextRequest) {
  /* … */
}
export const config = { matcher: [/* … */] }
```

`middleware.ts` is deprecated in Next 16 and will not be picked up. Its three duties, and nothing else: session refresh via `@supabase/ssr`, the coarse IP curtain (`lib/ip-curtain.ts`), and the cheap `/mod` redirect. Real authorization lives in RLS.

**Next 16 — `params` and `searchParams` are Promises. So are `cookies()`, `headers()`, `draftMode()`.**

```tsx
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { slug } = await params
  const sp = await searchParams
}
```

Same Promise-shaped props in `generateMetadata`. Route handlers: `export async function GET(request: Request, { params }: { params: Promise<{ id: string }> })`. Writing `params.slug` directly compiles in your head and fails in the build.

**Zod 4 — top-level formats, and errors read through `.issues`.**

```ts
z.email() // correct   — NOT z.string().email()
z.url() // correct   — NOT z.string().url()
z.uuid() // correct
const parsed = schema.safeParse(input)
if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? GENERIC_ERROR)
//                                             ^ never .flatten(), never .format()
```

`z.string().min(3, 'copy es-AR')` still works and is how every message gets written in Spanish.

**TypeScript `noUncheckedIndexedAccess` — indexed access returns `T | undefined`.** `items[0]` is possibly undefined; `parsed.error.issues[0]?.message ?? GENERIC_ERROR` is the pattern, not `issues[0].message`. Do not silence it with `!`.

**Tailwind v4 — token-derived utilities only.** There is no `tailwind.config.*`; the theme is the `@theme inline` block in `app/globals.css`, fed by `app/tokens.css`. **Do not edit either file.** Allowed: `bg-bg`, `bg-surface-raised`, `text-text-primary`, `text-text-secondary`, `text-accent`, `border-border`, `rounded-input`, `rounded-container`, `text-s`, `text-m`, `text-base`, `text-l`, `text-xl`, `text-2xl`, `font-serif`, `shadow-overlay`, and spacing utilities on the 4px base (`p-3`, `gap-4`, `py-6`). **Forbidden: arbitrary values** (`text-[17px]`, `bg-[#fff]`, `w-[43%]`) and any color that isn't a token. Radii ≤ 4px, 1px hairline borders, no shadows except `shadow-overlay` on menus/dialogs/toasts.

**`@supabase/ssr` 0.12 — cookie adapter is `getAll`/`setAll`.** The old `get`/`set`/`remove` triple is removed; code written against it throws at runtime.

**`nanoid` 6 is ESM** — use `customAlphabet` inside `lib/utils/public-id.ts` (alphabet `23456789abcdefghjkmnpqrstuvwxyz`, matching `public.nanoid()` in SQL). **`lucide-react`**: per-icon named imports only, never the barrel.

**Supabase reads**: never `select('*')` from a base content table. Public content comes from the `_public` views. `supabase.from()` appears only in `features/*/queries.ts`, `features/*/actions.ts` and `lib/supabase/*`.

## Where things live

```
app/                  routes only (thin); (public) (auth) (me) (mod) route groups
features/<domain>/    components/ + actions.ts + queries.ts + schemas.ts
components/ui/        shared primitives, zero feature knowledge
lib/                  supabase clients, config, env, result, errors, analytics, r2, utils, types.gen.ts
supabase/             migrations/ seed/ seed.sql tests/ — the db layer
docs/                 BUILD-CONTRACT.md · plan/ · decisions.md · runbooks/
e2e/                  Playwright + axe
proxy.ts              root, Next 16 middleware replacement
```

**Import boundaries (ESLint-enforced, CI-failing):**

| From ↓ may import → | app   | features             | components/ui | lib |
| ------------------- | ----- | -------------------- | ------------- | --- |
| `app/`              | —     | yes                  | yes           | yes |
| `features/*`        | never | **own feature only** | yes           | yes |
| `components/ui/`    | never | never                | yes           | yes |
| `lib/`              | never | never                | never         | yes |

A feature never imports another feature — not its components, not its queries, not its types. Cross-feature needs get **promoted to `lib/`** (logic) or `components/ui/` (visual). There is no `features/shared/`, ever. That is why `lib/analytics.ts` lives in `lib` and not in `features/analytics` — every feature calls `trackEvent`.

Every `queries.ts` starts with `import 'server-only'`; every `actions.ts` starts with `'use server'` and then `import 'server-only'`.

**`'use client'` allowlist (PART 19 §19.3 — complete, nothing else):** composer, vote button, dropdown menu, dialog, search typeahead, theme toggle, file-upload field, plus the primitives the contract marks (`submit-button.tsx`, `dialog.tsx`, `menu.tsx`, `toast.tsx`). Content pages ship zero route-level client JS beyond the shared shell.

## Server Actions — the mandatory five steps, in order

1. `const parsed = schema.safeParse(...)` → on failure `return fail(parsed.error.issues[0]?.message ?? GENERIC_ERROR)`
2. read the session server-side (`getUser()` / `requireProfile()`); never trust the client
3. call **exactly one** RPC or policy-guarded write through the typed client
4. `revalidateTag(...)` / `revalidatePath(...)` **after** the write commits
5. `return ok(...)` or `return fail(rpcErrorMessage(error))`

Actions never contain SQL strings. Cache tags, binding vocabulary: `materia:<slug>`, `post:<publicId>`, `recurso:<publicId>`, `carrera:<slug>`, `catalog`. Forms used with `useActionState` have the signature `(prevState: ActionResult | null, formData: FormData) => Promise<ActionResult>`.

Errors surface through `rpcErrorMessage()` from `lib/errors.ts`; SQL raises only codes from `RPC_ERROR_CODES`. Do not invent an error string in a component.

## UI copy — es-AR con voseo (regla D14.6)

Toda cadena que ve un usuario va en castellano rioplatense con voseo, **incluidos placeholders, `aria-label`, textos de error, mensajes vacíos y `alt`**. Imperativos: "Publicá", "Ingresá", "Comentá", "Seguí", "Reportá", "Guardá", "Subí", "Enviá". Nada de "Publica", "Ingresa" ni "Post", "Upload", "Submit".

Voz sobria: sin signos de exclamación entusiastas, sin emoji en la interfaz, sin humor de producto. Un error dice qué pasó y qué hacer: "Estás publicando muy seguido. Probá de nuevo en un rato."

Vocabulario: se usa la palabra del estudiante — materia, parcial, final, resumen, apunte, cátedra, comisión, cursada, carrera, facultad, sede. En el esquema conviven sustantivos de dominio en castellano (`materias`, `carreras`) con mecánica en inglés (`posts`, `comments`, `reports`): esa mezcla es deliberada (D9) y los nombres de PART 8 son textuales.

Identificadores de código, comentarios y mensajes de commit pueden ir en inglés o en castellano; sé consistente dentro de cada archivo. El pie de toda página lleva `FOOTER_DISCLAIMER` de `lib/config.ts`.

## Forbidden patterns (CI greps for these — do not produce them)

`service_role` / `SUPABASE_SERVICE_ROLE` in app code · `dangerouslySetInnerHTML` · new `NEXT_PUBLIC_` vars · client-side reads of base tables · `security definer` without `set search_path` · DDL outside `supabase/migrations/` · `@ts-ignore` · `eslint-disable` · `TODO` without an issue reference · English strings in JSX text position · arbitrary Tailwind values.

Also structurally forbidden: internal `bigint` ids in URLs or payloads (public_id/slug only); selecting `author_id` together with anonymous content for public rendering; importing `lib/supabase/admin.ts` from anything other than `app/api/cron/*`; a 404 where a deleted-content tombstone must return **HTTP 410**.

## Migration protocol (always, in this order)

`supabase migration new <name>` → write the SQL → `supabase db reset` locally → pgTAP green (`supabase test db`) → `npm run gen:types` and commit the diff → PR with CI green → apply to prod with `supabase db push` from the tagged commit. **Never edit an applied migration; write a new one.** Every migration is additive and backward-compatible with the deployed app; destructive changes expand/contract over two releases.

Every migration file: RLS enabled on every table · `COMMENT ON` for every table and non-obvious column · every function `security definer` + `set search_path = public, pg_temp` + `revoke execute … from public, anon` then explicit grants · errors as `raise exception '<CODE>'` with codes from `RPC_ERROR_CODES` · no `create type … as enum` (text + named CHECK).

## Definition of done (nine binary checks, filled into the PR description)

Works logged-out where public · mobile at 390 px checked · keyboard-navigable with visible focus · new RLS policies pgTAP-tested allow **and** deny · rate-limited if it writes · reportable/removable/audited if it creates content · es-AR copy read aloud once · analytics event if it is in the PART 24 §24.3 catalog (closed list of 14 — adding one needs a decisions.md line) · `docs/decisions.md` updated if a decision was made.

## When unsure

Do not invent schema, endpoints, types or copy. Open `docs/BUILD-CONTRACT.md` for the signature, `docs/plan/` for the decision, `supabase/migrations/` for what the column is actually called. If none of them answers, stop and ask. A silent assumption in this repo becomes a column that does not exist, an English string in production, or an anonymity leak — and the third one is the kind the project does not survive.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
