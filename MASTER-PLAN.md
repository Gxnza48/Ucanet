# uca.net — Master Plan (single source of truth)

> Version 1.0 — August 2026. Produced from the founder's brief (`docs/plan/BRIEF.md`) by a lead-architect pass, 11 specialist deep-dives grounded in live research, three adversarial verification reviews, and a full reconciliation pass. Coverage verdict from independent review: ~92% of brief obligations fully covered before reconciliation; all cross-part forks since adjudicated (spine §0.5).
>
> **Read `docs/plan/00-core-decisions.md` first.** It is the binding spine: if any part contradicts it, the spine wins.

---

## What this is

The complete product, UX, architecture and engineering plan for **uca.net**: a pseudonymous student-community platform for UCA Rosario — the "student layer" around university life. Live cohort conversation (AHORA) compounding into a permanent knowledge base and archive (SIEMPRE), built by one AI-assisted developer on free-tier infrastructure, designed to still be alive and recognizable in 2036.

The strategic bet, in one line: **utility recruits, conversation retains, permanence compounds.**

## Document map

| File                                                         | Contents                                                                                                                  |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `docs/plan/BRIEF.md`                                         | The founder's original requirements brief, verbatim (document of record)                                                  |
| `docs/plan/00-core-decisions.md`                             | **PART 0 — the spine**: brief critique C1–C16, binding decisions D1–D14, conventions, post-review adjudications R1–R23    |
| `docs/plan/01-vision-principles-personas.md`                 | PARTS 1–3: executive vision, product principles, personas, the 25 brief-§59 answers, the §65 daily-open answer            |
| `docs/plan/02-product-map-mvp-flows-ia.md`                   | PARTS 4–7: product map, strict MVP, user flows with es-AR microcopy, information architecture                             |
| `docs/plan/03-database.md`                                   | PART 8: full PostgreSQL/Supabase schema — tables, DDL, indexes, RLS, views, RPCs, deletion matrix, migrations 0001–0012   |
| `docs/plan/04-identity-security.md`                          | PARTS 9–10: authentication, pseudonyms, anonymity mechanics, threat model, security architecture                          |
| `docs/plan/05-moderation-antiabuse.md`                       | PART 11: community rules (es-AR), reports, mod panel, escalation ladder, anti-abuse engineering, load model               |
| `docs/plan/06-feed-search-notifications.md`                  | PARTS 12–13: feed design and ranking, notifications, Postgres-native search                                               |
| `docs/plan/07-resources-marketplace-archive.md`              | PARTS 14–16: academic resource system, the deferred marketplace, archive and content lifecycle                            |
| `docs/plan/08-ui-ux-design-system.md`                        | PARTS 17–18: screen-by-screen UX, editorial visual language, concrete design tokens and components                        |
| `docs/plan/09-stack-infra-freetier-performance.md`           | PARTS 19–22: stack justification, Vercel+Supabase+R2 architecture, free-tier strategy, performance budgets                |
| `docs/plan/10-seo-analytics-testing-devflow-repo.md`         | PARTS 23–27: SEO/indexing policy, privacy-conscious analytics, testing strategy, AI-assisted dev workflow, repo structure |
| `docs/plan/11-roadmap-launch-growth-monetization.md`         | PARTS 28–31: dated calendar-aware roadmap, first-100 launch protocol, growth ladder 0→10k, staged monetization            |
| `docs/plan/12-vision-risks-open-questions-recommendation.md` | PARTS 32–35: ten-year vision, ranked risk register, **the founder's open-questions list**, final recommendation           |
| `docs/plan/13-appendix-uca-academico.md`                     | APPENDIX A: verified UCA Rosario facultades/carreras/planes de estudio + seed dataset + 2026 academic calendar            |

## Executive summary

**Product.** Every materia and carrera of UCA Rosario gets a permanent public page. Students post (pseudonymously, or per-post as "Anónimo" with per-thread alias coherence), comment, upvote, and share study resources (resúmenes, apuntes, parciales viejos). The default feed is _Mis materias_ — density is engineered by cohort segmentation, so 30 active students in one carrera feel alive even when the platform is small. Public-by-default content plus durable URLs make the 10-year archive a by-product of normal operation, not a feature.

**Honest answer to the brief's hardest question (§65).** Nothing makes every student open any site daily. The design target is the 2-minute ambient check — "¿qué se dice hoy en mi carrera?" — daily for engaged cohort members during cursada, weekly for the rest, with utility spikes at parciales/finales. No streaks, no engagement theater; the academic calendar is the algorithm.

**MVP (strict).** Invite-gated auth + pseudonyms · academic catalog pre-seeded from APPENDIX A · one post composer (optional title/materia/pregunta/Anónimo) · depth-2 comments · upvotes only · two feed tabs (Mis materias lightly ranked, Reciente chronological) · resources with files on Cloudflare R2 (10 MB/file, 100 MB/user) · Postgres FTS search · reports + mod panel + `/apelacion` · in-app notifications · SEO-ready public pages · legal pages. **Cut:** polls, tendencias, para-vos, professor pages, marketplace/payments, archive UI, downvotes, DMs (excluded, not deferred), realtime, badges, avatars, email digests.

**Architecture.** Next.js App Router (RSC-first) on Vercel Hobby · Supabase Postgres + Auth · Cloudflare R2 for files (zero egress — retires the worst free-tier risk) · plain SQL migrations, no ORM · RLS on every table with public reads only through anonymity-stripping views · all writes through SECURITY DEFINER RPCs enforcing rate limits in-database · pgTAP tests proving every policy (the anonymity guarantee is a tested invariant, not a promise) · Resend for auth email · Sentry free · cookie-less aggregate analytics in Postgres. Total infra cost at launch: **$0/mo**, with pre-committed triggers for the first paid dollars (Supabase Pro $25 on DB pressure; Vercel Pro $20 on any monetization).

**Calendar (from today, Aug 2026).** S0 Fundaciones (3 wks, Sep) → S1 Núcleo (posts/comments/feed/materias) → S2 Utilidad (resources on R2, search, SEO) → S3 Confianza (moderation, notifications, hardening) → **beta cerrada late Nov 2026** (one carrera, ~20–50 invited, during finales = utility peak) → **public launch March 2027** with the new cuatrimestre. Counsel engaged in September; legal pages reviewed, not written, by the lawyer.

**Identity & trust.** Accounts internal, pseudonyms public, per-post anonymity with internal authorship for moderation; karma recomputed nightly for everyone (defeats timing correlation); anonymous content exposes nothing of its author; moderators' access to anonymous authorship is itself an audited action (`revelar_autor`).

## The five decisions only the founder can make

Full list with options and defaults: PART 34. The load-bearing ones:

1. **The name.** "uca.net" carries real trademark/domain risk (spine C2, [LEGAL REVIEW]). Verify registrability + get a trademark opinion + hold a fallback name before public launch. The build proceeds under code name `ucanet`; renaming is architected to be a one-day change.
2. **Counsel.** Engage an Argentine lawyer in September (data protection, defamation exposure, ToS/Privacidad review, the "parciales viejos" copyright stance).
3. **Registration policy.** Plan assumes invite-gated any-email; the alternative (@uca.edu.ar required) trades psychological safety for outsider-proofing (D3-a).
4. **Hours.** The roadmap assumes 20 h/week of founder time; the dates move linearly with this number.
5. **Seed commitment.** 80–150 genuinely good resources in the launch carrera before the first invite goes out — this is the cold-start plan itself, and only the founder's cohort can produce it.

## How to use this plan

- **To start building:** follow PART 28 (roadmap). Phase S0's first deliverable is migration `0001` written directly from PART 8.
- **For any product argument:** test it against the principles in PART 2 and the spine D-decisions.
- **For AI-assisted coding sessions:** PART 26 contains the working agreement and the draft `CLAUDE.md`; spine D14 is the non-negotiable engineering contract.
- **When something contradicts something else:** the spine (00) wins; record new decisions in `docs/decisions.md` once the repo exists.

## Provenance & verification

Research grounded in primary sources (official UCA plan-de-estudios PDFs; provider pricing pages as of Aug 2026; CSJN case law). Three independent adversarial reviews (consistency, feasibility, coverage) ran against the full draft; every finding was adjudicated in spine §0.5 and propagated through a reconciliation pass. Facts that could not be verified are marked "SIN VERIFICAR" in APPENDIX A; decisions awaiting humans are marked **[HUMAN DECISION]**; items for counsel are marked **[LEGAL REVIEW]**; budget hazards are marked **[FREE-TIER RISK]** — all aggregated in PART 34.
