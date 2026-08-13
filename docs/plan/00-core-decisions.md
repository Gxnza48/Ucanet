# PART 0 — BRIEF CRITIQUE & CORE DECISIONS (THE SPINE)

> Written by the lead architect. Every other part of this plan (01–13) is bound by the decisions in §0.3.
> If a later part contradicts this file, this file wins until the contradiction is adjudicated and this file is updated.
> Markers used across the whole plan: **[HUMAN DECISION]** = founder must decide; **[LEGAL REVIEW]** = needs a lawyer; **[FREE-TIER RISK]** = can break the $0 budget.

---

## 0.1 What uca.net is — the thesis

uca.net is **the student layer of UCA Rosario**: a pseudonymous community where each *materia* and *carrera* has a permanent public page that accumulates two kinds of value at once —

- **AHORA**: the live conversation of your cohort ("¿se sabe algo del parcial?", "¿cómo tomó el final ayer?"), and
- **SIEMPRE**: the accumulated knowledge of every cohort before you (resúmenes, parciales viejos, experiencias, recomendaciones).

The strategic bet: **utility recruits, conversation retains, permanence compounds.** A student arrives because they need a resumen (searchable, works with zero users online). They stay because their carrera's chatter is there. Ten years of that loop produces the archive by construction — the archive is not a feature we build, it is what the platform's normal operation leaves behind.

### The answer to brief §65 (why open it daily, with no exam tomorrow)

Honest answer: **nothing makes every student open any site daily.** The realistic and sufficient goal is:

> **"¿Qué se dice hoy en mi carrera?" — a 2-minute ambient check of your cohort's conversation, dense enough to reward the visit.**

Three design consequences, all binding:

1. **Density is engineered by segmentation, not by user count.** The default feed is *Mis materias* (the materias you follow) + your carrera. 30 active students in Abogacía 2° año feels alive *to those 30* even if the whole platform has 150 users. We never need the whole university to be active — only cohorts.
2. **The product runs on the academic calendar, not on growth-hacking.** Usage will spike at parciales/finales (utility mode) and crater in January–February (Argentine summer). This is seasonality, not churn. Feed, notifications, metrics, and launch timing are all calendar-aware.
3. **Daily-active is the ceiling, not the bar.** Target: daily during cursada for engaged cohort members, weekly for the rest, heavy spikes at exam windows. We do not add streaks, badges, or engagement mechanics to force more than that; that path destroys the institution character (brief §2, §46).

---

## 0.2 Brief critique — contradictions, weak assumptions, missing requirements

The brief is unusually good. These are the places where I depart from it or where it is silent. Each item is reflected in the relevant part of the plan.

**C1. The implied MVP is too large for one AI-assisted developer.** Brief §9 alone (feed + micro-posts + polls + materias + carreras + facultades + resources with ratings) plus §15–18 is a 6–9 month build. The MVP in D2 cuts: polls, "Para vos" personalization, "Tendencias", professor pages, resource ratings (upvote only), downvotes, DMs/chat, marketplace, archive UI, badges, realtime. Rationale per item in PART 5.

**C2. The name "uca.net" is the plan's biggest external risk, and the brief underweights it.** (a) The domain is a three-letter .net — almost certainly registered or expensive; (b) "UCA" is Universidad Católica Argentina's mark — an independent anonymous forum named "uca" invites a trademark/confusion claim the university would plausibly win or at least use to pressure the project (brief §56 acknowledges this but the plan must treat it as launch-blocking); (c) "UCA" also collides globally (University of Central Arkansas owns uca.edu). **Decision D10: build under a code name, keep product identity name-portable, and resolve naming before public launch.** [HUMAN DECISION] [LEGAL REVIEW]

**C3. §65's "every single day" framing over-asks.** Answered honestly in 0.1. Designing for the stated bar (daily for everyone) would push us toward engagement mechanics the same brief correctly prohibits (§11 "do not over-gamify", §46 "timeless"). The contradiction is resolved in favor of the institution, not the metric.

**C4. Changeable pseudonyms + visible history creates a linkage trap (§7 + §52).** If `MateConBizcochos` renames to `FiscalDelTercerPiso` and old posts keep the old name, renaming is pointless; if old posts show the new name, a watcher can diff. Decision D3: **one identity, rename rewrites display everywhere, 90-day cooldown, no public name history.** Accept the diff risk (small community, low stakes) and document it; per-post anonymity is the tool for real sensitivity, not renaming.

**C5. Karma + anonymous posting leaks authorship (§7 + §11).** If karma updates visibly the moment an anonymous post gets votes, timing correlates author to post. Decision D3: karma from anonymous content accrues into the profile total **in a daily batch**, never itemized. Anonymous posts expose *nothing* of the author (no avatar, karma, age, history, badges) — brief's "prefer strong privacy" taken to its conclusion.

**C6. The archive (§13) and deletion rights (§31) conflict; deletion wins.** Under Argentine habeas data (Ley 25.326) and basic decency, a user's right to delete their own words beats our desire to preserve them. Resolution in D4/PART 16: the archive is (a) content that still exists, (b) aggregate anonymized statistics, (c) curated milestones — never a frozen snapshot that resurrects deleted content. "Do not promise permanent preservation of everything" (§31) becomes policy, stated in the ToS.

**C7. The $0-forever framing is wrong; plan the first $25 instead.** Supabase Free (~500 MB DB, ~1 GB storage, ~5 GB egress/mo — PART 21 verifies current numbers) makes a PDF library — our core utility magnet — the first thing to break. [FREE-TIER RISK] Decision D13: strict caps at MVP, telemetry on quota consumption, and a **pre-decided trigger** for Supabase Pro (~USD 25/mo). A platform meant to last 10 years that dies at 5 GB of monthly downloads was never an institution. Also: free-tier projects pause after ~1 week of inactivity — mitigated by a daily cron ping until real traffic exists.

**C8. Vercel Hobby prohibits commercial use.** The marketplace (§10) or any monetization on Hobby violates Vercel's ToS. Decision: monetization phase begins with paying for Vercel Pro or migrating hosting. Not a blocker now (Stage 0 = no monetization) but it must be in the monetization math from day one (PART 31).

**C9. Professor pages are the #1 defamation trap and must not ship in MVP.** Anonymous free-text reviews of named real people is exactly the fact pattern that generates civil claims in Argentina (injurias; Ley 25.326 also covers professors' personal data). Decision: MVP models professors only as neutral catalog metadata (names on cátedras — factual, public information). A structured, bounded professor-experience feature is Phase 3+, designed with counsel. [LEGAL REVIEW] Discussion about teaching happens in materia pages under the normal moderation rules ("experiences yes, attacks on persons no").

**C10. Reputation (§11): one number, shown quietly, is correct; multi-dimensional reputation is over-design at this scale.** Karma = post/comment/resource upvotes received. Shown on profile as plain text. No levels, no badges, no leaderboards in MVP (leaderboards possibly never — they manufacture the gamification §11 warns against). Downvotes excluded from MVP: in a community of hundreds, downvotes chill new posters and enable cheap brigading; "Reportar" handles the bad, upvotes surface the good. Revisit only if low-quality flooding actually appears.

**C11. The marketplace should be deferred harder than the brief suggests.** Correctly out of MVP (§10), but also: do not model transactions/payments tables now. The schema leaves only extension points (`price_cents` nullable, status enums extensible). Reasons: Mercado Pago integration + AFIP/monotributo questions for sellers + platform liability + refunds/disputes is a project the size of the MVP itself, and free distribution better serves cold-start (every paywall shrinks the utility magnet). PART 15 designs the eventual shape; nothing is built.

**C12. DMs/chat: actively excluded, not merely deferred.** Anonymous DMs are a harassment channel with the platform's worst moderation economics (private, 1:1, unreportable-in-context). WhatsApp already owns student private messaging (§59 Q4 — we complement it, not compete). Revisit only with a concrete, moderation-funded design.

**C13. The real scaling wall is moderation labor, not infrastructure.** §36's growth curve will break the founder-as-only-moderator long before it breaks Postgres. The plan treats moderator recruitment (trusted students per facultad) as a growth-phase deliverable with the same weight as any feature (PART 11, PART 30).

**C14. Missing requirement: the academic calendar as a first-class concept.** Cuatrimestres, semanas de parciales, turnos de finales (feb–mar / jul–ago / nov–dic) drive usage, launch timing, seed-content strategy, and even copy. The schema carries minimal calendar awareness (materia ↔ cuatrimestre) and the roadmap is dated against the real UCA calendar (PART 28).

**C15. Missing requirements the brief never mentions**: (a) the legal documents themselves — Términos y Condiciones, Política de Privacidad, Reglas de la comunidad must exist at launch [LEGAL REVIEW]; (b) transactional email deliverability (Supabase's built-in sender is not production-grade — plan a free-tier SMTP like Resend for auth mail); (c) who moderates on day 1 (answer: the founder + 1–2 trusted students, and the burnout risk is named in PART 33); (d) backups on free tier are weak — a scheduled `pg_dump` export to private storage is part of Phase S0, not an afterthought (PART 21); (e) an age statement — freshmen can be 17; ToS sets 16+ with data-minimization posture. [LEGAL REVIEW]

**C16. Public-by-default is a foundational choice the brief hedges on (§29 vs §2).** A 2036 student can only "discover 2026" if 2026's content is public and indexable. Decision: posts, materias, resources metadata are public (readable logged-out, indexable); profiles are public but `noindex`; there is no private/friends-only content type in MVP at all. Anonymity is the privacy mechanism; visibility tiers are complexity we refuse. Users are told plainly: "Todo lo que publicás es público. Tu identidad real no."

---

## 0.3 Core decisions (binding on all parts)

### D1. Product thesis
As stated in 0.1. The unit of community is the **cohort** (carrera × año), the unit of permanence is the **materia page**, the unit of activity is the **post**. Every feature must strengthen at least one of: utility magnet (resources/search), cohort conversation (posts/comments/feed), permanence (URLs/archive/SEO). Anything that strengthens none is cut.

### D2. The MVP cut

**IN (MVP):**
| Capability | Notes |
|---|---|
| Email+password auth, email confirm | Supabase Auth; invite links gate early registration |
| Profile with unique pseudonym | rename cooldown 90 days; optional carrera + año |
| Academic catalog | sede → facultad → carrera → materia (+ plan de estudios mapping), pre-seeded for Rosario |
| Posts | one composer: body required (≤10k chars), optional title (≤120), optional materia tag, optional "pregunta" kind, optional **Anónimo** checkbox |
| Comments | one nesting level of replies (depth ≤ 2), same anonymity option |
| Upvotes | posts, comments, resources; no downvotes |
| Feed | two tabs only: **Mis materias** (followed materias + own carrera) and **Reciente** (everything, chronological) |
| Materia pages | header + tabs: Publicaciones / Recursos; follow button |
| Carrera pages | plan de estudios grid linking materias; recent activity |
| Resources | file upload (PDF/images, ≤10 MB/file, ≤3 files, per-user quota), typed (resumen/apunte/parcial/final/guía/otro), free only, download counts, upvotes |
| Search v1 | Postgres FTS (spanish + unaccent) over posts, materias, resources |
| Reports + mod panel v1 | report categories, queue, remove/restore/warn/suspend/ban, audit log |
| Notifications v1 | in-app only: replies to your post/comment, mod decisions |
| SEO base | SSR public pages, sitemap, metadata, durable URLs |
| Legal pages | Términos, Privacidad, Reglas |

**OUT (with phase):** polls (P2) · "Tendencias" (P2) · "Para vos" (P3) · resource ratings/reviews beyond upvote (P2) · professor pages (P3+, [LEGAL REVIEW]) · marketplace/payments (P4+) · archive UI (P3 — the *data* is archival from day 1) · downvotes (only if needed) · DMs/chat (excluded) · mobile app (excluded; responsive web) · realtime subscriptions (excluded from MVP) · email notifications/digests (P2) · badges/levels/leaderboards (not planned) · mentions (P2) · bookmarks (P2) · avatars (P2, if ever — text-first identity).

### D3. Identity & anonymity mechanics

- **Account**: Supabase Auth, email + password (+ email confirmation). Any email accepted; early registration gated by **invite links** (density + spam control without the psychological cost of demanding institutional email). Optional UCA-email verification as a later anti-abuse escalation, never public. **[HUMAN DECISION]** (D3-a: invite-gated any-email vs. require @uca.edu.ar — plan assumes invite-gated).
- **Pseudonym**: unique handle (citext), chosen at onboarding, shown everywhere the user isn't anonymous. Rename allowed every 90 days; display rewrites everywhere; no public history. Suggested-name generator at onboarding (fun, es-AR flavored, optional).
- **Anonymous publishing**: per-post/per-comment flag. Public payload for anonymous content contains **no author fields at all**. Internally `author_id` is always retained (moderation, rate limits, legal).
- **Per-thread anonymous aliases**: within one post's comment thread, the same anonymous author is labeled consistently ("Anónimo 1", "Anónimo 2", …) via a server-side mapping table (`post_id`, `author_id`) → alias number, never exposed cross-thread. Conversations stay coherent; cross-thread linkage stays impossible.
- **Karma**: single integer on profile; accrual from anonymous content batched daily (C5). Never shown on anonymous content.
- **What is never anonymous**: moderation actions against your content (you know your content was moderated), internal authorship, resource *sellers* if a marketplace ever exists (sellers must be accountable identities — future).
- **Account deletion**: auth user + email erased; profile row anonymized (`usuario-eliminado`, random suffix), content either deleted by user beforehand or remains attributed to the anonymized shell — user chooses between "borrar mis publicaciones" and "conservarlas como usuario eliminado" during deletion. Mod/audit records retain the internal UUID only.

### D4. Core data model (names are binding; full DDL in PART 8)

Academic: `universidades`, `sedes`, `facultades`, `carreras`, `materias` (slug unique global), `plan_materias` (carrera_id, materia_id, año, cuatrimestre).
Identity: `profiles` (PK = auth.users.id; handle citext unique; carrera_id null; ingreso_year null; karma int; role enum user/mod/admin; status; timestamps).
Content: `posts` (id bigint identity; public_id text unique — nanoid ~10; author_id; materia_id null; carrera_id null — cohort snapshot at creation, per §0.5-R3; kind enum texto/pregunta; title null; body; is_anonymous; score, comments_count cached; status enum activo/eliminado_autor/eliminado_mod; locked_at null; created_at, edited_at, last_activity_at), `comments` (post_id; parent_id null, depth ≤ 2 enforced; same anonymity/status pattern), `post_votes` / `comment_votes` / `resource_votes` (PK (target_id, user_id); up-only), `materia_follows`, `anon_aliases` (post_id, author_id, alias_num; PK (post_id, author_id); never publicly readable).
Resources: `resources` (public_id; materia_id; author_id; tipo enum; año null; title; description; is_anonymous; status; downloads_count; price_cents null — unused in MVP), `resource_files` (resource_id; storage_path; mime; size_bytes ≤ 10 MB check; original filename sanitized).
Safety: `reports` (exactly-one-target pattern: nullable FKs post_id/comment_id/resource_id/profile_id + CHECK; categoria enum — the 12 values of PART 11 §11.3.1; status), `mod_actions` (immutable audit; same target pattern; action enum per §0.5-R5; public reason + internal notes), `user_restrictions` (type suspension/ban; until null = permanent; revocable), `appeals` (one per mod_action; §0.5-R15).
System: `notifications` (user_id; type respuesta_post/respuesta_comentario/decision_mod/reporte_resuelto; refs; group_key/group_count; actor_display precomputed respecting anonymity; read_at), `invites` (code; created_by; max_uses; uses; expires_at), `waitlist`, `events` (aggregate analytics: name, day, dim, count — no per-user tracking, never free text — PART 24), `search_queries` (day-bucketed normalized queries, no user linkage, 12-month retention — §0.5-R10), `download_log` (7-day ephemeral, rate-limit + dedup only — §0.5-R9), `handle_history` + `handle_blocklist` (rename quarantine + reserved names), `app_settings` (admin flags/kill-switches).
Rules: soft-delete for user content (status change, body nulled for privacy on user deletion); hard-delete only via retention jobs; **stable public IDs** (nanoid in URLs, never DB sequence); every table gets created_at; all FKs explicit; no polymorphic type/id pairs — the nullable-FK+CHECK pattern keeps referential integrity.

### D5. Data access pattern (security architecture in one paragraph)

RLS enabled on **every** table, including catalog tables (read-all policies where public). The browser talks only to Next.js; **all reads and writes go through Next.js server code** (Server Components for reads, Server Actions/route handlers for writes) using the user's Supabase session via `@supabase/ssr` — so RLS is always evaluated as the real user. Public reads of content go through **views** (`posts_public`, `comments_public`, `resources_public`, `profiles_public`) that null out author fields when `is_anonymous` and expose no internal columns; base tables grant no direct SELECT to `anon`/`authenticated`. Multi-step writes (create post + assign alias + bump counters; vote toggle; report) are **SECURITY DEFINER SQL functions** with pinned `search_path`, which also enforce rate limits in-database (they must hold even if the app layer is bypassed). The service-role key exists only in cron/admin scripts, never in app runtime code paths reachable from requests. No client-side Supabase queries except the auth handshake. Realtime: off.

### D6. Stack (PART 19 justifies; this is the decision)

Next.js (App Router, current stable) · TypeScript strict · React Server Components-first, minimal client components · Tailwind CSS v4 (tokens in CSS variables) · Radix primitives only where a11y is hard (menus, dialogs) · Supabase: Postgres + Auth · **Cloudflare R2 for all resource files** (S3-compatible, 10 GB free, zero egress fees; signed URLs minted server-side — §0.5-R17; Supabase Storage unused in MVP) · Migrations: **plain SQL via Supabase CLI** (SQL files are the source of truth; `supabase gen types` for TS types; no ORM) · Zod at every boundary · Vitest (unit) + pgTAP via `supabase test db` (RLS/policies — the critical suite) + Playwright (smoke E2E) · Sentry free tier (errors) · analytics: own `events` table, no cookies (PART 24) · email: Resend free tier for auth SMTP · Vercel Hobby (daily cron `/api/cron/aggregates`: keepalive + aggregates + karma batch + retention purges; weekly backups via GitHub Actions — §0.5-R16). Explicitly rejected: Prisma/Drizzle (migration source-of-truth split, portability), Redis (Postgres suffices), Elasticsearch (FTS suffices), component libraries (design identity), tRPC (Server Actions suffice), realtime (cost/complexity).

### D7. URL map (durable; part of the product's 10-year contract)

`/` feed · `/reciente` · `/materias` `/materias/[slug]` · `/carreras/[slug]` · `/facultades/[slug]` · `/p/[publicId]` (+ ignored slug suffix allowed) · `/recursos` `/recursos/[publicId]` `/recursos/subir` · `/u/[handle]` · `/buscar?q=` · `/avisos` · `/ajustes` · `/apelacion` · `/mod/*` · `/archivo` `/archivo/[year]` (P3) · `/acerca` `/reglas` `/terminos` `/privacidad` · `/ingresar` `/registro` `/registro/continuar` `/recuperar` `/invitacion/[code]`.
Slugs: lowercase, unaccented, hyphenated; materia slugs globally unique and human (`derecho-constitucional`). Public IDs: nanoid (10, lowercase alphanumeric, no ambiguous chars). URLs never encode the tech stack (no `/api/v1` in shareable URLs; no locale prefixes — the product is es-AR, period).

### D8. Design direction (PART 17/18 elaborate; direction is binding)

Editorial/knowledge-web character: paper-white background (#FAFAF7-family), near-black ink, **one accent — "azul birome"** (the Argentine ballpoint blue, ~#1E40AF-family) for links/actions — culturally resonant, timeless, non-SaaS. System font stack for UI; at most one self-hosted serif (headings/long-form) ≤ 100 KB woff2 total. Base text 16px/1.6. Radius ≤ 4px; shadows ≈ none; 1px hairline borders (#E7E5E0-family); density via compact list rows with inline metadata, not cards. Dark mode from day 1 via CSS variables (cheap now, expensive later). No emoji in UI chrome; sparse Lucide icons only where text fails. Voice: es-AR with voseo, imperative CTAs ("Publicá", "Ingresá", "Comentá"), sober microcopy, no exclamation-mark enthusiasm. Wordmark: lowercase typographic "uca.net" (name-portable per D10 — the wordmark template must survive a rename). Footer on every page: "Sitio independiente hecho por estudiantes. Sin afiliación con la Universidad Católica Argentina."

### D9. Language
UI copy: Spanish es-AR (voseo). Code identifiers and docs: English. Database object names: the Spanish domain nouns where they are the domain (materias, carreras, facultades) and English elsewhere (posts, comments, reports) — the domain nouns *are* the ubiquitous language here; translating "materia" to "subject" in the schema creates permanent translation friction. This mixed convention is deliberate and documented.

### D10. Naming/brand stance **[HUMAN DECISION]** **[LEGAL REVIEW]**
Build under code name `ucanet` (repo/internal). Before public launch: (1) verify uca.net registrability/price; (2) get a trademark opinion on "uca" in the name; (3) prepare fallback names — same product, e.g. a name owning the "student layer" idea without the university's mark. Architecture requirement: the product name appears in exactly one config constant + the wordmark asset; a rename is a one-day change. Do not print the name into durable content (e.g., watermarks on PDFs) before naming is resolved.

### D11. Cold start & first-100 core (PART 29/30 detail)
Sequence: (1) pre-seed the full academic catalog for Rosario's facultades/carreras; (2) founder + 5–10 accomplices upload 80–150 genuinely good resources concentrated in ONE carrera (the founder's own) before anyone else enters; (3) closed beta by invite link, one carrera, 20–50 students, during a parciales window (utility peak); (4) expand carrera by carrera, each with a seed-content sprint, never launching into an empty shelf. Success gate to open registration: ≥40% of beta users return in week 2 and ≥30 posts/week organic. Growth artifacts: QR posters at the sede, WhatsApp-group shares of specific resources/posts (deep links must render great previews), materia pages ranking on Google for "resumen <materia> uca" queries.

### D12. Phasing skeleton (PART 28 details; calendar-aware)
S0 Fundaciones (repo, CI, migrations pipeline, auth, tokens, legal pages) → S1 Núcleo (catalog+seed, profiles/onboarding, posts/comments/votes, feed, materia/carrera pages, anonymity mechanics) → S2 Utilidad (resources, search, SEO) → S3 Confianza (reports, mod panel, restrictions, notifications, rate limits, RLS test suite) → Beta cerrada (invite-only, 1 carrera) → Lanzamiento abierto aligned to a cuatrimestre start (March or August). Build calendar anchored to today (Aug 2026): S0–S3 ≈ Sep–Nov 2026; beta Nov 2026 (finales window = utility spike); public launch **March 2027** with the new cuatrimestre. Every phase ends deployed to production with its tests green — there is no "big launch integration" phase.

### D13. Cost reality & the first paid dollar **[FREE-TIER RISK]**
$0 stack holds to roughly: few thousand MAU, ~500 MB DB, R2 free 10 GB files with zero egress fees (numbers verified in PART 21). With resource files on R2 (§0.5-R17), the old #1 risk (Supabase 1 GB storage + 5 GB egress vs a PDF library) is retired; the new break order is: moderation labor first (C13), DB size second, R2 10 GB storage third. Pre-committed triggers: DB > 70% of 500 MB or auth MAU pressure two months running → Supabase Pro (USD 25/mo); R2 > 70% of 10 GB → R2 paid (~USD 0.015/GB-mo, cents); any monetization → Vercel Pro (USD 20/mo) (C8). Weekly `pg_dump` + R2 manifest export to a second location from day 1 — the exit plan (brief §33) is a tested script, not a promise.

### D14. Non-negotiable engineering rules (the contract for AI-assisted development; PART 26 expands)
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

---

## 0.4 Conventions for plan authors (§D)

- Each part begins exactly `# PART N — TITLE` (h1), subsections `##`/`###`.
- English prose; **all UI copy examples in es-AR voseo**, quoted.
- Open every major section with the decision in 1–3 sentences; rationale and detail after. Big trade-offs use a "Considered / Chosen / Why / Cost" block.
- Use the markers **[HUMAN DECISION]**, **[LEGAL REVIEW]**, **[FREE-TIER RISK]** so they can be aggregated in PART 34.
- No emoji. Tables only for enumerable facts. No filler: every paragraph carries a decision, a number, or a reason.
- Do not re-litigate spine decisions in-line. If you disagree, comply and append a `DISSENT — <topic>` block at the end of your file; the lead adjudicates.
- Cross-reference by part number ("see PART 8"), never by file name.

---

## 0.5 Post-review adjudications (binding; recorded after the adversarial verification pass)

Three independent verifiers (consistency, feasibility, coverage) reviewed the full draft. Coverage verdict: ~92% of brief obligations fully covered; the defects were cross-part forks, not absences. The lead adjudicated every fork; all D-section references of the form "§0.5-Rn" resolve here.

- **R1** The research appendix is **APPENDIX A** (never "PART 13", which is Search).
- **R2** "Mis materias" is lightly ranked by PART 12's formula over a single bounded window; "Reciente" is chronological; the two-segment cursor is the documented scale path, post-beta.
- **R3** `posts.carrera_id` cohort snapshot: accepted (composer discloses "Los posts sin materia se muestran a tu carrera.").
- **R4** Report categories: PART 11's 12-value enum, verbatim, everywhere ("desinformación" is not a category).
- **R5** Mod-action vocabulary: PART 8's names + `revelar_autor` + `bloquear_hilo`; durations live in `user_restrictions.until`; `posts.locked_at` added.
- **R6** Rate limits: PART 11's tiered values; mechanism = counting recent rows (no rate_counters table); constants in one `rate_limits()` SQL function; T0 vote-delay deferred until open registration.
- **R7** Karma: uniform nightly recompute for everyone; votes never touch karma intra-day.
- **R8** Handles: `^[a-zA-Z0-9_]{3,24}$`, ≥1 letter, citext; `handle_history` (90-day quarantine) + `handle_blocklist` tables exist.
- **R9** Downloads: ephemeral 7-day `download_log` for rate-limit + per-user-day dedup; no durable download history.
- **R10** Search analytics: separate `search_queries` table (day-bucketed, no user linkage, 12-month purge); `events` never stores free text.
- **R11** `events` = (name, day, dim, count), kept forever.
- **R12** One upload pipeline: draft → quarantine (`incoming/{upload_nanoid}`) → sniff → EXIF strip → `r/{resource_public_id}/{file_nanoid}.{ext}`; status `borrador` → `activo`; 120 s signed URLs; titles 8–120; quota 100 MB/user.
- **R13** FTS: config `public.es`, weights title A/body C, `materias.aliases`, carreras vector, `f_unaccent()` — all defined once in PART 8.
- **R14** Notifications: Spanish types incl. `reporte_resuelto`; `group_key`/`group_count` in MVP; prefs v1 = one boolean (`notif_respuestas`); retention 90 d read / 180 d unread.
- **R15** Appeals: structured `/apelacion` form is MVP; minimal `appeals` table (one per mod_action).
- **R16** Scheduling: Vercel daily cron `/api/cron/aggregates` does keepalive + aggregates + karma + retention; backups on weekly GitHub Actions; pg_cron not load-bearing.
- **R17** **Resource files live on Cloudflare R2 from the first upload** (both dissents accepted): 10 GB free, zero egress, S3-compatible; Supabase Storage unused in MVP; D6/D13 amended above.
- **R18** Invite consumption: signup action validates the code read-only; `handle_new_user` consumes it atomically at user creation.
- **R19** Layout: PART 17 wins — no left rail; 5-slot header; right rail carries an "Explorar" block (Materias · Recursos · Archivo).
- **R20** Feed rows show score as text; voting happens on the post page only.
- **R21** Migrations: PART 8 §8.10.1's 0001–0012 is canonical (invites before profiles; no pg_trgm in MVP); PART 28 cites those ordinals.
- **R22** Also absorbed into PART 8: `app_settings` (kill-switches) and `waitlist`; anon aliases use the advisory-lock mechanism (no seq column).
- **R23** Smaller reconciliations: password min 10; page size 25; tombstones HTTP 410; theme cookie; 6 Playwright flows; features/ repo layout; 20 h/week; S0 = 3 weeks with counsel engaged in September; December beta gate is a utility-mode reading with the binding retention verdict re-taken in March; no "Colaborador fundador" public label (private thanks + memoria mention instead); founding-mod exception to the 6-month tenure rule; preview deploys use the second free Supabase project, never production data; SEO landings measured via Google Search Console; reputation alternatives documented in PART 9 (single quiet integer chosen).
