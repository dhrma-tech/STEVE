# Design System

## Design Principles
- Marketing site: warm, editorial, nostalgic, precise. Pixel art carries color and emotion; layout stays calm and readable.
- App: dark, focused, spatial, mission-control style. Dense but organized, with practical controls and clear status.
- Assets: create original artwork inspired by the described patterns. Do not copy exact Cofounder imagery, wordmark, or proprietary fonts.
- Components must be reusable and registered in `REGISTRY.md` after Execution Phase 2.
- Cards are for repeated items, modals, and framed tools. Page sections are not nested card stacks.

## Source Precedence
The precision gap-fill overrides older UI notes where it gives verified corrections:
- Hero image is animated GIF/WebM style, not static.
- Hero notification pills use white translucent glass gradient, not dark green.
- Navbar CTA is light-surface, not dark.
- Nav font weight is 410 with 0.15px letter spacing.
- Departure Mono is used for large pricing numbers and estimator values.

## Marketing Tokens

### Colors
| Token | Value | Usage |
|---|---:|---|
| `--background` | `#f5f5f2` | page background |
| `--foreground` | `#171717` | primary text |
| `--color-surface` | `#f5f5f2` | base surface |
| `--color-surface-raised` | `#fbfbf8` | cards |
| `--color-surface-darker` | `#e7e7e3` | control wells |
| `--color-ink` | `#262323cc` | headings on light |
| `--color-ink-muted` | `#262323b3` | body text |
| `--color-ink-faint` | `#26232380` | captions |
| `--color-ink-strong` | `#262323d9` | active text |
| `--color-ink-strongest` | `#262323e6` | emphasis |
| `--color-ink-ui-solid` | `#202020` | dark CTA gradient base |
| `--color-border-card` | `#dee2de` | pricing/card borders |
| `--color-border-pill` | `#e3e3e0` | controls |
| `--color-feature-success` | `#34a853` | checkmark/success |
| `--color-feature-neutral` | `#bfbfbf` | disabled features |
| `--color-accent-brown` | `#a76451` | warm accent |
| `--hero-blue` | `#1a6fd1` | blue hero/tools section |
| `--feature-blue-bg` | `#f7fbff` | feature callout |
| `--feature-blue-border` | `#d7e8ff` | feature callout border |
| `--white` | `#ffffff` | hero text |

### Radius
| Token | Value |
|---|---:|
| `--radius-md` | 6px |
| `--radius-lg` | 8px |
| `--radius-xl` | 12px |
| `--radius-2xl` | 16px |
| `--radius-3xl` | 24px |

### Blur
| Token | Value |
|---|---:|
| `--blur-sm` | 8px |
| `--blur-md` | 12px |
| `--blur-lg` | 16px |

### Spacing
- Base spacing: 4px.
- Marketing container:
  - Navbar inner: max 1440px, desktop padding 26px 20px 23px.
  - Standard section: max 1100px, horizontal padding 24px.
  - Footer: max 1100px, 80px 24px 64px.
  - Hero overlay: max 1440px, horizontal padding 20px.
- Major vertical sections: 80-120px desktop; 48-72px mobile.

## App Tokens

### Colors
| Token | Value | Usage |
|---|---:|---|
| `--app-canvas` | `#1e1e23` | main canvas |
| `--app-panel` | `#25252b` | right side panel |
| `--app-surface-2` | `#29292e` | raised panels |
| `--app-deep` | `#1d1d22` | deepest background |
| `--app-black-base` | `#0e0e11` | modal/shell base |
| `--app-card` | `#050505` | deep cards |
| `--app-border` | `rgba(255,255,255,0.1)` | borders |
| `--app-input-border` | `rgba(255,255,255,0.15)` | inputs |
| `--app-text` | `#f9f9f9` | foreground |
| `--app-text-80` | `rgba(255,255,255,0.8)` | high secondary |
| `--app-text-50` | `rgba(255,255,255,0.5)` | secondary |
| `--app-text-30` | `rgba(255,255,255,0.3)` | muted |
| `--app-primary-light` | `#eeeee8e6` | light button on dark |
| `--app-workspace-glass` | `#202024a8` | translucent workspace |
| `--app-workspace-raised` | `#26262aeb` | raised workspace |
| `--brand-500` | `#6229ff` | purple-blue brand action |
| `--brand-400` | `#7a52ff` | hover |
| `--brand-300` | `#9d8aff` | soft accent |
| `--success` | `#34a853` | done |
| `--running` | `#3b82f6` | active/running |
| `--warning` | `#f59e0b` | approval |
| `--danger` | `#ef4444` | destructive |
| `--caret` | `#879e3e` | input caret |

## Typography

### Marketing Fonts
- Primary: Plus Jakarta Sans as open alternative to Neoris.
- Numeric/mono display: Departure Mono.
- Mono labels: IBM Plex Mono.
- Fallback: Inter/system sans.

### App Fonts
- Primary app: Figtree or Plus Jakarta Sans.
- Code/terminal: IBM Plex Mono or JetBrains Mono.
- Pixel decorative: Pixelify Sans where needed.

### Marketing Type Scale
| Element | Family | Size | Weight | Line Height | Letter |
|---|---|---:|---:|---:|---:|
| Hero H1 | primary | 46px desktop, 38px <=900, 34px <=500 | 400 | 108-110% | 0 |
| Page H1 | primary | 40px | 400 | 46px | 0 |
| Section H2 | primary | 40px desktop, 32px <=767, 28px default small | 400 | 115% | 0 |
| H3 | primary | 20px | 440 | 22px | -0.4px |
| Body | primary | 15px | 460 | 24px | 0.15px |
| Hero subtitle | primary | 16px | 460 | 140% | 0.15px |
| Nav links | primary | 15px | 410 | 22.5px | 0.15px |
| CTA | primary | 16px | 400 | 24px | 0 |
| Pricing number | Departure Mono | 50px | 400 | normal | 0 |
| Pricing currency | Departure Mono | 32px | 400 | normal | 0 |
| Estimator value | Departure Mono | 15px | 400 | normal | 0 |
| Chapter arrows | IBM Plex Mono | 12px | 500 | 11.6px | 0 |
| Chapter badge | IBM Plex Mono | 8px | 500 | 11.6px | 0 |

Global:
- `-webkit-font-smoothing: antialiased`.
- `font-variation-settings: "ital" 0`.
- `font-synthesis: none`.
- No viewport-width font scaling.
- Letter spacing must be zero unless a token specifies otherwise.

## Components

### Marketing Navbar
- Height: 90.8px.
- Fixed top, z-index 201.
- Transparent over hero; scrolled state uses `#f5f5f2` and bottom border `0.8px solid #e8e7e6`.
- Inner max width 1440px.
- Center links separated by pipe visuals.
- How To dropdown with Start/Build/Sell/Scale links.
- Active page uses dark filled pill.
- Mobile hamburger opens full-screen menu with clip-path animation.

### Light Surface Button
- Background `#f5f5f2`.
- Border `0.8px solid rgba(32,32,32,0.1)`.
- Radius 8px.
- Height 41px.
- Padding 0 12px.
- Text `#171717`.
- Box shadow:
  - `rgba(0,0,0,0.06) 0 2px 3px`
  - `rgba(255,255,255,0.35) 0 0 0.357px 1.5px inset`
  - `#fff 0 2px 0 inset`

### Dark CTA Button
- Transparent base with two background gradients:
  - `linear-gradient(rgba(32,32,32,0.1), rgba(32,32,32,0.1))`
  - `linear-gradient(#4f4f4f, rgba(32,32,32,0.85))`
- Border `0.8px solid #383838`.
- Radius 8px.
- Text white.
- Sizes: small 30px high; large 41px high.

### Hero
- Wrapper height about 914px including 184px bottom padding.
- Image container min height 720px, 620px on medium+.
- Animated original pixel-art GIF/WebM style; object-position right center.
- Mobile can translate image right half into view.
- Pixel grass strip at bottom: 92px high repeat-x.
- Text overlay top padding `max(15dvh, 92px)`, 166px <=500px.
- H1 max width 20ch, 580px xl.
- Stagger delays: H1 0.1s, subtitle 0.5s, CTA row 0.9s.

### Hero Notification Pill
- Width 240px; 276px >=992px.
- Height 41px; 48px >=992px.
- Backdrop blur 16px.
- Background image `linear-gradient(rgba(255,255,255,0.16), rgba(255,255,255,0.08))`.
- Transparent border.
- Radius 8px.
- Inset shadow from precision gap-fill.
- Queue/wheel animation.

### Pricing Card
- Width 350px desktop; responsive full width mobile.
- Height about 594px desktop.
- Background `#fbfbf8`.
- Border `0.8px solid #dee2de`.
- Radius 16px.
- Padding 16px 12px 32px.
- Box shadow exactly mirrors source.
- Image area 220px high, rounded 8px, overflow hidden.
- Pro card gets outer 17px ring wrapper.

### Segmented Control
- Parent background `rgba(231,231,227,0.4)`.
- Border `0.8px solid rgba(38,35,35,0.04)`.
- Radius 8px.
- Padding 4px.
- Tabs radius 6px, padding 7px 12px.
- Active tab background `#f5f5f2`.

### FAQ Accordion
- Trigger background transparent, no border.
- Padding 16px 8px.
- Max width about 740px.
- Height 68px when collapsed.
- Chevron rotates.
- Border top separators.

### Chapter Card
- Surface `#fbfbf8`.
- Border 0.8px.
- Radius 16px.
- Original pixel-art inspired cover.
- Chapter badge and mono read link.

### Feature Callout
- Background `#f7fbff`.
- Border `0.8px solid #d7e8ff`.
- Radius 16px.
- Small mono label.

### Footer Tilt Card
- Surface `rgba(251,251,248,0.8)`.
- Radius 16px.
- Holographic layers controlled by CSS variables:
  - `--hover-tilt-x`
  - `--hover-tilt-y`
  - `--hover-tilt-scale`
  - `--hover-tilt-opacity`
- Mouse movement updates 3D transform and glare.

### App Shell
- Full viewport dark background.
- Left canvas / right panel split.
- Right panel width default around 456px; responsive override on smaller screens.
- Top utility controls use icon buttons with tooltips.
- App cards radius 8-14px; avoid nested card stacks.

### Canvas Department Node
- Custom React Flow node type.
- Button body with icon and department label.
- Selected state: animated dashed blue glow.
- Active state: task/status badge.
- Locked/coming-soon state: muted, non-primary, still inspectable.

### Task Card
- Compact row with department icon, title, status dot, timestamp, hover more button.
- Status colors:
  - Running: blue.
  - Finished/ready: gray or blue indicator depending context.
  - Complete: green.
  - Approval: amber.

### Tech Tree Card
- Background `rgba(38,38,42,0.92)`.
- Border `0.8px solid rgba(255,255,255,0.15)`.
- Radius 14px.
- Min height 142px.
- Two columns: icon area about 34%, text area about 66%.
- Status badge and card type label.

### Modals
- Dark app modals over canvas.
- Trap focus.
- Close via escape where safe.
- Destructive actions require typed or explicit confirmation depending severity.

## Motion System

### Keyframes Required
- `hero-enter`: opacity to 1, transform none.
- `float-btn-spring`: translateY 100px -> -20px -> 0.
- `notif-slide` / `notif-exit`: grid row expansion/collapse.
- `notif-pop` / `notif-pop-exit`: spring scale and translate.
- `notif-wheel-in` / `notif-wheel-out`: blur and vertical movement.
- `task-row-in` / `task-row-out`.
- `testi-fade-in` / `testi-fade-out`.
- `build-carousel-slide`.
- `logo-slide`.
- `scroll-arrow`.
- `cofounder-pixel-refocus`.
- `badge-enter` / `badge-blink`.
- `orch-block-reveal`, `orch-section-fade-in`, `cofounder-msg-fade-in`, `cofounder-caret-blink`.
- `pui-fade-in`, `pui4-user-row-enter`.
- `shimmer`.
- `wordsearch-stroke-cw`, `wordsearch-stroke-ccw`.
- `mm-bg-in`, `mm-bg-out`, `mm-link-in`, `mm-footer-in`.

### Reduced Motion
- Disable infinite carousels, badge cycles, footer tilt animation, and nonessential blur movement.
- Keep state changes visible through opacity/color changes.

## Responsive Breakpoints
- Mobile: <=767px.
- Small tablet: <=991px.
- Desktop enhanced: >=992px.
- Wide hero adjustment: <=1500px.
- Very small hero text adjustment: <=500px.

Responsive behavior:
- Public pages stack sections and cards.
- Pricing cards become single column.
- How-to TOC becomes drawer/collapsible.
- App shell becomes drill-in navigation on mobile; canvas and panel do not compete in a 60/40 split.

## Asset Guidelines
- Use original generated or CSS/canvas pixel-art inspired imagery.
- Hero: high-res animated pixel landscape with a technology object.
- Chapter cards: original scenes for Start/Build/Sell/Scale.
- Pricing: seedling/single flower/field metaphors, original.
- Footer: original pixel-art card and bottom strip.
- Department covers: original themed images for Engineering, Marketing, Sales, Design, Support, Operations, Finance, Legal.

## Accessibility Rules
- Every icon button must have an accessible label and tooltip for non-obvious actions.
- Menus, dialogs, tabs, accordions, sliders, command palette, and file upload must be keyboard reachable.
- Focus must be trapped in modals and restored on close.
- Color alone must not communicate task state.
- Text must not overflow buttons/cards at any viewport.

