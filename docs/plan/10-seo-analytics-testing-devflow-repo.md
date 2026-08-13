# PART 23 — SEO

**Decision:** Public content (home logged-out, materias, carreras, facultades, recursos metadata, posts) is fully indexable with server-rendered metadata, segmented sitemaps, and minimal JSON-LD; identity-adjacent and utility surfaces (perfiles, buscar, avisos, ajustes, mod, tombstones) are excluded. SEO is not marketing here — it is the delivery mechanism of the SIEMPRE dimension (D1): a 2036 student finds 2026 through Google, and a 2026 student finds the platform through "resumen <materia> uca". The long-tail academic query universe is winnable because nobody else serves it.

## 23.1 Indexing policy matrix

The policy resolves brief §29's tension ("public content discoverable" vs "privacy-sensitive anonymous content should not automatically be indexed") the way C16 resolves it: **content is indexable, identity is not.**

| Surface | URL | Index? | Mechanism | Reason |
|---|---|---|---|---|
| Home (logged-out) | `/` | Yes | SSR, self-canonical | Entry page; explains the product; live recent activity for freshness |
| Reciente | `/reciente` | Yes | SSR, canonical to page 1 | Freshness signal; crawl discovery of new posts |
| Materias index + pages | `/materias`, `/materias/[slug]` | Yes | SSR + ISR | The permanent asset; primary landing pages for academic queries |
| Carreras / Facultades | `/carreras/[slug]`, `/facultades/[slug]` | Yes | SSR + ISR | "plan de estudios" queries; hub pages of the crawl mesh |
| Posts | `/p/[publicId]` | **Yes** | SSR | See justification below |
| Recursos index + detail | `/recursos`, `/recursos/[publicId]` | Yes (metadata page only) | SSR; files behind auth + signed URLs, never crawlable | The utility magnet; the file itself is never public (PART 14) |
| Perfiles | `/u/[handle]` | **No** | `noindex,follow` meta; crawl allowed so the tag is seen | A pseudonym's aggregated history in Google is a linkage/doxxing amplifier; profiles are for in-community trust, not discovery |
| Buscar | `/buscar` | No | robots.txt `Disallow` | Infinite parameter space; crawl-budget trap; zero landing value |
| Avisos, Ajustes | `/avisos`, `/ajustes` | No | auth-gated + `noindex` + robots `Disallow` | Private surfaces |
| Mod panel | `/mod/*` | No | auth-gated + robots `Disallow` | Never public |
| Auth flows | `/ingresar`, `/registro`, `/invitacion/*` | No | `noindex`; robots `Disallow` on `/invitacion/` | Invite codes must never enter an index |
| Deleted/removed content | `/p/[publicId]` (status ≠ activo) | No | HTTP 410 Gone + tombstone page | 410 (not 404) actively deindexes; supports the deletion promise (C6) |
| Legal pages | `/terminos`, `/privacidad`, `/reglas`, `/acerca` | Yes | SSR static | Trust signals; cheap |

### Why posts are indexable (the call brief §29 hedges on)

Considered: (a) noindex all posts, index only materias/recursos; (b) index only posts with a title or above a score threshold; (c) index all active posts.
Chosen: **(c) index all active posts.**
Why: The anonymity model (D3) already did the privacy work — a post is either signed by a pseudonym the user chose for public life, or carries *zero* author fields. There is no real-name surface for Google to expose. Meanwhile posts are the only place where the questions people actually google ("¿qué tan difícil es Filosofía del Derecho en la UCA?") get answered — that content ranking IS the 2036 discovery mechanism and the strongest organic growth channel (D11 depends on it). Selective indexing (b) adds a moving policy surface for near-zero privacy gain, and creates "why is my post not on Google" ambiguity.
Cost: A regrettable-but-not-deleted post is findable by search; mitigated by user edit/delete rights (soft-delete → 410 → deindex within days) and the plain-language warning at composer level: **"Todo lo que publicás es público. Tu identidad real no."** (C16). We accept the residual risk explicitly.

## 23.2 Metadata recipe per page type

All titles ≤ 60 visible characters where possible, es-AR, site name suffixed. The site name comes from the single config constant (D10) — every pattern below writes `| uca.net` but renders `SITE_NAME`.

| Page | `<title>` pattern | Example |
|---|---|---|
| Home | `{SITE_NAME} — La comunidad estudiantil de UCA Rosario` | `uca.net — La comunidad estudiantil de UCA Rosario` |
| Materia | `{materia} — Resúmenes, parciales y discusión \| {SITE_NAME}` | `Derecho Constitucional — Resúmenes, parciales y discusión \| uca.net` |
| Carrera | `{carrera} en UCA Rosario — Plan de estudios y comunidad \| {SITE_NAME}` | `Abogacía en UCA Rosario — Plan de estudios y comunidad \| uca.net` |
| Facultad | `{facultad} — Carreras y actividad \| {SITE_NAME}` | `Facultad de Derecho — Carreras y actividad \| uca.net` |
| Post (con título) | `{title} \| {SITE_NAME}` | `¿Conviene cursar Romano en verano? \| uca.net` |
| Post (sin título) | first ~55 chars of body, word-truncated, `… \| {SITE_NAME}` | `Alguien tiene el cronograma de parciales de segundo… \| uca.net` |
| Recurso | `{Tipo} de {materia}{ (año)}: {title} \| {SITE_NAME}` | `Resumen de Derecho Constitucional (2026): Unidades 1 a 7 \| uca.net` |
| Recursos index | `Recursos de estudio — Resúmenes, apuntes y parciales \| {SITE_NAME}` | — |
| Paginated lists | prefix `{base} — Página {n}` for n ≥ 2 | `Derecho Constitucional — Página 3 \| uca.net` |

**Descriptions.** Generated, never hand-written: materia = deterministic template with live counts ("Resúmenes, apuntes y parciales de {materia} en UCA Rosario. {n_recursos} recursos, {n_posts} publicaciones de estudiantes."); post = first 155 chars of body, word-truncated, markdown stripped; recurso = its own description field truncated, else template. Counts are read at render and cached with the page (ISR) — never a live query per crawl hit. Numbers in descriptions are a CTR feature: "34 recursos" beats prose.

**Canonical rules.** Every indexable page emits an absolute self-canonical. `/p/[publicId]` accepts an ignored slug suffix (D7) but always canonicalizes to the bare `/p/[publicId]` — the short form is the durable 10-year contract. Query-parameter variants (utm, ordering) canonicalize to the clean URL. Paginated pages self-canonicalize with `?pagina=n` preserved (canonicalizing page 2 to page 1 hides deep content from the index). `rel=next/prev` is not emitted — Google ignored it since 2019; discovery of deep pages is handled by sitemaps and visible pagination links instead.

## 23.3 Open Graph strategy

**Decision: one static branded OG image at MVP; per-page OG image generation is P2.** WhatsApp sharing is a named growth channel (D11) so OG *text* must be excellent: `og:title`/`og:description` mirror the metadata recipe; `og:type=article` on posts/recursos, `website` elsewhere; `og:locale=es_AR`. The image is a single 1200×630 static PNG (wordmark on paper-white, azul birome accent, ≤ 60 KB) in `public/og-default.png`. Per-page image generation (`@vercel/og` / satori) is an edge function invocation per share-crawl — spendable Hobby compute and one more thing to break for cosmetic gain at MVP scale. **[FREE-TIER RISK]** if added carelessly at P2: bot-driven OG rendering is unmetered-by-us traffic; when revisited, images must be generated at publish time and stored, not rendered per request.

## 23.4 JSON-LD

Minimal, truthful, three types only:

- **`DiscussionForumPosting`** on post pages: `headline`, `articleBody` (truncated 500 chars), `datePublished`, `interactionStatistic` (comments, upvotes), `author`: `{"@type":"Person","name":"<handle>"}` for signed posts, `{"@type":"Person","name":"Anónimo"}` for anonymous ones — never a URL to the profile from anonymous content. Comments included as `comment` nodes only for the top level.
- **`ItemList`** on `/materias` and on carrera plan-de-estudios pages (ordered list of materia URLs) — makes hub pages legible as catalogs.
- **`BreadcrumbList`** on materia/carrera/facultad/post/recurso pages mirroring the visible breadcrumb (facultad → carrera → materia → post).

**Explicitly NOT emitted: `EducationalOrganization`, `Course`, `CollegeOrUniversity`.** Marking our pages up as the university's educational offerings is exactly the institutional-affiliation implication D10 and the site-wide disclaimer exist to avoid — structured data claiming we *are* or *represent* UCA could be cited in a trademark/confusion complaint. **[LEGAL REVIEW]** — confirm that `DiscussionForumPosting` + plain-text mentions of "UCA Rosario" as the community's subject stay on the right side of nominative fair use. Resource pages get no `LearningResource` markup at MVP (revisit P2 with counsel; it edges toward "educational provider" territory).

## 23.5 Sitemap architecture and robots.txt

**Sitemaps are route handlers with 24-hour ISR caching — no cron consumed.** Hobby crons run at most once daily, and the daily `/api/cron/aggregates` cron is already spoken for (D6; backups run on weekly GitHub Actions per PART 20 §20.9). A sitemap that regenerates on first request after cache expiry is operationally identical to "regenerated daily" at zero scheduling cost. Flag for PART 20: keep it this way.

Structure (index + segments, each ≤ 10,000 URLs — far under the 50k spec limit, sized for our decade):

```
/sitemap.xml                  → index, lists the segments below
/sitemaps/estaticas.xml       → home, /materias, /carreras, /recursos, legal pages
/sitemaps/materias.xml        → all materia pages (lastmod = last content activity)
/sitemaps/carreras.xml        → carreras + facultades
/sitemaps/recursos.xml        → active resource metadata pages
/sitemaps/posts-YYYY-MM.xml   → active posts bucketed by creation month
```

Monthly post buckets mean old segments become byte-stable (cheap to serve, crawlers learn to skip them) while the current month churns — the archive accretes without the sitemap becoming one giant regenerating file. Deleted content simply drops out of the segment; the 410 does the deindexing.

**robots.txt** (served from `app/robots.ts`):

```
User-agent: *
Disallow: /api/
Disallow: /mod/
Disallow: /ajustes
Disallow: /apelacion
Disallow: /avisos
Disallow: /buscar
Disallow: /ingresar
Disallow: /registro
Disallow: /invitacion/

Sitemap: https://<domain>/sitemap.xml
```

`/u/` is deliberately *not* disallowed: crawlers must fetch profile pages to see the `noindex` meta; a robots block would leave bare URLs indexable from external links.

### AI-crawler stance **[HUMAN DECISION]**

Considered: block GPTBot/ClaudeBot/Google-Extended/CCBot et al; allow all; allow with rate expectations.
Chosen (recommended): **allow all AI crawlers — no AI-specific Disallow rules.**
Why: The mission is to be the durable public memory of UCA student life (brief §2, §66). Presence in training corpora and AI-search indices (ChatGPT, Claude, Gemini citations) is a 2030s discovery channel exactly analogous to Google in the 2010s; blocking it optimizes for a content-licensing position we will never monetize while shrinking the archive's reach. The content is already deliberately public and pseudonymous — the privacy analysis of 23.1 covers this case too.
Cost: Community content becomes training data with no compensation, and some students may dislike that; crawler traffic adds Vercel bandwidth load (HTML only — files are auth-gated and never crawlable, so Supabase egress is unaffected). This is a values call about the community's content, not a technical one — founder must ratify, and the stance must be stated in `/privacidad` either way so users consent knowingly.

## 23.6 The query universe we win

We do not compete for head terms ("UCA", "UCA Rosario" — the university owns those). We win the long tail no one serves:

| Query intent (examples) | Volume shape | Landing page | Ranking asset |
|---|---|---|---|
| "resumen derecho constitucional uca", "apuntes {materia} uca rosario" | Long tail × every materia, spikes at parciales | Materia page (Recursos tab) / recurso page | Resource titles + counts in metadata; the only site with the actual files |
| "parcial {materia} uca", "final {materia} modelo" | Exam windows (feb–mar, jul–ago, nov–dic) | Recursos filtered by tipo | `tipo` enum in titles ("Parcial de…") |
| "qué tan difícil es {materia} en la uca", "{materia} uca opiniones", "conviene cursar {materia} en verano" | Steady trickle, high intent | Post pages, materia page (Publicaciones) | Indexable posts (23.1) — this intent is unanswerable by official sites |
| "plan de estudios {carrera} uca rosario", "materias de {carrera} uca" | Steady, prospective students | Carrera page | ItemList markup + full plan grid |
| "foro uca rosario", "comunidad estudiantes uca" | Tiny | Home | Brand queries arrive after word-of-mouth |
| "profesor {nombre} uca" | — | **Deliberately not targeted** | C9: no professor pages in MVP; we do not build landing surfaces for person-queries |

Seasonality note for PART 24's metrics: organic impressions will breathe with the academic calendar (C14). A February traffic crater is not decay.

## 23.7 Interlinking design — the crawl mesh

Every content node must be reachable from a hub in ≤ 3 clicks, and every page must link upward and sideways; orphan pages are forbidden by construction:

- **Materia page** → its carreras (via `plan_materias`), its facultad breadcrumb, latest N posts, top N recursos, related materias (same carrera+año).
- **Carrera page** → facultad, full materia grid by año/cuatrimestre, recent activity across its materias.
- **Post page** → breadcrumb to its materia (when tagged), "Más en {materia}" block of 5 recent posts, author profile (signed posts only).
- **Recurso page** → its materia, "Otros recursos de {materia}" block, author profile (signed only).
- **Home (logged-out)** → recent posts, most-active materias this week, carreras index.
- **Footer (all pages)** → `/materias`, `/carreras`, `/recursos`, `/reciente`, legal pages, the independence disclaimer (D8).

The mesh is why materia pages rank: hundreds of internal links converge on them, and they in turn distribute authority to fresh posts within a crawl cycle.

## 23.8 Launch-SEO checklist (gate to Lanzamiento abierto, PART 28)

1. Every route in the matrix (23.1) verified for its index/noindex/410 behavior in production (curl + `?` inspection, not assumptions).
2. Sitemap index submitted in Google Search Console; domain property verified; coverage report clean of unexpected exclusions.
3. Titles/descriptions spot-checked on 10 materias, 10 posts, 5 recursos against the recipe (23.2).
4. OG preview validated in WhatsApp (primary share channel), plus one X/Facebook debugger pass.
5. JSON-LD passes the Rich Results test on one post, one materia, one carrera.
6. 410 tombstone verified: create → delete → confirm 410 within the same day.
7. `robots.txt` and `noindex` on staging/preview deployments (Vercel previews must never index — `X-Robots-Tag: noindex` header on all non-production deployments).
8. Search Console alerting email → founder inbox; check "Página 2+" pagination is being crawled.
9. Baseline recorded in the events table: `seo_impresiones` not tracked in-product — Search Console is the source of truth; record the launch-week numbers in `docs/decisions.md` for the 6-month comparison.

Google Search Console is part of the SEO toolchain by design: free, external to the product, and involving no on-site user tracking — it is how SEO landings are measured without touching PART 24's stance.

---

# PART 24 — ANALYTICS & OBSERVABILITY

**Decision:** No cookies, no fingerprinting, no third-party analytics script, no per-user behavioral log. Product analytics = one aggregate `events` counter table plus a single `last_seen_day` date column on profiles; observability = Sentry (scrubbed) + structured function logs + UptimeRobot. The privacy stance is product identity, stated verbatim in `/privacidad`, and it is also the cheapest possible implementation — the ethical choice and the free-tier choice coincide.

## 24.1 The privacy stance (public commitment)

Published in `/privacidad` in es-AR, in substance: **"No usamos cookies de seguimiento ni análisis de comportamiento individual. Contamos eventos en forma agregada (por día, sin identificarte) y guardamos una sola fecha en tu perfil: el último día que usaste el sitio. Nada más."** The Privacidad inventory adds one line for search analytics: "Guardamos las búsquedas en forma normalizada y agregada por día, sin vincularlas a tu cuenta; se borran a los 12 meses." (the `search_queries` table, §0.5-R10).

Binding consequences: no client-side analytics SDK of any kind; no pageview beacons; no session replay ever; no A/B testing infrastructure at MVP (with hundreds of users the statistics are noise anyway); IP addresses are never written to any table we own (Vercel/Supabase transport logs exist upstream and are named as such in Privacidad **[LEGAL REVIEW]** — the policy must accurately describe processor-level logging under Ley 25.326).

## 24.2 The `events` table

Aggregate-only counters, day-bucketed, incremented via a SECURITY DEFINER function so RLS can deny all direct access:

```sql
create table events (
  name  text    not null,
  day   date    not null default (now() at time zone 'America/Argentina/Cordoba')::date,
  dim   text    not null default '',   -- optional low-cardinality dimension, '' = none
  count integer not null default 0,
  primary key (name, day, dim)
);
-- RLS: no policy for anon/authenticated (deny-all). Read path: admin-only view for /mod/metricas.
-- Write path: security definer function track_event(p_name text, p_dim text default '')
-- doing INSERT ... ON CONFLICT (name, day, dim) DO UPDATE SET count = events.count + 1.
```

`dim` rules: only enum-like values with bounded cardinality (a `tipo` of recurso, a report `categoria`, a feed tab name). Never a user id, never a materia id (hundreds × events × days = row explosion and a de-facto content log), never free text, never a search query. The one sanctioned free-text store is the separate `search_queries` table (day-bucketed normalized queries, no user linkage ever, purged after 12 months — DDL in PART 8, redaction rules per PART 13 §13.8); `events` stays closed to free text regardless. Worst-case growth: 15 events × ~6 dims × 365 days ≈ 33k rows/year, kilobytes — irrelevant to the 500 MB budget.

Calls to `track_event` happen inside the Server Action that performs the underlying write (one extra statement in the same transaction where possible), or fire-and-forget after reads like `busqueda`. A failed track must never fail the user's action.

## 24.3 The MVP event catalog (14 events — closed list)

Adding an event requires a line in `docs/decisions.md` (D14 rule 8 spirit). The catalog:

| # | Event | Incremented when | `dim` |
|---|---|---|---|
| 1 | `registro_completado` | onboarding finished (handle chosen) | — |
| 2 | `invitacion_usada` | valid invite consumed at registration | — |
| 3 | `post_creado` | post insert commits | `texto` / `pregunta` |
| 4 | `post_anonimo` | post insert with `is_anonymous` | — |
| 5 | `comentario_creado` | comment insert commits | `anonimo` / `firmado` |
| 6 | `voto_emitido` | any upvote cast (not un-cast) | `post` / `comentario` / `recurso` |
| 7 | `recurso_subido` | resource passes upload + validation | tipo enum |
| 8 | `recurso_descargado` | signed URL issued | tipo enum |
| 9 | `busqueda` | search executed | — |
| 10 | `busqueda_sin_resultados` | search returned 0 hits | — |
| 11 | `materia_seguida` | follow created | — |
| 12 | `reporte_creado` | report submitted | categoria enum |
| 13 | `cuenta_eliminada` | account deletion completed | `borrar` / `conservar` (D3 choice) |
| 14 | `dau` | see 24.4 | — |

`busqueda_sin_resultados` is the highest-leverage counter in the list: it is the seed-content to-do generator (which materias people want and we lack) without logging a single query string.

## 24.4 Daily/weekly/monthly actives — the mechanism

Considered: (a) per-day table of daily-rotating hashed user ids, counted then purged; (b) an `active_weeks(user_id, iso_week)` presence log; (c) a single `profiles.last_seen_day date` column, overwritten in place, plus an increment-only DAU counter.
Chosen: **(c) `last_seen_day` + increment-on-advance.**
Why: It is the simplest mechanism that is still honest. On any authenticated server request, if `profiles.last_seen_day < current_date` (ART timezone), one function sets it to today AND increments `events('dau', today)` — exact DAU with no cron dependency, no hash pepper to manage, no per-user history whatsoever (the column holds only the latest date; yesterday's value is destroyed by the update, so past behavior is unreconstructable even by us). WAU/MAU are computed at the nightly aggregates cron as `count(*) where last_seen_day >= current_date - 6 / - 29` and written into `events` as `wau`/`mau` snapshots. Option (a) rotating hashes cannot produce WAU/MAU or retention (day-scoped hashes don't join across days); option (b) is a genuine per-user activity log — precisely what the stance forbids.
Cost: We store one date per account (disclosed in 24.1 — it doubles as the dormant-account signal for lifecycle jobs, PART 16). Retention cohorts are computed only as weekly snapshots: each Monday the aggregates cron counts, per registration-week cohort, members with `last_seen_day` in the prior week, written as `events('retorno_semanal', day, dim = 'cohorte-YYYY-WW')`. Registration week derives from `profiles.created_at` — data we hold anyway. Beta cohorts are ≤ 50 users; this resolution is sufficient for the D11 gate.

## 24.5 Metrics that matter, per phase (with the beta gate numbers)

Per D11 the gate to open registration is: **≥ 40% of beta users return in week 2** and **≥ 30 organic posts/week**. The full instrument panel, kept to one screen:

| Phase | Question | Metric | Target |
|---|---|---|---|
| Beta (activation) | Do invited students join? | `registro_completado` / invites sent | ≥ 60% |
| Beta (activation) | Do they act in week 1? | members with ≥ 1 post/comment/upload in first 7 days | ≥ 40% |
| Beta (retention) | Do they come back? | `retorno_semanal` cohort W2 | **≥ 40% (gate)** |
| Beta (density) | Is the cohort alive? | organic posts/week (`post_creado` minus founder-seeded) | **≥ 30 (gate)** |
| Beta (density) | Are materias alive? | materias with ≥ 3 posts/week | ≥ 5 |
| Beta (utility) | Does the magnet pull? | `recurso_descargado` / week | ≥ 100 during parciales window |
| Beta (utility) | Does search satisfy? | `busqueda_sin_resultados` / `busqueda` | ≤ 30%, trending down |
| Beta (identity) | Does anonymity work as valve, not default? | `post_anonimo` / `post_creado` | 10–40% band (near-0% = feature unused; near-100% = pseudonym layer failed — either extreme triggers a design review) |
| Open (growth) | Does SEO deliver? | Search Console clicks/week (external) | +20% month-over-month during cursada |
| Open (safety) | Is moderation keeping up? | median report age in queue | < 24 h |

All targets are calendar-adjusted (C14): compare parciales weeks to parciales weeks, never to February.

## 24.6 Dashboards

**`/mod/metricas`** (admin-role only, inside the PART 11 mod panel): a server-rendered page reading the `events` table — last 14 days per event as plain numeric rows and text sparklines, the gate metrics of 24.5 pinned on top, plus the quota panel (DB size, storage bytes, egress estimate — PART 21 feeds these). No charting library; a `<table>` and inline SVG suffice and honor D8 density. No external analytics UI exists to check, which is the point: one place, our data.

**Vercel Web Analytics: OFF.** Considered / Chosen / Why / Cost — Considered: enabling it (cookieless, free toggle). Chosen: off at MVP. Why: it injects a client script (against 24.1's "no analytics SDK"), duplicates the events table as a second source of truth, and the Hobby allowance is a few thousand events/month (number unverified — reconcile in PART 21), which real traffic would exhaust in days, producing misleading truncated data. Cost: we forgo easy pageview/referrer breakdowns; Search Console covers the organic slice, which is the slice we act on. Revisit only if a specific referrer question blocks a growth decision.

## 24.7 Observability (brief §34)

**Errors — Sentry free tier**, client + server. Configuration is a compliance surface, not a default install: `sendDefaultPii: false`; no `Sentry.setUser` at all (correlation via a per-request random id attached to both the Sentry event and our logs); `beforeSend` strips request bodies, cookies, all headers except method/route, and runs a regex redactor for emails and bearer tokens over the message and breadcrumbs; breadcrumbs for fetch/xhr limited to URL path without query strings. Free-tier quota (~5k events/mo, unverified — PART 21 reconciles) demands `ignoreErrors` for browser-extension noise and `sampleRate` tuning if a crash loop ever hits. Alert rule: any new server-side issue → email, immediately — at our scale every server error is worth reading.

**Structured logs** in server functions: one JSON line per Server Action/route handler — `{ ts, request_id, action, user_id (internal uuid), outcome, duration_ms, error_code }`. Log: action names, ids, durations, rate-limit denials, auth failures (by uuid, aggregated), quota warnings. NEVER log: post/comment bodies, titles, search queries, emails, handles-with-uuid pairs beyond what the line needs, tokens/secrets/signed URLs, file names, invite codes. Vercel Hobby retains logs briefly (order of hours/days — unverified); logs are for live debugging, Sentry is the durable error memory. That asymmetry is accepted: we are not building a log warehouse for a community forum.

**Uptime — UptimeRobot free** pinging `GET /api/health` every 5 minutes, alerting to founder email. `/api/health` returns 200 + `{ db: ok }` after a 1-row Postgres query — so the monitor also detects Supabase pauses/outages, and its steady traffic contributes to keeping the free-tier project unpaused (C7's cron ping remains the guarantee). Considered: a GitHub Actions cron curling the endpoint. Rejected: Actions cron schedules drift by design (minutes to hours), have no alerting semantics without extra wiring, and burn CI minutes to reimplement a solved free service. Cost of UptimeRobot: one more third-party account, with a 2-minute exit (repoint any pinger at the same endpoint).

## 24.8 Weekly ops review (15 minutes, Fridays — ritualized in PART 26)

Fixed agenda, in order, timeboxed: (1) quotas — Supabase DB size / storage / egress vs the 70% triggers of D13 **[FREE-TIER RISK]**, 3 min; (2) Sentry — new issues this week, triage or mute, 4 min; (3) mod queue — count, median age, anything ugly, 3 min; (4) `/mod/metricas` — gate metrics + `busqueda_sin_resultados` for the seed-content list, 4 min; (5) one line in `docs/decisions.md` if anything changed, 1 min. If the review takes more than 15 minutes twice in a row, something is structurally wrong — file it as a risk in PART 33's register rather than absorbing it.

---

# PART 25 — TESTING STRATEGY

**Decision:** The test pyramid is inverted from startup habit: the *database policy suite* (pgTAP) is the critical layer because RLS is the only wall between anonymity and exposure, and because AI-generated application code must be assumed wrong until a test says otherwise (brief §42–43). Unit tests cover pure logic, integration tests cover the 10 critical Server Actions against a real local Supabase, Playwright covers 6 golden flows, axe covers a11y on key pages. Full CI under 10 minutes.

## 25.1 Layer 1 — pgTAP RLS/policy tests (the critical suite)

Run via `supabase test db` against a migrated local database. Every policy has an allow AND a deny test (D14 rule 2). The suite that must exist before beta — enumerated, non-negotiable:

**Anonymity (the product promise):**
1. `posts_public` / `comments_public` views return NULL/absent author fields for every row where `is_anonymous = true` — asserted column-by-column (no author_id, handle, karma, timestamps-of-author, nothing).
2. Base tables `posts`, `comments`, `resources` grant no direct SELECT to `anon` or `authenticated` — a raw select fails even for the row's own author (authors read their own content through the app path).
3. `anon_aliases` is unreadable by `anon` and `authenticated` under any predicate; alias numbers surface only through the public comment view's computed label.
4. Two anonymous comments by the same author in the same thread get the same alias; the same author in a *different* post's thread gets an independently assigned alias (no cross-thread stability).
5. A user's own profile row never exposes email (email lives in `auth.users`, not `profiles` — test that no view joins it).

**Authorization:**
6. Non-mod cannot SELECT `reports`, `mod_actions`, `user_restrictions`; mod can; admin can.
7. A user can report content but cannot read other users' reports (own-report readback per PART 11's design only).
8. Mod actions INSERT is denied to role `user` even with crafted payloads; `mod_actions` UPDATE/DELETE is denied to everyone including mods (immutable audit).
9. Every mod-visible action writes a `mod_actions` row — the SECURITY DEFINER mod functions are tested to refuse the action if the audit insert fails (same transaction).

**Integrity & abuse:**
10. Voting twice on the same target hits the PK `(target_id, user_id)` and the vote function is idempotent (second call = no-op or un-vote per PART 8's toggle spec, but never count 2).
11. A suspended user (active `user_restrictions` row): post insert, comment insert, vote, resource upload, and report-spam all fail at the database function level — tested for each write path, not just posts.
12. Handle rename before the 90-day cooldown fails in the database (not only in the UI); rename after 90 days succeeds; no history row is publicly readable.
13. The rate-limit function blocks the N+1th write in the window for posts, comments, votes, reports (test at the boundary: N passes, N+1 fails, other-user unaffected). Limits per PART 10.
14. `comments.depth` > 2 insert fails (constraint), `resource_files.size_bytes` > 10 MB fails, invite `uses > max_uses` fails, expired invite fails.

**Lifecycle:**
15. Content with status `eliminado_autor`/`eliminado_mod` is absent from every `_public` view and from FTS results; counters exclude it.
16. Account-deletion function: profile anonymized to `usuario-eliminado-*`, auth linkage severed, content disposition matches the user's D3 choice, `mod_actions` retain the internal UUID.
17. `events` table: deny-all for both anon and authenticated roles; `track_event` function works for authenticated context; admin metrics view readable by admin only.
18. Storage policies: object read requires auth; path traversal / foreign-bucket access denied (mirror of PART 10's storage rules, exercised via policy tests where the CLI supports it, else covered in Layer 3).

## 25.2 Layer 2 — Vitest unit tests

Pure logic only, no I/O, milliseconds each: every Zod schema (accept/reject tables per field, es-AR error messages present); the feed ranking formula (given fixed inputs, ordering is exact — the "understandable feed" promise of brief §16 is a testable property); slug generation (unaccenting "Introducción al Derecho" → `introduccion-al-derecho`, collision suffixing, idempotence); nanoid public-id shape (length 10, alphabet, no ambiguous chars per D7); alias-label formatting ("Anónimo 3"); date/cuatrimestre helpers (ART timezone edges — the 23:59 post lands on the right `day` bucket for 24.2); text truncation for titles/descriptions (word-boundary, ellipsis, ≤ limits from 23.2).

## 25.3 Layer 3 — Server Action integration tests (against local Supabase)

Vitest, sequential, hitting a `supabase start` stack with migrations + seed applied; each test authenticates as a fixture user and calls the real Server Action module. The 10 critical actions: (1) register-via-invite + onboarding (handle claim, race on duplicate handle); (2) createPost signed and anonymous (verify public payload of the anonymous one has no author); (3) createComment with reply-depth and alias assignment end-to-end; (4) toggleVote (cast, un-cast, re-cast, score cache correct); (5) followMateria / unfollow reflected in Mis materias feed query; (6) uploadResource (happy path + oversize + wrong MIME rejected server-side); (7) requestDownload (signed URL issued, `downloads_count` incremented, `recurso_descargado` tracked); (8) submitReport (categoria required, rate-limited); (9) modRemoveContent (content vanishes from public views, audit row written, author notified per PART 11); (10) deleteAccount (both disposition branches). These ten cover every table the MVP writes.

## 25.4 Layer 4 — Playwright smoke E2E (the 6 golden flows)

Runs against the Vercel preview deployment of the PR (real infrastructure, seeded staging Supabase project). Two projects: desktop Chromium 1280×800 and mobile WebKit 390×844 — the mobile run is mandatory, not optional (brief §26). The six golden flows (must match PART 6's definitions exactly; PART 6 owns the list — flag for consistency): (1) invitación → registro → onboarding → feed Mis materias populated; (2) crear post anónimo → appears in Reciente with "Anónimo", author's profile shows nothing; (3) comment on a post → author sees the aviso and navigates to the thread; (4) buscar "constitucional" → open materia → download a recurso (file received); (5) follow a materia → its new post appears in Mis materias; (6) report a post → mod logs in → removes it → tombstone/410 for visitors. Logged-out reading of home/materia/post is asserted inside flows 2 and 4 rather than as a seventh flow.

## 25.5 Accessibility checks

`@axe-core/playwright` assertions appended to the golden flows on five key page types: home, feed, materia page, post page (with comments), composer form. Zero `serious`/`critical` violations is the gate; `moderate` findings become backlog items. This automates the floor; the human a11y pass (keyboard-only walkthrough, focus visibility) lives in the definition of done (PART 26) because axe cannot test focus *quality*.

## 25.6 What we deliberately do NOT test

Pixel styling and visual regression (no screenshot suite — the design system's restraint (D8) makes drift low-stakes; a visual diff pipeline costs more than it protects at one-dev scale); third-party internals (Supabase Auth's email delivery, Resend templates rendering, Vercel routing); load/perf testing (PART 22 budgets + real monitoring replace synthetic load at this scale); exhaustive browser matrix (Chromium + WebKit only; Firefox by manual spot-check quarterly). Every exclusion is a bet named here so it can be revisited when its premise breaks.

## 25.7 CI layout (GitHub Actions), budget < 10 min

| Job | Runs on | Contents | Budget |
|---|---|---|---|
| `check` | every push | `tsc --noEmit`, ESLint (incl. boundary rules PART 27), Prettier check, forbidden-pattern grep (25.8) | 2 min |
| `unit` | every push (parallel) | Vitest Layer 2 | 1 min |
| `db` | every push (parallel) | `supabase start` (ephemeral in CI) → apply migrations → pgTAP (`supabase test db`) → `supabase gen types` diff check (generated types committed and current — drift fails CI) | 3–4 min |
| `integration` | PRs (parallel) | Layer 3 against the same local stack (shares the `db` job's container via job chaining) | 2 min |
| `e2e` | PRs, after Vercel preview ready | Playwright 6 flows × 2 viewports + axe | 4 min |

Push-to-branch runs check+unit+db (≈ 4 min wall-clock in parallel); full PR pipeline ≈ 8–9 min wall-clock. If e2e exceeds its budget, flows are pruned back to 6 — the count is a cap, not a floor. `main` is deployable only with all five green; there is no manual-QA gate because there is no QA team.

## 25.8 The "AI wrote it" review protocol (brief §43)

Every AI-produced diff, before commit — no exceptions for "trivial" changes: (1) **read the whole diff** — never commit unread code; specifically hunt for invented DB columns, silent schema assumptions, and en-US strings in UI; (2) **run** `check` + `unit` + `db` locally; (3) **grep the diff** for forbidden patterns — the greps are a script (`scripts/forbidden.sh`) that CI also runs:

| Pattern | Why it must not appear |
|---|---|
| `service_role`, `SUPABASE_SERVICE_ROLE` | D14 rule 3 — never in app runtime |
| `dangerouslySetInnerHTML` | XSS surface; markdown rendering goes through the sanctioned sanitizer only (PART 10) |
| new `NEXT_PUBLIC_` vars | each one ships to the client; additions require explicit review + `docs/decisions.md` |
| `.from('posts')` / base-table reads in client components | public reads go through `_public` views via server code (D14 rule 5) |
| `security definer` without `set search_path` | privilege-escalation footgun (D5) |
| `create policy` / `alter table` outside `supabase/migrations/` | D14 rule 1 — schema only via migrations |
| `TODO`, `@ts-ignore`, `eslint-disable` (new instances) | AI's favorite rugs; require justification inline |

(4) if the diff touches auth, RLS, anonymity, or uploads, add or extend a test in the relevant layer *in the same PR* — the suite grows with the attack surface, not on a schedule.

---

# PART 26 — DEVELOPMENT WORKFLOW

**Decision:** Solo development runs with team discipline: short-lived branches + PRs (Vercel preview as the review environment), conventional commits, a binding `CLAUDE.md` that encodes the spine's rules for AI tools, ADR-lite decision logging, a fixed migration protocol, and a weekly rhythm with a Friday ops review and a monthly restore drill. The discipline is not ceremony — it is what makes AI assistance safe and the 10-year handoff possible.

## 26.1 Branch & PR discipline (yes, even solo)

`main` is production and always deployable (D12: every phase ends deployed). All work on short-lived branches (`feat/…`, `fix/…`, `db/…`, `docs/…`), merged via PR even with no second human: the PR is where CI runs, where the Vercel preview deploy gives a real environment to click through on desktop *and* phone before merge, and where the AI-review protocol (25.8) has its checkpoint. Branches live days, not weeks — if a branch is a week old, the slice was too big. Squash-merge with a conventional-commit title; branch deleted on merge. Direct pushes to `main` are blocked by branch protection (requiring the CI checks) — the founder can override in emergencies and must log the override in `docs/decisions.md`.

**Conventional commits**: `feat:`, `fix:`, `db:` (migrations), `test:`, `docs:`, `chore:`, `revert:` — scope optional (`feat(recursos): …`). Value at this scale: greppable history and mechanical changelog assembly at each phase gate; no tooling enforcement beyond a regex in CI's `check` job.

## 26.2 CLAUDE.md — the standing instruction file for AI tools

This file is the contract every AI session loads. Draft content (maintained at repo root; updated via PR like code):

```markdown
# CLAUDE.md — ucanet working rules

## What this is
Pseudonymous student community for UCA Rosario (code name "ucanet" — the public
name is a config constant, never hardcode it). One developer, AI-assisted.
Free tiers: Vercel Hobby + Supabase Free. Planning source of truth: docs/plan/
(PART 0 is binding; if code and plan disagree, the plan wins until amended).

## Stack (do not substitute)
Next.js App Router + TypeScript strict + RSC-first. Tailwind v4, tokens in CSS
variables. Supabase (Postgres, Auth, Storage private bucket). Plain SQL
migrations via Supabase CLI — no ORM. Zod at every boundary. Vitest + pgTAP +
Playwright. No new dependencies without an entry in docs/decisions.md.

## Non-negotiable rules (spine D14 — verbatim, binding)
1. Schema changes only via committed SQL migrations — never the dashboard.
2. RLS on for every table; every policy has a pgTAP test proving both the
   allow and the deny.
3. Service-role key never in app runtime; secrets never in client code;
   `NEXT_PUBLIC_` prefix audited.
4. All writes validated server-side with Zod; the client is untrusted, always.
5. Public reads only through the `_public` views; author fields of anonymous
   content never leave the database.
6. Every user-visible string in es-AR; no hardcoded English UI text.
7. Public IDs (nanoid/slugs) in URLs; DB sequence IDs never leave the server.
8. No new dependency without a line in `docs/decisions.md` (what, why, exit path).
9. Rate limits enforced in the database function, not only in middleware.
10. Every feature ships with its moderation surface (can it be reported?
    removed? audited?) or it does not ship.

## Forbidden patterns (CI greps for these — do not produce them)
service_role in app code · dangerouslySetInnerHTML · new NEXT_PUBLIC_ vars ·
client-side reads of base tables · SECURITY DEFINER without SET search_path ·
DDL outside supabase/migrations/ · @ts-ignore · eslint-disable · TODO without
an issue reference · English strings in JSX text position.

## Where things live
- app/            routes only (thin); route groups (public)/(auth)/(me)/(mod)
- features/<domain>/  components + actions.ts + queries.ts + schemas.ts
- components/ui/  shared primitives (no feature knowledge)
- lib/            supabase clients, utils, config (SITE_NAME lives here)
- supabase/       migrations/ seed.sql tests/ (pgTAP) — the db layer
- docs/plan/      the master plan · docs/decisions.md · docs/runbooks/
- e2e/            Playwright + axe

Import boundaries (ESLint-enforced): features never import other features'
internals; ui never imports features; lib imports nothing app-level.

## Migration protocol (always, in order)
new .sql in supabase/migrations → supabase db reset (local) → pgTAP green →
supabase gen types (commit the diff) → PR → apply to prod via CLI only.
Never edit an applied migration; write a new one.

## UI copy
es-AR with voseo, imperative CTAs: "Publicá", "Ingresá", "Comentá", "Guardá".
Sober tone, no exclamation marks, no emoji in UI chrome. When unsure of a
term, prefer the student word: materia, parcial, final, resumen, apunte,
cátedra, comisión, cursada.

## Definition of done (every feature)
Works logged-out where public · mobile 390px checked · keyboard + focus pass ·
RLS tests for new policies · rate-limited if it writes · reportable if it
creates content · es-AR copy reviewed · analytics event if in the PART 24
catalog · docs updated (decisions.md if a decision was made).

## When unsure
Do not invent schema, endpoints, or copy. Stop and ask, or open docs/plan/
and cite the PART that decides it.
```

## 26.3 docs/decisions.md — ADR-lite

One append-only file (splitting into ADR-per-file is bureaucracy at this scale). Format, four lines per entry, newest first:

```markdown
## 2026-09-14 — Resend for auth SMTP
Decision: route Supabase Auth email through Resend free tier.
Why: built-in sender is rate-limited and lands in spam (C15-b).
Exit: swap SMTP creds; no code coupling beyond env vars.
```

What earns an entry: every new dependency (D14 rule 8), every schema-shaping choice not already in the plan, every deviation from a plan PART (with the PART number cited), every emergency override of process, monetization/quota trigger events (D13). The file is the future maintainer's — or future founder's — memory.

## 26.4 The migration protocol (step-by-step, binding)

1. Write `supabase/migrations/<timestamp>_<slug>.sql` — forward-only; destructive changes require a data-preserving path or an explicit decisions.md entry.
2. `supabase db reset` locally — rebuilds from zero: catches ordering bugs and proves the migration chain is replayable (the 10-year portability property, brief §33, exercised weekly by construction).
3. Run pgTAP (`supabase test db`); add allow+deny tests for any new/changed policy *in the same change*.
4. `supabase gen types typescript` → commit the regenerated `types.gen.ts`; CI fails on drift (25.7).
5. PR with CI green; click through the preview deploy (schema-affected flows).
6. Apply to production via `supabase db push` (CLI, from the tagged commit) — **never the dashboard SQL editor** (D14 rule 1). Verify `/api/health` and one affected page.
7. If it went wrong: fix-forward with a new migration. Down-migrations are not maintained; the weekly `pg_dump` (D13) plus fix-forward is the recovery model, and the monthly restore drill (26.5) proves it.

## 26.5 Weekly rhythm

| Slot | Content |
|---|---|
| Mon–Thu | 2 build blocks/day of 2–3 h (deep work, one feature slice each); AI sessions start by loading CLAUDE.md; end each block with tests green, no uncommitted work overnight |
| Fri (30 min) | 15-min ops review (24.8 agenda) + 15-min plan check: current PART 28 phase vs reality, next week's two slices chosen |
| Monthly (1st Friday, +45 min) | **Restore drill** (PART 21): take the latest `pg_dump` export + storage manifest, restore into a scratch Supabase project, boot the app against it, run the 6 golden flows. A backup that has never been restored is a hope, not a backup. Log the result in decisions.md |
| Per phase gate (D12) | Full checklist sweep: launch-SEO checklist (23.8) at S2, RLS suite complete (25.1) at S3, etc. |

Sustainability note: this rhythm is ~20 h/week. The plan's dates (D12) assume it; if the founder's real availability is lower, PART 28's calendar slips *by decision*, not by silent drift — that is what the Friday plan check is for.

## 26.6 Definition of done (the checklist, verbatim from CLAUDE.md)

A feature is done when every line is checked: works logged-out where public? · mobile at 390 px? · keyboard-navigable with visible focus? · new RLS policies pgTAP-tested allow+deny? · rate-limited if it writes? · reportable/removable/audited if it creates content (D14 rule 10)? · es-AR copy read aloud once (voseo, no anglicisms)? · analytics event tracked if in the 24.3 catalog? · docs/decisions.md updated if a decision was made? Nine binary checks; the PR description carries the checklist filled in.

---

# PART 27 — REPOSITORY STRUCTURE

**Decision:** One Next.js app in one repository, organized by **feature folders** (`features/<domain>` holding components + server actions + queries + schemas together) with a small shared `components/ui` primitives layer, `lib` for infrastructure clients/utilities, and the Supabase CLI's `supabase/` directory as the database layer. Import boundaries are enforced by ESLint. No monorepo.

## 27.1 The tree

```
ucanet/
├── app/                          # Routes only — thin files that compose features; no business logic
│   ├── (public)/                 # SSR public surfaces: /, reciente, materias, carreras,
│   │                             #   facultades, recursos, p/, u/, buscar, archivo (P3), legal pages
│   ├── (auth)/                   # ingresar, registro, invitacion/[code], onboarding
│   ├── (me)/                     # authed personal surfaces: ajustes, avisos
│   ├── (mod)/mod/                # moderation panel + /mod/metricas (PART 24)
│   ├── api/
│   │   └── health/route.ts       # uptime endpoint (24.7); other route handlers only when
│   │                             #   Server Actions can't serve (file download redirect, sitemaps)
│   ├── sitemap.ts, robots.ts     # PART 23 outputs, code not static files
│   ├── layout.tsx                # root layout: fonts, theme variables, footer disclaimer (D8)
│   └── globals.css               # Tailwind v4 entry + design tokens as CSS variables (PART 18)
├── components/
│   └── ui/                       # Shared primitives with zero feature knowledge:
│                                 #   button, input, dialog (Radix wrap), list-row, empty-state,
│                                 #   pagination, tabs, breadcrumb — the PART 18 system, nothing more
├── features/                     # The domains. Each folder is self-contained:
│   ├── auth/                     #   invite validation, registration, onboarding steps
│   ├── posts/                    #   composer, post page, comments, votes, anonymity UI
│   ├── feed/                     #   Mis materias / Reciente tabs, ranking query
│   ├── materias/                 #   materia + carrera + facultad pages, follow, plan grid
│   ├── recursos/                 #   upload, listing, download, quota UI
│   ├── search/                   #   FTS query + results page pieces
│   ├── notifications/            #   avisos list, unread count, notification writes
│   ├── mod/                      #   report flows, queue, actions, restrictions, metricas
│   └── analytics/                #   track_event wrapper, last_seen touch (PART 24)
│       └── <each feature>/
│           ├── components/       # feature components (client only where interaction demands)
│           ├── actions.ts        # 'use server' mutations — Zod-validated, auth-checked
│           ├── queries.ts        # server-side reads via _public views / RPC
│           └── schemas.ts        # Zod schemas shared by actions and forms
├── lib/
│   ├── supabase/                 # server.ts, browser.ts, middleware.ts (@supabase/ssr clients)
│   ├── config.ts                 # SITE_NAME + site URL — the D10 single naming constant
│   ├── utils/                    # slug.ts, public-id.ts (nanoid), dates.ts (ART), text.ts (truncation)
│   └── types.gen.ts              # supabase gen types output (committed; CI checks drift)
├── supabase/                     # The database layer (CLI-owned directory)
│   ├── migrations/               # NNNN_name.sql — the schema's only source of truth (D14.1)
│   ├── seed.sql                  # local/dev seed; catalog seed from APPENDIX A
│   ├── tests/                    # pgTAP suite (25.1)
│   └── config.toml               # local stack config
├── e2e/                          # Playwright: 6 golden flows × 2 viewports + axe assertions
├── docs/
│   ├── plan/                     # this document set (PART 0 spine + all parts + APPENDIX A)
│   ├── decisions.md              # ADR-lite log (26.3)
│   └── runbooks/                 # restore drill, incident basics, quota-trigger playbook (D13)
├── scripts/
│   └── forbidden.sh              # the 25.8 grep, run locally and in CI
├── public/                       # og-default.png, favicon set, wordmark svg — static assets only
├── .github/workflows/            # ci.yml per 25.7
├── CLAUDE.md                     # 26.2
├── README.md                     # 30-minute onboarding: setup, commands, links into docs/plan
└── .env.example                  # every env var named + where to get it; no values
```

Deviation from the assignment's `db/` naming, flagged: the Supabase CLI requires `supabase/migrations` and reads pgTAP from `supabase/tests`; inventing a parallel `db/` directory would mean fighting the tool or symlinking. `supabase/` **is** the plan's "db layer" — other PARTs saying "db/" mean this directory. `types.gen.ts` lives in `lib/` because it is consumed as TypeScript, not SQL.

## 27.2 Feature folders vs. type folders

Considered: (a) type-first layout (`components/`, `hooks/`, `server/`, `queries/` as top-level buckets); (b) feature folders with co-located actions/queries/schemas + shared `ui/`; (c) full package split.
Chosen: **(b).**
Why: AI-assisted development is the deciding factor — an AI session pointed at `features/recursos/` sees the entire vertical slice (UI, validation, mutation, read path) in one directory and cannot half-update a feature scattered across five type buckets; this is the single biggest structural lever on AI edit quality (brief §43 "modular, predictable"). It also makes D14 rule 10 auditable per folder (does `features/posts/` contain its report surface?) and keeps deletion honest (removing a feature = removing a folder).
Cost: occasional judgment calls on where shared things go — resolved by a hard rule: used by 2+ features → promote to `components/ui` (visual) or `lib` (logic); no `features/shared/` escape hatch, ever.

## 27.3 Naming conventions

Files: kebab-case (`post-card.tsx`, `use-vote.ts`, `public-id.ts`). Components: PascalCase exports (`PostCard`) — file name kebab, export Pascal. Server actions: English verbs (`createPost`, `toggleVote`) per D9; UI copy inside them es-AR. Database objects: per D9's mixed convention (Spanish domain nouns, English mechanics) — the schema names in D4 are binding. Route segments: Spanish, matching D7's URL map exactly (`app/(public)/materias/[slug]/page.tsx`). Tests: co-located `*.test.ts` for unit; `supabase/tests/NN_topic.sql` for pgTAP; `e2e/NN-flow-name.spec.ts` ordered by golden-flow number.

## 27.4 Import-boundary rules (ESLint-enforced)

Enforced with **`eslint-plugin-boundaries`** (element types: `app`, `features`, `ui`, `lib`), failing CI's `check` job — rules as configuration, not convention:

| From ↓ may import → | app | features | components/ui | lib |
|---|---|---|---|---|
| `app/` | — | yes | yes | yes |
| `features/*` | never | **own feature only** | yes | yes |
| `components/ui/` | never | **never** | yes | yes |
| `lib/` | never | never | never | yes |

The two load-bearing prohibitions: **features never import other features' internals** (cross-feature needs go through promotion to `lib`/`ui`, or through the database — e.g. notifications are written by the posting action via a `lib`-level helper, not by importing `features/notifications`); and **`lib` imports nothing app-level** (it must remain extractable — the 10-year portability of brief §58 starts with `lib/` not knowing what app it serves). Additionally `import 'server-only'` at the top of every `actions.ts`/`queries.ts` file makes server-code-in-client a build error, complementing the boundary lint.

## 27.5 Why not a monorepo / packages split

Considered: Turborepo/pnpm workspace with `apps/web` + `packages/db` + `packages/ui`.
Chosen: single app, single `package.json`.
Why: one developer, one deployable, one deploy target — package boundaries would simulate an org chart that doesn't exist, and every AI edit would pay workspace-resolution and versioning overhead for zero isolation benefit. The properties a monorepo would buy are already obtained cheaper: portability by the ESLint boundaries + `server-only` (27.4), db separation by the `supabase/` directory being pure SQL with no JS dependency in either direction.
Cost: if a second deployable ever appears (the P3 archive as a static export, an admin tool), extraction work is owed then. The boundaries make that extraction mechanical, and paying it later — only if needed — is strictly cheaper than paying workspace overhead for years first.

---

DISSENT — none. One consistency note rather than dissent: this part assumes sitemaps and robots are generated code (`app/sitemap.ts`, `app/robots.ts`) with 24 h revalidation specifically so SEO consumes no cron at all — the single daily `/api/cron/aggregates` cron stays dedicated to keepalive + aggregates + karma + retention, and backups run on weekly GitHub Actions (§0.5-R16); the DAU/WAU/MAU and retention rollups defined in PART 24 ride the existing aggregates cron. PART 20/21/28 should not re-assign cron capacity to SEO tasks.
