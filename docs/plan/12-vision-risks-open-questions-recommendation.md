# PART 32 — TEN-YEAR VISION

> Owns: how the platform becomes a durable institution (brief §2, §12, §58, §66). This part adds no features; it states the mechanics by which the already-designed system compounds, the doctrine for surviving technology churn, the stewardship plan nobody asked for, and the concrete test against the 2036 scenario.

## 32.1 The compounding mechanics

**Decision: the institution is built by four compounding loops that already exist in the MVP design — cohort deposits, materia-page accretion, the December memoria ritual, and organically preserved culture. Nothing additional is built "for the 10-year vision"; the vision is the sum of normal operation, protected from interference.** This is spine 0.1 made operational: the archive is what the platform's operation leaves behind, so the ten-year plan is mostly a list of things we refuse to break.

### 32.1.1 Each cohort leaves a deposit

Every cohort that passes through a materia leaves two strata: its resources (resúmenes, parciales viejos, guías — the SIEMPRE layer) and its threads (the questions, warnings and experiences of that cursada — AHORA content that graduates into SIEMPRE by nothing more than time and search, per §1.3's no-pipeline rule). The economics are the institution's engine: content is created at the moment of highest motivation (right after finales, per the outer loop §1.7.2 and the "resumen salvador" mechanic of PART 30), costs nothing to retain (text is nearly free; files are capped and metered per PART 21), and is consumed by people who did not exist as users when it was written. By year 3 the shelf of any established materia is strictly larger than any single cohort could produce — the point where the platform is no longer competing with WhatsApp groups but with nothing, because no other structure retains cross-cohort knowledge at all (brief §59 Q4).

The number that proves the loop: the **generational test** (§1.2.1 test 5) — content ≥2 years old still receiving downloads every exam window, measurable from the aggregated download counters (`events` + `downloads_count`, per spine §0.5-R9 — no durable per-user download history exists) by content age from 2029 onward. PART 24 owns the instrument; this part fixes the reading: if old content stops being consumed, the institution has degraded into a feed, and the response is curation and search quality, never engagement mechanics.

What compounds, what depreciates, and what must be actively renewed — the maintenance map for every future year:

| Asset class | Behavior over time | Renewal cost |
|---|---|---|
| Resources + answered threads | Compounds (each cohort deposits; zero marginal retention cost) | None — protected by URL contract + soft delete |
| Materia pages + SEO standing | Compounds (age is rank) | Catalog update ritual, 2×/year (28.15) |
| Community norms | Compounds only while enforced | Visible moderation + quarterly informe (11.9) |
| Cohort conversation | Depreciates every year (graduation) | Renewed free each March by ingresantes (30.6) |
| Code/framework | Depreciates (rot) | Rewrite every 4–6 years (32.2) |
| Catalog accuracy | Depreciates (plans change) | Per-cuatrimestre curated update (28.15) |
| Founder capacity | Depreciates (life happens) | Succession stages (32.3) — the only renewal that cannot be automated |

### 32.1.2 Materia pages as accumulating institutions

The materia page is the only surface designed to be *older than its users*. Derecho Constitucional will be cursada annually for decades; its page (one durable URL, D7) accretes every cohort's deposit while cohort feeds turn over completely every ~5 years. Three protections keep this true:

- **The URL contract is inviolable** (D7): materia slugs never change meaning, post/resource public IDs never expire, and a 2027 link shared in a 2027 WhatsApp group resolves in 2036. Redirects are allowed; dead links are not.
- **The catalog is maintained, not frozen.** Plans change (Plan 2013 → some Plan 20XX); `plan_materias` carries plan versions (D4), and the per-cuatrimestre curated catalog update (PART 28.15) is the maintenance ritual. A renamed materia keeps its page and its history; a discontinued materia keeps its page as archive (nothing is deleted for being old — §16.5's no-expiry rule).
- **Empty is temporary, seeded is forever.** The seed discipline (D11: never launch into an empty shelf) is not a launch tactic but a permanent norm — every expansion (carrera, sede) starts with a deposit, so no materia page ever teaches a visitor that the institution is hollow.

### 32.1.3 The December memoria ritual

The memoria del año (§16.6, §30.7.4) is the institution's one manufactured tradition, and it is manufactured only in its *container*: every December the platform publishes `/archivo/[year]` — frozen aggregate stats, computed rewind, hand-curated hitos — announced with a single pinned post. The content is entirely the community's own year; the platform contributes a mirror and a date. Ten editions of this and the platform possesses what brief §2 actually asks for: a tradition older than any current user, a citable record ("la memoria de 2028") and an annual moment where the community sees itself as a continuing thing. First edition December 2026, covering the beta, small numbers stated proudly ("Fuimos 87. Empezamos."). The ritual's cost is one cron branch, one template, and 3–10 curated hitos per year — deliberately cheap enough that no busy year skips it, because a skipped year breaks the very continuity the ritual exists to prove.

### 32.1.4 Generational culture: emergent, preserved, never manufactured (brief §12)

Per §1.8 and P11, the platform supplies substrate — es-AR-flavored pseudonyms, citable permanence, the curated hito mechanism — and refuses to perform the community's personality. The brief's §12 list of hoped-for phenomena, mapped to the mechanism that lets each emerge and be preserved without being manufactured:

| §12 phenomenon | Emergence substrate | Preservation mechanism |
|---|---|---|
| Community memes, recurring jokes | User content; sober product chrome leaves the color to users | Public-by-default + durable URLs (a meme needs a citable origin) |
| Legendary posts | Nothing — legends are not schedulable | Permanent `/p/[publicId]`; hito pointer in the year's memoria |
| Famous anonymous users | **Deliberately impossible**: per-thread aliases prevent cross-thread anonymous identity (D3). Fame is routed to pseudonyms — the accountable channel | Pseudonym permanence + quiet karma |
| Historical discussions, traditions | Calendar-generated rites (pre-finales panic, post-finales uploads, ingresante March) | Search + archive rewind; the memoria names them yearly |
| Yearly events | The one manufactured container: the December memoria (32.1.3) | `archive_stats` frozen per year |
| Community awards | **Refused** (C10/P6) — awards manufacture the gamification §11 warns against | n/a — the memoria celebrates content, never ranks people |
| Generation-specific culture | Cohort structure itself (carrera × año, P2) | Ingreso-year on profiles; year-scoped archive pages |

The "famous anonymous users" row is the one place this part *overrules* a brief hope on purpose: an anonymous identity famous across threads would require exactly the cross-thread linkability D3 prohibits. The culture the design permits is famous *pseudonyms* — which is culture with an accountability anchor, and therefore culture the institution can survive.

The binding rule for every future maintainer: **the interface never adopts the community's memes into its own chrome** (P3 beats P11), and the memoria curates what happened rather than what we wish had happened. If a 2033 admin is tempted to "activate the community" with an official meme contest, this paragraph is the standing veto.

## 32.2 The technology-refresh doctrine (brief §58)

**Decision: frontend rewrites are EXPECTED, roughly every 4–6 years — two to three times before 2036 — and the architecture treats them as routine maintenance, not crises. Four things must survive every rewrite unchanged: the Postgres data (schema, migrations, RLS as plain SQL), the public IDs and URL map (D7), the es-AR voice, and the visual character tokens (D8). Everything else — framework, hosting, rendering strategy, even the styling toolchain — is declared replaceable in advance.**

Rationale: ten years is 3–5 framework generations (P8). Next.js App Router, Tailwind v4 and `@supabase/ssr` will all be legacy within the plan's horizon; pretending otherwise would couple the product's identity to its 2026 stack, exactly what brief §58 prohibits. The plan therefore fixes the *dependency direction* — database first, app conforms (§19.7) — so the durable asset never depends on the disposable one.

### 32.2.1 What survives any rewrite (the invariant core)

| Invariant | Where it lives | Why it survives a rewrite mechanically |
|---|---|---|
| Data + security model | `supabase/migrations/*.sql` — plain SQL: tables, RLS, SECURITY DEFINER functions, views | No ORM runtime needed to interpret it (§19.7); restores into any Postgres |
| Public IDs + URL map | nanoid/slug columns; D7 route contract | URLs encode no framework (no `/api/v1`, no locale prefixes); any router can serve them |
| es-AR voice | UI copy conventions (D8/D9); copy inventory in the repo | Copy is content, not code; a rewrite ports strings, not tone — the tone is documented |
| Visual character | Design tokens as CSS custom properties (PART 18; §19.4's escape hatch) | Tokens outlive Tailwind: paper white, azul birome, hairlines, ≤4px radius port to any styling system |
| Anonymity semantics | `_public` views + `anon_aliases` in SQL | The privacy promise is enforced in the database, so no app rewrite can accidentally weaken it |
| The legal/social contract | Reglas, ToS, the NEVER list (§31.7), independence disclaimer | Published commitments bind successors; changing them requires facing the community |

A rewrite may change: framework, language, hosting, rendering model, styling toolchain, component structure, even the auth *server* (GoTrue is replaceable against the preserved `auth` schema, §21.7). A rewrite may not change: any row above, without the same governance as a spine amendment.

### 32.2.2 The expected rewrite timeline

Projected honestly, so no future maintainer treats the first rewrite as a betrayal of the original design:

- **R0 (2026): the build.** Next.js App Router + Tailwind v4 + Supabase, per D6. Expected serviceable life 4–6 years with routine dependency maintenance.
- **R1 (~2030–31): the first refresh.** Most likely shape: framework major-migration or replacement (whatever succeeded the RSC generation), Tailwind major or exit to plain CSS on the surviving tokens, possibly a hosting move if Vercel's Hobby/Pro economics shifted. Database, URLs, copy, and the pgTAP suite carry over unchanged. This is also the natural moment to revisit the auth server (GoTrue self-host vs. whatever Supabase Auth became) against the preserved `auth` schema.
- **R2 (~2034–35): the second refresh.** By now the app is probably maintained by Stage-2/3 stewards, not the founder (32.3); the rewrite doubles as the handover proof — a team that can execute R2 from the migrations + tokens + copy inventory alone has demonstrated the institution no longer depends on its founder's memory.
- **Continuous, never "rewritten": the data.** No migration in any refresh may rewrite history semantics (public IDs, timestamps, authorship, anonymity flags). Schema evolves additively (20.8's expand/contract discipline applies forever).

### 32.2.3 Rewrite triggers and protocol

Expected triggers, in likelihood order: framework major-version EOL with security implications; hosting-model shift (Vercel pricing/policy change, per PART 33 register); accumulated dependency rot making AI-assisted maintenance slower than a rewrite; a genuinely better rendering economics (the 2031 equivalent of RSC). Protocol, fixed now: (1) the rewrite is done *beside* the live app against the same database — the SQL contract means both can serve simultaneously; (2) the D7 URL map is the acceptance test — every route class must resolve identically before cutover; (3) the pgTAP suite runs unchanged — it tests the database, which did not move; (4) visual regression is judged against the tokens, not screenshots — the 2031 app must *read* as the same place (brief §46), not pixel-match it; (5) the rewrite ships in the summer crater (January–February), the annual low-traffic window (C14). Budget expectation: a competent rewrite of this app is 4–8 weeks of solo work precisely because the hard parts (schema, policies, copy, URLs) are inherited, not rebuilt.

### 32.2.4 The annual restore drill is the portability proof

The February restore drill (§21.7.5) — restore the latest dump into a scratch project, boot the app, log in, open a post, download a file, record the result in `docs/decisions.md` — is this part's single most important operational commitment. It converts brief §33's "could we move?" from a belief into a measured annual number (minutes-to-working). Ten drill entries are the institution's proof that no provider holds it hostage; a skipped drill is a red flag with the same severity as a failed backup. The drill doubles as the rewrite rehearsal: an app that boots cleanly against a restored dump is an app whose rewrite can be validated the same way.

## 32.3 Stewardship: who owns this in year 10 **[HUMAN DECISION]**

**Decision: the platform's custody follows a three-stage path — founder's personal project (now) → informal team with real continuity artifacts (from first revenue or founder's graduation, whichever first) → asociación civil sin fines de lucro as the natural end-state for a student institution (by year 5, or earlier if money or scale forces it). Each transition has a named trigger; the founder ratifies the path and executes the stage-1 artifacts during S0.**

Rationale: today every asset lives in one person's accounts. That is correct for 2026 and fatal for 2036: a platform whose continuity depends on one person's inbox is not an institution, it is a hobby with users. The brief never asks this question; the 10-year framing (§2, §66) makes it unavoidable, because the median founder outcome over ten years is *graduating, moving, or losing interest* — none of which should kill the archive.

The asset inventory and its custody path (the concrete object of each stage transition):

| Asset | Today (Stage 1) | Stage 2 (informal team) | Stage 3 (asociación civil) |
|---|---|---|---|
| Domain + DNS (Cloudflare) | Founder registrar account, auto-pay, second authorized contact | Same + shared vault access | Held by the asociación |
| Vercel + Supabase projects | Founder accounts | Second admin added | Org accounts under the entity |
| GitHub repo (code + migrations = the institution's text) | Founder private repo | Second admin/owner | Entity org; repo remains private, migrations are the crown jewels |
| Backup encryption key (`age`) | Founder offline + password manager | Shared vault (2 holders) | Entity custody, 2 named officers |
| Resend / Sentry / R2 | Founder accounts | Shared vault | Entity accounts |
| Official platform account + admin role | Founder | Founder + second admin | Comisión-appointed admins |
| The NEVER list + Reglas + independence posture | Published promises | Published promises | Encoded in statutes |

### 32.3.1 Stage 1 — personal project with continuity artifacts (now → first trigger)

Built during S0, cost ≈ one afternoon:

- **The asset inventory**: a single document listing every account, domain, key and credential that the platform depends on, kept current in the password manager.
- **A second authorized contact** on the domain registrar and a shared password-manager vault (founder + one trusted person) holding the registrar access and the `age` backup key (§21.7.3 already requires the registrar decision; this extends it). **[HUMAN DECISION]** — choosing the person is the founder's call and the hardest part.
- **The continuity letter**: a short signed note stating what the platform is, where the assets are, what the NEVER list promises, and what the trusted contact should do in the founder's absence — including the graceful-shutdown floor of §31.6 (announced wind-down with the data-export promise honored) as the worst acceptable outcome. Deletion-by-neglect (an unpaid domain, an unrestored paused project) is the one ending this plan refuses to permit.

### 32.3.2 Stage 2 — informal team (trigger: first peso of revenue, OR founder graduates, OR founder hours fall below the maintenance floor for a cuatrimestre)

The mod team (PART 11.8.3) already creates the candidate pool. Stage 2 adds: a second **admin** (full access, not just mod powers), shared operational custody of the weekly/monthly cadence (PART 28.15), and — because money makes informality dangerous — the entity question goes to counsel at this trigger at the latest (SAS vs. asociación civil; `legal-ar.md` §5c raised SAS for liability shielding, but the forms serve different futures — see 32.3.3). **[LEGAL REVIEW]** Cost accepted: shared custody slows some decisions; the alternative is bus factor 1 forever.

### 32.3.3 Stage 3 — asociación civil sin fines de lucro (trigger: year 5 (2031), OR sustained 1k+ MAU, OR any recurring revenue beyond voluntary support — earliest trigger wins)

The natural end-state: an Argentine asociación civil with personería jurídica whose statutes encode what today are only published promises — the NEVER list (§31.7), the independence posture (D8/D10), deletion-over-preservation (C6/P12) — and which holds the domain, the infrastructure accounts, and any contracts. Why this form and not a company: the platform's economics are a club's (§31.6 — costs covered, labor volunteered, no exit), its governance need is succession (comisión directiva renewed from the community, plausibly alumni like persona 3.6), and its credibility need is the legal form matching the social claim ("hecho por estudiantes, sin fines de lucro"). If the marketplace (P4+) ever generates real commerce, counsel decides whether the asociación can hold it or an SAS subsidiary structure is needed — a 2029+ question, flagged now so Stage 3 statutes leave room. **[LEGAL REVIEW]** **[HUMAN DECISION]** — constituting an asociación civil costs real money and administrative load (estatutos, escribano, IGJ/IGPJ provincial registration, annual filings); the founder ratifies the trigger points now so the year-5 decision is an execution, not a debate.

## 32.4 The 2036 scenario test (brief §66), walked through

**Decision: every clause of the brief's 2036 scenario maps to a specific architectural or governance piece already in this plan; where the mapping depends on discipline rather than architecture, that dependency is named. This table is the plan's acceptance test against its own stated goal.**

| §66 promise (2036 student) | What makes it true | Nature of the guarantee |
|---|---|---|
| "Find their subjects" | Materia catalog with plan versioning (D4); per-cuatrimestre catalog maintenance ritual (28.15); durable slugs (D7) | Architecture + a 2×/year ritual |
| "Ask questions" | Posts/comments in plain SQL; composer semantics stable since MVP (D2) | Architecture |
| "Discover resources" | Resource shelf at durable URLs; provider-agnostic `storage_path` (§14.4); yearly public-content export (§16.7) | Architecture |
| "Participate anonymously" | D3 mechanics enforced in-database (`_public` views, `anon_aliases`); pgTAP suite as permanent gate | Architecture — survives any app rewrite by construction |
| "See what is happening" | Cohort feed; density by segmentation (§1.5.1) renewed by each March's ingresantes (30.6) | Architecture + the density discipline (P2) |
| "Search historical discussions" | Public-by-default (C16) + FTS; search infrastructure replaceable behind one query module | Architecture |
| "Discover knowledge from previous generations" | The compounding loops (32.1); generational test instrumented (§1.2.1 test 5); SEO on SIEMPRE surfaces (PART 23) | Emergent — measurable, not buildable |
| "Contribute something future students may use" | The outer loop (§1.7.2); post-finales upload rituals (30.7.3) | Emergent + rituals |
| "Still recognizable" | Design tokens + voice as rewrite invariants (32.2.1); wordmark rules (D8) | Doctrine — depends on maintainers honoring 32.2 |
| "Still fast" | Performance as architecture, not optimization (PART 22); low-JS doctrine survives frameworks | Doctrine + CI budgets |
| "Still independent of any specific stack" | SQL-first dependency direction (§19.7); annual restore drill (32.2.4); exit runbook (§21.7) | Proven annually |
| "Still human" | No engagement theater (P6); sober voice; culture grown not manufactured (32.1.4) | Governance — the easiest to lose, hence written into statutes at Stage 3 |
| "Still alive" | Seasonal operating cadence (28.15); succession plan (32.3); memoria ritual as annual heartbeat (32.1.3) | Governance — the stewardship question is the whole answer |

The honest reading of the table: architecture guarantees the bottom of Maslow (data, URLs, anonymity, portability); *discipline and governance* guarantee the top (recognizable, human, alive). The plan can make the first half unbreakable; the second half it can only make cheap to sustain and expensive to betray — which is what the published NEVER list, the transparency reports, the memoria ritual, and eventually the asociación's statutes are for.

---

# PART 33 — RISKS

**Decision: twenty risks, ranked by probability × impact within the plan's 10-year horizon. Naming/trademark is ranked #1: it is the only risk that is simultaneously outside our control, plausible in year one, and able to act as a legal lever for every other dispute. For the top five, an explicit early-warning indicator and a pre-committed response are stated — the register's purpose is that no listed risk, when it fires, requires a decision that was not already made.**

Scales: probability over the 10-year horizon (Alta / Media / Baja), impact if it fires (Existential / Alto / Medio). "Owner" = the part that carries the mitigation.

## 33.1 The register

| # | Risk | P | I | Mitigation anchor | Owner |
|---|---|---|---|---|---|
| 1 | **Naming/trademark**: UCA carta documento over "uca" in name/domain (C2; `legal-ar.md` §8) | Alta | Alto | D10 name-portability (1-day rename); fallback names pre-built; launch-blocking resolution checkpoint 31 ene 2027 | Spine D10, PART 28.8 |
| 2 | **RLS/view bug leaks anonymous authorship** — existential trust loss | Baja–Media | Existential | pgTAP allow+deny on every policy (D14.2); `_public` views as the only read path (D5); anonymity leak tests in E2E; breach protocol 10.14 | PARTS 8–10, 25 |
| 3 | **Cold-start failure**: beta misses the D11 gate; density never ignites | Media | Alto | Utility-first loop works at zero concurrency (§1.7.2); kill checkpoints 2–3 pre-committed (28.9) | PARTS 28–29 |
| 4 | **Founder burnout / moderation-labor wall** (C13, C15-c) | Alta | Alto | Load model + recruitment trigger (11.8.2); invite gate re-closable; Aug-2027 fallback launch; hours/week honesty rule (28.1) | PARTS 11, 28, 30 |
| 5 | **Free-tier wall in an exam window** [FREE-TIER RISK] — the old #1 (Supabase 1 GB storage + 5 GB egress) is retired by R2 (spine §0.5-R17: zero egress, files never enter Supabase Storage); the residual break order per amended D13 is moderation labor, DB size, R2 10 GB | Media | Medio | D13 pre-committed triggers + telemetry; login-walled downloads; resource files on R2 from S2 (§0.5-R17); budget pre-commitment (31.1) | PART 21 |
| 6 | **Defamation claim via professor-adjacent content** (`legal-ar.md` §2–3) | Media | Alto | No professor pages in MVP (C9); Regla 4 line; notice-vs-court-order protocol (11.5.1); paper trail | PARTS 5(11), 34 |
| 7 | **University hostility beyond naming**: C&D over content, pressure campaign (§1.4.1) | Media | Alto | Independence posture; careful-conduct record (transparency reports, takedown logs); playbook 33.4 | PARTS 1, 11 |
| 8 | **Copyright enforcement** (CADRA/publisher/UCA over uploads; Ley 11.723 arts. 71–72) | Media | Medio–Alto | Regla 9 steering; 72 h takedown SLA + counter-notice + strikes (11.7.2); parciales kill switch (§14.9.5) | PARTS 5(11), 7(14) |
| 9 | **Data loss**: no backups on Free tier; deleted/paused project | Media | Existential | Weekly tested `pg_dump` + R2 mirror from S0 (20.9); annual restore drill; 90-day rotation | PARTS 9(20–21) |
| 10 | **Supabase free-project pausing** during summer crater | Alta (absent mitigation) | Medio | Daily keepalive cron (21.5); Pro removes it | PART 21 |
| 11 | **Toxicity spiral**: harassment norms set early, moderation loses the room | Media | Alto | Anti-persona defenses (3.7); rate limits in DB; visible early enforcement (30.4); circuit breaker (11.6.5) | PART 11 |
| 12 | **Cohort capture by one clique**: one comisión's in-group culture reads as the platform's, repelling everyone else | Media | Medio | Carrera-by-carrera expansion with own champions (29.8); mod own-facultad conflict rule (11.8.4); watch per-carrera report rates | PARTS 11, 30 |
| 13 | **Seasonality misread**: January/July troughs read as death → panic feature-shipping or shutdown | Media | Medio | Calendar-posture table binding on metrics (§1.5.2); seasonal adjustment mandatory (PART 24); this register entry is itself the mitigation | PARTS 1, 24 |
| 14 | **Ley 25.326 exposure**: AAIP complaint, ARCO mishandling, RNBD absence as aggravator | Media | Medio | ARCO channel at launch; data-minimization posture (9.11.3); RNBD decision with counsel (34-A3) | PARTS 4(9–10), 34 |
| 15 | **Sentry/analytics PII misconfig** quietly exporting user data | Media | Medio | PII scrubbing at SDK level (19.11); no-tracking architecture (PART 24); review-checklist grep | PART 10(24), 26 |
| 16 | **Harassment incident becomes a reputational event** (press/rrss: "la app anónima de la UCA") | Baja–Media | Alto | Fast visible moderation + transparency reports (11.9); no-DM design removes worst vector (C12); honest public postmortem posture | PART 11 |
| 17 | **WhatsApp inertia**: deep links don't convert; the complement thesis fails | Media | Alto | Beta validates conversion explicitly (3.0, 29.7); named fallback channels (QR, Instagram of centros) decision pre-flagged | PARTS 29–30, 34 |
| 18 | **Costs without revenue**: founder subsidy fatigue in year 2–3 | Media | Medio | Bounded ceiling (USD 45–65/mo); Stage 1 voluntary support + open books (31.2); graceful-shutdown floor (31.6) | PART 11(31) |
| 19 | **Vercel Hobby ToS breach** (accidental commercial use — a tips link, an AdSense experiment) | Baja | Medio | C8 gate: any monetization → Pro first; Etapa B explicitly gated (15.2-B) | PARTS 7(15), 11(31) |
| 20 | **Bus-factor loss**: founder unavailable; domain lapses; credentials stranded | Media | Existential (by neglect) | Stage-1 continuity artifacts (32.3.1); registrar auto-pay + second contact; succession triggers | PART 32 |

Ranking notes: #2 outranks higher-probability risks because its impact is uninsurable — a single confirmed leak of anonymous authorship ends the product's reason to exist regardless of remediation; everything else on the list is survivable. #9 and #20 are "Existential" as *terminal states* but rank below #3–#5 because their mitigations are cheap, mechanical, and already scheduled (a tested backup and a paid domain are not hard problems — they are only neglectable ones).

## 33.2 Top five: early warning and pre-committed response

**1. Naming/trademark (rank #1, justified).** It is #1 not because a carta documento is certain but because: (a) it can fire at any visibility level and the trigger is the university's mood, not our conduct — `legal-ar.md` §8 notes trademark is typically the *lever* for a content dispute; (b) it is launch-blocking by decision (D10) so it sits on the critical path now; (c) unresolved, it multiplies risks #6–#8 by giving any complainant a second front. **Early warning:** any contact from UCA legal or administration, however informal; INPI opposition activity; the domain purchase falling through. **Pre-committed response:** the D10 machinery — product name in one constant + one wordmark; fallback names shortlisted by checkpoint 4 (31 ene 2027); if a carta documento arrives at any point, execute the 33.4 playbook, and if counsel advises rename, rename within a week and announce factually: "Cambiamos el nombre. Todo lo demás — tu cuenta, tus publicaciones, los recursos — sigue igual." The institution is the community and its memory, not the string (P10).

**2. Anonymity leak.** **Early warning:** any pgTAP deny-test regression (CI red); a Sentry event containing author fields on an anonymous payload; a user report of seeing authorship where none should exist; monthly reveal-log review finding un-audited access. **Pre-committed response:** the 10.14 breach protocol — kill switch to read-only, scope the exposure window from audit rows, fix forward, and notify affected users within 72 h in the honest register ("preferimos que lo sepas por nosotros"), over-notification chosen as the error direction. The deeper pre-commitment is architectural: the promise lives in the database (views + pgTAP), so the class of app-layer bugs that could leak is structurally narrow.

**3. Cold-start/density failure.** **Early warning:** the beta funnel's *stage-resolved* red lines (29.7): invited→registered <30% (pitch/preview wrong), registered→activated <40% (shelf wrong), W2 return <20% (density/conversation wrong — the kill checkpoint). **Pre-committed response:** checkpoint rules 28.9 rows 2–3 verbatim — no new features in response to weak retention; ten user interviews; re-concentrate invites in fewer comisiones; and if the conversation thesis fails outright (<10 organic posts/week), the pre-approved pivot is **utility-only** (resource library + search + materia pages, no feed) — a smaller but honest product the same architecture already contains.

**4. Founder burnout / moderation wall.** **Early warning:** the 11.8.2 triggers (>25 open queue items/week for 3 weeks, or p95 >72 h for 2 term-weeks); founder-share of posts not falling (30.3); the founder failing the 28.15 annual hours re-answer; mod-action latency drifting. **Pre-committed response:** recruit 2 mods (pipeline started at rung 10→100 because lead time is ~2 months); re-close the invite gate (one config flag, 6.10) — slowing growth is always acceptable, degrading trust never is; at half capacity, the pre-approved schedule fallback is August 2027, taken without shame (28.1). The one non-negotiable: S3's trust tooling is never cut to save a date.

**5. Free-tier wall in an exam window.** The old shape of this risk — Supabase's 1 GB bucket + 5 GB egress against a PDF library — is retired: resource files live on Cloudflare R2 from the first upload (spine §0.5-R17; the dissent at the end of this file, ruled ACCEPTED), and R2's zero egress makes the exam-window download spike free. What remains, per amended D13's break order (moderation labor, DB size, R2 10 GB): **Early warning:** the D13 telemetry itself — DB >70% of 500 MB, or R2 storage >70% of 10 GB. **Pre-committed response:** pay the USD 25 (Supabase Pro for DB/MAU) or the R2 cents (~USD 0.015/GB-mo) same-day — the decision was made in D13 and funded by the 31.1 budget pre-commitment; the failure mode this register exists to prevent is not the cost but the *hesitation* (downloads failing mid-parciales while the founder deliberates).

## 33.3 Risk interactions — the compound scenarios

Single risks are managed; pairs are what kill. The three compounds worth naming, each with its circuit breaker:

- **#1 × #6/#8 (trademark as lever):** the realistic bad legal scenario is not a defamation suit or a copyright suit alone — it is content the university dislikes (a professor thread, a parciales shelf) prosecuted *through* the naming claim, where our weakest flank pays for a dispute we could otherwise defend. Circuit breaker: resolve #1 early (35.3 decision 1); after a rename, each remaining dispute stands or falls on its own merits, where the Rodríguez/takedown posture is genuinely strong.
- **#4 × #11 (burnout meets toxicity):** a toxicity spike is precisely when moderation load doubles (11.8.1 seasonality note) — the mod wall and the trust crisis arrive together, each worsening the other. Circuit breaker: the invite gate and the T0 circuit breaker (11.6.5) shed load instantly without degrading trust; growth is the adjustable variable, moderation quality never is.
- **#3 × #13 (density read through the wrong calendar lens):** a July or January reading of a young community will always look like death; misreading it triggers either panic-shipping (worsening #3's diagnosis discipline) or premature shutdown. Circuit breaker: the calendar-posture table (§1.5.2) is binding on interpretation — retention is judged mid-cuatrimestre only, and every checkpoint in 28.9 is dated against the academic calendar for exactly this reason.

## 33.4 The cease-and-desist playbook (risk #1/#7 response, written now so nobody improvises)

1. **Acknowledge receipt formally, respond substantively to nothing** on day one. No public statement, no community post, no social media.
2. **Counsel the same day.** The S0-era legal consult (PART 35 week 1) establishes the relationship in advance precisely so this call has a number to dial.
3. **Classify the demand:** (a) naming/trademark → execute D10 rename track while counsel negotiates the domain; (b) content takedown → apply the Rodríguez framework as operationalized in 11.5.1: remove manifestly unlawful content on notice, request judicial order for debatable claims, log everything; (c) both → treat separately; do not trade content concessions for name tolerance or vice versa without counsel.
4. **Preserve the record:** every notice, decision, and timestamp into the audit trail — the transparency reports and takedown logs accumulated since launch are the negligence defense (`legal-ar.md` §2) and the demonstration that the project is "unmistakably careful, independent, and lawful" (§1.4.1).
5. **Communicate to the community once, factually, after resolution** — never during, never adversarially. The platform does not go to war with the university its users attend; converting "shut it down" energy into "tolerate it" reality is the strategic goal (§1.4.1), and a public fight forfeits it.
6. **The floor:** if the worst outcome arrives (forced rebrand + domain loss), the loss is one string and one domain — D10's architecture priced that in from day one. The archive, accounts, and URLs under the new domain survive intact.

## 33.5 Register maintenance

This register is a living document with a feeding mechanism already wired elsewhere: the weekly ops review (PART 24's Friday ritual) files anything structurally wrong here rather than absorbing it; the monthly quota review (28.15) updates the P/I of risks #5, #9 and #10 against telemetry; the December annual review re-ranks the whole table and retires anything mitigated to irrelevance. A risk added to the register must arrive with its early-warning indicator and its pre-committed response, or it is a worry, not a risk — and worries do not get rows.

---

# PART 34 — OPEN QUESTIONS

**Decision: thirty questions requiring the founder, aggregated exhaustively from every part's [HUMAN DECISION], [LEGAL REVIEW] and unverified-assumption markers plus this part's own additions — grouped, numbered, each with options, the plan's default, a deadline phase, and what changes if answered differently. This is the founder's to-do list; the plan proceeds on the stated defaults wherever a deadline has not yet arrived.**

## 34.A Naming and legal **[LEGAL REVIEW]** throughout

**A1. The name.** [HUMAN DECISION] [LEGAL REVIEW] (C2, D10)
- Question: keep "uca.net" (verify domain registrability/price; INPI search on UCA marks in cl. 38/41/42; trademark opinion), or adopt a fallback name without the university's mark?
- Options: uca.net + disclaimer posture; distinct fallback name owning the "student layer" idea.
- Default: build under code name `ucanet`; assume a real chance the fallback is the answer.
- Deadline: checkpoint 4 — **31 ene 2027**, launch-blocking.
- If different: a fallback name changes one constant + one wordmark (1 day) and the SEO anchor text; nothing else. Keeping "uca" accepts risk #1 permanently and requires the strongest disclaimer + trade-dress distance counsel can design.

**A2. Legal pages (Términos, Privacidad, Reglas) to counsel.** (C15-a; 9.11.2 content inventory; 11.2 full Reglas text)
- Question: counsel-review the drafted texts, including the honest anonymity-limits language, court-order disclosure policy, no-IP-logging statement, 90-day backup retention, ban-hash retention, mod-access-to-authorship disclosure, 16+ statement, ARCO channel.
- Default: drafts from the 9.11.2 inventory and 11.2 v1 text; live (marked "borrador") from S0, final before beta.
- Deadline: drafts to counsel by **1 nov 2026**; final before beta (24 nov 2026).
- If different: counsel edits are expected; a counsel objection to the disclosure-policy wording changes ToS copy, not architecture.

**A3. RNBD registration under Ley 25.326 art. 21.** (`legal-ar.md` §1)
- Options: register now (free, TAD, formally mandatory); wait for the GDPR-aligned reform likely eliminating it.
- Default: follow counsel; plan leans register (absence is an aggravator; cost is near zero).
- Deadline: January 2027 hardening window.
- If different: no product change either way; a pending AAIP proceeding without registration worsens risk #14.

**A4. Regla 4 line and the defamation notice protocol.** (11.2, 11.5.1; `legal-ar.md` §2–3)
- Question: confirm the "opinion yes / named-person crime accusations no" line; define remove-on-notice vs. await-court-order boundary; confirm the wording creates no duty to investigate.
- Default: the 11.5.1 protocol (facial Regla 4 violations removed on report; lawful-looking opinion under external complaint logged, reviewed ≤72 h, not auto-removed).
- Deadline: before beta.
- If different: a stricter counsel line means more removal on notice — a moderation-volume change, not a schema change.

**A5. Copyright posture, especially parciales viejos.** (§14.9; 11.7.2; `legal-ar.md` §4)
- Question: can we host past exams; where is the resumen-vs-derivative line; what takedown SLA/strike policy keeps us out of arts. 71–72 accomplice territory; what makes a notice "plausible"; the counter-notice standard; whether hosting cátedra programas is safe.
- Default: accept parciales as student-transcribed material, no institutional branding, 72 h suspension SLA, strikes, kill switch ready.
- Deadline: **before the seed sprint (17 nov 2026)** — the seed itself contains parciales.
- If different: counsel saying "no exams" flips the §14.9.5 kill switch pre-launch; the seed re-weights to resúmenes; the utility magnet weakens but survives.

**A6. Disclosure and data-retention standards.** (9.11.3; 11.5.1; `legal-ar.md` §3)
- Question: exactly what identifying data we retain and for how long; release standard (court order only vs. prosecutor request); evidence-preservation duties for `contenido_ilegal`; whether minimal logs could be read as bad faith.
- Default: the 9.11.3 inventory (no IPs in our tables), court-order release posture, preserve-on-flag for contenido_ilegal.
- Deadline: before beta.
- If different: a counsel-mandated retention *increase* adds rows to the disclosure inventory — each needs a `docs/decisions.md` entry per the standing constraint.

**A7. Ban email-hash retention post-deletion.** (9.9) Default: retain the salted HMAC for ban matching; disclose in Privacidad. Deadline: with A2. If different: dropping it makes permanent bans evadable by delete-and-reregister.

**A8. Cross-border data transfers.** (`legal-ar.md` §1c) Question: do US processors (Vercel, Supabase, Resend, Sentry, Cloudflare) need AAIP model clauses (Res. 60-E/2016)? Default: name processors in Privacidad; execute clauses if counsel says so. Deadline: January 2027. If different: paperwork only.

**A9. The 16+ gate.** (C15-e; `legal-ar.md` §6) Question: is self-declaration sufficient, or is parental consent needed for 16–17? Default: 16+ self-declaration checkbox at registration. Deadline: with A2. If different: parental-consent flow is real product work — would slot into S3 and delay beta; counsel's early answer matters.

**A10. Archive and right-to-be-forgotten posture.** (§16.2.3, §16.5) Question: aggregate-stat freezing vs. suppression duties; Denegri limits for non-public-figure subjects; whether archive/rewind surfaces need faster suppression response than content URLs. Default: frozen aggregates, case-by-case human review, no auto-expiry. Deadline: P3 design (2027), earlier if a demand arrives. If different: per-surface response SLAs added to the mod runbook.

**A11. Nominative fair use in copy and structured data.** (PART 23; 08's strip wording) Question: does "La comunidad estudiantil de la UCA Rosario." plus `DiscussionForumPosting` markup stay on the right side of nominative use, or must copy weaken to "de estudiantes de la UCA Rosario"? Default: current copy + no education-entity schema markup. Deadline: with A1. If different: copy string changes only.

**A12. Breach notification.** (10.14) Question: notification form and whether to notify AAIP proactively (no statutory duty under current law; reform bills mandate it). Default: notify affected users ≤72 h; over-notification as the chosen error. Deadline: January 2027 (runbook finalization).

**A13. Search-log retention.** (PART 13's logging design)
- Question: is storing normalized search queries (lowercased, ≤100 chars, `@`/DNI-pattern redacted, **no user linkage of any kind**) compatible with the Ley 25.326 minimization posture, and for how long?
- Options: 12 months raw then aggregates only (proposed); aggregates-only from day one.
- Default: 12 months raw — `busqueda_sin_resultados` analysis is the seed-content to-do generator and needs real query text.
- Deadline: with A2 (Privacidad must describe whatever is chosen).
- If different: aggregates-only costs the seed-content signal's specificity; a retention-job parameter change either way.

**A14. Reports retention.** (PART 8's 2-year purge of resolved reports)
- Question: does 2-year retention of resolved abuse reports balance data minimization against evidentiary value (a repeat-offender pattern, a later court order)?
- Default: purge resolved reports at 2 years; `mod_actions` (the audit spine) retained indefinitely with internal UUIDs only.
- Deadline: with A2.
- If different: a shorter window weakens pattern moderation; a longer one grows the disclosure inventory — counsel picks the number, the job takes a parameter.

**A15. The deferred marketplace/monetization legal batch.** (15.2; 31.2–31.4; `legal-ar.md` §5, §7) Contents: MP Split withholding/information regimes touching the platform; SAS vs. asociación civil for commission revenue (joint with 32.3.3); seller 18+ and voidable-contract handling; botón de arrepentimiento + Data Fiscal triggers; whether tip links (Etapa B) fall below the "selling" line; donations tax posture; sponsorship contract template. Default: nothing built; "MP Split, never custody" fixed now. Deadline: before Etapa B ships (tips) / before Etapa C build (marketplace). If different: answers shape Stage 1–3 sequencing, not the MVP.

## 34.B Identity policy

**B1. D3-a: invite-gated any-email vs. require @uca.edu.ar.** [HUMAN DECISION]
- Options: invite links + any email (default); institutional-email requirement.
- Default: invite-gated any-email — density and spam control without the psychological cost and the alumni/exchange-student exclusion.
- Deadline: **before S0** (auth flow is migration 0002-era work).
- If different: @uca-only simplifies anti-abuse but shrinks the anonymity set, excludes Federico-type users permanently, and puts the university's mail system in our critical path. The plan recommends against.

**B2. Optional UCA-email verification as later escalation.** (9.10) Default: designed, not activated; never a public badge. Deadline: none — activation is the decision, triggered only by a spam/brigading wave. If activated: the social contract shifts ("cualquiera con el enlace" → "estudiantes comprobados") and subpoena surface grows by one hash.

**B3. Turnstile at open registration.** (11.6.7) Options: enable on signup from day one of open registration; wait for evidence. Default (recommended in PART 11): enable on signup only, never on reading or established-account actions. Deadline: **March 2027 launch week**. If different: waiting costs nothing until the first bot wave; the toggle exists either way.

**B4. Preview deployments against prod Supabase.** **RESUELTO — see spine §0.5-R23**: preview deploys use the second free Supabase project (seeded, no real data); previews never touch production data; the prod project deploys only from main (PART 20 §20.6).

## 34.C Product

**C1. The institution commitment.** [HUMAN DECISION] (1.2; Q25) The founder must actually want a 10-year institution, not an exit: no engagement mechanics, deletion beats archive, slow honest growth, founder time as unpaid subsidy. Default: assumed yes — every part of this plan leans on it. Deadline: **now**; re-affirmed each December (28.15). If different: stop; this plan is the wrong plan for a startup.

**C2. Launch carrera.** [HUMAN DECISION] (29.1) Default: the founder's own carrera (plan examples use Abogacía — substitute the real one). Deadline: before seed-content recruitment (**October 2026**). If different: the seed package, nodo identification, and the < 3 h answer SLA all assume the founder's home turf; a non-home carrera launch needs a champion from day one.

**C3. Expansion order and poster posture per facultad.** [HUMAN DECISION] (29.8) Default: Contador Público second, Ingenierías third, Comunicación/Sociales as verification lands; QR posters on customary student boards, removed if asked. Deadline: rolling from February 2027. If different: order is freely permutable — the invariants are the champion + 40-resource + verified-plan gates.

**C4. Seeding ethics ratification.** [HUMAN DECISION] (29.3) Default (stated as policy): real content, real attribution, "equipo" labels, sockpuppets prohibited permanently. Deadline: before the seed sprint. If different: the plan considers any loosening self-defeating — it blinds the D11 gate and risks fatal discovery in a 40-person beta.

**C5. Waitlist in beta.** **RESUELTO — see spine §0.5-R22** (and the dissent adjudication below, ruled accepted): the waitlist ships in beta — flow 6.10-A is designed, the `waitlist` table is absorbed into PART 8/D4, and it converts closed-beta rejection into expansion fuel. Built in S3.

**C6. Etapa B tips ("cafecito").** [HUMAN DECISION] (15.2-B) The decision is really "start paying Vercel Pro": donations are commercial use on Hobby. Default: not before Stage 1's trigger (paid infra active OR launch + 6 months). Deadline: mid-2027 at the earliest. If different: earlier tips = earlier USD 20/mo with trivial revenue; the legitimacy argument (31.2) may still justify it.

**C7. Marketplace go/no-go.** [HUMAN DECISION] (15.4) Even with all six Etapa C gates green, launching commerce changes what the platform is. Default: not before 2029; the founder decides against PART 31's identity analysis. If different: nothing in MVP moves either way — that is the point of the gate design.

**C8. AI-crawler stance.** [HUMAN DECISION] (PART 23) Options: allow all AI crawlers (recommended — the 2030s discovery channel argument); block them. Default: allow, stated in Privacidad. Deadline: before public launch (robots.txt + policy text). If different: blocking is a values call the community may prefer; costs archive reach, saves nothing material (files are never crawlable either way).

**C9. Multi-sede timing.** [HUMAN DECISION] (30.6) Default: not until Rosario is culturally self-sustaining; each sede needs its own champion + seed sprint. Deadline: none — 2028+ at the earliest. If different: opening a sede as a checkbox produces an empty shelf with a flag on it; the plan's density principle (P2) says no.

**C10. WhatsApp-conversion fallback.** [HUMAN DECISION] (3.0; 29.7) Question: if beta shows deep links shared into WhatsApp do not convert, which fallback distribution channel — Instagram stories of centros de estudiantes vs. physical QR intensification? Default: WhatsApp assumed universal (unverified). Deadline: beta report, **December 2026**. If different: the growth plan changes, not the product.

**C11. Sponsor acceptability line (Stage 3).** [HUMAN DECISION] (31.4) Default standing rejections: apuestas, préstamos/crypto, ghostwriting, anything requiring user data, anything politically/religiously partisan; founder approves each category. Deadline: only if/when Stage 3 opens (2028+).

## 34.D Operational

**D1. Founder hours/week.** [HUMAN DECISION] (28.1) Default: 20 focused h/week; every date derives from it. At 10 h/week, durations double and launch moves to **August 2027** (pre-approved fallback). Deadline: **before S0 (1 sep 2026)**; re-answered every December.

**D2. Rosario 2027 calendar confirmation.** [HUMAN DECISION] (28.2) Default: 2027 dates projected from verified 2026 rhythm. Deadline: ~December 2026 when facultad publishes. If different: weeks shift, sequence never does.

**D3. Moderator appointments.** [HUMAN DECISION] (11.8.3) Per-individual founder curation from beta standouts; first two onboarded January 2027. If recruitment fails: invite gate stays closed longer — growth waits for trust capacity (P9).

**D4. Domain custody.** [HUMAN DECISION] (21.7.3) Registrar in founder's personal account, auto-pay on, DNS on Cloudflare free, second authorized contact named. Deadline: S0. This is risk #20's first mitigation.

**D5. Succession plan ratification.** [HUMAN DECISION] (32.3) Ratify the three-stage path and its triggers; execute Stage-1 artifacts (asset inventory, shared vault, continuity letter, trusted contact). Deadline: artifacts in **S0**; trigger ratification by launch. If different: any alternative must still answer "what happens if the founder disappears in 2029" — silence is the only unacceptable answer.

**D6. The judgment-based Supabase Pro trigger.** [HUMAN DECISION] (21.6) Beyond the mechanical 70% triggers: "a real community exists and the no-backup/pausing risk is unacceptable" may justify paying early. Default: mechanical triggers only. Deadline: standing, reviewed monthly (28.15).

**D7. The unverified-assumptions ledger.** Not founder *decisions* — assumptions the plan currently trusts and must stop trusting on a schedule. Each has an owner-part and a verification deadline:

| Assumption (source) | Verify by | How |
|---|---|---|
| Supabase leaked-password protection + TOTP on Free tier (PART 10; believed Pro-only) | S0 | Dashboard check; if absent, the 10-char + denylist floor stands |
| Exact `pg_dump` flags exporting the `auth` schema under managed roles (20.9) | S0 + first restore drill | Prove bcrypt hashes restore logins |
| pg_cron activity alone prevents project pausing (21.5) | S0 | Assume no; external keepalive is the mechanism of record |
| Vercel Hobby middleware metering wording (20.5) | S0 | Docs re-read; matcher discipline regardless |
| Resend ~100/day + 3.000/mes caps (19.10) | S0 | Account dashboard; invite waves throttled <80/day regardless |
| Sentry ~5k events/mo; Vercel Web Analytics caps (PART 24) | S0 | Account dashboards |
| Average resource file ≈3 MB; the whole §21.2 consumption model | Beta report (dic 2026) | Replace with storage telemetry actuals |
| Moderation load figures of 11.8.1 | First cuatrimestre post-launch | Replace with queue telemetry |
| Cohort sizes 30–120; 90-9-1 participation split (3.0) | Beta report | Replace with funnel actuals |
| WhatsApp deep-link conversion (D11 load-bearing) | Beta report → C10 decision | Per-batch invite attribution (29.4) |
| MP fee ranges ~4–6% + IVA (`legal-ar.md` §7) | Etapa C build time | Re-quote before any pricing copy |

## 34.E Financial

**E1. Budget ceiling pre-commitment.** [HUMAN DECISION] [FREE-TIER RISK] (31.1; D13)
- Question: what personal monthly spend is pre-committed, in writing, so the D13 triggers execute same-day rather than becoming crises?
- Options: USD 50/mo through 2027 (recommended); the bare D13 worst case (~USD 29/mo); less.
- Default: USD 50/mo.
- Deadline: **before S0**.
- If different: a ceiling below ~USD 29/mo makes the plan dishonest — say so now and re-scope (R2 is already adopted per spine §0.5-R17, which pushes the paid trigger out). The exam-week failure mode this prevents is hesitation, not cost (33.2 #5).

## 34.F Standing decision rights (not one-time questions — [HUMAN DECISION] powers the founder holds permanently)

Aggregated so future maintainers know which levers are reserved. Each is exercised repeatedly, never "answered":

1. **Principle changes** — any edit to the twelve principles or their collision precedence (PART 2) requires founder sign-off.
2. **The registration gate** — opening, re-closing under abuse pressure, and per-carrera invite waves (6.10-B; 28.9 row 6).
3. **Moderator appointment and removal** — per individual, curating the institution's character (11.8.3).
4. **Sponsor category approval** — each Stage-3 category individually (31.4).
5. **The annual honesty ritual** — every December: hours/week re-answer, dependency and legal-page review, memoria sign-off (28.15).
6. **Spine amendments** — any change to D1–D14 is the lead/founder's alone; writers dissent in blocks, never in code (§0.4).

---

# PART 35 — FINAL RECOMMENDATION

## 35.1 Verdict

**Build it — with the naming caveat resolved before public launch, and with the founder's written commitment to the three loads the plan cannot carry for them: the hours, the budget ceiling, and the institution posture.**

The honest case for building: the thesis (D1) does not require winning a market — it requires one carrera's cohort to find a 2-minute check and a free shelf worth returning to, which the beta will prove or disprove for less than three months of evenings and USD 0. The cost of being wrong is bounded and pre-measured (checkpoints 28.9; graceful-shutdown floor 31.6); the payoff of being right compounds for a decade at USD 25–45/mo. The architecture is deliberately boring, the data is portable by construction and proven annually, and every plausible killer has a pre-committed response written in PART 33. Under brief §61's own standard — say so if it is a bad idea — this is not a bad idea; it is a small, disciplined, well-shaped one. What it is not is a startup: nobody should build this expecting an exit, and the plan says so everywhere it can.

## 35.2 The next 30 days (from mid-August 2026, concretely)

**Week 1 (13–19 ago) — decisions and accounts.** The founder answers, in writing: hours/week (D1), budget ceiling (E1), launch carrera (C2), the institution commitment (C1). Book the counsel meeting using `legal-ar.md`'s cross-cutting priority list as the agenda (trademark first). Open/verify accounts: registrar (auto-pay + second contact, D4), Cloudflare + R2 bucket, Resend, Sentry, GitHub private repo. Start the INPI/domain check for A1.

**Week 2 (20–26 ago) — counsel and seed groundwork.** Counsel meeting #1: naming (A1), legal-pages scope (A2), parciales posture (A5 — needed before seeding), disclosure standards (A6), 16+ (A9). Begin seed-content collection: inventory the founder's own materials, hold the first 3–5 apunte-maker conversations (29.1.3 terms), start the accomplice list (5–10 people). Draft the fallback-name shortlist.

**Week 3 (27 ago – 2 sep) — S0 begins.** Phase S0 per 28.3: repo, CI, migrations pipeline, auth + invite gate, tokens, backup script restore-tested, keepalive cron. Execute the Stage-1 continuity artifacts (D5: asset inventory, shared vault, continuity letter). Legal-page drafts started from the 9.11.2 inventory and 11.2 Reglas text.

**Week 4 (3–9 sep) — S0 lands.** Definition of done 28.3: a stranger with an invite registers, confirms, onboards, logs in on production under the code name. D7 verification items closed (SMTP live, Sentry scrubbing verified, pg_dump flags pinned). Seed collection continues in the background — it is the long pole and it started in week 2, not at S2.

After day 30 the machine is the roadmap (PART 28): S1 through 19 oct, S2 through 9 nov, S3 through 22 nov, seed sprint 17–22 nov, beta opens 24 nov into the finales window.

**The day-30 exit checklist** (any unchecked item is the next week's first task):

| # | Done means | Source |
|---|---|---|
| 1 | Hours/week, budget ceiling, launch carrera, institution commitment: written down | 34-D1, E1, C2, C1 |
| 2 | Counsel engaged; naming search running; parciales posture answered or scheduled before 17 nov | 34-A1, A5 |
| 3 | S0 definition of done met on the production URL under code name | 28.3 |
| 4 | Backup script restore-tested once; keepalive + backup crons live | 28.3, 20.9 |
| 5 | Continuity artifacts exist: asset inventory, shared vault, second registrar contact, continuity letter | 32.3.1 |
| 6 | Seed pipeline started: founder inventory done, ≥3 apunte-maker conversations held, accomplice list drafted | 29.1–29.2 |
| 7 | Legal-page drafts in progress from the 9.11.2/11.2 inventories, counsel deadline 1 nov on the calendar | 34-A2 |
| 8 | R2 adopted (ruled in spine §0.5-R17): bucket + credential ready for S2's upload work | Dissent adjudication below |

## 35.3 The three decisions that matter most

1. **Resolve the name before anyone loves it (A1/D10).** Every month of growth under an unresolved "uca" name raises the cost of the forced rename and the leverage of anyone who dislikes the content. The plan made the rename cheap; only the founder can make it early.
2. **Hold the density discipline when growth begs (D11, P2, 28.9).** Every failure mode of campus platforms is the same: broadcast before density, features before retention diagnosis, expansion into empty shelves. The gates are pre-committed precisely because the moment they bind is the moment they will feel wrong. The kill rule — respond to weak retention with ten conversations, never with features — is the single sentence to tape above the keyboard.
3. **Commit honestly to what the plan cannot supply: the founder's sustained capacity (D1, E1, C1).** Every date is a function of hours/week; every trigger is a function of the budget pre-commitment; every year of the vision is a function of wanting an institution in year 3 as much as in month 1. The August-2027 fallback exists so honesty about capacity costs a semester, not the project.

## 35.4 The two most likely killers, and the pre-committed responses

**Killer 1 — density never ignites (risk #3).** The most probable failure: the beta runs, downloads happen, and the conversation never becomes self-sustaining — W2 return under 20%, organic posts under 10/week. Pre-committed response: checkpoints 2–3 execute without renegotiation — full stop on feature work, ten user interviews, one re-concentration attempt in fewer comisiones; if the conversation thesis still fails, the pre-approved pivot is utility-only (library + search + materia pages), a smaller honest product the same schema already serves. What we have promised ourselves not to do: average across funnel stages, blame the calendar, or ship polls at the problem.

**Killer 2 — the founder breaks (risk #4).** The most probable *slow* failure: moderation load plus development plus community answering exceeds one person's sustainable weeks somewhere between 800 and 2,000 users, and the project dies not with an incident but with a queue that stops being read. Pre-committed responses: the recruitment trigger fires on numbers, not on feelings (11.8.2); the invite gate re-closes without shame; the operating cadence (28.15) makes December's honest hours re-answer an annual ritual; and the succession artifacts (32.3.1) mean even the worst case — the founder walking away — ends in a handover or a graceful, announced wind-down with the data promise honored, never in rot.

Naming is the #1 *risk*, but not a likely *killer*: its mitigation is complete and cheap by design. The killers are the two things no architecture can absorb — absent users and an absent founder.

## 35.5 What success looks like at each anniversary

- **2027 — one carrera alive.** The D11 gates passed with strangers; open registration survived its first cuatrimestre inside the moderation model; ≥3 carreras seeded and past their own gates; 2 mods beside the founder; quota telemetry green or the USD 25 paid calmly; the first memoria published the previous December. The test: a student of the launch carrera who never met the founder uses it weekly during cursada.
- **2028 — la sede lo conoce.** The permanence test (§1.2.1 test 4): materia pages rank page-1 for ≥10 "resumen <materia> uca" queries; ≥20% of registrations arrive via search or deep links; every facultad has one visibly alive carrera; per-facultad mods run front-line moderation; `/archivo/2026` and `/archivo/2027` public; the March ingresante wave arrives to a shelf that predates them. The test: a QR poster is redundant — new students hear about it from old ones.
- **2030 — self-sustaining.** The mod team runs weeks without founder front-line involvement, with written precedents and a recruitment pipeline; Stage 1 (and possibly Stage 2) revenue covers infrastructure and legal costs (~USD 45–80/mo, 31.6); restore drills are five-for-five; the generational test passes (2027–28 content consumed every exam window); the entity question (32.3.3) is answered or actively in progress. The test: the founder could take a cuatrimestre off and return to a living platform.
- **2036 — the §66 scenario, verbatim.** A student finds their materias, asks anonymously, downloads a 2029 resumen, searches a 2027 thread, and contributes something a 2038 student will use — on a platform that has been rewritten twice, renamed possibly once, and is held by an asociación whose statutes encode the NEVER list. The test is 32.4's table, read top to bottom, every row still true.

## 35.6 Closing: institution-shape over startup-shape

At every fork, this plan chose the institution: the explainable chronological feed over the engagement algorithm; deletion rights over archive completeness; free knowledge over early monetization; pseudonymous accountability over both real names and unaccountable anonymity; boring portable technology over velocity; cohort density over headline growth; published rules, public reasons and quarterly transparency over quiet ops; pre-committed triggers over improvised crisis decisions; a succession plan over a key-person dependency; and a graceful, announced ending as the worst permitted outcome over a slow rot or a trust-liquidating pivot. Each choice costs something a startup would refuse to pay — slower growth, mediocre DAU, unmonetized traffic, founder hours forever unpaid. The wager of this entire document is that those costs purchase the only thing the brief actually asked for: a place that a student opens in 2036 and recognizes. Build it.

---

## Dissent adjudication (for the lead)

Two formal DISSENT blocks were filed (both on the same issue), plus three flagged additions/contradictions that function as adjudication requests. The lead has since ruled on every item; the rulings are recorded in spine §0.5 and each block below carries its verdict. The original recommendations are preserved for the record.

**1. DISSENT — Supabase Storage vs. Cloudflare R2 for resource files (filed twice: PART 14/16 writer and PART 19–22 writer).** **RESUELTO — see spine §0.5-R17: ACCEPTED** (resource files on R2 from the first upload; D6/D13 amended). Both infra-adjacent writers independently recommend serving PDFs from R2 (10 GB free, zero egress) from day one, against D6/D13's Supabase-Storage-first stance. **Recommendation: ACCEPT, executed at S2 while zero files exist.** Grounds: the research ranks Supabase's 1 GB + 5 GB/mo as the #1 breaking constraint for exactly this workload; the D11 seed alone consumes 40–80% of the bucket *before launch*, meaning the "success triggers a paid tier or exam-week failures" scenario is not a tail risk but the modeled base case; the download architecture (auth-checked counting redirect → presigned URL) is identical either way; R2 is already provisioned as the backup target; and the marginal cost is 1–2 days plus one credential, versus permanently deleting the platform's most probable [FREE-TIER RISK] and its most probable USD 25 trigger. Spine changes needed if accepted: D6's storage line (resource files on R2; Supabase Storage unused at MVP), D13's trigger table (egress trigger becomes R2-ops-based and effectively dormant; DB-size trigger unchanged), PART 14 §14.3–14.5 mechanical edits (presigned PUT/GET against R2), PART 20 §20.9 backup roles (Supabase-side manifest remains; mirror direction documented). Condition: if S2 is running late against the 9 nov deadline, ship Supabase-first per the current spine and execute the pre-planned §21.4 migration in the January window — schedule risk to the beta outranks the egress bill.

**2. Flagged contradiction — `posts.carrera_id` (PART 12 writer requires it; PART 8 as written resolves carrera membership via `materia_id IN plan_materias` and makes untagged posts cohort-neutral).** **RESUELTO — see spine §0.5-R3: ACCEPTED** (`posts.carrera_id` snapshot added; D4 amended). These are not both implementable: PART 8's reading silently *changes the D2 feed definition* ("Mis materias = followed materias + own carrera", restated in 5.2 and 17.2 as "untagged posts by authors of the user's carrera"). **Recommendation: ACCEPT PART 12's position** — add `posts.carrera_id` (nullable snapshot at creation) with its partial index. It implements D2 as written, keeps the hottest query join-free, and snapshot semantics (the post belongs to the cohort the author was in when writing) are the archivally correct behavior when users change carrera. Spine change: D4's `posts` field list gains the column; PART 8 ratifies DDL + index.

**3. Flagged additions — `waitlist` table and utility routes `/recuperar`, `/registro/continuar` (PART 4–7 writer); resolved jointly with PART 17–18's open [HUMAN DECISION] on whether the beta waitlist ships.** **RESUELTO — see spine §0.5-R22 (waitlist absorbed into PART 8/D4) and D7 (routes added): ACCEPTED.** **Recommendation: ACCEPT all** — absorb the table into D4 and the routes into D7 (both `noindex` utility routes), and resolve the waitlist question as "ships in beta" (34-C5): flow 6.10-A depends on it and it converts closed-beta rejections into expansion fuel at the cost of one table and one form.

**4. Consistency notes filed as non-dissents (PART 23–27 writer's cron-slot note; PART 12–13 writer's tsvector/comment-search boundaries).** **RESUELTO — cron design affirmed, see spine §0.5-R16**: one Vercel daily cron (`/api/cron/aggregates`: keepalive + aggregates + karma + retention purges) with weekly backups on GitHub Actions; pg_cron is not load-bearing in MVP. No part may re-assign the cron to SEO, analytics, or digest work — anything finer-grained rides the existing aggregates endpoint.

**Summary:** all four requested rulings have been issued and recorded in spine §0.5 — R2-for-files ACCEPTED (§0.5-R17), `posts.carrera_id` ACCEPTED (§0.5-R3), waitlist + utility routes ACCEPTED (§0.5-R22, D7), cron design AFFIRMED (§0.5-R16). All four were additive spine edits; none reopened a D1–D14 decision's substance. PART 8's migration files and PART 14's upload module are written once, against the ruled spine.
