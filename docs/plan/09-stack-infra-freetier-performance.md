# PART 19 — TECH STACK

**Decision:** the stack is exactly spine D6 — Next.js App Router + TypeScript strict + RSC-first React, Tailwind v4, two Radix primitives, Supabase (Postgres + Auth), Cloudflare R2 for all resource files (§0.5-R17), plain SQL migrations via Supabase CLI with generated types (no ORM), Zod at every boundary, Vitest + pgTAP + Playwright, Resend SMTP, Sentry free tier, Vercel Hobby. This part justifies each item against the brief §63 framework (simplicity, cost, security, performance, maintainability, DX, scalability, portability, durability, 10-year fit) and fixes the dependency budget at under 20 production packages.

The meta-rule for every choice below: **one developer, AI-assisted, ten years.** That biases every decision toward (a) boring, massively documented technology that AI coding tools generate correctly on the first try, (b) the smallest possible number of moving parts, and (c) data-layer portability over app-layer portability — the app can be rewritten in a week; the data cannot (brief §58).

## 19.1 Framework: Next.js App Router

**Considered:** Next.js (App Router) · Remix/React Router 7 · SvelteKit · Astro.
**Chosen:** Next.js, App Router, current stable, deployed to Vercel.
**Why:** (1) It is the only framework where the deploy target (Vercel Hobby) is first-party: ISR, cache tags, on-demand revalidation, image handling, and cron wiring work with zero configuration — for a team of one, infra glue code is pure loss. (2) RSC lets us ship content pages with essentially no feature JavaScript, which is the core of PART 22's budget. (3) It is the framework AI coding assistants know best; generated code quality is measurably higher than for SvelteKit or Remix idioms, which matters when AI writes 70% of the code (brief §43). (4) `@supabase/ssr` targets Next.js explicitly. Remix is a fine framework but its Vercel story and ISR/tag-caching story are weaker; SvelteKit would add a second component paradigm to everything (Radix, Sentry, AI training data all skew React); Astro excels at static content but our core surface (feed, composer, votes) is an app, and Astro islands + a second router is more architecture, not less.
**Cost:** framework lock-in to Vercel-flavored caching APIs (`revalidateTag`, ISR). Accepted because the durable contract is the URL map (D7) and the SQL schema (D4), not the rendering layer — PART 21 §21.7 proves the app runs `next start` on a bare VPS with all Vercel-specific features degrading gracefully to dynamic rendering.

## 19.2 TypeScript, strict

**Decision:** `"strict": true`, plus `noUncheckedIndexedAccess`. Not negotiable, no gradual adoption.
Why: AI-assisted development converts type errors from annoyance into the primary automated review layer (brief §43 — "strongly typed, easy to reason about"). Database types are generated from the live schema (`supabase gen types`, §19.7), so the compiler catches schema drift between a migration and the code that uses it — the single most common AI-generated bug class. Cost: none that matters; strictness friction is front-loaded and small.

## 19.3 React: RSC-first, client components on an allowlist

**Decision:** every component is a Server Component unless it appears on this allowlist. Adding to the allowlist requires a line in `docs/decisions.md` (D14.8 applies to client components as it does to dependencies).

MVP client-component allowlist (complete):

| Client component | Why it must be client |
|---|---|
| Composer (post/comment form incl. "Anónimo" checkbox) | controlled input, char counter, optimistic pending state |
| Vote button (post page only — feed rows show score as static text, §0.5-R20) | optimistic toggle without full-page navigation |
| Dropdown menus (user menu, "..." overflow) | Radix, keyboard/focus behavior |
| Report/confirm dialogs | Radix dialog |
| Search input with typeahead | debounced suggestions (materias only in MVP) |
| Theme toggle (dark mode, D8) | toggles the root class and persists the preference in a cookie, so SSR renders the right theme with no flash (PART 18, §0.5-R23) |
| File-upload field (resources) | progress, client-side size/type pre-check |

Everything else — feed lists, post pages, materia/carrera pages, profiles, search results, mod queue tables — renders on the server and ships zero feature JS. Tabs are links, not JS tabs (D7 URLs make each tab addressable anyway). Rationale and byte budgets in PART 22.

## 19.4 Styling: Tailwind CSS v4

**Considered:** Tailwind v4 · vanilla CSS Modules · CSS-in-JS (rejected outright: runtime cost, RSC friction).
**Chosen:** Tailwind v4, with the PART 18 design tokens defined as CSS variables in `@theme` — the tokens are plain CSS custom properties, so the design system survives even a future departure from Tailwind.
**Why:** (1) v4 is CSS-first configuration; the compiled output is a static stylesheet with zero runtime, identical in performance to hand-written CSS. (2) For one developer, colocated utility classes eliminate the naming/organizing overhead of CSS Modules across ~60 components, and AI tools produce far more consistent Tailwind than consistent bespoke CSS. (3) The brief's fear (§5 "generic Tailwind dashboard aesthetics") is a design-token problem, not a tooling problem: PART 18's restrained tokens (1px hairlines, ≤4px radius, azul birome) produce the editorial look regardless of how classes are authored.
**Cost:** utility-class markup is noisier to read; a Tailwind major-version migration every ~3 years. Accepted: the escape hatch is that tokens live in CSS variables and the compiled CSS is inspectable, so a rip-out is mechanical, not archaeological.

## 19.5 Radix primitives — two, not a library

**Decision:** `@radix-ui/react-dropdown-menu` and `@radix-ui/react-dialog` only. Everything else uses semantic HTML: `<details>` for collapsibles, links for tabs, native `<form>` elements, native `<select>`.
Why: menus and modal dialogs are the two widgets where correct keyboard/focus/ARIA behavior is genuinely hard (brief §27), and Radix primitives are unstyled so they carry no visual identity (brief §25 prohibition on component libraries). Any third Radix package requires a `docs/decisions.md` entry. Cost: ~10 KB gz on routes that include a menu — inside PART 22's budget.

## 19.6 Backend: Supabase integrated vs. composed alternative

The biggest infrastructure decision in the plan; the honest comparison the brief §24 demands.

**Considered:** (a) Supabase (Postgres + Auth + Storage + RLS, integrated) · (b) composed best-of-breed: Neon Postgres + Lucia/Auth.js self-rolled auth + Cloudflare R2 storage · (c) all-Cloudflare (D1 + Workers) — rejected immediately: D1 is SQLite, loses Postgres FTS, RLS, pgTAP, and portability of the ecosystem we're betting on.
**Chosen:** Supabase, one project, Free tier (D6) — Postgres + Auth; resource files deliberately do **not** live on Supabase Storage but on Cloudflare R2 (see the storage block at the end of this section, §0.5-R17).
**Why:**
1. **Team size 1 is the dominant term.** The composed stack means owning auth code (password reset, email change, session rotation, token theft mitigation) — the highest-blast-radius code in the product (PART 9-10). Supabase Auth is maintained security infrastructure for $0. Lucia's own maintainers deprecated the library form of the project (it became a learning resource) — mark: last verified against my knowledge, not re-checked; either way, "self-maintained auth" is exactly the liability a solo project must not hold.
2. **RLS is the security architecture** (D5). Postgres-level policies tested by pgTAP work identically on Supabase, on RDS, or on a VPS. Choosing Supabase is largely choosing *Postgres with the policies as the API*, which is the most portable security model available.
3. **Storage-RLS integration was never load-bearing** (§0.5-R17): downloads are login-walled in Next server code and served via short-lived signed URLs either way, so file storage is decoupled from this choice — see the R2 block below.
4. **Free-tier arithmetic** (PART 21): 500 MB DB + 50k auth MAU is genuinely enough for beta + year one at MVP caps (file storage and egress live on R2, §0.5-R17), and the paid step ($25) is pre-committed (D13).
**Lock-in analysis, honestly:** what locks us in vs. what doesn't —

| Layer | Lock-in | Exit difficulty |
|---|---|---|
| Postgres schema, RLS policies, SQL functions | None — plain Postgres | `pg_dump` restores anywhere |
| Auth users + bcrypt hashes | Low — `auth.users` schema is documented; GoTrue is open source and self-hostable | Export hashes, run GoTrue or verify bcrypt in any stack |
| Resource files (Cloudflare R2, §0.5-R17) | Low — S3-compatible API; paths live in our own `resource_files.storage_path` | `rclone` sync + path manifest to any S3-compatible store (§21.7) |
| `@supabase/ssr` client code | Medium — confined to `src/lib/supabase/` (~3 files) | Rewrite one module |
| Realtime / Edge Functions | **Zero — we do not use them** (D6) | n/a |

The exit is rehearsed annually (§21.7), which converts lock-in from a fear into a measured cost (< 1 day).
**Cost:** free-tier pausing after 7 idle days [FREE-TIER RISK] (mitigated §21.5); no automatic backups on Free [mitigated §20.9]; shared compute means p99 query latency is at Supabase's mercy — accepted, PART 22 budgets around it.

**File storage: Cloudflare R2, from the first upload (§0.5-R17).**
**Considered:** Supabase Storage (integrated with the same project and auth, storage-RLS policies) · Cloudflare R2 (10 GB free, **zero egress fees**, S3-compatible API).
**Chosen:** Cloudflare R2 for all resource files, including the upload quarantine bucket. Supabase Storage is unused in MVP.
**Why:** the free-tier arithmetic is not close — the seed corpus alone is 0.4–1 GB against Supabase's 1 GB bucket, and a single healthy parciales month of PDF downloads grazes or blows the 5 GB/mo egress cap (§21.2), while R2 charges zero egress at any volume. And the integration argument for Supabase Storage was never load-bearing: downloads were already server-gated — a Next route handler checks the session and 302s to a short-lived signed URL (§20.1) — so storage-RLS would have been unused either way. This kills what was the plan's #1 [FREE-TIER RISK] outright.
**Cost:** one more provider credential to manage, and a small S3 SDK utility module for presigning (§19.12). Accepted — cheaper than a mid-life storage migration with a live corpus.

## 19.7 Data layer: SQL migrations + generated types, no ORM

**Considered:** Prisma · Drizzle · plain SQL migrations via Supabase CLI + `supabase gen types`.
**Chosen:** plain SQL. Migrations are numbered `.sql` files in `supabase/migrations/`, applied by the Supabase CLI; TypeScript types are generated from the schema (`supabase gen types typescript`), committed, and CI fails if they drift.
**Why — the source-of-truth argument:** this schema *is* the ten-year asset (brief §58). RLS policies, SECURITY DEFINER functions, triggers, generated tsvector columns, partial indexes, CHECK constraints (D4/D5) are all first-class SQL and second-class or unrepresentable in ORM schema DSLs — with Prisma we would end up writing raw SQL migrations for the interesting 40% anyway, leaving *two* sources of truth that drift. Drizzle is closer to SQL but still inverts authority: the TS schema generates SQL, so the database — the thing that outlives every app rewrite — becomes a build artifact of the app. We want the opposite dependency direction: **database first, types generated from it, app conforms.** A 2031 rewrite in whatever-then-exists reads `supabase/migrations/*.sql` and understands the entire system; no ORM runtime needed to interpret the data. Queries in app code are written against the `_public` views and RPC functions (D5) via `supabase-js`'s typed PostgREST client, so we get end-to-end types without an ORM runtime.
**Cost:** no ORM query-builder ergonomics; joins beyond PostgREST's embedding live in SQL views/functions. Accepted — PART 22's query inventory shows every route needs 1-3 known queries; there is no dynamic query surface that would justify an ORM.

**Data-layer shape (binding):** one typed query module per feature, no inline queries in components — living inside PART 27's feature folders (the tree there is canonical):

```
features/<domain>/          // auth, posts, feed, materias, recursos, search,
  components/               //   notifications, mod, analytics (PART 27 §27.1)
  actions.ts                // 'use server' mutations — Zod-validated, call RPCs
  queries.ts                // server-side reads via _public views / RPC
  schemas.ts                // Zod schemas shared by actions and forms
```

e.g. `features/feed/queries.ts` exports `getFeedMisMaterias()`, `getRecentPosts()`; `features/posts/actions.ts` exports `createPost()`, `votePost()`.

Rules: route files in `app/` stay thin and import only from `features/*`, `components/ui`, and `lib` (import boundaries ESLint-enforced, PART 27 §27.4); every exported function's return type derives from generated DB types; every mutation validates with Zod before touching the client (D14.4); no `supabase.from()` call outside `features/*/queries.ts` and `features/*/actions.ts`. This is the shape AI tools extend safely — the pattern is visible in every existing file.

## 19.8 Validation: Zod

Zod schemas at every trust boundary: Server Action inputs, route-handler params, environment variables at boot (`src/lib/env.ts` parses `process.env` once, crashes on missing config), and Supabase webhook/cron payloads. One schema per form, colocated with the action. The database CHECK constraints remain the last line (D5); Zod exists to fail fast with es-AR error copy ("El título no puede superar los 120 caracteres").

## 19.9 Testing: Vitest + pgTAP + Playwright

Three layers, effort deliberately unequal (details in PART 25):
- **pgTAP via `supabase test db` — the critical suite.** Every RLS policy proven in both directions (allow and deny, D14.2), every SECURITY DEFINER function tested for privilege leaks, anonymity invariants tested as SQL ("a select on `posts_public` where is_anonymous returns null author fields"). CLI support verified 2026-08-13 (runs pg_prove against `supabase/tests`, per-test rollback).
- **Vitest** for pure logic: Zod schemas, slug/nanoid helpers, feed-ordering functions, karma batch math.
- **Playwright** smoke E2E only — the 6 golden flows enumerated in PART 25 (register/onboard, post/comment/vote, report/moderate, download among them). Run against local `supabase start` stack in CI.
Why this distribution: the product's risk concentrates in authorization and anonymity, which live in the database — so the database gets the strongest tests.

## 19.10 Email: Resend SMTP

Supabase's built-in sender is 2 emails/hour and explicitly non-production (verified 2026-08-13) — the third signup in an hour would fail silently. Resend free tier (100/day, 3,000/mo, 1 custom domain — verified 2026-08-13) wired as Supabase Auth custom SMTP before the first beta invite. MVP sends auth mail only (confirmation, password reset); all product notifications are in-app (D2), so 100/day binds only during invite bursts — launch waves are throttled to < 80 signups/day (§21.4). [FREE-TIER RISK]

## 19.11 Errors: Sentry free tier

`@sentry/nextjs`, server + client, 5,000 errors/mo, 30-day retention, 1 seat (verified 2026-08-13). Config: `sampleRate` 1.0 for errors, tracing off (spans budget irrelevant to us), client `ignoreErrors` for extension noise, and a per-key rate limit in the Sentry dashboard so one looping client bug cannot exhaust the monthly quota in an hour (the research note's warning). PII scrubbed at SDK level: no user emails or IPs attached to events — pseudonymous user id only (PART 24 details observability).

## 19.12 Dependency budget

**Decision:** production `dependencies` ≤ 20; MVP ships with 14. Every addition needs a `docs/decisions.md` entry (D14.8) stating what, why, and the exit path.

Expected MVP `package.json` (production):

| Package | Role |
|---|---|
| `next` | framework |
| `react`, `react-dom` | UI runtime |
| `@supabase/supabase-js` | typed PostgREST/auth client |
| `@supabase/ssr` | cookie-based session handling in RSC/middleware |
| `zod` | boundary validation |
| `nanoid` | public IDs (D7) |
| `@radix-ui/react-dropdown-menu` | menus |
| `@radix-ui/react-dialog` | dialogs |
| `lucide-react` | sparse icon set (D8), tree-shaken |
| `@sentry/nextjs` | error reporting |
| `server-only` | import guard for server modules |
| `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` | R2 signed upload/download URLs, server-only (§0.5-R17) |

Dev-only: `typescript`, `tailwindcss` (+ PostCSS adapter), `vitest`, `@playwright/test`, `supabase` (CLI), `eslint` + config, `prettier`, `@lhci/cli`. Notable *absences*, deliberate: no date library (native `Intl.RelativeTimeFormat` renders "hace 3 h"), no slugify (own 15-line unaccent+hyphenate util, must match the SQL slug function in PART 8), no markdown parser (MVP bodies are plain text with preserved line breaks — React's escaping is the sanitizer; a markdown subset is a P2 decision), no state-management library (RSC + forms), no fetch wrapper, no CSS-in-JS.

## 19.13 Explicit rejection list

| Rejected | One-line reason |
|---|---|
| Redis / Upstash | Postgres + Next cache tags cover counters, rate limits, caching at this scale; a second datastore is a second failure mode |
| Elasticsearch / Meilisearch / Algolia | Postgres FTS with `spanish` config + `unaccent` handles ~10⁵ documents fine (PART 13); revisit at 10× that |
| tRPC | Server Actions + typed query modules already give end-to-end types; tRPC adds a router layer with no new capability |
| GraphQL | one consumer (our own frontend); a query language for zero external clients is pure cost |
| Component libraries (shadcn/ui, MUI, Mantine, Chakra) | visual identity is the product's 10-year face (D8); libraries impose theirs — shadcn additionally vendors ~40 files we'd own forever |
| Prisma / Drizzle | source-of-truth split; SQL is the durable asset (§19.7) |
| Supabase Realtime | feed is not a chat; polling/refresh suffices; realtime holds connections that cost money at scale (D6) |
| Supabase Edge Functions | Next.js server code already exists; a second runtime (Deno) doubles the deployment story |
| Edge DB / read replicas (Fly, Neon replicas, Turso) | one region (users are in Rosario), one Postgres; replicas solve a problem we will never have |
| Monorepo tooling (Turborepo, Nx, pnpm workspaces) | one app, one package.json; workspaces are organizational debt for a team of one |
| Message queues (SQS, Inngest, QStash) | the single daily Vercel cron (§20.9) covers every async job in the plan |
| CAPTCHA service at MVP | invite gating + DB rate limits (D3, D14.9) suffice; hCaptcha/Turnstile is the P2 escalation, not the default |

---

# PART 20 — VERCEL + SUPABASE ARCHITECTURE

**Decision:** one Next.js app on Vercel Hobby in front of one Supabase project (Postgres + Auth) plus Cloudflare R2 for all resource files (§0.5-R17); all reads/writes through Next server code with the user's session (RLS always on, D5); public pages cached at Vercel's CDN via ISR + cache tags so the free tier's CDN absorbs read traffic; files served only via short-lived R2 signed URLs behind a login-walled redirect; one Vercel daily cron (`/api/cron/aggregates`, §0.5-R16) + a weekly GitHub Actions backup — pg_cron is not load-bearing.

## 20.1 Request-path architecture

```
                        ┌─────────────────────────────────────────────┐
                        │                 VERCEL                      │
 Browser ──HTTPS──────► │  Edge/CDN cache                             │
   │                    │   ├─ HIT: static/ISR HTML, /_next/* assets  │──► response (no function run)
   │                    │   └─ MISS or dynamic:                       │
   │                    │       Middleware (session refresh,          │
   │                    │       IP curtain, /mod gate)                │
   │                    │            │                                │
   │                    │            ▼                                │
   │                    │  Next server: RSC render / Server Action    │
   │                    │  / route handler                            │
   │                    └───────┬─────────────────────┬───────────────┘
   │                            │ @supabase/ssr       │ service-role
   │                            │ (user JWT, RLS on)  │ (cron routes ONLY,
   │                            ▼                     ▼  CRON_SECRET-gated)
   │                    ┌─────────────────────────────────────────────┐
   │                    │                SUPABASE                     │
   │                    │  Auth (GoTrue) ── auth.users                │
   │                    │  Postgres: RLS policies, _public views,     │
   │                    │    SECURITY DEFINER RPCs                    │
   │                    └─────────────────────────────────────────────┘
   │
   │                    ┌─────────────────────────────────────────────┐
   │                    │           CLOUDFLARE R2 (§0.5-R17)          │
   │                    │  PRIVATE buckets: quarantine incoming/ +    │
   │                    │  final r/ paths (PART 14); signed PUT for   │
   │                    │  uploads, signed GET for downloads — both   │
   │                    │  minted in Next server code (S3 API, 120 s) │
   │                    └───────────────┬─────────────────────────────┘
   │   file download:                   │
   └──► GET /recursos/[id]/descargar ───┘
        (route handler: auth check → count → presigned R2 GET (120 s)
         → 302 to R2 URL; file bytes NEVER pass through Vercel or Supabase)

 Cron paths:
   Vercel cron (daily ×1, CRON_SECRET) ──► /api/cron/aggregates ─►
     keepalive SELECT (unpauses clock) + events aggregation + karma batch
     + counters audit + retention purges (§20.9, §0.5-R16)
   GitHub Actions (weekly): pg_dump + file manifest + rclone → encrypted backup (§20.9)
```

Two properties matter most: **file bytes never transit Vercel** (they'd double-bill egress against the 100 GB bandwidth budget and add latency), and **no browser→Supabase data path exists** except the auth token refresh handled by `@supabase/ssr` cookies — PostgREST is effectively private API surface even though it is technically reachable, because RLS + view grants make unauthenticated direct calls return nothing sensitive (D5, tested in pgTAP).

## 20.2 Rendering strategy per route

**Decision:** static or ISR for everything a crawler or logged-out visitor sees; dynamic only where the response is personalized or write-adjacent. A cookie-holding (logged-in) visitor renders public routes dynamically (Next opts in automatically when `cookies()` is read for the session), but those dynamic renders reuse the same tag-cached data functions, so the DB query cost stays deduplicated.

| Route (D7) | Logged-out | Logged-in | Revalidation | Why |
|---|---|---|---|---|
| `/` | ISR 60 s (shows Reciente teaser + join CTA) | dynamic (Mis materias feed) | time | logged-out home is SEO/landing; feed is per-user by definition |
| `/reciente` | ISR 60 s | dynamic (adds vote state) | time | identical for all anons; 60 s staleness is invisible on a chronological list |
| `/materias` (index) | ISR 3600 s | same | time | catalog changes ~never |
| `/materias/[slug]` | ISR 300 s | dynamic | time + `revalidateTag('materia:<slug>')` on new post/resource in that materia | the SEO workhorse ("resumen <materia> uca", D11); on-demand tag keeps it fresh on writes without burning functions on reads |
| `/carreras/[slug]`, `/facultades/[slug]` | ISR 3600 s | same | tag on catalog edit | plan de estudios grid is near-static |
| `/p/[publicId]` | dynamic, data tag-cached (`post:<id>`) | dynamic | `revalidateTag` on comment/vote/edit/mod action | comment threads must be correct-now (mod removals!); tag-cached data keeps repeat renders cheap. ISR-per-post was rejected: unbounded page count × low per-page traffic = poor hit ratio for the cache space |
| `/recursos`, `/recursos/[publicId]` | ISR 300 s | dynamic | tag `recurso:<id>` on upload/mod | metadata page; download counts may lag ≤ 300 s, acceptable |
| `/u/[handle]` | dynamic | dynamic | — | must reflect renames/deletions instantly (D3); `noindex` (C16) so no SEO value in caching |
| `/buscar` | dynamic | dynamic | never cached | query-string keyed, personal-ish, unbounded key space |
| `/avisos` (notifications) | n/a | dynamic, **never cached** | — | per-user by definition |
| `/ajustes`, `/mod/*` | n/a | dynamic, never cached | — | personal/privileged |
| `/acerca`, `/reglas`, `/terminos`, `/privacidad`, `/ingresar`, `/registro` | fully static | same | on deploy | content lives in the repo |
| `/archivo/*` (P3) | ISR 86400 s | same | time | archival by nature |

Function-budget check: with this table, the routes that burn invocations are logged-in page views, Server Actions, search, and the download redirect. §21.2 shows we stay under 15% of Hobby's 1M invocations/mo even at 5k MAU — the CDN absorbs the anonymous/crawler majority. [FREE-TIER RISK] (any change that makes public listing pages dynamic-for-anons multiplies invocations ~5×; PR review checklist item in PART 26.)

## 20.3 Caching design

- **Tag vocabulary (binding):** `materia:<slug>`, `post:<publicId>`, `recurso:<publicId>`, `carrera:<slug>`, `catalog`. Data functions in `features/*/queries.ts` declare their tags; write actions call `revalidateTag` as their last step (after the RPC commits). One write = at most 3 tag invalidations (e.g., new comment → `post:x`, `materia:y` — because the materia page shows last-activity).
- **Never cached, ever:** the logged-in feed (`/`), `/avisos`, `/mod/*`, `/ajustes`, `/buscar` results, anything rendered from `anon_aliases`, and any response containing vote state or the viewer's identity. Rule of thumb written into PART 26's review checklist: *if the render reads the session for anything beyond "is logged in", it must not be cached.*
- **HTTP layer:** ISR pages get Vercel's default `s-maxage` on the CDN; we additionally set `Cache-Control: public, max-age=0, must-revalidate` on HTML (browser always revalidates — correctness for mod-removed content) and immutable hashed assets get the Next default 1-year immutable. The signed-URL 302 response is `Cache-Control: private, no-store` (it embeds a capability).
- **No client-side data cache** (no SWR/React Query — rejected in §19.13): navigation re-renders from the server; RSC payload for a list page is ~5-15 KB.

## 20.4 Server Actions vs. route handlers

**Decision:** Server Actions for every user mutation; route handlers only where the response is not a page transition. Enumerated:

| Route handlers (complete list) | Why not an Action |
|---|---|
| `GET /sitemap.xml`, `GET /robots.txt` | crawler-facing XML/text |
| `GET /api/cron/aggregates` | invoked by the single daily Vercel cron with `Authorization: Bearer CRON_SECRET` (§0.5-R16) |
| `GET /recursos/[id]/descargar` | returns a 302 redirect to a signed R2 URL (§0.5-R17), must be link-able ("Descargar" is an `<a>`, works without JS) |
| `GET /auth/callback` + `POST /auth/signout` | Supabase auth code exchange per `@supabase/ssr` contract |

**OG images: static at MVP.** One brand OG image (wordmark on paper-white, D8) served from `/public` for all pages; per-materia dynamic OG (`next/og`) is P2 [decision: the WhatsApp-preview quality D11 needs comes 90% from title/description meta tags, and `next/og` adds a per-share function invocation + font embedding for marginal gain now].
Actions policy details: every Action (a) Zod-parses input, (b) reads the session, (c) calls exactly one RPC or view-write, (d) `revalidateTag`s, (e) returns typed `{ ok } | { error }` with es-AR error copy ("No pudimos publicar. Probá de nuevo."). Actions never contain SQL strings — they call the query module (§19.7).

## 20.5 Middleware

Three duties, nothing else (middleware is on the hot path of every request):
1. **Session refresh** — `@supabase/ssr` token rotation into cookies; the reason middleware must exist at all.
2. **IP rate curtain** — coarse, best-effort: an in-memory token bucket per instance (no Redis, D6) that 429s obviously abusive bursts (> 60 req/min/IP on mutation paths). This is a *curtain*, not the wall: real rate limits are enforced in the database RPCs (D14.9) and hold even if middleware is bypassed or the instance is cold.
3. **`/mod` gate** — redirect non-mod sessions away from `/mod/*` cheaply; the real authorization is RLS + role checks in every mod query (D14 — frontend-only gates are never trusted).

Matcher excludes `/_next/static`, `/_next/image`, `/favicon.ico`, `/public` assets — middleware must run only on page/data/action requests. **Cost on Hobby:** middleware executions count against included usage (bundled ~1M-unit scale like function invocations; exact middleware metering wording not separately verified — flagged, PART 34). At §21.2's traffic (< 150k page/action requests/mo at 1k MAU) this is far from binding, but the matcher discipline keeps it that way. [FREE-TIER RISK] (if the matcher ever widens to static assets.)

## 20.6 Environment & secret matrix

| Variable | Local | Preview | Prod | Notes |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | local stack URL | **second (preview) project** (see below) | prod project | public by design |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | local | second project | prod | public; RLS is the security, not this key |
| `SUPABASE_SERVICE_ROLE_KEY` | local only (seed scripts) | **absent** | present, read **only** by `/api/cron/*` and admin CLI scripts | D14.3; never imported by request-path modules — enforced by `server-only` + a lint rule banning the import outside the `/api/cron/*` route handlers |
| `SUPABASE_DB_URL` (direct Postgres) | local | absent | **absent from Vercel entirely** — lives in GitHub Actions secrets only | used by migration + backup workflows |
| `CRON_SECRET` | dev value | absent | present | Vercel injects into cron requests; handlers 401 without it |
| `SENTRY_DSN` / auth token | optional | present | present | |
| `NEXT_PUBLIC_SITE_URL` | localhost | preview URL | canonical domain | for absolute URLs in metadata/sitemap |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET` | dev bucket | preview bucket | prod bucket | server-only S3 credentials for R2 signed URLs (§0.5-R17); never `NEXT_PUBLIC_` |
| `PRODUCT_NAME` constant | (code, not env — single constant per D10) | | | rename = 1-day change |
| Resend SMTP credentials | — | — | — | live in the **Supabase dashboard** (Auth SMTP config), not in Vercel at all |

**Preview deployments (§0.5-R23):**
**Considered:** previews pointed at the production Supabase project with the anon key only (RLS as the boundary, one migration lineage) · previews pointed at the second free Supabase project, seeded.
**Chosen:** previews use the **second free Supabase project** (the free plan allows 2, verified 2026-08-13), seeded with the APPENDIX A catalog + fixture data — previews never touch production data. The production project deploys only from `main`.
**Why:** preview URLs are long-lived and semi-shareable; even with RLS as the boundary, pointing experimental branches at real user data is an avoidable incident class. The second project also gives every schema change a **migration-rehearsal target**: a branch's migrations are applied to the preview project before they ever reach prod (§20.8), and the same project doubles as the annual restore-drill target (§21.7).
**Cost:** a second migration lineage to keep in sync — mechanical, since the same `supabase/migrations/*.sql` files apply to both — and seeded rather than real-shaped data on previews.

## 20.7 Local development workflow

The loop, exactly (documented in the repo README, PART 27):
1. `supabase start` — local Postgres + Auth in Docker (Supabase Storage unused, §0.5-R17; local upload testing targets a dev R2 bucket, or the flow is exercised in CI's Playwright run).
2. `supabase db reset` — replays `supabase/migrations/*.sql`, then `supabase/seed.sql` (Rosario catalog from APPENDIX A + fixture users/posts).
3. `npm run gen:types` → `supabase gen types typescript --local > lib/types.gen.ts`; CI re-generates and `git diff --exit-code`s to catch drift.
4. `npm run dev` against the local stack; auth emails land in the local Inbucket/Mailpit inbox — no Resend needed locally.
5. `supabase test db` (pgTAP) + `vitest` + `playwright test` before push; the same three run in CI.
New migration: `supabase migration new <name>` → write SQL → `supabase db reset` → update types → tests. The dashboard is never the editor (D14.1).

## 20.8 Deploy pipeline & migration ordering

**Pipeline:** push branch → GitHub → CI (types drift check, lint, vitest, pgTAP against a fresh local stack, Playwright smoke) → Vercel builds a preview → review on preview URL → merge to `main` → GitHub Actions applies migrations to prod (`supabase db push --linked`, using `SUPABASE_DB_URL`/access token from Actions secrets) → Vercel production deploy. Vercel deploys `main` automatically; the Actions migration job and the Vercel build race, which is safe **only** because of the ordering stance:

**Stance: migrate-then-deploy, additive-only.** Every migration must be backward-compatible with the currently deployed app: add tables/columns/indexes/policies, never rename/drop/narrow in the same release as the code that stops using them. Destructive change = expand/contract over ≥ 2 releases (release N: additive migration + code reads both; release N+1: contract migration after N is verified). This removes the need to gate Vercel on the Actions job (Hobby has no deploy-gating API worth building around) — whichever lands first, old-code+new-schema and new-code+old-schema-for-seconds are both safe, and truly new-schema-dependent code paths are behind the migration having run. `CREATE INDEX` uses `CONCURRENTLY` on prod-sized tables. Rule recorded in PART 26's AI-coding contract.

## 20.9 Cron & backup design

**Vercel cron (Hobby: max once/day, ±59 min jitter — verified 2026-08-13; defined in `vercel.json`, `CRON_SECRET`-gated) — one daily job, `/api/cron/aggregates` (§0.5-R16), which runs in order:**
1. Keepalive step — one real PostgREST SELECT (counts as project activity) and a heartbeat row; §21.5.
2. Aggregates batch (one RPC): events aggregation, the nightly karma recompute for all profiles (D3/C5 — the daily batch that prevents timing correlation), counter reconciliation (recount `comments_count`/`score` drift), materia `last_activity` refresh.
3. Retention purges (§0.5-R11): `search_queries` older than 12 months, `download_log` older than 7 days, notifications read > 90 days / unread > 180 days, `borrador` resource drafts older than 24 hours, and cron heartbeat/job history. `events` is **never pruned** — aggregate-only rows, ~KBs/year, and it feeds the archive stats.

**pg_cron is not load-bearing in MVP (§0.5-R16).** Its availability on Free is only media-confidence, so nothing depends on it: every scheduled job above runs from the aggregates endpoint, and rate limits need no cleanup job at all (they count recent rows through existing indexes, PART 11 §11.6.2). pg_cron may be adopted later as an optimization; if it is, its `cron.job_run_details` history joins the retention purge (the research note warns job history inflates the 500 MB DB).

**Backups (D13 — weekly, tested, from day 1):** a GitHub Actions scheduled workflow (Sunday 03:00 ART) in the private repo:
1. `pg_dump --format=custom` of the prod database **including `auth` schema data** (users + bcrypt hashes — this is what makes accounts portable; exact flag set to be pinned during S0 and verified in the first drill, since Supabase's managed roles restrict some schemas — flagged as verify-in-S0).
2. File manifest: SQL export of `resource_files` (storage_path, size, mime, created_at) as CSV.
3. `rclone sync` of the R2 serving bucket (where all resource files live, §0.5-R17) to a **separate R2 backup bucket** — serving and backup must not share one bucket/failure domain.
4. Dump + manifest encrypted with `age` (key held by founder offline + in password manager) and uploaded to the backup bucket; last 8 weekly dumps retained.
Runtime ≈ 3-5 min/week against GitHub's 2,000 free private-repo minutes (verified 2026-08-13) — negligible. The workflow fails loudly (GitHub → founder email) if the dump is 0 bytes or > 20% smaller than the previous week.

---

# PART 21 — FREE-TIER STRATEGY

**Decision:** the $0 stack is engineered to hold through beta and into a few thousand MAU with strict caps; with resource files on Cloudflare R2 (zero egress fees, §0.5-R17) the old egress wall is retired — the break order is now moderation labor first (C13), DB size second, R2's 10 GB third (D13) — and the first paid dollar (Supabase Pro, USD 25/mo) is pre-committed by trigger, not negotiated under pressure (D13). Everything below cites limits verified 2026-08-13 against official pricing/docs (see confidence notes where lower).

## 21.1 Verified limits and per-limit strategy

| Resource | Free limit (verified 2026-08-13) | Our strategy |
|---|---|---|
| Supabase DB size | 500 MB, shared CPU, 500 MB RAM | text-first content, retention purges per §20.9 (`events` itself kept forever, §0.5-R11), tsvector budgeted (§21.2); Pro trigger at 350 MB |
| Supabase Storage | 1 GB | **unused in MVP** — all resource files live on R2 from the first upload (§0.5-R17) |
| Supabase egress | 5 GB + 5 GB cached | API/DB JSON only — file bytes never touch Supabase (§0.5-R17); ISR keeps even that small |
| Supabase Auth MAU | 50,000 | never binding for us |
| Project pausing | after 1 week inactivity; 1-year restore window | daily keepalive step of the aggregates cron (§21.5) |
| Backups | none included on Free | weekly self-run pg_dump (§20.9) |
| Auth email (built-in) | 2/hour, non-production | Resend SMTP from day 0 (§19.10) |
| Supabase Pro | from $25/mo: 8 GB disk, 100 GB storage, 250 GB egress, daily backups, no pausing | the pre-committed first paid dollar |
| Vercel bandwidth | 100 GB/mo fast data transfer | HTML+assets only (files bypass Vercel, §20.1); ~30-60 KB/page ⇒ headroom ×20 at 5k MAU |
| Vercel functions | 1M invocations/mo, 4 active-CPU-hrs, 360 GB-hrs | ISR-for-anons keeps invocations to logged-in traffic (§20.2) |
| Vercel cron | ≤ once daily, ±59 min | one daily job covers everything (keepalive + aggregates + karma + retention, §0.5-R16); pg_cron not load-bearing |
| Vercel commercial use | prohibited on Hobby (incl. donations) | any monetization → Vercel Pro first (C8; PART 31) |
| Vercel image optimization | 5k transformations/mo, hard 402 over | MVP renders **no user images**; the wordmark/OG are static files served unoptimized — this limit is designed out |
| Vercel logs | 1-hour retention | Sentry is the record of errors; cron handlers write outcome rows to `events` |
| Resend | 100/day, 3,000/mo | auth mail only; invite waves < 80/day |
| Sentry | 5k errors/mo, 30-day retention | per-key rate limit; noisy-bug circuit breaker |
| GitHub Actions | 2,000 min/mo private | CI ≈ 8 min/PR + 5 min/week backup ⇒ comfortable at solo cadence |
| R2 (resource files + backup vault, §0.5-R17) | 10 GB storage, **zero egress fees**, 1M class-A/10M class-B ops per mo | primary file store from the first upload: 10 MB/file, ≤3 files/resource, 100 MB/user quota (PART 14); paid trigger at 7 GB (§21.6, cents/GB-mo) |

## 21.2 Consumption model at 100 / 1,000 / 5,000 MAU

Assumptions (stated so the model can be re-run against real telemetry, which PART 24's `events` table provides): posts/day ≈ MAU × 0.05 during cursada; comments ≈ 3× posts; votes ≈ 10× posts; sessions ≈ 8/MAU/mo; ~10 dynamic requests/session logged-in; resource uploads ≈ 3/wk per 100 MAU; average file 3 MB (typical scanned resumen PDF — assumption, not verified); downloads ≈ 1/MAU/mo baseline, **2–4/MAU/mo in parciales months** (the earlier 0.5 figure contradicted the launch target "≥60% download in week 1" and is corrected per §0.5-R17 — with R2's zero egress fees the volume is free either way). Row-size estimates include indexes + tsvector: post ≈ 3.5 KB effective, comment ≈ 1.2 KB, vote ≈ 150 B, notification ≈ 300 B.

| Metric (per month unless noted) | 100 MAU | 1,000 MAU | 5,000 MAU |
|---|---|---|---|
| Posts / comments per day | 5 / 15 | 50 / 150 | 250 / 750 |
| DB growth per year | ≈ 40 MB | ≈ 220 MB | ≈ 1.0 GB |
| Years to 500 MB DB | ~10 | **~2-2.5** | ~0.5 |
| File storage growth per year (R2) | ≈ 0.5 GB | ≈ 2.3 GB | ≈ 7.8 GB |
| Years to R2's 10 GB free | ~20 | **~4** | ~1.3 |
| File download volume, baseline (exam-month) — $0 on R2 at any scale | 0.3 GB (0.6–1.2) | 3 GB (**6–12**) | 15 GB (30–60) |
| Vercel function invocations | ~10k | ~90k | ~450k |
| Vercel bandwidth (HTML+assets @ ~45 KB avg) | ~0.5 GB | ~4 GB | ~20 GB |
| Resend emails (auth only) | ~150 | ~900 | ~3,500* |

Arithmetic examples: 1k MAU DB/yr = posts 18k×3.5 KB (63 MB) + comments 55k×1.2 KB (66 MB) + votes 180k×150 B (27 MB) + notifications/events/aliases (~60 MB) ≈ 220 MB. 1k MAU exam-month download volume = 1,000 × 3 × 3 MB = 9 GB — a figure that would have blown Supabase Free's 5 GB egress cap, and that costs **$0 on R2** (zero egress fees, §0.5-R17). (*5k MAU Resend: 3,500/mo exceeds the 3,000 cap in signup-heavy months → Resend Pro or batching, §21.6.)

Reading the table: at 100 MAU nothing binds for years. At 1,000 MAU, files and downloads no longer bind at all (~4 years to R2's 10 GB; egress free at any volume, §0.5-R17) — the binding infra wall is **DB size, ~2–2.5 years to 500 MB**, whose 350 MB trigger fires with months of warning. At 5,000 MAU the DB trigger fires within the year and R2's 10 GB within ~15 months; Supabase Pro ($25) plus cents of R2 paid storage cover it comfortably.

## 21.3 What breaks first — brief §59 Q19-21, ranked

**At 1,000 users** [FREE-TIER RISK] (break order per amended D13):
1. **Moderation labor** (C13) — not an infra limit but it binds first; PART 11/30 own it.
2. **DB size** — ~220 MB/yr against 500 MB makes the 350 MB Pro trigger a year-two event; predictable from telemetry, never an outage. Query load at 50 posts/day is trivial.
3. **R2 storage 10 GB** — ~2.3 GB/yr of uploads ≈ four years of headroom; when the 7 GB trigger fires, the step is cents/GB-month, not a platform move (§21.6).
4. **Resend 100/day** on invite-wave days — operational (stagger invites), not architectural.
The old #1 — Supabase file egress in a parciales month, downloads blocked in exam week — is retired outright by R2's zero egress fees (§0.5-R17); exam-week download spikes cost $0 at any scale.

**At 10,000 users:** free tier is not a question — assume Supabase Pro already active. Next walls: (1) Vercel Hobby's 100 GB bandwidth (~40 GB modeled HTML — headroom, but one viral WhatsApp deep-link month can spike it) and the practical need for Vercel Pro anyway if monetization has begun (C8); (2) DB disk on Pro (8 GB included) is fine, but **shared-compute query latency** under exam-week concurrency becomes the felt limit → Pro compute add-on before replicas or caching layers; (3) Sentry 5k errors/mo starts clipping real signal → Team $26/mo; (4) moderation labor is now the dominant constraint, full stop (C13).

**At 100,000 users:** (honest, per brief §61: this is 20× beyond the 10-year plan's realistic Rosario ceiling — UCA Rosario's student body is a few thousand; 100k implies multi-university, a different product per brief §57.) Technically: single-writer Postgres still serves a text forum at 100k MAU with good indexes, but FTS query cost and the feed's fan-out reads want materialized search/feed paths; the R2 zero-egress decision (§0.5-R17) is precisely what makes ~50 GB/day of PDF serving survivable at all; the platform needs its first paid engineer long before its first sharded database. The bottleneck order stays: people → money → Postgres.

## 21.4 Mitigation playbook per resource

**File downloads (the old first wall — retired by R2's zero egress fees, §0.5-R17):**
- Downloads are login-walled (PART 14): no anonymous scraping of the PDF corpus; crawlers index resource *metadata* pages, never file bytes. (Free egress does not mean free-for-all — the wall protects the corpus and the counting, not a bill.)
- R2 signed URLs expire in 120 s and are minted per-download through the counting redirect (§20.1) — no long-lived hotlinks in WhatsApp groups (people share the `/recursos/x` page, which is the growth loop we want, D11).
- No images in the MVP feed, no avatars (D2) — file traffic is *only* explicit downloads, and file bytes never touch Supabase or Vercel; HTML/assets ride Vercel's CDN.
- Public pages aggressively ISR-cached (§20.2) so read traffic hits Vercel's cache, keeping Supabase egress ≈ API JSON only (small).
- Telemetry: daily cron logs R2 storage bytes into `events`; the 70%-of-10-GB threshold alert emails the founder (D13). Egress needs no alert — R2 charges zero.
**R2 storage (third wall, after moderation labor and DB size — D13):**
- Caps: 10 MB/file, 3 files/resource, 100 MB/user quota, PDF + images only (PART 14). At caps, R2's free 10 GB ≈ 3,000+ typical resources — roughly four years of headroom at 1k MAU (§21.2).
- **The migration play is retired (§0.5-R17):** files live on R2 from the first upload, so no storage migration exists in the plan's future. At the 7 GB trigger the step is R2 paid storage at ~USD 0.015/GB-month — cents, not a platform move. `storage_path` stays provider-agnostic (PART 8), so even a future R2 exit is a bucket sync + one presigning module (§19.7), not a schema change.
**Database:**
- Post bodies are TOAST-compressed by Postgres automatically — long text is cheaper than it looks; the real inflators are indexes, tsvector, and log-shaped history. Actions: `events` stays day-bucketed aggregates only (D4) and is **kept forever** — ~KBs/year (§0.5-R11); the retention step instead purges `search_queries` (12 months), `download_log` (7 days), notifications (read 90 d / unread 180 d), stale `borrador` drafts (24 h), and cron history (§20.9); tsvector on posts+resources only (not comments, PART 13).
- At 350 MB (70%): fire the Pro trigger — DB size cannot be offloaded like files can (research note conclusion), so this trigger is not deferrable.
**Functions/bandwidth (Vercel):** ISR-for-anons discipline (§20.2) + matcher discipline (§20.5); no per-request middleware work beyond cookie handling. If invocations trend past 500k/mo, first response is widening ISR windows, not paying.
**Email:** invite waves ≤ 80/day; password-reset abuse rate-limited in-DB. Email notifications/digests stay P2 and land only with Resend Pro math done (3,000/mo ÷ 30 = a 100-user daily digest ceiling on free — digests effectively require Pro or batching by design, PART 12).
**Sentry:** per-key rate limit + `ignoreErrors` list; if a release starts erroring at volume, the kill switch is redeploying with the previous build (instant on Vercel), not raising the quota.

## 21.5 The keepalive cron [FREE-TIER RISK]

Supabase Free pauses projects after **1 week of inactivity** (verified 2026-08-13); a paused forum during the quiet January-February window (0.1's seasonality) would present as "the site died" to whoever visits first, and after 1 year unrestored the project is only downloadable, not restorable. Mitigation: the keepalive step of the daily Vercel aggregates cron (§20.9, §0.5-R16) performs a real authenticated PostgREST SELECT and inserts a heartbeat row. Daily-versus-weekly gives 6 days of failure margin; the cron's own failure alerts via Sentry (the handler reports if the DB call fails). Whether *internal* database activity alone (e.g. pg_cron) would count as "activity" for pausing purposes is **unverified** — the external API call is the safe interpretation, so the Vercel cron is the mechanism of record (§0.5-R16, pg_cron not load-bearing). The keepalive step is dropped the day the project moves to Pro (no pausing on Pro, verified 2026-08-13).

## 21.6 Pre-committed paid triggers and the cost ladder (D13)

Triggers are decided now so the future decision is mechanical, not emotional:

| Trigger (any one fires the step) | Step | New monthly total |
|---|---|---|
| — | Tier 0: Free everything; domain ~USD 15-40/yr is the only spend | **$0/mo** |
| DB > 350 MB (70% of 500 MB) · or auth-MAU pressure two consecutive months · or a real community exists and the no-backup/pausing risk is unacceptable **[HUMAN DECISION on this last, judgment-based one]** | **Supabase Pro** — 8 GB disk, daily backups (7-day retention), no pausing | **$25/mo** |
| R2 storage > 70% (7 GB) | + R2 paid storage (~USD 0.015/GB-mo above free — cents, §0.5-R17) | +~$0.05–0.50/mo |
| First peso of monetization (marketplace, donations, promoted anything — Vercel counts donations as commercial, verified 2026-08-13) · or bandwidth > 70 GB/mo · or need for >1-day crons/deploy gating | **+ Vercel Pro** | **$45/mo** |
| Email digests at > 100 recipients/day · or signup months > 3,000 emails | + Resend Pro (optional) | $65/mo |
| Error volume clips 5k/mo with real signal | + Sentry Team (optional, annual) | ~$91/mo |

The monetization plan (PART 31) must clear $45/mo before anything else — that is the entire fixed-cost bar for a functioning, backed-up, unpausable institution. R2 stays at ~$0 throughout (10 GB free; even 50 GB ≈ $0.60/mo).

## 21.7 The exit plan (brief §33) and the annual restore drill

The question "if Vercel and Supabase disappeared tomorrow, could we move?" must answer *yes, in under a day*, continuously, for ten years. Components:

1. **Data:** weekly encrypted `pg_dump` (schema + data incl. auth users) in the R2 backup bucket + the R2 serving bucket mirrored to it + the `resource_files` manifest CSV (§20.9). Recovery point objective: ≤ 7 days (acceptable for a forum; tightened to 24 h automatically when Pro's daily backups arrive).
2. **Code:** the repo is the app; `next build && next start` runs on any Node host. Vercel-specific behavior (ISR, tags, crons) degrades to dynamic rendering + system cron — slower, not broken.
3. **DNS:** the domain lives in the founder's own registrar account with DNS on Cloudflare's free tier from day 1 — repointing is minutes and requires no vendor's permission. The domain is the one asset that must never be held by a platform account. **[HUMAN DECISION: registrar account ownership, renewal auto-pay, and a second authorized contact.]**
4. **Rebuild-elsewhere runbook (the tested path — chosen: a ~$5/mo VPS + Coolify;** fly.io is the documented alternative if the VPS host itself is the thing that died): (a) provision VPS, install Coolify; (b) `docker compose up` Postgres 16 + restore `pg_restore` from the latest R2 dump; (c) deploy the Next app as a Coolify service with env vars from the matrix (§20.6); (d) auth: run self-hosted GoTrue (Supabase's open-source auth server) against the restored `auth` schema — bcrypt hashes restore user logins without resets; if GoTrue self-hosting has drifted, fallback is a one-time "restablecé tu contraseña" flow against the preserved emails ("Actualizamos la plataforma. Ingresá tu email para crear una nueva contraseña."); (e) file downloads already serve from R2 (§0.5-R17) — nothing to move; (f) flip DNS. Target: < 1 day, RPO ≤ 7 days.
5. **The annual restore drill — a calendar item, every February** (the seasonal lull, 0.1): restore the latest dump into the second free Supabase project (or a throwaway local stack), boot the app against it, log in as a drill user, open a post, download a file. Outcome recorded in `docs/decisions.md` (date, dump size, minutes to working, breakages found). An untested backup is a wish; this drill is what makes §33's promise real, and it doubles as the annual verification of the auth-schema export flagged in §20.9.

---

# PART 22 — PERFORMANCE

**Decision:** performance budgets are hard numbers gated in CI, and the strategy to meet them is architectural (server rendering, near-zero client JS, one-to-three indexed queries per route) rather than optimizational (we have no hero images to compress and no bundle to micro-split — the design refuses the weight in the first place). Brief §28's bar — "fast on average Argentine mobile connections" — is the p75 target device: a mid-range Android over 4G.

## 22.1 Budgets (binding; measured at p75 on emulated mid-range Android, 4G throttling)

| Metric | Budget | Where measured |
|---|---|---|
| LCP | **< 2.0 s** | `/`, `/materias/[slug]`, `/p/[id]` |
| INP | **< 200 ms** | vote tap, composer open, menu open |
| CLS | **< 0.1** | all routes (fonts + no-image layout make this nearly free) |
| Server TTFB, dynamic routes | **< 400 ms p75** | logged-in feed, `/p/[id]` (includes Supabase RTT) |
| Initial JS, feed routes | **< 90 KB gz** total | `/` logged-in |
| Initial JS, pure-content pages | **< 40 KB gz** target | `/p/[id]` logged-out, materia/carrera/legal pages |
| HTML document | < 30 KB gz | list pages at 25 items |
| Web font | ≤ 100 KB woff2 total, self-hosted | D8's single serif |
| DB queries per route render | ≤ 3 | enforced by the §22.3 inventory |

Honesty note on the < 40 KB line: the React + Next runtime floor is realistically ~45-55 KB gz on current versions, so "pure-content" pages meet 40 KB only where the route ships no client components and Next can serve it as fully static/ISR HTML whose JS is deferred and shared-cached across navigations (first *visit* cost, not per-page cost). The enforceable form of the budget: **zero route-level client JS on content pages — any client component on `/p/[id]`, materia, carrera, or legal pages beyond the shared shell (menu, theme toggle) fails review**; the Lighthouse CI transfer-size assertion holds the shell itself flat. If the framework floor makes 40 KB unreachable in measurement, the budget line moves to "framework floor + 0 KB feature JS" and the number is recorded — the discipline, not the absolute, is what compounds over 10 years.

## 22.2 Techniques mapped to the stack

- **RSC = no data-fetching JS.** Lists, pages, and metadata render server-side; the client never receives a JSON+hydrate+render waterfall. The §19.3 allowlist is the entire client surface.
- **Fonts:** system stack for UI (0 bytes); the one serif via `next/font` self-hosted subset (latin + ñ/áéíóú), `font-display: swap` with metric-compatible fallback to kill CLS. No icon font — Lucide imports are per-icon, tree-shaken.
- **No hero images to optimize:** the design (D8) has no user avatars (D2), no feed images (MVP), no decorative imagery. The image-optimization free-tier limit is designed out (§21.1), and LCP element is always text — which is why < 2.0 s is achievable on 4G at all.
- **Pagination:** 25 items/page everywhere (feed, materia tabs, search, comments beyond the first 25), keyset cursors (`created_at, id`), never `OFFSET` past page 2 — offset pagination degrades linearly and invites crawler-driven deep scans.
- **Count caches from PART 8:** `score`, `comments_count`, `downloads_count` are maintained columns — list rendering does zero aggregate queries. The daily aggregates cron audits drift (§20.9).
- **Covering/partial indexes + no N+1:** every list renders from one query against a `_public` view with author display fields denormalized into the view; per-row lookups are banned in review. The per-route inventory:

| Route | Queries (max 3) | Supporting index (PART 8 owns DDL) |
|---|---|---|
| `/` logged-in (Mis materias) | 1) bounded scored fetch (§0.5-R2): keyset window on `last_activity_at` desc via follows+carrera (~400 newest rows), scored in memory with PART 12's formula, top 25 returned · 2) viewer's vote state `IN (ids)` | `posts (materia_id, last_activity_at desc) where status='activo'`; `materia_follows (user_id)`; votes PK `(post_id, user_id)` |
| `/reciente` | 1) recent posts, pure chronological (§0.5-R2), limit 25 (+ vote state if logged in) | `posts (created_at desc) where status='activo'` |
| `/p/[publicId]` | 1) post by public_id · 2) comments ordered, limit 25 · 3) viewer vote states | unique `posts (public_id)`; `comments (post_id, created_at)` |
| `/materias/[slug]` | 1) materia row (counts cached) · 2) tab query: posts or resources limit 25 | unique `materias (slug)`; `posts (materia_id, last_activity_at desc)`; `resources (materia_id, created_at desc)` |
| `/carreras/[slug]` | 1) carrera + plan grid (join `plan_materias`) · 2) recent activity limit 10 | `plan_materias (carrera_id, año, cuatrimestre)` |
| `/recursos/[publicId]` | 1) resource + files (embed) · 2) viewer vote state | unique `resources (public_id)`; `resource_files (resource_id)` |
| `/u/[handle]` | 1) profile · 2) their **non-anonymous** content limit 25 | unique `profiles (handle)` citext; partial `posts (author_id, created_at desc) where not is_anonymous and status='activo'` |
| `/buscar` | 1) FTS ranked limit 20 (per-type tabs = separate visits) | GIN on stored tsvector (posts, resources, materias — PART 13) |
| `/avisos` | 1) notifications limit 25 · 2) mark-read on view | `notifications (user_id, created_at desc) where read_at is null` |

- **TTFB < 400 ms decomposition:** Vercel function cold/warm (~50-150 ms warm) + 1-3 pooled Supabase queries (< 30 ms each indexed, same-continent RTT ~10-40 ms via the pooler) + render (~20-50 ms). The budget dies if a route grows a 4th sequential query or an unindexed filter — hence the inventory is binding, and `explain analyze` output for each inventory query is checked into the repo once at S2 and re-checked when it changes.
- **Optimistic UI only where allowed:** vote buttons flip instantly and reconcile; the composer shows pending state. Nothing else is optimistic — mod actions, reports, and deletions always round-trip (correctness over feel where trust is involved).

## 22.3 The performance test ritual

- **Lighthouse CI on every PR** (`@lhci/cli`, GitHub Actions, ~3 min): runs against the Vercel preview URL on 3 pages — `/` logged-out, `/materias/derecho-constitucional` (seeded), one seeded `/p/[id]` — with mobile emulation + 4G throttling. Asserted budgets: LCP < 2.0 s, CLS < 0.1, TBT < 200 ms (CI proxy for INP), total transfer < 200 KB, script transfer per §22.1. Regression = red PR; the budget file lives in the repo and changing it is a reviewed decision like any migration.
- **Real-user check:** no RUM SDK at MVP (dependency + privacy budget); instead, the founder's monthly ritual (PART 24) includes WebPageTest or Chrome DevTools runs from an Argentine location, and Sentry's error rate stands in for availability. Vercel Web Analytics (50k events/mo free, verified 2026-08-13) may be enabled if its cookie-less model passes the PART 24 privacy bar — flagged there, not assumed here.
- **Load smoke, later and optional:** a k6 script (kept in `tools/`, run manually before each cuatrimestre launch from a local machine, never in CI) replaying the §22.3 inventory at exam-week concurrency (~50 concurrent users at 5k MAU scale) against the *staging* project — validates the shared-compute Postgres holds the TTFB budget before each seasonal peak. Not built until after public launch (S-phases are full, PART 28).

## 22.4 The Argentine network reality (why low-JS beats image tricks here)

The p75 student device is a mid-range Android (Moto G / Samsung A series class) on campus Wi-Fi or 4G; Argentine mobile 4G latency and campus-congestion variance matter more than raw bandwidth, and mid-range CPU JS parse/execute time is the dominant cost after the first load (exact national median throughput figures deliberately not cited — no verified source in the research notes; the design does not depend on them). Consequences, in order: (1) every KB of JS costs twice on these devices — download *and* parse/execute on a slow CPU — which is why the client-component allowlist is the plan's single highest-leverage performance decision; (2) 4G RTT variance (~50-150 ms+) punishes request waterfalls more than payload size, which is why RSC's single-round-trip render and the ≤ 3-query rule matter more than shaving HTML bytes; (3) the classic mobile-perf playbook (responsive images, srcset, AVIF pipelines) is ~irrelevant to a text-first product — our LCP is a text block over a system font. Fast-on-a-Moto-G is also an equity property of a student institution: the product must not assume this year's flagship phone, in 2026 or in 2036.

---

## DISSENT — R2 for PDFs from day one

**RESOLVED — ACCEPTED (§0.5-R17).** The lead adopted R2 from the first upload; the parts above now reflect it (Supabase Storage unused in MVP). The original dissent text is preserved below for the record.

The research notes (2026-08-13) rank Supabase egress+storage as the #1 breakage and recommend serving PDFs from Cloudflare R2 (10 GB, zero egress) from day one. Spine D6/D13 instead choose Supabase Storage at MVP with R2 as the pre-planned migration play, accepting that the D13 trigger likely fires during year one at 1k MAU (§21.2-21.4). I comply — the integrated path is one fewer credential/service for a solo developer at beta scale, and §21.4's dual-write play caps the migration at 1-2 days. But the counterargument deserves the record: R2-from-day-one costs perhaps two extra days in S2 (presigned-URL module against R2 instead of Supabase Storage — the download-redirect architecture in §20.1 is identical either way) and would eliminate the most probable [FREE-TIER RISK] *and* the most probable $25 trigger entirely, potentially keeping the platform at $0 through several thousand MAU. If S2 runs ahead of schedule, I recommend the lead reconsider flipping the storage backend then, while zero files exist and no dual-write window is needed.
