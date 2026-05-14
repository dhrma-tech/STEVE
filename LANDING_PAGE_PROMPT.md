# Cofounder Landing Page — Design & Build Prompt

> Hand this brief to Claude (or a senior designer/engineer) and they should be able to build the page without seeing the rest of the codebase. Every visual, behavioral, content, and integration decision is enumerated. Where something is intentionally flexible, it is marked `// designer's call`.

---

## A. ROLE & DELIVERABLE

You are a Staff-level frontend designer/engineer. Build **the public landing page at `/`** for Cofounder — an AI company operating system. The page is the single most important conversion surface: a visitor must understand the product, trust it, and click "Run a company" within 8 seconds of arrival.

Deliver:
1. One React server component for the page (`src/app/(marketing)/page.tsx`).
2. Subordinate components in `src/components/marketing/*` (use what's already there; add new ones only if absolutely needed).
3. Tokens via CSS custom properties in `src/styles/tokens.css` and motion keyframes in `src/styles/motion.css`. **Do not introduce a CSS framework other than Tailwind 4 + the existing tokens.**

Stack: Next 16 (App Router, Turbopack), React 19, Tailwind 4, Framer Motion, lucide-react icons. Radix UI for nav dropdowns. Pixel art is **CSS-only** (gradients + box-shadows + `[image-rendering:pixelated]`) — no licensed imagery.

---

## B. PRODUCT CONTEXT (so the prompt stands alone)

**What Cofounder is:** A managed company operating system. The founder describes an idea; the platform spins up GitHub repo, Vercel deployments, Supabase database, Stripe billing on their behalf. Eight AI-staffed departments (Engineering, Marketing, Sales, Design, Support, Operations, Finance, Legal) orbit a central "Cofounder" agent. A roadmap/tech-tree walks the user from idea → launch → scale with dependency-gated milestones. Human-in-the-loop approvals gate dangerous actions.

**Who it's for:** Solo founders and small teams (pre-product through early revenue), technical or non-technical. The pitch is "replace eight specialized hires with orchestrated agents you direct."

**Tone:** Confident, calm, slightly nostalgic (pixel art = craftsmanship), never hype-y. The product is serious; the brand is warm. Think "indie studio meets enterprise tool." Reference moods: Stardew Valley + Linear + Vercel marketing.

**What we do NOT do:**
- ❌ Copy Cofounder.co's specific pixel scenes, wordmark, or "Neoris" / "Departure Mono" licensed fonts.
- ❌ Ship dev-y copy: "source notes", "sandbox fallback", "shell", "[ASSUMPTION:]", "managed sandbox" — all banned.
- ❌ Use `<img>` tags. All decorative art is CSS gradients and box-shadows.
- ❌ Add new fonts or icon sets. Use the existing stack.

---

## C. INFORMATION ARCHITECTURE

The page is a single vertical scroll. Section order, top to bottom:

1. **Sticky marketing nav** (global, ~91px tall, transparent → opaque on scroll)
2. **Hero** (full-bleed, ~914px tall, pixel-art scene + headline + 2 CTAs + glass notification wheel)
3. **Stats strip** (4 stat cards in a row, ~16px gap, ~96px tall each)
4. **Product preview / orbit** (large card showing the canvas metaphor)
5. **Value props** (3 columns, "Agentic departments / Human in the loop / Fully extensible")
6. **Chapters** (4 cards in a 2×2 grid: Start / Build / Sell / Scale)
7. **Roadmap preview** (2-column split: section header on left, animated task list on right)
8. **Demos** (3 stacked feature panels: engineering, sales/marketing, scale/analytics)
9. **Tool carousel** (infinite-scroll strip of integrations on a blue background)
10. **Industries wordsearch** (5-column grid of company-type pills with stroke animations)
11. **Footer CTA** (large centered card: headline + dual CTAs)
12. **Marketing footer** (link grid + holographic tilt card + bottom credits)

**Above-the-fold target:** hero headline, subhead, primary CTA, and at least 1 floating notification badge must be visible at 1440×900 viewport without scrolling.

**Skip-to-content:** an invisible-until-focused link that jumps to `#main` (first section after nav).

---

## D. DESIGN SYSTEM (use exactly these tokens — they already exist)

### Colors

```css
/* Light (marketing surface) */
--background:            #f5f5f2;  /* warm off-white, NOT pure white */
--foreground:            #171717;
--color-surface-raised:  #fbfbf8;  /* card bg */
--color-ink-strong:      #262323d9;
--color-ink-muted:       #262323b3;
--color-ink-faint:       #26232380;
--color-border-card:     #dee2de;  /* 0.8px subtle */
--color-border-pill:     #e3e3e0;
--color-feature-success: #34a853;
--hero-blue:             #1a6fd1;  /* hero/tool-carousel accent */
--feature-blue-bg:       #f7fbff;  /* feature callout bg */
--feature-blue-border:   #d7e8ff;

/* Brand (used sparingly — focus rings, hover states) */
--brand-500: #6229ff;
--brand-400: #7a52ff;
--brand-300: #9d8aff;   /* focus ring */
```

### Typography stack (already loaded in `src/app/layout.tsx`)

```
--font-sans:  Plus Jakarta Sans → Inter → system-ui  // primary
--font-app:   Figtree → Plus Jakarta Sans            // workspace, not landing
--font-mono:  IBM Plex Mono → ui-monospace           // labels, eyebrow text
--font-pixel: Pixelify Sans → IBM Plex Mono          // accents only
```

**Type scale (landing-specific):**

| Use | Family | Size | Weight | Line | Tracking | Color |
|---|---|---|---|---|---|---|
| Hero H1 | sans | clamp(34px, 4vw, 46px) | 400 | 1.08 | 0 | `#fff` over hero, with gradient text option |
| Hero subhead `<p>` | sans | 16px | 460 (variable) | 1.4 | 0.15px | `rgba(255,255,255,0.82)` |
| Section H2 | sans | 40px (32px @ ≤767px) | 400 | 1.15 | 0 | `var(--foreground)` |
| Section H2 (inverted, on blue) | sans | 40px | 400 | 1.15 | 0 | `#ffffff` |
| Section H3 | sans | 20px | 530 | 1.4 | -0.4px | `var(--color-ink-strong)` |
| Body | sans | 15px | 460 | 1.6 | 0.15px | `var(--color-ink-muted)` |
| Mono label / eyebrow | mono | 12px | 500 | 1.0 | 0.08em uppercase | `var(--color-ink-faint)` |
| Nav link | sans | 15px | 410 | 1.5 | 0.15px | `rgba(32,32,32,0.8)` |
| Button | sans | 16px | 400 | 1.0 | 0 | per-variant |

### Spacing

- Base unit: `0.25rem` (4px) — token `--spacing`.
- Section vertical padding: 64–96px (`py-16 lg:py-24`).
- Section max-width: 1100px content, 1440px hero (with full-bleed background).
- Card padding: 16–24px.
- Gap between sections: zero (sections own their own padding).

### Radii

`--radius-md: 6px`, `--radius-lg: 8px` (buttons), `--radius-xl: 12px`, `--radius-2xl: 16px` (cards), `--radius-3xl: 24px` (hero panels). Use **8px for buttons and pills**, 16px for cards. 0.8px borders, never 1px.

### Shadows (3 levels)

```
shadow-sm:    rgba(0,0,0,0.06) 0 2px 3px,
              rgba(255,255,255,0.35) 0 0 0.357px 1.5px inset,
              rgb(255,255,255) 0 2px 0 inset    /* light button */
shadow-card:  rgba(255,255,255,0.35) 0 0 0.357px 1.5px inset,
              rgb(255,255,255) 0 2px 0 inset,
              rgba(0,0,0,0.25) 0 0 2px,
              rgba(232,231,230,0.32) 0 0 0 4px /* pricing card outer ring */
shadow-cta-dark: rgba(64,64,64,0.12) 0 0 0 1px,
                 rgba(255,255,255,0.24) 0 2px 0 inset,
                 rgba(0,0,0,0.25) 0 -0.5px 2px inset,
                 rgba(0,0,0,0.16) 0 3px 4px
```

### Buttons (`src/components/ui/button.tsx`)

Three variants matter on the landing:

- `light` — cream pill, dark text, soft inset shadow. **This is the hero primary** and the nav CTA.
- `dark` — gradient-on-transparent dark pill, white text, layered shadow. Used in the footer CTA and demo cards on dark backgrounds.
- `ghost` — transparent with on-hover pill background. Used for the hero secondary "Check out the launch" with `border-white/30 bg-white/10` overrides when over the hero pixel art.

Sizes: `md` (41px tall, default) for hero/nav, `sm` (30px) inline, `lg` (46px) for the footer CTA.

---

## E. SECTION-BY-SECTION SPEC

> Component file paths reference the existing codebase; assume they are reusable.

### E1. Marketing Nav `<MarketingNav signedIn workspaceHref />`

- Fixed, full-width, `height: 90.8px`, `z-index: 201`.
- Background: transparent on load; on scroll (`window.scrollY > 12`) fades to `var(--background)` with `border-bottom: 0.8px solid #e8e7e6`.
- Layout: 3-column flex — logo (left), pill-encased nav (center), CTAs (right).
- Logo: text-only wordmark "Cofounder", 18px medium. No graphical mark.
- Center nav (`hidden lg:flex`): "How to" dropdown (Radix) → opens on `pointerEnter` and `click`, lists Start/Build/Sell/Scale → then `|` divider → those same 4 items inline (yes, redundant on purpose; matches reference) → `|` → Resources → `|` → Pricing.
- Active link state: dark pill (`bg-[var(--foreground)] text-white`), 22.5px line-height.
- Right cluster: "Log in" text link + `light` button.
- **Session-aware (see §J1)**: when `signedIn === true`, the "Log in" label becomes "Open workspace" and both right-cluster links use `workspaceHref` instead of `/login`. The "Run a company" CTA label becomes "Go to workspace".
- Mobile (`<lg`): hamburger → full-viewport `Dialog` with stagger-in links (`@keyframes mm-link-in 260ms ease-out`), bg-in animation (`@keyframes mm-bg-in 220ms ease-out`), footer-in animation.
- Active route detection: `usePathname()` → exact match or `pathname.startsWith(href)` for nested routes.

### E2. Hero `<section id="main">`

**Structure:**
```
<section relative min-h-[914px] overflow-hidden>
  <HeroPixelScene />                            ← absolute, full bleed
  <div absolute inset-0 darkening-gradient />   ← left-to-right black gradient 34% → 0% so text is legible
  <div absolute inset-x-0 top-0 max-w-[1440px] mx-auto px-5 pt-[max(15dvh,92px)] grid gap-8 text-white>
    <div max-w-[580px] grid gap-5>
      <h1 stagger-delay-100 />                  ← "Run an entire company with agents."
      <p stagger-delay-500 />                   ← 56ch max, white/82
      <div stagger-delay-900 flex gap-3>
        <Link href={primaryHref} variant="light" />   ← primary CTA
        <Link href="/resources/introducing-cofounder-2" variant="ghost" glass-overlay />
      </div>
    </div>
    <NotificationWheel ml-auto hidden lg:block />  ← right side, glass pills
  </div>
</section>
```

**HeroPixelScene** (CSS-only, in `src/components/marketing/pixel-art.tsx`):
- Background: vertical gradient `#72b9ff → #a7d7ff → #fff3c9 → #c2e88f` (sky to grass).
- Floating clouds: `bg-white/45` with multi-stop `box-shadow` simulating extra cloud puffs at offsets like `140px 30px 0 12px rgba(255,255,255,0.35), 320px -10px 0 8px ...`. Animate with `@keyframes logo-slide 22s linear infinite` (translate clouds horizontally).
- Tower (right side, hidden on mobile): 320×320 rounded rect with gradient face (#d9f7ff → #85bfe2 → #55768d) and a 10px green border, dropped via `box-shadow: 0 28px 0 #315946` to mimic ground-shadow.
- Antenna: thin tall vertical bar with extra rectangles via box-shadow.
- "Lights" grid: 15 small `#f8ffbe` squares with glow (`box-shadow: 0 0 16px rgba(248,255,190,0.75)`).
- Grass strip at bottom (`<GrassStrip />`): layered green gradient sliced into pixel-sharp bands using percentage stops, `[image-rendering:pixelated]`.

**Notification wheel** (right side, lg+ only):
- 240px wide pill stack (276px @ ≥992px), `position: absolute` inside a container that itself is absolute.
- Glass pill style: `backdrop-filter: blur(16px)`, `bg-linear-gradient(rgba(255,255,255,0.16) → rgba(255,255,255,0.08))`, `box-shadow: rgba(0,0,0,0.12) 0 -1px 0 inset, rgba(0,0,0,0.1) 0 -1px 2px inset, rgba(255,255,255,0.24) 0 1px 1px inset`, `border-radius: 8px`.
- Each pill has: status dot, task title, detail line, status label.
- 4 hardcoded notifications (`heroNotifications` in `src/data/marketing-content.ts`); rotate one in every ~3.2s.
- Entry: `@keyframes notif-wheel-in` (translateY 34→0, scale 0.98→1, blur 6→0, 0.52s `cubic-bezier(0.23,1,0.32,1)` delay 0.18s).
- Exit: mirror entry going up.
- Pause animation when `prefers-reduced-motion: reduce`.

**Hero stagger:** three children with class `.hero-stagger`, animation `hero-enter 0.6s cubic-bezier(0.23,1,0.32,1) forwards`, delays `100ms` / `500ms` / `900ms`. Keyframe only sets `{ 100% { opacity: 1; transform: none; } }`; initial opacity is `0`.

**CTA hrefs (session-aware, see §J1):**
- Primary: `signedIn ? workspaceHref : "/login"`, label `signedIn ? "Go to workspace" : "Run a company"`.
- Secondary: always `/resources/introducing-cofounder-2`, label "Check out the launch" with Play icon.

### E3. Stats strip `<StatsSection />`

- 4 cards in a `md:grid-cols-4` row.
- Each card: icon (lucide, `text-[var(--hero-blue)]`), large number (3xl, weight 400), label (sm, muted).
- Static content for now; see §J4 for live-stat hook.

### E4. Product preview `<ProductPreviewSection />`

- Wraps `<OrbitPreview />` — a CSS-only mini-mockup of the canvas:
  - 8 department dots arranged in a circle around a central "Cofounder" hub.
  - Dashed orbit lines (SVG or repeating gradient).
  - Hover or auto-cycle highlights one department at a time.
- Above the orbit: eyebrow label "Platform preview", H2 "A company map that can actually do the work.", supporting body copy.

### E5. Value props `<ValuePropsSection />`

- 3 columns, `md:grid-cols-3`.
- Each uses `<FeatureCallout>`: pale blue background (`var(--feature-blue-bg)`) with 0.8px blue border, 16px radius. Bold prefix label + body description + icon top-right.
- Content (already in `src/data/marketing-content.ts → valueProps`):
  1. "Agentic departments" — Building2 icon.
  2. "Human in the loop" — Eye/Shield-ish icon.
  3. "Fully extensible" — Workflow icon.

### E6. Chapters `<ChaptersSection />` → `<ChapterGrid />`

- 4 cards in a `lg:grid-cols-2` grid (2×2). Mobile: single column.
- Each card: `<ChapterCard chapter>`:
  - Pixel-art header (~180px tall) — `<ChapterArt tone="green|blue|pink|gold">` — gradient + decorative box-shadows.
  - Chapter label pill ("Chapter I" through IV) in IBM Plex Mono, 12px, 500 weight, on `var(--color-surface-raised)` with thin border.
  - Title (H3), description (body).
  - Bottom link: "Read this chapter (I)" in IBM Plex Mono.
- Card style: `bg-[var(--color-surface-raised)]`, `border-0.8px var(--color-border-card)`, `rounded-2xl`, `p-4`. Soft hover lift: `translate-y-[-2px]` over 200ms.

### E7. Roadmap preview `<RoadmapPreviewSection />`

- 2-column layout, `lg:grid-cols-[0.8fr_1.2fr]`.
- Left column: eyebrow + H2 + body (matches §E4 style).
- Right column: stack of 3 task cards (`<Card variant="app">`) on a darker app surface, showing roadmap items.
- Each card: stage badge (success/running/neutral pill), type label (mono), task name (H3), status text.
- Use `roadmapPreview` from `src/data/marketing-content.ts`.

### E8. Demos `<DemoSections />`

- Stack of 2–3 `<Card>` panels, `lg:grid-cols-[0.75fr_1.25fr]`.
- Left side: brand badge + H2 + body.
- Right side: app-canvas-styled mock (`bg-[var(--app-canvas)]`, `text-[var(--app-text)]`). Inside:
  - Mono "agent workspace" header bar with department icon.
  - 3–4 row entries with mock task names and `<StatusBadge>` chips (`completed | running | ready_to_review`).
- `demos` array in marketing-content provides title, eyebrow, description, bullets, icon per panel.

### E9. Tool carousel `<ToolCarouselSection />`

- Full-bleed `bg-[var(--hero-blue)]`, white text.
- Strip of `[var(--toolSystems)]` cards (240px wide each, glassy `bg-white/10 backdrop-blur-md`), duplicated to enable seamless loop.
- `@keyframes build-carousel-slide` translates `-50%` over 24s linear infinite. `motion-reduce:animate-none` pauses it.
- Each card: integration icon, label, detail line, status badge (Ready / Setup / Coming Soon).

### E10. Industries wordsearch `<IndustryWordsearchSection />`

- 5-col grid of pill cells, each rendering a company-type term in mono.
- Each cell: subtle alternating animation `wordsearch-stroke-cw 12s linear infinite` or `-ccw`, animating an SVG stroke around the pill via `stroke-dashoffset` (or simulate with CSS).
- Optional: hover lifts the cell color from `--color-ink-muted` to `--color-ink-strong` with a 200ms transition.

### E11. Footer CTA `<FooterCtaSection />`

- Centered card, `rounded-2xl`, `bg-[var(--color-surface-raised)]`, `border-0.8px var(--color-border-card)`, `p-8`, `text-center`.
- Eyebrow ("Ready to start") → H2 (16ch max, "Run your first company loop today.") → supporting body → button row.
- Primary button: `dark` variant, label = primaryCtaLabel (same as hero, session-aware).
- Secondary: text link "Read the launch post →" to `/resources/introducing-cofounder-2`.

### E12. Marketing footer `<MarketingFooter />`

- 2-col split: text + CTA stack on the left, `<FooterPixelCard />` on the right.
- Pixel card: 220px tall, layered gradients (warm cream → light blue → lime green), with embedded "SOC 2 compliant security" mini-pill in a frosted glass box at top-right.
- Below: full-width strip with link grid (Privacy/Terms/Docs/Resources/Pricing) on the left, credit text on the right ("SOC 2 compliant security / Original design system / © 2026 Cofounder").
- Holographic tilt card option: use CSS custom properties `--hover-tilt-x`, `--hover-tilt-y` updated via a tiny `pointermove` listener for a subtle 3D rotation on the pixel card.

---

## F. MOTION SYSTEM (existing `src/styles/motion.css`)

| Animation | Where | Duration | Easing | Notes |
|---|---|---|---|---|
| `hero-enter` | Hero H1/sub/CTAs | 0.6s | `cubic-bezier(0.23,1,0.32,1)` | Stagger via per-element `animation-delay` |
| `float-btn-spring` | Hero CTA cluster | 760ms | spring keyframe (0 → 100px → -20px → 0) | One-shot on mount |
| `notif-wheel-in/out` | Hero badges | 0.52s | `cubic-bezier(0.23,1,0.32,1)` delay 0.18s | Wheel rotates every ~3.2s |
| `notif-pop` | Pill spring entry | 0.52s | `cubic-bezier(0.34,1.56,0.64,1)` | overshoot |
| `task-row-in` | Demo task rows | 0.42s | `cubic-bezier(0.22,0.61,0.36,1)` | blur(3px)→0 + Y 8→0 |
| `build-carousel-slide` | Tool strip | 24s | linear infinite | translate -50% (two copies seamless) |
| `wordsearch-stroke-cw/ccw` | Industry pills | 12s | linear infinite | `stroke-dashoffset` |
| `scroll-arrow` | Optional hint below hero | 1.5s | ease-in-out infinite | Y -3px ↔ 3px, low opacity |
| `mm-bg-in / mm-link-in / mm-footer-in` | Mobile menu | 220–260ms | ease-out | Clip-path radial expand + opacity |

**Reduced motion:**
- `@media (prefers-reduced-motion: reduce)` MUST disable: notification wheel rotation, tool carousel slide, wordsearch stroke, cloud drift, scroll arrow.
- Stagger animations keep their `opacity` transition but drop transforms.
- Add `motion-reduce:animate-none` to every infinite animation.

---

## G. RESPONSIVE BEHAVIOR

Breakpoints (Tailwind 4 defaults): `sm:640`, `md:768`, `lg:1024`, `xl:1280`, `2xl:1536`. Plus a few custom: `max-[900px]:text-[38px]`, `max-[500px]:text-[34px]` for hero scaling.

| Section | Mobile (<lg) | Desktop (≥lg) |
|---|---|---|
| Nav | Logo + hamburger only; opens fullscreen menu | Full 3-col layout |
| Hero | Notification wheel hidden; text top-padding `166px`; tower/clouds/lights hidden | Full scene visible |
| Stats | 1 col | 4 cols |
| Value props | 1 col | 3 cols |
| Chapters | 1 col | 2×2 grid |
| Roadmap | Stacked (header above tasks) | 2-col 0.8fr / 1.2fr |
| Demos | Stacked (text above mock) | 0.75fr / 1.25fr |
| Tool carousel | Same — infinite scroll works at any width | — |
| Wordsearch | 2 cols | 5 cols |
| Footer CTA | Full width | Same |
| Footer | Stacked | 2-col |

**Touch targets:** every interactive element ≥44×44 logical px. The nav pill items have `py-2` to ensure this on mobile.

---

## H. ACCESSIBILITY

- **Skip-link:** `<a href="#main" className="sr-only focus:not-sr-only ...">` as the first element of the page.
- **Headings:** H1 only in hero (one per page). Sections use H2; nested cards use H3. Never skip levels.
- **Color contrast:** all body text against its background must meet WCAG AA. The hero white-on-photo headline requires the darkening gradient (`linear-gradient(90deg, rgba(0,0,0,0.34), 52%, transparent)`) to achieve ≥4.5:1 — verify with axe before shipping.
- **Focus rings:** every focusable element gets `focus-visible:ring-2 focus-visible:ring-[var(--brand-300)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]`. Already in `buttonClassName()`.
- **ARIA:**
  - Nav: `<header>` wraps the bar.
  - Mobile menu trigger: `aria-label="Open menu"`.
  - Decorative pixel elements: `aria-hidden="true"`.
  - Notification wheel: container `aria-live="polite"`; each pill has the task title as text content.
  - Icons in buttons: `aria-hidden`.
- **Keyboard:**
  - `Esc` closes the mobile menu (Radix Dialog handles this).
  - `Tab` reaches every CTA in source order; no positive `tabindex`.
- **`prefers-reduced-motion`:** see §F.

---

## I. SEO & METADATA

```ts
// In src/app/(marketing)/page.tsx
export const metadata: Metadata = {
  title: "Cofounder — Run an entire company with agents",
  description:
    "Activate departments, build a roadmap, launch tasks, and keep humans in the loop. " +
    "The company operating system, powered by agents.",
  alternates: { canonical: "https://cofounder.example.com/" },
  openGraph: {
    title: "Cofounder — Run an entire company with agents",
    description: "...",
    type: "website",
    images: [{ url: "/og/landing.png", width: 1200, height: 630 }]
  },
  twitter: { card: "summary_large_image" }
};
```

Root layout already supplies `title.template: "%s · Cofounder"` so per-page titles compose automatically — **do not append "- Cofounder"** to the title here.

**Structured data:** inject one JSON-LD block:

```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Cofounder",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web",
  "offers": [
    { "@type": "Offer", "name": "Free Trial", "price": "0" },
    { "@type": "Offer", "name": "Pro", "price": "20", "priceCurrency": "USD" }
  ]
}
```

---

## J. BACKEND INTEGRATION CONTRACTS — "Toggles & Switches"

> This is the contract surface between the page and the rest of the system. Every dynamic decision the page makes flows through one of these.

### J1. Session resolution (server-side, runs on every render)

**Function signature** (already exists in `src/lib/auth/session.ts` + `src/lib/orgs/active.ts`):

```ts
type Session = {
  user: { id: string; preferredName: string; email: string | null; isSandbox: boolean } | null;
  organizations: Array<{ id: string; slug: string; name: string; status: string }>;
  activeOrgId: string | null;
};

async function getSession(): Promise<Session>;

async function resolveActiveOrg(userId: string): Promise<{ id: string; slug: string } | null>;
```

**Page reads:**
```ts
const session = await getSession();
const activeOrg = session.user ? await resolveActiveOrg(session.user.id) : null;
const signedIn = Boolean(session.user);
const workspaceHref =
  activeOrg ? `/org/${activeOrg.id}/canvas` :
  session.user ? "/onboarding" :
  "/login";
const primaryCtaLabel = signedIn ? "Go to workspace" : "Run a company";
const secondaryNavLabel = signedIn ? "Open workspace" : "Log in";
```

These five values thread into:
- `<MarketingNav signedIn={signedIn} workspaceHref={workspaceHref} />`
- The hero's primary button.
- The footer CTA's primary button.

**Caching:** the page should NOT be statically rendered when session is read. Mark with `export const dynamic = "force-dynamic"` OR use `cookies()` indirectly (which auto-opts out of static). Currently the page is async server component reading session, which forces dynamic rendering — that's correct.

### J2. Auth provider configuration (env vars)

| Env var | Effect on landing |
|---|---|
| `GITHUB_CLIENT_ID` | Presence enables the real OAuth path. Login page hides the preview-mode form. Sandbox login API returns 404 in production. |
| `GITHUB_CLIENT_SECRET` | Required alongside the above for OAuth to actually work; both must be set together. |
| `ENABLE_SANDBOX_LOGIN=1` | Override: forces the preview-mode form back on even when GitHub creds are present (use for staging demos). |
| `AUTH_SECRET` | HMAC secret for session cookies. Landing page does not read this directly. |

Helper:
```ts
// src/lib/auth/policy.ts
isSandboxLoginEnabled(): boolean;
isGitHubOAuthConfigured(): boolean;
```

Only `isSandboxLoginEnabled()` is consumed by the login page today. If you ever want the landing to show a "Demo mode active" banner when sandbox is on in production, use that helper.

### J3. Feature flags (env-driven; cheap, no provider yet)

Recommended additions when the page needs to be runtime-tunable without a deploy:

| Env var | Default | Effect |
|---|---|---|
| `LANDING_BANNER_TEXT` | `""` | If set, renders a sticky top banner above the nav with this text. |
| `LANDING_BANNER_HREF` | `""` | Optional href for the banner. If empty, banner is non-clickable. |
| `LANDING_HIDE_DEMOS` | `0` | If `1`, `<DemoSections />` is removed (useful during a demo refresh). |
| `LANDING_TEAM_PLAN_STATUS` | `coming_soon` | One of `coming_soon` / `available` / `hidden` — drives pricing-card surface (also consumed by `/pricing`). |
| `LANDING_LIVE_STATS` | `0` | If `1`, stats strip pulls counts from the DB instead of static `companyStats`. |

Implementation: a small `src/lib/config/landing.ts` that exports the typed flag object. Avoid scattering `process.env` reads through components.

### J4. Live stats (optional, when `LANDING_LIVE_STATS=1`)

Pluggable data source:

```ts
// src/lib/marketing/stats.ts
async function getLandingStats(): Promise<{
  companies: number;
  departments: number;       // sum of active departments across orgs
  tasksRunning: number;
  approvalsThisWeek: number;
}>;
```

Should be cached (`unstable_cache` or Next `cache` API, TTL ~60s) — landing traffic must not hit the DB on every request.

### J5. Analytics events (the page emits, an SDK ingests)

Use a thin wrapper so the analytics provider is swappable (today: stub; tomorrow: PostHog/Segment/etc.):

```ts
// src/lib/analytics/track.ts
type LandingEvent =
  | { name: "landing_view"; props: { signedIn: boolean; referrer: string | null } }
  | { name: "hero_cta_click"; props: { target: "primary" | "secondary"; signedIn: boolean } }
  | { name: "nav_cta_click"; props: { signedIn: boolean } }
  | { name: "chapter_card_click"; props: { chapter: "start" | "build" | "sell" | "scale" } }
  | { name: "footer_cta_click"; props: { signedIn: boolean } }
  | { name: "section_in_view"; props: { section: string; depthPct: number } };

function track(event: LandingEvent): void;
```

- `landing_view` fires once on mount.
- `section_in_view` uses an `IntersectionObserver` (50% threshold) per section. Debounced to avoid double-fire.
- Provide a `data-analytics-section` attribute on each `<section>` so the observer logic is generic.

UTM/referrer capture: read `document.referrer` and any `?utm_*` params on first mount; persist to `sessionStorage.landing_origin` so downstream conversion attribution works.

### J6. A/B testing hooks (when needed)

Provide a server-side variant resolver so the page can render different copy/order:

```ts
// src/lib/experiments/index.ts
async function getVariant(key: string, options: string[]): Promise<string>;
// Reads a stable bucket cookie + a hash of (userId|anonId, key) to pick a variant.
```

Test surfaces likely worth bucketing:
- Hero H1 wording.
- Primary CTA label ("Run a company" vs "Start free trial").
- Chapter order.
- Whether the notification wheel shows static or randomized content.

Render variants server-side (no flicker). Each variant should fire `experiment_assigned { key, variant }` on first view.

### J7. Content sources (start static, allow swap to CMS)

All copy currently lives in `src/data/marketing-content.ts`:
- `marketingNav`, `chapters`, `valueProps`, `roadmapPreview`, `demos`, `toolSystems`, `industryTerms`, `companyStats`, `heroNotifications`, `footerLinks`, `launchArticleSections`, `legalShellSections`, `docsSections`.

Each export is plain TypeScript data with stable shapes. If a CMS is added later (Contentlayer / Sanity / Payload), wrap reads behind:

```ts
async function getLandingContent(): Promise<LandingContent>;
```

so components depend on the function, not the literal module. **Do not migrate to a CMS now** — premature.

### J8. Image / asset pipeline

- No `<img>` tags. All decorative art is CSS.
- If `og/landing.png` is added for OpenGraph (1200×630), generate via Next's `ImageResponse` API at `/opengraph-image.tsx` so it stays in sync with the live design. **Do not hand-author the PNG.**

### J9. Performance budgets

Enforce these in CI (Lighthouse / a custom script):

| Metric | Target | Hard limit |
|---|---|---|
| LCP (Largest Contentful Paint) | <1.8s on 4G | 2.5s |
| INP (Interaction to Next Paint) | <200ms | 500ms |
| CLS (Cumulative Layout Shift) | <0.02 | 0.1 |
| Initial JS (gzipped) | <120KB | 180KB |
| Total transferred at FCP | <300KB | 500KB |
| TTFB | <300ms p95 | 800ms |

The biggest risks:
1. Framer Motion footprint — only import per-feature (`framer-motion/m`, lazy-load non-hero animations).
2. Marketing nav is client (Radix dropdown + scroll listener) — keep it tight; lazy-load Radix only inside the dropdown trigger if footprint balloons.
3. Tool carousel autoplay — ensure GPU layer (`will-change: transform`).

### J10. Error & loading states

- Session fetch can throw (DB unreachable). The page must still render the signed-out variant. Wrap `getSession()`/`resolveActiveOrg()` in `try { } catch { signedIn=false }`.
- If the new live-stats hook fails, fall back silently to the static `companyStats`.
- No skeleton on the landing — every section has deterministic content. Skeletons live in the workspace, not here.

### J11. i18n hooks (future-proof; do not implement now)

When localization happens:
- Move all visible strings to `src/data/marketing-content.{locale}.ts`.
- Resolve locale from `Accept-Language` + an `NEXT_LOCALE` cookie.
- `<html lang>` already supports the swap.
- Do not localize the wordmark "Cofounder".

---

## K. EDGE CASES & STATES

| Case | Behavior |
|---|---|
| Signed out, no cookie | Default render. Primary CTA → `/login`. |
| Signed in, onboarding complete, has org | Primary CTA → `/org/{activeOrg.id}/canvas`. Label "Go to workspace". Nav also flipped. |
| Signed in, onboarding incomplete | Primary CTA → `/onboarding`. Label stays "Go to workspace". |
| Signed in, all orgs deleted | `resolveActiveOrg` returns null → fallback to `/onboarding`. |
| Stale `lastOrgSlug` (org deleted/no membership) | `resolveActiveOrg` falls back to oldest membership; if none, `/onboarding`. |
| `LANDING_BANNER_TEXT` set | Top banner renders above nav; nav `top: 32px` instead of 0. |
| `LANDING_HIDE_DEMOS=1` | `<DemoSections />` not rendered; spacing collapses cleanly. |
| Pricing Team plan goes live | `LANDING_TEAM_PLAN_STATUS=available` removes the "Coming soon" badge wherever Team is mentioned. |
| Analytics provider down | `track()` is fire-and-forget; never throws or blocks render. |
| `prefers-reduced-motion: reduce` | All infinite + non-essential animations stop. Stagger entry keeps opacity only. |
| Hover unavailable (touch) | All `:hover` styles must have a non-hover fallback (don't gate critical affordance behind hover). |

---

## L. WHAT NOT TO DO (hard rules)

1. **Do not add `<img>` tags or external images.** Pixel art is CSS. Avatars are out of scope for the landing.
2. **Do not introduce new fonts.** Use only the 4 already loaded (Plus Jakarta Sans, Figtree, IBM Plex Mono, Pixelify Sans).
3. **Do not introduce a new UI library** (no shadcn/ui copy-paste, no Mantine, no MUI). Compose with the existing Radix + Tailwind 4 setup.
4. **Do not statically render the page.** Session must be read on every request.
5. **Do not include "[ASSUMPTION:]", "source notes", "shell", "sandbox fallback" or any developer-facing language** in user-visible copy.
6. **Do not break LCP** by putting Framer Motion on the hero H1. The hero H1 uses CSS animation (`@keyframes hero-enter`) directly. Framer Motion stays for one-off polish lower on the page.
7. **Do not block render on analytics or live stats.** Both must be fire-and-forget with static fallbacks.
8. **Do not change the existing color tokens.** Anything outside the palette in §D must be discussed first.
9. **Do not violate the title template.** Per-page titles are page-name only; the root layout appends "· Cofounder".
10. **Do not add Stripe/checkout/billing flows to the landing.** Landing → `/login` → onboarding → upgrade. The conversion happens inside the app, not here.

---

## M. ACCEPTANCE CHECKLIST

Treat these as the definition of "done":

- [ ] Hero LCP element renders within 1.5s on a throttled Fast 3G profile.
- [ ] All 12 sections present, ordered as §C.
- [ ] Lighthouse: Performance ≥95, Accessibility ≥100, Best Practices ≥95, SEO ≥100.
- [ ] Axe: zero serious violations.
- [ ] Keyboard tab order reaches every CTA, mobile menu, dropdown link.
- [ ] Reduced-motion: no infinite animations playing.
- [ ] Signed-out variant: primary CTA goes to `/login`; nav says "Log in" + "Run a company".
- [ ] Signed-in variant: primary CTA goes to `/org/{id}/canvas`; nav says "Open workspace" + "Go to workspace".
- [ ] `pnpm verify` passes (typecheck + lint, `--max-warnings=0`).
- [ ] `pnpm build` passes, page emits with `ƒ Dynamic` marker (not static).
- [ ] No `<img>` tags. No new fonts. No new dependencies added to `package.json`.
- [ ] OpenGraph image renders at `/opengraph-image` (1200×630), text within safe area.
- [ ] All copy reads like a real product, not like dev shorthand. Spot-check by skimming for: "shell", "sandbox", "source notes", "Cofounder.co-style", "[ASSUMPTION", "managed sandbox". If any of those land in a user-visible string, fail.

---

## N. HANDOFF MATERIAL TO INCLUDE WITH ANY DESIGNER PASS

When briefing a designer (Figma) before the engineer takes over:

1. The 12-section IA in §C as a wireframe outline.
2. The color palette + type scale from §D as a Figma library.
3. The motion table in §F as a Lottie/Principle reference.
4. The responsive matrix in §G as breakpoint frames (mobile 375, tablet 768, desktop 1440, wide 1920).
5. The 8-state checklist in §K as named Figma variants.
6. **Forbidden references:** do not link or pull from `cofounder.co` directly. The brief stands alone.

---

## O. ONE-LINE TL;DR FOR THE BUILDER

> Build a 12-section, session-aware, dynamically rendered landing page in Next 16 App Router. Hero is full-bleed CSS pixel art with a glass notification wheel and staggered text. All decorative art is CSS, all motion respects `prefers-reduced-motion`, all visible copy reads like a real product. Backend integration flows through `getSession()` + `resolveActiveOrg()` for personalization, a typed env-flag layer for runtime knobs, a fire-and-forget `track()` for analytics, and an optional `getLandingStats()` for live numbers. No new fonts, no new libraries, no `<img>` tags, no developer-y copy.
