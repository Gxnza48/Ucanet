# PART 8 — DATABASE DESIGN

**Decision.** One PostgreSQL database (Supabase), 29 tables, 5 public read views, ~25 SQL functions, RLS on every table, delivered as the S0 migration set. This part is written so a developer can produce migration 0001 directly from it: every table below carries its full column list, constraints, indexes, RLS posture, deletion behavior, and MVP status (brief §21 duty). Names and mechanics are bound by spine D4/D5; nothing here re-litigates them.

## 8.1 Design tenets

These ten tenets govern every object in the schema. They are restated from spine D4/D5 in enforceable form; each has a pgTAP-testable consequence.

1. **RLS everywhere.** Every table — including read-only catalog tables — has `enable row level security`. A table with no policies is deliberately inaccessible to `anon`/`authenticated` (e.g. `anon_aliases`). No exceptions; the pgTAP suite asserts `relrowsecurity = true` for all public tables.
2. **No polymorphic type/id pairs.** Multi-target tables (`reports`, `mod_actions`, `notifications`) use one nullable FK per possible target plus a `CHECK (num_nonnulls(...) = 1)`. Referential integrity stays native; joins stay indexable; `ON DELETE` behavior stays per-target.
3. **Public identity is nanoid or slug, never a sequence.** Internal PKs are `bigint identity` (or the auth UUID for profiles). Anything that appears in a URL or API payload is a `public_id` (nanoid, 10 chars, unambiguous lowercase alphabet) or a slug (D7). Sequence IDs never leave the server (D14.7).
4. **Soft-delete via status, hard-delete only via retention jobs.** User and mod deletions are status transitions (`eliminado_autor`, `eliminado_mod`) with bodies nulled where privacy demands; physical `DELETE` happens only in scheduled purge functions (§8.7). Thread structure survives deletions.
5. **Anonymity is enforced in the database, not the app.** Author columns of anonymous content are stripped inside the `_public` views (§8.4); base content tables grant no SELECT to `anon`/`authenticated`. A frontend bug cannot leak what the database never emits (D14.5).
6. **Writes are functions, not table grants.** All multi-step or invariant-carrying writes (post creation, alias assignment, votes, reports, mod actions) are SECURITY DEFINER functions with pinned `search_path` that validate status, restrictions, and rate limits in-database (D14.9). INSERT/UPDATE grants on content base tables: none.
7. **Counters are cached columns, function-maintained, job-reconciled.** `score`, `comments_count`, `downloads_count`, `karma` are plain integer columns updated inside the same RPC transaction that causes the change, and recomputed nightly by a reconciliation job (§8.5.6). Trade-off in §8.2.5.
8. **Every table gets `created_at timestamptz not null default now()`.** History is the product (brief §2); rows without timestamps cannot feed the archive or the size model.
9. **Portability over cleverness.** No enum types, no third-party ORM artifacts, no Supabase-only column types in domain tables. `pg_dump` of this schema must restore on vanilla PostgreSQL with only `citext`, `unaccent`, `pgcrypto` available (brief §33, §58). Supabase-specific surfaces (auth hooks, cron endpoints) are isolated in clearly marked migration sections; resource files live on Cloudflare R2, outside the database entirely (§0.5-R17).
10. **The schema is documented in the schema.** Every table and non-obvious column gets a `COMMENT ON` in the migration. AI-assisted development (brief §43) reads the catalog; comments are the cheapest guardrail against invented fields (D14).

## 8.2 Schema-wide conventions

### 8.2.1 Identifier strategy

- Internal PK: `bigint generated always as identity` for all tables except `profiles` (PK = the Supabase auth UUID) and pure join tables (composite PKs).
- Public ID: `public_id text not null unique default public.nanoid()` on `posts`, `comments`, `resources`. Slug-addressed catalog tables (`materias`, `carreras`, `facultades`, `sedes`, `universidades`) use the slug as their public identity; `invites` use `code`.
- The nanoid function ships in migration 0001 (requires `pgcrypto`):

```sql
create or replace function public.nanoid(size int default 10)
returns text
language sql
volatile
as $$
  select string_agg(
    substr('23456789abcdefghjkmnpqrstuvwxyz',
           (get_byte(extensions.gen_random_bytes(1), 0) % 31) + 1, 1), '')
  from generate_series(1, size);
$$;
```

31-character alphabet (no `0/1/i/l/o` — D7), 31^10 ≈ 8.2 × 10^14 combinations; collision risk is handled by the UNIQUE constraint plus a single retry inside creating RPCs. The modulo bias (256 mod 31 = 8) is cosmetically imperfect and cryptographically irrelevant here; these are locators, not secrets.
- Slug format everywhere: `^[a-z0-9]+(-[a-z0-9]+)*$`, max 80 chars, enforced by CHECK.

### 8.2.2 Enumerations: text + CHECK, not Postgres enums

**Considered:** native `CREATE TYPE ... AS ENUM` / **Chosen:** `text` columns with named CHECK constraints / **Why:** (a) evolution — adding a value is `ALTER TABLE ... DROP CONSTRAINT, ADD CONSTRAINT` in one transactional migration, and removing or renaming a value is possible at all (native enums cannot drop values); (b) portability — dump/restore and diff tooling treat text trivially (tenet 9); (c) one pattern for AI-assisted dev instead of two (D14.8 spirit). / **Cost:** ~3–8 bytes/row more than an enum's 4, and the CHECK must be repeated per table — both negligible at our scale (§8.9), and the repeated CHECKs are generated from one documented list in the migration.

Status vocabularies (binding):

| Domain | Values |
|---|---|
| `posts.status`, `comments.status` | `activo`, `eliminado_autor`, `eliminado_mod` |
| `resources.status` | `borrador`, `activo`, `pendiente`, `eliminado_autor`, `eliminado_mod`, `retirado_legal` |
| `profiles.status` | `nuevo`, `activo`, `suspendido`, `baneado`, `eliminado` |
| `profiles.role` | `user`, `mod`, `admin` |
| `reports.status` | `abierto`, `en_revision`, `resuelto`, `desestimado`, `resuelto_duplicado` |
| `posts.kind` | `texto`, `pregunta` |
| `resources.tipo` | `resumen`, `apunte`, `parcial`, `final`, `guia`, `otro` |

`resources` carries three extra statuses: `borrador` (draft between `request_upload` and `finalize_upload` — drafts older than 24 h are purged, §0.5-R12), `pendiente` (pre-moderation hook — unused in MVP, where uploads publish on finalize and are post-moderated per PART 11) and `retirado_legal` (copyright/legal takedown must be distinguishable from ordinary mod removal because it also triggers file destruction and a different audit trail, §8.7). Posts need no legal status; a legal takedown of a post is `eliminado_mod` plus a `mod_actions.action = 'retiro_legal'` row.

### 8.2.3 Naming and types

- Table/column names follow D9: Spanish domain nouns where they are the domain (`materias`, `carreras`, `facultades`, `sedes`), English elsewhere (`posts`, `reports`). Snake_case, plural table names.
- Timestamps: always `timestamptz`. `created_at` on every table; `edited_at`/`updated_at` only where mutation is a domain event.
- Text lengths enforced by `char_length()` CHECKs, not `varchar(n)` (identical storage, clearer errors, easier to relax).
- `citext` (extension) only for `profiles.handle`, referenced as `extensions.citext` (Supabase installs extensions into the `extensions` schema).
- Money: `price_cents int` (nullable, unused in MVP) — integer cents, never floats (extension point for PART 15).

### 8.2.4 Extensions required

| Extension | Use | Tier note |
|---|---|---|
| `pgcrypto` | `gen_random_bytes` for nanoid | preinstalled on Supabase |
| `citext` | case-insensitive unique handles | free tier, verified |
| `unaccent` | FTS dictionary for es (§8.6) | free tier, verified |
| `pg_cron` | **not used in MVP** — scheduled work runs inside the daily `/api/cron/aggregates` endpoint (§8.5.6, §0.5-R16); pg_cron is a possible later optimization (if adopted, `cron.job_run_details` must be pruned weekly **[FREE-TIER RISK]**) | free tier, verified (media confidence) |
| `pgtap` | RLS/policy test suite (D14.2) | dev/CI only, never in prod schema |

### 8.2.5 Counters: RPC-maintained, job-reconciled

**Considered:** (a) triggers on votes/comments maintaining counters; (b) counters updated inside the writing RPCs; (c) no cached counters, count on read. / **Chosen:** (b) with a nightly full recount job. / **Why:** all writes already flow through a handful of SECURITY DEFINER functions (tenet 6), so the counter update lives next to the logic that causes it — visible, debuggable, and testable in one place; triggers scatter invariants and fire on admin/maintenance SQL where they are wrong (e.g. a purge job deleting vote rows must not decrement a score that was already reconciled). Counting on read is wrong for feed queries (N+1 over thousands of rows). / **Cost:** direct SQL bypassing the RPCs can drift counters — accepted because (i) no role reachable from the app can write base tables directly, and (ii) `reconcile_counters()` (§8.5.6) recomputes `score`, `comments_count`, `downloads_count`, and `karma` nightly, so drift has a ≤24 h half-life.

### 8.2.6 Default privileges: deny first, grant per object

Supabase's default privileges grant broad table access to `anon`/`authenticated` in `public`. Migration 0001 reverses this before creating any table:

```sql
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
```

Every readable object then receives an explicit `GRANT` (matrix in §8.3.9). This makes "forgot to lock it down" impossible by construction; the failure mode becomes a visible 42501 error in development, not a silent leak in production.

## 8.3 MVP schema — every table

Format per table: purpose, DDL sketch (types, defaults, CHECKs, FKs with ON DELETE, UNIQUEs), then PK / relationships / indexes / RLS / deletion / MVP status. DDL sketches omit `COMMENT ON` lines for brevity; the real migration includes them (tenet 10).

### 8.3.1 Academic catalog

Catalog rows are never hard-deleted and never deletable by any app role; corrections and merges happen via migration. All content FKs into the catalog are `ON DELETE RESTRICT` so an accidental catalog deletion is impossible while content exists.

#### `universidades`

Purpose: root of the multi-university chain (§8.8). Exactly one row in MVP (Pontificia Universidad Católica Argentina).

```sql
create table public.universidades (
  id          bigint generated always as identity primary key,
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  nombre      text not null check (char_length(nombre) between 2 and 160),
  sigla       text null check (char_length(sigla) <= 20),
  created_at  timestamptz not null default now()
);
```

- PK `id`; no inbound FKs except `sedes.universidad_id`.
- Indexes: PK + unique slug (implicit). Nothing else — single-digit row count.
- RLS: enabled; policy `read_all` (`for select to anon, authenticated using (true)`).
- Deletion: never (migration-only).
- MVP: yes (seeded, 1 row).

#### `sedes`

Purpose: physical campus (brief §9.E hierarchy: University → Campus). MVP: 1 row (Campus Rosario, from APPENDIX A §C.1).

```sql
create table public.sedes (
  id              bigint generated always as identity primary key,
  universidad_id  bigint not null references public.universidades(id) on delete restrict,
  slug            text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  nombre          text not null check (char_length(nombre) between 2 and 160),
  ciudad          text not null check (char_length(ciudad) <= 120),
  direccion       text null check (char_length(direccion) <= 200),
  created_at      timestamptz not null default now()
);
```

- PK `id`; parent `universidades`; children `facultades`.
- Indexes: PK, unique slug, `(universidad_id)`.
- RLS: read_all. Deletion: never. MVP: yes (1 row).

#### `facultades`

Purpose: faculty as an organizational unit of a sede. MVP: 3 rows (APPENDIX A §C.2). The appendix flags possible administrative unification of facultades across sedes (SIN VERIFICAR); we keep the simple `facultad → sede` FK now and would remodel via migration only if the university's own structure forces it — the slug is the durable identity either way.

```sql
create table public.facultades (
  id          bigint generated always as identity primary key,
  sede_id     bigint not null references public.sedes(id) on delete restrict,
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  nombre      text not null check (char_length(nombre) between 2 and 200),
  created_at  timestamptz not null default now()
);
```

- PK `id`; parent `sedes`; children `carreras`. Indexes: PK, unique slug, `(sede_id)`.
- RLS: read_all. Deletion: never. MVP: yes (3 rows, /facultades/[slug] per D7).

#### `carreras`

Purpose: degree program; the cohort anchor (D1) and a primary navigation page (D7 `/carreras/[slug]`). MVP: ~14 rows (APPENDIX A §C.3, seeding both verified and SIN-VERIFICAR rows — a wrong carrera row is a cheap correction, an absent one blocks onboarding).

```sql
create table public.carreras (
  id             bigint generated always as identity primary key,
  facultad_id    bigint not null references public.facultades(id) on delete restrict,
  slug           text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  nombre         text not null check (char_length(nombre) between 2 and 200),
  nivel          text not null default 'grado' check (nivel in ('pregrado','grado','posgrado')),
  duracion_anios smallint null check (duracion_anios between 1 and 8),
  created_at     timestamptz not null default now(),
  search         tsvector generated always as (to_tsvector('public.es', nombre)) stored
);
```

- PK `id`; parent `facultades`; children `plan_materias`, referenced by `profiles.carrera_id`.
- Indexes: PK, unique slug, `(facultad_id)`, `gin (search)` (carreras participate in `search_catalog` — §0.5-R13).
- RLS: read_all. Deletion: never. MVP: yes.

#### `materias`

Purpose: the unit of permanence (D1) — one durable public page per subject, globally unique slug (D7). A materia is a *community page*, not a plan row: plan membership, año, cuatrimestre, and official codes live in `plan_materias`, because the same materia can sit in several planes (Abogacía 2013/2020) with different codes. Seeding rule: one materia per distinct subject per facultad; if two carreras share a subject name but not a program, they get separate materias with carrera-qualified slugs (`filosofia-y-antropologia-abogacia`); merging is an editorial seed-time decision, never automatic.

```sql
create table public.materias (
  id          bigint generated always as identity primary key,
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  nombre      text not null check (char_length(nombre) between 2 and 160),
  descripcion text null check (char_length(descripcion) <= 2000),
  aliases     text[] not null default '{}',
  created_at  timestamptz not null default now(),
  search      tsvector generated always as (
                setweight(to_tsvector('public.es', nombre), 'A') ||
                setweight(to_tsvector('public.es', array_to_string(aliases, ' ')), 'B') ||
                setweight(to_tsvector('public.es', coalesce(descripcion, '')), 'C')
              ) stored
);
```

`aliases` (§0.5-R13) holds the colloquial names students actually type ("consti" → Derecho Constitucional), feeding both typeahead and the FTS vector at weight B; alias data is seeded from APPENDIX A.

- PK `id`; children `plan_materias`, `posts.materia_id`, `resources.materia_id`, `materia_follows`.
- Indexes: PK, unique slug, `gin (search)`.
- RLS: read_all. Deletion: never (merges via migration re-pointing FKs and 301-redirecting slugs, PART 23). MVP: yes (~110 rows seeded from APPENDIX A §C.4/§C.5, growing per D11 carrera-by-carrera).

#### `plan_materias`

Purpose: the carrera ⇄ materia mapping with plan versioning (APPENDIX A §E.3: Abogacía planes 2013 y 2020 coexist; Contador is Plan 2017). Renders the plan-de-estudios grid on carrera pages and resolves "materias de mi carrera" for the feed (PART 12).

```sql
create table public.plan_materias (
  carrera_id   bigint not null references public.carreras(id) on delete restrict,
  materia_id   bigint not null references public.materias(id) on delete restrict,
  plan         text not null check (char_length(plan) <= 20),      -- '2013', '2017', '2020'
  anio         smallint not null check (anio between 1 and 8),
  cuatrimestre smallint not null check (cuatrimestre in (0, 1, 2)), -- 0 = anual
  codigo       text null check (char_length(codigo) <= 20),         -- official code, plan-scoped
  optativa     boolean not null default false,
  created_at   timestamptz not null default now(),
  primary key (carrera_id, plan, materia_id)
);
```

- PK composite `(carrera_id, plan, materia_id)`; parents `carreras`, `materias`.
- Indexes: PK, `(materia_id)` (reverse lookup: "which carreras study this materia").
- RLS: read_all. Deletion: never via app; plan corrections via migration/seed re-run. MVP: yes (~115 rows for the two verified planes).

### 8.3.2 Identity: profiles, handle_history, handle_blocklist

Purpose: the pseudonymous identity (D3). PK equals the Supabase auth UUID but **deliberately carries no FK to `auth.users`**: on account deletion the auth row is destroyed while the profile survives as an anonymized shell (D3), which an FK in either direction would prevent. Sync integrity is owned by the `handle_new_user` trigger (creation) and `delete_account` flow (§8.5.5). Email, password, and recovery data live only in `auth.users` — never in this table (brief §8).

```sql
create table public.profiles (
  id                uuid primary key,                       -- = auth.users.id, no FK by design
  handle            extensions.citext not null unique
                    check (handle::text ~ '^[a-zA-Z0-9_]{3,24}$' and handle::text ~ '[a-zA-Z]'),
  handle_changed_at timestamptz null,                       -- null = never renamed (first pick is free)
  carrera_id        bigint null references public.carreras(id) on delete set null,
  ingreso_year      smallint null check (ingreso_year between 2000 and 2100),
  karma             int not null default 0,
  notif_respuestas  boolean not null default true,          -- prefs v1: the one notification toggle (§0.5-R14)
  role              text not null default 'user' check (role in ('user','mod','admin')),
  status            text not null default 'nuevo'
                    check (status in ('nuevo','activo','suspendido','baneado','eliminado')),
  invited_with      bigint null references public.invites(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
```

The handle rule is PART 9 §9.4.1's, verbatim (§0.5-R8): `^[a-zA-Z0-9_]{3,24}$` with at least one letter, stored citext (case-preserving display, case-insensitive uniqueness), no hyphens. Signup lifecycle: `handle_new_user` inserts the row with a generated placeholder handle (`estudiante_` + nanoid(6) — underscore, to satisfy the CHECK) and `status = 'nuevo'`; `complete_onboarding` (§8.5.2) sets the real handle, optional carrera/ingreso_year, and flips status to `activo`. Content-creating RPCs require `status = 'activo'`, so a half-onboarded account cannot post. Reserved handles live in `handle_blocklist` (below; seeded: `moderador`, `admin`, `mod`, `uca`, `ucanet`, `anonimo`, `equipo`, …) plus the reserved prefixes (`usuario_eliminado_`, `estudiante_`); they are rejected in `complete_onboarding`/`rename_handle`, not by CHECK, because the system itself must be able to assign the reserved shapes.

- PK `id` (uuid); referenced by every `author_id`/`user_id` FK in the schema — all `ON DELETE RESTRICT`, safe because profile rows are never hard-deleted (shells persist).
- Indexes: PK, unique handle (citext ⇒ case-insensitive), `(carrera_id)`, `(role) where role <> 'user'` (mod list), `(status) where status = 'nuevo'` (onboarding-abandonment cleanup).
- RLS: no read for `anon`/`authenticated` on the base table except a self-read policy (`id = auth.uid()`) so the app can render settings; public reads go through `profiles_public` (§8.4). No insert/update grants — all mutations via RPCs.
- Deletion: never physical. Account deletion anonymizes in place: handle → `usuario_eliminado_` + nanoid(4), status → `eliminado`, carrera_id/ingreso_year → null, karma → 0, invited_with → null (§8.7).
- MVP: yes.

#### `handle_history`

Purpose: internal rename ledger (§0.5-R8, demanded by PART 9): records every released handle so that (a) a freed handle stays in quarantine for 90 days before anyone else can claim it, and (b) moderation has rename forensics. Never publicly readable — there is no public name history (C4).

```sql
create table public.handle_history (
  id          bigint generated always as identity primary key,
  profile_id  uuid not null references public.profiles(id) on delete restrict,
  old_handle  extensions.citext not null,
  changed_at  timestamptz not null default now()   -- doubles as created_at (tenet 8)
);
```

- PK `id`; parent `profiles` (restrict — shells persist).
- Indexes: PK; `(old_handle)` (quarantine lookup); `(profile_id, changed_at desc)` (forensics).
- RLS: enabled, **zero policies, zero grants** — readable only inside SECURITY DEFINER functions (`complete_onboarding`/`rename_handle` reject any handle present here with `changed_at > now() - interval '90 days'` unless it belongs to the caller) and service-side tooling.
- Deletion: never via app; rows older than the quarantine window are kept as forensic history (internal UUID + handle text only).
- MVP: yes.

#### `handle_blocklist`

Purpose: reserved and abuse-prone handles (§0.5-R8). One row per blocked handle; checked by `complete_onboarding`/`rename_handle` alongside the reserved prefixes.

```sql
create table public.handle_blocklist (
  handle     extensions.citext primary key,
  created_at timestamptz not null default now()
);
```

- PK `handle` (citext — case-insensitive blocking, structurally).
- Indexes: PK suffices.
- RLS: enabled, zero policies, zero grants — read inside the identity RPCs only.
- Deletion: never via app; seeded and amended by migration (`moderador`, `admin`, `mod`, `uca`, `ucanet`, `anonimo`, `equipo`, …).
- MVP: yes.

### 8.3.3 Content: posts and comments

#### `posts`

Purpose: the unit of activity (D1) — one table for all post kinds (`texto`, `pregunta`), one composer (D2). `materia_id` is optional: untagged posts are general campus conversation within the author's cohort; tagged posts also power the materia page and the Mis materias feed. `carrera_id` is a **snapshot of the author's carrera at creation** (§0.5-R3): null if the author has none; taken regardless of anonymity (coarse, non-identifying cohort data). It lets the feed serve "posts de mi carrera" directly — the composer discloses "Los posts sin materia se muestran a tu carrera." (PART 6). `locked_at` is the thread lock (§0.5-R5): set by the `bloquear_hilo` mod action; `create_comment` refuses while set.

```sql
create table public.posts (
  id               bigint generated always as identity primary key,
  public_id        text not null unique default public.nanoid()
                   check (public_id ~ '^[a-z0-9]{10}$'),
  author_id        uuid not null references public.profiles(id) on delete restrict,
  materia_id       bigint null references public.materias(id) on delete restrict,
  carrera_id       bigint null references public.carreras(id) on delete restrict,  -- author's cohort snapshot at creation (§0.5-R3)
  kind             text not null default 'texto' check (kind in ('texto','pregunta')),
  title            text null check (char_length(title) <= 120),
  body             text null check (char_length(body) <= 10000),
  is_anonymous     boolean not null default false,
  score            int not null default 0,
  comments_count   int not null default 0,
  status           text not null default 'activo'
                   check (status in ('activo','eliminado_autor','eliminado_mod')),
  locked_at        timestamptz null,                        -- thread lock, set by bloquear_hilo (§0.5-R5)
  created_at       timestamptz not null default now(),
  edited_at        timestamptz null,
  last_activity_at timestamptz not null default now(),
  search           tsvector generated always as (
                     setweight(to_tsvector('public.es', coalesce(title, '')), 'A') ||
                     setweight(to_tsvector('public.es', coalesce(body, '')), 'C')
                   ) stored,
  constraint posts_body_required check (status <> 'activo' or body is not null)
);
```

`body` is nullable only because deletion nulls it (§8.7); the constraint `posts_body_required` guarantees active posts always have one. The tsvector regenerates to empty when body is nulled — deleted content falls out of search automatically.

- PK `id`; parents `profiles` (restrict — shells persist), `materias` (restrict), `carreras` (restrict); children `comments`, `post_votes`, `anon_aliases`, `reports.post_id`, `notifications.post_id`.
- Indexes: unique `public_id`; `(created_at desc) where status = 'activo'` (Reciente feed); `(materia_id, created_at desc) where status = 'activo' and materia_id is not null` (materia pages + Mis materias); `(carrera_id, last_activity_at desc) where status = 'activo' and carrera_id is not null` (feed: "posts de mi carrera" — §0.5-R3); `(author_id, created_at desc)` (profile history, rate-limit window counts — **not** partial: deleted rows must still count against rate limits); `gin (search) where status = 'activo'`.
- RLS: enabled; **zero** select policies for `anon`/`authenticated` on the base table (tenet 5); reads via `posts_public`. Writes only via RPCs.
- Deletion: soft (status + body/title nulled for author deletions); physical only via purge job (§8.7).
- MVP: yes.

#### `comments`

Purpose: replies, max depth 2 (D2: one nesting level). Depth is denormalized and CHECK-bound; the parent-child consistency (`parent.depth = 1`) is enforced in `create_comment` because a CHECK cannot read another row. Comments have `public_id` because notifications and permalinks (`/p/[postId]#c-[commentId]`) must reference them without exposing sequences (D14.7). No tsvector: MVP search covers posts, materias, resources only (D2) — this is a deliberate size saving (§8.9); the column is a 5-minute additive migration if comment search is ever wanted.

```sql
create table public.comments (
  id           bigint generated always as identity primary key,
  public_id    text not null unique default public.nanoid()
               check (public_id ~ '^[a-z0-9]{10}$'),
  post_id      bigint not null references public.posts(id) on delete cascade,
  parent_id    bigint null references public.comments(id) on delete restrict,
  depth        smallint not null default 1 check (depth in (1, 2)),
  author_id    uuid not null references public.profiles(id) on delete restrict,
  body         text null check (char_length(body) <= 5000),
  is_anonymous boolean not null default false,
  score        int not null default 0,
  status       text not null default 'activo'
               check (status in ('activo','eliminado_autor','eliminado_mod')),
  created_at   timestamptz not null default now(),
  edited_at    timestamptz null,
  constraint comments_depth_parent check ((parent_id is null) = (depth = 1)),
  constraint comments_body_required check (status <> 'activo' or body is not null)
);
```

- PK `id`; parents `posts` (cascade — hard purge of a post takes its thread), `comments` (restrict — a parent with replies is tombstoned, never physically removed while children exist), `profiles` (restrict).
- Indexes: unique `public_id`; `(post_id, created_at)` (thread render, one query per post page); `(parent_id) where parent_id is not null`; `(author_id, created_at desc)` (history + rate limits).
- RLS: same as posts — no direct reads, `comments_public` only; writes via RPCs.
- Deletion: soft with tombstone (row stays so replies keep context; body nulled, view masks author, §8.4).
- MVP: yes.

### 8.3.4 Votes and follows

Three structurally identical vote tables — separate tables instead of one polymorphic table (tenet 2). Up-only (D2: no downvotes), so the row's existence *is* the vote; no `value` column to validate.

#### `post_votes`

```sql
create table public.post_votes (
  post_id    bigint not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
```

#### `comment_votes`

```sql
create table public.comment_votes (
  comment_id bigint not null references public.comments(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);
```

#### `resource_votes`

```sql
create table public.resource_votes (
  resource_id bigint not null references public.resources(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete restrict,
  created_at  timestamptz not null default now(),
  primary key (resource_id, user_id)
);
```

For all three:
- PK composite `(target_id, user_id)` — one vote per user per target, enforced structurally.
- Indexes: PK; `(user_id, created_at desc)` (vote rate-limit window + "mis votos" if ever needed).
- RLS: enabled; one select policy `user_id = auth.uid()` (the UI must render "ya votaste" state); no insert/delete grants — `toggle_*_vote` RPCs only. Nobody can enumerate who voted on what: the aggregate lives in the cached `score`.
- Deletion: cascade with target on hard purge; toggling off deletes the row inside the RPC (the one exception to "no physical deletes outside purge jobs" — a retracted vote is not content, and keeping it would be surveillance).
- MVP: yes (all three).

#### `materia_follows`

Purpose: drives the Mis materias feed and follower counts on materia pages.

```sql
create table public.materia_follows (
  user_id    uuid not null references public.profiles(id) on delete restrict,
  materia_id bigint not null references public.materias(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (user_id, materia_id)
);
```

- PK `(user_id, materia_id)`; indexes: PK (covers "my follows"), `(materia_id)` (follower count).
- RLS: select own rows (`user_id = auth.uid()`); insert/delete own rows via direct policies — this is the one writable-by-policy table because follow/unfollow is a single-row idempotent write with no counters, no anonymity dimension, and no rate-limit sensitivity worth a function. Follower counts are computed on the materia page with a cheap indexed `count(*)` (no cached column: page views of materias are far rarer than feed rows).
- Deletion: rows deleted on unfollow; on account deletion, follows are deleted by `delete_account` (they are preference data, not content — brief §31).
- MVP: yes.

#### `anon_aliases`

Purpose: per-thread stable anonymous labels (D3): within one post, the same anonymous author is always "Anónimo N". `alias_num = 0` is reserved for the post's author when the post itself is anonymous (rendered "Anónimo (autor)" per PART 6/12 display rules); commenters get 1, 2, 3… in order of first anonymous appearance.

```sql
create table public.anon_aliases (
  post_id    bigint not null references public.posts(id) on delete cascade,
  author_id  uuid not null references public.profiles(id) on delete restrict,
  alias_num  smallint not null check (alias_num >= 0),
  created_at timestamptz not null default now(),
  primary key (post_id, author_id),
  unique (post_id, alias_num)
);
```

- PK `(post_id, author_id)`; the UNIQUE on `(post_id, alias_num)` makes double-assignment impossible even under race; `create_comment` takes a per-post advisory lock (`pg_advisory_xact_lock(post_id)`) before computing `max(alias_num) + 1`.
- Indexes: the two unique constraints suffice.
- RLS: enabled, **zero policies, zero grants** — this table is the anonymity linkage and is readable only inside SECURITY DEFINER functions and the `comments_public` view (which exposes the number, never the mapping). This is the most security-critical table in the schema; pgTAP asserts every role's SELECT fails.
- Deletion: cascade with post purge; alias rows survive comment deletion (a returning author must keep their number). On account deletion the mapping survives against the anonymized shell UUID — required so "Anónimo 2" stays "Anónimo 2" in old threads without any path back to a person (D3, §8.7).
- MVP: yes.

### 8.3.5 Resources

#### `resources`

Purpose: the utility magnet (D1) — typed academic material attached to exactly one materia. Free-only in MVP; `price_cents` exists as the marketplace extension point (C11) and is CHECK-pinned to null until PART 15's phase arrives, so no code path can accidentally price anything.

```sql
create table public.resources (
  id              bigint generated always as identity primary key,
  public_id       text not null unique default public.nanoid()
                  check (public_id ~ '^[a-z0-9]{10}$'),
  materia_id      bigint not null references public.materias(id) on delete restrict,
  author_id       uuid not null references public.profiles(id) on delete restrict,
  tipo            text not null check (tipo in ('resumen','apunte','parcial','final','guia','otro')),
  anio            smallint null check (anio between 2000 and 2100),  -- year of the exam/material
  title           text not null check (char_length(title) between 8 and 120),  -- min 8: forces descriptive titles (§0.5-R12)
  description     text null check (char_length(description) <= 2000),
  is_anonymous    boolean not null default false,
  score           int not null default 0,
  downloads_count int not null default 0,
  price_cents     int null check (price_cents is null),  -- extension point; CHECK relaxed by future migration
  status          text not null default 'borrador'
                  check (status in ('borrador','activo','pendiente','eliminado_autor','eliminado_mod','retirado_legal')),
  created_at      timestamptz not null default now(),
  edited_at       timestamptz null,
  search          tsvector generated always as (
                    setweight(to_tsvector('public.es', title), 'A') ||
                    setweight(to_tsvector('public.es', coalesce(description, '')), 'C')
                  ) stored
);
```

- PK `id`; parents `materias` (restrict), `profiles` (restrict); children `resource_files`, `resource_votes`, `reports.resource_id`.
- Indexes: unique `public_id`; `(materia_id, created_at desc) where status = 'activo'`; `(author_id, created_at desc)` (quota + history); `gin (search) where status = 'activo'`.
- RLS: no direct reads (`resources_public` + `resource_files_public` only); writes via RPCs and the upload server action (PART 14 flow).
- Deletion: soft; `retirado_legal` and author/mod deletion additionally schedule storage file destruction (§8.7). Metadata row survives for audit; files do not.
- MVP: yes.

#### `resource_files`

Purpose: physical files of a resource (1–3 live files per resource, ≤10 MB each — D2). Files live on **Cloudflare R2** (§0.5-R17); Supabase Storage is unused in MVP. Paths are provider-neutral object keys that **never contain user ids or original filenames**: uploads land in the quarantine prefix `incoming/{upload_nanoid}` and, after server-side mime sniff + EXIF strip, are moved to the final key `r/{resource_public_id}/{file_nanoid}.{ext}` (PART 14 owns the canonical pipeline). The original filename survives only as `original_name` metadata. `sha256` supports dedup detection, integrity checks in the weekly export (D13), and future takedown matching. Replacing a file inserts a new row and sets `replaced_at` on the old one — no versions table (§0.5-R12).

```sql
create table public.resource_files (
  id            bigint generated always as identity primary key,
  resource_id   bigint not null references public.resources(id) on delete cascade,
  storage_path  text not null unique check (char_length(storage_path) <= 300),  -- provider-neutral object key on R2: r/{resource_public_id}/{file_nanoid}.{ext} (§0.5-R17)
  original_name text not null check (char_length(original_name) between 1 and 200),
  mime          text not null check (mime in
                  ('application/pdf','image/jpeg','image/png','image/webp')),
  size_bytes    int not null check (size_bytes between 1 and 10485760),
  sha256        text null check (sha256 ~ '^[a-f0-9]{64}$'),
  position      smallint not null default 1 check (position between 1 and 3),
  replaced_at   timestamptz null,   -- set when a newer row supersedes this file (§0.5-R12)
  created_at    timestamptz not null default now()
);
```

- PK `id`; parent `resources` (cascade). The ≤3-live-files rule is enforced by the `position` CHECK plus a partial unique index — structurally, not procedurally.
- Indexes: PK, unique `storage_path`, partial unique `(resource_id, position) where replaced_at is null` (live files only; superseded rows keep their position for history), `(sha256) where sha256 is not null`.
- RLS: no direct reads; file metadata via `resource_files_public` (§8.4); download authorization is the server route (PART 14), which calls `register_download` (§8.5.3) before minting a 120 s signed R2 URL.
- Deletion: rows cascade with resource purge; R2 objects are destroyed by the purge job 30 days after soft-deletion (immediately for `retirado_legal`); replaced files' objects are destroyed with the same 30-day lag — §8.7.
- MVP: yes.

#### `download_log`

Purpose: 7-day ephemeral log (§0.5-R9) that exists ONLY to (a) rate-limit download-URL issuance and (b) dedup `downloads_count` increments per user per resource per day. **No durable per-user download history exists** — the 7-day rolling window is the whole table, disclosed in PART 9 §9.11.3's data inventory and the Privacidad page.

```sql
create table public.download_log (
  resource_id bigint not null references public.resources(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now()
);
```

- No PK by design: an append-only ephemeral log (a user may legitimately produce several rows per resource per day; only the first increments the counter).
- Indexes: `(user_id, created_at desc)` (rate-limit window); `(resource_id, user_id, created_at desc)` (per-user-day dedup check).
- RLS: enabled, **zero policies, zero grants** — written and read only inside `register_download` (§8.5.3) and the purge job.
- Deletion: every row hard-deleted after 7 days by the nightly purge (§8.7); cascade with resource or profile removal.
- MVP: yes.

### 8.3.6 Safety: reports, mod_actions, user_restrictions, appeals

#### `reports`

Purpose: user reports against exactly one target (post, comment, resource, or profile) — the nullable-FK + CHECK pattern (tenet 2). Categories are PART 11 §11.3.1's 12 values, verbatim and normative (§0.5-R4).

```sql
create table public.reports (
  id          bigint generated always as identity primary key,
  reporter_id uuid not null references public.profiles(id) on delete restrict,
  post_id     bigint null references public.posts(id) on delete cascade,
  comment_id  bigint null references public.comments(id) on delete cascade,
  resource_id bigint null references public.resources(id) on delete cascade,
  profile_id  uuid null references public.profiles(id) on delete restrict,
  categoria   text not null check (categoria in
                ('spam','acoso','amenazas','datos_personales','ataque_persona',
                 'suplantacion','contenido_ilegal','compraventa','infraccion_autor',
                 'contenido_sexual','manipulacion','otro')),
  detalle     text null check (char_length(detalle) <= 1000),
  status      text not null default 'abierto'
              check (status in ('abierto','en_revision','resuelto','desestimado','resuelto_duplicado')),
  resolved_by uuid null references public.profiles(id) on delete restrict,
  resolved_at timestamptz null,
  created_at  timestamptz not null default now(),
  constraint reports_one_target
    check (num_nonnulls(post_id, comment_id, resource_id, profile_id) = 1)
);
```

- PK `id`; parents: reporter/resolver/target-profile → `profiles` (restrict), content targets → cascade (if content is hard-purged years later, stale open reports go with it; resolved reports normally outlive content via the retention schedule in §8.7).
- Indexes: `(status, created_at) where status in ('abierto','en_revision')` (the queue); partial unique dedup indexes, one per target: `unique (reporter_id, post_id) where post_id is not null` (likewise for comment_id, resource_id, profile_id) — a user can report a thing once, structurally.
- RLS: no reads for ordinary users (reporters see only the confirmation, not a report inbox — keeps brigading blind); select policy for `role in ('mod','admin')` via `profiles` lookup; writes via `create_report` RPC only.
- Deletion: retained 2 years after resolution, then purged (§8.7) **[LEGAL REVIEW]** — retention of abuse reports under Ley 25.326 data-minimization vs. evidentiary value needs counsel.
- MVP: yes.

#### `mod_actions`

Purpose: immutable audit log of every moderation decision (D14.10, brief §18). Content FKs are `set null` — the audit row must outlive any purge — so each row also snapshots `target_public_id`/`target_kind` as plain text at insert time; the exactly-one check therefore allows nulls *after* purge but the inserting RPC guarantees exactly one at write time.

```sql
create table public.mod_actions (
  id               bigint generated always as identity primary key,
  actor_id         uuid not null references public.profiles(id) on delete restrict,
  action           text not null check (action in
                     ('remover','restaurar','advertir','suspender','banear','desbanear',
                      'resolver_reporte','desestimar_reporte','retiro_legal',
                      'bloquear_hilo','revelar_autor')),
  post_id          bigint null references public.posts(id) on delete set null,
  comment_id       bigint null references public.comments(id) on delete set null,
  resource_id      bigint null references public.resources(id) on delete set null,
  profile_id       uuid null references public.profiles(id) on delete restrict,
  report_id        bigint null references public.reports(id) on delete set null,
  target_kind      text not null check (target_kind in ('post','comment','resource','profile')),
  target_public_id text not null check (char_length(target_public_id) <= 40),
  motivo_publico   text not null check (char_length(motivo_publico) between 3 and 500),
  notas_internas   text null check (char_length(notas_internas) <= 2000),
  created_at       timestamptz not null default now(),
  constraint mod_actions_max_one_target
    check (num_nonnulls(post_id, comment_id, resource_id, profile_id) <= 1)
);
```

`motivo_publico` is what the affected user sees in their notification (D3: moderation of your content is never anonymous to you) — es-AR, e.g. "Se removió tu publicación por datos personales de terceros." `notas_internas` never leaves the mod panel. Two actions carry extra semantics (§0.5-R5): `bloquear_hilo` sets `posts.locked_at` (`create_comment` refuses locked threads, §8.5.3); `revelar_autor` records the audited "Ver autor" read of an anonymous item's author — the action row **is** the audit log, there is no separate reveal table. Suspension durations are not encoded in the action name: `suspender` writes a `user_restrictions` row with `until = now() + 7 days` or `+ 30 days` per the PART 11 ladder.

- PK `id`; immutability enforced by trigger `mod_actions_immutable` (`before update or delete … raise exception 'MOD_ACTIONS_IMMUTABLE'`) in addition to absent grants — belt and braces because this table is the accountability record.
- Indexes: `(created_at desc)`; `(actor_id, created_at desc)`; `(profile_id) where profile_id is not null`; `(target_public_id)`.
- RLS: select for mods/admins only; insert via mod RPCs only; update/delete: nobody, ever.
- Deletion: never deleted by app or purge; only account-deletion anonymization touches it indirectly (actor/profile UUIDs point at shells — D3 "internal UUID only").
- MVP: yes.

#### `user_restrictions`

Purpose: time-boxed or permanent account restrictions; the enforcement source of truth read by every writing RPC.

```sql
create table public.user_restrictions (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete restrict,
  tipo       text not null check (tipo in ('suspension','ban')),
  motivo     text not null check (char_length(motivo) between 3 and 500),
  created_by uuid not null references public.profiles(id) on delete restrict,
  starts_at  timestamptz not null default now(),
  until      timestamptz null,            -- null = permanent
  revoked_at timestamptz null,
  revoked_by uuid null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint restrictions_window check (until is null or until > starts_at)
);
```

Active restriction = `revoked_at is null and (until is null or until > now())`. RPC helper `has_active_restriction(uid)` centralizes the predicate. `profiles.status` mirrors the current worst restriction (`suspendido`/`baneado`) for cheap checks and public display; the mirror is updated by the mod RPCs and re-derived by the nightly reconcile job when suspensions lapse.

- PK `id`; indexes: `(user_id) where revoked_at is null` (hot path), `(until) where revoked_at is null` (lapse sweep).
- RLS: select own rows (`user_id = auth.uid()` — you can see why you're restricted) + mods/admins; writes via mod RPCs only.
- Deletion: never; revocation is a column update via `mod_revoke_restriction`. MVP: yes.

#### `appeals`

Purpose: the structured `/apelacion` flow (PART 11 §11.5.2, §0.5-R15): one appeal per mod action, decided by a second reviewer. The appellant is not stored redundantly — authorship is verified against the linked mod action's target at insert time.

```sql
create table public.appeals (
  id            bigint generated always as identity primary key,
  mod_action_id bigint not null unique references public.mod_actions(id) on delete restrict,
  body          text not null check (char_length(body) between 1 and 2000),
  status        text not null default 'pendiente'
                check (status in ('pendiente','aceptada','rechazada')),
  reviewed_by   uuid null references public.profiles(id) on delete restrict,
  created_at    timestamptz not null default now()
);
```

- PK `id`; UNIQUE `mod_action_id` — one appeal per action, structurally; parents `mod_actions` (restrict — the audit chain must hold), `profiles` (`reviewed_by`, restrict).
- Indexes: PK, unique `mod_action_id`, `(status) where status = 'pendiente'` (review queue).
- RLS: select for the appellant (policy resolves the caller against the linked mod action's target) and for mods/admins; insert via `create_appeal` RPC only (§8.5.4 — validates target authorship); status/`reviewed_by` updates via `mod_review_appeal`, whose reviewer must differ from the original actor (PART 11 §11.5.2).
- Deletion: never via app; follows the `mod_actions` audit retention.
- MVP: yes (§0.5-R15 — /apelacion ships in MVP).

### 8.3.7 System: notifications, invites, events, search_queries, app_settings, waitlist

#### `notifications`

Purpose: in-app notifications, MVP types only (D2 + §0.5-R14): replies (`respuesta_post`, `respuesta_comentario`), mod decisions (`decision_mod`), and reporter feedback (`reporte_resuelto` — the closure notice PART 11 requires when a report you filed is resolved). `actor_display` is precomputed at insert time respecting anonymity ("Anónimo 2" or the handle as of that moment) so the notification never needs a join that could leak or desync (C5-adjacent: a rename or anonymity flag change never rewrites history here). `group_key`/`group_count` implement PART 12's MVP grouping (e.g. one row that reads "3 respuestas nuevas en tu publicación" instead of three). Preferences v1 is the single `profiles.notif_respuestas` boolean (§8.3.2): it silences the reply types; `decision_mod` and `reporte_resuelto` are always-on, non-disableable.

```sql
create table public.notifications (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references public.profiles(id) on delete restrict,
  type          text not null check (type in
                  ('respuesta_post','respuesta_comentario','decision_mod','reporte_resuelto')),
  post_id       bigint null references public.posts(id) on delete cascade,
  comment_id    bigint null references public.comments(id) on delete cascade,
  mod_action_id bigint null references public.mod_actions(id) on delete set null,
  actor_display text not null check (char_length(actor_display) <= 40),
  group_key     text null,                       -- grouping bucket, e.g. 'respuesta_post:{post_id}' (§0.5-R14)
  group_count   int not null default 1,
  read_at       timestamptz null,
  created_at    timestamptz not null default now(),
  constraint notifications_target check (
    (type = 'respuesta_post'       and post_id is not null and comment_id is not null) or
    (type = 'respuesta_comentario' and post_id is not null and comment_id is not null) or
    (type = 'decision_mod'         and mod_action_id is not null) or
    (type = 'reporte_resuelto'     and mod_action_id is not null)
  )
);
```

- PK `id`; indexes: `(user_id, created_at desc)`; `(user_id) where read_at is null` (badge count).
- RLS: this is the one content-adjacent table with direct access — select policy `user_id = auth.uid()`; column-scoped `grant update (read_at)` plus update policy `user_id = auth.uid()` (mark-as-read without an RPC round-trip). Inserts happen inside `create_comment` and mod RPCs. No anonymity risk: `actor_display` is already the public label.
- Deletion: read rows purged after 90 days, unread after 180 (§8.7); cascade with content purge.
- MVP: yes. Notification *type* list is the extension point for P2 (mentions, follows digest — PART 12 §notifications).

#### `invites`

Purpose: invite links gating early registration (D3). Redemption is recorded on `profiles.invited_with`, giving an invite tree for abuse forensics (PART 11) without a separate redemptions table.

```sql
create table public.invites (
  id         bigint generated always as identity primary key,
  code       text not null unique default public.nanoid(8)
             check (code ~ '^[a-z0-9]{8}$'),
  created_by uuid not null references public.profiles(id) on delete restrict,
  max_uses   int not null default 10 check (max_uses between 1 and 500),
  uses       int not null default 0,
  expires_at timestamptz null,
  note       text null check (char_length(note) <= 200),
  revoked_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint invites_uses_bound check (uses >= 0 and uses <= max_uses)
);
```

Redemption path (§0.5-R18): the signup Server Action first **validates the code read-only** (pre-signup, so the user gets a friendly error before any account exists), then sends it in auth metadata; `handle_new_user` **consumes it atomically** at user creation by running `update invites set uses = uses + 1 where code = ... and revoked_at is null and (expires_at is null or expires_at > now()) and uses < max_uses returning id` — zero rows ⇒ `raise exception 'INVITE_INVALID'`, which aborts the signup transaction. UI copy for that failure: "El código de invitación no es válido o ya se usó."

- PK `id`; unique `code`; index `(created_by)`.
- RLS: select own invites (`created_by = auth.uid()`) + admins; creation via `create_invite` RPC (admin/mod in MVP; trusted-user issuance is a P2 growth lever, PART 30).
- Deletion: never; revocation via `revoked_at`. MVP: yes.

#### `events`

Purpose: minimal aggregate analytics (D4, PART 24 owns the event list): day-bucketed named counters, zero per-user rows, zero cookies. This table cannot reconstruct anyone's behavior — that is its design goal, not a limitation (brief §34/§35).

```sql
create table public.events (
  name       text not null check (char_length(name) <= 60),
  day        date not null default current_date,
  dim        text not null default '' check (char_length(dim) <= 60),
  count      bigint not null default 0,
  primary key (name, day, dim)
);
```

- PK `(name, day, dim)` — PART 24's shape (§0.5-R11); `dim` is an optional low-cardinality dimension from PART 24's closed lists (never free text — §0.5-R10 keeps query text in `search_queries`, not here).
- RLS: no reads for app roles (admin dashboards query via mod/admin policy); increments via `track_event(p_name, p_dim default '')` RPC (`insert … on conflict (name, day, dim) do update set count = events.count + 1`), executable by `anon` and `authenticated`, with name and dim validated against the allowlists in PART 24 to prevent cardinality junk.
- Deletion: **never** — aggregate-only, ~KBs/year; it is the raw material of the archive's "anonymized community statistics" (brief §2). MVP: yes.

#### `search_queries`

Purpose: day-bucketed search-quality telemetry (§0.5-R10): what students look for, what returns nothing — the input to seed-content and alias decisions. **No user linkage, ever**; queries are normalized and redacted per PART 13 §13.8 before they touch this table.

```sql
create table public.search_queries (
  day           date not null default current_date,
  query_norm    text not null check (char_length(query_norm) <= 120),
  results_total int not null default 0,
  zero_results  boolean not null default false,
  count         int not null default 1,
  primary key (day, query_norm)
);
```

- PK `(day, query_norm)`; `day` doubles as created_at (tenet 8); no other indexes needed.
- RLS: enabled, zero policies for app roles (admin dashboards via mod/admin policy); upserts happen inside the `search_*` functions (§8.5.3) after PART 13 §13.8's redaction rules.
- Deletion: rows purged after 12 months by the nightly job (§8.7).
- MVP: yes.

#### `app_settings`

Purpose: runtime flags and kill-switches without a deploy (§0.5-R22, PART 10 §10.14's demand) — e.g. the new-account posting kill-switch, registration freeze. Deliberately tiny: a key-value table read by RPCs at their guard step.

```sql
create table public.app_settings (
  key        text primary key check (char_length(key) <= 60),
  value      jsonb not null,
  updated_by uuid null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
```

- PK `key`; parent `profiles` (`updated_by`, restrict).
- Indexes: PK suffices (a handful of rows).
- RLS: admin-only (select and update policies for `role = 'admin'`); writing RPCs read it via SECURITY DEFINER, so no broader grant is needed.
- Deletion: keys added/retired by migration; values mutable by admins.
- MVP: yes.

#### `waitlist`

Purpose: emails captured while registration is invite-gated (§0.5-R22; flow owned by PART 6 §6.10-A / PART 35). Plain PII, so the posture is maximum lockdown.

```sql
create table public.waitlist (
  id         bigint generated always as identity primary key,
  email      extensions.citext not null unique,
  created_at timestamptz not null default now(),
  invited_at timestamptz null,
  source     text null check (char_length(source) <= 60)
);
```

- PK `id`; unique `email` (citext — case-insensitive dedup, structurally).
- Indexes: PK, unique email, `(invited_at) where invited_at is null` (pending queue).
- RLS: enabled, **zero policies, zero grants** — service-only (§0.5-R22): inserts via the waitlist SECURITY DEFINER function called by the public form's Server Action; reads/exports only via service-side admin scripts.
- Deletion: rows deleted service-side once invited and honored on request (it is PII with no product value after conversion).
- MVP: yes.

### 8.3.8 Non-tables: what the schema deliberately lacks in MVP

`bookmarks`, `tags`, `professors`, `courses/commissions`, `resource_reviews`, `archive_entries`, `transactions`, `moderation_logs` (merged into `mod_actions`), `pseudonyms` (merged into `profiles`) — all from brief §21's candidate list, all excluded with their extension points documented in §8.11. Rate limiting also gets **no table**: windows are computed by counting recent rows in `posts`/`comments`/`post_votes`/etc. via the `(author_id, created_at)` indexes — at MVP scale a count over a 10-minute window touches a handful of index pages, and deleting content cannot reset a limit because deleted rows still count (status-independent indexes, §8.3.3).

### 8.3.9 Access matrix (grants + RLS posture, one line per table)

"—" means no grant, reachable only through views/RPCs (as `postgres`-owned SECURITY DEFINER code). All tables have RLS enabled.

| Table | anon SELECT | auth SELECT | Direct writes | Write path |
|---|---|---|---|---|
| universidades, sedes, facultades, carreras, materias, plan_materias | policy: all rows | policy: all rows | none | migrations/seed only |
| profiles | — | policy: own row | none | RPCs + trigger |
| handle_history, handle_blocklist | — | — | none | inside RPCs only |
| posts, comments, resources, resource_files | — | — | none | RPCs / upload action |
| download_log | — | — | none | register_download RPC only |
| post_votes, comment_votes, resource_votes | — | policy: own rows | none | toggle RPCs |
| materia_follows | — | policy: own rows | policy: insert/delete own | direct (policy-guarded) |
| anon_aliases | — | — | none | inside RPCs only |
| reports | — | policy: mods/admins | none | create_report RPC |
| mod_actions | — | policy: mods/admins | none | mod RPCs; immutable |
| user_restrictions | — | policy: own + mods | none | mod RPCs |
| appeals | — | policy: appellant + mods | none | create_appeal / mod_review_appeal RPCs |
| notifications | — | policy: own rows | update(read_at) own | RPC-inserted |
| invites | — | policy: own + admins | none | create_invite RPC |
| events | — | — | none | track_event RPC |
| search_queries | — | — | none | inside search_* RPCs |
| app_settings | — | policy: admins | policy: admins update | admin-guarded |
| waitlist | — | — | none | waitlist RPC; service-side reads |
| views posts_public, comments_public, resources_public, resource_files_public, profiles_public | grant SELECT | grant SELECT | n/a | n/a |

## 8.4 Public views — where anonymity is enforced

**Decision.** All public content reads go through five `postgres`-owned views created `WITH (security_barrier = true)` and **without** `security_invoker` (i.e. definer semantics). `anon`/`authenticated` get SELECT on the views only; base content tables grant them nothing.

### 8.4.1 The security model: definer views over locked base tables

**Considered:** (a) `security_invoker = true` views + RLS SELECT policies on base tables; (b) definer views (default semantics) over base tables with zero grants; (c) no views, policies with column masking in app code. / **Chosen:** (b). / **Why:** invoker views check base-table privileges *as the querying user*, so (a) forces SELECT grants on `posts` etc. back onto `anon`/`authenticated` — recreating the exact leak surface (raw `author_id`, `is_anonymous` join-ability) the views exist to remove; and RLS policies filter *rows*, never *columns*, so no policy can strip an author field from an anonymous row. (c) trusts app code with anonymity, violating D14.5. With (b), the roles have **no path whatsoever** to author columns of anonymous content: a compromised or buggy app query cannot select what it cannot reach. / **Cost:** the views are security-critical code — a careless column addition is a leak — so each view has pgTAP tests asserting the anonymous-row null-out, and `security_barrier` prevents leaky-function pushdown from peeking at pre-filter rows. Supabase lints warn on definer views precisely because they bypass RLS; here that bypass is the *point*, it is deliberate, documented, and the views contain the entire policy.

Views expose the internal `id` alongside `public_id` for server-side joins; the serialization rule (D14.7, enforced in PART 26's review checklist) is that only `public_id`/slugs cross the wire to the browser.

### 8.4.2 View definitions (column lists are binding)

```sql
create view public.posts_public with (security_barrier = true) as
select p.id, p.public_id, p.materia_id, p.carrera_id, p.kind, p.title, p.body,
       p.is_anonymous,
       case when p.is_anonymous then null else pr.handle::text end as author_handle,
       p.score, p.comments_count, p.locked_at,
       p.created_at, p.edited_at, p.last_activity_at,
       p.search
from public.posts p
join public.profiles pr on pr.id = p.author_id
where p.status = 'activo';
```

Stripped for anonymous rows: `author_handle` (null). Never present for any row: `author_id`, `status` (constant by the WHERE), moderation data (`locked_at` is exposed because the lock state is public UI: the composer renders "Hilo bloqueado"; `carrera_id` is coarse cohort data, §0.5-R3). Deleted posts are absent entirely — their URL renders an **HTTP 410** tombstone at the app layer (§0.5-R23c, PARTs 7/16/23).

```sql
create view public.comments_public with (security_barrier = true) as
select c.id, c.public_id, c.post_id, c.parent_id, c.depth,
       case when c.status = 'activo' then c.body else null end as body,
       c.status,
       (c.status = 'activo' and c.is_anonymous) as is_anonymous,
       case when c.status <> 'activo' or c.is_anonymous
            then null else pr.handle::text end as author_handle,
       case when c.status = 'activo' and c.is_anonymous
            then aa.alias_num else null end as anon_alias_num,
       c.score, c.created_at, c.edited_at
from public.comments c
join public.profiles pr on pr.id = c.author_id
left join public.anon_aliases aa
       on aa.post_id = c.post_id and aa.author_id = c.author_id;
```

Comments keep tombstones (status visible, body/author nulled) so threads stay coherent: the UI renders "Comentario eliminado". `anon_alias_num` is the *only* thing the alias table ever emits — the number is public by design ("Anónimo 2"), the mapping never.

```sql
create view public.resources_public with (security_barrier = true) as
select r.id, r.public_id, r.materia_id, r.tipo, r.anio, r.title, r.description,
       r.is_anonymous,
       case when r.is_anonymous then null else pr.handle::text end as author_handle,
       r.score, r.downloads_count, r.created_at, r.edited_at, r.search
from public.resources r
join public.profiles pr on pr.id = r.author_id
where r.status = 'activo';

create view public.resource_files_public with (security_barrier = true) as
select f.id, f.resource_id, f.original_name, f.mime, f.size_bytes, f.position
from public.resource_files f
join public.resources r on r.id = f.resource_id
where r.status = 'activo';
```

`storage_path` and `sha256` stay internal; download URLs (120 s signed R2 URLs, §0.5-R17) are minted server-side after authorization (PART 14).

```sql
create view public.profiles_public with (security_barrier = true) as
select p.id, p.handle::text as handle, p.karma, p.carrera_id, p.ingreso_year,
       p.role, p.status, p.created_at
from public.profiles p
where p.status in ('activo','suspendido','baneado','eliminado');
```

Excluded: `handle_changed_at` (rename history is private, C4), `invited_with` (invite tree is forensic data), `updated_at`, and — structurally — email/auth data, which never entered this table. `status = 'nuevo'` rows (not yet onboarded) are invisible. `role` is exposed so mod actions carry visible authority (PART 11 decides rendering); `created_at` gives public account age rendered coarsely ("Se unió en marzo de 2027" — PART 17). Profile pages are public but `noindex` (C16, PART 23).

Grants, in migration: `grant select on posts_public, comments_public, resources_public, resource_files_public, profiles_public to anon, authenticated;`

## 8.5 Functions and RPC inventory

**Decision.** All invariant-carrying writes are SQL (`plpgsql`) SECURITY DEFINER functions owned by `postgres`. Uniform rules, enforced by a pgTAP meta-test over `pg_proc`: (1) `set search_path = public, pg_temp` pinned in every definition; (2) `revoke execute … from public, anon;` then explicit `grant execute … to authenticated` (plus `anon` only for `track_event` and the `search_*` read functions); (3) first statement resolves `auth.uid()` and loads the caller's profile status — `nuevo`/`suspendido`/`baneado`/`eliminado` or an active `user_restrictions` row aborts with a typed exception; (4) rate limits checked in-function (D14.9); (5) errors raised with stable machine codes (`RATE_LIMIT`, `INVITE_INVALID`, `HANDLE_COOLDOWN`, `TARGET_NOT_FOUND`, `NOT_ALLOWED`…) which the server maps to es-AR copy, e.g. `RATE_LIMIT` → "Esperá unos minutos antes de publicar de nuevo."

Rate limits (§0.5-R6): the **values are PART 11 §11.6.2's account-age-tiered table (T0/T1/T2)** — this part does not restate them. Mechanism: no counters table; each write RPC enforces its limit by **counting recent rows** via the existing `(author_id, created_at)` / `(user_id, created_at)` indexes (§8.3.8 — deleted rows still count). The limit constants live in one `rate_limits()` SQL function (shipped in migration 0001) so tuning is a migration, not a config hunt. The per-user upload quota is 100 MB lifetime bytes (§0.5-R12, enforced in `request_upload` against `resource_files.size_bytes`).

### 8.5.1 Triggers

- `handle_new_user` — `after insert on auth.users`: validates + consumes the invite code from `raw_user_meta_data` (§8.3.7), inserts `profiles` (placeholder handle `estudiante_` + nanoid(6), `status = 'nuevo'`, `invited_with`). Raising aborts the signup atomically. This is the only code that touches the `auth` schema.
- `set_updated_at` — generic `before update` on `profiles`.
- `mod_actions_immutable` — §8.3.6.

### 8.5.2 Identity RPCs

- `complete_onboarding(p_handle text, p_carrera_id bigint default null, p_ingreso_year smallint default null)` — validates handle regex + reserved list, sets carrera/ingreso, flips `status` `nuevo → activo`. First handle pick does not set `handle_changed_at`.
- `rename_handle(p_handle text)` — enforces the 90-day cooldown (`handle_changed_at is null or handle_changed_at < now() - interval '90 days'`), the `handle_blocklist` + reserved prefixes, the `handle_history` 90-day quarantine of released handles (§0.5-R8), and uniqueness; inserts the old handle into `handle_history`; sets `handle_changed_at`. Error `HANDLE_COOLDOWN` → "Podés cambiar tu seudónimo cada 90 días."
- `delete_account(p_mode text)` — `p_mode in ('borrar','conservar')` (D3): see §8.7 for exact effects. Marks the profile `eliminado`; the auth row itself is removed within 24 h by the admin cron (service-role key lives only there, D5). Sessions die immediately because every RPC and the middleware reject `status = 'eliminado'`.

### 8.5.3 Content RPCs

- `create_post(p_body text, p_title text, p_materia_slug text, p_kind text, p_anonymous boolean) returns text` — status+restriction+rate checks; resolves materia by slug; inserts post; if `p_anonymous`, inserts `anon_aliases (post_id, author_id, 0)`; returns `public_id` (retry once on nanoid collision).
- `create_comment(p_post_public_id text, p_parent_public_id text, p_body text, p_anonymous boolean) returns text` — target must be `activo` **and unlocked** (`posts.locked_at is null`, else `THREAD_LOCKED` — §0.5-R5); depth check (parent must have `depth = 1`); if `p_anonymous`: `pg_advisory_xact_lock(post_id)` then reuse-or-assign next `alias_num` (≥1; the post author's alias 0 is reused if they authored the post anonymously and comment anonymously); increments `posts.comments_count`, touches `last_activity_at`; inserts the `respuesta_post`/`respuesta_comentario` notification with precomputed `actor_display` (skipped when replying to yourself).
- `update_own_post(p_public_id, p_body, p_title)` / `update_own_comment(p_public_id, p_body)` — author-only, target `activo`, sets `edited_at`. No revision history in MVP (extension point §8.11).
- `delete_own_post(p_public_id)` / `delete_own_comment(p_public_id)` / `delete_own_resource(p_public_id)` — author-only; status → `eliminado_autor`; bodies/titles nulled immediately (§8.7); parent counters decremented.
- `request_upload(p_materia_slug, p_tipo, p_anio, p_title, p_description, p_anonymous) returns text` — status+restriction+rate checks (PART 11 §11.6.2 values) plus the 100 MB lifetime quota check; inserts the resource row with status `borrador` and returns its `public_id`; the Server Action `createResourceDraft` calls it and hands the client the quarantine upload target `incoming/{upload_nanoid}` on R2 (PART 14 owns the canonical pipeline — §0.5-R12).
- `finalize_upload(p_resource_public_id, p_files jsonb)` — after the server-side mime sniff + EXIF strip and the move to `r/{resource_public_id}/{file_nanoid}.{ext}`, validates sizes/mimes against the quota, inserts the `resource_files` rows, and flips `borrador → activo` (called by the `finalizeResource` Server Action). Drafts not finalized within 24 h are purged (§8.7).
- `register_download(p_resource_public_id)` — called by the download route before minting the 120 s signed R2 URL: enforces the PART 11 §11.6.2 download limits by counting recent `download_log` rows, inserts a `download_log` row, and increments `downloads_count` only when this is the user's first download of this resource today (per-user-day dedup — §0.5-R9). No durable per-user download history exists; the log purges at 7 days (§8.3.5).
- `search_posts(p_query, …)` / `search_resources(p_query, …)` / `search_catalog(p_query)` — STABLE read functions over the `_public` views and catalog (they can expose nothing the views don't); parsing, ranking recipe, and result blending in PART 13; granted to `anon` and `authenticated` (§0.5-R13). Being STABLE they write nothing; the search route logs `search_queries` telemetry through a small companion writer function after PART 13 §13.8 redaction (§0.5-R10).

### 8.5.4 Vote and report RPCs

- `toggle_post_vote(p_public_id) returns int` (and `toggle_comment_vote`, `toggle_resource_vote`) — target `activo`; self-vote rejected (`NOT_ALLOWED`); insert-or-delete the vote row and `score ± 1` in one transaction. Votes adjust content **score only, never profile karma** (§0.5-R7): karma is recomputed uniformly for all profiles by the nightly job (§8.5.6), which is also what keeps anonymous-content karma unlinkable (C5). The score applies immediately for all account tiers in beta; the T0 vote-delay of PART 11 §11.6.3 is a documented, pre-built-later escalation switch deferred to open registration (§0.5-R6). Returns the new score.
- `create_report(p_target_kind text, p_target_public_id text, p_categoria text, p_detalle text)` — resolves the target to exactly one FK column; duplicate-open-report insert conflicts surface as "Ya reportaste este contenido."
- `create_appeal(p_mod_action_id bigint, p_body text)` — verifies the caller is the target of the mod action, one appeal per action (UNIQUE), inserts the `appeals` row (§8.3.6, §0.5-R15); flow owned by PART 11 §11.5.2.

### 8.5.5 Moderation RPCs (all require `role in ('mod','admin')`, all write `mod_actions`)

- `mod_remove_post(p_public_id, p_motivo, p_notas)` / `mod_remove_comment` / `mod_remove_resource` — status → `eliminado_mod` (resource files scheduled for destruction per §8.7); inserts `decision_mod` notification to the author with `motivo_publico`.
- `mod_restore_post` / `mod_restore_comment` / `mod_restore_resource` — `eliminado_mod → activo` (author deletions are not mod-restorable).
- `mod_legal_takedown_resource(p_public_id, p_motivo, p_notas)` — status → `retirado_legal`, files flagged for immediate destruction, action `retiro_legal` **[LEGAL REVIEW]**.
- `mod_warn_user(p_handle, p_motivo)` — action + notification, no restriction.
- `mod_restrict_user(p_handle, p_tipo, p_until, p_motivo)` / `mod_revoke_restriction(p_restriction_id)` — writes `user_restrictions`, mirrors `profiles.status`.
- `mod_lock_thread(p_public_id, p_motivo, p_notas)` — sets `posts.locked_at`; action `bloquear_hilo` (§0.5-R5); `create_comment` refuses locked threads.
- `mod_reveal_author(p_target_kind, p_target_public_id, p_motivo, p_notas)` — the audited "Ver autor" read: returns the author of an anonymous item and writes the `revelar_autor` action row, which **is** the audit log (§0.5-R5 — no separate table).
- `mod_resolve_report(p_report_id, p_resolution)` — `resuelto`/`desestimado`/`resuelto_duplicado`, links `resolved_by`; emits the `reporte_resuelto` notification to the reporter (§0.5-R14).
- `mod_review_appeal(p_appeal_id, p_resolucion)` — `aceptada`/`rechazada`, sets `reviewed_by`; the reviewer must differ from the original actor (PART 11 §11.5.2).
- `create_invite(p_max_uses, p_expires_at, p_note)` — admin/mod in MVP.

### 8.5.6 Scheduled jobs (invoked by the daily cron endpoint)

Scheduled work is plain SQL functions **invoked by the Vercel daily cron `/api/cron/aggregates`** (keepalive ping + events aggregation + karma recompute + counter reconciliation + all retention purges — §0.5-R16). pg_cron is **not load-bearing in MVP** (media confidence on Free tier); it may be adopted later as an optimization, at which point these same functions get `cron.schedule` wrappers.

| Function | Cadence | Work |
|---|---|---|
| `reconcile_counters` | daily, via the endpoint | recompute `score`, `comments_count`, `downloads_count` from source tables; recompute `karma` for **all** profiles (the uniform nightly karma recompute, §0.5-R7 — also the anonymous-karma daily batch, C5); re-derive `profiles.status` for lapsed suspensions |
| `purge_retention` | daily, via the endpoint | §8.7 matrix: file destruction, notification purge (90 d read / 180 d unread), report purge, `download_log` > 7 days, `search_queries` > 12 months, `borrador` drafts > 24 h, `status='nuevo'` abandoned-signup cleanup (>30 days) |

The admin cron that finalizes auth-user deletion also runs *outside* the database (same endpoint family + service key, D6/D13), because deleting `auth.users` rows belongs to the Auth admin API, not to our SQL.

## 8.6 Full-text search foundations

**Decision.** One custom text search configuration `public.es` (Spanish stemming + unaccent), stored generated `tsvector` columns on `posts`, `materias`, `carreras`, `resources` (not comments — D2), partial GIN indexes on active rows. PART 13 owns query parsing, ranking weights, and result blending; this section owns the physical layer it queries.

```sql
create text search configuration public.es (copy = pg_catalog.spanish);
alter text search configuration public.es
  alter mapping for hword, hword_part, word
  with extensions.unaccent, spanish_stem;

-- IMMUTABLE unaccent wrapper: the raw extensions.unaccent() is STABLE, which disqualifies
-- it from expression indexes; the wrapper pins the dictionary so it is legally IMMUTABLE (§0.5-R13).
create or replace function public.f_unaccent(p_text text)
returns text
language sql immutable parallel safe
as $$ select extensions.unaccent('extensions.unaccent'::regdictionary, p_text) $$;
```

`f_unaccent()` powers the typeahead expression indexes (e.g. `create index on public.materias (f_unaccent(lower(nombre)) text_pattern_ops)`) so "algebra" prefix-matches "Álgebra" without pg_trgm; typeahead also matches against `materias.aliases` (§8.3.1).

Why this shape:
- **Unaccent at the config level, not the query level.** Students type "algebra", "quimica", "economia" without tildes on mobile; the config normalizes both the stored vector and the query through the same pipeline, so `to_tsquery('public.es', 'práctico')` and `'practico'` hit identically.
- **Generated stored columns, not triggers or expression indexes.** The two-argument `to_tsvector(regconfig, text)` is IMMUTABLE, so it is legal in a generated column; the column self-maintains on every UPDATE (including body null-out on deletion — the vector empties and the row leaves the partial index automatically). Caveat, documented in the migration: if the `public.es` config or the unaccent dictionary ever changes, existing vectors are *not* recomputed — that migration must rewrite the columns (`update … set nombre = nombre` per table) and reindex.
- **Weights**: title/nombre = `A`, body/description = `C` (defined here because they are baked into the stored vectors; the `ts_rank_cd` recipe, field boosts across entity types, and recency blending live in PART 13).
- **Indexes** (restated from §8.3): `posts: gin(search) where status='activo'` · `resources: gin(search) where status='activo'` · `materias: gin(search)` · `carreras: gin(search)` (no status on catalog — rows are always live). All search queries must repeat the partial predicate to use the index; PART 13's query templates do.
- The query surface is the three `search_*` functions in §8.5.3 (STABLE, over the `_public` views — §0.5-R13); PART 13 owns their parsing and ranking recipe.
- Typo-tolerant fuzzy matching would want `pg_trgm`; deliberately **not installed in MVP** (§0.5-R21 — it is the named P2 extension): `f_unaccent()` prefix indexes plus `materias.aliases` cover the real typeahead cases on ~110 materias and unique handles. Extension point noted in §8.11.

## 8.7 Deletion & retention matrix

**Decision.** Deletion is a first-class flow with exact, table-by-table consequences (brief §31). The governing principles: (1) the person's words and files disappear when they ask; (2) thread *structure* and aggregate history survive; (3) audit records survive with internal UUIDs only; (4) hard deletion is always a scheduled job, never an inline request path.

| Scenario | Content rows | Bodies/titles | Files (storage) | Votes/score | Notifications | Audit (reports/mod_actions) | Search |
|---|---|---|---|---|---|---|---|
| User edits | row kept, `edited_at` set | replaced | n/a | untouched | untouched | untouched | vector regenerates |
| User deletes own post | status `eliminado_autor` | nulled immediately | n/a | vote rows kept until purge; score frozen (moot — post invisible) | rows referencing it cascade only at purge; visible ones already point at a tombstone-safe public_id (HTTP 410, §0.5-R23c) | reports on it auto-close at next mod sweep; mod_actions unaffected | vector empties; leaves index |
| User deletes own comment | status `eliminado_autor`, tombstone visible | nulled immediately | n/a | kept until purge | kept (reference stays valid via tombstone) | unaffected | n/a (no comment FTS) |
| User deletes own resource | status `eliminado_autor` | metadata kept (title/desc **kept** — needed for "recurso eliminado" context and dedup history) | destroyed by purge job after 30 days | kept until purge | untouched | unaffected | leaves index (partial predicate) |
| Account deletion, "borrar mis publicaciones" | all authored posts/comments/resources → `eliminado_autor` | nulled immediately | destroyed within 30 days | vote rows *cast by* the user deleted; votes *received* follow content | user's notifications deleted; others' notifications keep precomputed `actor_display` text (no live link back) | rows persist pointing at the anonymized shell UUID; no email/handle survives anywhere | all vectors empty |
| Account deletion, "conservar como usuario eliminado" | content stays `activo`, attributed to shell | kept | kept | kept; karma of shell zeroed | user's own deleted; others' keep `actor_display` (old handle text — acceptable: it was public speech under that name; flagged for PART 16 archive policy) | same as above | unchanged |
| Mod removes content | status `eliminado_mod` | **kept** (evidence for appeal/audit; invisible to public via views) | resources: destroyed after 30 days unless appeal window policy in PART 11 extends | kept | author gets `decision_mod` | mod_action row, immutable | leaves index |
| Mod restores | back to `activo` | intact (mod case) | restored if within 30-day window | intact | author notified | second mod_action row | re-enters index |
| Legal takedown (resource) | status `retirado_legal` | metadata kept | destroyed **immediately** by the takedown flow | kept | author notified with motivo | `retiro_legal` action; report linked | leaves index |
| Retention purge (job) | physical DELETE of `eliminado_*` **comments with no active children** after 365 d and posts after 365 d (cascades comments/votes/aliases/notifications) | gone | already gone | cascade | cascade | mod_actions survive (FKs set null, snapshot columns carry meaning); resolved reports purged at 2 y **[LEGAL REVIEW]** | gone |
| Notification hygiene (job) | read > 90 d, unread > 180 d deleted | — | — | — | — | — | — |
| Ephemeral/system hygiene (job) | `download_log` > 7 d, `search_queries` > 12 mo, `borrador` drafts > 24 h (row + quarantine object) hard-deleted | — | quarantine objects of stale drafts destroyed | — | — | — | — |

Two consequences worth naming: deleted-then-purged content makes `comments_count`/`score` drift until the nightly reconcile recomputes from surviving rows — accepted (≤24 h, §8.2.5). And because `anon_aliases` survives account deletion against the shell UUID, historical threads keep coherent "Anónimo N" labels while the shell has no email, no handle, and no auth row — the mapping points at nobody (D3, C6).

## 8.8 Multi-university readiness (brief §57)

**Decision.** The chain `universidades → sedes → facultades → carreras → plan_materias → materias` already *is* the multi-university model; MVP seeds exactly one path through it (UCA → Rosario → 3 facultades) and builds nothing else.

Why this suffices: every piece of content hangs off `materia_id` (or a catalog slug), and every materia resolves to sede and universidad through plain joins — so "all posts at sede X" or "resources across universities" are queries, not migrations. Adding Universidad 2 or Sede Paraná in 2029 is inserting catalog rows and seeding a plan; zero content-table DDL. Global slug uniqueness (materias/carreras) is the one rule that will feel the stretch — `derecho-constitucional` at a second university collides — and the documented answer is prefix-on-collision at seed time (`derecho-constitucional-uba`), keeping existing URLs untouched (D7 durability beats slug symmetry).

What we deliberately do **not** build now, because each is real cost against a hypothetical:
- No `tenant_id`/`universidad_id` denormalized onto content tables — derivable via join; adding a column later is one backfill migration if query plans ever demand it.
- No per-tenant RLS or tenant isolation — there are no tenants, there is one community (D1: density, not breadth).
- No subdomain/locale routing, no per-university theming/config tables.
- No cross-university identity model (one profile, one handle namespace — revisit only when a second university is actually signed).

## 8.9 Size model vs. the 500 MB cap **[FREE-TIER RISK]**

**Decision.** The DB size/growth **model of record is PART 21 §21.2** (its constants are wired to the D13 triggers — Supabase Pro at DB > 70% of 500 MB two months running); this section defers to it rather than restating numbers (§0.5-R23j). With resource files on Cloudflare R2 (§0.5-R17), the database is the one constraint that cannot be offloaded, so quota consumption is telemetered from day 1.

What the schema itself guarantees to keep PART 21's model honest, all pre-mitigated: notifications, `download_log`, `search_queries`, and stale `borrador` drafts are purged on schedule (§8.7); partial GIN indexes on `activo` keep dead content out of index bloat; `events` and `search_queries` are aggregate-only (~KBs/year); comments deliberately carry no tsvector (§8.3.3). Per PART 21's model, the free tier carries the entire beta and the first public year (D12 timeline) with margin, and the $25 Pro trigger firing is a success condition, not an emergency (D13).

## 8.10 Migration strategy

**Decision.** Plain SQL migrations via the Supabase CLI are the single source of truth for every database object (D6, D14.1). Physical filenames use the CLI's `YYYYMMDDHHMMSS_snake_description.sql` format (lexicographic order is the application order); this plan refers to them by conceptual ordinal (0001, 0002, …). Applied migrations are immutable: once a file has run against the linked project or merged to main, it is never edited — mistakes are fixed by a new forward migration.

### 8.10.1 The initial migration set (S0)

One file per concern, applied in this order (each independently reviewable; FK dependency note: `profiles.invited_with → invites` means invites is created before profiles, while `invites.created_by → profiles` is added as an `ALTER TABLE … ADD CONSTRAINT` in 0004 after profiles exists — the one intentional two-step in the set):

The twelve ordinals are canonical (§0.5-R21); every object added by the §0.5 rulings folds into the existing thematic migrations as stated below — no new ordinals, no `pg_trgm` (the named P2 extension).

| Ordinal | Content |
|---|---|
| 0001 | extensions; default-privilege revokes (§8.2.6); `nanoid()`; `public.es` FTS config + `f_unaccent()` (§0.5-R13); generic helpers (`set_updated_at`, `raise_immutable`, `rate_limits` — §0.5-R6) |
| 0002 | academic catalog tables + read_all policies — incl. `materias.aliases` and the `carreras` search vector (§0.5-R13) |
| 0003 | `invites` (without created_by FK); `waitlist` folds in here (registration gating — §0.5-R22) |
| 0004 | `profiles` (incl. `notif_respuestas` — §0.5-R14) + `handle_new_user` trigger + invites FK backfill; `handle_history` and `handle_blocklist` fold in here (§0.5-R8) |
| 0005 | `posts` (incl. `carrera_id` §0.5-R3, `locked_at` §0.5-R5), `comments`, `anon_aliases` |
| 0006 | vote tables, `materia_follows` |
| 0007 | `resources` (incl. `borrador`, title 8–120 — §0.5-R12), `resource_files` (incl. `replaced_at`); `download_log` folds in here (§0.5-R9). Files live on Cloudflare R2 (§0.5-R17) — no in-DB storage buckets or storage policies |
| 0008 | `reports` (12-value categoria, `resuelto_duplicado`), `mod_actions` (extended action enum, + immutability trigger), `user_restrictions`; `appeals` folds in here (§0.5-R15) |
| 0009 | `notifications` (incl. `group_key`/`group_count`), `events` (PART 24 shape — §0.5-R11); `search_queries` (§0.5-R10) and `app_settings` (§0.5-R22) fold in here |
| 0010 | `_public` views + grants |
| 0011 | all RPC functions + execute grants — incl. `request_upload`/`finalize_upload` (§0.5-R12), `create_appeal`, `mod_lock_thread`/`mod_reveal_author`/`mod_review_appeal`, and the `search_*` functions (§0.5-R18) |
| 0012 | scheduled-job functions (`reconcile_counters`, `purge_retention`) invoked by the daily `/api/cron/aggregates` endpoint (§0.5-R16 — no pg_cron DDL) |

### 8.10.2 Seeds are not migrations

Schema migrations contain zero data. Two seed layers, separated by purpose:

- **Catalog seed** (`db/seed/catalog/*.sql`): APPENDIX A rendered as idempotent upserts — `insert … on conflict (slug) do update set nombre = excluded.nombre` — one file per domain (`10_sedes.sql`, `20_facultades.sql`, `30_carreras.sql`, `40_materias_abogacia.sql`, `41_materias_contador.sql`, …), applied to every environment (dev, CI, prod) by a checked-in `psql` script. Idempotency means a corrected appendix (e.g. a SIN-VERIFICAR carrera confirmed or renamed) re-runs safely without touching user content; slugs are the conflict keys precisely because they are the stable identity (brief §58). Each seed file header cites its appendix section and verification status.
- **Dev fixtures** (`supabase/seed.sql`): fake users/posts for local development and Playwright runs only; never applied to prod.

### 8.10.3 Operational rules

- CI runs `supabase db reset` (all migrations + catalog seed + pgTAP suite) on every PR; a migration that cannot replay from zero does not merge (this is also the portability rehearsal — brief §33).
- `supabase gen types typescript` runs post-migration in CI; the generated types file is committed, so schema drift breaks the TypeScript build, not production.
- **Rollback stance: forward-only.** No down migrations — they are untested code paths that create false confidence. The recovery ladder: (1) fix-forward migration; (2) for destructive migrations (drop/alter of populated columns), the runbook requires a pre-deploy `pg_dump` and the migration ships in expand→migrate→contract steps so the contract step is always deferrable; (3) catastrophic recovery = restore from the weekly export (D13) — free tier has no PITR **[FREE-TIER RISK]**.
- The Supabase dashboard is read-only by policy (D14.1); any object created there does not exist as far as this plan is concerned.

## 8.11 Deliberately not modeled — and each one's extension point

Every exclusion below is a decision with a designed re-entry path, so future phases extend rather than refactor (brief §62: escape hatches, not scaffolding).

| Not modeled (phase) | Extension point when its phase arrives |
|---|---|
| Payments/marketplace (P4+, C11) | `resources.price_cents` exists CHECK-pinned to null; new `transactions` table keyed by `resource_id` + buyer profile; `resources.status` vocabulary extensible by CHECK migration. Nothing else pre-built — Mercado Pago/AFIP analysis first (PART 15) **[LEGAL REVIEW]** |
| Professor pages/reviews (P3+, C9) | new `profesores` + `catedras` tables keyed to `materia_id` + período; content tables untouched (posts/resources would gain one nullable FK). No professor names in any MVP column — they may appear only inside free text, moderated per PART 11 **[LEGAL REVIEW]** |
| `archive_entries` (P3) | new curated table referencing content by `public_id` text (not FK — archive entries may outlive purged rows); yearly stats come from `events`. PART 16 owns the design |
| Polls (P2) | `posts.kind` CHECK gains `'encuesta'`; new `poll_options` / `poll_votes` tables FK'd to posts |
| Bookmarks (P2) | `(user_id, post_id)` table, same shape as `materia_follows` |
| Mentions (P2) | `notifications.type` gains `'mencion'`; parser in create_comment |
| Resource reviews beyond upvote (P2) | new `resource_reviews` table; `resource_votes` stays as-is |
| Email digests / full notification prefs (P2) | prefs v1 is the single `profiles.notif_respuestas` boolean (§0.5-R14); P2 adds `notification_prefs jsonb` (or narrow columns) on profiles; `notifications` unchanged |
| Comment FTS | additive generated column + GIN on `comments` (§8.3.3) |
| Trigram search (`pg_trgm`) | install extension + GIN trgm indexes on `materias.nombre`, `profiles.handle` |
| Post revision history | `post_revisions` table written by `update_own_post`; current schema keeps only `edited_at` |
| Academic calendar entries (C14) | new `calendario_eventos` table per facultad per año, seeded from APPENDIX A §D; nothing in MVP depends on it |
| Realtime/badges/leaderboards | no extension point on purpose — excluded by D2/C10; would require fresh design review |

Everything in this part is buildable today, from this document, as migration set 0001–0012, with APPENDIX A as its only data dependency.






