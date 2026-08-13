# PART 14 — RESOURCES

## 14.1 Role in the product

**Decision: resources are the utility magnet — the feature that gives a brand-new visitor value with zero other users online — and they are free, login-gated for download, and public-metadata for search engines.** Per spine D1, utility recruits; per D11, seed resources are the cold-start engine; per C16, resource metadata is public and indexable. Everything in this part is designed so a student who googles "resumen derecho constitucional uca" lands on a materia's resource shelf, sees exactly what exists, and has one reason to register: the download button.

The resource system must satisfy brief §9F (typed academic resources with metadata), §54 (resource moderation, file safety, download authorization), and the ALWAYS dimension of §2: a resumen uploaded in 2026 is still findable and downloadable in 2036, at the same URL (`/recursos/[publicId]`, D7).

## 14.2 Resource model and typed metadata

**Decision: a resource is a typed, materia-anchored bundle of 1–3 files plus metadata. `materia_id` is required, `tipo` is required, `año` is optional, description is optional but strongly prompted.** Tables `resources` and `resource_files` per spine D4; PART 8 owns the DDL. This section binds the semantics.

Required metadata at publish time:

| Field | Constraint | Why |
|---|---|---|
| `title` | 8–120 chars | Search result headline; too-short titles ("resumen") destroy findability |
| `materia_id` | NOT NULL, FK `materias` | The shelf. An unshelved resource is invisible; the materia page is where resources live (D1: materia = unit of permanence) |
| `tipo` | enum: `resumen` / `apunte` / `parcial` / `final` / `guia` / `otro` | Drives filtering, duplicate grouping (§14.8), and legal posture (§14.9 treats `parcial`/`final` differently) |
| `año` | int, nullable, CHECK 2000–current year | "¿De qué año es este parcial?" is the first question every student asks; optional because resúmenes are often year-agnostic |
| `description` | 0–2000 chars | Sales pitch to a stranger; the upload form prompts: "Contá qué incluye: unidades, cátedra, si está actualizado." |
| `is_anonymous` | bool | Same per-content anonymity as posts (D3); see §14.6 |

UI labels (es-AR): "Resumen", "Apunte", "Parcial", "Final", "Guía de ejercicios", "Otro". The tipo enum is deliberately closed and small: six values cover the real taxonomy of Argentine study material, and a closed enum keeps filters, dedup grouping, and moderation rules enumerable. New tipos require a migration — that friction is a feature.

Deliberately absent from MVP metadata: `cátedra`/professor attribution as a structured field (C9 — professors are catalog metadata only, and letting uploaders free-tag professor names onto files invites the defamation/data-protection surface we cut), ratings (§14.7), price (`price_cents` exists, stays NULL — C11 extension point only).

## 14.3 Upload flow

**Decision: two-phase upload — Server Action `createResourceDraft` calls the `request_upload` RPC to validate metadata and quota and issue signed upload URLs into a quarantine prefix; the browser uploads directly to storage; `finalizeResource` calls the `finalize_upload` RPC to verify, sniff, strip, and move what actually landed. Limits: 1–3 files per resource, 10 MB per file, PDF/JPG/PNG/WebP only, 100 MB lifetime quota per user.** This section, with §14.4–14.5 and §14.10, is the canonical upload-pipeline spec; PARTs 8, 10 and 20 reference it.

Files live on **Cloudflare R2 from the first upload** (spine D6, §0.5-R17): 10 GB free storage, **zero egress fees**, S3-compatible, signed URLs minted server-side. Supabase Storage is unused in MVP. Zero egress retires the old #1 [FREE-TIER RISK] (Supabase Free's 1 GB bucket + 5 GB egress/month vs. a PDF library); the remaining ceiling is R2's 10 GB of storage, with the D13 trigger at 70%. The math that produced the limits:

- 10 MB/file: a 100-page scanned resumen at reasonable quality is 5–15 MB; 10 MB forces compression without blocking real material.
- 3 files/resource: covers "parcial + resolución" and multi-part scans; prevents 20-photo dumps that belong in one merged PDF.
- 100 MB/user: ~100 maxed-out users could still fill the 10 GB free tier, so this is a brake, not a guarantee — real protection is the aggregate telemetry below. In practice (average resource 3–8 MB) the platform holds roughly **1.200–3.300 resources** before the D13 R2 trigger fires — the D11 seed (80–150 resources in one carrera) plus many expansion waves.
- Aggregate alarms (PART 24 owns dashboards): R2 storage > 70% of 10 GB → D13 pre-committed trigger, R2 paid (~USD 0.015/GB-mo — cents). Egress is free at any volume, so a download spike costs nothing. §14.4's provider-agnostic path scheme still exists so that any future provider move is a file copy plus a URL-signer swap, not a schema change.

**Flow (numbered, implementable):**

1. **Form** (`/recursos/subir`, login required, suspension-checked). Fields per §14.2 plus file picker. Copy: "Subí un recurso" / "Formatos: PDF, JPG, PNG, WebP. Hasta 3 archivos de 10 MB cada uno." Client-side validation is UX only; the server re-checks everything (D14 rule 4).
2. **Server Action `createResourceDraft`** (calls the SECURITY DEFINER RPC `request_upload`, PART 8 §8.5): Zod-validates metadata; checks the user's quota (`SUM(size_bytes)` over their live `resource_files` + declared new sizes ≤ 100 MB lifetime); checks the upload rate limit (values per PART 11 §11.6.2, enforced in the SQL function per D14 rule 9); inserts a `resources` row with `status = 'borrador'`; returns one signed upload URL (**TTL 120 s**) per declared file, each scoped to a quarantine path `incoming/{upload_nanoid}` the server chose — the client never names storage paths.
3. **Browser uploads directly to Cloudflare R2** via the signed URLs, into the quarantine prefix. Direct-to-storage matters on Vercel Hobby: routing 10 MB bodies through serverless functions burns function GB-hours and hits body-size limits; the file bytes must never transit Vercel.
4. **Server Action `finalizeResource`** (calls the RPC `finalize_upload`): for each declared file, verifies the quarantine object exists and its stored size matches and is ≤ 10 MB; fetches the first bytes of each object (ranged read) and checks **magic numbers** (`%PDF-`, JPEG `FF D8 FF`, PNG signature, WebP `RIFF....WEBP`) — extension and Content-Type headers are client-controlled and therefore worthless as the only check; strips image metadata (EXIF) from JPG/PNG/WebP (photos of exams carry GPS and device data — a deanonymization vector); moves each object from `incoming/{upload_nanoid}` to its final path `r/{resource_public_id}/{file_nanoid}.{ext}` (§14.4); on success flips `status = 'activo'`, inserts `resource_files` rows, and stores the original filename **as metadata only** (sanitized: strip path separators, control chars, cap 200 chars). On failure: deletes the orphaned quarantine objects, keeps the draft for retry.
5. **Cleanup**: drafts older than 24 h and their objects (quarantine or final) are deleted by the daily maintenance cron (PART 21) — abandoned uploads must not leak quota or storage.

Malware posture (brief §54, start-simple): no antivirus service exists on this budget, so the defense is categorical — an allowlist of four non-executable formats, magic-number verification, size caps, and download delivery with `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff` so the browser never executes or inline-renders a hostile file in our origin (PDFs can embed JavaScript; attachment delivery pushes rendering to the OS viewer). No ZIP, no DOCX (macro risk), no executables, ever on the free tier. Revisit scanning (e.g., ClamAV in a worker) only at the paid-infrastructure phase.

## 14.4 Storage layout

**Decision: one private Cloudflare R2 bucket `recursos` (§0.5-R17); quarantine prefix `incoming/{upload_nanoid}`; final object path `r/{resource_public_id}/{file_nanoid}.{ext}`; original filename lives only in `resource_files.original_filename`.**

- **Private bucket**: no public objects, no exceptions. Every read is a signed URL (§14.5). R2 has no storage-RLS to integrate — acceptable because access was always server-gated: uploads happen only via server-issued signed upload URLs, reads only via server-issued signed download URLs (D5 discipline extended to storage).
- **Path scheme**: `r/` prefix (one flat namespace; provider-portable), then the resource's public nanoid (groups a resource's files for ops and deletion), then a fresh 10-char nanoid per file plus the verified extension. No user ID in the path (paths leak into signed URLs into browser history; an author ID in the path would silently deanonymize anonymous uploads). No materia slug in the path (materias can be re-slugged; storage paths must never need renaming — brief §58).
- **Original filename as metadata only**: shown on the resource page ("`resumen-civil-unidades-1-7.pdf` — 4,2 MB") and replayed in the download's `Content-Disposition` filename (sanitized). Filenames are user input; keeping them out of paths kills the malicious-filename class (brief §19) at the root.
- **Portability** (brief §33): `resource_files.storage_path` stores the bucket-relative path, not a URL. The weekly backup job (PART 21) exports a storage manifest (path, size, sha256) alongside `pg_dump`; moving providers = copy objects + repoint the signer.

## 14.5 Download authorization

**Decision: resource metadata is public and indexable; the file itself requires login. Downloads are served via short-TTL signed URLs issued by a server action that also counts the download.**

Considered / Chosen / Why / Cost:

- **Considered**: fully public downloads (best SEO/utility); login-gated downloads (chosen); paid/karma-gated downloads (rejected outright — kills the utility magnet, C11 logic).
- **Chosen**: public metadata page at `/recursos/[publicId]` (title, tipo, materia, año, description, file list with names/sizes/types, uploader or "Anónimo", vote and download counts) — fully SSR'd and indexable (PART 23). The download button for a logged-out visitor renders: "Ingresá para descargar" → `/ingresar?next=/recursos/[publicId]`.
- **Why**: two independent reasons. (1) Abuse control: with files on R2 (§0.5-R17), egress is free at any volume, so bandwidth no longer breaks the budget — but anonymous hotlinking (one WhatsApp group pasting a direct file link) still invites scraping and count inflation; login-gating makes every download attributable and rate-limitable. (2) Registration driver: the resource shelf is the single strongest conversion surface the product has (D11); the gate converts Google traffic into accounts at the exact moment of demonstrated need.
- **Cost**: friction, honestly counted. Some students will bounce rather than register, and mirrors of our PDFs will circulate on WhatsApp anyway (unpreventable; acceptable — the file spreads, the URL on it does not, per D10 no watermarking before naming resolves). We buy the cost because the alternative — an unmetered, unattributable public file host — gives away the registration moment the product most needs and hands scrapers the shelf for free.

**Mechanics:**

1. Logged-in user clicks "Descargar". A Server Action runs as the user (D5) and calls the SECURITY DEFINER RPC `register_download` (PART 8 §8.5): checks the resource is `activo`, checks the per-user download rate limit (values per PART 11 §11.6.2 — generous for humans, hostile to scrapers; enforced in the SQL function), registers the download, and returns a signed R2 URL with **TTL 120 seconds**.
2. The browser navigates to the signed URL; Cloudflare R2 serves the bytes directly (never through Vercel or Supabase — file egress stays off both meters, and R2 egress is free anyway).
3. **Counting via the ephemeral `download_log`** (per PART 8, §0.5-R9): the same RPC inserts into `download_log (resource_id, user_id, created_at)` — internal-only, RLS deny-all, retained **7 days** and purged by the nightly job. The table exists only to (a) rate-limit download-URL issuance and (b) dedup `resources.downloads_count` increments per user per resource per day, so the public count means "distinct user-days" — which resists both accidental double-clicks and deliberate count inflation (brief §19 vote manipulation applies to download counts too). **No durable per-user download history exists**; the 7-day rolling window is disclosed in PART 9's §9.11.3 data inventory and on the Privacidad page.

Short TTL rationale: 120 s is enough for any redirect chain, short enough that a shared signed URL is dead before it propagates. Signed URLs are the only path to bytes; there is no "public URL" to leak.

## 14.6 Anonymous publishing of resources

**Decision: resources support the same per-content `is_anonymous` flag as posts, with identical mechanics and zero exceptions.** D3 applies wholesale: public payload for an anonymous resource carries no author fields at all (enforced by the `resources_public` view, D5); `author_id` is always retained internally for quota accounting, rate limits, moderation, and takedown response; karma from votes on anonymous resources accrues via the daily batch (C5); the uploader sees their own anonymous resources in their private panel (§14.10) but no one else does.

Why allow it at all: the best material is often the most identifying ("the only person with a 70-page Civil resumen is Fulana") and some uploads are sensitive by nature (a parcial viejo obtained informally, §14.9). Blocking anonymity here would suppress exactly the highest-value uploads. The moderation cost is unchanged — internally, an anonymous upload is as attributable as any other (brief §8).

One consequence stated plainly in the upload form: "Si publicás como Anónimo, el recurso no aparecerá en tu perfil público ni sumará reputación visible." No per-thread alias machinery is needed (that is a comment-thread construct, D3); a resource is simply labeled "Anónimo".

## 14.7 Quality signals

**Decision: MVP quality signals are upvotes and the distinct-user-day download count. Nothing else. Star ratings and written reviews are P2.** Spine D2 sets this; the reasoning:

- Upvotes (via `resource_votes`, up-only, D4) answer "was this useful?" with one tap and zero moderation surface.
- Download counts answer "is this what people actually use?" and cost nothing — they are a by-product of §14.5's counting.
- Default sort on materia resource shelves: votes desc, then downloads desc, then recency. New uploads get a "Nuevo" row treatment for 14 days so they are not buried by incumbents (cold-start fairness inside a shelf).
- Ratings/reviews (P2, only if shelves exceed ~10 items per materia-tipo and sorting visibly fails): 5-star ratings produce J-curve noise at small n, and written reviews are a new free-text moderation surface (including a defamation vector: "este resumen es de la cátedra de X y está lleno de errores"). At MVP scale, votes carry the same signal at a tenth of the cost.

No uploader leaderboards, no "top contributor" badges (C10 — possibly never).

## 14.8 Duplicate handling

**Decision: duplicates are handled socially, not technically. The shelf groups by (materia, tipo), sorts by votes, and lets redundancy sink. No hashing, no dedup prompts, no merge tooling in MVP.**

Rationale: "duplicate" is undecidable for study material — two resúmenes of the same materia differ by cátedra, year, unidades covered, and quality; auto-blocking uploads on similarity would delete real value and require content inspection we cannot afford. The failure mode of no-dedup (a shelf with three Civil resúmenes) is not a failure: votes order them, and choice among three is a feature. The failure mode of aggressive dedup (rejecting the better later upload) is fatal to the utility magnet.

Two cheap mitigations only: (1) the upload form shows existing same-materia same-tipo resources before submission — "Ya hay 3 resúmenes de esta materia. Fijate que el tuyo aporte algo distinto." — a nudge, not a gate; (2) byte-identical re-uploads (same sha256, computed for the backup manifest anyway) are flagged in the mod queue as probable spam, not blocked. Merge/canonicalization tooling is P3-at-earliest, only if shelves demonstrably rot.

## 14.9 The "parciales viejos" special case

**Decision: past exams (`tipo = parcial` / `final`) are accepted, with a takedown-responsive posture, no institutional branding, and explicit framing as student-transcribed material. [LEGAL REVIEW] before public launch — this is the plan's second-highest legal surface after naming.**

The legal research note (`legal-ar.md` §4, prepared 2026-08-13) is blunt: Argentina's Ley 11.723 has **no fair-use or private-copy exception**; exam papers are plausibly protected works of the professor/university and sometimes claimed as confidential; arts. 71–72 make infringement criminally chargeable, which gives any UCA carta documento real teeth; and "a branded platform centralizing UCA materials is a much more attractive target than a WhatsApp group." At the same time, parciales viejos are the single most-demanded resource type in any Argentine facultad — refusing them entirely would gut the utility magnet.

Posture (each element implementable now):

1. **Upload rules steer toward transcription.** The form for tipo `parcial`/`final` shows: "Subí el enunciado transcripto o tus propias fotos del examen que rendiste. No subas material con logo o membrete de la universidad ni archivos oficiales." Transcribed question sets in a student's own document are the defensible end of the spectrum; branded scans of controlled documents are the indefensible end. This is stated policy in the Reglas page (spine D2 legal pages), not just form copy.
2. **No institutional branding, ever**: no UCA logos/escudos in uploads (removable on report — `legal-ar.md` §8 notes logos are separately protected designs), no UCA branding in our own UI around them, and per D10 no product watermarking of files.
3. **Copyright takedown channel honored on private notice.** Unlike defamation (debatable, court-order standard under the Rodríguez doctrine), copyright claims are usually manifestly verifiable — so the policy is: complete claim received → file access suspended within 72 h → uploader notified with counter-notice option → resolution logged in `mod_actions`. PART 11 owns the queue mechanics and the repeat-infringer rule (strikes → upload restriction via `user_restrictions`); the SLA and the "suspend fast" default are set here because they are the legal defense: speed and paper trail (`legal-ar.md` §2).
4. **Questions for counsel** (aggregate in PART 34): (a) can we host past exams at all, and does UCA assert ownership/confidentiality over them; (b) where is the resumen-vs-derivative-work line for material tracking professors' slides; (c) what takedown SLA and strike policy keeps the platform out of arts. 71–72 accomplice territory. **[LEGAL REVIEW]**
5. **Kill switch**: a single config flag disables new `parcial`/`final` uploads platform-wide without touching existing content — if counsel or a carta documento forces retreat, retreat is one deploy, and already-uploaded items are handled individually through the takedown channel rather than mass-deleted.

## 14.10 Contributor experience

**Decision: a private "Mis recursos" panel (under `/ajustes` scope, per D7 no new public URL); metadata editable at any time; file replacement inserts a new `resource_files` row and sets `replaced_at` on the old one — no versions table — and the old object is deleted from storage immediately.**

- **Mis recursos** lists all the user's resources — including anonymous ones, visible only to their author — with per-resource votes, downloads, status, and actions: "Editar", "Reemplazar archivo", "Eliminar".
- **Metadata edits**: title, description, año, tipo, materia are editable indefinitely with no "editado" mark. A resource is a utility object, not an utterance — corrections ("agregué unidades 8–10 a la descripción") should be frictionless. This intentionally differs from the post/comment edit windows in §16.4; the distinction is discourse (edit-windowed, marked) vs. catalog (freely maintained).
- **Replace file = simple versioning**: replacement inserts a new `resource_files` row and sets `replaced_at` on the old row (row kept: filename, size, hash, dates — the audit trail of what was served; no versions table); the old storage object is deleted immediately. Keeping replaced objects would double-count the 10 GB R2 free tier and the 100 MB quotas for zero user value; history of *metadata* is cheap, history of *bytes* is not. Downloads always serve the latest version; the resource page shows "Actualizado el 12/08/2026". Rebuttable exception: if the resource is under an open moderation report, replacement is blocked until the report resolves (prevents evidence-swapping; PART 11).
- Votes and download counts survive replacement (same resource identity, same URL — replacing a file to fix a typo must not reset earned standing; wholesale bait-and-switch is handled by reports, not by counter resets).

## 14.11 Seed-content hooks

**Decision: the upload pipeline ships with two founder-facing affordances for the D11 seed sprint; strategy itself belongs to PART 29.** (1) Bulk-friendly flow: after "Publicá el recurso", the form offers "Subir otro a la misma materia" preserving materia/tipo — seeding 80–150 resources must not cost 150 full form fills. (2) Seeded resources are ordinary resources from ordinary accounts (founder + accomplices, D11) — no special "official" flag, no synthetic download counts, ever: fabricated signals would be discovered by exactly the small dense community we are courting, and the institution character (brief §2) does not survive that. The shelf must be honestly full, which is why D11 concentrates the seed in one carrera instead of spreading it thin.

---

# PART 15 — MARKETPLACE

## 15.1 The decision: design it, do not build it

**Decision: MVP ships zero marketplace code, zero transactions tables, zero payment dependencies. The only marketplace artifacts in the system are `resources.price_cents` (nullable, always NULL) and extensible status enums (C11). This part exists so the eventual build has a shape — and so the argument for not building it now is on the record.**

The argument, condensed from C11 and expanded:

1. **Cold start eats paywalls.** The utility magnet works because the shelf is free (§14.5 already spends its friction budget on login-gating). Every paid item shrinks the magnet exactly where the platform needs pull.
2. **The build is MVP-sized.** Mercado Pago marketplace onboarding + split flows + refunds + disputes + seller identity + tax posture is comparable in scope to the entire S1–S3 build — spent on a feature with zero demonstrated demand.
3. **[FREE-TIER RISK] Vercel Hobby prohibits it categorically.** The fair-use policy (verified 2026-08-13, `limits.md`): "Hobby teams are restricted to non-commercial personal use only… All commercial usage requires either a Pro or Enterprise plan," where commercial includes payments, ads, and explicitly "Asking for Donations." Spine C8 makes this a hard gate: **no etapa beyond A ships while the product is on Vercel Hobby.** First monetization dollar = Vercel Pro (USD 20/mo) or a hosting migration, budgeted in PART 31 before any revenue exists to cover it.
4. **Legal surface jumps a category** (§15.4): paid distribution of study materials converts a tolerated note-sharing culture into commerce in potentially derivative works — a different defendant profile (`legal-ar.md` §4, §7).

## 15.2 The staged model

**Decision: four stages, each with its own gate. Etapa A is the MVP and may be permanent. Etapa D is designed only to be argued against.**

### Etapa A — Gratis (MVP, live from launch)

Everything in PART 14. Free distribution, upvotes and downloads as the reward loop, karma as the only "compensation". This stage is complete as designed — nothing in A exists merely as scaffolding for C.

### Etapa B — Propinas voluntarias ("cafecito") **[HUMAN DECISION]**

A single optional profile field: a tip-jar link (allowlisted domains only: `cafecito.app`, Mercado Pago money-request links), rendered on the user's public profile and on their non-anonymous resources as "Invitale un cafecito". No money touches the platform; build cost is one column, one allowlist validation, one link component — near zero.

Purpose: the cheapest possible **demand experiment**. If nobody tips the author of the resumen that saved their final, paid resources (C) have no market and the platform never builds them. If tipping is real, that is the evidence C's triggers require.

Gates and costs, stated honestly: (a) **the C8 gate applies in full** — Vercel's policy names donations as commercial use, so "near-zero build" is not "zero cost": Etapa B waits for Vercel Pro (~USD 20/mo) or a host migration; it is therefore a deliberate founder decision to start paying, not a free toggle. **[HUMAN DECISION]** (b) Tip links appear only on non-anonymous identities (§15.3 logic applies even to tips: a payment link is an identity). (c) Allowlist prevents the field becoming a free-text link-spam vector. (d) ToS language clarifying the platform is not party to tips. **[LEGAL REVIEW]** — also confirm whether tip links trigger any Ley 24.240 / Data Fiscal duty for the platform itself (`legal-ar.md` §5 suggests duties attach "once selling"; tips-without-custody should be below that line, unverified).

### Etapa C — Recursos pagos via Mercado Pago Split

The eventual real marketplace, buildable only when §15.5's triggers all fire. Binding design decisions, made now so no future shortcut violates them:

- **Payment rail: Mercado Pago's marketplace/split product; the platform never takes custody of seller money.** Each seller links their own MP account via OAuth; MP splits each payment between seller and platform at source (`legal-ar.md` §7: MP as PSP of record "absorbs most withholding mechanics" — SIRTAC, ARCA information regimes). Collecting into a platform account and paying sellers out is prohibited by this plan regardless of convenience.
- **Fees**: MP processing in Argentina currently ~3.99%–5.99% + IVA depending on release timing, with provincial IIBB surcharges (`legal-ar.md` §7; re-verify at build time). **Platform cut: 10–15% of item price** — set at 12% initially: low enough that sellers keep a clear majority, high enough to fund the Vercel Pro + Supabase Pro baseline (~USD 45/mo) at modest volume. Worked example at ARS 2.000 per item, MP at 5.99% + IVA ≈ 7.25%: seller receives ≈ ARS 1.615 (80,8%), platform ≈ ARS 240 gross of its own taxes, MP ≈ ARS 145. Shown to sellers *before* listing: "Precio ARS 2.000 → recibís aprox. ARS 1.615."
- **Seller obligations**: sellers accept a distinct "Términos para vendedores" acknowledging that recurring sales income formally requires **monotributo** registration (their obligation, not ours — but the platform must say it plainly, not bury it) and that they warrant authorship/rights over what they sell. Age gate: sellers must be 18+ even though the platform is 16+ — contracts by minors are voidable (`legal-ar.md` §6) and a marketplace of voidable contracts is a dispute factory. **[LEGAL REVIEW]** (counsel items 7a–7c in `legal-ar.md`, plus SAS-vs-monotributo structuring for the platform's own commission).
- **Refund policy**: Ley 24.240 + Res. 270/2020 apply once anything is paid — "botón de arrepentimiento" visible on the site, 10-day revocation right honored for consumers (`legal-ar.md` §5). Policy: full refund within 10 days, no questions, clawed back via MP's refund API; repeated buy-download-refund behavior is an abuse pattern handled by restriction, not by weakening the right. No jurisdiction-clause games (art. 37: consumer-domicile forum survives anything we write).
- **Dispute flow**: buyer opens a claim from the purchase ("No es lo que dice la descripción" / "Es material de otra persona" / "Archivo dañado") → seller has 72 h to respond → moderator resolves with refund/keep + possible strike. MP chargebacks/mediation remain available above us; our flow exists to resolve fast and cheap before that. All resolutions logged in `mod_actions`.
- **Escrow/release limits**: use MP's deferred-release ("dinero retenido") so funds release to the seller after the 10-day revocation window, not instantly — aligning money movement with the refund right instead of financing refunds out of the platform's pocket. Exact release timing per MP product constraints at build time (unverified detail; flag for the C build spike).
- **Copyright vetting for paid content is categorically higher. [LEGAL REVIEW]** Free tier: publish-first, takedown-responsive (§14.9). Paid tier inverts: **pre-publication human review of every paid item** against a checklist (no institutional branding, no scanned textbook chapters, no professor-slide derivatives, transcribed-exam rules) before it can be listed. Selling an infringing derivative is a different act than hosting a shared note — arts. 71–72 criminal exposure plus profit motive removes the "neutral intermediary" posture entirely (`legal-ar.md` §2 already doubts how much Rodríguez deference a curating host gets; a *vendor commission* on the file ends the question). This review labor is a real cost of Etapa C and is listed in its triggers.
- **What can never be paid**: access to posts/comments/community discussion, moderation outcomes, and anything in the academic catalog. Only student-authored resources are sellable. (Brief §55: "do not destroy trust for short-term revenue"; PART 31 owns the full never-monetize list.)

### Etapa D — Bundles / subscriptions: probably never

Bundles ("todos mis resúmenes de 2° año"), subscriptions to a seller, or platform-wide premium recurring revenue. Designed no further than this paragraph, deliberately: recurring paid relationships between pseudonymous students create ongoing service obligations (what happens to a subscription when the seller graduates, deletes their account, or is banned?), amplify every Etapa C legal question, and push the product toward a storefront identity that contradicts D1. Revisit only if Etapa C runs for a full academic year with sustained volume and bundle demand is explicit and repeated. The default answer is no.

## 15.3 Why sellers cannot be anonymous

**Decision: selling requires the pseudonymous account to complete seller onboarding — real MP account linkage, 18+ — and paid resources can never carry `is_anonymous = true`. This is spine D3 ("resource sellers must be accountable identities") made concrete.**

Three independent reasons, any one sufficient:

1. **Payment identity is real identity.** MP OAuth linkage means the platform necessarily holds a payment identity for every seller; pretending the storefront is anonymous while money routes to a named account is privacy theater that would mislead sellers about their actual exposure (a buyer dispute, a tax regime, or a court order reaches the MP account directly).
2. **Accountability asymmetry.** A buyer paying real money needs a counterparty who can be sanctioned beyond a discarded pseudonym: seller standing (sales history, dispute record) must persist and be publicly attached to the selling identity to make fraud expensive.
3. **Copyright liability targeting.** For paid infringing content the author-of-record question will be asked by lawyers, not moderators (§15.2-C). The seller's public pseudonym remains the display identity — real names are still never public (D3) — but the *account* is contractually and financially identified, and sellers are told so in plain words at onboarding: "Para vender necesitás vincular tu cuenta de Mercado Pago. Tu nombre real nunca se muestra, pero tu cuenta queda identificada ante la plataforma y Mercado Pago."

## 15.4 Decision triggers for building Etapa C

**Decision: Etapa C is built only when ALL of the following hold; any single failure defers it another cuatrimestre.** Pre-committing the bar prevents both premature building (the C11 failure) and endless deferral by vibes:

| # | Trigger | Threshold | Evidence source |
|---|---|---|---|
| 1 | Supply | > 200 live resources from ≥ 25 distinct uploaders (organic, post-seed) | `resources` counts (PART 24) |
| 2 | Demand | Etapa B tips flowing to ≥ 10 distinct recipients over one cuatrimestre, or ≥ 50 users answering "pagaría" in an in-product survey | Etapa B observation / survey |
| 3 | Legal | Counsel signoff on §15.2-C items; operating entity decided (SAS question, `legal-ar.md` §5c) | **[LEGAL REVIEW]** complete |
| 4 | Infra | Off Hobby (Vercel Pro or migrated) and Supabase Pro already sustained by budget — C8 gate paid before revenue, not from it | D13 state |
| 5 | Moderation | Pre-publication review capacity exists: ≥ 2 active moderators beyond the founder (C13) willing to own the paid-item checklist | PART 11 roster |
| 6 | Community health | Reports/content ratio stable or falling for 3 consecutive months — a marketplace bolted onto a community with rising abuse compounds both problems | PART 24 metrics |

**[HUMAN DECISION]** Even with all six green, launching commerce changes what the platform *is*; the founder decides, informed by PART 31's monetization-identity analysis.

## 15.5 Schema stance (restated to bind implementers)

No `transactions`, `orders`, `payouts`, `seller_profiles` tables exist in MVP or its migrations (C11). Extension points only: `resources.price_cents` (int, nullable, NULL = gratis), status enums declared with room to grow, and public IDs everywhere so a future payments subsystem can reference content stably. When Etapa C is approved, its schema arrives as new migrations designed then, against MP's then-current API — designing payment tables years early against a moving fintech API is negative work.

---

# PART 16 — ARCHIVE AND CONTENT LIFECYCLE

## 16.1 The archive is a view, not a copy

**Decision: `/archivo` is a set of read paths over the live tables plus small curation/aggregate tables — never a snapshot, never a second store, never a place where deleted content survives (spine C6).** The ALWAYS dimension (brief §2, §13) is delivered by the platform's normal operation: durable URLs (D7), public indexable content (C16), soft-delete semantics (D4), and SEO (PART 23) mean a 2026 discussion is reachable in 2036 *because it still exists at its original URL* — not because we copied it somewhere. The archive UI just adds time-oriented navigation over what exists.

Why this matters architecturally: a snapshot archive would double storage (**[FREE-TIER RISK]**), fork the deletion problem (every deletion must chase copies), and eventually contradict C6's deletion-wins rule. A view archive gets deletion correct by construction: what is deleted from the live tables is instantly gone from the archive, with zero archive-specific code.

## 16.2 `/archivo/[year]` — composition

**Decision: the year page (P3 per D2 — the data is archival from day 1, the UI ships in P3) has exactly three sections: curated hitos, computed rewind, aggregate stats.** URL contract from D7: `/archivo` (year index) and `/archivo/[year]`.

1. **Hitos (curated milestones)** — a lightweight admin table: `archive_hitos (id, year, date null, title ≤ 120, description ≤ 1000, link_url null, position, created_by, created_at)`. Admin-only writes via the mod panel (PART 11 surface); public read. Hitos are editorial pointers ("Marzo: se abrió el registro público", "El hilo de la mudanza de sede llegó a 200 comentarios"), each optionally linking to live content by public ID. If the linked content is later deleted, the hito shows without a link or is pruned by the admin — a hito never embeds a copy of the content it points to (C6). Founder-curated; a few entries per year is success (brief §12: preserve culture organically, do not manufacture it).
2. **Computed rewind** — queries over live tables, filtered `status = 'activo'`, `created_at` within the year: top ~20 posts by score; top resources per materia (up to 3 per materia with activity that year); most-followed new materias. Rendered server-side and cached hard (past years are immutable-ish; a daily ISR revalidate absorbs the rare deletion — a deleted post drops from the rewind within 24 h, which is acceptable because the canonical deletion took effect immediately at its own URL, and the tombstone rules of §16.4 govern what remains visible there).
3. **Aggregate stats, anonymized** — `archive_stats (year, metric, value)` populated each January by the maintenance cron from `posts`/`comments`/`resources`/`profiles` counts — plain counts only: publicaciones, comentarios, recursos subidos, recursos descargados, usuarios que participaron. Example rendering: "En 2026: 4.812 publicaciones, 19.240 comentarios, 312 recursos." Aggregates only, never per-user rankings, never "top users" (C10: leaderboards manufacture gamification; and per brief §13, no sensitive personal exposure). Aggregates are frozen numbers and — unlike content — do NOT recompute when content is later deleted: a count is not personal data once detached from rows, and freezing keeps historical stats honest. **[LEGAL REVIEW]** confirm aggregate-stat freezing is compatible with Ley 25.326 suppression duties (position: counts of "posts that existed" contain no personal data; unverified).

## 16.3 What is never archived — deletion wins, restated

**Decision (restating C6 as this part's law): deleted content is deleted everywhere, immediately, including every archive surface. The archive holds only (a) content that still exists, (b) frozen anonymous aggregates, (c) curated pointers that degrade gracefully when their target dies.** The ToS says it in user language: "El archivo conserva lo que la comunidad decidió conservar. Si borrás tu contenido, desaparece también del archivo. No prometemos conservación permanente de nada." (brief §31's "do not promise permanent preservation" made policy, per C6). There is no "archived" flag on content, no export that resurrects deletions, and the weekly backups (PART 21) are disaster-recovery artifacts with a 90-day rotation — not a shadow archive; backup restoration procedures must re-apply deletions executed since the backup point (PART 21 owns the runbook line).

## 16.4 Content lifecycle matrix (brief §31)

**Decision: the lifecycle below is binding product behavior; PART 8 owns the column-level deletion matrix and must match it exactly.** Edit windows: **posts editable for 24 h** after creation, marked "editado" with timestamp; **comments editable for 1 h**, same mark; **resource metadata editable indefinitely, unmarked** (§14.10's discourse-vs-catalog distinction). Edit windows exist because replies attach to what was written — unlimited post editing lets an author invalidate a thread under everyone's replies; 24 h covers typos and clarifications ("edité: era el jueves, no el miércoles") without enabling rewrites of history. No edit-history is publicly visible (the current text is the text; prior versions are not retained for posts/comments — retaining them would contradict data minimization for no user value).

| Content | Author edit | Author delete | Account deletion (user chose "borrar") | Account deletion (chose "conservar") | Mod removal |
|---|---|---|---|---|---|
| Post | 24 h, "editado" mark | Status `eliminado_autor`; body nulled. With comments: tombstone "[eliminado por su autor]" keeps thread coherent; without comments: URL returns 410 | Same as author delete, all posts | Kept, attributed to "usuario-eliminado-xxxx" shell (D3) | Status `eliminado_mod`; body withheld from public views (retained internally for audit); tombstone "[eliminado por moderación]" |
| Comment | 1 h, "editado" mark | With replies: tombstone "[eliminado]"; without: removed from thread | Same, all comments | Kept under anonymized shell | Tombstone "[eliminado por moderación]" |
| Resource | Metadata: anytime. File: replace = new version (§14.10) | Status `eliminado_autor`; **storage objects deleted immediately** (frees quota); page 410 | Same, all resources | Kept under anonymized shell (default suggestion in the deletion flow — resources are the content future students need most; the choice remains the user's) | Status `eliminado_mod`; objects retained 30 days for appeal/counter-notice (§14.9), then hard-deleted by the retention job |
| Votes | — | Removed with the target | Vote rows deleted (a vote is a user-data row, not community knowledge) | Vote rows deleted (identity link gone either way) | Retained on surviving content |
| Anonymous content | Same windows | Same as above | Same as above — anonymity does not reduce the author's deletion rights | Kept, still labeled "Anónimo" (already unattributed publicly) | Same as above |
| Mod/audit records | Never editable | Never user-deletable | Retained with internal UUID only (D3) — legal/audit basis | Same | Immutable (D4) |

Tombstone rules exist for one reason: thread coherence is community property — deleting a question should not orphan fifteen useful answers — while the deleted *words* are personal property and vanish. Tombstones contain zero content and zero authorship (a "[eliminado por su autor]" tombstone on an anonymous post reveals nothing it didn't already).

The account-deletion fork ("borrar mis publicaciones" vs. "conservarlas como usuario eliminado", D3) is presented at deletion time with plain consequences: "Si elegís conservar, tus publicaciones quedan con el autor 'usuario eliminado' y nadie podrá vincularlas con vos. Si elegís borrar, se eliminan de todo el sitio, incluido el archivo." Habeas data compliance (Ley 25.326 suppression, 5 business days — `legal-ar.md` §1) is satisfied by either path: the identity link is destroyed in both.

## 16.5 Right to be forgotten and old content **[LEGAL REVIEW]**

**Decision: the user's own deletion rights are absolute and instant (§16.4); third-party demands to delete *other people's* truthful old content are resolved through the moderation/legal channel under the Rodríguez/Denegri framework — not by an automatic expiry policy. No content auto-expires by age.**

The CSJN's *Denegri* (2022) rejected a broad right to be forgotten for truthful information on matters of public interest, precisely because it collides with freedom of expression and **collective memory** (`legal-ar.md` §2) — which is legal support for the archive's existence. But the platform's position is weaker than Google's in that case: we host rather than index, our subjects (students, professors) are mostly not public figures, and Denegri protects *truthful, public-interest* material — not gossip about a private person from 2027 that resurfaces in 2033. Operating rules:

1. Demands from the *author* → §16.4, always honored, no analysis needed.
2. Demands from a *person mentioned* → the PART 11 legal-flag queue: manifestly unlawful content (doxxing, private data, threats) is removed on notice; debatable honor/reputation claims follow the notice-and-review protocol where counsel advises removal vs. court-order stance per `legal-ar.md` §2–3, with every notice and decision logged — the negligence record is built either way, so build a good one.
3. Time is a factor moderators may weigh (an identifiable complaint about a named person, years old, about someone long gone, has low preservation value and non-trivial harm) — but as human judgment inside the existing flow, not as a scheduled purge. Automatic expiry would delete the SIEMPRE dimension wholesale to solve a case-by-case problem.
4. Counsel questions (aggregate in PART 34): how Denegri's limits apply to non-public-figure subjects on a hosted forum; whether archive surfaces (rewind lists) require faster response to suppression demands than the underlying content URLs. **[LEGAL REVIEW]**

## 16.6 The "memoria del año" ritual

**Decision: every December, the platform auto-generates and publishes the year's archive page and announces it with a single pinned post — an institution-building ritual whose marginal cost is one cron branch and one template.** Mechanics: the December maintenance run computes the year's `archive_stats`, assembles the rewind queries, and flips `/archivo/[year]` from "in progress" to its year-end form; the founder (later, mods) adds 3–10 hitos by hand; a post announces it: "Memoria 2026 — un año de la comunidad, en números y en hilos." Timing rationale (C14): December is the end of the academic year — finales are ending, cohorts are graduating, nostalgia is at its annual peak; the memoria gives the community a mirror at exactly the moment it wants one. Ten Decembers of this and the platform has a tradition older than its users — which is what brief §2 and §66 actually ask for. First edition: December 2026 covering the beta (small numbers stated proudly: "Fuimos 87. Empezamos.").

## 16.7 Export and portability of the archive

**Decision: the archive's survival plan is the platform's survival plan — PART 21's weekly `pg_dump` + storage manifest + object copy is the archive backup; additionally, a yearly public-content export (JSON, public fields only, anonymized exactly as the `_public` views render them) is generated each January and stored with the backups.** Rationale (brief §33, §58): the ten-year promise must not depend on any provider; the yearly export is the "if Vercel and Supabase disappeared tomorrow" artifact for the community's knowledge specifically — regenerable, provider-neutral, and containing nothing the public site doesn't already show (so a leaked backup of it leaks nothing private). It is rebuilt yearly rather than kept as a growing immutable set precisely so that deletions propagate into it (C6 again: even the export forgets). Restoring or migrating from these artifacts is a tested script per D13, owned by PART 21.

---

## DISSENT — Supabase Storage vs. Cloudflare R2 for resource files

**RESOLVED — ACCEPTED (§0.5-R17): resource files live on Cloudflare R2 from the first upload; Supabase Storage is unused in MVP; §§14.3–14.5 above now reflect this. The dissent text is preserved below as the record of the argument.**

At the time of writing, spine D6 fixed Supabase Storage (private bucket, signed URLs) for MVP, with Supabase Pro as the D13 upgrade path. I comply above (§14.3–14.5 are designed for Supabase Storage, and the path scheme keeps us portable). But the free-tier research (`limits.md`, 2026-08-13) ranks Supabase's 1 GB storage + 5 GB egress as the #1 breaking constraint for exactly our workload and recommends R2 (10 GB storage, zero egress fees, free) for PDFs from day one. The D11 seed alone (80–150 resources) plausibly consumes 40–80% of the 1 GB bucket before the first real user arrives, and one successful parciales week could blow the 5 GB egress cap — meaning the utility magnet's success triggers a paid tier ($25/mo) months earlier than the rest of the platform needs it, or worse, causes mid-parciales download failures. R2 costs one extra dependency and its own signed-URL implementation (S3-compatible; ~1 day of work), against which it buys 10× the storage and unmetered egress. Recommendation: adjudicate before S2 (resources phase) — either adopt R2 for the `recursos` bucket at build time, or explicitly accept that the D13 Supabase Pro trigger is expected to fire during the closed beta and budget for it. The §14.4 path scheme and server-side URL signing were designed so either outcome is a contained change.
