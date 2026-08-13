# PART 17 — UI/UX

> Bound by spine D8 (editorial direction), D2 (MVP cut), D3 (anonymity mechanics), D7 (URL map). Everything below is implementable as-is: exact copy, exact layout numbers, exact states. All UI copy is es-AR voseo. Satisfies brief §5, §25, §26, §27, §47, §48, §49, §50, §51.

## 17.1 Layout system

**Decision:** One layout skeleton for the whole product: a fixed-height header, a single content column of ~680px with a 300px right rail on desktop, and a top bar + bottom tab bar on mobile. There is **no left navigation column** at any breakpoint. Navigation is the header (desktop) or the bottom bar (mobile); context lives in the right rail.

Rationale: a left nav is the signature of the "generic SaaS dashboard" the brief prohibits (§5), and it burns 220–260px of width on a product whose unit of value is a readable text column. Reddit-style three-column layouts also fragment attention. Wikipedia's lesson (brief §5) is that one strong content column plus contextual side matter is enough for information-dense sites; we take that and drop everything else.

### 17.1.1 Desktop layout (≥1024px)

- **Header**: 56px tall, full-width, `background: var(--color-surface)`, 1px bottom hairline border. Sticky (`position: sticky; top: 0`) — it is the only sticky element on desktop. Contents, left to right:

| Slot | Element | Why it earns the slot |
|---|---|---|
| 1 | Wordmark "uca.net" (links `/`) | Identity + home affordance; leftmost = strongest scanning position |
| 2 | Buscar: input, placeholder "Buscar materias, publicaciones, recursos", width 320px | Search is the utility magnet's front door (D1); an always-visible input outperforms an icon-that-expands for discoverability |
| 3 | "Publicá" — primary button | The single most important action (posts create the AHORA layer); it gets the only filled-accent element in the chrome |
| 4 | Avisos: bell icon + unread count badge, links `/avisos` | Replies are the retention hook (PART 12); must be one click from everywhere |
| 5 | Cuenta: handle as text ("MateConBizcochos") opening a menu: "Mi perfil", "Ajustes", "Modo oscuro", "Cerrar sesión" (+ "Panel de moderación" for mods) | Text handle, not an avatar circle — text-first identity per D2 (avatars are P2-if-ever); the menu keeps the header to 5 slots |

  Logged-out header replaces slots 3–5 with two links: "Ingresá" (tertiary) and "Crear cuenta" (primary button).

- **Content region**: centered, `max-width: 1012px` (680 main + 32 gap + 300 rail), page padding 24px. Main column `max-width: 680px` — 65–75 characters per line at 16px, the readability optimum. Right rail `width: 300px`, top-aligned, **not sticky** (a rail that follows the scroll is decoration; ours is context you consult then leave).
- **Right rail contents by page** (each block: 13px section label in `--color-text-secondary`, then compact rows):
  - Every page (permanent, first block): "Explorar" — three link rows "Materias" (`/materias`) · "Recursos" (`/recursos`) · "Archivo" (`/archivo`, hidden until the P3 route ships). This block is the desktop reachability path for the index pages (R19): with no left rail and a 5-slot header, `/materias` and `/recursos` stay one click away via the rail on desktop and the bottom bar on mobile.
  - Home logged-in: "Mis materias" (followed materias list, each linking its page, with unread-activity dot) → "Actividad" (5 most recent posts across the site, title-only rows) → links row "Reglas · Acerca de".
  - Materia page: materia facts (see 17.4.1) → "Recursos recientes" (3 rows) → "Reglas".
  - Post page: materia context block (name, followers, "Seguir" button) → "Más en esta materia" (3 recent post titles).
  - Home logged-out: explainer block + carrera directory (17.3).
- **Footer** (every page, main column width): hairline top border, 13px text: "Sitio independiente hecho por estudiantes. Sin afiliación con la Universidad Católica Argentina." plus links "Reglas · Términos · Privacidad · Acerca de". The disclaimer line is non-removable chrome (D8, D10).

### 17.1.2 Mobile layout (<768px)

- **Top bar**: 48px, sticky. Wordmark left; right side: avisos bell with badge, cuenta (handle abbreviated to 12 chars, opens the same menu as desktop). Search moves to the bottom bar — the top bar stays two-thirds empty on purpose; cramming search here makes every element sub-44px.
- **Bottom tab bar**: 56px, fixed, `env(safe-area-inset-bottom)` respected, 5 equal slots, each a ≥44×44px target with 16–18px icon over an 11px label:

| Slot | Label | Route | Justification |
|---|---|---|---|
| 1 | "Inicio" | `/` | Feed is the daily-check surface (spine 0.1); leftmost = habitual first tap |
| 2 | "Materias" | `/materias` | The permanence layer needs one-tap access or resources die on mobile; also the browse entry for logged-out |
| 3 | "Publicar" | opens composer | **Center = the thumb's resting position** on both left- and right-handed grips; the create action must be the cheapest reach because posts are the scarcest resource in a small community. Rendered visually distinct: accent-colored icon (plus in a 2px-radius square outline), not a floating FAB (FABs are the SaaS aesthetic §5 bans) |
| 4 | "Buscar" | `/buscar` | Full-screen search page with the input auto-focused; better mobile search UX than a shrunken header input |
| 5 | "Avisos" | `/avisos` | Duplicated from top bar deliberately: the retention hook must be in thumb reach; the top-bar bell is for badge visibility while reading |

  Cuenta intentionally has no bottom slot: profile/settings are weekly-frequency destinations, not daily; they live behind the top-bar handle. Logged-out mobile shows the same bar with slots 3 and 5 replaced by a single "Crear cuenta" primary action spanning the center.
- **Content**: single column, 16px side padding, full-width rows. The right rail's blocks reflow **below** the main content on materia/post pages (materia facts appear as a collapsed block under the header instead — see 17.6), and are dropped entirely on the home feed (mis materias are reachable via "Materias").

### 17.1.3 Tablet (768–1023px)

Desktop header (it fits at 768px with search shrunk to 240px), no bottom bar, single column with rail blocks reflowed below content. This is deliberately the desktop family, not the mobile family: tablet users have pointer-or-large-touch and landscape width.

## 17.2 Homepage — logged in (brief §49)

**Decision:** The logged-in homepage is the feed itself: inline composer at top, two tabs ("Mis materias" / "Reciente"), post rows below, right rail as per 17.1.1. Nothing else — no banners, no onboarding tips after first week, no trending module (Tendencias is P2 per D2).

Top-to-bottom spec (main column):

1. **Inline composer** (collapsed state): a single-line input-lookalike, 44px tall, placeholder **"¿Qué está pasando en tu carrera?"**, with the user's handle prefix omitted (redundant). Clicking/focusing expands it into the full composer (17.4.3) in place — no modal on desktop; on mobile it navigates to a full-screen composer route.
   - Prompt copy decision: "¿Qué está pasando en tu carrera?" (chosen) over "¿Qué contás?" (too vague), "Escribí algo…" (cold), "¿Qué está pasando?" (Twitter's exact ghost). The carrera framing aims the post at the cohort, which is the community unit (D1), and primes on-topic content without a rules lecture.
2. **Feed tabs**: "Mis materias" (default) | "Reciente". Text tabs, 2px accent underline on the active tab, URL-addressable (`/` and `/reciente` per D7) so the browser back button and sharing work. "Mis materias" = posts tagged with followed materias + untagged posts by authors of the user's carrera (exact query in PART 12). If the user follows zero materias, the tab shows an empty state: "Todavía no seguís ninguna materia." + tertiary button "Elegí tus materias" → `/materias`.
3. **Post rows** (the feed unit, reused on materia/carrera/profile pages): compact list row, not a card. 12px vertical padding, hairline separator between rows, no border radius, no shadow. Contents:
   - Meta line (13px, `--color-text-secondary`): author handle (or "Anónimo" in the same style — no icon, no special color) · materia chip if tagged · relative timestamp. Example: `MateConBizcochos · Derecho Constitucional · hace 2 h`.
   - Title (16px/600) if present; body preview (16px/400) clamped to 3 lines with CSS `line-clamp`, no "ver más" link — the whole row links to `/p/[publicId]`.
   - Action line (13px): score as static text "12 votos" (not a control — voting happens on the post page, R20), "12 comentarios" as a link. Nothing else at row level — compartir/reportar live on the post page. Question posts (`kind = pregunta`) prefix the title with the chip "Pregunta".
4. **Pagination**: sentinel auto-load (17.5.2).

## 17.3 Homepage — logged out (brief §50)

**Decision:** The logged-out homepage is the product read-only, not a marketing page: a 2-line explainer strip, then the actual "Reciente" feed, then the carrera directory. A visitor sees real student content within one viewport-height of arriving. No hero image, no feature grid, no testimonials.

Top-to-bottom spec:

1. **Explainer strip** (main column, 24px vertical padding, hairline bottom border — a strip, not a hero):
   - Line 1 (22px/600): "La comunidad estudiantil de la UCA Rosario."
   - Line 2 (16px/400, `--color-text-secondary`): "Publicaciones anónimas, apuntes y parciales viejos, materia por materia."
   - Actions: primary button "Crear cuenta" (→ `/registro`), tertiary link "Ya tengo cuenta" (→ `/ingresar`). Left-aligned with the text, standard button size — not oversized (§5).
   - [LEGAL REVIEW] The strip's wording must survive the D10 naming review; "de la UCA Rosario" may need to become "de estudiantes de la UCA Rosario" or weaker per counsel.
2. **Feed**: the real "Reciente" feed, same rows as 17.2.3, fully readable (C16: public-by-default). Rows carry no vote control (R20); on post pages, vote and comment actions act as auth gates: clicking shows a small dialog "Para votar necesitás una cuenta." with "Crear cuenta" / "Cancelar". Anonymous posts render identically to logged-in view.
3. **Right rail** (desktop): the explainer condensed + "Carreras" directory — a plain list of carrera links ("Abogacía", "Ingeniería Industrial", …) → `/carreras/[slug]`. On mobile this list renders below the feed's 10th row. These links are the SEO skeleton (PART 23): every crawl of `/` reaches every carrera, which reaches every materia.
4. **Footer** with the independence disclaimer (17.1.1) — on the logged-out page this is load-bearing legal copy, not boilerplate.

Registration itself is invite-gated in beta (D3): "Crear cuenta" without an invite code lands on `/registro` showing "Por ahora, el registro es con invitación. Pedile el link a quien te contó de uca.net." + email field "Avisame cuando abra" (stores email only, PART 24). [HUMAN DECISION] whether the waitlist field ships in beta or the page is invite-only silent.

## 17.4 Screen-by-screen specs

Each spec lists: URL (per D7), structure top-to-bottom, and exact es-AR copy for fixed strings. States (loading/empty/error) follow the global rules in 17.5 unless noted.

### 17.4.1 Materia page — `/materias/[slug]`

- **Header block** (main column): materia name as h1 (28px/600, serif — see PART 18 type), then a facts line (14px, secondary): the carreras that include it as inline chips with year/cuatrimestre — "Abogacía (2° año, 1er cuatrimestre) · Ciencias Políticas (3er año)" — each chip linking its carrera page; then "128 seguidores" and the follow button.
- **Follow button**: secondary button "Seguir"; followed state renders as "Siguiendo" (secondary with check icon); hover on followed state swaps label to "Dejar de seguir" (desktop only; mobile taps toggle directly, with a toast "Dejaste de seguir Derecho Constitucional" carrying "Deshacer").
- **Tabs**: "Publicaciones" (default) | "Recursos". URL-addressable: `/materias/[slug]` and `/materias/[slug]/recursos`.
- Publicaciones tab: inline composer (collapsed, pre-tagged with this materia, placeholder "Preguntale algo a los que ya la cursaron"), then post rows. Empty state: "Nadie publicó en esta materia todavía. Sé la primera persona." + the composer already present above.
- Recursos tab: resource rows (17.4.5) + primary button "Subí un recurso" at top. Empty state: "Todavía no hay recursos de esta materia." + the button.
- Right rail: facts block (facultad, carreras, seguidores), 3 recent resources, "Reglas" link.

### 17.4.2 Post page — `/p/[publicId]`

- **Post block**: meta line (author/Anónimo · materia chip · relative timestamp; edited posts append "· editado"), title (22px/600), full body (16px/1.6, paragraphs preserved, links auto-detected and rendered in accent; no rich text in MVP).
- **Action bar** (below body, 14px): vote control "▲ 12" · "Comentar" (focuses the comment box) · "Compartir" (copies canonical URL, toast "Link copiado") · overflow menu ("⋯" = more-horizontal icon) containing "Reportar" (all users), "Editar"/"Eliminar" (author only), "Moderar" (mods). Reportar is deliberately in the overflow: visible enough to find, not so prominent it becomes a reflex-tap in arguments.
- **Comment composer**: textarea, placeholder "Escribí un comentario", Anónimo checkbox (same component and copy as 17.4.3), primary button "Comentar". Logged-out: the box renders disabled with "Ingresá para comentar" as a link.
- **Comment tree** (depth ≤ 2 per D2): top-level comments as list rows; replies indented 24px behind a 1px vertical hairline (the only tree affordance — no connector curves). Reply rows have no "Responder" action (depth cap); top-level rows do. Anonymous comment authors within the thread show their per-thread alias per D3: "Anónimo 1", "Anónimo 2" — same typographic treatment as handles, never linked. Ordering: chronological (oldest first) in MVP — comprehensible archives beat engagement sorting (D1 permanence). Each comment: meta line, body, vote "▲ 3", "Responder" (top-level only), overflow with "Reportar".
- Removed content placeholder: "Comentario eliminado por moderación." / "Comentario eliminado por su autor." in secondary color, replies preserved beneath.

### 17.4.3 Composer (inline expansion on desktop, full-screen route on mobile)

Fields, top to bottom:

1. **Body** textarea (required, ≤10.000 chars): auto-growing from 3 rows, placeholder inherits context ("¿Qué está pasando en tu carrera?" on home; the materia variant on materia pages). Character counter appears only past 9.000 chars: "9.120/10.000".
2. **Title** input (optional, ≤120): placeholder "Título (opcional)". Shown collapsed as a "+ Agregar título" tertiary link until clicked — most micro-posts need no title and the empty field would nag.
3. **Row of options** (14px controls): materia selector (searchable select, placeholder "Materia (opcional)", chosen value renders as a removable chip) · checkbox "Es una pregunta" (sets `kind = pregunta`) · the **Anónimo checkbox**.
4. **Anónimo checkbox with inline explainer** — exact copy, always visible next to the control, not hidden in a tooltip:
   - Label: "Publicar como anónimo"
   - Explainer (13px, secondary, directly under the label): **"Tu nombre no se muestra. El equipo de moderación puede ver el autor."**
   - When checked, the composer's implicit byline preview swaps from the user's handle to "Anónimo". This copy is the product's honesty contract (D3, brief §8) and is a protected string: changing it requires a spine amendment.
5. **Actions**: primary "Publicá" (disabled until body is non-empty), tertiary "Cancelar" (confirm-discard dialog if body has >20 chars: "¿Descartar la publicación?" / "Descartar" / "Seguir escribiendo").

Server rejection (rate limit, validation) renders inline above the actions in danger color, e.g. "Estás publicando muy seguido. Esperá unos minutos." — the composer content is never lost on error.

### 17.4.4 Perfil — `/u/[handle]`

- **Own view** (viewing yourself): handle (h1), carrera + año if set ("Abogacía · Ingreso 2024"), karma as plain text "218 puntos" (no icon, no progress bar — C10), member-since ("En uca.net desde marzo de 2027"), tertiary link "Editar perfil" → `/ajustes`. Tabs: "Publicaciones" | "Recursos". A one-line notice in secondary text: "Tus publicaciones anónimas no aparecen acá ni en tu perfil público." — they are visible nowhere, including to yourself in profile listings (a "my anonymous posts" list would be a shoulder-surfing leak; users find them via Avisos replies).
- **Public view**: identical minus the edit link and the notice. Lists only non-anonymous, non-removed content. Deleted users render as "usuario-eliminado-x7k2" with an empty profile (D3). Profiles are `noindex` (C16).

### 17.4.5 Recursos — `/recursos`, `/recursos/[publicId]`

- **List row** (dense row, explicitly not a card): line 1 — tipo chip ("Resumen", "Parcial", "Final", "Apunte", "Guía", "Otro") + title (16px/600); line 2 (13px secondary) — materia · año if set ("Parcial 2023") · "PDF · 2,4 MB" · "134 descargas" · "▲ 18". Row links to the detail page. The global `/recursos` list has a materia filter select and tipo filter chips at top.
- **Detail page**: title (22px), meta block (materia link, tipo, año, subido por handle/Anónimo, fecha, files list with sizes), description paragraph, primary button "Descargar (PDF, 2,4 MB)" per file (signed-URL fetch, PART 20), vote control, overflow with "Reportar". [FREE-TIER RISK] The download button is the egress spender (D13): no inline PDF preview/viewer in MVP — previews double egress per consult.
- **Upload form** (`/recursos/subir`, linked from materia pages): title, materia (required here), tipo select, año select (optional, "¿De qué año es el parcial/final?"), description textarea, file input ("PDF o imágenes, hasta 10 MB por archivo, máximo 3"), Anónimo checkbox (same copy as 17.4.3), primary "Publicá el recurso". Upload progress as a determinate bar; on success, redirect to the detail page with toast "Recurso publicado. Queda visible para toda la comunidad."

### 17.4.6 Buscar — `/buscar?q=`

Single input (auto-focused on arrival from the mobile tab), placeholder "Buscar materias, publicaciones, recursos". Results grouped under 13px section labels in fixed order, with page-one group sizes per PART 13 §13.5: "Materias" (5, name rows) → "Carreras" (3) → "Recursos" (5) → "Publicaciones" (10, then paginated) — materias first because they are the navigational intent, recursos before posts because utility outranks conversation for searchers (D1). Query terms are not highlighted in MVP (FTS headline generation is a P2 nicety). Empty state: "No encontramos nada con «parcial civil 2023». Probá con menos palabras." No search-as-you-type in MVP — submit on Enter; every keystroke-query is a DB hit [FREE-TIER RISK].

### 17.4.7 Avisos — `/avisos`

List rows: unread rows carry a 6px accent dot left of the text and `--color-surface-raised` background; text like "MateConBizcochos respondió tu publicación: «¿Alguien tiene el resumen de…»" or "Anónimo respondió tu comentario en «…»" (actor display precomputed respecting anonymity, D4) or "Tu publicación fue eliminada por moderación. Ver motivo." Each row links to the target. Header action: tertiary "Marcar todo como leído". Empty state: "No tenés avisos." Rows are read-marked on page visit, not per-row taps. Unread count badge (header bell + mobile tab) shows "9+" past nine.

### 17.4.8 Ajustes — `/ajustes`

Single page, stacked sections with 13px labels (no settings sub-nav — MVP has too few settings to justify one):

- "Perfil": seudónimo (with helper "Podés cambiarlo cada 90 días. Se actualiza en todo lo que publicaste." — D3), carrera select, año de ingreso select.
- "Cuenta": email (shown masked "a•••@•••.com", change flow via confirmation email), contraseña ("Cambiar contraseña" → email flow).
- "Notificaciones": one checkbox — "Respuestas a mis publicaciones y comentarios" (`profiles.notif_respuestas`, default on; per PART 8). Below it, 13px secondary text: "Las decisiones de moderación y el resultado de tus reportes se avisan siempre." — decision_mod and reporte_resuelto are always-on, no control rendered. Full preference table is P2.
- "Apariencia": radio "Automático / Claro / Oscuro" (PART 18 dark mode).
- "Cuenta" (danger zone, hairline-separated, no red background): "Cerrar sesión en todos los dispositivos" (secondary) and "Eliminar mi cuenta" (danger-tertiary) → dialog implementing D3's choice: "¿Qué hacemos con lo que publicaste?" radio "Borrar mis publicaciones" / "Conservarlas como usuario eliminado", then type-to-confirm the handle.

### 17.4.9 Onboarding — the §51 flow, visual treatment

Flow (owned by PART 6 §6.1 — screen count, copy, and skip rules live there): registro → confirmación de email (out of band) → seudónimo → carrera + año con auto-follow de materias → feed. Visual treatment decision: **single centered column, max-width 400px, one question per screen, progress as plain text "Paso 1 de 2"** — no progress bar animation, no illustration, wordmark small at top. Each step:

1. `/invitacion/[code]` (S1): email + contraseña + "Crear cuenta", legal line per PART 6. Then the email-confirm interstitial (S2): copy and resend rules per PART 6 §6.1; the confirmation link returns to `/registro/continuar`.
2. Seudónimo (S3, paso 1 de 2): input with live availability check, es-AR flavored generator pre-fill with "Probar otro" (D3), helper and validation copy per PART 6 §6.1. Primary "Continuar".
3. Carrera + materias (S4, paso 2 de 2): "¿Qué estudiás?" — carrera select + año select; on selection the auto-follow list of that year's materias renders (checkbox list, all checked, from plan_materias) with "Agregar otras materias" inline search. De-emphasized skip link "Prefiero no decir mi carrera" advances (feed defaults to Reciente). Primary "Ir al feed".

Total: 3 interactive screens (one before, two after the email confirm), target ≤2 minutes per PART 6 §6.1. No welcome tour, no permission prompts, no "invite your friends" step.

### 17.4.10 Mod panel — `/mod/*`

**Decision:** deliberately utilitarian: dense tables, native controls, no visual polish budget — mods are power users at a desk, and effort here is stolen from the public product. Desktop-only layout (usable-but-cramped on mobile is acceptable). Structure: `/mod` = the queue table; columns: Fecha · Tipo (post/comentario/recurso/perfil) · Categoría · Reportes (count, grouped by target) · Contenido (60-char excerpt, links to an in-panel detail view showing full content **with real author identity** — the one surface where anonymity lifts, D3) · Estado · Acciones. Row actions as buttons: "Quitar", "Mantener", "Advertir", "Suspender…", "Banear…" (the latter two open a dialog: duration select + motivo textarea; motivo is shown to the user in Avisos, internal notes field separate — D4 `mod_actions`). Filters above the table: estado, categoría, tipo. Secondary pages: `/mod/acciones` (audit log table, immutable), `/mod/restricciones` (active restrictions, revocable). All destructive actions confirm with the target excerpt in the dialog. Full moderation logic in PART 11.

## 17.5 Interaction rules (global)

### 17.5.1 Votes — optimistic (post page only)

Vote controls exist only on the post page (and the resource detail page) — feed and list rows show the score as static text (17.2.3, R20). On those pages, vote taps update the UI immediately (count ±1, control fills accent), fire the server action, and roll back with a toast on failure ("No pudimos registrar tu voto."). The control is a toggle (tap again removes the vote, D4 vote tables). During rollback, no spinner — the number just corrects. Score text on rows may be seconds-stale from cache (PART 22); the post page is authoritative.

### 17.5.2 Pagination — auto-load with sentinel, footer reachable

**Considered:** (a) "Cargar más" button only; (b) pure infinite scroll; (c) auto-load with sentinel, capped, then button.
**Chosen:** (c). An IntersectionObserver sentinel ~600px before list end auto-loads the next page (cursor pagination, PART 12) for the first **3** auto-loads (~100 rows); after that, an explicit secondary button "Cargar más" per page.
**Why:** pure infinite scroll makes the footer — which carries the legal disclaimer — unreachable, and rewards doomscrolling the institution character rejects; button-only adds friction to the core 2-minute check.
**Cost:** slightly more code than either pure option; the 3-page cap is a magic number to tune.
No autoplay of anything, ever: no auto-advancing content, no unrequested motion (brief's anti-TikTok stance, §16).

### 17.5.3 Timestamps

Relative up to 7 days ("hace 40 s", "hace 2 h", "hace 3 d"), then absolute date ("12 mar 2027"; with year always — archive readers span years). Every relative timestamp carries the absolute datetime in a `title` attribute and `<time datetime>` for machines. es-AR abbreviations: s/min/h/d.

### 17.5.4 Loading — skeletons, not spinners

List surfaces (feed, comments, recursos, avisos, search) show 3–5 skeleton rows matching real row geometry (meta line + two text lines), pulsing at 1.5s, `--color-border` tone. Spinners are allowed only inside buttons during their own submit (replacing the label at same width, "Publicando…" as accessible text). Full-page spinners are banned. Skeletons render only when data isn't SSR'd — most public pages arrive full (PART 22), so skeletons are the exception.

### 17.5.5 Motion

Transitions ≤150ms, `ease-out`, only on: hover states, menu/dialog open (fade+2px rise), toast entry. No page transitions, no scroll animations, no parallax. `@media (prefers-reduced-motion: reduce)` sets all transition/animation durations to 0.01ms globally — including skeleton pulse (static tone instead).

### 17.5.6 Errors and empty states

Errors: inline, adjacent to their cause, danger color, sentence case, actionable ("No pudimos guardar el comentario. Probá de nuevo."). Never toast-only for form errors. Empty states: one sentence + one action (examples through 17.4); never illustrations. Destructive confirms: dialog with the object named ("¿Eliminar la publicación «…»? No se puede deshacer." / "Eliminá" / "Cancelá").

## 17.6 Responsive behavior by breakpoint

Breakpoints: 360 (small mobile, design floor) · 768 (tablet) · 1024 (desktop) · 1280 (wide). Mobile-first CSS; the 360 layout is the base.

| Element | 360 | 768 | 1024 | 1280 |
|---|---|---|---|---|
| Navigation | top bar 48px + bottom bar 56px | header 56px, no bottom bar | header 56px | header 56px |
| Search | `/buscar` page via tab | header input 240px | header input 320px | header input 320px |
| Content columns | 1, full-width, 16px padding | 1, max 680px centered | main 680 + rail 300 | main 680 + rail 300, extra space stays as margin |
| Right-rail blocks | dropped (home) / below content (materia, post) | below content | in rail | in rail |
| Composer | full-screen route | inline expansion | inline expansion | inline expansion |
| Materia facts | collapsed block under h1, "Más datos" toggle | inline under h1 | in rail | in rail |
| Mod tables | horizontal scroll within container | horizontal scroll | full table | full table |
| Type scale | unchanged (16px base at all sizes) | unchanged | unchanged | unchanged |
| Touch targets | all ≥44px | ≥44px | pointer sizes ok, still ≥32px | ≥32px |

Never: horizontal page scroll (tables/code scroll inside their own container), layout that reflows on font-size user overrides up to 200% zoom (WCAG 1.4.4 — tested in PART 25).

## 17.7 Accessibility (brief §27)

**Decision:** WCAG 2.1 AA is the bar, enforced by the review checklist (17.8) and Playwright+axe smoke checks (PART 25), not by aspiration.

- **Landmarks/semantics**: one `<header>`, `<nav>` (bottom bar and header nav, labeled `aria-label="Principal"`), `<main>` per page, `<aside>` for the rail, `<footer>`. Feed = `<ul>/<li>`; comments = nested lists; headings strictly hierarchical (one h1 per page). "Saltar al contenido" skip link as first focusable element.
- **Focus**: `:focus-visible` ring — 2px solid `--color-accent`, 2px offset — on every interactive element, never `outline: none` without replacement. Dialog and menu focus is trapped (Radix primitives per D6) and returns to the trigger on close.
- **Forms**: every input has a visible `<label>` (placeholders are never labels; composer body's label is visually-hidden "Texto de la publicación" since the placeholder-as-prompt is the design). Errors linked via `aria-describedby`, announced via a polite live region.
- **Target sizes**: ≥44×44px for all touch targets on mobile (vote controls padded to 44px hit area around the 18px icon).
- **Contrast**: every token pair proven ≥4.5:1 in PART 18.9's table; UI non-text (borders on inputs, focus ring) ≥3:1.
- **Screen-reader text for icon actions**: vote button: `aria-label="Votar publicación"` + `aria-pressed`, count as adjacent text "12 votos" (visually "▲ 12"); report: "Reportar publicación"; bell: "Avisos, 3 sin leer"; overflow: "Más opciones". No icon-only control without an accessible name — lint-enforced (PART 25).
- **Keyboard paths** (must pass manual test): (1) Tab from page load → skip link → header → composer → expand with Enter → fields in order → Anónimo checkbox (Space toggles; explainer is `aria-describedby` on it) → "Publicá"; (2) feed traversal: each row is one link stop + its comments stop; (3) full mod-queue action flow keyboard-only. No custom keyboard shortcuts in MVP (j/k navigation is P3 polish).
- **Language**: `<html lang="es-AR">`; dates/numbers via `Intl` with es-AR locale (decimal comma: "2,4 MB").

## 17.8 The anti-checklist — review rules (brief §5/§25/§48)

**Decision:** the brief's avoid-list is restated as binary review rules. Every PR touching UI is checked against them (PART 26 makes this a PR-template checklist); a rule violation is a change-request, not a style opinion.

| # | Rule (testable) | Source |
|---|---|---|
| 1 | No CSS gradients anywhere in chrome (grep `gradient(` = 0 matches outside user content) | §5 |
| 2 | No `backdrop-filter`/glassmorphism; overlay = flat `--color-overlay` scrim | §5 |
| 3 | No border radius > 4px on any element (checked via token-only radius values) | §25 |
| 4 | No box-shadow except the single `--shadow-overlay` on menus/dialogs/toasts | §25 |
| 5 | Above-the-fold on `/` (logged-out, 360px) contains real user content, not marketing | §49/§50 |
| 6 | No emoji in any UI string, label, button, heading, or empty state (CI grep over locale strings for emoji codepoints) | §48 |
| 7 | Icons only from the approved subset (PART 18.6); adding one requires updating that list in a PR | §25 |
| 8 | No illustration/stock/decorative image assets in the repo's public chrome assets | §5 |
| 9 | Buttons: standard sizes only (PART 18.5); no full-width buttons on desktop except in ≤400px auth/onboarding column | §5 |
| 10 | Content units render as list rows with hairline separators; introducing a boxed "card" for a list item requires a design-decision entry (D14 rule 8 analog) | §47 |
| 11 | Animation durations ≤150ms and only on the 17.5.5 allowlist; `prefers-reduced-motion` respected (axe/manual) | §27 |
| 12 | Every user-visible string es-AR voseo; CI greps merged locale strings for a denylist ("vosotros", "coge", "ordenador", "vale,") | §6/D9 |
| 13 | Type sizes/weights only from the PART 18 scale (no arbitrary `text-[17px]`; Tailwind arbitrary-value lint) | §45 |
| 14 | New color values only via tokens; raw hex in components = fail (stylelint) | §45 |
| 15 | Every icon-bearing control has an accessible name (axe rule, CI) | §27 |

# PART 18 — DESIGN SYSTEM

> Concrete tokens implementing D8. This section is the single source of truth for visual values; components and pages consume tokens only (anti-checklist rules 13–14). Satisfies brief §45, §46.

## 18.1 Palette

**Decision:** Paper-and-ink neutrals warmed slightly toward paper (never pure #FFF/#000), one working accent — **azul birome #2440B3** — plus one danger red and one success green. Total palette: 8 chromatic-or-neutral raw values per mode. No secondary accent, no decorative colors: a one-accent system is what stays recognizable across a decade of redesigns (§46).

Raw values (light mode):

| Token (raw) | Hex | Use |
|---|---|---|
| paper | #FAFAF7 | page background |
| paper-raised | #F3F2EE | alternate surfaces: unread aviso rows, code/quote blocks, skeleton base |
| ink | #1C1B1A | primary text, wordmark |
| ink-soft | #57534E | secondary text, meta lines, icons at rest |
| hairline | #E7E5E0 | all borders, separators |
| birome | #2440B3 | links, primary buttons, active states, focus ring |
| birome-deep | #1B3190 | accent hover/active |
| birome-wash | #EEF1FA | accent-subtle backgrounds: active-vote fill, selected chip |
| danger | #A8231D | destructive actions, error text |
| success | #166534 | success confirmations (toast text) |

Dark mode raw values (not a mechanical inversion — accent lightens to keep contrast, surfaces stay warm):

| Token (raw) | Hex | Use |
|---|---|---|
| paper-dark | #161514 | page background |
| paper-raised-dark | #201F1D | raised surfaces, menus/dialogs |
| ink-dark | #E9E7E2 | primary text |
| ink-soft-dark | #A6A29B | secondary text |
| hairline-dark | #2E2C29 | borders |
| birome-light | #93A8F0 | links/actions on dark |
| birome-lighter | #B3C2F5 | accent hover on dark |
| birome-wash-dark | #23293F | accent-subtle backgrounds on dark |
| danger-dark | #E8837B | errors on dark |
| success-dark | #7CC492 | success on dark |

### Semantic tokens (what components actually use)

| Semantic token | Light | Dark |
|---|---|---|
| `--color-bg` | #FAFAF7 | #161514 |
| `--color-surface` | #FAFAF7 | #161514 |
| `--color-surface-raised` | #F3F2EE | #201F1D |
| `--color-border` | #E7E5E0 | #2E2C29 |
| `--color-text-primary` | #1C1B1A | #E9E7E2 |
| `--color-text-secondary` | #57534E | #A6A29B |
| `--color-accent` | #2440B3 | #93A8F0 |
| `--color-accent-hover` | #1B3190 | #B3C2F5 |
| `--color-accent-subtle` | #EEF1FA | #23293F |
| `--color-on-accent` | #FAFAF7 | #161514 |
| `--color-danger` | #A8231D | #E8837B |
| `--color-success` | #166534 | #7CC492 |
| `--color-overlay` | rgb(28 27 26 / 0.4) | rgb(0 0 0 / 0.6) |

`--color-surface` equals `--color-bg` on purpose: header and page share one plane, separated by the hairline — no elevation theater. Dark mode ships day 1 (D8): `Automático` follows `prefers-color-scheme`; explicit choice sets `data-theme` on `<html>` (persisted in a cookie so SSR renders the right theme with no flash).

### 18.1.1 Contrast proofs (WCAG 2.1 relative-luminance formula, computed)

| Pair | Ratio | Passes |
|---|---|---|
| text-primary on bg (light) #1C1B1A/#FAFAF7 | 16.2:1 | AAA |
| text-secondary on bg (light) #57534E/#FAFAF7 | 6.9:1 | AA (AAA large) |
| accent on bg (light) #2440B3/#FAFAF7 | 8.2:1 | AAA |
| on-accent on accent (light) #FAFAF7/#2440B3 | 8.2:1 | AAA |
| danger on bg (light) #A8231D/#FAFAF7 | 6.9:1 | AA |
| success on bg (light) #166534/#FAFAF7 | 6.9:1 | AA |
| text-primary on bg (dark) #E9E7E2/#161514 | 14.9:1 | AAA |
| text-secondary on bg (dark) #A6A29B/#161514 | 7.1:1 | AA |
| accent on bg (dark) #93A8F0/#161514 | 8.0:1 | AAA |
| border on bg (both modes) | ≥1.3:1 | decorative (inputs get 17.7's 3:1 focus/active border via accent) |

Ratios are computed from the hex values above with the WCAG formula (rounded to 0.1); PART 25 includes an automated token-contrast test so a future token edit cannot silently break AA.

## 18.2 Typography

**Decision:** System sans stack for all UI and body text; one self-hosted serif, **Source Serif 4 SemiBold (600), latin subset, single weight, ~35 KB woff2**, used only for h1/h2 page titles and the wordmark. Weights 400 and 600 only, everywhere.

- Sans stack: `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` — zero bytes, native rendering on average Argentine phones (§28).
- Serif rationale: the editorial character (D8) needs one distinguishing typographic gesture; a heading-only single-weight subset costs ~35 KB once, cached forever, under D6's 100 KB cap. If the file is dropped in some future redesign, the fallback (`Georgia, serif`) keeps the layout intact.
- No italic faces loaded; emphasis = weight 600. No 500/700 anywhere (two weights render consistently across the system stack; three don't).

Type scale (rem values at 16px root; px shown for spec-reading):

| Token | Size / line-height | Weight | Use |
|---|---|---|---|
| `--text-xs` | 11px / 14px | 600 | bottom-bar labels, badge numerals only |
| `--text-s` | 13px / 18px | 400 | meta lines, helpers, footer, section labels (600) |
| `--text-m` | 14px / 20px | 400 | action bars, secondary UI, table cells |
| `--text-base` | 16px / 26px | 400 | body text, inputs (16px prevents iOS zoom-on-focus) |
| `--text-l` | 18px / 28px | 600 | section headings (h3), dialog titles |
| `--text-xl` | 22px / 30px | 600 | post titles on post page, h2 |
| `--text-2xl` | 28px / 36px | 600, serif | page h1 (materia name, carrera name) |

Body line-height 1.625 (26/16). Max measure enforced by the 680px column. Links: accent color, no underline at rest **within chrome**; underline on hover and always-underlined inside post/comment bodies (user-content links must not depend on color alone — 17.7).

## 18.3 Spacing, radius, borders, shadows

- **Spacing scale** (4px base): 4 / 8 / 12 / 16 / 24 / 32 / 48. Tokens `--space-1..-7`. Off-scale values banned (anti-checklist 13 analog; Tailwind theme exposes only these). Standard applications: row vertical padding 12, page side padding 16 (mobile) / 24 (desktop), rail gap 32, section gaps 24, form-field stack 16.
- **Radius**: `--radius-input: 2px` (inputs, buttons, chips, checkboxes), `--radius-container: 4px` (dialogs, menus, toasts, images). Nothing else; no pills (§5), no circles except nothing — MVP has no avatars (D2).
- **Borders**: 1px solid `--color-border` for all separators and control outlines. Active/focused inputs switch border to `--color-accent` (1px; the focus ring supplies the 2px affordance). No 2px decorative borders except the 2px active-tab underline in accent.
- **Shadows**: exactly one token, `--shadow-overlay: 0 4px 16px rgb(28 27 26 / 0.12)` (dark mode: `0 4px 16px rgb(0 0 0 / 0.5)`), applied only to menus, dialogs, and toasts — elements literally above the page. Everything in the page plane is flat (anti-checklist 4).

## 18.4 Component inventory

**Decision:** 16 components, listed exhaustively; building a screen means composing these. A new component requires a decision-log entry (D14 rule 8 spirit). States are described textually — this is the implementation spec; no separate Figma source of truth exists (one developer, D6).

| # | Component | Spec + states |
|---|---|---|
| 1 | **Botón primario** | Filled `--color-accent`, text `--color-on-accent`, 600/14px, padding 8×16, radius 2px, height 36px (44px touch on mobile). Hover: `--color-accent-hover`. Focus: ring 17.7. Active: hover color + no transform (no press-scale). Disabled: 40% opacity, `cursor: not-allowed`. Loading: label swaps to progress text ("Publicando…"), width locked. Max one per view section |
| 2 | **Botón secundario** | Transparent, 1px `--color-border`, text `--color-text-primary`. Hover: border `--color-text-secondary`, bg `--color-surface-raised`. Same focus/disabled pattern |
| 3 | **Botón terciario** | Text-only in `--color-accent`, padding 8×8. Hover: underline. Danger variant: `--color-danger` text ("Eliminá") |
| 4 | **Input** | 1px border, radius 2px, height 36px, padding 8×12, 16px text, bg `--color-surface`. Label above, 13px/600. Focus: accent border + ring. Error: `--color-danger` border + 13px danger message below via `aria-describedby`. Disabled: raised bg, secondary text |
| 5 | **Textarea** | Input rules; min-height 3 rows, auto-grow to 12 rows then inner scroll. Counter (13px secondary, right-aligned) only near limit (17.4.3) |
| 6 | **Select nativo** | Native `<select>` styled to input metrics + chevron-down icon; native picker UI untouched (mobile OS pickers beat any custom dropdown for a11y and weight). Searchable materia selector is the one exception: input + filtered listbox (Radix), same visual metrics |
| 7 | **Checkbox** | Native input visually replaced: 16px box, 1px border, radius 2px; checked = accent fill + white check icon. Focus ring on box. Label always clickable; helper text pattern per 17.4.3 |
| 8 | **Chip de materia** | Inline text chip, 13px, padding 2×8, radius 2px, bg `--color-accent-subtle`, text `--color-accent`. Hover (when link): bg deepens one step. Removable variant (composer) appends an x icon with `aria-label="Quitar materia"`. Neutral variant (tipo de recurso, "Pregunta"): raised bg + secondary text |
| 9 | **Fila de lista** | The workhorse (posts, avisos, search results, materias): full-bleed row, 12px vertical padding, hairline bottom border, no radius/shadow. Hover (desktop): `--color-surface-raised` bg. Whole-row link with inner interactive stops (comments link) as sibling links — nested-anchor-free markup |
| 10 | **Fila de recurso** | Fila de lista + the 17.4.5 two-line layout (explicitly a dense row, not a card — §47) |
| 11 | **Tabs** | Text row, 14px/600; inactive = secondary color; active = primary color + 2px accent underline; hover = primary color. Keyboard: arrow keys move, Enter activates (Radix). URL-addressable always |
| 12 | **Badge de avisos** | Numeric counter on bell/tab: 11px/600, `--color-accent` bg, `--color-on-accent` text, radius 2px (square badge — a deliberate signature vs. the universal pill), min-width 16px, "9+" cap |
| 13 | **Diálogo** | Centered, max-width 400px, radius 4px, `--shadow-overlay`, scrim `--color-overlay`; title 18px/600, body 16px, actions right-aligned (primary rightmost). Mobile: bottom-sheet position (still radius 4, top corners). Focus trapped; Esc closes (except type-to-confirm dialogs) |
| 14 | **Menú** | Trigger-anchored, min-width 180px, radius 4px, shadow, 8px padding; items 14px, 36px tall, hover raised bg; destructive items in danger text. Radix DropdownMenu |
| 15 | **Toast** | Bottom center (desktop bottom-left), max-width 360px, radius 4px, shadow, surface-raised bg, 14px text, optional single action ("Deshacer"). Auto-dismiss 5s; pauses on hover/focus; `role="status"`. Max 1 visible; queue |
| 16 | **Tabla mod** | Utilitarian `<table>`: 13px cells, 8×12 padding, hairline row borders, sticky header row, raised-bg header, horizontal scroll in container below 1024px. Sortable columns = header buttons with `aria-sort` |

## 18.5 Icon policy

**Decision:** Lucide only (D6-adjacent: tree-shaken, ISC-licensed, stroke style fits hairline aesthetic), rendered 16px inline / 18px in nav bars, `stroke-width: 2`, `currentColor`, every icon accompanied by a visible label or `aria-label` (anti-checklist 15). The subset is closed — 15 icons; additions require editing this list:

| Icon (Lucide name) | Use |
|---|---|
| `home` | bottom bar Inicio |
| `book-open` | bottom bar Materias |
| `plus` | bottom bar Publicar |
| `search` | Buscar (header + bottom bar) |
| `bell` | Avisos |
| `arrow-up` | vote control |
| `message-circle` | comment count/action |
| `link` | Compartir (copies URL — the honest icon for what it does) |
| `flag` | Reportar |
| `more-horizontal` | overflow menus |
| `x` | close dialog, remove chip |
| `chevron-down` | select affordance, collapsed facts toggle |
| `check` | checkbox mark, "Siguiendo" state |
| `download` | resource download button |
| `file-text` | resource file rows |

No icon fonts (layout shift, a11y); inline SVG via `lucide-react` per-icon imports.

## 18.6 Wordmark

**Decision:** The wordmark is live text, not an image: lowercase "uca.net" set in the Source Serif 4 SemiBold (600) at 18px in chrome, `letter-spacing: -0.01em`, color `--color-text-primary`, with the "." dot in `--color-accent` — one ballpoint-blue period as the entire brand gesture.

Name-portability (D10, binding): the string comes from a single config constant (`SITE_NAME`); the wordmark component renders `{name-before-dot}`+accent-dot+`{tld}` generically, so a rename to any `word.tld` (or a dotless name — component then renders plain text, accent dot suffixed as a full stop) is a config change plus zero asset work. No logo files exist in MVP except the favicon (a 2px-radius accent square with the paper-colored initial letter, generated from the same constant) and OG-image template (PART 23). The wordmark never appears inside durable user content (no PDF watermarks — D10).

## 18.7 Dark mode implementation

Covered by the token table in 18.1; mechanics: `:root` holds light values; `[data-theme="dark"]` overrides; `@media (prefers-color-scheme: dark)` applies dark values under `:root:not([data-theme="light"])`. The theme cookie (`theme=auto|claro|oscuro`) is read server-side to stamp `data-theme` in the SSR HTML — no flash-of-wrong-theme, no theme JS on the critical path. Images/PDF thumbnails are not filtered or inverted; user content renders as-is on both surfaces.

## 18.8 CSS implementation — variables + Tailwind v4 `@theme`

**Decision:** Tokens live as CSS custom properties in one file (`app/tokens.css`); Tailwind v4's `@theme` maps utilities onto those variables, so the same tokens serve Tailwind classes, the few hand-written CSS rules, and any future non-Tailwind rewrite (10-year portability: the design system survives the framework, D8/brief §58). Ready to paste:

```css
/* app/tokens.css — the design system. Edit only via PR + PART 18 update. */
:root {
  /* color: light */
  --color-bg: #FAFAF7;
  --color-surface: #FAFAF7;
  --color-surface-raised: #F3F2EE;
  --color-border: #E7E5E0;
  --color-text-primary: #1C1B1A;
  --color-text-secondary: #57534E;
  --color-accent: #2440B3;
  --color-accent-hover: #1B3190;
  --color-accent-subtle: #EEF1FA;
  --color-on-accent: #FAFAF7;
  --color-danger: #A8231D;
  --color-success: #166534;
  --color-overlay: rgb(28 27 26 / 0.4);
  --shadow-overlay: 0 4px 16px rgb(28 27 26 / 0.12);

  /* type */
  --font-sans: system-ui, -apple-system, "Segoe UI", Roboto,
               "Helvetica Neue", Arial, sans-serif;
  --font-serif: "Source Serif 4", Georgia, serif;
  --text-xs: 0.6875rem;   --leading-xs: 0.875rem;
  --text-s: 0.8125rem;    --leading-s: 1.125rem;
  --text-m: 0.875rem;     --leading-m: 1.25rem;
  --text-base: 1rem;      --leading-base: 1.625rem;
  --text-l: 1.125rem;     --leading-l: 1.75rem;
  --text-xl: 1.375rem;    --leading-xl: 1.875rem;
  --text-2xl: 1.75rem;    --leading-2xl: 2.25rem;

  /* space / radius */
  --space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px;
  --space-5: 24px; --space-6: 32px; --space-7: 48px;
  --radius-input: 2px;
  --radius-container: 4px;
}

[data-theme="dark"] {
  --color-bg: #161514;
  --color-surface: #161514;
  --color-surface-raised: #201F1D;
  --color-border: #2E2C29;
  --color-text-primary: #E9E7E2;
  --color-text-secondary: #A6A29B;
  --color-accent: #93A8F0;
  --color-accent-hover: #B3C2F5;
  --color-accent-subtle: #23293F;
  --color-on-accent: #161514;
  --color-danger: #E8837B;
  --color-success: #7CC492;
  --color-overlay: rgb(0 0 0 / 0.6);
  --shadow-overlay: 0 4px 16px rgb(0 0 0 / 0.5);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --color-bg: #161514;
    --color-surface: #161514;
    --color-surface-raised: #201F1D;
    --color-border: #2E2C29;
    --color-text-primary: #E9E7E2;
    --color-text-secondary: #A6A29B;
    --color-accent: #93A8F0;
    --color-accent-hover: #B3C2F5;
    --color-accent-subtle: #23293F;
    --color-on-accent: #161514;
    --color-danger: #E8837B;
    --color-success: #7CC492;
    --color-overlay: rgb(0 0 0 / 0.6);
    --shadow-overlay: 0 4px 16px rgb(0 0 0 / 0.5);
  }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

```css
/* app/globals.css — Tailwind v4 mapping */
@import "tailwindcss";
@import "./tokens.css";

@theme inline {
  --color-bg: var(--color-bg);
  --color-surface: var(--color-surface);
  --color-surface-raised: var(--color-surface-raised);
  --color-border: var(--color-border);
  --color-text-primary: var(--color-text-primary);
  --color-text-secondary: var(--color-text-secondary);
  --color-accent: var(--color-accent);
  --color-accent-hover: var(--color-accent-hover);
  --color-accent-subtle: var(--color-accent-subtle);
  --color-on-accent: var(--color-on-accent);
  --color-danger: var(--color-danger);
  --color-success: var(--color-success);
  --font-sans: var(--font-sans);
  --font-serif: var(--font-serif);
  --radius-input: var(--radius-input);
  --radius-container: var(--radius-container);
  --spacing: 4px; /* Tailwind spacing utilities snap to the 4px base */
}
```

Usage rule (D14-adjacent): components use Tailwind utilities generated from these tokens (`bg-surface`, `text-text-secondary`, `border-border`, `rounded-input`); arbitrary values (`text-[17px]`, `bg-[#fff]`) fail lint (anti-checklist 13–14). The `@theme inline` block is the only Tailwind theme configuration — no `tailwind.config` color/size extensions, keeping tokens.css the single authority.

DISSENT — none.
