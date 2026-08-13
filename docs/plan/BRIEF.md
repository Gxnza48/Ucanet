# uca.net — FOUNDER'S ORIGINAL BRIEF (requirements document of record)

> Captured verbatim from the founder on 2026-08-12. This is the input to the master plan.
> Where the master plan (docs/plan/00–13) contradicts this brief, the master plan documents why — see `00-core-decisions.md` §0.2 (Brief critique).

---

## ROLE

You are the lead architect, CTO, senior full-stack engineer, product strategist, UX/UI designer, security engineer, database architect, and long-term technical owner of a new digital platform called **uca.net**.

You are not being asked to immediately write the application.

Your first responsibility is to think deeply, comprehensively, and critically about the entire product and produce a **master implementation plan** that could later be used as the single source of truth for building the platform.

Think as if you personally had to design, build, deploy, maintain, secure, scale, migrate, and preserve this product for the next 10+ years.

Do not simply follow the ideas below mechanically.

You are expected to:

* identify missing requirements
* challenge weak assumptions
* identify technical risks
* identify product risks
* identify UX problems
* propose better alternatives
* simplify wherever possible
* avoid unnecessary complexity
* make sensible decisions when requirements are ambiguous
* explain important trade-offs
* prioritize long-term maintainability
* design for an extremely small initial budget
* assume the initial product is being built by a very small team, potentially one developer using AI-assisted development

The final goal is not to create a generic social network.

The goal is to design **uca.net as a durable digital institution for university life**.

---

# 1. PRODUCT VISION

uca.net is intended to become the anonymous digital ecosystem of university life around **Universidad Católica Argentina (UCA), initially focused on the Rosario community**.

It should combine:

* anonymous student discussion
* short-form anonymous posts
* university-related communities
* subjects/courses
* academic resources
* summaries and study materials
* historical exam resources
* recommendations and experiences
* student-to-student interaction
* reputation
* eventually a marketplace for student-created academic resources
* a long-term historical archive of university life

The initial product should be small and financially sustainable at essentially zero infrastructure cost.

The initial infrastructure budget is:

* domain: paid
* Vercel: Hobby/free tier
* Supabase: free tier
* other infrastructure: preferably free/open-source
* no paid cloud infrastructure initially
* no unnecessary third-party SaaS dependencies
* no expensive APIs
* no paid analytics platform unless absolutely necessary

The architecture must therefore be designed around the limitations of free tiers.

However, do NOT build a throwaway prototype.

The architecture should be capable of evolving into a serious production platform if the community grows.

---

# 2. LONG-TERM PHILOSOPHY

This is extremely important.

uca.net should not be designed as a disposable social-media startup.

The long-term ambition is that **10 years from now, uca.net is still being used and still feels meaningful**.

The platform should eventually become a form of collective digital memory.

A student in 2036 should potentially be able to discover what university life was like in 2026.

The platform should preserve useful community knowledge across generations.

Examples:

* old discussions
* historical student experiences
* study resources
* subject-specific knowledge
* old exams where legally and ethically appropriate
* recommendations
* community milestones
* important discussions
* historical posts
* anonymized community statistics
* generational archives

The platform should therefore have two conceptual dimensions:

## NOW

What is happening right now:

* new posts
* conversations
* questions
* trends
* current academic activity
* current student life

## ALWAYS

What remains useful over time:

* knowledge
* resources
* subject communities
* historical discussions
* archives
* student experiences
* institutional memory

The design and architecture must support both.

---

# 3. CORE PRODUCT PRINCIPLE

The central product principle is:

> "Everything happening around student life should have a place on uca.net."

The official university website may provide official information.

uca.net provides the **student layer** around that information.

For example:

Official university: "Midterm exam is on September 18."
uca.net: "Does anyone know what chapters are included?"

Official university: "Course: Constitutional Law."
uca.net: "Which professor would you recommend?"

Official university: "Study material available."
uca.net: "I made a 70-page summary. Is anyone interested?"

This distinction is fundamental.

uca.net should not attempt to replace official university systems.

It should become the **community layer around university life**.

---

# 4. INITIAL TARGET USER

The initial target is:

* university students
* primarily UCA Rosario
* undergraduate students
* students across different faculties and degree programs
* students at different years and academic levels

Potential future users may include:

* alumni
* prospective students
* tutors
* student organizations
* university-related services
* professors, if the product eventually supports carefully controlled participation

However:

## DO NOT expand the audience prematurely.

The first product should be optimized for a dense, specific community.

A smaller community with high interaction is more valuable than a huge empty platform.

---

# 5. PRODUCT IDENTITY

The product name is: **uca.net**

The visual identity must NOT look like a typical AI-generated startup dashboard.

Avoid:

* excessive gradients
* glassmorphism
* giant rounded cards
* huge hero sections
* generic SaaS landing pages
* excessive icons
* emoji-heavy UI
* meaningless decorative illustrations
* excessive animations
* "AI startup" aesthetics
* giant marketing copy
* oversized buttons
* excessive whitespace used purely for visual fashion
* generic Tailwind dashboard aesthetics
* excessive pills
* excessive shadows
* visually noisy component libraries

The design should feel closer to the **web's knowledge/information tradition**.

A major inspiration is **Wikipedia** in terms of:

* information density
* textual hierarchy
* utility
* direct navigation
* permanence
* simplicity
* restrained visual language
* content-first design
* recognizable structure
* minimal decoration

This does NOT mean copying Wikipedia.

It means adopting the principle:

> The interface exists to expose information, not to decorate it.

The final visual identity should feel:

* timeless
* serious
* human
* fast
* slightly raw
* community-driven
* intelligent
* trustworthy
* recognizable
* information-dense
* durable

It should feel like a website that could plausibly still exist in 2036.

---

# 6. LANGUAGE

The entire user-facing product must be written in: **Latin American Spanish.**

Not Spain Spanish.

Use natural Argentine/Latin American terminology where appropriate.

Examples: "Iniciar sesión", "Crear cuenta", "Publicar", "Comentar", "Guardar", "Compartir", "Reportar", "Materia", "Carrera", "Facultad", "Resumen", "Parcial", "Final", "Apunte", "Comisión".

Avoid artificial translations.

Do not use English UI terminology unless it is genuinely part of the product identity or unavoidable technical terminology.

The planning document itself should be written in English.

The code can use English identifiers, but all visible UI copy should be Spanish LATAM.

---

# 7. ANONYMITY MODEL

Anonymity is one of the most important product concepts.

Do NOT implement "anonymous" as simply an unauthenticated user.

Users should have accounts. The system should internally know the account identity. Other users should see a pseudonymous public identity.

Example public usernames: `MateConBizcochos`, `FiscalDelTercerPiso`, `Promedio4.9`

The platform should support:

## Public pseudonym

A stable or changeable public identity.

## Anonymous publishing

A user can optionally publish content as: `Anónimo`

The system internally retains authorship for moderation, abuse prevention, security, and account integrity.

The public should not be able to trivially connect anonymous posts together.

Think carefully about whether anonymous posts should expose: avatar, karma, account age, posting history, badges.

Prefer strong privacy.

---

# 8. IMPORTANT PRIVACY PRINCIPLE

"Anonymous to the community" does NOT mean "untraceable infrastructure."

The system may need internal metadata for: abuse prevention, rate limiting, account security, moderation, legal compliance, fraud prevention, spam prevention.

But this information must never become part of the public profile by default.

Design the data model around privacy by default.

Do not collect personal data that is unnecessary.

Do not expose: email addresses, real names, IP addresses, internal identifiers, private moderation metadata, account recovery information — to ordinary users.

---

# 9. INITIAL PRODUCT MODULES

The initial MVP should probably contain:

## A. Home / Feed

A central feed of community content.

Content types may include: text posts, questions, discussions, short posts, polls, academic-related posts, community posts.

The feed should be simple and chronological or lightly ranked initially.

Do NOT immediately build an extremely sophisticated recommendation algorithm.

Start with: recency, engagement, followed subjects, followed communities, basic relevance.

The system should remain understandable.

## B. Short-form posts

A "micro-post" system similar conceptually to old Twitter.

Maximum length should be evaluated. These posts should be fast to create and fast to consume.

Examples: "¿Alguien sabe si mañana hay clase?", "Estoy destruido con este parcial.", "¿Alguien tiene el resumen de Civil?", "¿Qué profesor recomiendan para esta materia?"

The goal is to create daily activity.

## C. Subjects / Materias

Each subject should have its own page. Example: **Derecho Constitucional**

Possible sections: Overview, Discussions, Resources, Exams, Professors, Dates, Student experiences, Related subjects.

Each subject can have: followers, posts, resources, historical activity, community reputation.

## D. Degree programs / Carreras

Users should be able to discover content through their degree program.

Examples: Abogacía, Administración, Economía, Ingeniería, etc.

Do not assume exact current UCA academic structure without verification later.

Design the data model so faculties, degree programs, subjects, professors, and academic years can evolve.

## E. Faculties

Higher-level grouping. Example conceptual hierarchy:

University → Campus/location → Faculty → Degree → Subject → Course/commission

Do NOT hardcode this hierarchy in a way that makes future changes difficult.

## F. Academic Resources

Resources may include: summaries, notes, study guides, diagrams, flashcards, exam preparation material, historical exams, student-created educational resources.

Each resource should have metadata: title, description, subject, author/publisher, creation date, update date, file type, size, visibility, price if applicable, ratings, downloads/purchases, moderation state.

---

# 10. MARKETPLACE

The marketplace is potentially important but should NOT dominate MVP architecture.

The long-term idea is: students can distribute or sell their own study resources.

Potential models: free, paid, donation, exchange, bundles.

However, before implementing payments, think carefully about: payment provider, fees, taxes, legal responsibility, refunds, fraud, copyright, prohibited content, moderation, storage, seller identity, disputes.

For MVP, consider implementing the resource system first without real payments.

The architecture should leave room for payments later.

Do NOT introduce a payment provider simply because it sounds complete.

---

# 11. REPUTATION

Reputation should help solve the core problem of anonymous communities: how do we maintain trust without requiring public real identities?

Possible signals: karma, useful answers, resource quality, community contributions, successful transactions, reports received, moderation history.

However, do NOT over-gamify the platform. Avoid turning it into a childish points system.

Reputation should feel subtle and useful.

Consider whether multiple reputation dimensions are better than one giant number.

Explore alternatives and recommend one.

---

# 12. COMMUNITY CULTURE

The product should eventually develop its own culture. Do not try to artificially manufacture this culture. Instead, create the environment where it can emerge.

Potential future phenomena: community memes, recurring jokes, legendary posts, famous anonymous users, historical discussions, traditions, yearly events, community awards, generation-specific culture.

The platform should preserve these organically.

---

# 13. ARCHIVE / DIGITAL MEMORY

This is a long-term strategic feature.

Potential section: **Archivo**

Users could explore: 2026, 2027, 2028, 2029, etc.

The archive could contain: historical discussions, important posts, resources, community milestones, yearly statistics, notable threads, generational activity.

Do NOT expose sensitive personal information.

Think about anonymization, deletion requests, privacy, and content lifecycle.

The archive must not become a permanent repository of harmful or defamatory content.

Design mechanisms for: deletion, moderation, anonymization, correction, content expiry where appropriate, preservation of genuinely valuable material.

---

# 14. INFORMATION ARCHITECTURE

Develop a complete information architecture.

At minimum evaluate: Home, Now, Explore, Subjects, Faculties, Degree programs, Resources, Archive, Search, Notifications, Profile, Settings, Moderation, Authentication.

Do not assume every section must exist in MVP.

Clearly divide: **MVP / Phase 2 / Phase 3 / Long-term**.

---

# 15. SEARCH

Search will eventually be extremely important because of the archive.

Search should eventually cover: posts, users/pseudonyms, subjects, degrees, faculties, resources, historical content.

Think carefully about what Supabase/Postgres can handle without introducing expensive infrastructure.

Initially prefer PostgreSQL-native search capabilities.

Do not introduce Elasticsearch or another search service unless genuinely necessary.

---

# 16. FEED ALGORITHM

Do not build an opaque TikTok-style recommendation engine.

The early feed should be understandable.

Consider a hybrid approach: recent content, followed subjects, followed degree programs, engagement, freshness, community relevance.

Potential sections:

## Para vos — Personalized lightly.
## Siguiendo — Content from followed entities.
## Ahora — Chronological current activity.
## Tendencias — Fast-growing content.

Design the data structures now, but keep implementation simple.

---

# 17. NOTIFICATIONS

Potential notifications: comment replies, mentions, post interactions, followed subject activity, resource purchases, moderation decisions.

Avoid notification spam. Design notification preferences from the beginning.

---

# 18. MODERATION

Moderation is critical. Build a reporting system.

Possible report categories: spam, harassment, threats, personal information, impersonation, fraud, copyright, illegal content, misinformation, inappropriate academic content, other.

Moderation should support: report creation, report queue, moderator notes, moderation actions, content removal, temporary restrictions, account restrictions, bans, appeals, audit logs.

Do not make moderators dependent on raw database access. Design a basic internal moderation interface.

---

# 19. ANTI-ABUSE

Design from the beginning for: spam, bot accounts, automated posting, account farming, vote manipulation, brigading, harassment, scraping, malicious uploads, oversized files, malicious filenames, suspicious purchasing behavior.

Consider: rate limits, server-side validation, CAPTCHA only when necessary, Supabase Auth protections, database constraints, storage policies, moderation queues, reputation thresholds.

Do not over-engineer the first version.

---

# 20. SECURITY

Treat the application as a real production system even though it uses free infrastructure.

Explicitly design: authentication, authorization, Supabase Row Level Security, database permissions, storage policies, server-side validation, input sanitization, XSS prevention, CSRF considerations where applicable, SQL injection protection, secure file handling, abuse prevention, secret management, environment variables, API route security, admin/moderator permissions, audit logs, account recovery, session management.

Never rely on frontend-only authorization.

All sensitive permissions must be enforced server-side/database-side.

---

# 21. DATABASE ARCHITECTURE

Design a clean PostgreSQL schema compatible with Supabase.

Potential entities: users, profiles, pseudonyms, faculties, degree_programs, subjects, courses/commissions, professors, posts, comments, votes, follows, bookmarks, tags, resources, resource_files, resource_reviews, notifications, reports, moderation_actions, moderation_logs, user_restrictions, archive_entries, analytics/events if appropriate.

Do NOT blindly create every table listed above.

Analyze the actual requirements and produce the minimum clean relational model.

For every proposed table explain: purpose, primary key, important fields, relationships, indexes, RLS considerations, deletion behavior, whether it belongs in MVP.

Avoid unnecessary polymorphic database designs if they create complexity.

Prefer PostgreSQL-native relational integrity.

---

# 22. SUPABASE FREE TIER

The initial infrastructure must assume the Supabase free tier.

Explicitly analyze: database limits, storage limits, bandwidth, authentication, realtime usage, file storage, database size, backup limitations, operational risks, likely bottlenecks.

Do not assume unlimited resources. Design strategies for staying within free-tier constraints.

For example: image optimization, file size limits, storage quotas, pagination, avoiding unnecessary realtime subscriptions, efficient indexes, caching, avoiding N+1 queries, limiting expensive queries.

Clearly identify what might break first if the user base grows.

---

# 23. VERCEL HOBBY

The initial frontend/deployment target is Vercel Hobby.

Assume: Next.js, modern React, TypeScript, Vercel deployment, environment variables, server-side functionality only where appropriate.

Analyze Vercel Hobby limitations. Do not design a system that requires expensive server infrastructure.

Prefer: static rendering where possible, server components where appropriate, server actions/API routes when justified, database queries through secure server-side paths, efficient caching, incremental rendering where useful.

Do not overuse serverless functions for trivial operations.

---

# 24. RECOMMENDED TECH STACK

Evaluate and recommend the simplest serious stack.

Likely candidates: Next.js, TypeScript, React, Supabase, PostgreSQL, Supabase Auth, Supabase Storage, Tailwind CSS or another lightweight styling approach, Vercel.

But do not blindly accept these.

Explain: what should be used, what should not be used, why, what alternatives were considered.

The final stack should minimize: cost, dependencies, maintenance, vendor lock-in, complexity.

---

# 25. UI SYSTEM

The UI must be carefully designed.

The visual language should prioritize: typography, hierarchy, spacing, borders, content density, navigation, readability, speed.

Use visual decoration sparingly.

Avoid: giant cards, excessive border radius, excessive shadows, gradient backgrounds, floating blobs, decorative illustrations, emoji-based navigation, giant empty hero areas.

Use icons only when they communicate something useful. Do not use emojis as UI decoration.

The interface should feel closer to a mature editorial/information website than a modern startup landing page.

However, it must still feel like its own product. Do not literally clone Wikipedia.

---

# 26. RESPONSIVE DESIGN

The product must work well on: desktop, laptop, tablet, mobile.

Do not design desktop first and simply collapse everything for mobile.

Think through mobile navigation carefully. The feed must be excellent on mobile.

The desktop experience can have a denser information architecture.

---

# 27. ACCESSIBILITY

Design for accessibility from the beginning.

Consider: semantic HTML, keyboard navigation, focus states, readable typography, sufficient contrast, screen readers, form labels, error messages, reduced motion, accessible controls.

Do not treat accessibility as a final polish step.

---

# 28. PERFORMANCE

The site should feel extremely fast.

Prioritize: low JavaScript, server rendering where useful, optimized images, pagination, lazy loading, efficient database queries, caching, minimal dependencies.

The website should feel fast even on average Argentine mobile connections.

Define performance targets.

---

# 29. SEO

Public content that is appropriate for indexing should be discoverable.

Think about: semantic URLs, metadata, Open Graph, canonical URLs, sitemap, robots.txt, structured data where useful, server rendering, stable URLs.

However, privacy-sensitive anonymous content should not automatically be indexed.

Design a clear indexing policy.

---

# 30. URL STRATEGY

URLs are part of the long-term archive.

They should be: human-readable, stable, predictable, durable.

Example concepts: `/materias/derecho-constitucional`, `/carreras/abogacia`, `/p/abc123`, `/archivo/2026`

Avoid URLs that become meaningless after frontend redesigns.

The content URL should survive a future rewrite of the entire application.

---

# 31. CONTENT OWNERSHIP & DELETION

Think deeply about content lifecycle.

Users should be able to: edit where appropriate, delete their content where appropriate, delete their account, understand what happens to their posts after account deletion.

Design what happens to: comments, resources, marketplace transactions, historical posts, anonymous posts, moderation records.

Do not promise permanent preservation of everything.

The archive should preserve valuable community history without violating privacy.

---

# 32. LEGAL / ETHICAL CONSIDERATIONS

The planning phase must explicitly identify legal/ethical areas that need professional review.

Potential areas: privacy, personal data, anonymous accounts, minors if applicable, copyright, user-generated content, defamation, academic material, university trademarks, domain ownership, payments, consumer protection, content moderation, data retention, account deletion.

Do not pretend this document constitutes legal advice.

Flag issues requiring professional/legal verification.

---

# 33. DATA PRESERVATION

Because the 10-year vision matters, design for data portability.

The database should not become impossible to migrate.

Consider: PostgreSQL, documented schema, regular exports, database migrations, stable identifiers, storage organization, content metadata, backups, disaster recovery, export tooling.

Ask: "If Vercel and Supabase disappeared tomorrow, could we move uca.net somewhere else?"

The answer should eventually be yes.

---

# 34. OBSERVABILITY

Even with free tools, we need basic visibility.

Track: errors, authentication failures, database failures, performance, important product events.

Avoid invasive tracking. Prefer privacy-conscious analytics. Define the minimum useful events.

---

# 35. ANALYTICS

Important product metrics may include: daily active users, weekly active users, monthly active users, retention, posts/day, comments/day, resources uploaded, resource downloads, searches, subject follows, sessions, returning users, notification interactions.

But do not turn analytics into surveillance. Collect only what is genuinely useful.

---

# 36. GROWTH STRATEGY

The initial community is small.

Design a realistic path from: 0 → 10 users, 10 → 100, 100 → 500, 500 → 1,000, 1,000 → 10,000.

Think about: student ambassadors, QR codes, word of mouth, useful resources, viral discussions, subject pages, search traffic, historical content, invitation mechanisms.

Do not depend on paid advertising. The product should ideally grow because it is useful.

---

# 37. COLD START PROBLEM

This is critical. A social network with no users is empty.

Think deeply about how the first users find value before the network is dense.

Potential solution: Academic resource database + subject pages + useful searchable content.

This means users can obtain value even when few people are online. Then community interaction grows around that utility.

Recommend the best cold-start strategy.

---

# 38. FIRST 100 USERS

Design the exact strategy for the first 100 real users.

Do not simply say: "Invite students."

Explain: who should be invited first, why, what they should see, what content should exist before they arrive, what behavior we want, how to measure whether the experiment works.

---

# 39. PRODUCT LOOP

Identify the core behavioral loop.

Potential loop: Student enters → sees current activity → finds useful information → comments → receives response → follows subject → posts something → receives interaction → returns later.

But analyze whether this is actually the strongest loop. Propose alternatives.

---

# 40. MVP DEFINITION

Create an extremely strict MVP.

The MVP should include only what is necessary to prove:

1. students want to visit
2. students want to post
3. students want to interact
4. students want to follow subjects
5. students find academic resources useful
6. the anonymous identity model works
7. moderation is manageable

Everything else should be postponed.

Do not build: complex marketplace payments, mobile app, sophisticated recommendation AI, advanced chat, unnecessary social features, complex gamification, expensive infrastructure — unless you can justify them.

---

# 41. DEVELOPMENT PHASES

Create a detailed roadmap.

Suggested conceptual phases:

Phase 0 — Architecture; Phase 1 — Foundation; Phase 2 — Authentication & identity; Phase 3 — Feed; Phase 4 — Subjects; Phase 5 — Comments & interaction; Phase 6 — Resources; Phase 7 — Moderation; Phase 8 — Search; Phase 9 — Archive; Phase 10 — Growth.

But modify this order if your analysis suggests a better sequence.

For each phase define: objective, features, database work, frontend work, backend work, security work, testing, deployment, definition of done.

---

# 42. TESTING STRATEGY

The project is intended to be developed quickly, potentially with AI assistance. This increases the importance of testing.

Define: unit tests, integration tests, database tests, authentication tests, authorization tests, RLS tests, end-to-end tests, mobile tests, moderation tests, security tests.

Focus testing effort on critical paths.

---

# 43. AI-ASSISTED DEVELOPMENT

Assume that AI coding tools will be used heavily.

The architecture must therefore be: explicit, documented, modular, predictable, strongly typed, easy to reason about.

Create rules for AI-assisted coding such as:

* never modify database schema without migration
* never bypass RLS
* never expose service-role keys
* never put secrets in client code
* never invent database fields
* never duplicate business logic unnecessarily
* always validate server-side
* preserve existing conventions
* keep components focused
* document important decisions

The project should have a clear `README`, architecture documentation, database migration strategy, environment documentation, and coding conventions.

---

# 44. REPOSITORY STRUCTURE

Recommend a clean project structure.

For example, consider: app, components, features, lib, server, database, types, tests, public.

But do not blindly use this structure. Recommend the simplest structure that remains maintainable. Explain your decision.

---

# 45. DESIGN SYSTEM

Define a small design system.

Specify: typography, font choices, font hierarchy, body text size, line height, colors, borders, radius, spacing scale, buttons, links, forms, cards, lists, tabs, navigation, states, errors, loading states.

The system should be small. Do not create dozens of design tokens unnecessarily.

---

# 46. VISUAL CHARACTER

The site should have a recognizable personality.

Imagine: a student opens uca.net in 2026. Then another opens it in 2031. Then another opens it in 2036.

All three should recognize that they are using the same platform.

The visual language should therefore be: timeless, restrained, information-oriented, typographic, editorial, slightly utilitarian, human.

It should not chase current design trends.

---

# 47. CONTENT DENSITY

Do not make every piece of information into a huge card.

Use: lists, inline metadata, compact rows, clear separators, typography, small contextual labels.

Information density is a feature. But readability is equally important. Find the balance.

---

# 48. NO EMOJI UI

Do not use emojis as: navigation icons, decorative UI, feature indicators, section titles, buttons.

The product can display emojis if users write them in their own posts.

But the product's interface should not depend on emojis.

Use typography, spacing, borders, and a restrained icon set where appropriate.

---

# 49. HOMEPAGE DESIGN

Design the exact homepage experience.

Think through: header, navigation, logo, search, feed, sidebar, trending, subjects, login state, logged-out state, mobile version.

Do not create a generic marketing homepage. The actual product should be visible immediately. The platform should feel alive.

---

# 50. LOGGED-OUT EXPERIENCE

A visitor who is not logged in should still understand: what uca.net is, what is happening, why it matters, how to join.

But avoid exposing privacy-sensitive information.

The logged-out homepage should also help SEO.

---

# 51. ONBOARDING

Keep onboarding extremely short.

Potential flow: 1. create account → 2. choose pseudonym → 3. select degree program → 4. select subjects → 5. enter feed.

Do not ask for unnecessary information. The user should reach the useful part of the product quickly.

---

# 52. ACCOUNT RECOVERY

Think through how users recover accounts while remaining anonymous publicly.

Email may exist internally for account recovery, but must not become public.

Explore whether users can change pseudonyms without breaking historical reputation.

---

# 53. MODERATION & ANONYMITY TRADE-OFF

Analyze this carefully.

Anonymous communities are powerful because users may speak more freely. But they can become toxic.

We need mechanisms that preserve: freedom, privacy, pseudonymity — while reducing: abuse, harassment, spam, manipulation.

Do not solve this by destroying anonymity.

---

# 54. RESOURCE MODERATION

User-uploaded resources are a special risk.

Design: allowed file types, file size limits, virus/malware scanning strategy, copyright reporting, resource moderation, storage policies, download authorization, abuse prevention.

Start simple.

---

# 55. MONETIZATION ROADMAP

Do not monetize aggressively at launch.

Develop a staged plan:

Stage 0 — No monetization. Stage 1 — Potential marketplace. Stage 2 — Optional promoted resources/services. Stage 3 — Potential premium features. Stage 4 — Potential advertising if the community is large enough.

Evaluate which monetization strategies are compatible with the long-term identity of uca.net.

Do not destroy trust for short-term revenue.

---

# 56. DOMAIN & BRAND

The primary domain is intended to be: **uca.net**

Do not assume ownership, trademark permissions, or institutional affiliation.

Flag the need to verify: domain availability/ownership, trademark issues, brand confusion, relationship with UCA, disclaimers, legal positioning.

The product should not falsely imply official institutional ownership if it is independent.

---

# 57. FUTURE EXPANSION

Do NOT build multi-university support now. But architect the data model so it is possible later.

Potential future: UCA Rosario, other UCA locations, other universities, other campuses.

The platform could eventually become a general university community platform.

However: **UCA Rosario is the initial world.** Optimize for density, not breadth.

---

# 58. TEN-YEAR ARCHITECTURAL PRINCIPLE

The frontend can be rewritten. The backend can be rewritten. The hosting provider can change. The UI can change. The database implementation can evolve.

But the core community data should be preservable.

Therefore:

> **Do not couple the identity of the product to the current technology stack.**

Use stable identifiers. Use documented migrations. Use portable data. Use durable URLs. Preserve historical semantics.

---

# 59. IMPORTANT PRODUCT QUESTIONS

Before finalizing the architecture, explicitly answer questions such as:

1. What exactly is uca.net?
2. Why would a student use it every day?
3. Why would they return?
4. What makes it different from WhatsApp groups?
5. What makes it different from Instagram?
6. What makes it different from Reddit?
7. What makes it different from Discord?
8. What makes it different from the official university systems?
9. What is the minimum viable social graph?
10. What is the minimum viable academic graph?
11. What is the strongest cold-start strategy?
12. What content should be public?
13. What content should be private?
14. What should be anonymous?
15. What should never be anonymous?
16. How do we prevent the platform from becoming toxic?
17. How do we preserve valuable history?
18. How do we remain within free infrastructure?
19. What breaks first at 1,000 users?
20. What breaks first at 10,000?
21. What breaks first at 100,000?
22. How do we migrate when free tiers are no longer sufficient?
23. What is the first monetization opportunity?
24. What should never be monetized?
25. What makes this a product worth maintaining for 10 years?

---

# 60. REQUIRED OUTPUT

A comprehensive master plan containing, at minimum:

PART 1 — EXECUTIVE PRODUCT VISION · PART 2 — PRODUCT PRINCIPLES · PART 3 — USER PERSONAS · PART 4 — COMPLETE PRODUCT MAP · PART 5 — MVP · PART 6 — USER FLOWS · PART 7 — INFORMATION ARCHITECTURE · PART 8 — DATABASE DESIGN · PART 9 — AUTHENTICATION & ANONYMITY · PART 10 — SECURITY · PART 11 — MODERATION · PART 12 — FEED · PART 13 — SEARCH · PART 14 — RESOURCES · PART 15 — MARKETPLACE · PART 16 — ARCHIVE · PART 17 — UI/UX · PART 18 — DESIGN SYSTEM · PART 19 — TECH STACK · PART 20 — VERCEL + SUPABASE ARCHITECTURE · PART 21 — FREE-TIER STRATEGY · PART 22 — PERFORMANCE · PART 23 — SEO · PART 24 — ANALYTICS · PART 25 — TESTING · PART 26 — DEVELOPMENT WORKFLOW · PART 27 — REPOSITORY STRUCTURE · PART 28 — ROADMAP · PART 29 — LAUNCH STRATEGY · PART 30 — GROWTH · PART 31 — MONETIZATION · PART 32 — TEN-YEAR VISION · PART 33 — RISKS · PART 34 — OPEN QUESTIONS · PART 35 — FINAL RECOMMENDATION

---

# 61. CRITICAL BEHAVIOR

Do not blindly agree with this brief.

If something is a bad idea, say so. If a feature should be removed, recommend removing it. If the MVP is too large, reduce it. If Supabase free tier cannot realistically support something, explain why. If a technical decision creates long-term debt, identify it. If anonymity creates a serious risk, propose a better mechanism. If the marketplace is premature, say so. If the archive should work differently, explain why. If a design decision conflicts with the 10-year vision, flag it.

The objective is not to validate our ideas. The objective is to produce the **best possible architecture and product strategy for uca.net**.

---

# 62. DO NOT OVERENGINEER

The initial product may be built by one person with AI assistance and almost no infrastructure budget.

Prefer: boring technology, simple architecture, PostgreSQL, server-rendered pages, straightforward React, simple APIs, simple relational data, strong database constraints, clear code, minimal dependencies.

Avoid unnecessary: microservices, Kubernetes, event buses, complex distributed systems, separate search infrastructure, separate caching infrastructure, unnecessary message queues, complex recommendation systems, unnecessary third-party services.

Start simple. Design the escape hatch for scale later.

---

# 63. DECISION FRAMEWORK

For every major technical decision, evaluate:

1. Simplicity · 2. Cost · 3. Security · 4. Performance · 5. Maintainability · 6. Developer experience · 7. Scalability · 8. Data portability · 9. Long-term durability · 10. Compatibility with the 10-year vision

Do not optimize exclusively for launch speed. Do not optimize exclusively for hypothetical scale. Find the sensible middle ground.

---

# 64. FINAL MENTAL MODEL

Think of uca.net as:

**A university community in real time** + **a knowledge base** + **an anonymous social network** + **a student resource library** + **a historical archive.**

But the experience should never feel like five products glued together. It should feel like **one coherent place**.

The user should be able to move naturally between:

"What's happening?" → "What are people saying about my subject?" → "What resources exist?" → "Who can help me?" → "What happened in previous years?"

That is the core ecosystem.

---

# 65. THE MOST IMPORTANT DESIGN QUESTION

Before proposing any implementation, answer this:

> **What would make a student open uca.net voluntarily every single day, even when they do not have an exam tomorrow?**

That answer should influence the entire architecture. Do not proceed until you have a convincing answer.

---

# 66. BUILD FOR 2036

It is 2036. A student opens uca.net. The platform has existed for ten years. The UI has evolved, the technology has changed, the university has changed, thousands of students have graduated, thousands more have arrived.

But the student can still: find their subjects, ask questions, discover resources, participate anonymously, see what is happening, search historical discussions, discover useful knowledge created by previous generations, contribute something that future students may use.

The platform still feels recognizable. Still fast. Still useful. Still human. Still independent of any specific technology stack. Still alive.

Design the architecture and product strategy so this future is technically and culturally possible.
