# PART 4 — COMPLETE PRODUCT MAP

## 4.1 The map in one decision

The product is three page types — **feed**, **materia page**, **resource page** — plus the safety machinery that keeps them trustworthy. Every capability, present or future, is an enrichment of one of those three surfaces or of the trust layer; nothing ships as a separate "app inside the app" (brief §64). Phase tags below are binding and identical to spine D2: **MVP**, **P2**, **P3**, **LP** (largo plazo).

Rationale: the brief describes five products (real-time community, knowledge base, anonymous social network, resource library, archive). Gluing five products together is how platforms die at this budget. Collapsing them into three page types means one schema, one navigation model, one moderation surface — and the "five products" become five *reading modes* of the same data (see PART 7 §7.1 for the movement map).

## 4.2 Ecosystem diagram

```
              ACQUISITION                                TRUST
  Google: "resumen derecho constitucional uca"     todo contenido es
  WhatsApp: deep link a un post/recurso            reportable ──────┐
  QR en la sede · boca a boca · invitaciones                        │
        │                                                           v
        v                                                       reports
  ┌──────────────────────────────────────────────┐                  │
  │        MATERIA PAGE  (the permanence unit)   │                  v
  │  /materias/derecho-constitucional            │             mod panel
  │  ┌────────────────┬────────────────────┐     │                  │
  │  │ Publicaciones  │ Recursos           │     │            mod_actions
  │  │ (AHORA)        │ (SIEMPRE)          │     │           (audit log)
  │  └───────┬────────┴─────────┬──────────┘     │                  │
  │      seguir materia     descargas/votos      │                  v
  └──────────┼─────────────────┼─────────────────┘         restricciones de
             │                 │                            usuario · karma
             │                 └── uploads (utility magnet)
             v
  ┌──────────────────────┐      ┌───────────────────────────┐
  │ FEED                 │      │ ACADEMIC CATALOG          │
  │ Mis materias | Rec.  │<─────│ sede→facultad→carrera→    │
  │ (the activity unit)  │      │ materia (plan_materias)   │
  └──────────┬───────────┘      └───────────────────────────┘
             │                        ^ pre-seeded (APPENDIX A)
             v
  posts ──> comments ──> notifications ──> return visit
    │
    └──> every public URL is durable ──> Google indexes materia +
         resource pages ──> next cohort arrives via search ──> the
         accumulated content IS the archive (Archivo UI reads it, P3)
```

The loop to protect above all: **resource ranks on Google → student lands on materia page → registers to download → auto-follows materias → sees cohort feed → posts → someone answers → returns.** Acquisition is SEO+shares, activation is the download gate (PART 6 flow 5), retention is the cohort feed (spine D1).

## 4.3 Capability inventory

### 4.3.1 Content & community

| Capability | Depends on | Phase |
|---|---|---|
| Posts (texto/pregunta, optional materia tag, optional Anónimo) | catalog, profiles | MVP |
| Comments (depth ≤ 2, Anónimo option, per-thread aliases) | posts | MVP |
| Upvotes (posts, comments, resources) | content | MVP |
| Feed: Mis materias + Reciente | posts, follows | MVP |
| Materia pages (Publicaciones / Recursos tabs, follow) | catalog | MVP |
| Carrera pages (plan grid + recent activity) | catalog | MVP |
| Facultad pages (thin catalog listing) | catalog | MVP |
| Polls in posts | posts | P2 |
| "Tendencias" feed section | vote/comment velocity | P2 |
| Mentions (@seudónimo) + mention notifications | comments | P2 |
| Bookmarks ("Guardados") | content | P2 |
| "Para vos" light personalization | engagement signals | P3 |
| Professor experience pages (structured, bounded) **[LEGAL REVIEW]** | catalog, counsel | P3+ |
| Community events / yearly traditions surfaces | culture emerging | LP |

### 4.3.2 Identity & reputation

| Capability | Depends on | Phase |
|---|---|---|
| Email+password auth, email confirm, invite gating | Supabase Auth | MVP |
| Unique pseudonym + generator, 90-day rename | profiles | MVP |
| Per-post/per-comment anonymity, per-thread aliases | anon_aliases | MVP |
| Karma (single int, daily batch for anon accrual) | votes | MVP |
| Account deletion with two content options | profiles, content | MVP |
| Avatars (text-first identity until then, if ever) | profiles | P2 |
| Optional @uca.edu.ar verification as anti-abuse tier | auth | P3 |
| Badges/levels/leaderboards | — | not planned |

### 4.3.3 Utility & knowledge

| Capability | Depends on | Phase |
|---|---|---|
| Resources: upload (PDF/imagen ≤10 MB, ≤3 files), typed, free | storage, materias | MVP |
| Download counts + upvotes on resources | resources | MVP |
| Search v1: Postgres FTS (spanish+unaccent) posts/materias/recursos | content | MVP |
| Resource reviews/ratings beyond upvote | resources | P2 |
| Email notifications / weekly digest per materia | notifications | P2 |
| Academic calendar surfaces (turnos de finales, inscripciones) | catalog+calendar data | P2 |
| Archivo UI (/archivo/[year]: milestones, stats, notable threads) | accumulated data | P3 |
| Marketplace (paid resources, Mercado Pago) **[LEGAL REVIEW]** **[FREE-TIER RISK]** (C8: requires Vercel Pro) | resources, counsel | P4+/LP |
| Multi-sede / multi-university expansion | schema already allows | LP |

### 4.3.4 Trust & safety

| Capability | Depends on | Phase |
|---|---|---|
| Reports (categories, exactly-one-target) | all content | MVP |
| Mod panel v1: queue, remove/restore/warn/suspend/ban, audit | reports | MVP |
| In-app notifications: replies, mod decisions | content | MVP |
| Rate limits in DB functions | — | MVP |
| Legal pages: Términos, Privacidad, Reglas **[LEGAL REVIEW]** | — | MVP |
| Appeals flow (structured, `/apelacion`) | mod panel | MVP |
| Trusted-student moderators per facultad (C13) | community | P2–P3 |
| Downvotes | only if low-quality flooding appears | conditional |
| DMs / chat | — | excluded (C12) |
| Realtime subscriptions | — | excluded from MVP |

## 4.4 Brief §9 module-by-module verdict

- **A. Home/Feed — IN, simplified.** Two tabs only. **Mis materias** is lightly ranked by PART 12's formula (recency-dominant, understandable), computed in MVP over a single bounded window (§0.5-R2); **Reciente** is pure chronological. Polls cut to P2.
- **B. Short-form posts — IN, merged.** There is no separate micro-post system: one composer, title optional, body ≤10k chars. A "short post" is simply a post without a title. Two content systems would double schema, feed, and moderation cost for zero user value.
- **C. Materias — IN, reduced.** Header + two tabs (Publicaciones, Recursos) + follow. Brief's eight proposed sections collapse: Exams → a resource *type* (parcial/final), not a tab; Professors → P3+ (C9); Dates → P2 calendar surfaces; Experiences/Related → ordinary posts and catalog links.
- **D. Carreras — IN.** Plan de estudios grid (año × cuatrimestre) linking materias, plus recent activity. This page is the onboarding backbone (auto-follow) and the strongest internal navigation hub.
- **E. Facultades — IN as thin catalog.** A facultad page lists its carreras and nothing else in MVP. It exists for hierarchy completeness and SEO breadcrumbs, not as a community surface.
- **F. Resources — IN, reduced metadata.** Title, description, tipo, materia, año, files, downloads, upvotes, anonymity flag. Ratings → upvote only (C10). Price → `price_cents` exists in schema, unused (C11). Visibility → everything public (C16).

Modules the brief lists elsewhere: Search (§15) IN as Postgres FTS; Notifications (§17) IN, in-app only; Moderation (§18) IN; Marketplace (§10) OUT (P4+); Archive (§13) OUT as UI, IN as data discipline.

---

# PART 5 — MVP

## 5.1 Decision

The MVP is exactly spine D2's IN list — nothing enters without removing something else. Definition of done for the MVP as a whole: a UCA Rosario student with an invite link can register, follow their materias, read and publish (signed or anonymous), upload and download resources, report abuse, and a moderator can act on that report — all in production, under RLS, in es-AR, on free tier.

## 5.2 IN items — what "done" means

Each item: functional acceptance criteria in plain language. Technical criteria (RLS tests, rate limits) live in PARTS 8–10; these are the product-level checks.

**Auth + invite gating.** (1) A visitor with a valid invite link can create an account with any email and must confirm it before proceeding. (2) An expired/exhausted invite shows a clear error and the waitlist path, never a dead end. (3) A logged-out visitor hitting an auth-required page is redirected to "Ingresá" and returned to where they were after login. (4) Password reset works end-to-end via email without exposing the pseudonym–email link to anyone.

**Profile + pseudonym.** (1) Pseudonym is unique (case/accent-insensitive), 3–24 chars, checked live during onboarding. (2) The generator proposes es-AR-flavored names and can be re-rolled; typing your own is equally easy. (3) Rename allowed once per 90 days; after rename, zero public surfaces show the old handle. (4) Carrera and año are optional and editable in Ajustes.

**Academic catalog.** (1) All three verified Rosario facultades and their verified carreras exist at launch with correct slugs (APPENDIX A, section C). (2) Abogacía Plan 2013 and Contador Público Plan 2017 materias are fully loaded with año/cuatrimestre. (3) Every materia has a working page even with zero content. (4) Catalog edits are migration-driven, never runtime user edits.

**Posts.** (1) A logged-in user can publish with body only; title, materia tag, kind "pregunta", and Anónimo are each optional and independent. (2) An anonymous post exposes no author data in any API response or page source (verifiable by inspection). (3) Author can edit (marked "editado") and delete; deleted posts show a tombstone in threads, never a 404 with orphaned comments. (4) Character limits are enforced server-side with friendly client-side counters.

**Comments.** (1) Replies nest exactly one level; the reply button disappears at depth 2. (2) The same Anónimo option exists, and within one thread the same anonymous author is consistently labeled "Anónimo 1/2/…". (3) Comment counts on posts are accurate after create/delete.

**Upvotes.** (1) One vote per user per target, toggleable, self-vote blocked server-side. (2) Scores update on next render (no realtime). (3) Votes on anonymous content never reveal timing-correlatable karma changes (daily batch, spine C5).

**Feed.** (1) "Mis materias" shows posts tagged with followed materias plus untagged posts by users of my carrera, lightly ranked per PART 12's recency-dominant formula (§0.5-R2). (2) "Reciente" shows everything, chronological. (3) Both paginate (cursor-based, 25/page) without duplicates or gaps. (4) Feed loads in under 1.5 s p75 on a mid-range phone (PART 22 owns the budget).

**Materia pages.** (1) Header shows nombre, carrera(s) + año + cuatrimestre from plan_materias, follower count. (2) Tabs Publicaciones and Recursos each paginate and each have a designed empty state (PART 7 §7.6). (3) "Seguir" toggles instantly and feeds "Mis materias". (4) The page renders fully logged-out and is indexable.

**Carrera pages.** (1) Plan grid shows every materia by año/cuatrimestre with per-materia resource and post counts. (2) Recent activity lists the last 10 posts across the carrera's materias. (3) Renders logged-out, indexable.

**Resources.** (1) Upload accepts PDF/JPG/PNG/WebP, ≤10 MB per file, ≤3 files, with tipo (resumen/apunte/parcial/final/guía/otro), título, descripción, año optional, Anónimo optional. (2) Invalid files are rejected before upload starts (type/size) and again server-side. (3) Download requires login and increments a count; metadata pages are public (decision in PART 6 flow 5). (4) Uploader can delete their resource; files leave storage within 24 h. (5) Per-user storage quota (PART 21 sets the number) is enforced with a clear message. **[FREE-TIER RISK]**

**Search v1.** (1) One box searches posts, materias, and resources; results grouped by type, materia matches first. (2) Accent-insensitive ("economia" finds "Economía"). (3) Empty results screen suggests browsing materias. (4) p75 query time < 500 ms at MVP data volumes.

**Reports + mod panel.** (1) Every post, comment, resource, and profile has "Reportar" with the D2 category list. (2) Reports land in a queue visible only to mods; each shows full context including internal authorship of anonymous content. (3) Mod actions (remover/restaurar/advertir/suspender/banear) take effect immediately and write an immutable audit row. (4) The affected user is notified with the public reason; the reporter is notified their report was resolved. (5) Duplicate reports of the same target collapse into one queue item.

**Notifications v1.** (1) In-app only: reply to my post, reply to my comment, mod decision on my content or report. (2) Unread count in nav; opening marks read; each links to the exact comment. (3) Actor display respects anonymity ("Alguien respondió…" never leaks a seudónimo behind an anonymous reply).

**SEO base.** (1) Public pages server-render full content with unique titles/descriptions. (2) Sitemap covers materias, carreras, facultades, posts, resource metadata. (3) Profiles are `noindex` (C16). (4) URLs match D7 exactly and never change.

**Legal pages.** (1) Términos, Privacidad, Reglas exist, in es-AR, reviewed **[LEGAL REVIEW]**, linked from footer and from registration ("Al crear tu cuenta aceptás los Términos y la Política de Privacidad."). (2) Reglas are written for students, not lawyers, and are quoted in mod notifications.

## 5.3 OUT items — why, honestly

**Polls.** Polls are the cheapest-looking cut but the third content type in schema, feed rendering, voting, and moderation. Their real value (temperature checks: "¿estuvo difícil el parcial?") arrives only with density — a poll with 4 votes signals death, and in a 30-person cohort most polls will get 4 votes. In P2, with proven cohort activity, polls become a genuine retention feature; in MVP they would mostly manufacture visible emptiness.

**Tendencias.** A trending section needs velocity math over a volume of votes and comments that will not exist for months; with 30 posts/week, "Tendencias" is just Reciente re-sorted, plus a new surface to explain and moderate. Worse, an empty or stale trending tab tells every visitor "nothing is happening here" — the exact opposite of the density illusion the cohort feed is engineered to create (spine 0.1). It returns in P2 when there is measurable velocity to rank.

**Para vos.** Light personalization requires engagement signals (dwell, clicks, vote patterns) we deliberately do not collect at MVP (PART 24's minimal events), plus ranking logic that would make the feed unexplainable — violating the brief's own "the system should remain understandable" (§16). "Mis materias" *is* personalization, done by explicit declaration instead of inference, at zero algorithmic cost. Inference-based ranking earns its complexity only when explicit following stops being enough (P3).

**Professor pages.** Cut for legal exposure, not effort (C9): anonymous free-text about named real persons is the single most predictable path to a defamation claim and to the university deciding the site is an enemy. Professors' names appear only as neutral catalog facts. The P3+ design (structured, bounded, counsel-reviewed) is a different feature, not a delayed one. Teaching discussion still happens in materia posts under Reglas that permit experiences and prohibit attacks on persons. **[LEGAL REVIEW]**

**Marketplace.** Payments would drag in Mercado Pago integration, AFIP/monotributo questions for student sellers, refunds, disputes, platform liability, and Vercel Hobby's commercial-use prohibition (C8) — a second project the size of the MVP, monetizing a library whose entire cold-start value is being free (C11). The schema keeps `price_cents` nullable and enums extensible; nothing else is built. PART 15 designs the eventual shape.

**Archive UI.** The archive is the one feature we build by *not* building it: durable URLs, public content, soft deletes, and yearly data discipline mean the 2026 corpus exists whether or not a browsing UI does. An `/archivo` section at launch would curate three months of history — embarrassing, not evocative. It ships in P3 when there is a completed academic year to frame (milestones, stats, notable threads), reading data that was archival from day 1.

**Downvotes.** In a community of hundreds, a downvote is not quality signal, it is social punishment with a body count: it chills exactly the tentative first-time posters the cold start depends on, and it hands brigades a one-click weapon. Reddit-scale communities absorb this; a 40-person cohort does not. "Reportar" removes the genuinely bad; upvotes float the good; sorting needs nothing more at this scale. Reconsidered only if low-quality flooding measurably appears (C10).

**DMs.** Excluded, not deferred (C12). Anonymous private messaging is the worst moderation economics on the platform: invisible, 1:1, screenshot-proof harassment with no community witnesses, aimed at pseudonymous targets. And the job is already done — every student cohort lives in WhatsApp; we are the public layer WhatsApp cannot be, not a worse WhatsApp. Any future revisit requires a concrete moderation-funded design, and "la gente lo pide" alone will not qualify.

**Realtime.** Live updates are the free tier's quiet killer — persistent connections consume Supabase's realtime quota and force client-heavy architecture against our RSC-first stack (D6), to serve a community whose natural rhythm is check-in, not live-stream. A feed that is 30 seconds stale is indistinguishable from live at our scale. Refresh-on-navigation wins on cost, simplicity, and battery. **[FREE-TIER RISK]** avoided rather than managed.

**Email digests.** Transactional email is MVP-critical (confirmation, recovery) but *notification* email is a deliverability and consent minefield: digest volume burns Resend's free tier, lands in spam, trains users to ignore the sender, and requires preference management we haven't built. In-app notifications close the MVP loop (reply → aviso → return). The P2 digest ("resumen semanal de tus materias") is genuinely wanted — weekly, per-materia, opt-in — and will be built as a retention feature with real preference controls.

**Avatars.** Image avatars mean upload UI, moderation of the single most abused image type on any platform, storage spend, and — worst — a visual identity channel that survives anonymity mistakes (a recognizable avatar next to "Anónimo" habits). Text-first identity (seudónimo, maybe a deterministic two-letter mark) is cheaper, safer, and closer to the knowledge-web character (D8). P2 "if ever" is honest: the product may simply never need them.

**Badges.** Badges, levels, and leaderboards manufacture extrinsic motivation, and the brief itself names the trap ("do not over-gamify", §11; "timeless", §46). In a pseudonymous academic community, leaderboards convert helpfulness into farming and make karma a target instead of a byproduct. Karma as one quiet number is the whole reputation system (C10). Not planned — not "later", not planned.

## 5.4 The seven hypotheses (brief §40)

Beta gate from D11: ≥40% week-2 return and ≥30 organic posts/week. The per-hypothesis instruments:

| # | Hypothesis | MVP feature that tests it | Proof signal (beta, 1 carrera, 20–50 users) |
|---|---|---|---|
| 1 | Students want to visit | Feed (Mis materias) + materia pages | ≥40% of registered users return in week 2; ≥2 sessions/user/week during cursada |
| 2 | Students want to post | Composer (post + pregunta) | ≥30 organic posts/week; ≥25% of weekly actives publish ≥1 post or comment |
| 3 | Students want to interact | Comments + upvotes + avisos | ≥60% of posts get ≥1 comment; median time-to-first-reply < 12 h |
| 4 | Students follow subjects | Auto-follow + follow button | ≥80% keep ≥3 followed materias after 2 weeks; ≥30% manually add or prune ≥1 |
| 5 | Resources are useful | Upload/download + search | ≥50% of users download ≥1 resource in month 1; ≥10 organic uploads/month; search→download conversion ≥25% |
| 6 | Anonymity model works | Anónimo flag + aliases | 10–60% of posts anonymous (used but not dominant); 0 deanonymization incidents; anonymous posts report rate < 2× signed rate |
| 7 | Moderation manageable | Reports + mod panel | < 5 reports per 100 posts; median resolution < 48 h; founder mod time < 5 h/week |

Failure readings are pre-committed: H2 fails → seed-content strategy was wrong, fix content before touching features. H6 fails high (dominant anonymity + high report rate) → tighten rate limits before considering identity changes. H7 fails → stop growth (pause invites) until trusted-student mods exist (C13). Metrics come from the `events` table and plain SQL, no analytics SaaS (PART 24).

---

# PART 6 — USER FLOWS

Conventions: exact UI copy in quotes, es-AR voseo. Error copy is specified because error states are where trust is won. "uca.net" appears in copy as the working name; every string lives in the single name constant of D10.

## 6.1 Registro via invite → feed

**Decision: 3 interactive screens + 1 out-of-band email confirmation. Target ≤ 2 minutes of user time (brief §51), measured from invite tap to feed render.**

| Step | Screen | User time |
|---|---|---|
| 0 | Invite link opens registration directly (no separate landing) | — |
| 1 | Email + contraseña | ~30 s |
| 2 | Confirmar email (out of band) | ~30 s |
| 3 | Seudónimo | ~20 s |
| 4 | Carrera + año → auto-follow | ~25 s |
| — | Feed | total ≈ 1:45 |

**S1 — `/invitacion/[code]`.** Header: "Te invitaron a uca.net". Sub: "La comunidad estudiantil de la UCA Rosario. Anónima, hecha por estudiantes." Fields: "Email" — helper: "Usá el que quieras. Nunca se muestra públicamente." — and "Contraseña" (min 10, strength hint: "Al menos 10 caracteres."). Button: "Crear cuenta". Legal line: "Al crear tu cuenta aceptás los Términos y la Política de Privacidad." Edges: invalid/exhausted invite → "Este link de invitación ya se usó o venció. Pedile uno nuevo a quien te invitó, o anotate en la lista de espera." with button "Anotarme en la lista de espera" (→ 6.10). Email already registered → "Ya existe una cuenta con ese email. ¿Querés ingresar?" linking `/ingresar`.

**S2 — confirm interstitial.** "Revisá tu casilla — Te mandamos un email a &lt;email&gt; para confirmar tu cuenta. Abrí el link para seguir." After 30 s a link appears: "¿No llegó? Reenviar email" (rate-limited: 3/hour) and "Fijate también en correo no deseado." The confirmation link returns to `/registro/continuar` with the session active. Edge: link expired → "El link venció. Te mandamos uno nuevo." (auto-resend once).

**S3 — seudónimo.** "Elegí tu seudónimo — Así te va a ver la comunidad. Tu nombre real no se pide nunca." Input pre-filled by the generator (es-AR flavored: "MateLavado", "SextoIntento", "BedelDeTurno"), button "Probar otro" re-rolls; typing overrides. Live validation: taken → "Ese seudónimo ya está en uso."; charset → "Solo letras, números y guion bajo (3 a 24 caracteres)." Helper: "Lo podés cambiar cada 90 días." Button: "Continuar".

**S4 — carrera + año.** "¿Qué estudiás? — Esto arma tu feed. Lo podés cambiar cuando quieras." Select "Carrera" (grouped by facultad), select "Año" (1°–5°). On selection, the auto-follow list renders: "Te suscribimos a las materias de 2° año de Abogacía:" — checkbox list, all checked, from plan_materias, uncheckable individually. Link: "Agregar otras materias" (inline search). Skip link, de-emphasized: "Prefiero no decir mi carrera" (→ feed defaults to Reciente with a persistent prompt). Button: "Ir al feed". Edge: carrera without loaded plan → "Todavía no cargamos el plan de esta carrera. Podés seguir materias manualmente desde Materias." (catalog gap must not block registration).

**Feed, first render.** Seeded content guarantees a non-empty first feed (D11: no cohort launches into an empty shelf). A dismissible one-line banner: "Bienvenido. Todo lo que publicás es público; tu identidad real no. Leé las Reglas." — the C16 contract, stated once.

## 6.2 Crear post — normal y anónimo

Entry: "Publicar" (header button desktop, center slot of bottom bar mobile), or contextual from a materia page (materia pre-tagged). One composer (verdict 4.4-B):

- Body textarea, placeholder: "¿Qué está pasando?" (from materia page: "¿Qué está pasando en Derecho Constitucional?"). Counter appears at 9,000: "Te quedan 1.000 caracteres."
- "Agregar título" (optional, expands input, ≤120: "Máximo 120 caracteres.")
- "Materia" optional selector, followed materias first. From a materia page it arrives set and removable. When no materia is selected, a visible helper line discloses the cohort scope (§0.5-R3): "Los posts sin materia se muestran a tu carrera."
- Toggle "Es una pregunta" — helper: "Las preguntas piden respuesta y se destacan en la materia."
- Checkbox "Publicar como Anónimo". On check, an explanation renders — the exact anonymity contract, always visible before submit:

> "Vas a publicar como **Anónimo**. Nadie va a ver tu seudónimo, tu karma ni tu historial, y tus publicaciones anónimas no se pueden conectar entre sí. El equipo de moderación conserva la autoría interna para prevenir abusos — leé cómo funciona en las Reglas."

The author strip switches from the seudónimo to "Anónimo" so the user *sees* what will publish. Button: "Publicar" → post page. Anonymity is immutable post-publish (no "des-anonimizar" and no "anonimizar después" — editing identity after the fact creates linkage evidence; PART 9 details).

Edges: empty body → "Escribí algo antes de publicar."; rate limit (values per PART 11 §11.6.2) → "Estás publicando muy seguido. Esperá unos minutos."; suspended → "Tu cuenta está suspendida hasta el 12/9. No podés publicar." linking the mod notification; network failure → draft kept in localStorage, "No se pudo publicar. Tu borrador quedó guardado — probá de nuevo."

## 6.3 Responder → notificación → volver

1. Ana publishes as "Anónimo": "¿Alguien tiene el parcial del año pasado de Obligaciones?" (thread label: Anónimo 1).
2. Bruno opens `/p/[id]`, replies signed: "Sí, lo subo a la noche. Fijate también en Recursos que hay una guía." → "Responder" → comment renders, `comments_count` +1.
3. Ana's notification is created: because her post is anonymous, actor display is precomputed (D4) but her *own* aviso can safely name the actor: "**BrunoDelFondo** respondió tu publicación anónima: 'Sí, lo subo a la noche…'". Had Bruno replied anonymously, it reads "**Alguien** respondió tu publicación…" — an anonymous actor is never named, and the aliasing never leaks into avisos.
4. Ana's next visit shows the unread count on "Avisos". `/avisos` lists compact rows; tapping deep-links to `/p/[id]#c-[commentId]`, comment highlighted, aviso marked read.
5. Ana replies to Bruno (depth 2; his comment shows no "Responder" beneath the reply — the UI removes the option rather than erroring).
6. Bruno gets the mirror aviso. The loop that H3 measures is closed.

Edge: content removed before the aviso is opened → "La publicación ya no está disponible." — the aviso stays, the link degrades gracefully.

## 6.4 Subir recurso

Entry: "Subí un recurso" on a materia's Recursos tab (materia pre-set) or `/recursos`. Single form:

- "Materia" (required), "Tipo" (Resumen / Apunte / Parcial / Final / Guía / Otro), "Título" (required, e.g. "Resumen completo Unidades 1–14"), "Descripción" (optional: "¿Qué incluye? ¿De qué cátedra o año es?"), "Año" (optional: "¿De qué año es el material?").
- File picker: "Archivos — PDF o imágenes, hasta 10 MB por archivo, máximo 3." Client validates instantly: wrong type → "Solo aceptamos PDF, JPG, PNG o WebP."; oversize → "«apuntes.pdf» pesa 14 MB. El máximo es 10 MB. Consejo: comprimí el PDF o dividilo en partes." Per-file progress bars; server re-validates type (magic bytes), size, and per-user quota → "Llegaste a tu límite de almacenamiento. Borrá algún recurso viejo para subir más." **[FREE-TIER RISK]** (quota number in PART 21).
- Checkbox "Publicar como Anónimo" — same contract block as 6.2.
- Copyright line above submit: "Subí solo material que puedas compartir: tus propios apuntes y resúmenes, o material de circulación libre entre estudiantes. No subas libros ni capítulos editoriales." **[LEGAL REVIEW]**
- "Publicar recurso" → resource page. Resources publish immediately and enter the mod new-uploads review list (flow details owned by PART 11).

## 6.5 Descargar recurso — the gate decision

**Considered:** (a) fully public downloads; (b) metadata and files both login-walled; (c) metadata public + download requires account.
**Chosen:** (c). Resource pages render title, descripción, tipo, materia, año, file names/sizes/page counts, download count, votes — publicly and indexably. The file itself requires a session; download buttons issue short-lived signed URLs (PART 10).
**Why:** SEO needs the metadata, not the file — "resumen derecho constitucional uca" ranks on a crawlable page with real text; Google does not need the PDF (and serving PDFs to crawlers burns egress for zero community gain). Cold-start needs the gate: the download moment is the highest-intent second in the funnel, and converting it into registration is how utility becomes community (spine D1: utility recruits). Ungated files also invite hotlinking and scraping directly against the ~5 GB/mo egress budget — the first thing that breaks (C7). **[FREE-TIER RISK]**
**Cost:** friction exactly where users feel entitled to none; some bounce. Mitigations: the wall states the price honestly and the invite-gated beta shows "lista de espera" instead of a lie.

Flow, logged-in: "Descargar (PDF · 2,3 MB)" → signed URL → count +1. Flow, logged-out: same button → modal: "Creá tu cuenta para descargar — Es gratis y lleva un minuto. Con tu cuenta también podés seguir materias y preguntar en la comunidad." Buttons: "Crear cuenta" / "Ya tengo cuenta". During closed beta the first becomes "Anotarme en la lista de espera" (6.10). Edges: file missing from storage → "No pudimos preparar la descarga. Avisamos al equipo." + Sentry event; resource removed by mods → page shows tombstone "Este recurso fue quitado por infringir las Reglas."

## 6.6 Reportar contenido

"Reportar" lives in the overflow menu of every post, comment, resource, and profile (D14 rule 10). Dialog: "¿Por qué reportás esto?" — radio list of the 12 categories of PART 11 §11.3.1, with its UI labels verbatim: "Spam o publicidad", "Acoso u hostigamiento", "Amenazas o violencia", "Datos personales de alguien", "Ataque o acusación a una persona con nombre", "Se hace pasar por otro", "Contenido ilegal", "Venta indebida o fraude académico", "Infringe derechos de autor", "Contenido sexual explícito", "Votos manipulados o cuentas falsas", "Otro". Optional detail: "Contanos más (opcional)" — required for "Infringe derechos de autor", "Se hace pasar por otro" and "Otro" (per PART 11 §11.3.2). Submit: "Enviar reporte" → toast (copy per PART 11 §11.3.2): "Recibimos tu reporte. Te vamos a avisar cuando lo revisemos." — the promise is kept by the `reporte_resuelto` notification. Logged-out users see "Ingresá para reportar" (anonymous-to-us reports invite spam; accounts are pseudonymous anyway). Edges: duplicate by same user → "Ya reportaste este contenido. Está en revisión."; the reported author is never notified a report exists — only of outcomes.

## 6.7 Moderador resuelve un reporte

1. `/mod/reportes`: queue sorted oldest-first, grouped by target (duplicates collapsed, reporter count shown). Row: category, snippet, materia, report age.
2. Detail: full content in context (thread around a comment), category + reporter notes, target author's internal identity **including for anonymous content** — for anonymous content it sits behind a "Ver autor" control whose click writes an audited `revelar_autor` action row (PART 11 §11.4.2; the page marks it: "Contenido anónimo — la autoría es visible solo para moderación") — author's prior mod history, other reports on the same author.
3. Actions (PART 8 vocabulary, per §0.5-R5): "Remover contenido" (`remover`) / "Restaurar" / "Advertir al autor" / "Suspender…" (duration picker; writes a `user_restrictions` row per the PART 11 ladder) / "Banear" / "Desestimar reporte" / "Bloquear hilo". Every action requires a public reason (sent to the affected user, category-quoting the Reglas) and allows internal notes (audit-only).
4. Effects are immediate: removed content tombstones ("Esta publicación fue quitada por infringir las Reglas de la comunidad."); `mod_actions` row written (immutable); author notified: "Tu comentario en 'Parcial de Obligaciones' fue quitado. Motivo: Acoso u hostigamiento. Podés responder a esta decisión desde Avisos."; reporters notified: "Revisamos tu reporte y tomamos medidas. Gracias por cuidar la comunidad." or "Revisamos tu reporte y el contenido no infringe las Reglas."
5. Appeals are structured in MVP (§0.5-R15): the mod notification links to `/apelacion`, where the affected user files one written descargo per decision; it creates an `appeals` row linked to the `mod_actions` row and is reviewed by a second moderator (flow details per PART 11 §11.5.2).

## 6.8 Recuperar cuenta

`/ingresar` → "¿Olvidaste tu contraseña?" → `/recuperar`: "Recuperá tu cuenta — Ingresá el email con el que te registraste y te mandamos un link para crear una contraseña nueva." Anti-enumeration: always "Si existe una cuenta con ese email, te va a llegar un link en unos minutos." Link → "Creá tu contraseña nueva" → "Listo. Ya podés ingresar." Session, seudónimo, karma, follows: intact — recovery never touches identity (brief §52; renaming is a separate, unrelated action per D3). Honest edge, stated in `/recuperar` help text: "Si ya no tenés acceso a ese email, no podemos verificar que la cuenta sea tuya y no vamos a poder recuperarla. Podés crear una cuenta nueva." — with no public email↔seudónimo linkage, support-ticket recovery would require exactly the identity disclosure the platform promises never to make; we accept lost accounts as the price of the privacy model. Users can update their email in Ajustes (confirmed on both addresses) — the mitigation is prevention.

## 6.9 Borrar cuenta

`/ajustes` → "Borrar mi cuenta" → full-page flow, sober copy, no dark patterns:

1. "Borrar tu cuenta — Esta acción es permanente. Tu email y tus datos de acceso se eliminan. Elegí qué pasa con lo que publicaste:" Two options (D3):
   - "**Borrar también mis publicaciones, comentarios y recursos.** Desaparecen del sitio. Los hilos donde participaste mostrarán 'comentario eliminado'."
   - "**Conservar mi contenido como usuario eliminado.** Tus publicaciones quedan, atribuidas a 'usuario-eliminado', sin conexión con tu seudónimo." — helper: "Esto ayuda a que las respuestas útiles sigan sirviendo a otros estudiantes."
2. Confirmation: "Escribí tu seudónimo para confirmar." + "Borrar mi cuenta definitivamente."
3. Result page (pre-logout): "Tu cuenta fue eliminada. Gracias por haber sido parte." Mod/audit records retain the internal UUID only (D3); anonymous content follows the same chosen option; deletion executes within 24 h for files, immediately for visibility. No reactivation window in MVP — the copy says permanent and means it.

## 6.10 Onboarding sin invitación — the two states

**State A — closed beta (launch → open-registration gate of D11).** `/registro` without invite: "uca.net está en beta cerrada — Estamos abriendo carrera por carrera para que la comunidad arranque con vida. Dejanos tu email y te avisamos cuando abra la tuya." Fields: email, carrera (optional select). Button: "Anotarme en la lista de espera". Confirmation: "Listo. Te avisamos apenas abra tu carrera." Waitlist rows convert to invite emails per-carrera as expansion proceeds (D11); the waitlist table itself is a PART 8 addition flagged in this part's summary. Public content remains fully readable all along — the beta gates *writing and downloading*, not reading.

**State B — open registration (post-gate: ≥40% week-2 return, ≥30 posts/week).** `/registro` becomes the S1 form of 6.1 directly, same 3-screen flow. Invite links persist as a growth channel ("Invitá a alguien de tu carrera" in Ajustes, P2 surfacing) and as an attribution signal, no longer as a gate. The switch is a single config flag; both states must be built at MVP because the beta *is* the MVP's first deployment. **[HUMAN DECISION]** — the founder flips the flag on the D11 gate, and may re-close registration under abuse pressure (the flag is reversible by design).

---

# PART 7 — INFORMATION ARCHITECTURE

## 7.1 Decision: three page types, one movement

The IA has exactly three content page types (feed, materia, recurso) plus their indexes, wired so brief §64's five products are one navigation gesture apart. The materia page is the joint where all five meet — if a surface cannot be reached from a materia page in one step, it does not belong in the IA.

The §64 movement, as concrete navigation:

| "…" (brief §64) | Surface | One step from |
|---|---|---|
| "¿Qué está pasando?" | `/` feed, Mis materias | anywhere (nav: Inicio) |
| "¿Qué se dice de mi materia?" | `/materias/[slug]` → Publicaciones | feed post's materia tag, 1 tap |
| "¿Qué recursos existen?" | same page → Recursos tab | adjacent tab, 1 tap |
| "¿Quién me puede ayudar?" | "Es una pregunta" post + comments | composer on the same page |
| "¿Qué pasó otros años?" | same URLs, older content; `/buscar`; `/archivo` (P3) | search box; resource "Año" filter |

Real time community, knowledge base, anonymous social network, resource library, and archive are thus the *same three pages* read at different time depths — which is why the product can feel like one place (§64) instead of five.

## 7.2 Brief §14 section-by-section evaluation

| Brief §14 section | Verdict | Where it lives | Phase |
|---|---|---|---|
| Home | Yes | `/` (feed) | MVP |
| Now | Yes, as feed tab | "Reciente" (`/reciente`) | MVP |
| Explore | Folded | `/materias` index + `/buscar` — no separate "Explorar" | MVP |
| Subjects | Yes | `/materias/[slug]` | MVP |
| Faculties | Yes, thin | `/facultades/[slug]` | MVP |
| Degree programs | Yes | `/carreras/[slug]` | MVP |
| Resources | Yes | `/recursos`, `/recursos/[publicId]` | MVP |
| Archive | Data yes, UI later | `/archivo`, `/archivo/[year]` | P3 |
| Search | Yes | `/buscar?q=` | MVP |
| Notifications | Yes, in-app | `/avisos` | MVP |
| Profile | Yes | `/u/[handle]` | MVP |
| Settings | Yes | `/ajustes` | MVP |
| Moderation | Yes | `/mod/*` | MVP |
| Authentication | Yes | `/ingresar`, `/registro`, `/recuperar`, `/invitacion/[code]` | MVP |

A dedicated "Explorar" hub is rejected: with one sede and ~14 carreras, the materias index plus search covers discovery; a fourth navigation concept would dilute the three that matter.

## 7.3 Desktop navigation tree

```
Header (persistent, one row, 5 slots — PART 17 layout, per §0.5-R19)
├── Wordmark "uca.net" → /
├── Buscar (inline search box) → /buscar?q=
├── [Publicar]  (primary button) → composer
├── Avisos (icon + unread count) → /avisos          [logged-in]
└── Cuenta (seudónimo menu)                         [logged-in]
    ├── "Mi perfil"   → /u/[handle]
    ├── "Ajustes"     → /ajustes
    ├── "Moderación"  → /mod/reportes               [role ≥ mod]
    └── "Salir"
    — logged-out, the slot renders "Ingresá" / "Crear cuenta"

Right rail (desktop only, ≥1024px — PART 17 §17.1)
├── "Explorar" block (permanent):
│    "Materias" → /materias · "Recursos" → /recursos ·
│    "Archivo" → /archivo (P3)
├── "Mis materias" (followed list, post counts)
├── Own carrera link → /carreras/[slug]
└── "Reciente" link

Footer (every page)
├── "Acerca de" · "Reglas" · "Términos" · "Privacidad"
└── "Sitio independiente hecho por estudiantes. Sin afiliación
     con la Universidad Católica Argentina."        (D8, verbatim)
```

No left rail at any breakpoint (PART 17 wins, §0.5-R19). Desktop reachability: the right rail's permanent "Explorar" block keeps `/materias` and `/recursos` one click away — via the rail on desktop, via the bottom bar and search on mobile. No "Tendencias"-style widgets in MVP: empty widgets advertise emptiness. Density comes from the feed itself.

## 7.4 Mobile navigation

Bottom bar, 5 fixed slots, labels + Lucide icons (no emoji, D8):

| Slot | Label | Route |
|---|---|---|
| 1 | "Inicio" | `/` |
| 2 | "Materias" | `/materias` |
| 3 | "Publicar" (center, emphasized) | composer |
| 4 | "Buscar" | `/buscar` |
| 5 | "Avisos" (unread badge) | `/avisos` |

Header on mobile shrinks to wordmark + seudónimo menu (perfil, ajustes, moderación, salir). "Recursos" is not a bottom-bar slot: mobile resource discovery routes through materias and search, which is how students actually look ("recursos *de mi materia*", not "recursos in the abstract"); `/recursos` stays reachable via materias pages and the right-rail "Explorar" block on desktop (7.3). Logged-out mobile: slots 3 and 5 render but tap into "Ingresá para publicar" / "Ingresá para ver tus avisos" prompts — the bar teaches the product's shape before registration.

## 7.5 Route table (D7, complete)

| Route | Purpose | Auth | Phase |
|---|---|---|---|
| `/` | Feed. Logged-in: tabs Mis materias (default) / Reciente. Logged-out: portada (7.7) | Public | MVP |
| `/reciente` | Chronological everything (also feed tab; durable standalone URL) | Public | MVP |
| `/materias` | Catalog index, grouped by facultad → carrera, with filter box | Public | MVP |
| `/materias/[slug]` | Materia page: header, follow, tabs Publicaciones / Recursos | Public | MVP |
| `/carreras/[slug]` | Plan de estudios grid + recent activity | Public | MVP |
| `/facultades/[slug]` | Facultad: carrera list (thin) | Public | MVP |
| `/p/[publicId]` | Post + comment thread (ignored slug suffix allowed) | Public | MVP |
| `/recursos` | Resource browse: filters materia/tipo/año, orders nuevo/votado/descargado | Public | MVP |
| `/recursos/[publicId]` | Resource metadata page; download gated (6.5) | Public read / auth download | MVP |
| `/recursos/subir` | Resource upload form (6.4) | Auth | MVP |
| `/u/[handle]` | Profile: seudónimo, karma, carrera (if set), signed content only. `noindex` | Public | MVP |
| `/buscar?q=` | FTS results grouped: materias, posts, recursos | Public | MVP |
| `/avisos` | Notification list | Auth | MVP |
| `/ajustes` | Cuenta (email, contraseña), seudónimo (rename + cooldown state), carrera/año, borrar cuenta | Auth | MVP |
| `/apelacion` | Structured appeal form: one appeal per mod decision (6.7, PART 11 §11.5.2) | Auth | MVP |
| `/mod/reportes` | Report queue (default mod landing) | mod/admin | MVP |
| `/mod/acciones` | Audit log browser | mod/admin | MVP |
| `/mod/usuarios` | User lookup: history, restrictions | mod/admin | MVP |
| `/archivo`, `/archivo/[year]` | Yearly archive: stats, milestones, notable threads | Public | P3 |
| `/acerca` | What uca.net is, who makes it, independence statement | Public | MVP |
| `/reglas` | Community rules, quoted by moderation | Public | MVP |
| `/terminos`, `/privacidad` | Legal **[LEGAL REVIEW]** | Public | MVP |
| `/ingresar` | Login | Public | MVP |
| `/recuperar` | Password reset request (D7, per §0.5-R23) | Public | MVP |
| `/registro` | State A: waitlist. State B: open registration (6.10) | Public | MVP |
| `/registro/continuar` | Post-confirmation onboarding steps S3–S4 (utility route, `noindex`) | Session | MVP |
| `/invitacion/[code]` | Invite landing = registration S1 | Public | MVP |

Auth-required routes hit logged-out → redirect to `/ingresar?volver=[path]`, and back after login. Unknown slugs → designed 404: "Esta página no existe. Buscá lo que necesitás:" + search box + materias link (a knowledge site's 404 is a search prompt, not a joke).

## 7.6 Empty states

Every major surface must be useful at zero content — the cold start makes empty states the *most seen* screens of the first months. Binding copy:

- **Materia, zero posts** (the §14-critical case — still a real page): header keeps plan facts (carrera, año, cuatrimestre — e.g. "Derecho Constitucional — Abogacía, 3er año, 1er cuatrimestre"), follower count, follow CTA, Recursos tab with its count visible. Publicaciones tab body: "Todavía nadie publicó sobre esta materia. ¿La estás cursando? Empezá vos: preguntá algo o contá cómo viene la cursada." + [Publicar en esta materia]. The page earns its SEO existence from catalog data alone.
- **Materia, zero recursos**: "No hay recursos todavía. Un resumen tuyo puede servirle a todas las cohortes que vienen. [Subí el primero]".
- **Feed, Mis materias, no follows** (skipped carrera in onboarding): "Tu feed se arma con las materias que seguís. [Elegir mi carrera] o [Explorar materias]". With follows but no posts yet: "Todavía no hay publicaciones en tus materias." + the user's materia list with resource counts + "Mientras tanto, mirá Reciente."
- **Reciente, empty** (only possible pre-beta): seeded content makes this unreachable by D11; if reached, "Acá va a aparecer todo lo que se publique. Sé la primera persona."
- **Carrera page**: never empty — the plan grid renders from seed data; the activity module shows "Sin actividad reciente en esta carrera." only.
- **Buscar, no results**: "No encontramos nada para «constitucionál». Probá con menos palabras o revisá la ortografía. También podés explorar las materias." (query echoed, materias linked).
- **Avisos, empty**: "No tenés avisos. Cuando alguien responda a tus publicaciones o comentarios, lo vas a ver acá."
- **Perfil propio, sin contenido**: "Todavía no publicaste nada. Lo que publiques con tu seudónimo va a aparecer acá. (Lo que publiques como Anónimo, no.)" — the empty state doubles as anonymity education.
- **Perfil ajeno, sin contenido**: "Sin publicaciones todavía."
- **`/mod/reportes`, empty**: "No hay reportes pendientes." + link "Ver últimas acciones" (`/mod/acciones`).
- **`/recursos` with filters, no matches**: "No hay recursos de este tipo todavía. [Quitar filtros] o [Subir un recurso]".

## 7.7 Logged-out surfaces

Policy (C16): everything content is readable logged-out; every *action* converts into a specific invitation naming its benefit; nothing pretends to be clickable and then scolds.

- **`/` logged-out — the portada.** Not a marketing page (brief §49): a compact value strip — "La comunidad estudiantil de la UCA Rosario. Anónima, independiente, hecha por estudiantes." + [Crear cuenta] [Ingresá] — followed immediately by the live Reciente feed (real product visible in the first viewport) and a facultad→carrera directory block for SEO and orientation. During beta, [Crear cuenta] → waitlist (6.10-A).
- **Materia/carrera/facultad pages**: fully rendered. "Seguir" → "Ingresá para seguir esta materia y armar tu feed."
- **`/p/[publicId]`**: thread fully readable, anonymous rendering identical to logged-in (aliases included). Comment box replaced by: "Ingresá para responder." Vote taps → "Ingresá para votar."
- **`/recursos/[publicId]`**: metadata public; download gated with the 6.5 modal.
- **`/u/[handle]`**: public but `noindex` (C16) — readable to humans who have the link, invisible to search engines.
- **`/buscar`**: fully public — search is the utility magnet's front door and must work for the Google-arriving visitor immediately.
- **`/avisos`, `/ajustes`, `/mod/*`, composer**: redirect to `/ingresar?volver=…` (mod routes 404 for non-mod authenticated users rather than revealing their existence — PART 10).
- **Legal + `/acerca`**: public, linked in every footer.

The logged-out experience is therefore the *same IA minus write actions* — one page tree, two permission skins, no separate marketing site to maintain, which is both the honest version of brief §50 and the cheapest.

---

DISSENT — none. One addition flagged rather than disputed: this part introduced a `waitlist` table (6.10-A) and the utility routes `/recuperar` and `/registro/continuar`; the spine and PART 8 have since absorbed them (D4 per §0.5-R22; D7 per §0.5-R23).
