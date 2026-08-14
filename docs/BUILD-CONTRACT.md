# BUILD CONTRACT — uca.net

> Interface contract for the implementation build. Every agent/session writing code MUST conform.
> The plan (`docs/plan/`) says _what_ to build; this file pins the _exact_ module boundaries so
> independently written files compile together. When this file and the plan disagree on a
> mechanism, the plan wins and this file gets fixed. When this file pins a name, the name is binding.

## 0. Pinned versions and version-specific rules

| Package                 | Version   | Rule                                                                                                                                                                                                                                                |
| ----------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `next`                  | 16.3.0    | App Router. **`middleware.ts` is deprecated in Next 16** — the root file is **`proxy.ts`** with `export default async function proxy(request: NextRequest)` plus `export const config = { matcher: [...] }`.                                        |
| `react` / `react-dom`   | 19.2.8    | Server Components by default. `'use client'` only for the PART 19 §19.3 allowlist.                                                                                                                                                                  |
| `typescript`            | 5.x       | `strict` + `noUncheckedIndexedAccess`. Indexed access returns `T \| undefined` — handle it.                                                                                                                                                         |
| `tailwindcss`           | 4.3.3     | CSS-first. The only theme config is the `@theme inline` block in `app/globals.css`. No `tailwind.config.*`.                                                                                                                                         |
| `zod`                   | **4.4.3** | Zod **4** API: top-level formats `z.email()`, `z.url()`, `z.uuid()` (NOT `z.string().email()`). Read errors via `result.error.issues` — do **not** use `.flatten()` or `.format()`. Custom messages: `z.string().min(3, 'copy es-AR')` still works. |
| `@supabase/ssr`         | 0.12.4    | `createServerClient` / `createBrowserClient` with the `getAll`/`setAll` cookie adapter. The old `get/set/remove` adapter is removed.                                                                                                                |
| `@supabase/supabase-js` | 2.112.3   | Typed via `Database` from `lib/types.gen.ts`.                                                                                                                                                                                                       |
| `lucide-react`          | 1.31.0    | Per-icon named imports only.                                                                                                                                                                                                                        |
| `nanoid`                | 6.0.1     | ESM. Use `customAlphabet` in `lib/utils/public-id.ts`.                                                                                                                                                                                              |

**Next 16 async APIs (mandatory):** `cookies()`, `headers()`, `draftMode()` return Promises — always `await`. Route `params` and `searchParams` are Promises:

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

`generateMetadata` receives the same Promise-shaped props. Route handlers: `export async function GET(request: Request, { params }: { params: Promise<{ id: string }> })`.

## 1. Language and copy rules (D9, D14.6)

- **Every user-visible string is es-AR with voseo.** "Publicá", "Ingresá", "Comentá", "Seguí", "Reportá". No English UI text anywhere, not even placeholders or `aria-label`s.
- Code identifiers, comments, file names, commit messages: English is allowed, Spanish comments are allowed. Be consistent within a file.
- Database object names follow D9's mixed convention (Spanish domain nouns, English mechanics) — PART 8 names are binding, verbatim.
- No emoji in UI chrome. No exclamation-mark enthusiasm. Sober, direct.
- Footer disclaimer on every page, from `FOOTER_DISCLAIMER` in `lib/config.ts`.

## 2. Repository layout (PART 27 §27.1, binding)

```
app/  components/ui/  features/<domain>/  lib/  supabase/  e2e/  docs/  scripts/  public/  .github/workflows/
proxy.ts            # root — Next 16 middleware replacement
```

Import boundaries (ESLint-enforced, `eslint.config.mjs` already written):

| From ↓ may import → | app   | features             | components/ui | lib |
| ------------------- | ----- | -------------------- | ------------- | --- |
| `app/`              | —     | yes                  | yes           | yes |
| `features/*`        | never | **own feature only** | yes           | yes |
| `components/ui/`    | never | never                | yes           | yes |
| `lib/`              | never | never                | never         | yes |

Cross-feature needs get promoted to `lib/` — there is no `features/shared/`, ever.
Every `actions.ts` and `queries.ts` starts with `import 'server-only'` (after the `'use server'` directive in actions).

## 3. Modules already written (DO NOT recreate; import from these)

```ts
// lib/config.ts
export const SITE_NAME: string                  // 'uca.net' — the single naming constant (D10)
export const SITE_NAME_PARTS: { head: string; tld: string }
export const SITE_TAGLINE: string
export const SITE_DESCRIPTION: string
export const FOOTER_DISCLAIMER: string
export const PAGE_SIZE: number                  // 25
export const LIMITS: { postTitle: 120; postBody: 10000; commentBody: 5000; resourceTitleMin: 8;
  resourceTitle: 120; resourceDescription: 2000; reportDetail: 1000; appealBody: 2000;
  handleMin: 3; handleMax: 24; passwordMin: 10; fileMaxBytes: number; filesPerResource: 3;
  userQuotaBytes: number; commentDepthMax: 2 }
export const ACCEPTED_MIME: readonly ['application/pdf','image/jpeg','image/png','image/webp']
export type AcceptedMime

// lib/env.ts  (safe to import from client code)
export const publicEnv: { NEXT_PUBLIC_SUPABASE_URL: string; NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  NEXT_PUBLIC_SITE_URL: string; NEXT_PUBLIC_SENTRY_DSN?: string }
export function assertSupabaseEnv(): void
export const siteUrl: string                     // no trailing slash
export function absoluteUrl(path: string): string

// lib/env.server.ts  ('server-only')
export function getServiceRoleKey(): string      // ONLY app/api/cron/* and scripts
export function getCronSecret(): string
export function getR2Config(): R2Config          // { accountId, accessKeyId, secretAccessKey, bucket, endpoint }
export function hasR2Config(): boolean
export type R2Config

// lib/result.ts
export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string; field?: string }
export function ok(): ActionResult<undefined>
export function ok<T>(data: T): ActionResult<T>
export function fail<T = undefined>(error: string, field?: string): ActionResult<T>

// lib/errors.ts
export type RpcErrorCode                          // 'RATE_LIMIT' | 'THREAD_LOCKED' | ... (see file)
export const RPC_ERROR_CODES: readonly RpcErrorCode[]
export const GENERIC_ERROR: string
export function rpcErrorMessage(error: PostgrestError | Error | null | undefined): string
export function messageForCode(code: RpcErrorCode): string
```

Design tokens live in `app/tokens.css`; Tailwind utilities are generated from them in `app/globals.css`.
**Use only token-derived utilities**: `bg-bg`, `bg-surface-raised`, `text-text-primary`, `text-text-secondary`,
`text-accent`, `border-border`, `rounded-input`, `rounded-container`, `text-s`, `text-m`, `text-base`, `text-l`,
`text-xl`, `text-2xl`, `font-serif`, `shadow-overlay`. Spacing utilities snap to the 4px base (`p-3` = 12px,
`gap-4` = 16px, `py-6` = 24px). **Arbitrary values (`text-[17px]`, `bg-[#fff]`) are forbidden.**

## 4. Modules to be written — exact signatures

### 4.1 `lib/types.gen.ts`

Hand-authored to match `supabase/migrations/*.sql` exactly (no Docker in this environment, so
`supabase gen types` cannot run — it is regenerated for real in CI). Must export in the shape
`supabase gen types typescript` produces so it can be swapped 1:1:

```ts
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]
export type Database = {
  public: {
    Tables: {/* every table: Row / Insert / Update / Relationships */}
    Views: {
      /* posts_public, comments_public, resources_public, resource_files_public, profiles_public */
    }
    Functions: {/* every RPC: Args / Returns */}
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
  }
}
// Convenience aliases used across the app:
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
export type Views<T extends keyof Database['public']['Views']> =
  Database['public']['Views'][T]['Row']
export type PostPublic = Views<'posts_public'>
export type CommentPublic = Views<'comments_public'>
export type ResourcePublic = Views<'resources_public'>
export type ResourceFilePublic = Views<'resource_files_public'>
export type ProfilePublic = Views<'profiles_public'>
```

Postgres → TS mapping: `bigint`→`number`, `smallint`/`int`→`number`, `text`/`citext`→`string`,
`timestamptz`→`string`, `boolean`→`boolean`, `uuid`→`string`, `text[]`→`string[]`, `jsonb`→`Json`,
`tsvector`→`unknown`, nullable columns→`| null`. Columns with defaults are optional in `Insert`.

### 4.2 `lib/supabase/*`

```ts
// lib/supabase/server.ts   ('server-only')
export async function createClient(): Promise<SupabaseClient<Database>>
export async function getUser(): Promise<User | null> // supabase.auth.getUser()
export async function getProfile(): Promise<ProfileRow | null> // own row from `profiles`, or null
export async function requireUser(): Promise<User> // redirect('/ingresar') when absent
export async function requireProfile(): Promise<ProfileRow> // redirect('/registro/continuar') when status='nuevo'
export async function requireMod(): Promise<ProfileRow> // redirect('/') unless role in ('mod','admin')
export type ProfileRow = Database['public']['Tables']['profiles']['Row']

// lib/supabase/browser.ts   (client-safe)
export function createClient(): SupabaseClient<Database>

// lib/supabase/middleware.ts   ('server-only')
export async function updateSession(request: NextRequest): Promise<NextResponse>

// lib/supabase/admin.ts   ('server-only')
export function createAdminClient(): SupabaseClient<Database> // service-role; cron/scripts ONLY
```

`getProfile()` reads the caller's own `profiles` row (the self-read RLS policy allows exactly this).
Never `select('*')` from base content tables — reads go through the `_public` views.

### 4.3 `lib/utils/*` and other `lib` modules

```ts
// lib/cn.ts
export function cn(...classes: Array<string | false | null | undefined>): string

// lib/utils/slug.ts        — must match the SQL slug rule: ^[a-z0-9]+(-[a-z0-9]+)*$, ≤80 chars
export function slugify(input: string): string
export function isSlug(value: string): boolean

// lib/utils/public-id.ts   — alphabet '23456789abcdefghjkmnpqrstuvwxyz' (31 chars), matches public.nanoid()
export function newPublicId(size?: number): string // default 10
export function newInviteCode(): string // size 8
export function isPublicId(value: string): boolean // ^[a-z0-9]{10}$

// lib/utils/dates.ts       — es-AR, timezone America/Argentina/Buenos_Aires
export function relativeTime(iso: string): string // 'hace 3 h', 'hace 2 días'
export function formatDate(iso: string): string // '14 de marzo de 2027'
export function formatMonthYear(iso: string): string // 'marzo de 2027'
export function isoDay(iso: string): string // '2027-03-14'

// lib/utils/text.ts
export function truncate(text: string, max: number): string
export function excerpt(text: string, max?: number): string // collapses newlines, default 200

// lib/theme.ts             ('server-only' NOT required — read helpers are server-side)
export type Theme = 'auto' | 'claro' | 'oscuro'
export const THEME_COOKIE = 'theme'
export async function getTheme(): Promise<Theme> // reads cookie via next/headers
export function themeAttribute(theme: Theme): 'light' | 'dark' | undefined

// lib/analytics.ts         ('server-only') — PART 24 allowlists, aggregate only, no free text
export type EventName = /* closed union, see file */ string
export async function trackEvent(name: EventName, dim?: string): Promise<void> // never throws

// lib/r2.ts                ('server-only') — §0.5-R17, S3 API against Cloudflare R2
export function quarantineKey(uploadId: string): string // `incoming/${uploadId}`
export function finalKey(resourcePublicId: string, fileId: string, ext: string): string
export async function presignPut(
  key: string,
  contentType: string,
  expiresIn?: number,
): Promise<string>
export async function presignGet(
  key: string,
  downloadName: string,
  expiresIn?: number,
): Promise<string>
export async function moveObject(fromKey: string, toKey: string): Promise<void>
export async function deleteObject(key: string): Promise<void>
export async function headObject(key: string): Promise<{ size: number; contentType: string } | null>

// lib/ip-curtain.ts        — PART 20 §20.5 coarse in-memory token bucket for proxy.ts
export function shouldThrottle(ip: string, isMutation: boolean): boolean
```

Signed-URL TTL is **120 s** everywhere (§0.5-R12/R17).

### 4.4 `components/ui/*` — the PART 18 §18.4 inventory

All are Server Components unless marked `'use client'`. Every component accepts `className?: string`
and spreads remaining native props where sensible.

```ts
button.tsx        export function Button(props: { variant?: 'primary'|'secondary'|'tertiary'|'danger';
                    pending?: boolean; pendingLabel?: string } & ButtonHTMLAttributes<HTMLButtonElement>)
                  export function ButtonLink(props: { variant?: ... } & AnchorHTMLAttributes<HTMLAnchorElement> & { href: string })
                  export function SubmitButton(...)   // 'use client', uses useFormStatus
field.tsx         export function Field(props: { label: string; htmlFor: string; error?: string;
                    hint?: string; children: ReactNode; required?: boolean })
input.tsx         export function Input(props: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean })
textarea.tsx      export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean })
select.tsx        export function Select(props: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean })
checkbox.tsx      export function Checkbox(props: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string })
chip.tsx          export function Chip(props: { variant?: 'accent'|'neutral'; href?: string;
                    onRemove?: () => void; children: ReactNode })
list-row.tsx      export function ListRow(props: { href: string; title: ReactNode; meta?: ReactNode;
                    trailing?: ReactNode; children?: ReactNode })
tabs.tsx          export function Tabs(props: { items: Array<{ href: string; label: string }>; activeHref: string })
badge.tsx         export function Badge(props: { count: number; label: string })   // '9+' cap
empty-state.tsx   export function EmptyState(props: { title: string; description?: string; action?: ReactNode })
pagination.tsx    export function Pagination(props: { prevHref?: string; nextHref?: string })
breadcrumb.tsx    export function Breadcrumb(props: { items: Array<{ href?: string; label: string }> })
table.tsx         export function Table / TableHead / TableBody / TableRow / TableCell / TableHeaderCell
wordmark.tsx      export function Wordmark(props: { className?: string })   // uses SITE_NAME_PARTS
dialog.tsx        'use client' — export function Dialog(props: { trigger: ReactNode; title: string;
                    description?: string; children: ReactNode; open?: boolean; onOpenChange?: (o: boolean) => void })
                  export { DialogClose }
menu.tsx          'use client' — export function Menu(props: { trigger: ReactNode;
                    items: Array<{ label: string; href?: string; onSelect?: () => void; danger?: boolean }> })
toast.tsx         'use client' — export function ToastProvider({ children }), export function useToast(): { show(msg: string, action?: {label: string; onClick(): void}): void }
```

Visual spec is PART 18 §18.4 — heights (36px controls, 44px touch on mobile), radii (2px inputs,
4px containers), 1px hairlines, no shadows except `shadow-overlay` on menus/dialogs/toasts.

### 4.5 Feature modules — exported API (binding names)

Reads return plain typed objects; writes return `ActionResult`. All list reads take
`{ cursor?: string; limit?: number }` and return `{ items: T[]; nextCursor: string | null }`
using **keyset** cursors (`created_at,id` base64), never OFFSET.

```ts
// features/auth/queries.ts
getInvite(code: string): Promise<{ valid: boolean; reason?: string }>
getSettings(): Promise<{ profile: ProfileRow; carreras: CarreraOption[]; canRename: boolean; renameAvailableAt: string | null }>
// features/auth/actions.ts
signUp(prev, formData): Promise<ActionResult>            // useActionState-compatible
signIn(prev, formData): Promise<ActionResult>
signOutAction(): Promise<void>
completeOnboarding(prev, formData): Promise<ActionResult>
requestPasswordReset(prev, formData): Promise<ActionResult>
updatePassword(prev, formData): Promise<ActionResult>
renameHandle(prev, formData): Promise<ActionResult>
updateNotificationPrefs(prev, formData): Promise<ActionResult>
deleteAccount(prev, formData): Promise<ActionResult>
joinWaitlist(prev, formData): Promise<ActionResult>
// features/auth/schemas.ts — signUpSchema, signInSchema, onboardingSchema, handleSchema,
//   passwordSchema, recoverSchema, resetPasswordSchema, waitlistSchema, deleteAccountSchema

// features/posts/queries.ts
getPost(publicId: string): Promise<PostDetail | null>
getComments(postId: number, opts?): Promise<{ items: CommentNode[]; nextCursor: string | null }>
getViewerPostVotes(postIds: number[]): Promise<Set<number>>
getViewerCommentVotes(commentIds: number[]): Promise<Set<number>>
getPostsByAuthor(handle: string, opts?): Promise<{ items: PostListItem[]; nextCursor: string | null }>
// features/posts/actions.ts
createPost(prev, formData): Promise<ActionResult<{ publicId: string }>>
createComment(prev, formData): Promise<ActionResult<{ publicId: string }>>
updatePost / updateComment / deletePost / deleteComment (prev, formData): Promise<ActionResult>
togglePostVote(publicId: string): Promise<ActionResult<{ score: number; voted: boolean }>>
toggleCommentVote(publicId: string): Promise<ActionResult<{ score: number; voted: boolean }>>

// features/feed/queries.ts
getMisMateriasFeed(opts?): Promise<{ items: PostListItem[]; nextCursor: string | null }>
getRecentFeed(opts?): Promise<{ items: PostListItem[]; nextCursor: string | null }>

// features/materias/queries.ts
listMaterias(q?: string): Promise<MateriaListItem[]>
getMateria(slug: string): Promise<MateriaDetail | null>
getMateriaPosts(materiaId: number, opts?) / getMateriaResources(materiaId: number, opts?)
getCarrera(slug: string): Promise<CarreraDetail | null>          // includes plan grid rows
getFacultad(slug: string): Promise<FacultadDetail | null>
getFollowedMateriaIds(): Promise<number[]>
isFollowing(materiaId: number): Promise<boolean>
// features/materias/actions.ts
toggleFollow(materiaId: number): Promise<ActionResult<{ following: boolean }>>

// features/recursos/queries.ts
listResources(opts?: { materiaId?: number; tipo?: string; cursor?: string }): Promise<{ items: ResourceListItem[]; nextCursor: string | null }>
getResource(publicId: string): Promise<ResourceDetail | null>
getQuotaUsage(): Promise<{ usedBytes: number; limitBytes: number }>
// features/recursos/actions.ts
createResourceDraft(prev, formData): Promise<ActionResult<{ publicId: string; uploads: PresignedUpload[] }>>
finalizeResource(prev, formData): Promise<ActionResult<{ publicId: string }>>
deleteResource(prev, formData): Promise<ActionResult>
toggleResourceVote(publicId: string): Promise<ActionResult<{ score: number; voted: boolean }>>

// features/search/queries.ts
searchAll(q: string, tipo?: 'todo'|'publicaciones'|'recursos'|'materias'): Promise<SearchResults>
suggestMaterias(q: string): Promise<Array<{ slug: string; nombre: string }>>

// features/notifications/queries.ts
listNotifications(opts?): Promise<{ items: NotificationItem[]; nextCursor: string | null }>
getUnreadCount(): Promise<number>
// features/notifications/actions.ts
markAllRead(): Promise<ActionResult>

// features/mod/queries.ts
getReportQueue(status?): Promise<ReportQueueItem[]>
getReportDetail(id: number): Promise<ReportDetail | null>
listAppeals(status?): Promise<AppealItem[]>
listRestrictions(): Promise<RestrictionItem[]>
getModActionsForUser(handle: string): Promise<ModActionItem[]>
// features/mod/actions.ts
createReport(prev, formData): Promise<ActionResult>
createAppeal(prev, formData): Promise<ActionResult>
modRemoveContent / modRestoreContent / modWarnUser / modRestrictUser / modRevokeRestriction /
modLockThread / modRevealAuthor / modResolveReport / modReviewAppeal / modLegalTakedown /
createInvite  (prev, formData): Promise<ActionResult>

// features/analytics/queries.ts
getMetrics(): Promise<{ daily: Array<{ day: string; name: string; count: number }>; totals: Record<string, number> }>
```

`PostListItem`, `PostDetail`, `CommentNode`, etc. are exported from the same `queries.ts` that
produces them (or a sibling `types.ts` inside the feature). Never redefine a feature's type elsewhere.

### 4.6 Actions: the mandatory five steps (PART 20 §20.4)

Every Server Action, in order:

1. `const parsed = schema.safeParse(...)` → on failure `return fail(parsed.error.issues[0]?.message ?? GENERIC_ERROR)`
2. read the session (`getUser()` / `requireProfile()` equivalents; never trust the client)
3. call **exactly one** RPC or policy-guarded write via the typed client
4. `revalidateTag(...)` / `revalidatePath(...)` as the last step, after the write commits
5. `return ok(...)` or `return fail(rpcErrorMessage(error))`

Actions never contain SQL strings. Cache tags (binding vocabulary): `materia:<slug>`,
`post:<publicId>`, `recurso:<publicId>`, `carrera:<slug>`, `catalog`.

Form actions used with `useActionState` have the signature
`(prevState: ActionResult | null, formData: FormData) => Promise<ActionResult>`.

## 5. Database contract

Migration files live in `supabase/migrations/` with CLI-format names
`YYYYMMDDHHMMSS_snake_description.sql`. The canonical set (PART 8 §8.10.1), with the exact
filenames this build uses:

| Ordinal | Filename                                    | Content                                                                                                                                         |
| ------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 0001    | `20260901000001_extensions_and_helpers.sql` | extensions, default-privilege revokes, `nanoid()`, `public.es` FTS config, `f_unaccent()`, `set_updated_at`, `raise_immutable`, `rate_limits()` |
| 0002    | `20260901000002_academic_catalog.sql`       | universidades, sedes, facultades, carreras, materias, plan_materias + read_all policies                                                         |
| 0003    | `20260901000003_invites_and_waitlist.sql`   | invites (no created_by FK yet), waitlist                                                                                                        |
| 0004    | `20260901000004_profiles_and_handles.sql`   | profiles, handle_history, handle_blocklist, `handle_new_user` trigger, invites FK backfill                                                      |
| 0005    | `20260901000005_posts_and_comments.sql`     | posts, comments, anon_aliases                                                                                                                   |
| 0006    | `20260901000006_votes_and_follows.sql`      | post_votes, comment_votes, materia_follows                                                                                                      |
| 0007    | `20260901000007_resources.sql`              | resources, resource_files, **resource_votes** (its FK needs `resources`), download_log                                                          |
| 0008    | `20260901000008_safety.sql`                 | reports, mod_actions (+ immutability trigger), user_restrictions, appeals                                                                       |
| 0009    | `20260901000009_system.sql`                 | notifications, events, search_queries, app_settings                                                                                             |
| 0010    | `20260901000010_public_views.sql`           | the five `_public` views + grants                                                                                                               |
| 0011a   | `20260901000011_rpc_core.sql`               | identity + content + vote + search RPCs                                                                                                         |
| 0011b   | `20260901000012_rpc_moderation.sql`         | report/appeal/moderation/invite RPCs                                                                                                            |
| 0012    | `20260901000013_scheduled_jobs.sql`         | `reconcile_counters`, `purge_retention`                                                                                                         |

(0011 is split into two files for reviewability; the conceptual ordinal set of PART 8 is unchanged.
Recorded in `docs/decisions.md`.)

Non-negotiables for every migration file:

- `alter table ... enable row level security;` on **every** table.
- `COMMENT ON TABLE/COLUMN` for every table and every non-obvious column (tenet 10).
- Every function: `security definer`, `set search_path = public, pg_temp`,
  `revoke execute on function ... from public, anon;` then explicit `grant execute ... to authenticated`
  (`anon` only for `track_event` and the `search_*` functions).
- Errors: `raise exception '<CODE>'` using only codes from `RPC_ERROR_CODES` in `lib/errors.ts`.
- No `create type ... as enum` — text + named CHECK constraints (§8.2.2).
- Idempotent-ish guards where harmless (`create extension if not exists`), but migrations are
  forward-only and never edited after merge.

Seeds: `supabase/seed/catalog/*.sql` (idempotent upserts on slug, from APPENDIX A) and
`supabase/seed.sql` (local dev fixtures only, never prod). pgTAP tests in `supabase/tests/NN_topic.sql`.

## 6. Routing contract (D7 — the URL map is a 10-year promise)

```
/                         app/(public)/page.tsx          ("Para vos" con sesión; landing §17.3 sin ella)
/mis-materias             app/(public)/mis-materias/page.tsx                (requiere sesión, noindex)
/reciente                 app/(public)/reciente/page.tsx
/tendencias               app/(public)/tendencias/page.tsx                  (sin paginación: 25 filas)
/guardados                app/(me)/guardados/page.tsx                       (requiere sesión, noindex)
/materias                 app/(public)/materias/page.tsx
/materias/[slug]          app/(public)/materias/[slug]/page.tsx
/carreras/[slug]          app/(public)/carreras/[slug]/page.tsx
/facultades/[slug]        app/(public)/facultades/[slug]/page.tsx
/p/[publicId]             app/(public)/p/[publicId]/[[...slug]]/page.tsx   (slug suffix ignored)
/recursos                 app/(public)/recursos/page.tsx
/recursos/subir           app/(public)/recursos/subir/page.tsx
/recursos/[publicId]      app/(public)/recursos/[publicId]/page.tsx
/recursos/[publicId]/descargar   app/(public)/recursos/[publicId]/descargar/route.ts   (302 → signed R2 URL)
/u/[handle]               app/(public)/u/[handle]/page.tsx                  (noindex)
/buscar                   app/(public)/buscar/page.tsx
/acerca /reglas /terminos /privacidad   app/(public)/<name>/page.tsx        (static)
/apelacion                app/(public)/apelacion/page.tsx                   (auth required)
/ingresar /registro /registro/continuar /recuperar /invitacion/[code]   app/(auth)/...
/avisos /ajustes /guardados                 app/(me)/...
/mod /mod/reportes/[id] /mod/apelaciones /mod/usuarios /mod/metricas   app/(mod)/mod/...
/auth/callback (GET) /auth/signout (POST)   app/auth/...
/api/health /api/cron/aggregates            app/api/...
/sitemap.xml /robots.txt  app/sitemap.ts, app/robots.ts
```

Las cuatro pestañas de feed (`/`, `/mis-materias`, `/reciente`, `/tendencias`) son URLs
propias y las pestañas son enlaces, no un widget de JS: es lo que hace que el back del
navegador y el compartir funcionen (§12.1). La ampliación del mapa —las tres rutas nuevas y
el cambio de significado de `/` con sesión— está registrada en `docs/decisions.md`; ninguna
URL vieja se rompió.

Rendering per PART 20 §20.2: `export const revalidate = <seconds>` on ISR routes;
`export const dynamic = 'force-dynamic'` on `/avisos`, `/ajustes`, `/guardados`,
`/mis-materias`, `/mod/*`, `/buscar`.
Deleted content renders an **HTTP 410** tombstone page, not a 404 (§0.5-R23c).

## 7. Security rules that fail review if broken (D14)

1. No `supabase.from()` outside `features/*/queries.ts`, `features/*/actions.ts`, and `lib/supabase/*`.
2. Public content reads go through the `_public` views only. Never select `author_id` or `is_anonymous`+author together for public rendering.
3. Internal `bigint` ids never reach the browser. URLs and payloads carry `public_id`/slug only.
4. `SUPABASE_SERVICE_ROLE_KEY` is read only inside `app/api/cron/*` (via `lib/supabase/admin.ts`). Nothing else imports `admin.ts`.
5. Every mutation Zod-validates server-side, whatever the client already checked.
6. Rate limits live in the SQL functions; the middleware curtain is best-effort only.
7. Every feature ships its moderation surface: reportable, removable, audited.
8. No new npm dependency without a `docs/decisions.md` entry. The installed set is final for MVP.

## 8. Accessibility and performance floor

- Server Components by default; `'use client'` only for: composer, vote button, dropdown menu,
  dialog, search typeahead, theme toggle, file-upload field (PART 19 §19.3 — the complete allowlist).
- Content pages (`/p/[id]`, materia, carrera, legal) ship **zero route-level client JS** beyond the shared shell.
- Every interactive element is keyboard reachable with a visible focus ring (the global
  `:focus-visible` rule in `globals.css`).
- Icons always paired with a visible label or `aria-label` in es-AR.
- Forms: `<label>` bound with `htmlFor`, errors wired via `aria-describedby`, `aria-invalid` on error.
- Tabs are links, not JS widgets. `<details>` for collapsibles. Native `<select>`.
- No layout-shifting skeletons on the critical path; no images in MVP.
