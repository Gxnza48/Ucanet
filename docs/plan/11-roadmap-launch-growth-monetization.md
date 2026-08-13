# PART 28 — ROADMAP

**Decision:** Build S0–S3 during September–November 2026 (Argentine spring, mid–2do cuatrimestre), run the closed beta inside the November–December finales window (23 nov – 22 dic 2026, the year's last utility spike), harden during the January crater, and launch publicly aligned to the March 2027 inscripciones/cursada start. Every phase ends deployed to production with its tests green; there is no integration phase.

Rationale: the product's usage curve is the academic calendar (spine 0.1, C14). Building against a deadline that is *someone else's* deadline — the students' finales — gives us a real utility event for beta, and the March cursada start is the single largest attention moment of the student year (new materias, new cohorts, everyone searching for apuntes). Missing March 2027 means the next equivalent window is August 2027; the roadmap therefore carries explicit slack and a pre-decided slip rule (§28.9). Dates below are anchored to the verified 2026 UCA calendar (APPENDIX A §D); 2027 dates are projected from the same institutional rhythm and marked as such.

## 28.1 Planning assumptions — the honesty rule

Every estimate below is in **solo-dev weeks**, where one week = the founder's committed weekly hours, stated here so the calendar math is auditable:

- **Assumed capacity: 20 focused hours/week** of AI-assisted development. **[HUMAN DECISION]** — the founder must confirm the real number before S0 starts; every date in this part is a function of it.
- At 10 h/week, every duration doubles and the launch target moves to **August 2027** (2do cuatrimestre start), which is the pre-approved fallback alignment. Do not attempt to hold March 2027 at half capacity by cutting S3 — trust features are not cuttable (D14 rule 10), and a beta without moderation tooling is the one unrecoverable mistake.
- AI assistance is assumed for code generation, not for decisions: schema, RLS policies, and moderation flows are reviewed line-by-line by the founder. This is why S0's migration/testing pipeline comes first — it is what makes AI-generated code safe to accept quickly (brief §43, D14).
- Estimates carry **±50% variance**. The calendar absorbs this with: S0's third week (the buffer, spent where tooling variance lives), the seed sprint overlapping S3's tail, and January 2027 as pure slack (nothing launch-critical is scheduled in January).
- One person does everything: development, seeding, moderation, community. Phases are sequenced so that community-facing work (beta, seeding) never overlaps heavy build work; the founder cannot answer beta questions in under 3 hours (PART 29.6) while mid-migration.
- Effort figures per phase are for the *dev* work; community/legal work is listed separately where it dominates.

## 28.2 Calendar anchors (from APPENDIX A §D)

| Event | Date | Status | Roadmap use |
|---|---|---|---|
| 2do cuatrimestre 2026 cursada | 10 ago – 19 nov 2026 | verified | Build season; ambient user research |
| Fin 2do cuatrimestre 2026 | 19 nov 2026 | verified | S3 must be done before this |
| Turno finales nov/dic 2026 | 23 nov – 22 dic 2026 | verified | **Closed beta window** (utility peak) |
| Summer crater | ene – mediados feb 2027 | rhythm verified | Hardening, legal, naming — no launch activity |
| Turno finales feb/mar 2027 | ~2 feb – 4 mar 2027 | projected from 2026 | Beta wave 2 + expansion seed sprints |
| Inscripción a materias 1C 2027 | ~23–27 feb 2027 | projected | Pre-launch QR/poster moment |
| Inicio cursada 1C 2027 | ~8–9 mar 2027 | projected | **Public launch week** |
| Ingresantes start 1C 2027 | ~15–16 mar 2027 | projected | Second launch-week push (año 1 materias) |

Rosario dates may shift by days versus the Buenos Aires-published calendars (APPENDIX A §B); the founder confirms Rosario dates each cuatrimestre from the facultad's own communications and adjusts the week, never the sequence. **[HUMAN DECISION]** (confirm real 2027 dates when published, ~dec 2026).

## 28.3 Phase S0 — Fundaciones (late ago/1 sep – 21 sep 2026, 3 solo-dev weeks)

**Objective:** a deployed, secured, migration-driven skeleton where every later feature lands as a reviewed SQL migration plus tested code — the contract of D14 made physical before any feature exists to tempt shortcuts.

**Features (user-visible):**
- Landing page under code name with the independence disclaimer footer (D8).
- `/ingresar`, `/registro` behind invite-code gate; email confirmation flow.
- Onboarding step 1 only: pseudonym selection with the suggested-name generator (D3).
- Legal placeholder pages (`/terminos`, `/privacidad`, `/reglas`) marked "borrador".
- Dark/light theme tokens rendering (D8: cheap now, expensive later).

**Database work (migrations — PART 8 §8.10.1's canonical set 0001–0012 is the sole ordinal authority):**
- `0001` — extensions (citext, unaccent — **no pg_trgm in MVP**; it is the named P2 extension, PART 8 §8.11), default-privilege revokes, `nanoid()`, `public.es` FTS config, generic helpers, pinned search_path convention.
- `0002` — academic catalog tables + read_all policies (empty shells; the Rosario seed lands in S1 — seeds are not migrations, PART 8 §8.10.2).
- `0003` — `invites` (**created before profiles** for the FK; its created_by FK is backfilled in 0004 — PART 8's one intentional two-step).
- `0004` — `profiles` + `handle_new_user` trigger + invites FK backfill; RLS from the first table (D14.2); the `profiles_public` view pattern established here as the template 0010 generalizes (D5).
- Backup tooling: weekly `pg_dump` + R2 manifest export script, scheduled, and **restore-tested once end-to-end** (D13 — the exit plan is a tested script, not a promise).

**Backend work:** `@supabase/ssr` session plumbing, the reference Zod-validated Server Action, Resend auth SMTP, Sentry, and the daily keepalive/backup cron endpoints (detail under Security work and the deployment milestone).

**Frontend work:**
- Next.js App Router skeleton; Tailwind v4 token file implementing D8 (paper white, near-black ink, azul birome accent, 1px hairlines, radius ≤ 4px).
- Layout shell: header, nav, footer with "Sitio independiente hecho por estudiantes. Sin afiliación con la Universidad Católica Argentina."
- Auth pages with es-AR voseo copy: "Ingresá", "Creá tu cuenta", "Elegí tu seudónimo".

**Security work:**
- `@supabase/ssr` session plumbing; zero client-side Supabase queries except auth handshake (D5).
- Service-role key isolated to cron scripts; CI check that greps app code for it (D14.3).
- `NEXT_PUBLIC_` prefix audit in CI; Zod boundary pattern established with one reference Server Action.
- Resend SMTP wired for auth mail (C15-b); Sentry wired for errors.

**Legal work:** engage counsel in September (legal-page review + naming opinion; fee estimate carried in the §31.1 cost ladder **[HUMAN DECISION]**); the legal pages are pre-drafted by the founder during S1–S2 so counsel reviews rather than writes. **[LEGAL REVIEW]**

**Testing gate:**
- CI runs migrations from zero on a disposable database, then the pgTAP suite (first policies: profiles read/write, invites redeem-once).
- One Playwright smoke: register via invite → confirm email → onboard → see empty shell.
- Red CI blocks merge from day 1; this rule never relaxes.

**Deployment milestone:** production URL live on Vercel Hobby under code name (D10); daily keepalive cron running (C7 free-tier pause mitigation); backup cron running.

**Definition of done:** a stranger with an invite link can register, confirm email, pick a pseudonym, and log in on the production URL; backup runs and restore drill completed once; `docs/decisions.md` exists with its first entries.

**Calendar dependency:** none — S0 is the only phase that could run at any time of year, which is why it runs first and absorbs tooling surprises while no external date is at risk.

**Effort:** 3 solo-dev weeks (the third week is the former S1 buffer week, moved here where the tooling variance lives). Highest-variance phase (tooling friction: Supabase CLI, pgTAP harness, CI wiring). Nothing here is throwaway — this phase *is* the 10-year engineering posture.

## 28.4 Phase S1 — Núcleo (22 sep – 19 oct 2026, 4 solo-dev weeks; buffer absorbed by S0)

**Objective:** the cohort conversation loop works end-to-end on production: catalog → follow materias → post (pseudonymous or anonymous) → comment → vote → feed. The anonymity boundary — the product's hardest promise — is built and proven here, earliest and most-tested.

**Features:**
- Academic catalog browsing: sede → facultad → carrera → materia pages (read-only shells).
- Onboarding steps 2–3: optional carrera + año de ingreso; follow materias from the plan grid (brief §51 flow, minus anything unnecessary).
- Posts: single composer per D2 — body ≤ 10k required, optional title ≤ 120, optional materia tag, optional "pregunta" kind, optional Anónimo checkbox.
- Comments: one nesting level (depth ≤ 2), same anonymity option.
- Upvotes on posts and comments; no downvotes (C10).
- Feed: two tabs only — **Mis materias** (followed materias + own carrera) and **Reciente** (chronological).
- Materia pages: header + Publicaciones tab + follow button. Carrera pages: plan de estudios grid + recent activity.
- Profile pages: pseudonym, optional carrera/año, karma as plain text, post history (pseudonymous content only — anonymous content never listed).
- Per-thread anonymous aliases: "Anónimo 1", "Anónimo 2" stable within a thread (D3).

**Database work (migrations per PART 8 §8.10.1):**
- Catalog seed for Rosario (`db/seed/catalog/*` — seeds are not migrations, PART 8 §8.10.2): APPENDIX A §C data — 1 sede, 3 facultades, 14 carreras, Abogacía Plan 2013 (~52 materias) + Contador Plan 2017 (57 slots), plan-version column per APPENDIX A §E.3. SIN VERIFICAR carreras seeded but flagged `verified=false`, hidden from onboarding until confirmed.
- `0005` — `posts` (public_id nanoid, status enums, counters, `carrera_id` cohort snapshot and `locked_at` per §0.5-R3/R5), `comments` (depth CHECK — D4), `anon_aliases` ((post_id, author_id) → alias_num; no public read policy at all).
- `0006` — vote tables (PK (target_id, user_id)), `materia_follows`.
- S1 slices of `0010` (`posts_public`, `comments_public` nulling all author fields when is_anonymous — D5, D14.5) and `0011` (SECURITY DEFINER create_post / create_comment / toggle_*_vote with in-database rate limits (D14.9) and counter maintenance; the uniform nightly karma recompute per §0.5-R7).

**Backend work:** the S1 write RPCs and `_public` views above, wired through Server Components (reads) and Server Actions (writes) — zero client-side database queries (D5).

**Frontend work:**
- Feed list rows: dense, inline metadata, no cards (D8/brief §47); composer; thread view; materia/carrera/profile pages; follow buttons.
- RSC-first; client components only for composer, vote buttons, menus (Radix where a11y is hard).

**Security work:**
- pgTAP proves author fields of anonymous rows never appear through any view or function result — the deny tests are the deliverable.
- Rate limits at PART 10 values enforced in SQL functions; vote toggling idempotent; alias assignment race-safe.

**Testing gate:**
- pgTAP: every table's allow AND deny paths (D14.2).
- Unit: alias numbering, karma batching, slug generation.
- Playwright: post anonymously → verify no author leakage in DOM, API payloads, or OG tags.

**Deployment milestone:** founder + 2–3 accomplices use production as daily test users through October; seeded catalog browsable logged-out.

**Definition of done:** the full loop (register → follow → post → reply-as-Anónimo-with-stable-alias → vote → feed reflects it) runs on production with zero client-side database queries; the anonymity pgTAP suite is green and reviewed.

**Calendar dependency:** runs during the 2do cuatrimestre cursada (10 ago – 19 nov), when the founder is surrounded by the target users daily — composer copy, feed density choices, and the pseudonym generator get ambient hallway-testing for free. The founder should be capturing real questions from cohort WhatsApp groups all cuatrimestre; they become the S3-era seed threads (PART 29.2).

**Effort:** 4 solo-dev weeks (the former buffer week now lives in S0). Largest phase by design — the riskiest code sits earliest.

## 28.5 Phase S2 — Utilidad (20 oct – 9 nov 2026, 3 solo-dev weeks)

**Objective:** the utility magnet: resources upload/download and search, plus the SEO base that makes materia pages discoverable — the cold-start engine (D11, brief §37). After this phase the product delivers value to a visitor who never meets another user.

**Features:**
- Resource upload: PDF/images, ≤ 10 MB/file, ≤ 3 files/resource, per-user quota; typed (resumen/apunte/parcial/final/guía/otro); año; optional Anónimo (D2).
- Resource pages: metadata, download counts, upvotes; Recursos tab on materia pages; `/recursos` index.
- Search v1: Postgres FTS (spanish + unaccent) over posts, materias, resources; `/buscar?q=`.
- SEO base: SSR public pages, sitemap, metadata/canonical, OG tags; durable URL map complete (D7).
- OG share-preview image template (title, materia, tipo) — a launch-strategy dependency (PART 29.4), not polish.

**Database work (migrations per PART 8 §8.10.1):**
- `0007` — `resources` (public_id, materia_id, tipo enum, año, is_anonymous, status incl. `borrador`, downloads_count, price_cents nullable-unused — C11 extension point only), `resource_files` (storage_path, mime, size CHECK ≤ 10 MB, `replaced_at`, original filename as sanitized metadata).
- S2 slices of `0010`/`0011`: `resources_public`; `request_upload` / `finalize_upload` / `register_download` (quota + download dedup per §0.5-R9/R12); FTS search functions `search_posts` / `search_resources` / `search_catalog` over PART 8's `public.es` config (§0.5-R13).

**Backend work:** Cloudflare R2 setup — account, quarantine + final buckets, S3 API credentials in server env, and the server-side signed-URL utility (120 s TTL, PART 14); the createResourceDraft / finalizeResource Server Actions calling the RPCs above.

**Frontend work:**
- Upload flow with type/materia/año picker and the copyright self-declaration checkbox: "Declaro que este material es de mi autoría o tengo permiso para compartirlo" (final wording in PART 14).
- Resource rows (not cards), search page with type filters, empty states that point to upload ("Todavía no hay recursos de esta materia. Subí el primero.").

**Security work:**
- Server-side upload validation: MIME sniffing, size, extension allowlist (PART 10); signed URLs with short TTL.
- DB and R2 storage telemetry wired to the amended D13 trigger dashboard (DB 70% of 500 MB → Supabase Pro; R2 70% of 10 GB → R2 paid, cents). With files on R2 — zero egress fees — the old storage/egress cliff is retired; the break order is moderation labor first, DB size second, R2 storage third (D13).

**Testing gate:**
- Upload-pipeline tests: a pending (quarantine) upload is unreachable without its signed URL; downloads only via the server-minted 120 s signed-URL flow (R2 paths per PART 14).
- E2E: upload → appears in materia Recursos → download increments count.
- FTS returns accented/unaccented matches ("constitucion" finds "Constitución").

**Deployment milestone:** founder uploads the first 20 real resources to production as pipeline validation (these count toward the PART 29.2 seed target).

**Definition of done:** "resumen derecho constitucional" typed into site search returns the seeded resumen; the materia page renders complete metadata logged-out; Google Search Console verified and sitemap submitted.

**Calendar dependency:** must complete ≥ 2 weeks before the 23 nov finales start — the seed sprint (§28.7) needs a working upload pipeline, and the shelf must be loaded and searchable before the first beta invitee arrives needing it for an actual final. S2 slipping past 9 nov compresses the seed sprint, not the beta date.

**Effort:** 3 solo-dev weeks.

## 28.6 Phase S3 — Confianza (10 nov – 22 nov 2026, 3 solo-dev weeks compressed)

**Objective:** everything that makes it safe to let strangers in: reports, moderation panel, restrictions, notifications, deletion, real legal pages, and the full RLS regression suite. Beta cannot start without this phase complete — trust features gate people, not the reverse (D14.10).

**Features:**
- Report flow on every content type, categories per PART 11 ("Reportar" on every row).
- `/mod` panel: queue, remove/restore/warn/suspend/ban actions, moderator notes, immutable audit log (brief §18: no raw database access for moderation).
- User restrictions enforcement in write functions (suspended users blocked at the database layer).
- Notifications v1, in-app only: replies to your post/comment, mod decisions against your content; `/avisos` page + badge.
- Account deletion flow with the two content options: "borrar mis publicaciones" / "conservarlas como usuario eliminado" (D3).
- Legal pages with real text: Términos, Privacidad, Reglas. **[LEGAL REVIEW]** — the S1–S2 pre-drafts go to counsel (engaged since September, §28.3) so counsel reviews rather than writes; live before beta; includes the 16+ age statement and habeas-data/ARCO contact channel (C15, research notes §1/§6).

**Database work (migrations per PART 8 §8.10.1):**
- `0008` — `reports` (exactly-one-target nullable-FK+CHECK pattern, the 12-value categoria enum per PART 11 §11.3.1), `mod_actions` (immutable audit rows, public reason + internal notes), `user_restrictions` (until-null-permanent), plus the `appeals` fold-in (§0.5-R15).
- `0009` — `notifications` (actor_display precomputed respecting anonymity — D4), `events` (name, day-bucketed counts, no per-user tracking — PART 24), plus the `search_queries` / `download_log` fold-ins per PART 8 §8.10.1.
- `0012` — scheduled-job SQL invoked by the daily `/api/cron/aggregates` endpoint (§0.5-R16): retention purges, soft-delete hygiene, body-nulling on user deletion.

**Backend work:** the mod_* action RPCs, restriction enforcement inside the write functions, notification writes, and the retention jobs on the daily cron (content as listed under Features and Security work).

**Frontend work:**
- Report dialog; mod panel as dense keyboard-friendly tables (the founder will live here for a year); notifications; `/ajustes` with deletion.

**Security work:**
- Mod role enforcement in RLS; every mod action audited; report submission rate-limited; appeal path recorded.

**Testing gate:**
- The **full pgTAP regression suite** (every policy, every function, allow + deny) becomes the permanent release gate from here.
- E2E: report → mod removes → author notified → content publicly shows "Eliminado por moderación" → restriction blocks the author's next post at the DB layer.

**Deployment milestone:** production is beta-ready; first invite batch generated with per-batch codes for funnel attribution.

**Definition of done:** the founder can run a complete moderation incident (report → action → restriction → appeal note) end-to-end without touching the database dashboard.

**Calendar dependency:** the hard deadline of the whole build — finales begin 23 nov 2026 (verified) and the beta's value proposition expires with the turno on 22 dic. This is the only phase with an immovable external date, which is why it gets the §28.9 row-1 slip rule instead of scope cuts.

**Effort:** 3 solo-dev weeks, deliberately compressed against the 23 nov beta date. If it slips, **beta slips into December rather than S3 being cut** (see §28.9 row 1).

## 28.7 Seed sprint + Beta cerrada (17 nov – 22 dic 2026)

**Seed sprint (17–22 nov, overlaps S3 tail):** founder + 5–10 accomplices load the PART 29 seed package — 80–150 resources concentrated in one carrera, 15–20 genuine founder threads. This is community work, not dev work; it fits beside S3's final testing without violating the no-overlap rule of §28.1.

**Beta cerrada (24 nov – 22 dic, the finales window):** 20–50 students of one carrera, invite links only. The founder's job during beta is **answering and moderating, not building** — only bugfixes ship. Full protocol, script, and funnel in PART 29.

- **Objective:** prove the D1 thesis with strangers under real exam pressure: utility recruits (finales downloads), conversation retains (W2 return), moderation is manageable (brief §40.7).
- **Testing gate (of the product, by reality):** the D11 numbers — evaluated at the §28.9 checkpoints, not renegotiated after the fact.
- **Deployment milestone:** production carries real strangers' content through a finales period without a security or data-loss incident.
- **Definition of done:** beta report written and committed to the repo: funnel numbers, W2 retention, posts/week, moderation load actuals vs. the PART 11 model, quota consumption actuals vs. the PART 21 model, top-10 user complaints.
- **Calendar dependency:** the beta *is* a calendar event — it exists because 23 nov – 22 dic is when the cohort's need for parciales viejos and últimos-consejos threads peaks (utility mode, spine 0.1.2). The same product launched in October cursada-lull would test worse for reasons that have nothing to do with the product.
- **Effort:** ~1 solo-dev week total (fixes), spread thin; ~15 h/week of community time for the founder.

## 28.8 Hardening + Wave 2 + Lanzamiento público (ene – mar 2027)

**Enero 2027 (summer crater, deliberate slack):**
- Performance passes against PART 22 targets; accessibility audit (brief §27); backup/restore re-drill.
- **Naming resolution per D10 — launch-blocking.** [HUMAN DECISION] [LEGAL REVIEW] Verify uca.net registrability/price, trademark opinion on "UCA" in the name (research notes §8), fallback name ready; the rename is a one-day change by architecture.
- Legal pages finalized with counsel; RNBD registration decision (research notes §1). **[LEGAL REVIEW]**
- Moderator #2 and #3 recruited from beta standouts and onboarded on the PART 11 playbook (C13).
- No growth activity — the audience is at the beach; January DAU near zero is seasonality, not failure (spine 0.1.2).

**Febrero 2027 — beta wave 2 (during finales feb/mar, ~2 feb – 4 mar projected):**
- Second carrera's seed sprint + champion under the PART 29.8 protocol; invite cap raised to ~150 total.
- Verify the D11 gate holds across two carreras (§28.9 row 5); fix the top-10 beta complaints list.

**Lanzamiento público (semana del 8 mar 2027, projected):**
- Open registration (invite gate off, or trivially open codes); registration throttle per PART 29.9.
- QR posters at the sede timed to inscripciones and first week of cursada; second push at ingresante start (~15 mar) targeting año 1 materias.
- Launch-day checklist (PART 29.9) run in full the day before; any unchecked item blocks.

**Definition of done:** open registration live during the first two weeks of cursada; ≥ 3 carreras seeded; ≥ 2 moderators besides the founder active; all D13 telemetry green; the platform survived its first open week within the PART 11 moderation model.

**Effort:** 4–5 solo-dev weeks spread across 10 calendar weeks (the rest is community/legal work).

## 28.9 Kill / pivot checkpoints (pre-committed, so the decision is cheap when it hurts)

| # | Checkpoint | Date | Green (continue) | Yellow (pause + fix) | Red (stop building) |
|---|---|---|---|---|---|
| 1 | S3 done? | 20 nov 2026 | Beta opens 24 nov | Slip beta ≤ 2 weeks into Dec | S3 not done by 10 dic: beta moves to the feb 2027 wave; launch target unchanged |
| 2 | Beta W2 retention | ~8 dic 2026 | ≥ 40% (D11 gate) | 20–39%: diagnose before building anything — 10 user interviews; is it density, utility, or product? | **< 20%: full stop.** No P2 work. Re-examine thesis: wrong carrera? wrong seed? wrong product? Pivot options: utility-only (resource library without feed) or a different cohort |
| 3 | Organic posts/week | 22 dic 2026 | ≥ 30 (D11) | 10–29: measure founder-share of posts (< 50% required); re-concentrate invites in fewer comisiones | < 10 organic: the conversation thesis fails; consider utility-only pivot |
| 4 | Naming resolved | 31 ene 2027 | Launch as planned | Fallback name adopted (D10: one-day change) | Never red — fallback names exist by design |
| 5 | Wave-2 gate | 4 mar 2027 | Both carreras ≥ 35% W2 → open launch | One carrera weak → launch open only to the strong facultad | Both < 20% → do not open; stay invite-only and rethink during the March cursada with real users |
| 6 | Post-launch M1 | ~10 abr 2027 | WAU growing; mod load within the PART 11 model | Quota triggers hit → execute the D13 spend | Toxicity/mod overload → slow growth deliberately (invite gate back on) |

Reading discipline for rows 2–3: the December beta runs during finales, so **the December gate is a utility-mode reading**; the **binding retention verdict is re-taken at the March checkpoint (rows 5–6) under cursada conditions**. The 40% and 30-posts thresholds are priors, not physics — recalibrate them from wave-1 actuals before wave 2.

The kill rule in one sentence: **never respond to weak retention by building more features; respond by talking to ten users.**

## 28.10 P2 — Consolidación 2027 (abr – nov 2027, ~10 solo-dev weeks spread thin)

**Objective:** deepen retention for the community that now exists. Every P2 item was cut from MVP by C1 and earns its slot only if launch metrics show the need; the sequence below is by expected retention impact and may be reordered by evidence, never by novelty.

**Features (in order):**
1. **Bookmarks** — "Guardar" on posts/resources; `/guardados` page.
2. **Mentions** — `@seudonimo` in comments; notification type; mentioning is impossible toward anonymous authors (no addressable identity — D3 holds).
3. **Email digest** — weekly per-materia digest via Resend, strictly opt-in, calendar-aware (pauses itself in January; PART 12). The re-engagement tool for the July winter break. **[FREE-TIER RISK]** Resend free tier ~100 mails/day — batch, cap, and degrade to "resumen quincenal" before ever paying.
4. **Polls** — composer kind "encuesta", options table, one vote per user, results visible after voting (brief §9-A).
5. **Tendencias** — third feed tab, cron-computed from vote/comment velocity, formula published on the page (brief §16: the system stays understandable).
6. **Resource ratings** — structured usefulness rating ("¿Te sirvió? Sí/No" + optional tags), aggregated on the resource page. No free-text reviews of *people*, ever (C9 perimeter).

**Database work (migrations):** `0101_bookmarks`, `0102_mentions`, `0103_email_prefs`, `0104_polls`, `0105_trending_aggregates`, `0106_resource_ratings`. Each with its RLS + pgTAP additions.

**Backend work:** the digest send pipeline via Resend (batched, daily-capped), the Tendencias cron aggregation, and server-side mention parsing — as listed under Features and Security work.

**Frontend work:** each feature is a small surface on existing pages; no new top-level sections except `/guardados` and the Tendencias tab (D7 already reserves nothing else).

**Security work:** mention parsing server-side (no client-trusted handles); digest unsubscribe token-based, one click (consumer-law hygiene, research notes §5); poll vote functions rate-limited like votes.

**Testing gate:** full regression suite + one E2E per feature; digest send tested against a seeded 100-user fixture for the daily cap.

**Deployment milestone:** features ship individually as they finish — no feature-flag infrastructure at this scale, no bundled releases.

**Definition of done (phase):** by nov 2027, W4 retention of the March cohort ≥ 40%, digest opt-in ≥ 25% of WAU, and the July winter-break trough shallower than the January one in relative terms.

**Effort:** ~10 solo-dev weeks across 8 months — deliberately thin, because 2027's scarce resource is community time (rungs 2–3 of PART 30), not code.

## 28.11 P3 — Memoria e identidad (2028, ~8–12 solo-dev weeks)

**Objective:** the SIEMPRE dimension becomes visible product, and the moderation structure becomes a team. The archive UI arrives here, but the *data* has been archival since day 1 (D2) — P3 builds windows, not warehouses.

**Features:**
1. **Archive UI** — `/archivo` + `/archivo/[year]`: living content by year, aggregate anonymized statistics, curated milestones. C6 rules bind: never a frozen snapshot, never resurrected deletions; deletion rights win over preservation.
2. **Memoria del año** — the December aggregate page (PART 30.7), generated from the archive machinery; a hand-made v1 is acceptable in dec 2027 ahead of this phase.
3. **Para vos** — light personalization tab: followed materias + carrera + recency, weights published, no opaque ranking (brief §16).
4. **Moderator expansion** — per-facultad mod teams, mod-of-mods audit view, appeal workflow v2 (PART 11; C13 makes this a feature with the same weight as any user-facing work).
5. **Professor pages — only if counsel clears the design.** Structured, opinion-framed, no free-text accusations, no crime allegations, ARCO/takedown channel wired (C9; research notes §2–3). **[LEGAL REVIEW]** The default plan is they do NOT ship in 2028; teaching discussion stays in materia pages under "experiences yes, attacks on persons no".

**Database work (migrations):** `0201_archive_milestones`, `0202_yearly_aggregates`, `0203_feed_signals`, `0204_mod_teams`, `0205_professors` (written only after counsel sign-off; the catalog's neutral cátedra metadata from D4 is *not* this feature).

**Backend work:** archive/yearly aggregation jobs run against public views only, memoria generation, and mod-team tooling — as listed under Features and Security work.

**Frontend work:** archive pages designed for permanence (they are the 2036 student's entry point — brief §66); Para vos tab; mod team views.

**Security work:** archive aggregation runs against public views only (no author leakage through statistics); professor-page moderation pipeline (if built) gets the strictest rate limits and pre-publication queue in the product.

**Testing gate:** regression suite + archive-aggregation tests proving deleted content never reappears in any aggregate; retention-job tests.

**Deployment milestone:** `/archivo/2026` and `/archivo/2027` public; first memoria del año generated from real machinery (dec 2028).

**Definition of done (phase):** a logged-out visitor can answer "what was this place like in 2026?" from the archive alone; moderation runs a week without founder front-line involvement.

**Effort:** ~8–12 solo-dev weeks; professor pages, if cleared, add ~4 more and their own **[LEGAL REVIEW]** budget line (PART 31.6).

## 28.12 P4+ — Marketplace (2029+, gated, ~12+ solo-dev weeks when triggered)

**Objective:** paid distribution of student-created resources — built only if the Etapa C gates in PART 15 pass. This phase is triggered by evidence, not scheduled by ambition (C11).

**Gates (owned by PART 15, restated):** sustained organic demand signal for paid resources; legal entity exists; counsel engaged on marketplace terms; Vercel Pro active (C8); community trust metrics healthy.

**Features:** paid resources alongside the free-forever majority; seller onboarding (sellers are never anonymous — D3); Mercado Pago Split checkout; refund/dispute flow; seller dashboard.

**Database work (migrations):** `0301_marketplace_sellers`, `0302_orders_payments` (MP as source of truth; local rows are references, never balances), `0303_disputes`. The `price_cents` extension point from D4 finally becomes non-null-capable.

**Backend work:** the Mercado Pago Split checkout integration and webhook handling — as detailed under Security & legal work below.

**Security & legal work:** MP Split integration — **the platform never takes custody of sellers' money** (PART 31.3, research notes §7); webhook signature verification; consumer-law surfaces (botón de arrepentimiento, Data Fiscal — research notes §5). **[LEGAL REVIEW]** throughout.

**Testing gate:** payment-flow E2E against MP sandbox; dispute-flow E2E; regression suite.

**Definition of done:** first 10 real transactions completed with zero custody of funds and a working refund path.

**Effort:** ~12+ solo-dev weeks — comparable to the original MVP (C11 said so; the estimate honors it).

## 28.13 Timeline (one page)

```
2026                                                          2027
        Sep       Oct       Nov       Dec       Ene       Feb       Mar
Week    1234      1234      1234      1234      1234      1234      1234
        ──────────────────────────────────────────────────────────────────
S0      ███
S1         ████████                          (buffer absorbed by S0's 3rd week)
S2                 ███
S3                    ███
Seed                    ██                   (17–22 nov, community work)
Beta                     █████               (24 nov – 22 dic; finales window)
Harden                        ░░░████        (ene: naming, legal, perf, mods)
Wave 2                                 ████  (finales feb/mar; 2nd carrera)
LAUNCH                                        ██  (semana del 8 mar)
        ──────────────────────────────────────────────────────────────────
UCA     │←── 2C cursada ──→│finales  │  verano (crater)  │finales│ins│1C→
        │   (until 19/11)  │23/11-22/12│                  │2/2-4/3│24/2│9/3
        ──────────────────────────────────────────────────────────────────
Gates   ▲ checkpoint 1 (20 nov)  ▲ chk 2 (8 dic)  ▲ chk 4 (31 ene) ▲ chk 5 (4 mar)
                                   ▲ chk 3 (22 dic)
        ──────────────────────────────────────────────────────────────────
Then:   P2 abr–nov 2027  bookmarks → mentions → digest → polls → tendencias → ratings
        P3 2028          archivo UI · memoria del año · para-vos · mod teams · (professor pages IF cleared)
        P4+ 2029+        marketplace, gated by PART 15 Etapa C
```

## 28.14 Effort summary (auditable against §28.1 assumptions)

| Phase | Solo-dev weeks | Calendar window | Dominant risk |
|---|---|---|---|
| S0 Fundaciones | 3 (incl. former buffer) | late ago/1 – 21 sep 2026 | Tooling friction |
| S1 Núcleo | 4 | 22 sep – 19 oct | Anonymity correctness |
| S2 Utilidad | 3 | 20 oct – 9 nov | Upload pipeline (R2) correctness |
| S3 Confianza | 3 | 10 – 22 nov | Schedule compression |
| Beta + fixes | 1 (+community) | 24 nov – 22 dic | Retention truth arrives |
| Harden + wave 2 + launch | 4–5 | ene – mar 2027 | Naming; two-carrera gate |
| **Total to public launch** | **18–19** | **~27 calendar weeks** | Buffer ratio ≈ 1.4× — consistent with ±50% variance |
| P2 | ~10 | abr – nov 2027 | Founder attention split |
| P3 | 8–12 (+4 if professors) | 2028 | Legal gating |
| P4+ | 12+ | 2029+, triggered | Everything (own project) |

## 28.15 Standing operating cadence (from beta onward, permanent)

The roadmap above is the build; this is the heartbeat that keeps the calendar-awareness real after launch:

- **Weekly:** metrics dashboard run (§30.9); backup freshness check (restore-test monthly, not weekly); mod queue review.
- **Monthly:** quota consumption vs. D13 triggers reviewed and logged in `docs/decisions.md`; founder-share and organic-content metrics reviewed against the current rung's climb criteria (§30.1).
- **Per cuatrimestre (feb and jul):** confirm the real Rosario academic calendar for the coming term and update the seeded calendar data (APPENDIX A §E.4); curated catalog update — new planes, renamed materias, verification of SIN VERIFICAR carreras (APPENDIX A §E.5: manual updates, never live scraping); QR/poster run planned against the new term's dates (§30.7.2).
- **Annually (dic):** memoria del año (§30.7.4); dependency and legal-page review; the founder re-answers §28.1's hours/week question honestly for the coming year. **[HUMAN DECISION]**

---

# PART 29 — LAUNCH STRATEGY

**Decision:** The first 100 users are recruited as a designed experiment, not an announcement: one carrera (the founder's own), invited person-by-person over WhatsApp with deep links into pre-seeded real content, during the November finales window, with a week-by-week behavior script and a numeric gate (D11) that decides whether registration ever opens. We never launch into an empty shelf — every cohort that arrives finds its materias already populated.

Rationale: brief §37–38 correctly identify cold start as the existential risk. The answer to brief §59 Q11, owned here: **the strongest cold-start strategy is single-player utility concentrated in one cohort** — a resource library dense enough in ONE carrera that the first visit pays off with zero other users online, timed to the moment of maximum need (finales). Conversation is layered on top of utility, never the reverse. Density is engineered by segmentation (spine 0.1.1): 40 students of one carrera beat 400 scattered curious visitors.

## 29.1 WHO exactly, in order

1. **The founder's own carrera + año cohort** — the ~30–80 students who already know the founder by face. This plan writes **Abogacía** in every example because it is the largest verified catalog (APPENDIX A §C.4); substitute the founder's real carrera everywhere. **[HUMAN DECISION]** Why this cohort first: trust is pre-existing (no cold outreach), the founder can answer domain questions credibly (the < 3 h SLA of §29.6 is only keepable in your own carrera), and the seed content maps exactly to their materias and their finales.
2. **3–5 socially central "nodos" per comisión** — the students who already administer the WhatsApp groups, share apuntes unprompted, and answer everyone's logistics questions. Identified by observation, not application. Each nodo is invited personally, by name, with a specific ask: "Subí tus resúmenes de Procesal — los de Constitucional ya están." A nodo who adopts the platform carries 10–20 passive users behind them; a broadcast carries none.
3. **The apunte-makers, recruited as founding contributors.** Every carrera has 2–4 people whose resúmenes circulate for years. Terms of recruitment:
   - A personal conversation before the platform is mentioned in any group.
   - Upload help: the founder digitizes/uploads for them if needed.
   - Attribution as they choose: pseudonym or Anónimo (D3 applies to them like anyone).
   - Recognition, private and durable: a personal thank-you from the founder, and a mention in the December memoria del año (with their consent). No public label or special flag exists on their profiles or resources — PART 14 §14.11's no-special-flags rule; founding-generation status is grown in memory, not manufactured in chrome (brief §12).
   - No payment, no exclusivity: their material keeps circulating wherever it already circulates. The platform's pitch is permanence and reach, not control.

**Who NOT to invite first:** friends outside UCA (pollute density and metrics), professors or authorities (chill the room before norms exist), journalists/centros de estudiantes (amplification before the D11 gate is noise), anyone reached through a broadcast (see 29.4).

## 29.2 WHAT exists before anyone arrives (the shelf)

- **80–150 genuinely good resources concentrated in the launch carrera** (D11), with coverage targets:
  - ≥ 5 resources for every materia of años 1–3 (the heavy-enrollment years).
  - At least one parcial/final viejo per core materia *where the copyright posture allows* (PART 14 rules; research notes §4 flags exams as a grey zone — **[LEGAL REVIEW]** posture set before seeding, steering toward self-authored resúmenes as the safest category).
  - Every seeded resource individually vetted by the founder for actual quality — the shelf is the first impression and the D11 bet.
- **Materia pages complete:** every materia of the carrera with correct plan/año/cuatrimestre mapping (seeded in S1 from APPENDIX A data), so browsing feels like an institution, not a beta.
- **15–20 genuine founder-posted threads:** real questions the founder actually has, real experiences, real logistics — "¿Alguien rindió el final de Romano en la mesa de diciembre? ¿Cómo toman?" — spread across the cohort's current materias and timed to finales topics. These model the register we want: specific, useful, unguarded.

## 29.3 The ethics line on seeded content **[HUMAN DECISION]** (recommended position stated as policy)

Seeded content must be REAL and honestly attributed:

- The founder posts under their own single pseudonym.
- Any additional account operated by the founder or team carries a visible **"equipo"** label on its profile.
- **Sockpuppets — multiple fake personas simulating a crowd — are prohibited, permanently.**

Reasons beyond ethics: (a) in a 40-person beta, fakery is detectable, and its discovery would be fatal to the exact trust the product sells; (b) the D11 gate measures *organic* behavior — polluting the metric blinds the kill checkpoints (§28.9) and turns pre-committed decisions into self-deception; (c) the archive is forever (C16), and the founding record should survive scrutiny in 2036. Cost accepted: the site looks quieter in week 1. Density comes from cohort concentration, not from theater.

**Accomplice seeding (the 5–10 helpers of D11):** each accomplice uploads their own real materials under their own account (pseudonym or Anónimo as they prefer) and posts only what they genuinely mean. Founder provides a per-person checklist: 3 uploads + 2 posts + reply to anything you actually know. They are beta users with a head start, not staff, and they count as non-organic in every §29.7 metric.

## 29.4 Invite mechanics

- **Personal WhatsApp messages, one at a time, each with a specific resource deep link** — never a broadcast to a group. Broadcast into cohort groups is reserved as a rung-2 growth channel (PART 30.3), and even then it is done voluntarily by nodos, never by the founder.
- Template for a cohort peer (adapted per person, never pasted verbatim):
  - *"Che, armé un sitio con apuntes y foros de la facu. Subí el resumen de Constitucional que usamos para el parcial — fijate: [link directo al recurso]. Si te sirve, registrate con este código y contame qué falta de [la materia que cursa esa persona]."*
- Template for an apunte-maker:
  - *"Tu resumen de Obligaciones me salvó el año pasado. Estoy armando un lugar donde eso no se pierda cada año en los grupos — ¿te lo subo yo con el crédito que quieras, o preferís subirlo vos? Mirá cómo queda: [link]."*
- The deep link must render a **rich OG preview** (title, materia, tipo, page count — built in S2) so the message demonstrates value before the click. If the preview is broken, the invite waits.
- Invite links are per-batch coded (`invites` table, D4) so the funnel is attributable: which nodo's tree produced retained users, which materia's resources convert best.
- Every invite is followed up exactly once after 4–7 days, personally, with something new ("subieron el parcial viejo de X") — never with "¿viste mi mensaje?".

## 29.5 What the first invitee sees (day-1 walkthrough — brief §38's "what they should see")

The experience the invite is engineered to produce, step by step:

1. **The WhatsApp message** shows a rich preview of a resource they recognize needing ("Resumen — Derecho Constitucional — 42 págs."). The first impression happens inside WhatsApp, before any click.
2. **The resource page, logged out:** full metadata, the materia context visible, download gated behind registration with honest copy — "Registrate con tu código de invitación para descargar. Es gratis y tu identidad real no se muestra nunca."
3. **Registration → onboarding, under 2 minutes:** email + password, pseudonym (with the generator offering es-AR options), optional carrera/año, follow-materias grid pre-filtered to their carrera. No other questions (brief §51).
4. **Landing after onboarding: the materia page they came for**, not a generic feed — the download completes, and the page shows the shelf (5+ more resources for this materia) and the conversation (a founder thread about exactly this final).
5. **The feed, discovered second:** **Mis materias** already populated because they followed materias during onboarding — no empty state on first contact. The anonymity affordance is visible in the composer ("Publicar como Anónimo") before they ever need it.
6. **First session exit:** they leave with a file that helps tomorrow's study session. Everything else — posting, returning, contributing — is week-2 and week-3 work (§29.6), built on this first fulfilled promise.

Steps 2 and 4 are product requirements on PARTS 6–7 (flows/IA), noted here because the launch depends on them: **the invite deep link must survive the registration flow and return the user to the resource** — a lost redirect is a lost first impression.

## 29.6 WHAT behavior we cultivate, week by week (beta script, 24 nov – 22 dic)

**W1 (24–30 nov) — consume + react.**
- Goal: every invitee finds one resource that helps their actual final, and upvotes something.
- Founder's job: respond to every report and bug within hours; post at most 1 thread/day (do not dominate the feed you are trying to measure).
- Metrics: ≥ 60% of registered users download ≥ 1 resource; ≥ 40% cast ≥ 1 vote.

**W2 (1–7 dic) — first questions, answered fast.**
- Goal: asking works. The founder (and accomplices) guarantee every question a substantive answer in **< 3 hours** during daytime — the single most retention-critical service level of the entire launch. A question that dies unanswered in week 2 teaches the exact wrong lesson to the exact wrong people.
- Mechanics: founder seeds one question-shaped thread per active materia if organic ones don't appear by Tuesday; answers cite resources on the shelf (closing the loop between conversation and utility).
- Metrics: ≥ 10 organic questions; median first-answer time < 3 h; **W2 return ≥ 40% (the D11 gate) / < 20% = kill checkpoint (§28.9 row 2)**.

**W3–W4 (8–22 dic) — first organic resource uploads.**
- Goal: contribution without prompting.
- Mechanic: when someone answers a question well, the founder replies asking them to upload the underlying material — "Eso está buenísimo — ¿lo subís a la página de la materia así queda para los que rinden en febrero?" The February finales are the natural motivation: today's answer is February's shelf.
- Metrics: ≥ 10 resources uploaded by non-accomplices; ≥ 30 organic posts/week (D11); founder share of posts < 50% and falling.

## 29.7 Measurement (the beta funnel, instrumented via the PART 24 events table)

| Funnel stage | Definition | Target | Red line |
|---|---|---|---|
| Invited | personal invites sent | 60–80 | — |
| Registered | completed onboarding | ≥ 50% of invited | < 30% |
| Activated | downloaded or voted in first session | ≥ 70% of registered | < 40% |
| W2 return | any session in week 2 | **≥ 40% (gate)** | **< 20% (kill)** |
| Posted | ≥ 1 organic post/comment by W4 | ≥ 30% of registered | < 10% |
| Organic posts/week | non-founder, non-accomplice | **≥ 30 (gate)** | < 10 |

- Funnel drop-offs are diagnostic, not just pass/fail: invited→registered failing means the pitch or the preview is wrong; registered→activated failing means the shelf is wrong; activated→W2 failing means density or conversation is wrong. Fix the failing stage; do not average across them.
- Qualitative layer: 10 short interviews in W3 regardless of the numbers — "¿por qué volviste?" / "¿qué te faltó?" — because at n=40, conversations carry more information than percentages.
- All measurement from the `events` table + SQL; no external analytics (PART 24).

## 29.8 Expansion protocol — carrera by carrera (feb 2027 onward)

A carrera launches only when all four exist; **never launch into an empty shelf**:

1. **A champion:** one named student of that carrera — recruited from beta users with friends there, or a nodo-equivalent found by the founder — who owns the first month socially: first invites, first answers, first "this is ours" energy. No champion, no launch; the founder cannot be the champion of a carrera not their own.
2. **A seed sprint:** 1–2 weeks, target ≥ 40 resources covering años 1–2 core materias minimum, run by champion + founder + that carrera's apunte-makers under the same §29.3 ethics rules. The carrera's catalog is verified/corrected first — several Rosario carreras are SIN VERIFICAR in APPENDIX A (§B); never seed against an unverified plan. **[HUMAN DECISION]** per-carrera order; recommended: Contador Público second (verified plan, large cohort, APPENDIX A §C.5), then the Ingenierías (verified), then the Comunicación/Sociales cluster as verification lands.
3. **A QR/poster moment at the sede:** physical A5 posters at that facultad's floor/cafetería, timed to a need peak (inscripciones or parciales), QR deep-linked to that carrera's page — never to the homepage. Poster copy sober and utility-first: *"Resúmenes, parciales viejos y foros de tu carrera. Hecho por estudiantes."* Permission posture: ask nothing institution-wide, use the notice boards where student postings are customary, remove immediately if asked. **[HUMAN DECISION]** — guerrilla posting inside the sede carries relationship risk with the university (C2 context); the founder sets the risk appetite per facultad.
4. **The gate re-check:** each carrera must hit ≥ 35% W2 return of its first 30 users before the next carrera starts. Two simultaneously weak carreras stretch founder answer-capacity past the PART 11 model and blur the diagnosis.

## 29.9 Launch-day checklist (semana del 8 mar 2027)

Run top to bottom the day before opening registration; any unchecked item blocks the launch:

1. **Legal pages live** in final counsel-reviewed text (Términos, Privacidad, Reglas), including the 16+ statement and ARCO channel. **[LEGAL REVIEW]**
2. **Naming resolved** (D10): domain secured or fallback adopted; wordmark consistent. **[HUMAN DECISION]**
3. **Mod coverage scheduled:** founder + ≥ 2 moderators with explicit daytime shifts for launch week; PART 11 escalation path written and shared; report SLA target < 24 h.
4. **Rate limits armed** at the PART 10 values and load-tested; registration throttle configured — cap ~50 new accounts/day for week 1. Density beats headline numbers, and the cap bounds the moderation surge.
5. **Backup verified:** last `pg_dump` restore-tested < 7 days old; R2 manifest current (D13).
6. **Quota telemetry green with headroom:** DB < 40% of the 500 MB cap; R2 storage < 50% of the free 10 GB. Launch-week download spikes are free — R2 charges zero egress (D13/§0.5-R17) — so the watch is DB size and MAU; the Supabase Pro spend decision must be executable same-day if the D13 triggers fire. **[FREE-TIER RISK]**
7. **Sentry clean** for 7 days; PART 22 performance targets passing on 3G-throttled mobile.
8. **Shelf check per open carrera:** ≥ 40 resources, materias verified, empty-state copy pointing to upload.
9. **QR posters printed** with placement plan per facultad; nodos briefed on the (voluntary) WhatsApp shares.
10. **Rollback plan written:** the invite gate re-enables with one config change if moderation load or quotas run red; the person authorized to pull it (the founder) is named in the plan.

---

# PART 30 — GROWTH

**Decision:** Growth is a ladder of five rungs — 0→10, 10→100, 100→500, 500→1k, 1k→10k — each with its own dominant channel, retention requirement, content-density requirement, moderation-capacity requirement, infra checkpoint, and named failure mode; we do not climb a rung until the current one's requirements hold. We invest only in organic mechanics (share-preview quality, QR moments, SEO long-tail, "resumen salvador" loops, the December memoria) and categorically refuse paid ads, engagement notifications, invite-spam incentives, and growth hacks.

Rationale: brief §36 asks for a realistic path; realism here means acknowledging that each rung breaks a different thing — silence, founder-dependence, toxicity, mod burnout, ceilings-plus-dilution — and that the scarce resource changes at each rung: first content, then the founder's hours, then moderation labor (C13), and only lastly infrastructure. A plan that treats growth as one continuous curve will optimize the wrong constraint at every stage.

## 30.1 The ladder at a glance

| Rung | Dominant channel | Retention mechanism that must be true | Content density requirement | Mod capacity requirement (PART 11 model) | Infra checkpoint (PART 21 model) | Failure mode to watch |
|---|---|---|---|---|---|---|
| 0→10 | Founder's personal invites | Founder answers everything < 3 h | Shelf: ≥ 80 resources, 1 carrera | Founder alone, minutes/day | Nothing meaningful | **Silence** |
| 10→100 | Nodo invites + cohort WhatsApp shares | Cohort feed rewards a daily 2-min check during cursada | ≥ 3 posts/wk per active materia; founder < 50% of posts | Founder alone, ≤ 30 min/day | DB and R2 < 30% of caps | **Founder-dependence** |
| 100→500 | SEO long-tail ("resumen <materia> uca") + carrera expansion | Utility visit converts to follow + return | ≥ 5 active materias per carrera; ≥ 40 resources/carrera at entry | Founder + 2 mods; report SLA < 24 h | DB-size watch begins; D13 70% triggers armed (download egress free on R2) | **Toxicity emergence** |
| 500→1k | Inter-facultad word of mouth + QR moments | Cross-carrera surfaces visible (Tendencias, buscar) | ≥ 15 active materias platform-wide | Per-facultad mods (4–6 total); founder = mod-of-mods | DB 70% trigger likely → Supabase Pro; R2 growth costs cents (D13) | **Mod burnout** |
| 1k→10k | Generational turnover + multi-sede question | New ingresantes each March inherit a full shelf | Every grado carrera seeded; archive visible (P3) | Mod team + written precedents + recruitment pipeline | **Free-tier ceilings certain** → paid infra (D13); PART 22 work mandatory | **Culture dilution + free-tier ceilings** |

## 30.2 Rung 0→10 (beta, nov–dic 2026)

Fully specified in PART 29; summarized here for the ladder's continuity.

- Channel: the founder's personal invites with resource deep links.
- Retention mechanism: the < 3 h answer SLA converts the first questions into proof that the room is alive.
- The failure mode, **silence**, is answered by design: single-player utility means ten quiet users still got value from the shelf; there is no moment where an empty feed is the whole product.
- Climb when: the D11 gate passes (§28.9 rows 2–3).

## 30.3 Rung 10→100 (feb–abr 2027)

- **Channel:** nodos sharing specific posts/resources into their cohort WhatsApp groups. The share must be *a thing that helps today* — "subieron el parcial viejo de Obligaciones" — never "sumate a la plataforma". This is why WhatsApp OG preview quality (30.7.1) is a build priority with a CI test, not polish.
- **Retention mechanism:** the **Mis materias** feed must reward a daily 2-minute check during cursada (spine 0.1). If analytics show utility-only visits (search → download → leave), the problem is conversation density: fix by concentrating invites in fewer comisiones, never by widening the funnel.
- **Content density:** ≥ 3 posts/week per active materia; founder authoring < 50% of content and falling month over month.
- **Moderation capacity:** founder alone suffices (≤ 30 min/day at the PART 11 report-rate model); first mod recruitment conversations start now anyway, because recruitment lead time is ~2 months.
- **Infra checkpoint:** DB < 30% of the 500 MB cap and R2 < 30% of the free 10 GB; no action expected.
- **Failure mode — founder-dependence**, measured explicitly: founder share of posts and share of first-answers, both tracked weekly. The exit is deliberate: the founder waits longer before answering, asks nodos to answer instead, and lets upvotes reward the answerers. A platform where the founder is the product dies at the founder's first busy month.
- Climb when: 100 registered, ≥ 35% W4 retention, founder < 30% of content.

## 30.4 Rung 100→500 (2027, across cuatrimestres)

- **Channel:** **SEO long-tail** starts paying — materia and resource pages ranking for "resumen derecho constitucional uca", "parcial contabilidad uca rosario", "cómo toman el final de romano uca". PART 23 owns the technical work; growth's job is that every materia page has enough real content to deserve the ranking. Plus carrera-by-carrera expansion under the §29.8 protocol.
- **Retention mechanism:** the anonymous Google visitor must convert — the materia page shows follow + recent conversation above the fold, so the utility visitor sees the living room, not just the file cabinet. Conversion path: land on resource → see materia page → "Seguí esta materia" after registration.
- **Content density:** ≥ 5 active materias per open carrera; ≥ 40 resources per carrera at entry (the §29.8 rule); resource uploads per turno de finales growing.
- **Moderation capacity:** founder + 2 mods; report SLA < 24 h held for 8 consecutive weeks before climbing. Mod actions carry public reasons — the published precedents become the community's case law, cheaper and more legitimate than rule proliferation.
- **Infra checkpoint:** the DB-size watch begins in earnest; the amended D13 triggers (DB 70% of 500 MB → Supabase Pro; R2 70% of 10 GB → R2 paid, cents) are armed with monthly review. Downloads scaling with SEO traffic cost nothing in egress — R2 charges none (§0.5-R17); the true bottleneck at this rung is moderation labor (C13). **[FREE-TIER RISK]**
- **Failure mode — toxicity emergence:** this is the rung where strangers meet — cross-carrera friction, first harassment attempts, first professor-adjacent gossip pressing on the C9 perimeter. The PART 11 line ("experiences yes, attacks on persons no") must be enforced visibly and early; the first high-profile removal with a clear public reason sets more culture than any Reglas page.
- Climb when: 500 registered, SLA held, at least 3 carreras past their own gate.

## 30.5 Rung 500→1k (2027–2028)

- **Channel:** inter-facultad word of mouth — Económicas students discover it because Derecho friends use it — amplified by QR/poster moments at each facultad timed to parciales and inscripciones.
- **Retention mechanism:** cross-carrera surfaces must exist by now — Tendencias (P2) and search make the platform legible beyond one's own cohort; the daily check gains a second layer ("¿qué pasa en la facu?" on top of "¿qué pasa en mi carrera?").
- **Content density:** ≥ 15 active materias platform-wide with the 3-posts/week floor; every facultad has at least one visibly alive carrera.
- **Moderation capacity — the true bottleneck (C13):** per-facultad mods (students trusted from each community, 4–6 total); the founder stops front-line moderation and becomes mod-of-mods (appeals, precedents, recruitment). This transition is a deliverable with a date, not a hope.
- **Infra checkpoint:** the DB likely crosses the 70% trigger → Supabase Pro USD 25/mo per D13, budgeted in PART 31 Stage 1; R2 storage approaching 10 GB is a cents-level line item, not a cliff (§0.5-R17). **[FREE-TIER RISK]**
- **Failure mode — mod burnout:** watched via mod-action latency, queue depth, and a monthly 1:1 between founder and each mod. A burned-out volunteer mod quits silently and the queue rots; the mitigation is team size ahead of need and visible founder gratitude (mods are the institution's first officers).
- Climb when: mod team stable for a cuatrimestre; infra spend executed calmly, not in crisis.

## 30.6 Rung 1k→10k (2028+)

- **Channel:** **generational turnover as a growth machine** — every March a new ingresante cohort arrives needing exactly what the platform accumulated. Ingresante-week seeding becomes an annual ritual: guías for año 1 materias, "qué me hubiera gustado saber en primer año" threads, QR at the ingresante induction weeks (~15–17 mar). The platform's compounding advantage — the shelf every WhatsApp group loses annually — is now structural.
- **The multi-sede question:** other UCA sedes (Paraná, Mendoza, Buenos Aires) share the catalog structure, and D4's schema supports them. But each sede needs its own §29.8-style champion structure and seed sprint; opening a sede as a checkbox produces an empty shelf with a flag on it. **[HUMAN DECISION]** whether/when — the default answer is "not until Rosario is culturally self-sustaining", consistent with brief §57 ("density, not breadth").
- **Retention mechanism:** the archive (P3) and the annual rituals give old users a reason to stay past their own graduation (alumni as lurkers and occasional answerers — the first audience expansion, brief §4, and it costs nothing).
- **Content density:** every grado carrera seeded and past its gate; archive pages visible so newcomers inherit context, not just files.
- **Moderation capacity:** a mod team with written precedents, an appeal flow, and a recruitment pipeline (each mod names a successor candidate); founder handles only appeals and policy.
- **Infra checkpoint:** free-tier ceilings are certain at this scale — the D13 spend is fully executed (Supabase Pro + likely Vercel Pro), and PART 22's performance work becomes mandatory, not aspirational. **[FREE-TIER RISK]**
- **Failure mode — culture dilution, twinned with the ceilings:** the norms 100 users absorbed socially must now be carried by artifacts: the Reglas page, mod precedents, the tone of official copy, old-timer behavior, and the archive itself — which teaches newcomers what the place is by showing what it has been. Watch for: rising report rates per 100 posts, meme-flooding of materia pages, "content about the platform" displacing "content about the university". The response is editorial, not technical: mods curate, precedents publish, and the memoria del año celebrates the behavior we want more of.

## 30.7 Organic mechanics we invest in (build/effort priorities, in order)

1. **Share-to-WhatsApp preview quality.** Every post/resource/materia URL renders a dense, accurate OG card (title, materia, tipo, counts). This is the #1 growth surface for rungs 1–3; it gets design attention (PART 17) and a CI test that fails on broken previews. A broken preview is a growth outage.
2. **QR posters per facultad at parciales/inscripciones time.** Recurring, cheap (pocket-money print runs), always deep-linked to the relevant carrera/materia page, always utility-first copy. Calendar-driven cadence: late feb, parciales windows (~may, ~oct), late jul.
3. **"Resumen salvador" moments.** The product moment where a resource saves someone's exam, amplified structurally: visible download counts, gratitude one upvote away, and post-finales threads each turno (feb, jul, dic) — "¿Con qué rendiste? Dejá el material que te salvó." — turning gratitude into next cohort's shelf.
4. **The December "memoria del año" share moment.** An annual, public, aggregate page (P3 machinery; hand-made v1 acceptable dec 2027): most-useful resources, most-followed materias, questions asked and answered, founding milestones — anonymized aggregates only (C6). Designed to be shared in the last week of cursada; it is the platform arguing its own case once a year, and the seed of the traditions brief §12 hopes for.

## 30.8 What we do NOT do (binding)

- **No paid ads, ever, at any rung** (brief §36). Spend is capped by PART 31, and paid acquisition into a community this small buys tourists, not neighbors.
- **No engagement notifications.** Notifications exist for things done *to you* (replies, mod decisions) — never "¡Volvé! Hay actividad en tu carrera" (spine 0.1.3). The email digest (P2) is opt-in, per-materia, and pauses itself in the summer.
- **No invite-spam incentives.** No rewards for invite counts, no referral leaderboards, no unlock mechanics. Invites are capacity-gated, not gamified.
- **No growth hacks.** No scraped contact imports, no fake activity indicators, no manufactured scarcity, no dark-pattern onboarding — we will never in earnest write "¿Seguro que querés perderte lo que pasa en tu carrera?".
- **No school-spirit astroturf.** The platform does not manufacture memes, awards, or traditions (brief §12); it hosts and preserves the ones that emerge.

## 30.9 Instrumentation of the ladder (what is measured per rung, from the PART 24 events table, SQL over content tables, and Google Search Console)

Each rung's climb criteria must be readable from a SQL query (or, for SEO, from Search Console), or they will be judged by mood. The standing weekly dashboard (a script, not a product feature) uses only data that exists — the closed PART 24 event catalog, the content tables, and free external telemetry; no new events are added for it:

| Metric | Source | Rungs where it gates |
|---|---|---|
| W2/W4 return rate per cohort | events: `retorno_semanal` weekly cohort snapshots (PART 24 §24.4) | all |
| Organic posts/week (excl. founder + "equipo" + accomplices) | SQL over posts joined to the maintained non-organic account list | 0→10, 10→100 |
| Founder share of posts and of first-answers | SQL over posts/comments against the known founder account list | 10→100 |
| Posts/week per active materia | SQL: posts grouped by materia | 10→100 onward |
| SEO landings on materia/resource pages | Google Search Console (free, external — part of the PART 23 SEO toolchain) | 100→500 |
| Report rate per 100 posts + median report-to-action latency | SQL: reports + mod_actions | 100→500 onward |
| Mod queue depth and per-mod action counts | SQL: mod_actions | 500→1k onward |
| DB % of the 500 MB cap + R2 storage GB of the free 10 | Supabase telemetry + R2 metrics (PART 21) | all — D13 triggers |
| Uploads per turno de finales | SQL: resources by created_at window | seasonal, all rungs |

Two disciplines: (1) seasonality is read against the academic calendar — compare February to last February, never to March (spine 0.1.2); (2) no metric on this dashboard may ever become a user-facing gamification surface (C10, §30.8) — instrumentation is for steering, not for display.

---

# PART 31 — MONETIZATION

**Decision:** Monetization is staged behind an axiom — **trust is the asset; revenue is a maintenance function of it** — with Stage 0 (nothing, costs absorbed) through 2027, Stage 1 (voluntary support + published cost transparency) as the first and possibly permanent model, Stage 2 (marketplace fee 10–15%) only if PART 15's Etapa C gates pass, Stage 3 (labeled local sponsorships, never touching ranking) only under strict placement rules, and Stage 4 (premium conveniences) only at a scale this plan does not assume. A written NEVER list (§31.7) is a binding commitment of the product, published to the community.

Rationale: brief §55 orders "do not destroy trust for short-term revenue"; the 10-year thesis makes trust literally the balance sheet. This is a sustainability project, not a startup (§31.6): the financial goal is that infrastructure and legal costs are covered, and the founder's time is acknowledged as the real subsidy.

## 31.1 Stage 0 — now through 2027: none

No money changes hands in any direction: no ads, no fees, no donations, no sponsored anything. Costs absorbed by the founder. The math, from the PART 21 consumption model and D13 triggers:

| Item | Monthly USD | When it starts |
|---|---|---|
| Domain (amortized ~USD 25–50/yr) | ~2–4 | Always — the only certain cost |
| Supabase Free → Pro | 0 → 25 | DB > 70% of 500 MB or auth MAU pressure two months running (D13) |
| Cloudflare R2 free → paid | 0 → cents (~USD 0.015/GB-mo) | R2 > 70% of the free 10 GB (D13) — a line item, not a cliff |
| Vercel Hobby → Pro | 0 → 20 | Any monetization (C8) or Hobby limits — NOT expected in Stage 0 |
| Resend, Sentry, GitHub (free tiers) | 0 | While PART 21 caps hold |
| Counsel fees (legal-page review + naming opinion; one-off, sep 2026 – ene 2027) | estimate pending **[HUMAN DECISION]** | Counsel engaged September 2026 (§28.3); pre-drafted pages keep the bill at review rates |
| **Stage 0 realistic worst case** | **~USD 27–29/mo** | Domain + Supabase Pro fired |
| **Absolute worst case pre-revenue** | **~USD 25–45/mo** | If Vercel Pro is ever forced early |

- Note the C8 coupling: Vercel Pro is *caused by* monetizing, so it belongs to Stage 1+ math; Stage 0's own worst case is the ~USD 27–29 line.
- **[FREE-TIER RISK]** The founder pre-commits this spend capacity now, in writing, so a quota trigger in month 2 after launch is an execution, not a crisis (D13). A 10-year institution that dies at USD 25/mo was never an institution.
- **[HUMAN DECISION]** Confirm the personal monthly budget ceiling (recommended commitment: USD 50/mo through 2027).

## 31.2 Stage 1 — 2027–28: voluntary support (the institution move)

**What:** a `/apoyar` page with Cafecito (or equivalent — es-AR native, peso-denominated, no card required) plus a **published transparent-costs post updated quarterly**: what the infra costs, what was donated, what the founder covered, all in plain numbers.

**Trigger to start:** any paid infra tier active, OR launch + 6 months — whichever comes first.

**Why this is first (brief §59 Q23 answered):** **the first monetization opportunity is voluntary community support against published costs** — not the marketplace, which intuition puts first but which is gated years behind (C11). Revenue expectation is trivial (ARS coffee money); the purpose is **legitimacy, not income**. Voluntary support with open books converts the platform from "some guy's site" into a commons with visible upkeep — the institutional posture everything else in this plan claims. It also creates the community's first financial stake in the platform's survival, which matters when the D13 spend recurs monthly.

**Costs and prerequisites of this stage:**
- Vercel Pro USD 20/mo (C8 — accepting money is commercial use). Expected to exceed donations initially; accepted — the legitimacy is the product.
- Tax posture check: donations as founder personal income vs. monotributo; whether an SAS should hold the platform from here (research notes §5). **[LEGAL REVIEW]**
- Copy discipline: the ask is quiet and factual. *"Esto cuesta USD 45 por mes. Si te sirvió, invitanos un cafecito. Si no, seguí usándolo gratis — en serio."* No nags, no banners on content pages, no guilt mechanics.

## 31.3 Stage 2 — marketplace fee (2029+, only if PART 15's Etapa C gates pass)

**What:** platform fee of **10–15%** on paid resources, on top of Mercado Pago's processing fees (~4–6% + IVA per the research notes §7 — unverified beyond that snapshot; re-quote at build time). Free resources remain the default and the majority forever (C11: every paywall shrinks the utility magnet). Sellers are never anonymous (D3).

**Non-negotiable architecture (from research notes §7):** **Mercado Pago Split de Pagos; the platform never takes custody of sellers' money.** MP is the payment service provider of record and absorbs the bulk of withholding mechanics; local orders tables are references, never balances (PART 28.12).

**Cost side entering this stage:** Vercel Pro (already active if Stage 1 ran) · legal entity setup (SAS) + counsel for marketplace ToS, consumer-law surfaces (botón de arrepentimiento, Data Fiscal), monotributo/IVA posture on commission revenue **[LEGAL REVIEW]** · MP marketplace onboarding effort.

**Break-even sanity check:** at a 12% fee on a resumen priced around the peso equivalent of USD 3, covering USD 45/mo of infra alone needs ~125 paid downloads/month — plausible only at rung 1k+ (PART 30). This is why Stage 2 is a gate, not a plan: the marketplace exists to serve creators who want it, and incidentally to cover costs; it is not the business model.

## 31.4 Stage 3 — sponsored placements (only student-relevant local services)

**Considered:** programmatic display ads (AdSense-style); sponsored posts inside the feed; paid ranking of resources; fixed labeled slots sold directly to local services.

**Chosen:** only the last — fixed slots, always labeled **"Patrocinado"**, in sidebar or materia-page footer positions, sold directly to student-relevant local services: fotocopiadoras, cursos de apoyo, librerías, comida cerca del campus. Never in the feed stream. **Never affecting any ranking. Never targeted by content or by user data** — placement may be contextual at most by facultad page, nothing finer.

**Why:** a fotocopiadora ad on a materia page is community-coherent — students already exchange exactly this information — and honest about what it is. Programmatic ads import surveillance, junk creative, and a second master; ranking-for-money poisons the only thing the platform sells (trustworthy relevance).

**Cost:** revenue is small and manual — direct sales by the founder, peso pricing, a simple insertion-order template + Data Fiscal/consumer legends once selling **[LEGAL REVIEW]**. Accepted: this stage may never be worth its administration time; it exists as an option, not a promise.

**[HUMAN DECISION]** — the acceptability line: the founder personally approves each sponsor category. Recommended standing rejections: apuestas/juego, préstamos y crypto, venta de trabajos académicos ("ghostwriting" — an integrity contradiction the platform cannot host), anything requiring user data, anything politically or religiously partisan.

## 31.5 Stage 4 — premium conveniences (large scale only; not assumed)

Only at a scale (10k+ MAU, multi-sede) this plan does not project as its base case: paid *conveniences* that change comfort, never access — e.g., saved-search alerts, bulk export of one's own uploads, cosmetic profile options. Hard test, applied to every candidate: **"does a free user lose anything they have today?" If yes, it does not ship.** Restated from §31.7: search, resources, archive, and materia pages stay free for everyone, always — knowledge is never paywalled, and "old content becomes premium" is specifically prohibited.

## 31.6 Revenue reality check

- This is a **sustainability project, not a startup**. There is no growth-capital story, no exit, and no revenue line that justifies violating §31.7. There is an archive.
- Financial success is defined as: **Stage 1–2 revenue ≥ recurring infra + legal costs (~USD 45–80/mo at rung 500–1k, per the PART 21 model plus a counsel retainer allowance)**.
- The founder's time is the acknowledged, unpaid subsidy — the same economics as a club or a student magazine, which is what a durable institution of this size actually is. Write it down so nobody is surprised in year 3.
- If costs cannot be covered within these stages, the correct moves are cost reduction (PART 21) or a graceful, announced shutdown with the data-export promise honored (brief §33) — never a trust-liquidating pivot to Stage-3-everywhere or data sales.

## 31.7 The NEVER list (binding commitments — brief §59 Q24 answered)

Published in `/acerca` in es-AR as commitments to the community. Changing any of these requires facing, in public, the community that was promised them — which is the point of writing them down.

1. **Never sell or share user data.** Not "anonymized audiences", not "partners", not analytics resale. PART 24's minimal collection makes much of this impossible by construction — you cannot sell what you never collected.
2. **Never paywall knowledge.** Search, resources (including old and archived ones), materia pages, and the archive remain free to read and download for everyone, logged-in or not, forever. Old resources never move behind a fee retroactively.
3. **Never let money touch ranking.** No sponsored feed items, no paid placement in search or Tendencias, no "boosted" resources. Sponsorships, if they exist (Stage 3), live in fixed labeled slots only.
4. **Never target by content or identity.** No behavioral profiles, no content-based ad targeting, no demographic segmentation. Contextual-by-page (facultad level) is the maximum granularity, ever.
5. **Never charge for privacy or safety.** Anonymity, reporting, moderation, deletion, and data export are never premium features.
6. **Never gamify for revenue.** No paid karma, badges, streaks, or visibility purchases.

**es-AR copy for `/acerca` (the public version):** *"Nunca vendemos tus datos. Nunca cobramos por el conocimiento: buscar, leer y descargar es gratis para siempre. La plata nunca decide qué ves primero. Si algún día algo de esto cambia, te lo vamos a decir de frente — pero no va a cambiar."*

## 31.8 Stage transitions at a glance (enumerable summary)

| Stage | Earliest date | Entry trigger | New recurring cost | Expected revenue | Trust exposure |
|---|---|---|---|---|---|
| 0 — none | now | — | USD ~2–29/mo (D13-dependent) | 0 | none |
| 1 — voluntary support | mid-2027 | paid infra active OR launch + 6 months | +Vercel Pro USD 20/mo | trivial (ARS) | low — raised only by breaking the quiet-ask rule |
| 2 — marketplace fee 10–15% | 2029+ | PART 15 Etapa C gates ALL pass | entity + counsel + MP onboarding | covers infra at ~125 paid downloads/mo | medium — contained by free-majority + never-custody rules |
| 3 — local sponsorships | after Stage 1 stable | direct sponsor demand + founder approval per category | negligible | small, manual | high if placement rules slip — hence fixed slots only |
| 4 — premium conveniences | 10k+ MAU only | scale this plan does not assume | feature-dependent | unknown | bounded by the "free user loses nothing" test |

No stage is ever entered to fix a cash shortfall; entry triggers are demand- and gate-driven, and the shortfall path is §31.6 (cost reduction or graceful shutdown), never stage-skipping.

## 31.9 Consistency ledger (what other parts must hold)

- **PART 15** owns the Etapa C gates that Stage 2 depends on; the fee band 10–15% and "MP Split, never custody" are fixed here and referenced there.
- **PART 21**'s consumption model is the source for the Stage 0/1 cost numbers; if PART 21 revises free-tier caps, §31.1's table follows it, never the reverse.
- **PART 24**'s analytics minimalism is load-bearing for NEVER #1 and #4 — adding tracking later would break published commitments, not just policy.
- **PART 11**'s load model backs the mod-capacity column of §30.1; if that model changes, the ladder's climb criteria change with it.
- **PART 34** aggregates this file's open markers — human decisions: founder hours/week (§28.1), 2027 calendar confirmation (§28.2), launch carrera (§29.1), seeding ethics position (§29.3), per-carrera expansion order and poster posture (§29.8), multi-sede timing (§30.6), budget ceiling (§31.1), sponsor acceptability line (§31.4); legal items: legal pages + 16+ + ARCO (§28.6), naming/trademark (§28.8), old-exams copyright posture (§29.2), donations tax posture (§31.2), marketplace entity/withholding and consumer surfaces (§31.3), sponsorship contracts (§31.4).
