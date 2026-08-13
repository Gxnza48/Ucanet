# PART 9 — AUTHENTICATION & ANONYMITY

## 9.1 The identity architecture in one view

**Decision.** Identity has three layers: a private **account** (Supabase Auth: email + password, known only to the system), a public **pseudonym** (unique handle, the default face of everything you do), and per-item **anonymous publishing** (a checkbox that strips all author fields from the public payload while authorship is retained internally). This implements spine D3 exactly; this part specifies the mechanics an implementer needs.

Rationale: the brief (§7) is explicit that "anonymous" must not mean "unauthenticated," and (§8) that internal traceability must never leak into the public surface. The three-layer split gives each concern one home: accountability lives at the account layer, social identity at the pseudonym layer, privacy at the publishing layer. No feature is allowed to blur the layers — that is the single rule from which most of this part derives.

| Layer | Who sees it | Stored where | Used for |
|---|---|---|---|
| Email + password | Nobody but the user and the system | `auth.users` (Supabase-managed) | Login, recovery, invite tracing |
| Pseudonym (handle) | Everyone | `profiles.handle` (citext, unique) | All non-anonymous content, `/u/[handle]` |
| Anonymous flag | Everyone sees "Anónimo"; system sees `author_id` | `posts.is_anonymous`, `comments.is_anonymous`, `resources.is_anonymous` | Per-item privacy |

**What is never anonymous** (D3, restated as implementation constraints): internal authorship (every row has `author_id`, no exceptions, ever); moderation actions against your own content (you are always notified that *your* content was moderated); future marketplace sellers (accountable identities, not built now, see PART 15). Everything else — posts, comments, resources — can be anonymous per item.

## 9.2 Signup, invites, and login

### 9.2.1 Registration flow

**Decision.** Email + password with mandatory email confirmation, gated by invite links during beta and early growth (D3-a). Any email address is accepted; we do not require `@uca.edu.ar` (see 9.10 for the optional later escalation). **[HUMAN DECISION]** (already marked in spine D3-a; the plan assumes invite-gated any-email).

Flow, screen by screen:

1. `/invitacion/[code]` — server-side validation of the invite (exists, `uses < max_uses`, `expires_at` in the future) before any form renders. Invalid code shows: "Este enlace de invitación ya no sirve. Pedile uno nuevo a quien te invitó."
2. Registration form (email, password ×2, checkbox accepting Términos + declaring 16+ — C15-e, **[LEGAL REVIEW]**). Copy above the form sets expectations honestly: "Tu correo es solo para entrar y recuperar la cuenta. Nunca se muestra a nadie." Password minimum 10 characters, checked with Zod server-side; the top-picks of a common-password denylist (~1k entries, bundled) rejected with "Esa contraseña es demasiado común. Elegí otra."
3. The signup Server Action validates the invite code **read-only** (exists, uses remaining, not expired), passes it in the auth metadata, and creates the auth user via server-side Supabase call. The `handle_new_user` trigger (PART 8) then **consumes the invite atomically at user creation** — re-checks and increments `invites.uses` in the same transaction that creates the profile, so no code can be over-redeemed and no user can exist without a consumed invite. The invite `code` used is stored in the profile row (internal only — spam-tree tracing).
4. Confirmation email sent. Interstitial: "Te mandamos un correo para confirmar tu cuenta. Revisá también el spam." Login is impossible until confirmed (Supabase setting: confirm required — see 10.10).
5. The confirmation link returns to `/registro/continuar` → onboarding per PART 6 §6.1 (the flow owner): choose handle (9.4), then a single carrera + año screen that auto-follows that cohort's materias — skippable via "Prefiero no decir mi carrera". Three interactive screens total, under two minutes, per brief §51.

**Considered:** requiring `@uca.edu.ar` addresses (strong student-verification, zero invite plumbing); open registration (zero friction); invite links with any email.
**Chosen:** invite links with any email (spine D3-a; **[HUMAN DECISION]** confirmed pending).
**Why:** demanding the institutional email at the door contradicts the anonymity promise psychologically ("dame tu identidad real para entrar al sitio anónimo") and technically shrinks trust before the first post; open registration invites spam we lack the labor to fight (C13). Invites give density (cohorts arrive through cohorts, D11), a spam throttle, and an abuse-tracing graph, at the cost of a table and one RPC.
**Cost:** growth friction (every new user needs a link — priced into PART 29/30), the inviter-linkage vector (9.11.1 #8), and a weaker floor on "is this person a student at all" — accepted because 9.10 keeps UCA-verification in reserve as an escalation rather than a gate.

The invite system never tells an inviter which account redeemed their link. With a `max_uses = 1` invite handed to one person, the inviter can guess anyway — this is listed as an accepted linkage vector in 9.11. Invite issuance policy (who gets codes, how many) is a growth decision owned by PARTS 29–30; enforcement mechanics (`max_uses`, `expires_at`, atomic redemption) are fixed here.

### 9.2.2 Login

`/ingresar`: email + password, single screen. Failure copy never distinguishes wrong-email from wrong-password: "Correo o contraseña incorrectos." (account-enumeration hygiene; the signup form is the unavoidable enumeration oracle — Supabase's confirmation-resend behavior masks most of it, accepted residual). No OAuth providers, no magic links, no phone auth — every additional provider is surface, and a Google login would tie the account to a real-identity provider, which contradicts the product's privacy posture. Providers are disabled in Supabase config, not merely unused (10.10).

### 9.2.3 Email infrastructure

Auth email (confirmation, reset, email-change) goes through Resend free tier as custom SMTP (spine C15-b) with SPF + DKIM on our sending domain. Two binding rules: **auth emails never contain the user's handle** (an email inbox compromise must not link email → pseudonym; templates are generic: "tu cuenta" — never "tu cuenta MateConBizcochos"), and auth emails never embed content the user wrote. Resend free tier is currently ~100 emails/day (unverified — confirm at S0 setup; if lower, it still covers MVP volumes) **[FREE-TIER RISK]** — auth mail volume at MVP scale is tens per day; email notifications (P2) will need their own budget check in PART 21.

### 9.2.4 The logged-out boundary

**Decision (C16 applied to auth).** Logged-out visitors read everything public — posts, comments, materia/carrera pages, resource *metadata* — and can do exactly three things beyond reading: search, follow an invite link, and log in. No action verbs render for them; interactive elements swap for a quiet prompt: "Ingresá para comentar." Resource *downloads* require login: downloads consume metered egress **[FREE-TIER RISK]**, and requiring an account puts every download behind rate limits and an accountable identity without hiding the shelf (the metadata is what SEO and the utility magnet need, per D11). No per-page paywall dance, no "register to see more" dark pattern — the logged-out page is the honest page.

The auth boundary in code: public pages are Server Components reading `_public` views with the anon-role server client; there is no "maybe logged in" rendering path that could accidentally interpolate author data — anonymous rows arrive with author fields already NULL from the database regardless of who asks (10.2).

## 9.3 Session management

**Decision.** Cookie-based sessions via `@supabase/ssr`: `createServerClient` in Server Components / Server Actions / route handlers; a middleware `updateSession` pass refreshes tokens on navigation; JWT expiry 1 hour; refresh-token rotation with reuse detection (Supabase default) on.

Detail that matters:

- **All auth flows are server-mediated.** Sign-in, sign-out, password reset request, and the email-confirmation callback run in Server Actions or route handlers (`/auth/callback` for the PKCE code exchange). No Supabase client is instantiated in the browser for data; per D5/D6 the only client-side involvement is the auth handshake, and even that is reduced to form posts against server code. Because no browser JS needs to read the session, session cookies are set `httpOnly`, `secure`, `sameSite=lax`. If a future feature genuinely requires a browser Supabase client, cookies fall back to JS-readable (the `@supabase/ssr` default) and the XSS posture of 10.6 carries the extra weight — that trade is documented in `docs/decisions.md` when it happens, not silently.
- **Middleware role is refresh + redirect, never authorization.** The middleware refreshes expiring tokens and redirects unauthenticated visitors away from `/ajustes`, `/mod/*`, and write flows; it decides nothing about what a user may read or write — RLS and RPCs do (D5, D14). Matcher excludes static assets and public content routes (public pages render for logged-out visitors, C16).
- **Session invalidation.** Password change and email change revoke all other sessions (Supabase global sign-out). "Cerrar sesión en todos los dispositivos" is exposed in `/ajustes`. Rotating the project JWT secret is the global kill switch (signs out everyone; part of incident response, 10.14).

## 9.4 The pseudonym system

### 9.4.1 Handle rules

**Decision.** Handle = `^[a-zA-Z0-9_]{3,24}$`, at least one letter, stored in `profiles.handle` as `citext` (uniqueness and lookup case-insensitive; display preserves the case the user typed). No dots, hyphens, spaces, or non-ASCII.

Why this charset: handles live in URLs (`/u/[handle]`, D7) and must survive 10 years of copy-paste, printing, and search; dots break URL heuristics and email-lookalikes; Unicode invites homoglyph impersonation (`а` cyrillic vs `a` latin) that a small moderation team cannot police. The brief's example `Promedio4.9` (§7) becomes `Promedio4_9` — the flavor survives, the ambiguity does not. "At least one letter" prevents all-numeric handles that read as IDs. Changing a handle is `rename_handle(new_handle)` — a SECURITY DEFINER function that enforces every rule in this section in the database, so no app bug can bypass them (D14-4/9).

### 9.4.2 The blocklist

**Decision.** A migration-seeded `handle_blocklist` table checked inside `rename_handle`, with two match kinds: `exact` and `normalized`. Normalization lowercases, strips underscores, and maps common leet substitutions (`0→o, 1→l, 3→e, 4→a, 5→s, 7→t, @→a`) before comparison — so `m0derador`, `M_o_d`, and `an0nimo` are all caught.

| Category | Examples (non-exhaustive; full list is the seed migration) | Why |
|---|---|---|
| Authority impersonation | `moderador`, `mod`, `admin`, `administrador`, `staff`, `sistema`, `soporte`, `oficial`, `equipo` | A handle that looks like the platform speaking is a phishing tool |
| Anonymity collision | `anonimo`, `anonima`, `anon`, `anonymous` | "Anónimo" is a reserved display state; a user named Anonimo breaks the model |
| Institution | `uca`, `ucanet`, `ucarosario`, `rectorado`, `decanato` | Implied affiliation (legal research §8); D10 naming caution |
| System/deletion states | `usuario-eliminado`, `eliminado`, `deleted`, `root`, `api`, `www` | Collide with system-generated display names |
| Route words | every first path segment of D7 (`materias`, `carreras`, `recursos`, `buscar`, `ajustes`, `avisos`, `archivo`, `mod`, `p`, `u`, …) | Future-proofing URL space |
| Slurs | small curated es-AR list | Baseline decency; maintained by migration like any code change |

Rejection copy: "Ese nombre no está disponible." — identical for taken and blocklisted handles (no oracle for which names are reserved). Moderators can force-rename a handle to `usuario-<random>` as a mod action (impersonation or slur that escaped the list); this is audit-logged like any mod action (PART 11).

### 9.4.3 Suggested-name generator

Onboarding offers three suggestions (regenerable) built from es-AR student-culture word lists — pattern `<noun><modifier>`: "MateLavado", "FiscalDelAula3", "PromedioSufrido". Purely optional, client-side, from a bundled word list; it sets the register of the community's names without forcing anything. The generator must produce only blocklist-safe output (it draws from its own lists, so this is by construction).

## 9.5 Rename mechanics

**Decision (D3, C4).** One identity per account. Rename allowed every 90 days (`profiles.handle_changed_at`, enforced in `rename_handle`). Display rewrites everywhere automatically. No public rename history. Old handles are quarantined for 90 days before anyone else can claim them. `/u/old-handle` returns 404 — never a redirect.

Mechanics:

- **What rewrites:** everything rendered by joining `profiles` at read time — posts, comments, resources, votes-derived displays. Because author display is never denormalized into content rows (PART 8), a rename is a single UPDATE; every page shows the new handle on next render. One deliberate exception: `notifications.actor_display` is precomputed at notification time (D4) and old notification rows keep the old handle. Accepted: notifications are private to their recipient, short-lived, and rewriting them would cost a backfill job for near-zero privacy gain.
- **Quarantine:** an internal `handle_history` row (profile_id, old_handle, changed_at) is written on every rename. `rename_handle` rejects any handle present in `handle_history` newer than 90 days unless it belongs to the requesting profile. This prevents identity takeover ("MateConBizcochos renamed, I'll grab MateConBizcochos and inherit their reputation"). The table is internal-only (no client-role SELECT; RLS deny-all) — it is also a moderation aid for abuse linkage. PART 8 includes it.
- **No redirect from the old handle** is a privacy requirement, not a UX oversight: a 301 from `/u/oldname` to `/u/newname` would publish exactly the linkage that renaming tries to soften.

**The timing-diff linkage risk, stated honestly.** Renaming does not un-ring the bell. Anyone who saved, screenshotted, or archived a page before the rename can diff it against the page after and connect old name to new. Search-engine caches and the Wayback Machine do this passively. In a community of hundreds, an attentive watcher will notice "user X's posts now say Y." Therefore the product treats rename as *identity refresh* (you outgrew a joke name), not as a privacy tool — and says so in the settings UI, next to the button: "Cambiar tu nombre no borra el pasado: una página guardada puede vincular tu nombre viejo con el nuevo. Para publicar algo delicado, usá la opción Anónimo." Per-post anonymity is the real tool for sensitive speech (C4's resolution). Reputation continuity through rename is automatic — karma, follows, and content all hang off the profile UUID, not the handle — which answers brief §52's question about changing pseudonyms without breaking historical reputation.

## 9.6 Anonymous publishing

### 9.6.1 What anonymous content exposes

**Decision (C5 taken to its conclusion).** The public payload of anonymous content contains **no author-derived fields at all**. The brief asks (§7) to "think carefully" about avatar, karma, account age, posting history, badges — the answer to every one is *no*.

| Author-derived field | Shown on anonymous content? | Note |
|---|---|---|
| Handle | No | Label is "Anónimo" / per-thread alias (9.6.2) |
| Avatar | No | Avatars do not exist in MVP anyway (D2); the rule outlives that |
| Karma | No | Also not incremented visibly in real time (9.7) |
| Account age / join date | No | |
| Posting history link | No | No profile link at all; nothing clickable |
| Badges / role | No | A mod posting anonymously shows as plain "Anónimo" |
| Carrera / año | No | Even though it would be "useful context" — it shrinks the anonymity set to a cohort of ~30 |
| Creation timestamp | Yes | Content metadata, not author metadata; timing risk accepted and documented in 9.11 |
| "editado" marker | Yes | Shown without a rewrite history; edit times not itemized |

Enforcement is structural, not disciplinary: public reads go only through `posts_public` / `comments_public` / `resources_public` views that emit `NULL` for every author column when `is_anonymous` (D5, D14-5), and the pgTAP suite proves it (10.2). A frontend bug cannot leak what never left the database.

`is_anonymous` is **immutable after creation** (enforced by trigger/constraint in PART 8). Un-anonymizing a post would retroactively attach a name to something written under a different assumption; anonymizing a named post would let users dodge accountability for a conversation others already responded to under a known identity. If you regret the choice either way: delete and repost. The composer states the choice plainly: "Publicás como Anónimo. Esto no se puede cambiar después."

### 9.6.2 Per-thread anonymous aliases

**Decision (D3).** Within a single post's comment thread, each anonymous author gets a stable numbered label — "Anónimo 1", "Anónimo 2", in order of first anonymous appearance — via the `anon_aliases` table (`post_id`, `author_id`, `alias_num`; PK (`post_id`, `author_id`)). If the post itself is anonymous, its author is labeled "Anónimo (autor)" on the post and on their anonymous comments in that thread. Aliases never carry across threads.

Why: pure "Anónimo" on every comment makes conversations unreadable ("which anonymous said that?"); per-thread numbering restores dialogue coherence while keeping cross-thread linkage impossible — the alias space resets at every post. The "(autor)" tag applies **only when the post is anonymous AND the comment is anonymous**; if a pseudonymous OP comments anonymously in their own thread, they receive a plain "Anónimo N" like anyone else — otherwise the tag would deanonymize them. Similarly, a user who comments both pseudonymously and anonymously in one thread gets no visible connection between the two: the alias links only their anonymous items.

Assignment happens **inside the `create_comment` and `create_post` SECURITY DEFINER functions**, atomically with the insert: on an author's first anonymous contribution to post P, insert (P, author, next alias) where "next" is `max(alias_num) + 1` over the post's existing aliases, computed under a per-post transaction-scoped advisory lock (`pg_advisory_xact_lock` keyed on the post id) — no counter column on `posts`, no gaps, no race producing two "Anónimo 2". The table has no SELECT policy for any client role; only the definer functions write it, and only the public views' rendering path (server-side, definer) and the mod panel's break-glass flow (9.12) read it.

### 9.6.3 Why a mapping table and not a hash

Considered: computing the alias as `HMAC(secret, post_id ‖ author_id) mod k` — stateless, no table.

Chosen: the explicit table.

Why: (1) **A keyed hash creates a skeleton key.** Whoever holds the secret can test any (candidate author × post) pair offline and confirm authorship of *every anonymous item in history*; the user base is small enough (hundreds) to enumerate in milliseconds. A table is data — protected by the same RLS, audited on access, restorable from backup — with no single value whose theft unlocks the past. (2) **Rotation breaks labels.** If the secret ever leaks or must rotate, every historical alias either changes ("Anónimo 2" silently becomes "Anónimo 5" in a 2027 thread — archive corruption) or we freeze old labels, which means building the table anyway. (3) Modular reduction produces collisions — two authors sharing "Anónimo 3" in one thread — unacceptable for dialogue coherence. The table costs one insert per first anonymous appearance; at our scale that is nothing.

Cost: the table is itself crown-jewel data (it maps anonymous items to authors) and appears as asset A1 in the PART 10 threat model.

## 9.7 Karma without timing leaks

**Decision (C5).** `profiles.karma` is a single integer, recomputed **once nightly** (04:00 ART, the daily Vercel cron from D6) as a full aggregate over the votes tables: karma = upvotes received on all the user's posts + comments + resources, anonymous and pseudonymous alike. Karma never changes intra-day, and is never itemized anywhere ("+3 por tu publicación" does not exist).

**Considered:** per-domain karma (a score per materia), endorsement counts ("me ayudó" tallies per contribution), Discourse-style trust levels, a single quiet integer.
**Chosen:** the single quiet integer.
**Why:** legibility at small scale (one number a student can understand at a glance), no status theater (levels and badges manufacture hierarchy the community does not need — C10), and compatibility with the anonymity batching below (one aggregate is trivially recomputed nightly; per-domain or per-item tallies multiply the timing channels to defend).
**Cost:** a coarser signal — karma says "contributes" without saying where or how; revisit at 10k users.

Why a full nightly recompute instead of live increments with batching only for anonymous content:

- **The leak (restated):** if karma updated the moment a vote landed on an anonymous post, a watcher displaying a profile page and the post side by side correlates the increments and unmasks the author. Batching to daily granularity collapses the timing channel from seconds to a day.
- **Uniformity kills a second-order channel and halves the code.** With live pseudonymous karma + batched anonymous karma, a watcher can compute the *residual*: today's karma delta minus the visible gains on the user's named content = their anonymous gains. One nightly job for everything means one code path, and the residual can only be computed at day granularity against the whole day's site activity.
- **Full recompute is self-healing.** Vote retractions (toggling an upvote off), mod deletions, and account deletions all change the correct total; an incremental ledger drifts, an aggregate cannot. At MVP scale (thousands of votes) the recompute is a single sub-second `UPDATE ... FROM (SELECT author_id, count(*) ...)`; if it ever measures slow, it becomes incremental *then* (PART 21 watches cron duration).

**Honest residual risk, accepted:** at day granularity in a small community, an obsessive observer who tracks every visible post's score daily could still infer "user X gained N anonymous upvotes yesterday" and try to match N against anonymous posts' score changes. Defenses considered (rounding displayed karma to the nearest 5/10, weekly batching) trade legibility for marginal protection against an adversary for whom stylometry (9.11) is already a cheaper attack. MVP displays the exact integer (C10: "one number, shown quietly"); the risk is documented here and in the ToS's honest-limits language (9.11.2). Karma is never shown on anonymous content itself (9.6.1), and the nightly job runs at a fixed hour so its writes carry no per-event timing information at all.

## 9.8 Account recovery while publicly anonymous (brief §52)

**Decision.** Standard email-based password reset, unchanged from Supabase's flow — because the email address is never public, recovery leaks nothing. If a user loses both the password and access to the email account, **the account is unrecoverable, permanently, by design.**

The reset flow: "¿Olvidaste tu contraseña?" → email entry → reset link (1-hour expiry, single-use) → new password → all other sessions revoked. Response copy is identical whether the email exists or not: "Si esa dirección tiene una cuenta, le mandamos un enlace para restablecer la contraseña." Reset emails follow the 9.2.3 rule — no handle, no content, generic wording — so an email-inbox intruder learns only that *some* account exists, not which pseudonym it is.

Why unrecoverable-by-design is correct and not lazy: any manual recovery path ("contact support and prove the account is yours") requires us to verify a real-world identity, which requires us to *hold* something that links the pseudonym to a person — precisely what the architecture refuses to hold (§8). A support channel that unlocks accounts on a convincing story is also the #1 social-engineering vector against pseudonymous platforms; the doxxer adversary of PART 10 would use it within a week. The honest trade is stated in `/ajustes` and in the help page: "Si perdés el acceso a tu correo y también tu contraseña, la cuenta no se puede recuperar. Nadie —tampoco nosotros— puede devolvértela. Es el costo de que no guardemos tu identidad real. Mantené tu correo al día." Email changes require confirmation on **both** the old and new address (Supabase secure email change, 10.10), so a hijacked session cannot silently rotate the recovery anchor.

## 9.9 Account deletion

**Decision (D3).** Deletion is self-service in `/ajustes`, requires password re-entry, and presents exactly two options for the user's content:

1. **"Borrar mis publicaciones"** — every post, comment, and resource authored by the account is soft-deleted (`status = eliminado_autor`, body/files nulled per the lifecycle rules in PART 16), then the account is erased.
2. **"Conservar mis publicaciones como usuario eliminado"** — content remains, attributed to an anonymized shell: handle becomes `usuario-eliminado-<random4>`, profile fields (carrera, año, karma) nulled, profile page returns 404.

In both cases: the `auth.users` row is deleted (email gone from the system), `profiles` is anonymized in place (the UUID must survive as an FK target), anonymous content stays anonymous (option 2) or is deleted (option 1) — the choice applies uniformly. `mod_actions`, `reports`, and `user_restrictions` retain the internal UUID only (D3): moderation history must survive the person leaving, but after deletion the UUID resolves to nothing personal.

Execution is immediate — no grace period. Considered a 72-hour cooling-off window (protects against rage-quit and hijacked-account deletion); rejected for MVP because it requires a pending-deletion state machine and a cancellation email flow, while the actual protections (password re-entry + typed confirmation "eliminar mi cuenta") cover the hijack case at near-zero complexity. Revisit if a real incident occurs.

**Ban-evasion carve-out:** an account under an active permanent ban may delete its account, but a salted HMAC of the email is retained in `user_restrictions` until the restriction would have expired (forever, for permanent bans), and registration checks new emails against it. Plaintext email is still erased — the hash serves exactly one purpose (re-registration matching) and cannot be reversed into an address. This is a data-minimization-consistent retention; note it in the privacy policy. **[LEGAL REVIEW]** — retention of a ban-enforcement hash post-deletion under Ley 25.326 arts. 4/16.

Deletion copy is honest about the archive trade (C6): "Borrar tu cuenta es definitivo. Elegí qué pasa con lo que escribiste. Lo que borres desaparece también del archivo."

## 9.10 Optional UCA-email verification (later escalation) **[HUMAN DECISION]**

**Decision (deferred, designed).** MVP ships without it (D3: invite gating handles density and spam). The escalation, if activated in a later phase: a user may verify control of an `@uca.edu.ar` mailbox via a one-time code; the system stores only `uca_verified boolean` plus a salted hash of the UCA address (uniqueness: one UCA mailbox verifies at most one account) — **never the address itself**, and never any public badge.

Its only permissible uses, in escalation order: (a) requiring verification to create *new* accounts during a spam/brigading wave (existing accounts untouched); (b) requiring it for high-abuse actions (resource upload) if uploads are weaponized. Explicitly prohibited uses: public "verificado" badges (splits the community into castes and shrinks the anonymity set of everyone unverified), verified-only content, and any display of verification state. The founder decides *whether and when* to activate, because it changes the platform's social contract ("cualquiera con el enlace" → "estudiantes comprobados") and slightly increases what a subpoena can extract (the hash confirms institution membership). **[HUMAN DECISION]**

## 9.11 Deanonymization threat analysis

**Decision.** We enumerate every linkage vector, defend the ones an architecture can defend, and *say in the product and the ToS* which ones we cannot. Honesty here is a feature: users calibrate what they write to real protection, not imagined protection. Aligned with the legal research (scratchpad `legal-ar`): what we log is what a court can make us disclose.

### 9.11.1 Vector table

| # | Vector | Adversary | Can they link author ↔ anonymous content? | Our defense |
|---|---|---|---|---|
| 1 | Direct DB access | Ourselves (founder/operator) | Yes, totally | None technical — procedural only (10.4, 10.13, 10.15: disk crypto, access discipline, audit). Users must trust the operator; the ToS says so plainly |
| 2 | Court order / medida de prueba anticipada | Angry professor with a lawyer; any litigant | Yes — we hold `author_id`, email, timestamps | None, by law. We comply with valid orders (legal-ar §3). Mitigation is *minimization*: we never log IPs in our tables, hold no real names, no phone. What does not exist cannot be disclosed |
| 3 | Infrastructure logs | Supabase/Vercel internals, or their subpoena | Partial (IPs, access logs, their retention windows — unverified) | Outside our control; named in the privacy policy as processor-held data **[LEGAL REVIEW]** |
| 4 | Timing analysis | Curious classmate, doxxer | Weak inference (posting hours, karma-day residuals per 9.7) | Partial: karma batching, no "online" indicator, no last-seen, no read receipts. Exact content timestamps are kept (archive value, C16) — accepted |
| 5 | Writing-style analysis (stylometry) | Anyone who reads | **Yes, plausibly, in a ~30-person cohort** | **Not defended.** Warned in-product (below) |
| 6 | Content self-disclosure | Anyone | Yes — users name their comisión, their schedule, their grade | Not defensible by architecture. The composer warning covers it |
| 7 | Rename diffing | Anyone with an old screenshot/cache | Links old handle ↔ new handle (not anonymity itself) | Accepted per 9.5; renames are not a privacy tool |
| 8 | Invite linkage | The person who invited you | Guessable for single-use invites | Internal only; the system never confirms it (9.2.1) |
| 9 | Per-thread alias correlation | Anyone reading a thread | Links your anonymous comments *within one thread* by design | Intentional (dialogue coherence); reset per thread (9.6.2) |
| 10 | Malicious/curious moderator | Insider with mod role | Only via break-glass reveal, which is audit-logged | 9.12 and 10.11: authorship hidden by default in the mod panel; reveal is an explicit, logged act |
| 11 | Compromised founder laptop | External attacker | Yes, totally (= vector 1) | 10.13 hardening; 10.14 response |
| 12 | Uploaded-file metadata | Anyone who downloads | PDF Info dict often carries the author's real name; image EXIF carries device/GPS | Defended: EXIF stripped, PDF metadata stripped best-effort at finalize (10.8), plus composer warning |

The stylometry warning, shown next to the Anónimo checkbox the first few times a user checks it: "Anónimo oculta tu nombre, no tu forma de escribir. En un curso chico, un estilo reconocible puede delatarte." Vector 5 and 6 together are, realistically, how anonymous authors actually get identified in small communities — not by breaking the database. Saying this in-product is the single highest-value privacy feature we can ship.

### 9.11.2 What the ToS must honestly promise **[LEGAL REVIEW]**

The ToS/privacy policy must promise exactly what the architecture delivers — no more:

- "**Anónimo** significa que otros usuarios y visitantes no ven tu identidad. El sistema sí registra qué cuenta publicó cada contenido." (§8 compliance: internal traceability disclosed.)
- "Nunca publicamos, vendemos ni compartimos tu identidad. La entregamos únicamente ante una orden judicial u obligación legal válida en Argentina." (Rodríguez/medidas de prueba reality, legal-ar §2–3. Do **not** promise "solo con orden judicial" for manifestly unlawful content categories where counsel advises broader duty — wording is counsel's.)
- "No registramos tu dirección IP en nuestra base de datos. Nuestros proveedores de infraestructura pueden registrar datos técnicos según sus propias políticas." (True statement of vector 3.)
- "El anonimato tiene límites técnicos: tu estilo de escritura, los horarios en que publicás o los detalles que contás pueden identificarte. Publicá con criterio." (Vectors 4–6.)
- "Si perdés tu correo y tu contraseña, la cuenta no se recupera." (9.8.)
- Deletion, retention (backup 90-day window, 10.15; 7-day ephemeral `download_log`, per PART 8; ban-hash carve-out, 9.9) and the ARCO request channel (legal-ar §1) round out the policy; drafting is counsel's, content inventory is this table's.

### 9.11.3 The disclosure inventory — everything a valid court order can obtain

Per the legal research (§3: "what you log is what you can be forced to disclose"), this is the exhaustive list of identifying or linking data the system holds. Anything absent from this table does not exist to be disclosed, and keeping the table short is a standing design constraint — any migration that adds a row to it needs a reason recorded in `docs/decisions.md`:

| Data | Table | Links |
|---|---|---|
| Email address | `auth.users` | account → real-world inbox |
| Authorship of all content, incl. anonymous | `posts`/`comments`/`resources.author_id`, `anon_aliases` | content → account |
| Content + edit timestamps | content tables | activity patterns |
| Votes cast | `*_votes` | reading/engagement patterns |
| Resource downloads, last 7 days only | `download_log` | download activity; ephemeral — exists solely for rate-limiting and per-user-day dedup, purged after 7 days (per PART 8) |
| Materia follows, carrera/año if provided | `materia_follows`, `profiles` | cohort membership |
| Invite lineage (who created the code you used) | `invites`, profile invite ref | social graph fragment |
| Handle history | `handle_history` | past identities |
| Moderation history | `reports`, `mod_actions`, `user_restrictions` | conduct record |
| Ban email HMAC (banned accounts only) | `user_restrictions` | re-registration matching only |

Deliberately never collected: IP addresses (in our tables), device identifiers, phone numbers, real names, location, contact imports, read logs / per-user page views (PART 24's `events` is day-bucketed and non-attributed). Infrastructure processors (Supabase, Vercel, Resend) hold their own technical logs under their own policies — named in the privacy policy, outside this inventory. **[LEGAL REVIEW]** counsel confirms the release standard (court order vs. prosecutor request) per legal-ar §3-a.

## 9.12 The moderation–anonymity trade-off at the identity level (brief §53)

**Decision.** Anonymity is a *display-layer* property; accountability is an *account-layer* property. Because every anonymous act is internally attributed, the full moderation arsenal — warnings, content removal, rate limits, suspensions, bans (PART 11) — binds to the account identically whether the content was anonymous or not. **Anonymity buys an abuser nothing.** What we categorically refuse is the converse: using identity exposure as a punishment. No public unmasking, ever, for any offense — a banned user is banned, not exhibited.

This resolves §53 without the false dilemma the brief warns against ("do not solve this by destroying anonymity"). The classic failure of anonymous communities is *unaccountable* anonymity (4chan-style: no persistent account behind the mask) or *punitive deanonymization* (which chills exactly the speech anonymity exists for — the "¿al profesor X le pasa algo conmigo?" post that is valuable and only happens anonymously). Our model is the third path: masks for the audience, names for the ledger.

Identity-level mechanics that make it work (operational flows in PART 11):

- **Default-blind moderation.** The mod queue shows reported content *without* author identity — mods judge the content, not the person. A "Revelar autor" break-glass action resolves authorship (including through `anon_aliases`) when pattern detection requires it (serial harasser across threads); every reveal writes an immutable `mod_actions` row (who revealed, what, when, stated reason). Curiosity has a cost trail; PART 11 defines review of reveal logs.
- **Restrictions follow the account.** A user suspended for anonymous harassment is suspended, full stop — their pseudonymous life stops too. This coupling is the deterrent: the mask does not protect the account.
- **Rate limits are identity-blind** (10.9): the same in-DB checks apply to anonymous and named actions, so anonymity provides no throughput advantage for spam.
- **Reports work on anonymous content** exactly as on named content (D14-10): reporters never need to know who the author is for the report to route, and the report row references the content, not the author.
- **The moderated user is always notified** ("Tu publicación fue eliminada por infringir las Reglas": D3's "never anonymous to yourself") — due process does not require public identity.

What this costs: moderators cannot crowdsource reputation judgments ("this user is always toxic") from the community, because the community cannot see patterns across anonymous items — only mods can, via break-glass. That labor lands on the mod team and is priced into C13/PART 11.

---

# PART 10 — SECURITY

## 10.1 Threat model

**Decision.** Security effort is allocated by this model, not by generic checklist order. The crown jewel is the authorship map of anonymous content; the design goal is that compromising it requires compromising the database or the operator — never just the app, an API, or a moderator account.

### 10.1.1 Assets

| # | Asset | Where it lives | Impact if compromised |
|---|---|---|---|
| A1 | Anonymous-authorship map (`author_id` on anonymous rows, `anon_aliases`) | Postgres | Users harmed in real life (a doxxed critic of a professor faces academic retaliation); platform trust unrecoverable — this is the existential asset |
| A2 | Email ↔ handle mapping | `auth.users` + `profiles` | Real-world identity linkage for every user; phishing substrate |
| A3 | Mod queue: reports, reporter identities, internal notes | Postgres | Retaliation against reporters; harassment intelligence |
| A4 | Session tokens | Cookies / Supabase | Account takeover |
| A5 | Service-role key, DB password, JWT secret, CRON_SECRET | Vercel env, founder machine | Equivalent to A1+A2+A3 at once |
| A6 | Backups (dumps contain A1+A2+A3) | Off-site storage | Same as A5, often with weaker protections — 10.15 exists for this |
| A7 | Invite graph, `handle_history` | Postgres | Secondary linkage intelligence |
| A8 | Integrity/availability of public content | Postgres/Vercel | Defacement, spam floods — recoverable but reputation-costly |

### 10.1.2 Adversaries

| Adversary | Capabilities | Wants | Representative attacks |
|---|---|---|---|
| Curious classmate | Browser, free time | Unmask a specific anonymous post | Timing/stylometry (9.11), profile scraping, alias correlation |
| Doxxer | Motivated individual; scripting; social engineering | Unmask + harm a target | Password reset phishing, fake "support" contact, scraping + archive diffing, probing API with anon key |
| Spammer | Automation, disposable emails | Reach/SEO spam, ad floods | Invite farming, bulk accounts, upload abuse, vote rings |
| Angry professor with a lawyer | Cartas documento, subpoenas, trademark lever (legal-ar §8) | Content removal + author identity | Legal demands for A1 data; pressure via naming (D10) |
| Compromised founder laptop | Malware/theft → everything the founder has | Varies (often untargeted) | Exfiltrate `.env`, GitHub/Vercel/Supabase sessions, backups |
| Malicious moderator | Mod panel access | Unmask or harass | Break-glass abuse, queue mining, quiet censorship |

### 10.1.3 Attack surfaces and the mitigation map

Enumerated surfaces, each with its owning control (details in the numbered sections):

1. **Supabase Data API (PostgREST) + Auth API** — publicly reachable by anyone holding the anon key, which ships in the client bundle and is treated as public information. This is *the* reason D5/D14 put RLS and grants as the authoritative boundary: the app's server-only data path (10.3) is a quality choice, not the security boundary. Controls: 10.2, 10.9, 10.10.
2. **Next.js Server Actions / route handlers** — input validation (10.5), CSRF posture (10.6), rate limiting (10.9).
3. **Storage endpoints** — signed-URL-only access, upload pipeline (10.8).
4. **Auth flows (email)** — hardening checklist (10.10), generic templates (9.2.3).
5. **Mod panel** — role model (10.11), audit (10.12), default-blind design (9.12).
6. **Supply chain: npm, GitHub Actions, AI-generated code** — 10.13.
7. **Operator accounts: GitHub, Vercel, Supabase, registrar, founder email** — 10.13; these are the identity roots; registrar + email compromise = full takeover with no code involved.
8. **Backups** — 10.15.

## 10.2 RLS strategy and the pgTAP proof obligation

**Decision (D5, D14-2; full policy DDL in PART 8).** RLS is enabled on every table with a default-deny posture: base content tables grant no SELECT to `anon`/`authenticated`; public reads go exclusively through `_public` views that null author fields on anonymous rows; all multi-step writes are SECURITY DEFINER functions with pinned `search_path`. Every policy ships with pgTAP tests proving **both the allow and the deny**, run by `supabase test db` in CI on every PR; a policy without its pair of tests fails review.

Summary of the pattern (PART 8 owns per-table detail):

- **Views run with owner privileges** (Postgres default) — deliberate here: the view is the sanctioning lens over tables the client roles cannot touch directly. The views expose no internal columns (`author_id` only when not anonymous, never emails, never `anon_aliases`, never mod notes).
- **Writes never hit tables directly from client roles.** `create_post`, `create_comment`, the `toggle_*_vote` functions, `create_report`, `rename_handle`, `request_upload`/`finalize_upload` — plus `handle_new_user`, the trigger that consumes invites at user creation — are the write API (full RPC inventory in PART 8 §8.5); each validates, rate-limits (10.9), and maintains counters atomically. INSERT/UPDATE/DELETE grants on content tables for client roles: none.
- **The proof obligation is a named test list.** The canonical anonymous-content quartet, mandatory before anything else: (1) `posts_public` returns NULL author fields for anonymous rows to every client role; (2) no client role can SELECT base `posts`/`comments`/`resources`; (3) `is_anonymous` cannot be changed after insert by any client-reachable path; (4) `anon_aliases` and `handle_history` are unreadable and unwritable by all client roles. These four tests are the machine-checked form of the product's core promise; they run green before the first beta user exists, and no migration merges if they break.

## 10.3 The server-only data path

**Decision (D5).** The browser talks only to Next.js; all reads run in Server Components and all writes in Server Actions/route handlers, executing as the *user's* session (via `@supabase/ssr`) so RLS evaluates the real `auth.uid()`. No client-side Supabase data queries exist. Realtime: off.

Security consequences worth stating: (a) the client bundle contains no query logic to reverse-engineer beyond what pages visibly show; (b) every write funnels through one auditable directory of Server Actions, each starting with a Zod parse — the "one obvious place" that makes AI-assisted development reviewable (D14-4); (c) because the anon key is nonetheless public (10.1.3 surface 1), the pgTAP suite — not this path — is what we trust. The server-only path is defense-in-depth and consistency, not the wall.

### 10.3.1 The write API surface, enumerated

This table is the **authoritative Server Action / route-handler inventory** — camelCase actions, each calling one of the SECURITY DEFINER RPCs whose authoritative inventory (final names, signatures, bodies) is PART 8 §8.5. A mutation that is not on this list (or added to it by migration + review) does not exist; security duties are binding here:

| Server Action / handler | RPC called (PART 8 §8.5) | Security duties beyond validation |
|---|---|---|
| `signUp` (registro) | `handle_new_user` (trigger) | Action validates the invite read-only; the trigger consumes it atomically at user creation — `uses` check-and-increment + expiry re-check in the profile-creation transaction (9.2.1) |
| `completeOnboarding` | `complete_onboarding` | Handle rules + carrera/año + auto-follows in one transaction |
| `renameHandle` (`/ajustes`) | `rename_handle` | Charset, blocklist (normalized match), 90-day cooldown, quarantine check, `handle_history` write |
| `createPost` (composer) | `create_post` | Rate limit, length caps, `is_anonymous` fixed at insert, anon alias for anonymous OP, counter init |
| `createComment` (thread) | `create_comment` | Rate limit, depth ≤ 2, alias assignment on first anonymous appearance, `comments_count` + `last_activity_at` bump, `locked_at` refusal |
| `togglePostVote` / `toggleCommentVote` / `toggleResourceVote` | `toggle_post_vote` / `toggle_comment_vote` / `toggle_resource_vote` | Rate limit, idempotent toggle, score counter, no self-vote |
| `toggleFollow` (materia pages) | `toggle_follow` | Rate limit; idempotent |
| `createReport` (report dialog) | `create_report` | Rate limit, exactly-one-target CHECK, dedupe (same reporter + target open report) |
| `createResourceDraft` / `finalizeResource` (resource composer) | `request_upload` / `finalize_upload` | Quota + rate limit; sniff, strip, move from quarantine (10.8) |
| `requestDownload` (resource page) | `register_download` | Auth required; rate limit + user-day dedup via `download_log` (per PART 8); mints the 120 s signed URL |
| `createAppeal` (`/apelacion`) | `create_appeal` | One appeal per mod action, author check via the action's target, body cap |
| `deleteOwnContent` (author UI) | `delete_own_content` | Ownership check, soft-delete status, body/file nulling |
| `deleteAccount` (`/ajustes`) | `delete_account` | Reauth asserted by caller, two-option content handling, profile anonymization, ban-hash carve-out (9.9) |
| `/api/cron/aggregates` route handler (service role + CRON_SECRET) | karma recompute + `reconcile_counters` + retention purges | Full aggregate rewrite (9.7); bearer-secret gate (10.4) |
| Admin actions | `set_role`, `set_kill_switch` | Role check in-function, mandatory `mod_actions` row |
| Mod panel actions | `mod_*` family (incl. the audited author-reveal) | Role check, audit row with stated reason (9.12); enumerated in PART 11 |

Every RPC: pinned `search_path`, rate-limit check where user-initiated (mechanism per PART 11 §11.6.2 and 10.9), typed error codes the UI maps to es-AR copy. pgTAP covers each function's deny case (wrong role, over limit, not owner) alongside the RLS policy tests (10.2).

## 10.4 Secret management

**Decision.** Secrets live in exactly two places: Vercel project env vars (production) and the founder's local `.env.local` (gitignored; `.env.example` documents names only). The service-role key is configured **only** for cron route handlers (guarded by a `CRON_SECRET` bearer check) and manually-run admin scripts — it appears in no request-serving code path (D14-3). Any `NEXT_PUBLIC_`-prefixed variable is audited at review time against a whitelist (Supabase URL, anon key, site URL — nothing else).

Rotation: on any suspected exposure, immediately; on calendar, every 6 months for the service-role key and CRON_SECRET (a 15-minute ritual, documented in the runbook). JWT secret rotation is the break-glass session revoker (all users signed out) — used in incidents, not on calendar. Database password: long random, stored only in the founder's password manager; Supabase dashboard access protected with strong password + TOTP. GitHub: secret scanning + push protection enabled on the repo; a leaked-then-rotated key still gets a postmortem line in `docs/decisions.md`.

Dev/prod isolation: a **separate free Supabase project for development** — local `.env` compromise then yields nothing production-grade, migrations get rehearsed before prod, and seed data can be fake. This costs zero (two free projects are allowed; the dev project pausing after inactivity is harmless).

## 10.5 Input handling

**Decision.** Zod schemas at every Server Action boundary (shared in `lib/validation`, D14-4); React's default escaping everywhere; `dangerouslySetInnerHTML` banned by lint rule; and for user text rendering:

**Considered:** full Markdown (remark + sanitizer); a Markdown subset; plain text + linkification + line breaks.
**Chosen:** plain text + linkification + line breaks only, in MVP. No user HTML, no Markdown.
**Why:** it deletes the XSS-via-rich-text class instead of managing it — no sanitizer to configure, no sanitizer CVEs to track, no AI-generated "just render it" regressions to catch in review. It also fits the product: students write prose and paste links; the editorial density of D8 needs paragraphs, not headers-in-comments.
**Cost:** no bold, lists, or code blocks. Real cost for apuntes-style long posts; revisit at P2 with a strict allowlist renderer if users demonstrably need structure. The composer says nothing about formatting — plain text is self-explanatory.

Rendering rules (exhaustive): text nodes escaped by React; newlines → paragraphs/`<br>`, runs of 3+ newlines collapsed to 2; URLs matched on `https?://` schemes only (no `javascript:` by construction), rendered as `<a rel="nofollow noopener ugc">` with display text truncated at 60 chars; control characters stripped and input NFC-normalized at the Zod layer; length caps enforced server-side (title ≤ 120, body ≤ 10k, comment ≤ 5k — final numbers in PART 8 constraints, enforced in both Zod and CHECK constraints so neither layer can drift alone). Handles interpolated into copy are safe by charset (9.4.1). Search input goes through `websearch_to_tsquery` (never raw `to_tsquery` — user syntax errors become empty results, not exceptions).

## 10.6 XSS and CSRF posture

**Decision.** XSS: no user HTML (10.5) + React escaping + a CSP. CSRF: Next.js Server Actions' built-in Origin/Host verification + `sameSite=lax` cookies + a no-state-changing-GET rule.

- **CSP** (set in `next.config` headers): `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' <supabase-host> <sentry-ingest>; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`. Next.js's inline runtime scripts require either nonces (middleware-generated) or hashes; S0 implements the nonce pattern — if it fights the framework version in use, the documented fallback is `script-src 'self' 'unsafe-inline'` with the gap recorded in `docs/decisions.md` and revisited each Next upgrade. `style-src 'unsafe-inline'` is accepted (Tailwind inlines nothing user-controlled).
- Companion headers: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Permissions-Policy` denying camera/mic/geolocation.
- **CSRF:** Server Actions reject cross-origin invocation (Next verifies Origin against Host); mutation route handlers (only the auth callback and cron endpoints exist) verify origin or bearer secret respectively; cookies are `sameSite=lax` so cross-site POSTs don't carry the session; GET handlers never mutate (lint-enforceable convention: mutations live in Server Actions only).
- **Third-party scripts: zero.** No analytics tags, no CDN scripts, no fonts from Google (D6/D8 self-host); Sentry's SDK is bundled from npm and posts to its ingest host listed in `connect-src`. Every absent third-party script is an XSS vector that cannot exist.

## 10.7 SQL injection stance

**Decision.** No string-concatenated SQL anywhere in the codebase, in any layer. App-layer queries use the supabase-js builder (parameterized) or call RPCs with typed parameters; SQL functions use parameters and static SQL; dynamic SQL (`EXECUTE format(...)`) is forbidden in application functions — if a migration utility ever needs it, `%I`/`%L` quoting plus a review flag is mandatory. This is a lint/review rule stated in the AI coding contract (PART 26) because AI assistants *will* propose template-literal SQL the first time a query gets awkward; the rule exists to make that a mechanical rejection. FTS input handling per 10.5. `search_path` pinned (`SET search_path = public, pg_temp`) on every SECURITY DEFINER function — the classic Supabase privilege-escalation footgun.

## 10.8 File upload security **[FREE-TIER RISK]**

**Decision.** Uploads go **directly from the browser to Cloudflare R2** (per §0.5-R17 all resource files live on R2 from the first upload; Supabase Storage is unused in MVP) using single-use signed upload URLs minted server-side, then a `finalize_upload` step validates and processes server-side. Direct-to-storage is forced, not chosen: Vercel functions cap request bodies at ~4.5 MB, and D2 allows files to 10 MB — proxying uploads through Next.js is impossible on Hobby. PART 14 owns the canonical pipeline spec; this section states its security duties.

The pipeline:

1. **Request:** the `createResourceDraft` Server Action calls the `request_upload` RPC, which checks auth, per-user quota and rate limits (10.9), allowed type, size ≤ 10 MB → the action returns a signed upload URL (120 s TTL) targeting a quarantine path `incoming/{upload_nanoid}` — storage paths never contain user ids or original filenames. Bucket is private; no public or anonymous writes exist.
2. **Upload:** browser PUTs the file to R2. Nothing is published yet.
3. **Finalize:** the `finalizeResource` Server Action calls the `finalize_upload` RPC and fetches the object server-side to validate for real: **magic-byte sniffing** (`%PDF-`, PNG/JPEG/WebP signatures) — the declared MIME and filename extension are treated as attacker-controlled hints, nothing more; actual size from storage metadata re-checked; then per-type processing: **images** are re-encoded with sharp (strips EXIF — GPS coordinates in a photo of apuntes would deanonymize an uploader; re-encoding also neutralizes polyglot files); **PDFs** get their Info dictionary/XMP metadata stripped best-effort with pdf-lib (exported PDFs routinely embed the author's real name — vector 12 in 9.11.1); on PDF parse failure the upload proceeds but the uploader sees: "No pudimos limpiar los metadatos de este PDF. Puede incluir tu nombre u otros datos del programa que lo creó. Revisalo antes de publicar." The object then moves to its permanent path `r/{resource_public_id}/{file_nanoid}.{ext}` (extension derived from the *sniffed* type) and the `resource_files` row is written via the same definer function; the resource row sits in status `borrador` until publish sets `activo` (per PART 14).
4. **Orphan cleanup:** the daily cron deletes quarantine objects older than 24 h.

Serving: downloads only via short-TTL signed URLs (120 seconds, single purpose — the same TTL as upload URLs) generated by a Server Action that checks auth and increments `downloads_count` user-day-deduped through the ephemeral `download_log` (`register_download`, per PART 8); `Content-Disposition: attachment` with a sanitized ASCII filename + RFC 5987 UTF-8 fallback — files are downloaded, never rendered inline, so browser PDF-viewer exploits and HTML-masquerading files get no execution context on any origin, let alone ours (R2 serves from its own domain regardless). Original filenames are display metadata only: stripped of path separators and control characters, ≤ 120 chars.

**Malware stance, honestly [FREE-TIER RISK]:** there is no free, reliable malware scanning we can run serverlessly (ClamAV needs a host; commercial APIs cost money or have unusable free quotas — unverified current terms). Compensating controls: strict type allowlist (PDF/PNG/JPEG/WebP — no executables, no archives, and **no Office formats**, which are the actual macro-malware carriers), magic-byte verification, re-encoding of images, no inline rendering, size caps, uploader accountability (resources always have an internal author, even when displayed anonymous), and report-driven takedown ("Reportar" on every resource routes to the mod queue, PART 11). A malicious PDF targeting reader vulnerabilities remains possible — the residual risk is documented in the Reglas ("descargá con criterio") and revisited when the first paid dollar arrives (D13): a scanning API is the upgrade path.

## 10.9 Rate limiting

**Decision (D14-9).** Two curtains. The authoritative limits are **enforced in-database inside the write RPCs** — they hold even if someone drives PostgREST directly with a stolen session. The first curtain is best-effort **middleware IP limiting** — cheap rejection of naive floods before they consume function invocations.

- **In-DB:** each write RPC checks its limit by **counting the caller's recent rows** via the existing `(author_id, created_at)` indexes (PART 8 §8.3.8) — no counters table, no state to purge or drift; the function raises a typed error when the count exceeds the limit, which the UI translates to "Estás publicando muy seguido. Esperá un rato." The limit **values** are owned by PART 11 §11.6.2 (three account-age tiers T0/T1/T2 — one source of numbers; not restated here); the constants live in a single `rate_limits()` SQL function so tuning is a migration, not a deploy.
- **Middleware:** fixed-window in-memory counter per IP per route class. Honest limitation: Vercel functions are ephemeral and multi-instance, so this curtain is porous by design — it exists to shed obvious abuse cheaply, not to be right. No paid Redis to fix it (D6 rejected Redis); the DB curtain is the one that must hold.
- **Probation:** accounts younger than 48 h are tier T0 with the tightest limits per PART 11 §11.6.2 — including resource uploads at 1/día (allowed, not prohibited: a new account uploading its first apunte is the cold-start behavior we want) — because spam accounts are new accounts.

Numbers are starting points, tuned from `events` telemetry (PART 24) via the `rate_limits()` constants.

### 10.9.1 Scraping and enumeration

**Decision.** Public content is public by design (C16) — scraping the pages a browser can see is not an attack we can or should prevent, and pretending otherwise (aggressive bot-blocking, login walls) would sabotage SEO and the archive mission. What we prevent is *cheap total extraction* and *enumeration of what is not public*:

- **Non-sequential public IDs.** nanoid public IDs (D4/D7) mean content cannot be enumerated by walking an ID space; discovery requires the feeds and sitemap we intentionally publish.
- **Pagination is keyset-based with a capped page size** (25 rows; PART 12), so no `?page=99999&limit=10000` bulk endpoint exists; the PostgREST surface returns the same `_public` view rows the pages show, with PostgREST's max-rows setting capped to the same 25 (config, S0) — the API is not a faster firehose than the site.
- **Profiles are public but `noindex`** (C16) and excluded from the sitemap; there is no user directory page, so building the member list requires observing content over time — raising the cost of the doxxer's first step without hiding anyone who participates.
- **Search is rate-limited per IP** in middleware (search is the natural harvesting loop) and per-user in the RPC when logged in.
- **Emails, invite codes, and handles have no lookup oracles**: login errors are uniform (9.2.2), reset responses are uniform (9.8), invite validation reveals only valid/invalid for the exact code presented, and handle-availability checks during onboarding are rate-limited and answer only for complete candidate handles.

Accepted residual: a patient scraper can mirror all public content at reading speed. So can the Internet Archive — and for the 10-year mission, that is closer to a feature than a threat (brief §2).

## 10.10 Auth hardening checklist

**Decision.** The Supabase Auth configuration is code-reviewed configuration, applied at S0 and re-verified each phase-end (settings drift is a real failure mode when a dashboard exists):

| Setting | Value | Why |
|---|---|---|
| Email confirmation | Required | Unconfirmed accounts cannot act; throttles bulk registration |
| Providers | Email/password only; OAuth, phone, anonymous sign-in all disabled | Surface + identity-linkage (9.2.2) |
| Min password length | 10 | With denylist check in Zod (9.2.1) |
| Leaked-password protection (HIBP) | On **if available on Free tier** (unverified — verify at S0; believed Pro-only) | If unavailable: the 10-char + denylist floor stands **[FREE-TIER RISK]** |
| Secure email change | On (confirm on both addresses) | Protects the recovery anchor (9.8) |
| JWT expiry | 3600 s | Balance of revocation latency (10.11) vs refresh traffic |
| Refresh token rotation + reuse detection | On | Stolen-refresh-token containment |
| Site URL + redirect allowlist | Production domain + localhost only | Kills open-redirect via auth links |
| Auth email rate limits | Tightened from defaults (≤ 2 resets/hour/account) | Reset-spam as harassment vector |
| CAPTCHA (Turnstile) | Off at launch; integration documented as a ready switch | Brief §19: "CAPTCHA only when necessary"; invite gating covers MVP |
| MFA (TOTP) | Enabled for mod/admin accounts if available on Free tier (unverified); founder's Supabase/Vercel/GitHub/registrar accounts use TOTP regardless | Mod accounts are A3-privileged |

## 10.11 Moderator permission model

**Considered:** (a) custom JWT claims (`app_metadata.role` stamped via auth hook); (b) a separate `moderators` table; (c) `profiles.role` enum checked in RLS/RPC.
**Chosen:** `profiles.role` (`user`/`mod`/`admin`, per D4), read through a `STABLE` helper `is_mod()` used as `(select is_mod())` in policies (initplan-cached once per statement).
**Why:** *revocation latency*. A JWT claim outlives its welcome for up to the token's full hour — a de-modded (or compromised) moderator keeps powers until expiry, and emergency de-modding during an incident is exactly when an hour is too long. `profiles.role` is authoritative on the very next statement. It is also one source of truth living in the schema (migration-managed, pgTAP-testable — a policy test can set role and prove both grant and deny), where JWT claims need an auth-hook test harness we would otherwise not build.
**Cost:** one indexed row lookup per policy evaluation (measured in microseconds at our scale; the initplan pattern keeps it once-per-query) and the obligation that role changes go through an audited admin RPC (`set_role`, admin-only, writes `mod_actions`) — never a dashboard edit (D14-1 spirit).

Admin (= founder) is the only role that can change roles, manage invites in bulk, and flip kill switches (10.14). Mods get: queue, content actions, restrictions, break-glass reveal (9.12) — enumerated exhaustively in PART 11. Mod actions display publicly as "Moderación", never the moderator's own handle — mods are students in the same small community and retaliation is the predictable failure (C13); the internal audit row always records *which* mod.

## 10.12 Audit logging

**Decision.** `mod_actions` is an append-only ledger: no UPDATE/DELETE grants for any client role, no definer function mutates existing rows; corrections are new rows referencing the old (`reverses_action_id`). Logged: every mod content action, restriction, ban, role change, forced rename, break-glass identity reveal (with stated reason), and kill-switch flip. Retained indefinitely; after account deletion rows keep the bare UUID (9.9).

Beyond mod actions: security-relevant profile events (handle change → `handle_history` 9.5; email/password change → Supabase's own auth logs). Supabase Free's log retention is short (~1 day, unverified) **[FREE-TIER RISK]** — accepted for MVP with a compensating ritual: the weekly ops review (10.14) checks auth anomalies while logs still exist. We deliberately do **not** build shadow request logging: minimal logs are a privacy feature under the subpoena analysis (9.11.1 #2) — audit what *we* do (mod power), not what *users* do.

## 10.13 Dependency and supply-chain hygiene

**Decision.** The dependency budget is part of security: every package is an author we trust with our users' identities. D14-8 (no new dependency without a `docs/decisions.md` entry) is enforced at review; the AI coding contract (PART 26) repeats it because AI assistants resolve every problem by adding a package.

Rules: lockfile committed, `npm ci` only in CI; Renovate/Dependabot weekly, grouped, with diffs actually read for small/low-download packages (typosquats and hijacks live there); GitHub Actions pinned by commit SHA; `npm audit` triaged weekly (not build-blocking — advisory noise would train the habit of ignoring it); no packages with install scripts unless unavoidable (audit `postinstall` on every add); prefer platform primitives over micro-packages (no `left-pad` descendants). AI-specific: generated code is reviewed against the D14 "never" list before merge, and any AI-suggested dependency is re-typed by hand from the official README, never copy-pasted from the model's output (hallucinated-package-name squatting is a real, documented attack on AI-assisted workflows).

Operator accounts are supply chain too: GitHub, Vercel, Supabase, the domain registrar, and the founder's email all get unique passwords (manager) + TOTP; the registrar and email are the roots — with either, an attacker owns everything without touching code. Founder laptop: full-disk encryption, OS auto-updates, no service-role key in shell history (scripts read env files), Supabase dashboard sessions not left logged in on shared machines.

## 10.14 Incident response runbook

**Decision.** A one-person team cannot run a NIST playbook; it can run a one-page ritual with pre-made decisions. The runbook lives in the repo (`docs/runbook.md`); this is its content in brief.

**Kill switches** (single-row `app_settings` table, checked at the top of every write RPC; flipping is an admin RPC + audit row; effect is instant, no deploy): `read_only` (all writes refuse: "El sitio está en modo lectura por mantenimiento."), `signups_paused`, `uploads_paused`. PART 8 includes this table (`app_settings`, per §0.5-R22).

**Scenario: suspected authorship leak (A1/A2) — the one that matters.**
1. *Contain* (first hour): flip `read_only`; rotate service-role key, DB password, CRON_SECRET; rotate JWT secret (revokes all sessions); rotate founder account credentials if the laptop is the suspected vector.
2. *Assess* (same day): from Supabase logs (short retention — act fast), the dump-diff of backups, and mod-action reveals: what was accessible, to whom, over what window; whether A1 (authorship map) or only A2 (emails) is affected.
3. *Notify* (within 72 h, sooner is better): affected users first, by the honest channel — in-app notice + email: "Detectamos un acceso indebido a datos internos entre [fecha] y [fecha]. Pudo haber expuesto qué cuenta escribió contenido anónimo. Te lo contamos porque preferimos que lo sepas por nosotros." Current Ley 25.326 has no general breach-notification duty; the AAIP recommends notification and pending reform bills mandate it — **[LEGAL REVIEW]** confirm notification form and whether to notify AAIP proactively. Silence discovered later would end the platform's reason to exist; over-notification is the chosen error direction.
4. *Learn:* timeline + postmortem committed to the repo within a week; every "we couldn't tell" gap becomes a backlog item.

**Other pre-decided scenarios:** credential leak without evidence of use → rotate + monitor, no user notice unless assessment changes; account-takeover wave → `signups_paused`, force reset on affected accounts; spam flood → probation tightening + `uploads_paused` + invite freeze; legal demand → nothing is deleted or disclosed same-day in panic; acknowledge receipt, consult counsel, follow the notice-and-takedown protocol (PART 11 / legal-ar §2: manifest illegality acted on; debatable defamation waits for a court order).

**Detection, honestly:** the weak link is that nobody is watching at 3 a.m. Standing detection: Sentry alerts (error spikes), Supabase auth anomaly emails where available, uptime ping on the keepalive cron, and a **weekly 15-minute ops review** (auth logs, mod-action log — especially break-glass reveals, quota telemetry) as a calendar ritual. The design accepts detection latency of hours-to-days and compensates with minimization (what we never stored cannot leak) — this is the honest small-team posture.

## 10.15 Backup security

**Decision (D13).** Weekly `pg_dump` + storage manifest, encrypted with **age** using a keypair: the public key lives on the backup runner, the private key exists only offline (founder's password manager + one printed copy). The machine that makes backups cannot read them. Destination: a second provider (Cloudflare R2 or Backblaze B2 free tier — current quotas unverified, confirm at S0) in a bucket with no public access, credentials scoped write-only where the provider supports it.

Dumps are the crown jewels in one file (A6 = A1 + A2 + A3): they carry the full anonymous-authorship map and every email. Therefore: retention **8 weekly + 3 monthly, hard-capped at 90 days** — this is a privacy commitment, not just housekeeping, because deleted accounts and deleted content persist inside backups until rotation; the privacy policy states it: "Las copias de seguridad se conservan un máximo de 90 días." (9.11.2). Restore is drilled quarterly against the dev Supabase project (a backup that has never been restored is a hope, not a backup); the drill doubles as the D13 exit-plan test (brief §33: could we move off Supabase tomorrow — the honest answer must be a tested yes). Backup credentials and the age private key are never on the production runner together; loss of the private key means loss of all backups — two offline copies exist for that reason.

## 10.16 Brief §20 traceability

Every item the brief's security section enumerates, mapped to where this plan decides it — the checklist a reviewer (or an AI assistant asked "is X handled?") should consult first:

| Brief §20 item | Decided in |
|---|---|
| Authentication | 9.2, 10.10 |
| Authorization | 10.2, 10.3, 10.11 |
| Supabase Row Level Security | 10.2 (strategy + proof obligation), PART 8 (per-table policies) |
| Database permissions | 10.2 (grants revoked on base tables), 10.3.1 (definer-function surface) |
| Storage policies | 10.8 (private bucket, signed URLs both directions) |
| Server-side validation | 10.5 (Zod at every boundary), 10.3.1 (re-checked in RPCs) |
| Input sanitization | 10.5 (plain text decision, NFC, control-char strip) |
| XSS prevention | 10.5, 10.6 (no user HTML, CSP, zero third-party scripts) |
| CSRF considerations | 10.6 |
| SQL injection protection | 10.7 |
| Secure file handling | 10.8 |
| Abuse prevention | 10.9, 9.2.1 (invites), PART 11 (operations) |
| Secret management | 10.4 |
| Environment variables | 10.4 (`NEXT_PUBLIC_` audit, dev/prod split) |
| API route security | 10.3 (server-only path), 10.6 (origin checks), 10.1.3 (PostgREST as public surface) |
| Admin/moderator permissions | 10.11 |
| Audit logs | 10.12 |
| Account recovery | 9.8 |
| Session management | 9.3 |

The brief's closing rule — "never rely on frontend-only authorization; all sensitive permissions enforced server-side/database-side" — is structural here: the authoritative boundary is RLS + definer functions (10.2, 10.3.1), proven by pgTAP in CI, with the frontend treated as a rendering convenience over an API that must already be safe against a hostile client.
