# PART 12 — FEED

## 12.1 The two-tab decision

The MVP feed is exactly two tabs, per spine D2: **"Mis materias"** (the posts that concern *you*: followed materias plus your carrera's general chatter, lightly ranked) and **"Reciente"** (the whole site, strictly chronological). Nothing else ships in MVP — no "Para vos", no "Tendencias", no algorithmic home.

Rationale. The unit of community is the cohort (D1); a feed that segments by materia and carrera makes 30 active students feel alive to each other without needing the rest of the university (§0.1). Two tabs also answer brief §16's demand for an *understandable* feed: "Mis materias" is explainable in one sentence, "Reciente" needs zero sentences. Every additional surface would cost ranking code, moderation exposure, and explanation debt before there is content to fill it.

Tab defaults: logged-in users land on **Mis materias** (`/`); **Reciente** is one tap away and lives at the durable URL `/reciente` (D7). Logged-out visitors see Reciente content on `/` (there is no personalization to show them; this also makes the logged-out homepage SEO-alive, see PART 23). The active tab persists per session (cookie), not per account — no server round-trip for a UI preference.

## 12.2 "Mis materias" — the exact inclusion rule

**Decision.** A post appears in a viewer's Mis materias tab if and only if:

1. `post.materia_id` is one of the viewer's followed materias (`materia_follows`), **OR**
2. `post.materia_id IS NULL` **AND** `post.carrera_id = viewer.carrera_id` (both non-null),

and `post.status = 'activo'`. A post qualifying under both clauses is one row (it is a set union, not a merge of streams). A viewer with no carrera set gets clause 1 only; a viewer with no follows and no carrera gets an empty tab with the empty state in §12.6.

### The `carrera_id` snapshot on posts

Clause 2 requires posts to carry a carrera scope. **Decision: `posts.carrera_id` is a nullable column snapshotted from the author's profile at creation time** — set when the post is untagged and the author has a carrera; null otherwise (tagged posts scope through their materia; authors without a carrera produce site-wide-only posts). As ruled in spine §0.5-R3, PART 8 includes this column and its partial index in the posts DDL.

Why a snapshot and not a join to `profiles.carrera_id` at query time:

- **Query cost.** The hot feed query becomes a two-clause index scan (`(materia_id, last_activity_at)` and `(carrera_id, last_activity_at)` partial indexes where `materia_id is null`), no join against `profiles` per row.
- **Archive semantics.** A 2026 post stays scoped to the author's 2026 carrera even if the author later switches carreras or deletes the account. Feed history does not rewrite itself (brief §2, §58).
- **Anonymity is boundable.** Whatever inclusion rule we pick, an untagged anonymous post appearing in Mis materias reveals "the author is (probably) in this carrera." With the snapshot, that disclosure is explicit and fixed at publish time.

**Anonymity consequence, stated plainly:** untagged posts display their carrera as a public chip (e.g. "· Abogacía"), including anonymous ones. The k-anonymity set is the whole carrera cohort (dozens to hundreds of people) — an acceptable, documented disclosure, far weaker than what the post's content itself usually reveals. The composer states it (disclosure line ruled in spine §0.5-R3; PART 6 owns the composer flow): **"Los posts sin materia se muestran a tu carrera."** A user who wants no carrera association tags a materia or clears their carrera in `/ajustes`. PART 4/9 must keep this copy consistent.

Considered / Chosen / Why / Cost — carrera scoping of untagged posts:
- **Considered:** (a) untagged posts appear only in Reciente; (b) join to author's current carrera at read time; (c) snapshot carrera at write time.
- **Chosen:** (c).
- **Why:** (a) buries exactly the "¿alguien de Abogacía…?" cohort chatter that D1 says retains people; (b) costs a join per row and rewrites history on profile edits; (c) is cheap, stable, and honest.
- **Cost:** one nullable FK + one partial index in PART 8; a small, documented anonymity disclosure.

## 12.3 Ranking "Mis materias" — the formula

**Decision.** Mis materias is recency-dominant with a bounded engagement term. The rank of a post at query time `t0` is:

```
E      = upvotes + 2 * comments_count            -- engagement, from cached counters
h_eff  = max( hours(t0 - last_activity_at),
              hours(t0 - created_at) - 48 )      -- effective age, hours (>= 0)
rank   = (10 + min(E, 40)) / (h_eff + 2)^1.5
```

Order by `rank DESC, id DESC`. All inputs are already on the `posts` row (`score`, `comments_count`, `last_activity_at` are cached columns maintained by the write functions of D5) — ranking never aggregates votes at read time.

Why each constant, so the formula stays defensible rather than folkloric:

- **`+10` base numerator**: guarantees a brand-new post with zero engagement ranks `10 / 2^1.5 ≈ 3.5` — above almost everything older than a few hours. Recency dominates by construction.
- **`min(E, 40)` cap**: the numerator can reach at most `50`, i.e. 5× base. Solving `50/(h+2)^1.5 = 10/2^1.5` gives `h ≈ 3.9`: **no amount of votes keeps a silent post above a fresh post for more than ~4 hours.** That single sentence is the anti-virality guarantee brief §16 asks for. Comments weighted 2× votes because a reply is a stronger "this thread is alive" signal than a silent upvote, and votes are the cheaper signal to farm.
- **`^1.5` decay**: steeper than linear (old content falls off decisively), gentler than quadratic (a lunchtime post survives into the evening). The `+2` floor prevents division blowup and keeps the first two hours roughly flat.
- **`h_eff` (bump with 48 h cap)**: see next subsection.

The formula is explainable to users in one sentence, and we publish that sentence in `/acerca`: **"Ordenamos por lo más nuevo; los votos y comentarios pueden adelantar una publicación unas horas, nunca días."** If the implementation ever stops matching that sentence, the implementation is wrong (§16: "The system should remain understandable").

### Bump behavior: `last_activity_at` with a 48-hour cap

**Decision. A new comment (top-level or reply) sets `posts.last_activity_at = now()`. Votes do not bump.** Ranking uses `h_eff = max(hours since last_activity_at, hours since created_at − 48)` — i.e. **activity can make a post look at most 48 hours younger than it really is.**

Justification:

- **Resurfacing is the point.** A question answered two days later must resurface for the asker's cohort — that closes the ask→answer→return loop (brief §39). Plain `created_at` ranking kills it.
- **The cap kills necro-hijack.** Under the cap, a 3-day-old thread with a fresh reply ranks like a 24-hour-old post (solid resurfacing); a 30-day-old thread with a fresh reply ranks like a 27-day-old post (invisible in practice). Someone thanking on a 2024 thread — which the archive *wants* to allow — cannot hijack the current feed. Uncapped bumping would also let an author resurface their own post forever with one comment a day; capped, self-bumping buys at most 48 hours once.
- **Votes don't bump** because voting is silent and low-effort: bump-on-vote makes small vote rings a feed-manipulation tool and makes rank motion inexplicable ("why did this come back? nothing new on it").
- **O(1) and stateless:** `h_eff` is computed from two timestamps already on the row; no history table, no decay jobs.

`last_activity_at` semantics (comments bump; votes, edits, and moderation actions do not) are binding on PART 8's trigger/function design.

## 12.4 Pagination — keyset cursors, no offset

**Decision.** All feed pagination is keyset ("cursor"), never `OFFSET`. Page size 25. The cursor is an opaque base64 JSON blob validated with Zod server-side; it is not signed (worst case of tampering is a weird page, not a data leak — the query still runs under RLS as the viewer).

- **Reciente**: `ORDER BY created_at DESC, id DESC`, cursor `(created_at, id)`, `WHERE (created_at, id) < (cursor)`. Strictly chronological by creation — bumps never reorder Reciente, otherwise "chronological" (D2) would be a lie.
- **Mis materias — MVP: single bounded window** (spine §0.5-R2). One keyset fetch on `(last_activity_at, id)` descending via the two partial indexes, bounded at the newest ~400 rows in scope; the fetched window is scored in memory with the §12.3 formula and paged from there. At MVP scale (D11 targets ~30 posts/week per cohort) the window is tens to low hundreds of rows — trivially in-memory, and anything older than the window is effectively invisible to ranking anyway.
- **Scale path (post-beta), deferred until the corpus outgrows the single window** — the two-segment scheme, kept as design:
  - **Segment A — live window**: posts in scope with `last_activity_at >= t0 − 14 days`, fetched via the two partial indexes with `LIMIT 400` as a safety bound, scored in server code with `t0` **pinned in the cursor** so every page of one pagination session computes identical ranks (deterministic, no dupes/gaps).
  - **Segment B — the tail**: everything older, keyset `(last_activity_at, id)` descending, pure activity order, no scoring. The cursor records `{t0, segment, last_key}` and flips A→B when A is exhausted.
- Why not offset: `OFFSET n` scans and discards n rows (cost grows with depth), and rows shifting between requests cause duplicates/holes. Keyset is O(page) forever and is also the pattern PART 20's caching assumes.

**[FREE-TIER RISK]** The ~400-row bound is the guard that keeps the ranked feed from becoming an unbounded scan as content accumulates over years; it is a hard constant, reviewed only with data.

## 12.5 Feed item anatomy

One post = one compact list row (D8: density via rows, not cards). PART 17 owns the visual spec; the *content contract* of a row is fixed here:

| Element | Rule |
|---|---|
| Kind label | "Pregunta" prefix label only when `kind = 'pregunta'`; plain posts get no label |
| Title line | Title shown in full (≤ 120 chars by schema). If no title: first 120 chars of body serve as the title line |
| Body preview | Only when a title exists: first 160 chars of body, markdown stripped, newlines collapsed, ellipsis "…" |
| Author | Handle ("MateConBizcochos") or "Anónimo"; never any other author metadata (D3) |
| Scope chip | Materia name linking to `/materias/[slug]`; else carrera chip for scoped untagged posts; else nothing |
| Time | Relative: "hace 40 min" (< 60 min), "hace 5 h" (< 24 h), "hace 3 días" (< 7 días), then absolute "12 mar 2026". `<time datetime>` with full timestamp for hover/screen readers |
| Score | "12 votos"; hidden when 0 (a wall of "0 votos" reads as failure) |
| Comments | "8 comentarios"; "Sin comentarios" is *not* shown — absence is silent |

The entire row is one link target to `/p/[publicId]`; the materia chip is the only nested link (PART 17 handles the a11y of nested interactive elements). No thumbnails, no vote buttons in the feed row for MVP — voting happens on the post page, which keeps feed rows static and cheap to render (revisit only if data shows it suppresses voting).

## 12.6 Empty states

Empty states are onboarding surfaces, not apologies. Copy is binding:

- **Mis materias, zero follows**: "Todavía no seguís ninguna materia. Buscá las tuyas y seguilas para armar tu feed." Button: **"Explorar materias"** → `/materias` (filtered to the user's carrera when known).
- **Mis materias, follows but no matching posts**: "Tus materias están tranquilas por ahora. Rompé el hielo: preguntá algo o compartí un apunte." Buttons: **"Publicá algo"** (composer) and secondary link "Ver todo lo reciente" → `/reciente`.
- **Reciente, empty site**: "Todavía no hay publicaciones. Empezá vos." — should be unreachable after the D11 seed sprint; it exists so the beta never shows a blank screen.

The second state is the one that will actually occur (summer, small cohorts — §0.1 seasonality) and is why it points sideways to Reciente rather than dead-ending.

## 12.7 Circulation of untagged posts — summary

An untagged post: appears in **Reciente** always; appears in **Mis materias** of carrera-mates iff it carries a `carrera_id` snapshot (§12.2); appears on **no materia page**; appears on the carrera page's "Actividad reciente" module (PART 4); is fully searchable (PART 13); shows a carrera chip or no chip. Untagged posts are legitimate ("¿mañana hay clase?" belongs to no materia) but the composer nudges toward tagging — tagged content is what compounds on materia pages (D1: permanence). Nudge copy: "Etiquetá una materia para que tu publicación quede en su página."

## 12.8 Caching hooks (mechanics in PART 20)

Decisions here; implementation deferred to PART 20:

- **Mis materias is per-user and never shared-cached.** It renders in a Server Component under the viewer's session (D5). Its cheapness comes from scope (two index scans, ≤ 400 rows), not from caching.
- **Reciente is one query for everyone** → cacheable. Logged-out `/` and `/reciente` use short-TTL full-route caching (revalidate ≈ 60 s); logged-in Reciente may share a server-side query cache (≈ 30 s) keyed globally, since its content is viewer-independent (only the chrome is personal).
- **Counters are write-time, not read-time.** `score`, `comments_count`, `last_activity_at` are maintained inside the D5 write functions; the feed never runs `COUNT(*)` or vote aggregation. This is the single most important feed-performance decision and it lives in PART 8.
- Feed responses set `Cache-Control: private` on personalized pages; no CDN caching of personalized HTML, ever.

## 12.9 Future path — and what we will never build

- **P2 — "Tendencias"** (brief §16). A simple z-score over 6-hour windows: hourly cron computes, per post active in the last 7 days, `z = (E_6h − μ) / σ` where `E_6h` is engagement events (comments + votes) in the trailing 6 h and `μ, σ` are the mean/stddev of `E_6h` across that active set; a post "trends" iff `z ≥ 2` **and** `E_6h ≥ 5` (the floor prevents "trending with 3 votes" embarrassment at small scale). Results land in a tiny `tendencias` table read by the UI; no realtime, no streaming. **Activation gate: do not enable until the site sustains ≥ 200 engagement events/day** — below that, "Tendencias" is statistical noise wearing a label.
- **P3 — "Para vos"**: a *quota blend*, not a model: interleave 60% Mis materias pool, 25% carrera-popular (same §12.3 formula scoped to the carrera), 15% site-wide standouts; deterministic interleave; every item can carry a one-line reason ("Porque seguís Derecho Romano"). Explainability remains a hard requirement.
- **Never: collaborative filtering / learned recommenders.** Rejected on four grounds: (1) data scale — thousands of users can't train anything that beats the quota blend; (2) opacity violates brief §16 and the `/acerca` sentence contract; (3) cost — training/serving infrastructure breaks D13's budget; (4) product identity — an institution's feed must be predictable in 2036, not a moving target (brief §46). This is a standing decision, not a deferral.

## Notifications (brief §17)

**Decision.** MVP notifications are **in-app only**, four types — replies to your post, replies to your comment, moderation decisions on your content, and resolution of reports you filed — listed at `/avisos` with an unread badge in the header. No email, no push, no mentions in MVP (D2). The governing principle, binding on every future notification type: **no notification exists without a user-visible cause** — something another human (or a moderator) did that the user can go look at. The system never notifies to re-engage ("¡Volvé!", streaks, "te extrañamos") — that class of message is banned permanently, not deferred.

### Types and payload

Type names per spine §0.5-R14 (DDL in PART 8):

| Type | Trigger | Example copy |
|---|---|---|
| `respuesta_post` | New comment on your post | "MateConBizcochos respondió a tu publicación «¿Entra el fallo Ekmekdjian…»" |
| `respuesta_comentario` | New reply to your comment | "Anónimo 2 respondió a tu comentario en «Parcial de Procesal»" |
| `decision_mod` | Moderation decision affecting you (removal, warning, restriction, appeal outcome) | "Tu publicación fue removida por incumplir las Reglas (spam). Podés apelar." |
| `reporte_resuelto` | A report you filed was resolved (PART 11's reporter feedback) | "Tu reporte fue revisado. Gracias por avisar." |

Rows carry: `type`, target refs (post `public_id`, comment id), **`actor_display` precomputed at insert time** (PART 8), `group_key`, `group_count`, `created_at`, `read_at`. Self-caused events never notify (commenting on your own post — suppressed by internal `author_id` comparison, which works even when you reply anonymously to yourself).

### Actor display under anonymity

`actor_display` is computed **at insert, server-side, from the same logic the thread renders with**: the actor's handle if the triggering content is not anonymous; the actor's **per-thread alias** ("Anónimo 2", D3) if it is. The notification therefore shows exactly what the user will see when they open the thread — coherent, and leaking nothing: the real handle of an anonymous actor never enters the `notifications` row at all, so no later bug, export, or query can surface it. Renames (D3: display rewrites everywhere) are the accepted exception: a notification may show a stale handle for its bounded lifetime (≤ 180 days, per the retention rule below); we do not rewrite notification rows on rename — cost without benefit at this retention.

### Grouping

Repeated events on the same target collapse: `group_key = type + target post`. A new event whose `group_key` matches an **unread** notification updates it in place — increments `group_count`, refreshes `created_at`, keeps up to two actor names — instead of inserting. Copy: "MateConBizcochos y 2 más respondieron a tu publicación «…»". Once read, the group is sealed; the next event starts a fresh row. This bounds a popular post to one unread row instead of thirty, which *is* the anti-spam design for in-app volume.

### Read semantics and the `/avisos` surface

- Unread = `read_at IS NULL`. Header badge shows the unread count, capped at "9+".
- **Opening `/avisos` marks everything currently listed as read** (one `UPDATE`). No per-item read toggles, no "mark all" button — the surface *is* the button. This matches the 2-minute ambient-check model (§0.1); notification hygiene must cost zero clicks.
- `/avisos`: reverse-chronological, keyset pagination, 25/row pages. Read items remain visible (grayed) — a notification that vanishes on read punishes the user for looking.
- **Retention: read notifications purged after 90 days, unread after 180** (spine §0.5-R14), pruned by the existing daily cron (D6). Notifications are ephemeral pointers, not archive material; nothing in the archive story (PART 16) depends on them.

### Moderation notifications are special

`decision_mod` and `reporte_resuelto` notifications are **always-on — no preference can disable them**. A user must always learn their content was actioned and how to appeal (PART 11 owns the appeal flow; D3: moderation against you is never invisible to you), and a reporter must always learn their report was resolved. Copy is neutral and cites the rule category, never the reporter — reporters are never revealed.

### Preferences v1 — one toggle

In `/ajustes`, exactly one switch (spine §0.5-R14): **"Respuestas"** — one boolean, `profiles.notif_respuestas`, default on — covering both `respuesta_post` and `respuesta_comentario`. `decision_mod` and `reporte_resuelto` are always-on. Microcopy: "Las decisiones de moderación se notifican siempre."

One is enough because MVP has four types and two of them are mandatory; a preference matrix with more switches than disableable notification types is the classic over-design brief §17 warns against. A full per-type preferences table is P2 — new P2 types then add rows, not migrations.

### P2 path

- **Mentions** (`@handle`): notify when public content mentions your handle; anonymous authors can mention (actor shows their thread alias); mentions inside later-removed content get their notifications revoked.
- **Weekly email digest via Resend** (D6 already carries Resend for auth mail): **strictly opt-in, off by default**, at most one email per week, and **only sent when there is actual content** — an empty week sends nothing. Subject/content style: "Esta semana en tus materias: 4 publicaciones nuevas, 2 apuntes". One-click disable link in every email footer, no login required for the unsubscribe. **[FREE-TIER RISK]** Resend free tier is ~100 emails/day (verify in PART 21) — the digest batches across the week and throttles; if the user base outgrows the quota, the digest queues across days rather than triggering a paid tier.
- **Materia activity opt-in**: per followed materia, "Avisarme de publicaciones nuevas" — in-app first, digest-eligible later. Off by default: following a materia is a feed subscription, not a notification subscription; conflating them is how platforms train users to ignore notifications.

Anti-spam principles, restated as tests any future type must pass: (1) caused by a visible human/moderator action; (2) actionable — tapping it lands on the cause; (3) grouped by default; (4) email always opt-in with zero-friction exit; (5) frequency-capped (digest ≤ 1/week). A proposed notification failing any test does not ship (D14 rule 10 spirit).

---

# PART 13 — SEARCH

## 13.1 Architecture decision

**Search is Postgres-native: full-text search with the `spanish` configuration plus `unaccent`, GIN-indexed generated columns, `websearch_to_tsquery` parsing — over posts, materias, resources, and carreras.** No external search service, no embeddings, no sidecar index to drift out of sync (brief §15: "Initially prefer PostgreSQL-native search capabilities").

Rationale: search is the utility magnet's front door ("resumen de constitucional" is the query that recruits users, D1/D11) and the archive's query engine for 2036 (§13.10). Both demand *durability* more than sophistication: an index that lives inside the same transactional database as the content can never be stale, never desynchronize on deletes (critical given C6 — deleted content must vanish from search the instant it is deleted), costs $0, and survives any future hosting migration because it is plain SQL (brief §33, §58). Our corpus after a strong year one is roughly 5–15k posts, ≤ 2k resources, and a catalog of 1–2k materias/carreras rows — three orders of magnitude below where Postgres FTS starts to strain (§13.9).

Considered / Chosen / Why / Cost:
- **Considered:** Elasticsearch/Meilisearch/Typesense (external engines), pgvector semantic search, plain `ILIKE '%term%'`, Postgres FTS.
- **Chosen:** Postgres FTS with a custom `spanish + unaccent` configuration.
- **Why:** zero infra cost and zero sync problem; es-AR students type without accents ("analisis matematico") and FTS+unaccent handles that where plain `spanish` config fails; `ILIKE` cannot rank and table-scans; external engines add an ops surface, a second source of truth, and a violation of brief §62 for a corpus that fits in L2 cache.
- **Cost:** no typo tolerance in v1 (mitigated by aliases in typeahead and `pg_trgm` in P2), no semantic matching (explicitly fine, §13.9), Spanish stemming quirks (mitigated by weighting title matches).

## 13.2 Index design

The physical DDL lives in PART 8, the sole schema authority (spine §0.5-R13): one custom text-search configuration **`public.es`** (`spanish` + `unaccent`), a stored generated `tsvector` column plus GIN index on each searchable table (`posts`, `materias` incl. `aliases`, `resources`, `carreras`), with weights **title A / body C**. Post bodies are ≤ 10 000 chars by CHECK, so no separate indexing cap is needed.

`materias.aliases` (a `text[]` of common student names: "consti", "procesal 1", "AM2") is required by both search and typeahead — defined in PART 8, seeded from APPENDIX A's catalog data: aliases are seed content, curated per materia, and are the cheap substitute for fuzzy matching in v1. Two implementation caveats PART 8 carries: (a) `to_tsvector(regconfig, text)` is immutable so generated columns work, but **changing the dictionary later requires rebuilding the columns** — acceptable, migrations are our source of truth (D14 rule 1); (b) typeahead needs an immutable wrapper `f_unaccent(text)` because bare `unaccent()` is only STABLE and cannot back an expression index.

**Access path (D5/D14 compliance):** search never reads base tables from app code. Each search runs through a `STABLE SECURITY DEFINER` SQL function (`search_posts`, `search_resources`, `search_catalog`) with pinned `search_path`, returning **exactly the public payload shape of the `_public` views** — author fields nulled when `is_anonymous`, `status = 'activo'` only, no internal columns. Rule D14-5 ("author fields of anonymous content never leave the database") applies to search results with zero exceptions.

## 13.3 Query parsing

**`websearch_to_tsquery('public.es', q)`, always.** It accepts raw user input without ever throwing a syntax error, and gives students Google-shaped semantics for free: `"bolilla 4"` quoted phrases, `parcial OR final`, `-recuperatorio` exclusion. Input is trimmed and capped at 100 characters server-side (Zod, D14 rule 4); an empty parse result short-circuits to the zero-results state without touching the index. We never expose `to_tsquery` operators to users and never build query strings by concatenation.

## 13.4 Ranking — the blend

**Decision.** Within a type: `ts_rank_cd` with length normalization, blended with a mild recency boost for posts only. Across types: **fixed group precedence replaces numeric cross-type blending** — the results page is type-grouped (§13.5) in the order **Materias, Carreras, Recursos, Publicaciones**, which *is* the type boost: for utility queries ("constitucional"), the materia page and its resource shelf outrank any individual post, exactly as required.

Within-type formulas:

```
relevance = ts_rank_cd(search_tsv, query, 1)      -- 1 = normalize by 1 + log(doc length),
                                                  --     so long posts don't win by mass
posts:      final = relevance * (1 + 0.5 * exp(-age_days / 120))
resources:  final = relevance * (1 + 0.2 * ln(1 + downloads_count))
materias/carreras: final = relevance              -- catalog rows: pure text match
```

Why this shape: the post recency term is a **boost, never a gate** — a brand-new post gets ×1.5, a one-year-old ×1.02, a ten-year-old ×1.0. Old content is never pushed below relevance floor, which is the mathematical form of the archive promise (§13.10): relevance decides, freshness only tie-breaks the recent past. The resource download term is a small quality prior (a resumen with 300 downloads over a near-duplicate with 2), log-damped so popularity cannot bury a better text match; `ts_rank_cd` (cover density) over plain `ts_rank` because it rewards query terms appearing near each other — "derecho constitucional" as a phrase beats the two words scattered across a long body. No cross-type score comparison ever happens (FTS ranks are not comparable across differently-shaped documents; group precedence sidesteps a formula that would otherwise need magic constants).

Why groups don't reorder dynamically: predictability. A student who searches twice should find the page shaped the same way twice (brief §46); groups with zero hits collapse silently, so a posts-only query still leads with posts.

## 13.5 The `/buscar` UX

**Decision.** One search box in the header of every page (collapsing to an icon-button on mobile, PART 17), submitting to `/buscar?q=…` — a single results page with type-grouped sections and a small filter row. No search modal, no instant full-search-as-you-type (typeahead §13.6 covers the fast path; full FTS on every keystroke would multiply query volume ~8× for no ranking benefit).

Results page composition, top to bottom (groups collapse when empty):

| Group | Page-one limit | "Ver más" behavior |
|---|---|---|
| Materias | 5 | appends `&tipo=materias` |
| Carreras | 3 | appends `&tipo=carreras` |
| Recursos | 5 | `&tipo=recursos`, paginated |
| Publicaciones | 10 | `&tipo=publicaciones`, paginated (keyset, per PART 12 §12.4 discipline) |

Filters (rendered as compact selects/inputs, not a sidebar):

- **`tipo`** — "Todo / Materias / Recursos / Publicaciones" (carreras fold into "Todo" and their own Ver-más view; four tabs beat five).
- **`materia`** — scope to one materia; applies to Recursos and Publicaciones. Materia pages pre-fill it: searching from `/materias/derecho-constitucional` scopes by default with a one-tap "Buscar en todo el sitio" escape.
- **`desde` / `hasta`** — year range on `created_at`, the archive filter (§13.10). Years, not dates: students think in cohort years, and year granularity keeps the UI to two selects.

All filter state lives in the URL (`/buscar?q=civil&tipo=recursos&desde=2026&hasta=2027`) — shareable into WhatsApp groups (D11 depends on deep links) and durable per D7. Result rows reuse the PART 12 §12.5 anatomy for posts, the resource row spec of PART 14 for resources, and one-line name+carrera rows for catalog hits. Search result pages are `noindex` (PART 23: crawl budget goes to content pages, not query permutations) — the *content* is indexable, the query surface is not.

**[FREE-TIER RISK]** Result pages must never pre-generate signed Storage URLs for resource files. Resource hits link to `/recursos/[publicId]`; signed URLs are minted only on an explicit download click (PART 14). Pre-signing on search pages would burn egress quota on renders that never download (D13: file egress breaks first).

## 13.6 Typeahead

**Decision.** Typeahead suggests **materias and carreras only** — prefix match on unaccented lowercase `nombre` and `aliases` via `text_pattern_ops` B-tree indexes on `f_unaccent(lower(...))`. No FTS, no posts, no resources in typeahead.

Why: 95% of navigational intent is "get me to my materia's page", the catalog is ~1–2k rows so prefix scans are sub-millisecond, and catalog data changes rarely — the endpoint response is CDN-cacheable for ~5 minutes (hook for PART 20), making typeahead effectively free at any traffic level. Posts in typeahead would require FTS-per-keystroke, the exact cost profile we refused in §13.5.

Mechanics: min 2 characters, 150 ms debounce, max 8 suggestions (materias before carreras), match against name *or* any alias — "consti" surfaces "Derecho Constitucional" because the alias list says so, which is v1's typo/nickname tolerance. Each suggestion navigates directly to the entity page; pressing Enter without selecting submits the full `/buscar` query. Keyboard navigation and `aria-*` roles per PART 17/18. Suggestion rows show the carrera context when a materia name is ambiguous across carreras ("Derecho Romano — Abogacía").

## 13.7 Zero results

Zero results is a fork, not a dead end — and its analytics are the seed-content radar (§13.8). Page content, copy binding:

> **"Sin resultados para «análisis matemático 3»."**
> "Probá con menos palabras, sin abreviaturas, o revisá la ortografía."
> — **"Ver todas las materias"** → `/materias`
> — **"¿No encontraste respuesta? Preguntale a la comunidad"** → composer, pre-filled with the query as draft title when it looks like a question.

The second CTA converts failed searches into posts — the strongest possible signal-to-content loop for a small community: a question nobody could search their way to an answer for is exactly the content the platform lacks.

## 13.8 Query analytics — log queries, never people

**Decision.** Every search logs into the dedicated **`search_queries`** table (DDL in PART 8, per spine §0.5-R10): day-bucketed rows keyed on `(day, query_norm)` — normalized query (lowercased, unaccented, trimmed, ≤ 100 chars), total result count, `zero_results` boolean, occurrence count. **No user id, no session id, no IP, no linkage of any kind ever** — consistent with PART 24's no-per-user-tracking rule — and the `events` table never stores query text or any free text. Privacy guard: queries containing `@` or ≥ 7 consecutive digits are stored as `"[redacted]"` (people paste emails and DNI/legajo numbers into search boxes; we refuse to warehouse that even unlinked). Retention: rows purged after 12 months by the retention job (PART 8). **[LEGAL REVIEW]** — confirm this retention is compatible with the Ley 25.326 posture in PART 10/16.

Why log at all: top zero-result queries are the highest-value operational signal the platform produces — they are literally a ranked list of missing seed content, reviewed weekly during the D11 carrera-by-carrera expansion ("14 people searched 'penal 2 resumen' and got nothing" → next seed sprint target). Aggregate top-queries also feed the `/archivo` year statistics later (PART 16).

## 13.9 Scaling story

- **Now → ~1M rows: nothing to do.** GIN-indexed FTS serves this corpus (tens of thousands of rows at the 3-year mark, given D11's growth shape) in single-digit milliseconds on Supabase Free's instance. The realistic risk is not query speed but **index bloat vs. the 500 MB DB budget** — tsvector columns and GIN indexes on posts will run roughly 30–50% of the text they index (unverified estimate; PART 21 telemetry watches actual DB size per D13). Mitigations already in the design: post bodies bounded at ≤ 10 000 chars by CHECK (PART 8), no tsvector on comments (comments are reachable through their post; indexing them roughly doubles FTS storage for marginal recall — a P2 decision *only* if analytics prove people search for comment-level content).
- **P2 — `pg_trgm` for fuzziness.** Scope: catalog only. On zero results, compute trigram similarity of the query against materia names/aliases; if max similarity ≥ 0.35, render "¿Quisiste decir **«derecho constitucional»**?". Trigram on the 1–2k-row catalog is cheap; trigram over post bodies is not on the menu.
- **Rejected — embeddings/pgvector.** Rejected until a proven need, defined as: analytics showing ≥ 20% of non-typo queries with zero results that FTS + aliases + trgm cannot serve. Grounds: quality embeddings need a paid API or self-hosted model (breaks D13's $0), pgvector indexes are large (**[FREE-TIER RISK]** against the 500 MB budget), semantic recall adds little when queries are catalog-anchored ("<materia> + resumen/parcial/final" is the dominant query grammar), and opaque ranking violates the same explainability principle as the feed (§16 by analogy). This mirrors §12.9's collaborative-filtering rejection: same reasoning, same standing.
- **If we ever outgrow Postgres FTS** (100k+ users, millions of rows — far beyond this plan's horizon): the escape hatch is a read-replica or a self-hosted Meilisearch fed from the same Postgres source of truth. Nothing in today's design (SQL functions as the search API boundary) would need callers to change — the function bodies would.

## 13.10 Search and the 2036 archive (brief §2)

Search *is* the archive's query engine; `/archivo` (P3, PART 16) is a curated browse shell over the same index. The properties that make the 2036 scenario work are all already load-bearing above, listed here as the checklist future changes must not break:

1. **No expiry**: content never leaves the index for being old; the recency term is a bounded boost (§13.4), never a filter or a decay to zero.
2. **Year filters**: `desde`/`hasta` (§13.5) let a 2036 student ask "¿qué se decía de esta materia en 2026?" — the exact brief §2 scenario, served by an FTS query with a `created_at` range, no special archive infrastructure.
3. **Durable result URLs**: every hit resolves to a D7 permanent URL (`/p/…`, `/recursos/…`, `/materias/…`) that survives any frontend rewrite (brief §30, §58).
4. **Deletion wins instantly** (C6): the index is generated columns on the source rows — removed or author-deleted content (`status ≠ 'activo'`) disappears from results in the same transaction that removes it. There is no secondary index to forget.
5. **Anonymity survives time**: search results pass through the same public-payload functions as every other read (§13.2); a 2036 query over 2026 anonymous posts reveals exactly what 2026 readers saw — nothing.
6. **Portability**: the whole search system is SQL in committed migrations; a future Postgres anywhere reproduces it from `pg_dump` alone (brief §33). Search adds zero migration lock-in.

---

DISSENT — none. One adjudication note rather than a dissent: §12.2 requires `posts.carrera_id` (snapshot at creation), which extends the D4 field list for `posts`. It is an addition, not a contradiction — D2's own feed definition ("followed materias + own carrera") is unimplementable at acceptable cost without it. Adjudicated: ACCEPTED (spine §0.5-R3) — PART 8 carries the column, its partial index, and the composer disclosure copy lives in PART 6.
