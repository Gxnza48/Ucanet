# PART 11 — MODERATION & ANTI-ABUSE

> Owns: moderation philosophy, the public "Reglas de la comunidad" v1, the report system, the mod panel, the action/escalation ladder, anti-abuse engineering, resource/file moderation (brief §54), the moderation load model, and public transparency. Satisfies brief §18, §19, the operational half of §53, and §54. Schema names referenced here (`reports`, `mod_actions`, `user_restrictions`, `anon_aliases`) are binding per spine D4; full DDL in PART 8.

## 11.1 Philosophy: pseudonymity with internal accountability

**Decision.** Moderation on this platform exists to defend the community's *usefulness* — the willingness of a student to ask a real question, upload a real resumen, and tell the truth about a cursada — not to enforce politeness for its own sake. The mechanism is spine D3: everyone is pseudonymous or anonymous *to the community*, and nobody is anonymous *to the platform*. Every rule we enforce is public in "Reglas de la comunidad" (`/reglas`); there are no secret rules.

Rationale, in three commitments:

1. **Accountability without identity (brief §53).** Every post, comment, and file — including content published as "Anónimo" — carries an internal `author_id` (D3). Rate limits, strikes, suspensions, and bans attach to the *account*, so anonymity gives freedom of expression, never freedom from consequence. We never solve an abuse problem by removing anonymity from the product; we solve it by acting on the account behind it.
2. **Usefulness is the test, not tone.** "Este profesor toma injusto, estudiá los fallos" is blunt and stays. "Fulana es una inútil, mírenla cómo se viste" is an attack on a person and goes. The moderation question is always: *does this content help a student navigate university life, or does it target a person or degrade the commons?* This keeps moderation predictable and defensible, and it is the operational answer to brief §53's freedom/toxicity trade-off: we protect speech about *experiences and things* aggressively, and speech about *named private persons* narrowly.
3. **Every rule public, every action logged.** All rules live at `/reglas` in plain es-AR. Every enforcement action is written to `mod_actions` with a public-facing reason and an internal note (D4), and the affected user is always notified — moderation of your content is one of the things that is *never* anonymous to you (D3). Institutions that last publish their laws; that is a 10-year-vision requirement, not a nicety.

What moderation is *not* here: it is not a growth tool, not a brand-safety function, and not a substitute for the university's formal complaint channels. When content alleges crimes by real people, our job is removal-and-redirect, not investigation (§11.2 Regla 4, §11.5).

## 11.2 Reglas de la comunidad v1

**Decision.** Twelve rules plus a preamble, written in es-AR voseo, published at `/reglas` from day 1 (spine C15a), versioned in the repo, and referenced by number in every moderation action ("Regla 4"). Each rule is one bold sentence plus a short clarification — a first-year student must be able to read the whole page in three minutes. **[LEGAL REVIEW]** — the full text below goes to counsel before launch, with Regla 4 and Regla 9 flagged as the highest-risk items (defamation, Ley 11.723; see the legal scan's items 3 and 4).

The v1 text (this is site content, therefore in Spanish):

> **Reglas de la comunidad**
>
> Acá podés hablar con libertad: con tu seudónimo o como Anónimo, nadie sabe quién sos. Pero el anonimato no es impunidad: el sistema sabe qué cuenta publicó cada cosa, y estas reglas se aplican a todas las cuentas por igual. Son las únicas reglas; no hay reglas secretas.
>
> **1. No publiques datos personales de otras personas.** Nombres junto a teléfonos, direcciones, mails, fotos privadas, capturas de chats con nombres visibles, cuentas de redes: nada que permita identificar o contactar a alguien que no lo eligió. Esto aplica a estudiantes, docentes y cualquier tercero. Es la regla que más rápido se modera.
>
> **2. No acoses ni hostigues.** Insistir sobre una persona, coordinar cargadas contra alguien, seguir a un usuario de hilo en hilo para atacarlo. Una crítica es una crítica; una campaña es acoso.
>
> **3. Nada de amenazas ni violencia.** Amenazas, incitación a la violencia o celebración del daño a una persona. Sin excepciones ni "era un chiste". Es remoción inmediata y casi siempre suspensión.
>
> **4. Contá tu experiencia; no ataques a personas.** Podés opinar con total libertad sobre cátedras, materias, parciales y formas de enseñar y de tomar examen: "las clases son un caos", "toma más difícil de lo que enseña", "recomiendo la comisión de la tarde". Lo que no podés hacer es (a) acusar a una persona con nombre y apellido de un delito o de una falta grave (coimas, acoso, discriminación) — si viviste o presenciaste algo así, denuncialo en los canales formales de la universidad o en la justicia, donde puede investigarse de verdad; acá solo expone a la comunidad y no ayuda a nadie —, (b) burlarte del aspecto, la vida privada o la persona en lugar de la cursada, o (c) publicar datos personales de docentes más allá del nombre y el cargo. Opinión sobre el trabajo: sí. Ataque a la persona o acusación de delito: no.
>
> **5. No hagas spam.** Publicaciones repetidas, cadenas, publicidad de terceros, links de referidos, promoción constante de tu propio emprendimiento. La autopromoción ocasional y relevante (tu resumen, tu grupo de estudio) está bien; el resto no.
>
> **6. No te hagas pasar por otro.** Ni por otra persona real, ni por una cátedra, ni por la universidad, ni por los moderadores. Los seudónimos son libres; la suplantación no.
>
> **7. Nada de contenido ilegal.** Contenido sexual de menores, venta de drogas, instrucciones para dañar a otros, o cualquier contenido cuya publicación sea un delito. Remoción inmediata, ban y, cuando corresponda, denuncia.
>
> **8. La compraventa va solo en Recursos, y solo de material de estudio.** No uses la plataforma para vender otra cosa (entradas, ropa, servicios), y nunca para fraude académico: comprar o vender parciales robados, hacer trabajos o tesis por encargo, o suplantar a alguien en un examen. Eso perjudica a todos los que cursan con vos.
>
> **9. Subí material que puedas compartir.** Tus resúmenes, tus apuntes, tus guías: bienvenidos. Libros escaneados, capítulos enteros, PDFs de editoriales o diapositivas completas de una cátedra: no, porque tienen derechos de autor y ponen en riesgo al sitio. Si un titular reclama, el material se baja y las infracciones repetidas suspenden tu cuenta (ver "Reclamos por derechos de autor" en /reglas).
>
> **10. Nada de contenido sexual explícito.** Este es un espacio de vida universitaria, no un sitio de adultos. El humor subido de tono sobrevive; la pornografía no.
>
> **11. No manipules los votos ni uses cuentas múltiples.** Votarte con otra cuenta, coordinar votos, crear cuentas para esquivar límites o suspensiones. El sistema lo detecta y las sanciones caen sobre todas las cuentas involucradas.
>
> **12. Respetá las decisiones de moderación.** Toda acción te llega con su motivo y podés apelarla una vez desde el aviso o en /apelacion; la revisa otra persona distinta de quien decidió. Lo que no podés hacer es evadir una suspensión con otra cuenta: eso convierte la suspensión en ban.
>
> Estas reglas pueden ajustarse; cada cambio se anuncia y queda registrado. Lo que era válido cuando lo publicaste no se sanciona retroactivamente, pero puede removerse si una regla nueva lo prohíbe.

Design notes on the two dangerous rules:

- **Regla 4 (professors)** is written against the legal scan's item 3: opinion about matters of public interest is strongly protected post-*Kimel* (art. 1771 CCyC requires real malice), while false factual assertions of crimes are the litigation trigger. The rule therefore draws the line exactly there — *opinion about the work: unlimited; factual accusation of crimes/grave misconduct against a named person: prohibited and redirected to formal channels*. This is simultaneously the legally safest line and an honest product position (an anonymous forum genuinely cannot adjudicate a coima accusation). It also implements spine C9's posture for the MVP era, where professor discussion happens inside materia pages, not on professor pages. **[LEGAL REVIEW]**: counsel must confirm (a) this line matches the removal-on-notice vs. court-order protocol (§11.5), (b) the wording creates no implied duty to investigate.
- **Regla 9 (copyright)** is written against Ley 11.723's lack of any private-copy exception (legal scan item 4): the rule steers uploads toward self-authored material in plain language and announces the repeat-infringer policy, both of which are the platform's main negligence defenses. **[LEGAL REVIEW]**.
- **"Misinformation"** (brief §18's category list) is deliberately *not* a rule. At cohort scale, wrong exam dates get corrected by classmates in minutes, and a "misinformation" rule invites unresolvable political disputes the platform has no capacity to referee. Fraud-shaped misinformation is already covered by Reglas 5, 6, and 8.

## 11.3 Report system

**Decision.** Reporting is a two-tap flow available on every post, comment, resource, and profile (D14 rule 10), writing to the `reports` table with a closed category enum, hard dedup per (target, reporter), and a guaranteed feedback notification to the reporter. **The enum below is normative; PART 8 must implement it verbatim.**

### 11.3.1 Categories

`report_categoria` enum — values chosen so a reporter can classify in one glance and so each maps to exactly one rule:

| Enum value | Label in UI (es-AR) | Regla | Notes |
|---|---|---|---|
| `spam` | "Spam o publicidad" | 5 | Highest expected volume |
| `acoso` | "Acoso u hostigamiento" | 2 | |
| `amenazas` | "Amenazas o violencia" | 3 | Priority category (§11.4.3) |
| `datos_personales` | "Datos personales de alguien" | 1 | Priority category |
| `ataque_persona` | "Ataque o acusación a una persona con nombre" | 4 | The professor/defamation channel |
| `suplantacion` | "Se hace pasar por otro" | 6 | |
| `contenido_ilegal` | "Contenido ilegal" | 7 | Priority category |
| `compraventa` | "Venta indebida o fraude académico" | 8 | Covers brief §18 "fraud" |
| `infraccion_autor` | "Infringe derechos de autor" | 9 | Detail field required; routes to §11.7.2 |
| `contenido_sexual` | "Contenido sexual explícito" | 10 | |
| `manipulacion` | "Votos manipulados o cuentas falsas" | 11 | Routes to anomaly review (§11.6.3) |
| `otro` | "Otro" | — | Detail field required |

Brief §18's "misinformation" and "inappropriate academic content" fold into `otro` and `compraventa`/`infraccion_autor` respectively, per §11.2's reasoning.

### 11.3.2 Report flow UX

Two taps from any content: the "···" overflow menu → "Reportar" → a single radio list of the 12 labels above → "Enviar reporte". An optional free-text detail field ("Contanos más (opcional)", ≤500 chars) is shown for all categories and **required** for `infraccion_autor`, `suplantacion`, and `otro` (a copyright claim without identifying the work, or an "other" without explanation, is unactionable). No login → the button routes to `/ingresar` with return; anonymous *reporting* does not exist — reports are always tied to the reporter's account internally (never shown to the reported user), because report-spam is itself an abuse vector we must rate-limit and audit. Confirmation state: "Recibimos tu reporte. Te vamos a avisar cuando lo revisemos."

### 11.3.3 Dedup and aggregation

- **Hard dedup:** unique constraint on (target, reporter_id) — re-reporting the same item shows "Ya reportaste esto. Está en revisión." and does not create a row.
- **Aggregation:** distinct reporters on the same target collapse into one queue item whose priority rises with reporter count (§11.4.1). The queue shows "3 reportes · 2 categorías".
- **Auto-close:** reports filed against content already removed or already actioned are auto-resolved as `resuelto_duplicado`, with the reporter still getting the outcome notification. This alone eliminates the biggest queue-noise source (pile-ons after a mod already acted).

### 11.3.4 Reporter feedback loop

Every report terminates in exactly one in-app notification to the reporter (type `reporte_resuelto`), sent when the queue item closes:

- Actioned: "Gracias por tu reporte. Revisamos el contenido y lo removimos por incumplir las Reglas de la comunidad."
- Not actioned: "Gracias por tu reporte. Revisamos el contenido y no encontramos un incumplimiento de las Reglas, así que lo dejamos como está."

No further detail (no sanction disclosure — sanctions are between the platform and the sanctioned account). The loop matters because reporting is volunteer labor: reporters who hear nothing stop reporting, and at our scale reports are ~100% of abuse detection. Reporters whose reports are repeatedly rejected (>80% rejection over ≥10 reports) get rate-limited harder (§11.6.2), not punished — some people are just trigger-happy.

## 11.4 Mod queue and panel v1

**Decision.** A minimal internal panel at `/mod/*` (route map per D7), server-rendered like the rest of the app, gated by `profiles.role IN ('mod','admin')` enforced in RLS and re-checked in every server action (never frontend-only, brief §20). No moderator ever touches the database directly (brief §18). Four screens, no more.

### 11.4.1 Screens

**S1 — Cola (`/mod`).** The default view: open queue items, one compact row each (content excerpt ≤140 chars, type icon, categoría(s), reporter count, age of oldest report, target materia/carrera for context). Sort: priority categories first (`amenazas`, `datos_personales`, `contenido_ilegal`), then by reporter count, then oldest first. Filters (query-param, no JS state): estado (abierto/resuelto), categoría, tipo de contenido (post/comentario/recurso/perfil), edad de cuenta del autor (<48h / resto). A header counter: "12 abiertos · el más viejo hace 26 h".

**S2 — Detalle (`/mod/reportes/[id]`).** One queue item: the full content rendered as users see it (including thread context for comments — parent post + siblings), the list of reports (categoría + detail text + reporter *account age and report-accuracy stat*, never reporter handle), and the **author block**: handle, account age, karma, carrera, prior `mod_actions` against them, active `user_restrictions`, count of their content removed in the last 90 days. Action buttons (§11.5) sit at the bottom with a required public-reason picker (rule number) and an optional internal note. For anonymous content, the author block is collapsed behind a "Ver autor" control — see 11.4.2.

**S3 — Historial de usuario (`/mod/usuarios/[handle]`).** Everything S2's author block shows, plus their full content list with per-item status. Entry point for pattern cases (serial harasser across many small reports).

**S4 — Registro y controles (`/mod/acciones`, admin-only `/mod/config`).** `/mod/acciones`: the append-only `mod_actions` log, filterable by moderator, action, date — this is how the founder audits mods and how appeals reviewers reconstruct decisions. `/mod/config` (admin = founder only): the content-flood circuit breaker switch (§11.6.5), the invite-gate toggle, and the Turnstile escalation toggle (§11.6.6).

No dashboards, charts, or bulk actions in v1. The quarterly transparency numbers (§11.9) come from SQL run by the founder, not from panel features.

### 11.4.2 What moderators see — and how that power is audited

**Moderators can see the internal authorship of anonymous content. This is stated openly** (in `/reglas` preamble: "el sistema sabe qué cuenta publicó cada cosa" — and expanded in the Política de Privacidad **[LEGAL REVIEW]**). It cannot be otherwise: the escalation ladder acts on accounts, repeat-abuse detection requires linking a user's anonymous and pseudonymous behavior, and a court order for authorship data (legal scan item 3) will arrive at the platform regardless of what the panel shows. Pretending mods can moderate account-blind would just push identity lookups into ad-hoc SQL — the least auditable channel possible.

The power is bounded and audited three ways:

1. **On-demand, not ambient.** In S2/S3, the author of *anonymous* content is hidden behind a "Ver autor" control. Clicking it writes an immutable `revelar_autor` row to `mod_actions` (moderator_id, target content, timestamp, open report id) — that row *is* the audit log; there is no separate table. Mods therefore reveal identity only when acting, and every reveal is attributable. Queue row excerpts (S1) never show anonymous authorship.
2. **Reviewed.** The founder reviews the reveal log monthly: any reveal without an associated open report or action is a conduct question for that mod. Two unjustified reveals → mod removal (§11.8.3).
3. **Never leaves the panel.** No export, no copy-author-handle affordance, and the `_public` views (D5) guarantee anonymous authorship cannot leak through any user-facing surface even if the app layer has bugs. A moderator who de-anonymizes a user *to the community* (in a comment, a chat, anywhere) is removed and banned — this is written into the mod onboarding agreement (§11.8.3).

Moderators can NOT see: emails, auth data, IPs/user-agents (that telemetry, where it exists at all per PART 10, is admin-only and court-order-shaped), reporter handles, or `/mod/config`.

### 11.4.3 SLA targets (founder-led team)

Targets, not promises — published internally, measured from oldest-open-report age (visible on S1):

| Class | Target during cuatrimestre | Target in recess (Jan–Feb, Jul) |
|---|---|---|
| Priority (`amenazas`, `datos_personales`, `contenido_ilegal`) | p50 < 2 h, p95 < 12 h | p95 < 24 h |
| `infraccion_autor` (copyright notices) | p95 < 72 h (§11.7.2) | p95 < 72 h |
| Everything else | p50 < 12 h, p95 < 48 h | p50 < 48 h |
| Apelaciones | p95 < 7 days | p95 < 14 days |

Priority categories additionally trigger an immediate email to the mod team via the existing Resend integration (D6) — the one place moderation gets a push channel while user notifications remain in-app-only (D2). If the p95 for "everything else" exceeds 72 h for two consecutive weeks during term, that is the recruitment trigger of §11.8.2 firing, not a prompt to work nights.

## 11.5 Actions, escalation ladder, and appeals

**Decision.** A closed action vocabulary (PART 8's `mod_action` enum, per spine §0.5-R5), applied as a ladder with mod discretion to skip rungs for severity; every action writes one immutable `mod_actions` row (target, action, rule number, public reason, internal note, actor); every sanction notifies the affected user with the reason and the appeal path.

### 11.5.1 The ladder

`mod_action` enum (PART 8's names, binding per spine §0.5-R5): `remover`, `restaurar`, `advertir`, `suspender`, `banear`, `desbanear`, `resolver_reporte`, `desestimar_reporte`, `retiro_legal`, `bloquear_hilo`, `revelar_autor`. Durations are not enum values: `suspender` writes a `user_restrictions` row with `until = now() + 7 días` or `+ 30 días` per the ladder below.

| Action | Effect | Typical trigger |
|---|---|---|
| `remover` | Content status → `eliminado_mod`; body hidden everywhere; URL shows "Removido por moderación (Regla N)" | First offense, most rules |
| `advertir` | Notification only; counts as a strike | Removal-worthy content plus a pattern starting |
| `suspender` (7 días) | `user_restrictions` row, `until = now() + 7 d`; can read, cannot post/comment/vote/upload/report | 2–3 strikes in 90 days, or single serious offense |
| `suspender` (30 días) | Same restriction, `until = now() + 30 d` | Reoffense after 7 d, or serious harassment |
| `banear` | Permanent restriction (`until` null); email hash retained to resist re-registration (PART 9) | Regla 3/7 violations, suspension evasion (Regla 12), 3rd major cycle |
| `desbanear` | Reverses a ban (admin; wrongful-ban repair) | |
| `restaurar` | Reverses a removal (appeal upheld or mod error) | |
| `resolver_reporte` | Closes queue item, action taken | |
| `desestimar_reporte` | Closes queue item, no action | |
| `retiro_legal` | Removal on a formal third-party legal notice (defamation path below, §11.7.2) | |
| `bloquear_hilo` | Thread lock — sets `posts.locked_at` (§11.6.4) | |
| `revelar_autor` | Audited author reveal for anonymous content (§11.4.2) — this action row *is* the audit log | |

Norms: removal accompanies every content-based sanction (we never suspend and leave the content up); severity skips rungs (`contenido_ilegal` → ban + removal in one step, plus preservation of evidence and denuncia where legally required **[LEGAL REVIEW]**); strikes age — actions older than 12 months don't count toward the ladder (people graduate from their first-year selves); all restrictions are revocable by admin (wrongful-ban repair must be possible).

Defamation-shaped complaints get a special path per the legal scan (items 2–3): content violating Regla 4 *on its face* (accusation of crime against a named person) is removed on report like anything else. Content that is lawful-looking opinion but subject of an external complaint (a professor's carta documento or habeas-data demand) is **not** auto-removed — under *Rodríguez* doctrine debatable-unlawfulness content requires a judicial order — but every such notice is logged with its date, reviewed against Regla 4 within 72 h, and answered; the paper trail is the defense. **[LEGAL REVIEW]**: counsel defines the remove-on-notice vs. await-order boundary before launch; suppression demands about *personal data* are handled as Ley 25.326 ARCO requests with statutory deadlines (5 business days), which usually means removal, not litigation posture.

### 11.5.2 Appeals

One appeal per action, within 30 days, via a single form — linked from the sanction notification and from `/apelacion`: the action being appealed (preselected) plus one field: "Contanos por qué creés que la decisión fue un error (máximo 1.000 caracteres)." Suspended and banned users can still access this form (restriction blocks participation, not due process). Review is by **someone other than the original actor**: a second mod, else the founder; while the team is just the founder, the founder re-reviews with the appeal text — imperfect, disclosed honestly in `/reglas` ("mientras el equipo sea chico, puede revisar la misma persona"). Outcomes: `restaurar` + sanction reversal, sanction reduced, or upheld ("La decisión se mantiene. Esta apelación es definitiva."). Appeal outcomes are recorded as `mod_actions` rows referencing the original action, so the upheld-rate in §11.9 is a one-query number.

### 11.5.3 User-facing notification copy (es-AR, normative examples)

- Removal: "Un moderador removió tu publicación por incumplir la Regla 4 de la comunidad (ataques a personas). Si creés que fue un error, podés apelar: /apelacion"
- Warning: "Recibiste una advertencia por incumplir la Regla 5 (spam). Leé las Reglas: las advertencias reiteradas pueden derivar en suspensión."
- Suspension: "Tu cuenta está suspendida por 7 días por incumplir la Regla 2 (acoso). Hasta el 21/09 podés leer pero no publicar, comentar ni votar. Podés apelar: /apelacion"
- Ban: "Tu cuenta fue inhabilitada de forma permanente por incumplir la Regla 3 (amenazas). Podés apelar dentro de los 30 días: /apelacion"

The rule number and its short name are always present; free-text public reasons are allowed as an *addition*, never a replacement — this keeps sanctions legible and the transparency report countable.

## 11.6 Anti-abuse engineering

**Decision.** Anti-abuse is layered and boring: invite-gated registration, database-enforced rate limits tiered by account age, structural vote-manipulation blocks, SQL anomaly reports on the existing daily cron, one global circuit breaker, and no CAPTCHA until evidence demands it. No ML anywhere (brief §19 "do not over-engineer"; one developer cannot babysit a classifier).

### 11.6.1 Registration hardening

Per spine D3: invite links gate early registration (`invites` table: code, created_by, max_uses, expires_at), which is simultaneously our density strategy and our strongest anti-bot control — account farming requires farming invites, and the invite tree (`invites.created_by` → accounts created) makes farms visible and collectively bannable (Regla 11). Plus: mandatory email confirmation before first write (Supabase Auth); a **disposable-email-domain blocklist** (static list vendored in the repo, ~3k domains, checked server-side at signup — free, zero dependencies, updated manually per quarter); one account per confirmed email (auth-level); banned users' email hashes checked at signup (PART 9). Signup itself is rate-limited per IP in middleware (5/hour/IP) — the only place IP is used at MVP, transiently, never stored against the profile (PART 10 owns telemetry policy).

### 11.6.2 Rate limits

Three account-age tiers; limits enforced inside the SECURITY DEFINER write functions (D14 rule 9 — they hold even if the app layer is bypassed), with middleware per-IP limits as a cheap outer shell. **This table is the source of record for the limit VALUES** (spine §0.5-R6). Mechanism per PART 8: no counters table — each write function counts recent rows via the existing (author_id, created_at) indexes; the numbers below are starting values, held in one `rate_limits()` SQL function so tuning is a one-line migration:

| Action | T0: nueva (<48 h) | T1: reciente (48 h–30 d) | T2: establecida (>30 d) |
|---|---|---|---|
| Posts / day (and /hour) | 3 (1) | 10 (4) | 20 (8) |
| Comments / day (and /hour) | 20 (6) | 80 (20) | 150 (40) |
| Votes / hour | 20 | 60 | 120 |
| Reports / day | 5 | 15 | 25 |
| Resource uploads / day | 1 | 5 | 10 |
| Invites created / month | 0 | 5 | 10 |
| Pseudonym rename | — | — | every 90 d (D3) |

Reporters with >80% rejected reports (≥10 filed) drop one tier for reporting only. Hitting a limit returns a calm, honest error: "Estás publicando muy seguido. Probá de nuevo en un rato." T0 exists because essentially all spam/abuse waves come from fresh accounts; legitimate new students barely notice 3 posts/day.

### 11.6.3 Vote-manipulation defenses

- **Self-vote block:** structural — the vote function rejects `voter_id = author_id` (applies to anonymous content too, since authorship exists internally). Also a DB CHECK where the join allows it; PART 8 decides placement.
- **New-account vote delay — DEFERRED until open registration (spine §0.5-R6):** the beta ships without it; PART 8's toggle_vote applies score immediately for all tiers. It is documented here as a pre-built-later escalation switch. When enabled: votes from T0 accounts are *recorded* in the vote tables but not applied to `score`/karma; the existing nightly aggregates cron (D6 — no new cron; Hobby cron jobs each run at most once daily **[FREE-TIER RISK]**) folds them in once the account crosses 48 h. Vote rings must therefore age accounts 48 h past email-confirm, which combined with invite-gating makes cheap manipulation slower than it is worth at our scale. UI shows the voter their own vote immediately (optimistic display), so the delay is invisible in normal use.
- **Anomaly report, not ML:** the nightly cron appends to a mod-visible report (S4) from three plain SQL queries: (a) voter pairs where >60% of one account's votes land on a single author (≥10 votes); (b) accounts registered from the same invite code voting on each other; (c) hourly vote velocity on any single post >3× its trailing median. Output is a table for human eyes; action stays manual (Regla 11 sanctions).

### 11.6.4 Brigading

Cross-thread pile-ons (a WhatsApp group descending on one post) are detected by a per-thread velocity alert: if a single post receives, within 60 minutes, ≥10 comments from T0/T1 accounts or ≥5 reports, the thread is flagged to the mod queue as priority ("hilo con actividad inusual") — computed in the same write functions (cheap counter check), no cron needed. Mod response options are the normal ladder plus one thread-level tool: **lock** ("Este hilo fue cerrado por moderación" — no new comments, content stays). Locking is a `mod_actions` entry (`bloquear_hilo`, setting `posts.locked_at`) like everything else. We deliberately ship no auto-hide: at cohort scale, false positives (a genuinely hot parcial thread) are more likely than raids, so humans decide.

### 11.6.5 Content-flood circuit breaker

One admin switch (`/mod/config`): **"Pausar publicación de cuentas nuevas"** — while on, T0 accounts cannot create posts/comments/resources (reads, votes, reports unaffected), enforced in the write functions, with a banner for affected users: "Por un pico de actividad inusual, las cuentas nuevas no pueden publicar por unas horas. Podés seguir leyendo." This is the raid-day tool (e.g., the platform gets posted to a hostile outside community): it caps blast radius instantly without touching established users, and it costs one boolean. Turning it on/off is logged. Expected use: rare to never — but the day it is needed, building it takes too long.

### 11.6.6 Scraping posture

Public content is public — that is the point (spine C16: SEO and the 2036 reader depend on it). We do not login-wall content, obfuscate HTML, or fight archivists; a copy of the commons in the Internet Archive is aligned with the mission. We block only *abusive rates*: middleware per-IP throttling on HTML routes (sustained >2 req/s or >1.000 pages/h → 429), stricter on search (§PART 13) because FTS queries are our most expensive read **[FREE-TIER RISK]** — a scraper hammering `/buscar` is a database-CPU and egress problem before it is a content problem. `robots.txt` is owned by PART 23 §23.5; this part only requires that it allow well-behaved crawlers and disallow `/mod`, `/ajustes`, `/avisos`, `/apelacion`; signed file URLs (D6) already prevent bulk resource exfiltration since each download authorizes individually (PART 14).

### 11.6.7 CAPTCHA stance

**None at MVP.** Invite gating + email confirm + T0 limits already impose more friction than a CAPTCHA, without taxing every legitimate user on every action. Escalation is pre-wired, not pre-built: Cloudflare **Turnstile** (free tier, privacy-acceptable, no visible puzzles for most humans) toggleable from `/mod/config` at exactly two points — registration, and T0 post/comment creation — the day invite-gating loosens (open registration, D12 launch) or a bot wave shows up in the anomaly report. Integration is ~1 day; wiring the toggle costs ~0 now. We never put CAPTCHA on reading. **[HUMAN DECISION]** at open-registration time: enable Turnstile on signup from day one of open registration, or wait for evidence. Recommendation: enable on signup only.

## 11.7 Resource & file moderation (brief §54)

**Decision.** Resources publish immediately (**publish-first**) with report-driven takedown, a formal Ley 11.723 notice channel honored on plausible private notice with a 72 h SLA, and an uploader strike ladder separate from (but feeding) the general ladder. File-type allowlist and size caps are the structural safety layer; technical validation detail (MIME sniffing, filename sanitization, scanning strategy) is owned by PART 10 and PART 14.

### 11.7.1 Publish-first, not pre-moderation

Considered / Chosen / Why / Cost:

- **Considered:** pre-moderation (every upload human-reviewed before visibility), publish-first with report-driven takedown, hybrid (pre-moderate T0 accounts only).
- **Chosen:** publish-first for everyone, with the T0 upload limit (1/day) as the de facto hybrid.
- **Why:** at MVP scale the reviewer is the founder; pre-moderation makes the platform's core utility magnet (D1) dependent on one person's availability — an upload sitting 48 h in a queue during parciales week is a churned contributor. Risk is already bounded structurally: allowlist (PDF + images only — no executables, no macro carriers, no archives; rationale: every abuse class §54 worries about — malware, disguised binaries — requires file types we simply refuse), ≤10 MB/file, ≤3 files, per-user quota (D2), uploads gated behind confirmed invite-gated accounts, and signed-URL downloads (no anonymous hotlinking). The residual risk is *content* (copyright, wrong-materia spam), which reports catch with acceptable latency.
- **Cost:** infringing or garbage files are visible until reported — hours, not minutes. Accepted; revisit to hybrid pre-moderation for T0 accounts if >20% of new-account uploads in any month get removed.

### 11.7.2 Copyright takedown channel (Ley 11.723) **[LEGAL REVIEW]**

Argentina has no DMCA, but the legal scan (items 2, 4) implies the same operational shape: copyright claims are usually *verifiable* on their face (unlike defamation), so we honor them on plausible private notice rather than demanding a court order — arts. 71–72 make infringement criminal, which is why speed and paper trail matter.

Flow: (1) intake via the `infraccion_autor` report category or `/reglas`-linked form (also usable by non-users, e.g. a publisher or CADRA: work identified, claimed ownership, claimant contact — required fields); (2) mod review within **72 h**: if the claim is plausible (scanned book chapters, cátedra slides, publisher PDFs — Regla 9's explicit examples), the resource status → removed, uploader notified with claim summary and strike; (3) **counter-notice**: the uploader can assert original authorship ("es mi propio resumen") via appeal; a mod re-reviews, and doubtful cases stay down — at our scale, over-removal of one resumen is cheaper than an accomplice-zone criminal exposure; (4) every notice, decision, and timestamp logged (the negligence-defense paper trail per *Rodríguez*). Counsel defines before launch: what makes a notice "plausible", whether identification of the claimant is verified, and the exact counter-notice standard.

### 11.7.3 Uploader strike ladder

Separate counter, because copyright behavior is a distinct risk domain with legal significance (a documented repeat-infringer policy is itself a defense):

| Confirmed infringement | Consequence |
|---|---|
| 1st | Removal + `advertir` (copy: "Removimos tu recurso por un reclamo de derechos de autor (Regla 9). Subí solo material propio.") |
| 2nd (within 12 months) | Removal + 30-day upload suspension (posting/commenting unaffected) |
| 3rd | Removal + permanent upload ban; general ladder review of the account |

Good-faith gray-zone cases (an original resumen that tracks slides too closely — the legal scan's derivative-work gray zone) can be resolved as removal *without* strike at mod discretion; the internal note says why.

### 11.7.4 Non-copyright resource abuse

Wrong-materia spam, troll files, sexual content in PDFs: normal report categories, normal ladder, plus resource-specific removal copy. Malicious-file *technical* defenses (magic-byte checks, image re-encoding, PDF handling, storage policies) are specified in PART 10/PART 14; this part only fixes the policy: any file confirmed malicious = immediate ban, no ladder.

## 11.8 Moderation load model

**Decision.** Plan moderation labor with the same seriousness as infrastructure quota, because it is the first thing that breaks (spine C13). Numbers below are estimates from comparable small-forum norms (unverified — no published benchmark fits a cohort platform this specific; treat as planning figures to be replaced by real telemetry within the first cuatrimestre).

### 11.8.1 Expected volume

Assumptions: ~40% of registered users active weekly during cursada; active users produce ~1.5 content items (posts+comments) per week; reports run 2–5% of content items in a young pseudonymous community (falling toward 1–2% as norms settle); ~5 min median handling per queue item including notification, ~15 min per appeal or copyright notice.

| Registered users | Content items/week | Reports/week | Mod hours/week |
|---|---|---|---|
| 100 | 60–100 | 2–5 | < 1 |
| 1.000 | 600–1.000 | 15–50 | 2–6 |
| 10.000 | 5.000–9.000 | 120–450 | 12–40 |

Seasonality doubles the peaks: parciales/finales windows concentrate both traffic and conflict (stress + professor talk), January–February near-zeroes everything.

### 11.8.2 When the founder breaks — and the recruitment trigger

A founder who is also the only developer can sustain ~3–4 mod-hours/week without development stalling. The table says that budget is exhausted between 1.000 and 2.000 registered users — well before any infrastructure limit (C13 confirmed). Therefore the binding trigger, whichever fires first: **>25 open-queue items/week sustained for 3 weeks, or "everything else" p95 > 72 h for 2 consecutive weeks during term → recruit the first 2 moderators.** Expected around 800–1.200 users; the roadmap (PART 28/30) must slot mod recruitment as a deliverable of the first growth phase, not a reaction.

### 11.8.3 Trusted-student moderators

- **Criteria:** ≥6 months on the platform, consistently constructive history (karma is a weak proxy; the founder reads their actual content), zero sanctions, and — for the first cohort — personally known to or vouched to the founder. **Founding-cohort exception (spine §0.5-R23q):** the first 2–3 mods are selected on personal vouching plus their conduct during the beta; the ≥6-month tenure rule applies from the second recruitment wave onward. Different carreras where possible. **[HUMAN DECISION]** per individual; this is the founder curating the institution's character.
- **Onboarding:** a written mod guide (the Reglas + a decision rubric per rule with real resolved examples + the reveal-audit policy §11.4.2 + a confidentiality agreement covering internal authorship); then a 2-week shadow period reviewing S2 items and proposing actions the founder executes.
- **Powers granted gradually:** stage 1 — triage (close duplicates, `desestimar_reporte`, escalate); stage 2 (after ~1 month clean) — `remover` + `advertir`; stage 3 — suspensions. **`banear` and copyright determinations remain founder/admin-only** until the team has a second admin. Stages map to no schema change — one `mod_stage` field or config list, PART 8's choice.
- **Removal:** inactivity >30 days during term, any reveal-audit violation, any de-anonymization (instant removal + ban, §11.4.2), or simple resignation. Removal is undramatic and reversible-in-principle; mod status is a job, not a rank.
- **Compensation:** none at MVP — no money exists (D13), and paid moderation changes the volunteer-institution character. Recognition is private thanks and, if they consent, a line in the transparency note ("moderan N estudiantes voluntarios"). Revisit at Vercel-Pro-scale monetization (PART 31).

### 11.8.4 The own-facultad conflict rule

Density means mods *will* moderate their own facultad — that context is precisely their value. The conflict rule is therefore about proximity to the dispute, not the facultad per se. A moderator must not action: (a) content they authored or a thread they participated in; (b) reports they filed themselves; (c) Regla 4 items concerning a cátedra they are currently cursando or a professor currently grading them. Such items are reassigned (second mod or founder). Appeals are always reviewed by a non-original actor (§11.5.2). Violations show up in the `mod_actions` log (actor vs. participant join — one audit query) and count like a reveal-audit violation.

## 11.9 Transparency: the informe de moderación

**Decision.** Every quarter, the platform publishes an "Informe de moderación" as a normal pinned post from the official account: aggregate counts only, no cases, no names, no examples. Cost: ~1 hour/quarter (the queries are saved; the numbers come straight from `reports` and `mod_actions`).

Fixed structure (so 2027's report is comparable with 2035's):

> **Informe de moderación — 2° trimestre 2027**
> Reportes recibidos: 143 (spam 61, acoso 18, ataques a personas 21, derechos de autor 9, otros 34).
> Acciones: 47 remociones, 12 advertencias, 4 suspensiones, 1 ban.
> Apelaciones: 6 recibidas, 2 aceptadas.
> Reclamos formales de terceros (derechos de autor / datos personales): 3, todos respondidos dentro del plazo.
> Tiempo mediano de revisión: 9 horas.
> Moderan actualmente: 3 personas.

Why this earns its permanent slot: (1) it is the cheapest institution-building artifact available — a decade of quarterly reports *is* the evidence that the platform governs itself seriously, exactly the brief §2 ambition; (2) it disciplines us — a metric you must publish is a metric you manage; (3) it is the honest answer to "¿quién modera esto y con qué criterio?" that every anonymous platform gets asked; (4) the formal-claims line creates a public record of responsiveness that supports the *Rodríguez* negligence defense posture (§11.5.1). The report never includes: individual cases, user identifiers, content excerpts, or per-carrera breakdowns (at cohort scale those can identify people). First report: end of the first full quarter after open launch (mid-2027 per D12).

## 11.10 Consistency obligations on other parts

- **PART 8:** implement `report_categoria` (§11.3.1) and `mod_action` (§11.5.1) enums verbatim; `reports` unique (target, reporter); appeal rows as `mod_actions` referencing the original action; the `revelar_autor` audit rows (§11.4.2); thread lock (`bloquear_hilo` / `posts.locked_at`); rate-limit constants in the `rate_limits()` SQL function, enforced by counting recent rows (§11.6.2).
- **PART 9/10:** banned-email-hash check at signup; IP used only transiently in middleware; telemetry/log-retention policy sized against court-order disclosure (legal scan item 3) **[LEGAL REVIEW]**; file technical validation (§11.7.4).
- **PART 12/13:** `eliminado_mod`/locked states in feed and search; `/buscar` rate limits (§11.6.6).
- **PART 14/16:** takedown flow surfaces on resource pages; removed-content tombstone semantics in the archive/lifecycle.
- **PART 21:** anomaly queries ride the existing nightly cron (vote-delay reconciliation deferred per §11.6.3) — Hobby cron jobs each run at most once daily **[FREE-TIER RISK]**.
- **PART 28/30:** mod recruitment as a scheduled growth-phase deliverable (§11.8.2).
- **PART 34:** aggregate this part's [LEGAL REVIEW] items — Reglas full text, Regla 4 line and notice protocol, ARCO/data-protection handling, copyright notice standard, mod access to authorship in the privacy policy, evidence-preservation duties for `contenido_ilegal`.
