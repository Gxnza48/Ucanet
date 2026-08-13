# PART 1 — EXECUTIVE PRODUCT VISION

> Bound by PART 0 (the spine). This part makes the thesis (D1) concrete: what the product is, what it becomes, why anyone opens it, and what it refuses to be.

## 1.1 What uca.net is

**Decision:** uca.net is the student layer of UCA Rosario — a pseudonymous community platform where every materia and carrera has a permanent public page that accumulates the live conversation of the current cohort and the study material of every cohort before it. It is one product, not five: forum, resource library, and archive are the same pages seen at different time horizons.

The official university publishes facts: fechas de finales, planes de estudio, aulas, resoluciones. uca.net hosts everything students actually need to say *around* those facts — the questions, warnings, resúmenes, experiences, and folklore that today evaporate inside closed WhatsApp groups and graduate with each cohort. The product's job is to give that layer a permanent, searchable, public home with a privacy model (accounts + pseudonyms + optional per-post anonymity, D3) that makes honest speech safe without making abuse free.

The initial world is deliberately small: 1 sede, 3 verified facultades, roughly 10–14 carreras, and a seedable catalog of 300–500 materias (see the UCA academic appendix). Small is the strategy, not the constraint: a platform where 30 students of Abogacía 2° año talk every day is alive; a platform where 3,000 students across ten universities post once a month is dead (brief §4, §57).

## 1.2 What uca.net becomes

**Decision:** the 10-year outcome is an institution of collective memory — the place where a 2036 ingresante can read what cursar Derecho Romano was like in 2027, download the resumen a 2029 student wrote, and ask their own question on the same page. We do not build "an archive feature" to get there; we operate a platform whose normal output *is* the archive (spine 0.1).

Three properties compound into that outcome, and every phase of the roadmap must strengthen at least one (D1):

1. **Utility compounds.** Every uploaded resumen and every answered question is permanently searchable at a durable URL (D7). Year 3's shelf is strictly bigger than year 1's, at zero marginal cost. The utility magnet gets stronger without anyone doing anything.
2. **Conversation renews.** Cohorts graduate but materias persist. Derecho Constitucional will be cursada by a new cohort every year for decades; the page outlives every participant. The unit of permanence is the materia page, the unit of activity is the post, the unit of community is the cohort (carrera × año).
3. **Memory accretes.** Public-by-default (C16) plus durable URLs plus soft-delete means history preserves itself — bounded by the deletion rights that beat preservation when they conflict (C6). The Archivo UI (P3) curates what already exists; it never resurrects what users removed.

**[HUMAN DECISION]** The founder must actually want an institution, not an exit. Several spine decisions (no engagement mechanics, no early monetization, deletion-over-preservation) trade short-term metrics for institutional character and are irreversible in spirit once the community forms around them.

### 1.2.1 Vision acceptance tests

The vision is falsifiable. Five checks, each with a date, each verifiable without interpretation; PART 24 instruments them and PART 28 schedules them:

1. **Utility test (beta, Nov 2026):** a logged-out visitor landing on a seeded materia page finds at least one downloadable resource and one readable thread — value with zero users online.
2. **Density test (week 2 of beta):** ≥40% of beta users return in week 2 and the beta cohort produces ≥30 organic posts/week (the D11 gate — expansion is blocked until it passes).
3. **Ambient-check test (mid-cuatrimestre 2027):** the median engaged cohort member's session is short (2–5 min) and frequent (≥3 days/week during cursada) — the §1.5 behavior exists, without any engagement mechanic pushing it.
4. **Permanence test (2028):** materia pages rank on page 1 of Google for at least 10 "resumen <materia> uca"-shaped queries, and ≥20% of new registrations arrive via search or deep links into SIEMPRE surfaces (§1.7.2 outer loop closing).
5. **Generational test (2029+):** content created ≥2 years earlier still receives downloads/views every exam window — proof that the archive works as lived utility, not as a museum.

Failing a test does not kill the project; it blocks the next expansion step until fixed. That discipline is what "institution, not startup" means operationally.

## 1.3 AHORA / SIEMPRE made concrete (brief §2)

**Decision:** the NOW/ALWAYS duality from brief §2 is implemented as two faces of the same objects — never as two products. Every surface in the product is classifiable as an AHORA surface (decaying relevance) or a SIEMPRE surface (compounding relevance), and the materia page is where they visibly meet.

| Surface | Dimension | Behavior over time |
|---|---|---|
| Feed "Mis materias" / "Reciente" | AHORA | Relevance decays in hours–days |
| Post "¿Qué entra en el 2° parcial?" | AHORA | Valuable this week, context later |
| Notifications | AHORA | Read once, done |
| Materia page — tab Publicaciones | AHORA→SIEMPRE | Live thread today, searchable experience next year |
| Materia page — tab Recursos | SIEMPRE | Every upload raises permanent value |
| Search | SIEMPRE | Queries the accumulated whole |
| Carrera page (plan de estudios grid) | SIEMPRE | Stable navigation skeleton |
| Archivo (P3) | SIEMPRE | Curated yearly memory |

Concrete consequences, all binding on later parts:

- **One composer feeds both dimensions.** A student writes "Subí mi resumen de Obligaciones, capítulos 1 a 8" in the same flow as "¿mañana hay clase?". The post decays; the attached resource compounds. PART 6 designs the flows so the composer routes naturally (post vs. recurso) without asking the user to understand our taxonomy.
- **AHORA surfaces are allowed to be quiet.** A feed with 4 posts today is honest, not broken. We never pad AHORA surfaces with recycled or algorithmic filler to simulate activity; instead, quiet feeds lean on SIEMPRE ("Recursos nuevos en tus materias" as a secondary block — PART 12).
- **SIEMPRE surfaces are never allowed to be empty.** A materia page with zero resources and zero posts still shows its plan de estudios position, correlativas context, and a call to be first: "Todavía no hay nada en esta materia. Sé la primera persona en subir un apunte." Seeding strategy (D11) exists precisely so flagship carreras never show this state at launch.
- **SEO belongs to SIEMPRE.** Posts and resources are indexable; the feed is not a landing surface for Google — materia pages are (PART 23). The query we win is "resumen derecho constitucional uca", and that query is won by permanence, not activity.
- **AHORA graduates into SIEMPRE with no archival action.** A thread stops being "current" only in the feed's sort order (`last_activity_at` decay); nothing moves, freezes, or gets re-filed. Next year's student reaches it through search or the materia page exactly where it always lived. This is why the archive can be "what normal operation leaves behind" (§1.2): there is no pipeline between the two dimensions to build, operate, or break — only surfaces that read the same data with different time windows.

## 1.4 The student layer (brief §3)

**Decision:** uca.net never replicates, mirrors, or "improves" official university functions. It hosts exclusively the community layer around them. This line is a hard product boundary, not a positioning slogan: features that cross it (grade tracking, inscripción tools, official announcements re-publishing) are rejected regardless of demand.

The pattern, in the product's own voice:

| Official layer (uca.edu.ar) | Student layer (uca.net) |
|---|---|
| "Turno de exámenes finales: 23/11 al 22/12." | "¿Alguien rindió Constitucional en el turno pasado? ¿Toman oral o escrito?" |
| "Derecho Constitucional — 3er año, 1er cuatrimestre, 4 hs semanales." | "¿Conviene cursarla junto con Procesal Penal o es demasiada carga?" |
| "Material de estudio disponible en el campus virtual." | "Hice un resumen de 70 páginas con todos los fallos. Lo subo por si le sirve a alguien." |
| "Inscripción a materias: 23 al 27 de febrero." | "¿Qué comisión de Obligaciones recomiendan? La de la mañana se llena en minutos." |

Two guardrails on this table:

- The brief's example "which professor would you recommend?" is the student layer at its most valuable **and its most legally dangerous** (C9). In MVP, teaching experiences live inside materia discussions under the community rules ("experiencias sí, ataques a personas no" — PART 11); there are no professor pages, no professor ratings, and professors are not modeled in the MVP schema. A structured professor-experience feature is Phase 3+, designed with counsel. **[LEGAL REVIEW]**
- Independence is stated on every page, permanently: "Sitio independiente hecho por estudiantes. Sin afiliación con la Universidad Católica Argentina." (D8). The student layer only works if nobody mistakes it for the institution it wraps — for trademark reasons (D10) and because honest speech requires certainty that the university is not the landlord.

### 1.4.1 Boundary tests

The line will be probed by feature requests for years. Pre-adjudicated verdicts, to be applied by analogy:

| Requested feature | Verdict | Reason |
|---|---|---|
| Calculadora de promedio / grade tracker | Reject | Replicates the student's relationship with official records; stores sensitive academic data we never want (brief §8) |
| Mirror of official announcements ("canal oficial UCA") | Reject | Makes us look like a channel of record; trademark/confusion exposure (C2); adds a correctness liability we cannot meet |
| Crowd-sourced fechas de parciales per materia | Allow as community content | Students telling students what a cátedra announced is the student layer itself; rendered as posts, never as an official-looking calendar |
| Inscripción alerts ("se abre la inscripción el 23/2") | Allow as community posts; no scraper | Community reminders are fine; an automated feed from uca.edu.ar is not (their site is a JS SPA, scraping is unreliable — see the UCA academic appendix, section E) |
| Campus virtual / Office 365 integration | Reject | Couples us to official systems technically and legally; violates independence and P8 |
| Hosting cátedra-official programas (PDF programs) | Allow with care | Factual public documents aid the utility magnet; takedown flow must cover them **[LEGAL REVIEW]** |

One non-user stakeholder shapes this boundary: **the university itself will read the site.** Assume from day 1 that decanos, docentes, and the legal department are among the logged-out readers — probably within weeks of any visible traction. This changes nothing about what students may say (the rules already ban attacks on persons, PART 11) and everything about how the platform must carry itself: the independence disclaimer everywhere (D8), no trademark provocation (D10), legal pages that read as professionally drafted (C15), and a takedown/contact channel that works before anyone needs it. The goal is that the university's first formal contact — if it ever comes — finds a project that is unmistakably careful, independent, and lawful, because that posture is what converts "shut it down" energy into "tolerate it" reality. **[LEGAL REVIEW]**

## 1.5 Why a student opens it — the §65 answer, elaborated

**Decision (from spine 0.1, binding):** we do not promise daily use by everyone. The engineered behavior is the **2-minute ambient check**: "¿Qué se dice hoy en mi carrera?" — daily for engaged cohort members during cursada, weekly for the rest, with heavy spikes at exam windows. Three mechanisms make that check reliably worth it.

### 1.5.1 Cohort density, not platform density

The default feed is "Mis materias" — the 4–6 materias a student actually cursa plus their carrera's activity. This means the denominator of "does this feel alive?" is a cohort of perhaps 30–120 students, not the whole university. Napkin math that the design depends on: if 30 students of one cohort each post or comment twice a week, the cohort feed shows ~8–9 new items per day — enough for a rewarding 2-minute check. The whole platform can have 150 users and still *feel* dense to every one of them, provided users cluster by cohort. This is why launch is carrera-by-carrera with seed sprints (D11) and never a broadcast to the whole university: 500 scattered users would feel emptier than 50 concentrated ones.

### 1.5.2 Calendar awareness

Usage follows the academic calendar, and the product cooperates instead of fighting it (C14). The verified 2026 rhythm (UCA academic appendix, section D): cursada marzo–junio and agosto–noviembre; three turnos de finales (feb–mar, jun/jul–ago, nov–dic); parciales clustered mid-cuatrimestre; January–February near-dead. Consequences already fixed in the spine: public launch aligned to a cuatrimestre start (March 2027, D12); beta during a finales window when utility demand peaks; metrics judged against the calendar (a 60% traffic drop in July is winter recess, not churn — PART 24 must seasonally adjust every retention number); seed-content sprints timed before parciales. The calendar is also the honest answer to "why return tomorrow": tomorrow there is a clase, a parcial approaching, an inscripción closing — university life itself generates the recurrence; we only have to be where it gets discussed.

The expected annual usage curve and the product's posture in each period (binding on PART 12 ranking weights, PART 24 metric interpretation, PART 28 timing, PART 30 growth pushes):

| Period (verified 2026 dates) | Expected usage mode | Product posture |
|---|---|---|
| Feb–early Mar (finales feb–mar: 2/2–4/3) | Utility spike: search + downloads | Storage egress watch **[FREE-TIER RISK]**; no feature launches |
| Early Mar (inicio cursada 9/3; ingresantes 16–17/3) | Registration wave, ingresante influx | Launch/expansion window; seed 1er año hardest; QR posters up |
| Mid-cuatrimestre (Apr–May, Sep–Oct) | Steady ambient checks + parciales bursts | Baseline period — retention is measured here, nowhere else |
| Jun (recuperatorios 1–12/6, fin cursada 19–26/6) | Conversation peak: exam anxiety threads | Moderation attention peak; answer-rate matters most now |
| Jun–Ago (finales: 22/6–5/8; receso 27–31/7) | Utility spike, then trough | Uploads push ("Subí lo que te sirvió") right after finales |
| Ago (inicio 2C: 3–10/8) | Second registration wave | Second expansion window each year |
| Nov–Dic (fin cursada 19/11; finales 23/11–22/12) | Year's biggest utility spike | Year-in-review / Archivo material accrues (P3) |
| Ene–Feb | Near-dead (curso de verano only: 12/1–6/2) | Maintenance window; zero growth spend; keepalive cron matters (C7) |

### 1.5.3 The honest engagement ceiling

**Considered:** streaks, daily digests with FOMO framing, badges, "X está escribiendo", unread counters engineered for anxiety.
**Chosen:** none of them. The ceiling is the ambient check plus event-driven returns (someone replied to you; a parcial is near).
**Why:** the same brief that asks for daily use prohibits the mechanics that manufacture it (§11 "do not over-gamify", §46 "timeless"). An institution earns visits by being useful; a growth product extracts them. The 10-year vision survives only on the first path (C3).
**Cost:** DAU will look mediocre next to any engagement-optimized benchmark, and the founder must hold this line when growth stalls. We accept a DAU/MAU on the order of 0.2–0.35 during cursada as success, not failure. PART 24 defines success metrics accordingly.

## 1.6 One coherent place — the §64 mental model

**Decision:** the five conceptual products of brief §64 (real-time community + knowledge base + anonymous social network + resource library + historical archive) are implemented as **one navigation loop over one object graph**, centered on the materia page. A user moves through the whole ecosystem without ever changing "app".

The natural movement, mapped to real routes (D7):

1. **"¿Qué está pasando?"** → `/` (feed "Mis materias") or `/reciente`. Sees: "Recuperatorio de Estadística confirmado para el jueves" posted 2 hours ago by `ContadorAnsioso`.
2. **"¿Qué se dice de mi materia?"** → one tap on the post's materia tag → `/materias/estadistica` tab Publicaciones. Sees this thread plus every other current discussion of the materia.
3. **"¿Qué recursos hay?"** → adjacent tab on the same page → Recursos. Sees "Resumen Estadística — unidades 1 a 6 (2025)" with 43 descargas and 12 votes.
4. **"¿Quién me puede ayudar?"** → asks in place: "Publicá" on the materia page, optionally "como Anónimo". The question lands simultaneously in the materia page and in cohort feeds — asking help and feeding the feed are the same act.
5. **"¿Qué pasó otros años?"** → `/buscar?q=recuperatorio+estadistica` surfaces 2026's identical panic thread and how it resolved; later, `/archivo/2026` (P3) curates the year. History is one query away from any current worry.

The coherence rule that later parts must respect: **every content object carries its academic coordinates** (materia → carrera → facultad), and those coordinates are always rendered as links. That single invariant is what makes the five products feel like one place — from any post you can reach its materia; from any materia its carrera, its resources, its history. There is no "forum section" and "library section"; there are academic places, each with a present tense and a past tense.

### 1.6.1 The same loop, logged out

The movement must survive removing the account (brief §50), because most first visits are logged-out (persona 3.5, and every SEO landing). Steps 2, 3 and 5 work identically logged-out: materia pages, resources, threads, and search are fully readable (C16). Step 1 degrades gracefully: `/` for a logged-out visitor is not a marketing page but the live product — "Reciente" plus the materia directory — so the site demonstrates itself (brief §49–50; PART 6 designs the exact layout). Step 4 is the conversion moment: acting (publicar, seguir, subir) asks for an account with a one-line explanation of the identity model, not a generic signup wall: "Creá tu cuenta con seudónimo. Nadie ve tu nombre real." The rule for later parts: **reading never requires an account; acting always does.** No teaser truncation, no "registrate para seguir leyendo" — dark patterns against Tomás are dark patterns against the SEO strategy too.

## 1.7 The product loop (brief §39)

**Decision:** the core loop is utility-first with a conversational inner loop and a generational outer loop. The brief's proposed loop is kept as the inner loop but demoted from entry point: it describes how retained users behave, not how users arrive.

### 1.7.1 The brief's proposed loop, evaluated

The brief proposes: enters → sees activity → finds useful info → comments → gets response → follows subject → posts → gets interaction → returns. Two structural weaknesses:

1. **The entry assumes density.** "Sees current activity" fails exactly when we need it most: at N < 500 users, the feed will often be quiet, and a first visit that opens on a quiet feed converts nobody. The loop cannot bootstrap itself — this is the cold-start problem restated, not solved (brief §37 itself points at the fix: resources + subject pages + searchable content).
2. **The closure depends on someone else.** "Receives response → returns" makes retention hostage to answer rates that a small community cannot guarantee. If the loop's payoff requires another human to show up within hours, every unanswered question is a churn event.

### 1.7.2 The chosen loop

**Considered:** (a) the brief's conversation-first loop; (b) a content-consumption loop (feed-first, ranking-optimized); (c) a utility-first double loop.
**Chosen:** (c), as follows.

**Entry (works at zero concurrency):** a student has a concrete academic need — a parcial in 10 days, a materia to choose, an apunte missing. They arrive via a Google result on a materia page ("resumen contratos uca"), or a deep link shared in a WhatsApp group. They get real value logged-out: the resource is visible, the old thread is readable. No other user needs to be online.

**Conversion:** claiming durable value requires an account — follow the materia, ask the question, upload in return. Registration is invite-gated in beta (D3), open later; onboarding is under 2 minutes (pseudonym → carrera → materias, PART 6).

**Inner loop (the brief's loop, now safe):** follows materias → default feed becomes "Mis materias" → ambient check habit forms → posts/comments (optionally "como Anónimo") → notifications of replies pull them back. Because the user was *already* retained by utility, an unanswered question no longer breaks retention — conversation is the upside, not the precondition.

**Outer loop (generational, the institution's engine):** consuming utility creates the occasion to produce it. The crammer who downloaded three resúmenes in November uploads their own in December; that upload is the entry point for next year's crammer. Each cohort's output is the next cohort's magnet. This loop closes over years, not sessions — it is why permanence (durable URLs, public-by-default, SEO) is load-bearing product strategy and not an ideology.

**Why:** (a) is fragile at small N as shown; (b) optimizes attention over usefulness and collides with §46/§11 and the no-engagement-theater principle; (c) is the only loop whose entry point works on launch day with 0 users online and whose payoff strengthens every year.
**Cost:** utility-first means the unglamorous work — catalog seeding, 80–150 quality resources before beta (D11), SEO plumbing — is on the critical path, and visible "social" liveliness arrives later than a feed-first launch would deliver. We accept the slower social ignition in exchange for a floor under every visit.

### 1.7.3 Instrumenting the loop

Each loop stage has one measurable checkpoint, so a broken loop is diagnosable at the stage that broke (PART 24 owns collection; the `events` table in D4 carries these without per-user tracking):

| Loop stage | Checkpoint | Healthy signal (first cursada after launch) |
|---|---|---|
| Entry | Sessions landing on materia/resource pages from search or external links | Rising share of total sessions; ≥20% by 2028 (test 4, §1.2.1) |
| Value logged-out | Resource downloads + thread reads by anonymous visitors | Nonzero every week including quiet ones |
| Conversion | Registrations per 100 logged-out sessions on SIEMPRE surfaces | Trend, not target, in year 1; invite-gated during beta |
| Habit | % of registered users following ≥3 materias; return days/week during cursada | ≥70% follow ≥3 (onboarding does this); ≥3 days/week for the engaged cohort segment |
| Contribution | Posts+comments per active user per week; % of content posted "como Anónimo" | ≥2/week in seeded cohorts; anonymity share watched, not targeted |
| Outer loop | Uploads arriving in the 3 weeks after each finales turno | Visible post-finales bump by the second turno after launch |

Two anti-metrics, deliberately not goals: time-on-site (a 2-minute rewarding check is success — longer can mean worse, P6) and raw DAU (cohort-level activity is the unit that matters, §1.5.1).

## 1.8 Culture: grown, not manufactured (brief §12)

**Decision:** the platform provides the substrate for culture — pseudonyms with local flavor, permanence, and a curated memory — and otherwise stays out of the way. We do not seed memes, invent traditions, or schedule "community events" at launch.

What we do build: an optional es-AR pseudonym suggester at onboarding (`MateConBizcochos`, `FiscalDelTercerPiso` — D3) that tilts identity toward playful-local rather than gamertag-generic; durable URLs so a legendary thread can *become* legendary (culture requires citability); and, in P3, human curation of the Archivo so the community's own milestones are kept, not manufactured. What we refuse: official memes in product copy, "community awards" before the community exists, and any tone in UI text that performs personality the users have not yet created. The product's voice stays sober (D8); the users supply the color. If by 2029 there are recurring jokes, famous pseudonyms, and a thread every ingresante gets linked to, culture worked; if we shipped those things ourselves in 2027, we prevented it.

## 1.9 What uca.net is NOT

Each negative is a decision with an owner elsewhere in the plan:

- **Not official, and never ambiguous about it.** No university branding, no implied endorsement, permanent independence disclaimer (D8, D10). We do not republish official communications as if we were a channel of record; we link and discuss. **[LEGAL REVIEW]** (naming, trademark — C2).
- **Not Instagram.** No image-first feed, no stories, no follower counts as status, no identity performance. Pseudonymity inverts Instagram's core mechanic: status here accrues to usefulness (karma, quietly), not to self-presentation. Avatars are not even in MVP (D2) — identity is text-first.
- **Not a marketplace-first product.** Resources are free in MVP and for the foreseeable phases; no payments tables, no prices, no seller identities exist in the launch schema beyond a dormant `price_cents` column (C11). If a marketplace ever ships (P4+), it will be a feature *inside* an established community, never the reason the community exists. Every paywall shrinks the utility magnet that everything else depends on.
- **Not WhatsApp, and not trying to be.** Private student messaging is WhatsApp's, permanently: no DMs, no chat, actively excluded rather than deferred (C12). uca.net is the public, searchable, cross-cohort complement — the place WhatsApp groups link *to*.
- **Not Reddit-in-Spanish.** No generic communities, no infinite topical sprawl; the academic catalog is the structure. And no downvotes (C10) — the mechanic that most defines Reddit's texture is the one a 200-person community can least afford.
- **Not an engagement machine.** No streaks, badges, leaderboards, opaque ranking, or notification bait (spine 0.1, C3). The feed is explainable in one sentence.
- **Not a permanent record of everyone's worst moment.** Deletion beats preservation (C6). Users can leave, and take their words with them.

---

# PART 2 — PRODUCT PRINCIPLES

> Twelve principles, each derived from the spine and the brief, each stated as a testable rule. When a future decision is contested, it gets argued against these — and each principle below shows one decision it already settles. Principles do not override the spine; they generalize it.

**How the principles are enforced, mechanically:** every entry in `docs/decisions.md` (required for new dependencies by D14.8, and used for product decisions by convention) names the principles it leans on or bends; a decision that cannot cite a principle is presumptively wrong. For AI-assisted development this matters doubly — these twelve statements are part of the standing context given to coding tools (PART 26), so the tools inherit the product's judgment, not just its schema. A principle changes only by editing this part with founder sign-off. **[HUMAN DECISION]**

## P1. Utility recruits, conversation retains, permanence compounds

**Statement:** every feature must strengthen at least one of the utility magnet, the cohort conversation, or permanence; a feature that strengthens none is cut regardless of appeal (D1).
**Why:** these are the three compounding assets of the institution; everything else is decoration. The triad also sequences investment: utility is the entry point (works at N=0), conversation is the habit, permanence is the moat.
**Settles:** polls are out of MVP (fun, but strengthen none of the three at our scale — P2 phase); resource upload + search are in even though they are the slowest features to build.

## P2. The cohort is the unit of density

**Statement:** design for the density of a carrera-año cohort (30–120 students), never for platform-wide aggregates; expand territory only cohort by cohort, each with its own seed sprint (brief §4, §57; D11).
**Why:** felt aliveness is local. 30 active students in one cohort beat 3,000 scattered ones; breadth without density is the standard death of campus networks.
**Settles:** launch is one carrera in closed beta, not the whole university; multi-university support is architecture-only (a `universidades` table) with zero product surface until UCA Rosario is dense.

## P3. The interface exists to expose information

**Statement:** every screen is judged by how much useful information it surfaces per viewport at full readability; decoration that displaces information is a defect (brief §5, §25, §47; D8).
**Why:** the knowledge-web tradition (Wikipedia-adjacent, not Wikipedia-cloned) is the only visual language that plausibly survives to 2036 and the only one that matches an information product's job.
**Settles:** feed items are compact list rows with inline metadata, not cards; no hero section anywhere; component libraries rejected (D6) because their aesthetic defaults fight this principle.

## P4. Anonymity for the community, accountability for the system

**Statement:** every public act may hide the author from readers; no act ever hides the author from the system. Internal authorship, rate limits, and moderation reach are identical for anonymous and signed content (brief §7, §8; D3).
**Why:** anonymity's value is honest speech, not impunity. The account behind every anonymous post is what keeps the freedom affordable.
**Settles:** per-thread anonymous aliases ("Anónimo 1", "Anónimo 2") keep conversations coherent without cross-thread linkability; anonymous posts expose zero author fields (no karma, age, or avatar), closing the C5 leak.

## P5. The calendar is the algorithm

**Statement:** the academic calendar — cuatrimestres, parciales, three turnos de finales, summer death — drives ranking weight, launch timing, seed sprints, notification tempo, and metric interpretation; we never deploy an engagement algorithm to fight it (C14; spine 0.1).
**Why:** university life already generates recurrence; a product that surfs the calendar gets returns for free, and a product that fights it (padding the summer, punishing exam-season absence) reads as desperate.
**Settles:** public launch is March 2027 with the cuatrimestre, not "when it's done" (D12); July retention drops are reported as seasonal, not churn (PART 24).

## P6. No engagement theater

**Statement:** no streaks, badges, levels, leaderboards, follower-count displays, unread-anxiety mechanics, or opaque ranking; karma is a single quiet number; notifications only for events the user genuinely wants (C3, C10; brief §11, §17, §46).
**Why:** engagement mechanics are a loan against trust, repaid with the product's institutional character. A 10-year platform cannot service that loan.
**Settles:** downvotes are out (chill new posters, enable brigading at small N); the feed has exactly two explainable tabs ("Mis materias", "Reciente") instead of "Para vos".

## P7. Public by default, personal never

**Statement:** everything users publish is public, readable logged-out, and (except profiles) indexable; everything about the person — email, identity, authorship of anonymous content, votes, moderation metadata — never leaves the system (C16; brief §8, §29).
**Why:** 2036 can only discover 2026 if 2026 is public; and students only speak freely if the person behind the pseudonym is unreachable. Both halves are load-bearing; visibility tiers in between are complexity we refuse.
**Settles:** no friends-only or private post type exists in MVP at all; onboarding states it plainly: "Todo lo que publicás es público. Tu identidad real, nunca."

## P8. Boring technology, portable data

**Statement:** prefer the boring, documented, exit-friendly option at every technical fork: Postgres over search engines, SQL migrations over ORMs, server rendering over client state, plain files over proprietary formats; every dependency must name its exit path (brief §58, §62; D6, D13).
**Why:** the product must outlive its stack (brief §58). Ten years is 3–5 framework generations; only the data and URLs must survive all of them.
**Settles:** Postgres FTS instead of Elasticsearch for search v1; weekly tested `pg_dump` + storage export from day 1 — the migration plan is a script, not a promise.

## P9. Every feature ships with its moderation surface

**Statement:** a feature is not done until its content can be reported, removed, and audited, and until its abuse case has a named mitigation; this is a definition-of-done item, not a fast-follow (D14.10; brief §18, §19, §53).
**Why:** in an anonymous community, moderation debt compounds faster than technical debt, and the real scaling wall is moderation labor (C13).
**Settles:** resources ship in the same phase as resource reporting and the mod queue (S2/S3 ordering in D12); DMs stay excluded partly because their moderation surface is economically impossible for us (C12).

## P10. The name is portable

**Statement:** the product's identity must survive a forced rename: name in one config constant plus one wordmark asset, no name baked into durable content, no legal exposure accepted for brand attachment (C2, D10).
**Why:** "uca" is the university's mark and the domain is unverified; the naming risk is launch-blocking and outside our control. The institution is the community and its memory, not the string.
**Settles:** no watermarks on user PDFs before naming resolves; the wordmark is typographic so a rename is a one-day change. **[HUMAN DECISION]** **[LEGAL REVIEW]** (naming resolution before public launch).

## P11. Culture is grown, not manufactured

**Statement:** the platform supplies substrate for culture — playful-local pseudonyms, citable permanence, curated memory — and never performs the community's personality for it (brief §12; §1.8 above).
**Why:** manufactured culture reads as marketing and crowds out the real thing; organic culture is the strongest retention asset an institution can have, and it cannot be shipped.
**Settles:** no seeded memes or "community awards" at launch; product copy stays sober while user content supplies the color; the Archivo curates what happened rather than staging it.

## P12. The person outranks the archive

**Statement:** when preservation and a person's rights conflict, the person wins: deletion is real, the archive is what remains (not a snapshot that resurrects removed content), and the ToS promises preservation of nothing (C6; brief §13, §31; Ley 25.326).
**Why:** legal floor (habeas data) and ethical floor coincide; an archive built on trapped users poisons the trust that generates the archive in the first place.
**Settles:** account deletion offers "borrar mis publicaciones" or "conservarlas como usuario eliminado" (D3); archive snapshots are never frozen copies of live content. **[LEGAL REVIEW]** (retention and deletion policy text).

## When principles collide

Most future disputes will be collisions between two valid principles, not violations of one. The recurring collisions are pre-adjudicated here; anything novel goes to the founder with the colliding principles named. **[HUMAN DECISION]** for any precedence change.

- **P12 beats P7.** Deletion beats public permanence, always and retroactively. A deleted post is gone from every public surface including search and any future Archivo, even if it was the community's most-cited thread. (Curated Archivo entries may *describe* that a milestone happened; they never republish removed content — C6.)
- **P4 beats P6-style minimalism when safety needs signal.** If moderation genuinely needs a trust signal (e.g., account-age gates on uploads to stop spam waves), we add it as an invisible system rule rather than a visible badge — accountability without gamification. The signal exists; the theater does not.
- **P9 beats P1 on sequencing.** A high-value feature whose moderation surface is not affordable ships later or never (DMs are the standing example, C12). Usefulness does not buy exemption from moderability.
- **P3 beats P11 in product chrome.** However much personality the community develops, UI copy stays sober; the color lives in user content. The interface never adopts the community's memes into its own chrome.
- **P2 beats growth pressure under P1.** When expansion (new carrera, new sede) competes with deepening a live cohort, density wins until the D11 gates pass. An empty shelf launched anywhere damages the brand of usefulness everywhere.
- **P8 beats performance micro-optimization.** We accept measurably slower-but-boring (Postgres FTS vs. a search service) until a real user-felt threshold is crossed, defined in PART 22 — not when a benchmark says so.

---

# PART 3 — USER PERSONAS

> Six personas grounded in verified UCA Rosario reality (carreras, planes, and calendar from the UCA academic appendix). Five are launch-relevant; one is explicitly future (brief §4: do not expand the audience prematurely). Personas are design instruments: each flow in PART 6 must name which persona it serves, and a feature that serves none of these six is suspect under P1.

## 3.0 Method and assumptions

Personas are composites built from three inputs: the verified academic structure (real carreras, materias, and calendar dates from the appendix — Julieta's Derecho Romano and Sofía's Derecho Penal (Parte Especial) are actual Plan 2013 materias), the behavioral segmentation the strategy depends on (consumer/regular/producer/lurker roles from §1.7), and the brief's own persona hints (§4, §37–38). Assumptions that shape them but are **unverified** — carried to PART 34's open-questions register:

- Cohort sizes of 30–120 students per carrera-año at UCA Rosario (no enrollment figures were obtainable; density math in §1.5.1 uses the low end deliberately).
- The 90-9-1 participation split (industry heuristic; our real curve replaces it once PART 24 measures it).
- WhatsApp as the universal per-cohort channel (asserted from common Argentine student practice, not surveyed) — load-bearing for the deep-link growth mechanics (D11), so the beta must confirm links shared into WhatsApp actually convert. **[HUMAN DECISION]** if it fails: the fallback distribution channel (Instagram stories of student centers vs. physical QR) changes the growth plan, not the product.

One rule of use: personas gate scope arguments, not just design ones. "Sofía would love X" is insufficient; the question is always "which persona is blocked without X, in which calendar period" — scope discipline is what keeps the D2 cut intact.

## 3.1 Julieta — ingresante, semana 1

> "¿Es normal no entender nada en Derecho Romano la primera semana, o soy yo?"

**Context:** 18, entered Abogacía in March; clases de ingresantes started 16–17 March, a week after everyone else. Knows 2 people at the facultad. Has the official plan de estudios PDF and a chaotic WhatsApp group of 80 ingresantes where every question scrolls away in minutes.
**Jobs to be done:** orient herself — what is each materia actually like, which apuntes matter, what is normal to be confused about; find out how people study 6 first-cuatrimestre materias at once; ask "dumb" questions without stamping them on her real name in week one.
**Entry point:** QR poster at the sede (Av. Pellegrini 3314) during the ingresante weeks, or a deep link to a materia page shared in the ingresantes WhatsApp group (D11 growth artifacts).
**What makes her return:** the carrera page as a map — her whole 1er año grid with real content behind each materia; threads from last year's ingresantes asking exactly her questions; the follow action making her feed instantly personal.
**What could scare her away:** hostility toward newcomers ("preguntá en el buscador" culture); fear that classmates identify her from a question — mitigated by "Publicá como Anónimo" and by onboarding copy that explains the identity model in one line; an empty 1er año shelf — which is why seed sprints target 1er año materias hardest (they have the most students and the least accumulated material).
**MVP features touched:** registration via invite, onboarding (pseudonym → carrera → materias), carrera page, materia follow, feed "Mis materias", anonymous posting, search.

## 3.2 Marcos — 2° año, the cohort regular

> "¿Al final el recuperatorio de Estadística es presencial o virtual? En el grupo nadie sabe nada."

**Context:** 20, Contador Público 2° año, cursando Estadística, Contabilidad para la Toma de Decisiones, Derecho Público and three more. In three WhatsApp groups per materia tier. Commutes 40 minutes; checks his phone with mate before class.
**Jobs to be done:** stay on top of the cohort's operational chatter — "¿el recuperatorio de Estadística es presencial?", "¿alguien entendió el TP 3?"; ask questions that outlast WhatsApp's scroll; feel the pulse of his carrera in 2 minutes.
**Entry point:** invited by a classmate during closed beta (his carrera is a candidate first cohort — **[HUMAN DECISION]** D11 says the founder's own carrera goes first).
**What makes him return:** the ambient check (§1.5) — his feed is his six materias and it moves daily during cursada; reply notifications; the mild satisfaction of his answers getting votes. Marcos is the persona the DAU ceiling is calibrated on: daily during cursada, near-absent in January.
**What could scare him away:** a ghost-town feed two weeks in a row (density failure — this is why beta gates on ≥30 organic posts/week before expanding, D11); realizing something he posted signed is being screenshotted into WhatsApp — mitigated by education at composer level ("Esto es público") and per-post anonymity for spicier questions.
**MVP features touched:** feed both tabs, posting (signed and anonymous), comments, votes, materia pages, notifications, reports (he will file the community's first spam report).

## 3.3 Sofía — la crammer de parciales

> "Rindo Penal en nueve días y recién hoy me entero de que toman los fallos. Necesito un resumen ya."

**Context:** 21, Abogacía 3er año, works part-time in a estudio jurídico. Invisible for weeks, then Derecho Penal (Parte Especial) has a parcial in 9 days and she needs everything: resúmenes, old parciales, "¿qué toma esta cátedra?".
**Jobs to be done:** find the best existing material for a specific materia fast; learn what the exam is actually like from people who took it; done in minutes, not browsing.
**Entry point:** Google — "resumen derecho penal parte especial uca" landing on the materia page (the SEO bet, P1/PART 23); or a resource deep link forwarded in her comisión's WhatsApp.
**What makes her return:** each exam window, three times a year (feb–mar, jun–ago, nov–dic turnos plus mid-cuatrimestre parciales) — calendar-driven recurrence, not habit (P5). Search that actually finds things. Over time, the outer loop (§1.7.2): after finals she has a pile of her own material, and uploading it costs one form.
**What could scare her away:** thin results — if her first search returns nothing, she never comes back, which is why coverage of flagship carreras' materias precedes any growth push (D11); download friction (signup walls before value — the logged-out experience must show real content, brief §50); junk uploads outranking good ones (upvotes + download counts are the v1 quality signal, C10).
**MVP features touched:** search, materia page tab Recursos, resource download, resource upload (post-exam conversion), votes; barely touches the feed.

## 3.4 Valentina — la reina del apunte

> "Mi resumen de Contabilidad anda dando vueltas por medio Rosario sin mi nombre. Prefiero subirlo yo y que quede claro de dónde salió."

**Context:** 22, Contador Público 4° año, the person whose resúmenes already circulate through three cohorts of WhatsApp with her name cropped off. Makes structured, beautiful material as her own study method.
**Jobs to be done:** give her work a permanent home with her authorship (pseudonymous) attached; see that it is used — downloads, votes, "me salvaste el final" comments; become quietly known for quality without performing an identity.
**Entry point:** personally recruited by the founder as one of the 5–10 seed accomplices (D11) — this persona *is* the seed strategy's engine.
**What makes her return:** the producer loop — download counts ticking up, votes, questions on her materias she can answer with authority; karma as a quiet, cumulative record (C10). Long-term, she is the persona a future marketplace would serve (C11) — but nothing in MVP monetizes her, deliberately: paywalls would shrink exactly the magnet she powers.
**What could scare her away:** her material re-uploaded by others without credit (report category + mod action cover it, PART 11); copyright anxiety — her resúmenes quote textbooks and fallos, and she needs the platform to have thought about this ( takedown flow + clear rules on derived academic work, PART 14/PART 11) **[LEGAL REVIEW]**; any hint that the platform will someday sell her free uploads (P12-adjacent trust; the ToS must be explicit that authors keep ownership).
**MVP features touched:** resource upload (the heaviest user), resource metadata (tipo, año, materia), profile page, karma, comments, notifications.

## 3.5 Tomás — el lurker

> "Leo todo, no escribo nada. Y así estoy perfecto."

**Context:** 19, Ingeniería Industrial 2° año. Reads everything, posts nothing, anywhere — mutes his WhatsApp groups and reads them at night. Statistically the majority: expect 80–90% of accounts to behave like Tomás (the 90-9-1 heuristic; PART 24 should verify our actual curve rather than fight it).
**Jobs to be done:** know what is going on without participating; benefit from resources and answered questions; zero social exposure.
**Entry point:** a shared link; stays logged-out for weeks (public-by-default serves him fully, C16) until following materias becomes worth an account.
**What makes him return:** the same ambient check as Marcos, minus the posting; search at exam time like Sofía. Tomás is why read-only value must be complete: every thread readable, every resource listable, no "regístrate para ver más" dark patterns.
**What could scare him away:** nothing scares him away — he defects silently if quality drops. The subtler risk is that we *never convert* him: his first-ever contribution will almost certainly be an upvote (one tap, no words) or an anonymous question (no identity risk). Both paths must be frictionless; per-post anonymity (D3) exists substantially for Tomás's first post.
**MVP features touched:** logged-out reading, search, then: registration, follows, feed, votes; eventually one anonymous question at 1 a.m. before a final.

## 3.6 Federico — alumni / tutor (FUTURE — not served by MVP)

> "Extraño la facu. Si alguien pregunta cómo es la mesa de Filosofía del Derecho, se lo cuento con gusto."

**Context:** 26, graduated Abogacía 2028, junior lawyer. Nostalgic for the community; would answer procedural questions ("¿cómo es la mesa de final con esta cátedra?") and might tutor for pay.
**Jobs to be done (future):** stay marginally connected; give back with low effort; find tutoring clients (a plausible P4+ marketplace vertical, alongside resources — C11).
**Status:** brief §4 is explicit — do not expand the audience prematurely, and the spine allocates him no features before P4. Nothing *blocks* him either: any-email registration (D3) means an alumnus can hold an account today as an ordinary user, and public content keeps him reachable. What is deferred is serving him: alumni flair, tutor listings, and any professor-adjacent participation are Phase 4+ questions, the last one with counsel **[LEGAL REVIEW]**.
**Design obligation now:** exactly one — do not make him structurally impossible (no schema assumption that every user has a current carrera/año; both are nullable in `profiles`, D4).

## 3.7 Anti-personas

Three users the product will attract and must be designed *against*. Each maps to concrete MVP defenses (PART 11 owns the full anti-abuse design); naming them here keeps persona-driven design honest — flows optimized for Julieta must not accidentally serve these three.

**El provocador.** A student (or ex-student) who reads "anónimo" as "gratis". Posts bait, harasses classmates, tests every limit in week one — anonymous communities always receive him early, and how visibly he loses determines the platform's culture for years. Defenses he meets: an account behind every anonymous act (P4), in-database rate limits (D5), reports on all content (D2), restrictions/bans that survive his anonymity, no DMs to take harassment private (C12), and no downvotes to weaponize (C10). Design rule: his failure must be boring — content removed, account restricted, no drama surface, no public shaming mechanics for him to farm.

**El vendedor externo.** Not a student: sells apuntes, cursos de apoyo, or services, and sees a dense student community as free advertising. Arrives the moment the platform is visibly alive. Defenses: invite-gated registration during beta (D3), spam report category, per-user upload quotas, and community rules that ban commercial promotion outside whatever future marketplace exists (PART 11). He is also the reason seller identity is a named future problem (D3): if selling ever becomes legitimate, it becomes accountable.

**El cazador de capturas.** Reads uca.net purely to screenshot it into WhatsApp — sometimes harmlessly (that is the outer loop working: deep links must render better than his screenshots, D11), sometimes to expose or mock a signed author. He cannot be blocked (public-by-default, C16); he must be defused by design: composer-level clarity that everything is public ("Esto es público"), per-post anonymity for anything sensitive (D3), and zero personal data anywhere to hunt (brief §8). The product's promise is not "nobody will see this" — it is "nobody can connect this to you unless you signed it."

## 3.8 Persona × MVP coverage

| MVP capability (D2) | Julieta | Marcos | Sofía | Valentina | Tomás |
|---|---|---|---|---|---|
| Logged-out reading / SEO landing | — | — | X | — | X |
| Invite registration + onboarding | X | X | X | X | X |
| Feed (Mis materias / Reciente) | X | X | — | X | X |
| Posts + comments | X | X | — | X | — |
| Anonymous publishing | X | X | — | — | X |
| Upvotes | X | X | X | X | X |
| Materia follow + materia pages | X | X | X | X | X |
| Carrera pages | X | — | — | — | — |
| Resource upload | — | — | X | X | — |
| Resource download | X | X | X | — | X |
| Search | X | — | X | — | X |
| Notifications | X | X | — | X | — |
| Reports | — | X | — | X | — |

Every MVP capability is load-bearing for at least two personas; nothing in the MVP serves zero personas, and no persona depends on anything cut in D2. Federico (future) intentionally has no column.

## Key product questions answered (brief §59)

Each answer is binding-consistent with the spine; where an answer summarizes a spine decision, the decision reference is given.

1. **What exactly is uca.net?** The student layer of UCA Rosario: a pseudonymous community where every materia and carrera has a permanent public page combining the current cohort's conversation (AHORA) with the accumulated resources and experiences of prior cohorts (SIEMPRE) (D1, §1.1).
2. **Why would a student use it every day?** Honestly: not every student will, and we refuse to force it (C3). The engineered behavior is a 2-minute ambient check of "¿qué se dice hoy en mi carrera?", made reliably rewarding by cohort-level density (§1.5.1) — daily for engaged cohort members during cursada.
3. **Why would they return?** Event-driven pulls (replies to their content, activity in followed materias), calendar-driven needs (parciales, finales, inscripciones — three turnos a year plus mid-cuatrimestre peaks), and the compounding usefulness of the shelf they helped build (§1.7.2).
4. **Different from WhatsApp groups?** WhatsApp is private, unsearchable, capped at your contacts, and its knowledge dies with each cohort's group. uca.net is public, searchable, cross-cohort, and permanent — the complement, not the competitor: WhatsApp groups are where uca.net links get shared (C12, D11).
5. **Different from Instagram?** Opposite mechanics: pseudonymity instead of identity performance, text instead of image, usefulness instead of attention, quiet karma instead of follower counts. No stories, no DMs, no self-presentation surface beyond a handle (§1.9).
6. **Different from Reddit?** Structure and density: the academic catalog (carrera → materia, plan de estudios) is the skeleton, not user-created topical sprawl; es-AR voice; first-class file resources; no downvotes (C10); and a single dense community instead of Reddit's empty-local-subreddit problem.
7. **Different from Discord?** Discord is realtime, invite-walled, and invisible to search engines — conversations evaporate operationally even if logged. uca.net is asynchronous, public, indexed, and permanent; we deliberately have no realtime at all (D2, D6).
8. **Different from official university systems?** They publish facts and records; we host the conversation around them, and we never replicate their functions (grades, inscripciones, official announcements) — hard boundary §1.4, with permanent independence disclaimer (D8).
9. **Minimum viable social graph?** Student → materia follows, plus profile → carrera membership. That is the entire MVP graph: no user-follows, no friends, no groups (D2). Cohort co-membership emerges from shared materia follows without any explicit social edge.
10. **Minimum viable academic graph?** `universidades → sedes → facultades → carreras → materias` plus `plan_materias` (año, cuatrimestre, plan version) (D4). Verified seed exists for 3 facultades, 8 verified carreras and two full planes (~110 materia slots) — see the UCA academic appendix. Professors are excluded from the MVP graph entirely (C9).
11. **Strongest cold-start strategy?** Utility-first (§1.7): pre-seed the full catalog, load 80–150 genuinely good resources into one carrera before anyone arrives, then invite 20–50 students of that carrera during an exam window (D11). Value at zero concurrency; conversation ignites inside pre-existing usefulness.
12. **What content should be public?** Everything published: posts, comments, materia/carrera/facultad pages, resource metadata and files, profiles (profiles `noindex`) (C16). Public and indexable is what makes 2036-discovers-2026 possible.
13. **What should be private?** Everything about the person: email, real identity, authorship of anonymous content, individual votes, invites, moderation metadata, internal IDs (brief §8, D4/D5). There is deliberately no private *content* tier in MVP.
14. **What should be anonymous?** Anything the author chooses, per post/comment/resource, via the "como Anónimo" flag — with zero author fields exposed and per-thread aliases for coherence (D3).
15. **What should never be anonymous?** The system's knowledge of authorship (always retained), moderation actions on your content (you always know), mod/admin roles when acting officially, and — if a marketplace ever exists — sellers (D3).
16. **How do we prevent toxicity?** Accountability under anonymity (P4): every anonymous act traces to an account subject to rate limits, restrictions, and bans; reports + mod panel ship in MVP (D2); no downvotes and no DMs remove the two cheapest harassment channels (C10, C12); community rules exist at launch (C15); moderator recruitment is a growth-phase deliverable with feature-level priority (C13).
17. **How do we preserve valuable history?** By default: public-by-default content at durable URLs with soft-delete (C16, D7). By curation: yearly Archivo (P3) of milestones and aggregates. Bounded by P12 — deletion wins over preservation, always (C6).
18. **How do we remain within free infrastructure?** Caps and restraint: ≤10 MB files with per-user quotas, no realtime, Postgres FTS instead of search infra, SSR caching, minimal analytics — plus quota telemetry and a pre-decided USD 25/mo Supabase Pro trigger at 70% of storage/egress two months running (D13). **[FREE-TIER RISK]**
19. **What breaks first at 1,000 users?** Not infrastructure — moderation labor (founder + 1–2 students, C13) and, at exam-window spikes, storage egress from PDF downloads (~5 GB/mo free cap; one 8 MB resumen downloaded 600 times in a parciales week exceeds it alone). **[FREE-TIER RISK]**
20. **What breaks first at 10,000?** Supabase Free definitively (500 MB DB and egress both exceeded → Pro is mandatory, D13); founder-as-moderator is impossible (mods per facultad required); feed and search queries need the indexing/caching attention PART 21–22 reserve; and 10,000 exceeds UCA Rosario alone — it implies multi-sede questions arriving early.
21. **What breaks first at 100,000?** The premise: 100,000 means many universities (PART 32's expansion scenario), so the binding constraints become governance, moderation federation, legal formalization (an entity, counsel, DMCA-like process), and paid infrastructure as a real budget line — before any hard technical wall, since vanilla Postgres with read replicas serves this scale.
22. **How do we migrate when free tiers no longer suffice?** First by paying (USD 25 + 20/mo — same architecture, zero migration); the true exit is rehearsed from day 1: weekly `pg_dump` + storage manifest to a second location, plain-SQL schema, no proprietary platform features, stable public IDs — restore tested, not promised (D13, P8).
23. **What is the first monetization opportunity?** Nothing at launch (Stage 0). The first opportunity is voluntary support (Stage 1) — donations/aporte voluntario with no feature gating, per PART 31, which owns the staging. Later, the first product candidate compatible with the identity is optional paid student resources with a platform fee (the C11 marketplace, P4+), which requires leaving Vercel Hobby first (C8) and real legal work (fees, AFIP, liability) **[LEGAL REVIEW]**.
24. **What should never be monetized?** Reading and search (the archive stays free forever), reach (no paid amplification of posts), privacy (no data sale, no ad targeting on personal data), moderation outcomes, and the anonymity mechanics themselves. Monetizing any of these liquidates the trust the institution runs on.
25. **What makes this worth maintaining for 10 years?** It compounds instead of depreciating: each cohort's output is the next cohort's utility (§1.7.2), costs are bounded (USD 0–45/mo for years, D13), the maintenance load of boring technology is low (P8), and every year of accumulated archive raises the replacement cost for any competitor — including the university itself. The founder's honest willingness to run an institution rather than flip a startup is the last dependency. **[HUMAN DECISION]**

## Handoffs — what this part binds elsewhere

Enumerable obligations this part places on other parts, for consistency auditing:

| Obligation | Bound part |
|---|---|
| Every user flow names the persona(s) it serves (3.0–3.6) | PART 6 |
| Logged-out `/` shows the live product, never a marketing page; reading never requires an account (§1.6.1) | PART 6, PART 7, PART 23 |
| Quiet AHORA surfaces fall back to SIEMPRE content, never to filler (§1.3) | PART 12 |
| Ranking weights follow the calendar-posture table (§1.5.2); no engagement algorithm | PART 12 |
| Target queries of the shape "resumen <materia> uca" drive the SEO plan (§1.3, test 4) | PART 23 |
| Vision acceptance tests 1–5 instrumented (§1.2.1); loop checkpoints collected (§1.7.3); time-on-site and raw DAU treated as anti-metrics; all retention numbers seasonally adjusted | PART 24 |
| Milestones scheduled against the calendar-posture table; expansion gated on §1.2.1 tests 1–2 | PART 28, PART 30 |
| WhatsApp deep-link conversion validated in beta; fallback channel decision if it fails (3.0) | PART 29, PART 30 |
| Anti-persona defenses (3.7) covered by moderation/anti-abuse design; "experiencias sí, ataques a personas no" rule drafted | PART 11 |
| Takedown/contact channel exists before launch; university-as-reader posture (§1.4.1) reflected in legal pages | PART 11, PART 34 [LEGAL REVIEW] |
| Unverified assumptions (cohort sizes, 90-9-1, WhatsApp universality) carried in the open-questions register | PART 34 |
