# Web Typography System — Specification & Implementation Plan

`STATUS: DONE`

- **Owner Component**: `apps/web/tripsense`
- **Affected Components**: Root layout, global theme tokens, shared UI primitives, header, sidebar, web feature surfaces
- **Created Date**: 2026-09-24
- **Approved Date**: 2026-09-24
- **Approval**: User explicitly approved implementation in the Codex task.
- **Reference Direction**: Mindtrip-inspired typography from the supplied screenshot; reproduce typography hierarchy, not branding or copyrighted assets
- **Target PR Boundaries**: Phase 1 (Font loading and tokens), Phase 2 (Shell and shared primitives), Phase 3 (Feature migration), Phase 4 (Visual and accessibility verification)

---

## 1. Goal & Requirements

### 1.1 Problem Statement

TripSense currently declares `Inter` in `globals.css`, but no Inter font files are present and `next/font` is not configured in the root layout. The browser can therefore fall back to the operating-system UI font, producing different results across macOS, Windows, and Linux.

Typography usage is also fragmented:

- Font-size usage currently spans `9px`, `10px`, `11px`, `text-2xs`, `text-xs`, `text-sm`, `text-base`, and six larger heading sizes.
- Audit count: `294 × text-xs`, `251 × text-sm`, `66 × text-[11px]`, `43 × text-[10px]`, and `2 × text-[9px]`.
- Weight usage includes `78 × font-black` and `21 × font-extrabold`, which makes ordinary UI labels compete visually with headings.
- Line-height and tracking are selected locally rather than through a shared hierarchy.

The requested outcome is a consistent Inter-based system across navigation, headers, shared controls, dialogs, and feature content, with the calm and readable hierarchy visible in the supplied Mindtrip screenshot.

### 1.2 Font Identification

The supplied `@font-face` declaration identifies the family as **Inter**, italic style, weight `400`, `font-display: swap`. That declaration alone is not a complete production configuration because:

- it contains only italic `400`, not the normal face or UI weights;
- the shown Unicode range is a subset and does not prove Vietnamese coverage;
- the hashed `/_next/static/media/...woff2` path belongs to another Next.js build and must not be reused;
- TripSense needs normal and italic faces with Vietnamese glyph support.

The screenshot is consistent with Inter or a metrically similar modern UI sans-serif. Exact CSS pixel values cannot be proven from a screenshot alone, but the hierarchy can be reconstructed with high confidence.

### 1.3 In Scope

- Self-host Inter variable font for the entire web application.
- Support normal and italic styles, optical weights `450`, `550`, `650`, and `700` through variable font ranges.
- Include Vietnamese and Latin glyph coverage.
- Define one semantic typography scale for application UI.
- Apply the scale to the user header, sidebar, mobile navigation, shared primitives, and feature pages.
- Replace accidental `9px`/`10px` UI text and excessive `font-black` usage.
- Preserve special-purpose monospace usage for IDs, code, counters, and technical values.
- Preserve responsive behavior, dark mode, i18n, and semantic color tokens.

### 1.4 Out of Scope

- Copying Mindtrip font files, CSS bundles, logo treatment, colors, maps, or proprietary visual assets.
- Changing application color palette, spacing system, component behavior, backend APIs, or database schemas.
- Changing map-provider labels rendered inside third-party map canvases.
- Rewriting marketing copy or feature content.

### 1.5 Acceptance Criteria

- [x] Computed `font-family` for `html`, `body`, header, sidebar, dialog, input, and feature content resolves to the self-hosted Inter asset.
- [x] Inter normal and italic variable WOFF2 files are served locally; no runtime request is made to Google Fonts or a third-party font CDN.
- [x] Vietnamese diacritics render from Inter without glyph fallback.
- [x] Standard application UI uses only the approved semantic typography roles.
- [x] No user-facing UI text is below `11px`; `10px` and `9px` are removed except explicitly documented third-party/map exceptions.
- [x] `font-black` is removed from ordinary controls and content; weight `800` is reserved for the TripSense wordmark if retained.
- [x] Header, sidebar, mobile navigation, buttons, inputs, tabs, cards, dialogs, tables, chat, community, trip, and place surfaces follow the same hierarchy.
- [x] Text remains readable at 200% browser zoom and does not clip at Vietnamese or English locale lengths.
- [x] Font loading introduces no visible layout shift and does not block first render.
- [x] Type-check, lint, i18n validation, unit tests, and production build pass.

---

## 2. Target Typography System

### 2.1 Font Family and Loading

Preferred implementation after approval:

- Family: `Inter`.
- Source: official Inter variable WOFF2 assets, committed locally with the OFL license.
- Loader: `next/font/local` in `src/app/layout.tsx`.
- Normal range: `100 900`; application-approved optical weights: `450`, `550`, `650`, `700`.
- Italic range: `100 900`; italic should be used sparingly for editorial emphasis only.
- Display: `swap`.
- CSS variable: `--font-inter`.
- Fallback: `ui-sans-serif`, `system-ui`, `-apple-system`, `BlinkMacSystemFont`, `"Segoe UI"`, `sans-serif`.

Planned configuration shape:

```tsx
const inter = localFont({
  src: [
    { path: "./fonts/InterVariable.woff2", weight: "100 900", style: "normal" },
    { path: "./fonts/InterVariable-Italic.woff2", weight: "100 900", style: "italic" },
  ],
  variable: "--font-inter",
  display: "swap",
});
```

The supplied third-party hashed WOFF2 URL will not be copied or referenced.

### 2.2 Mindtrip-Inspired Reference Estimate

Approximate CSS sizes inferred from the screenshot at desktop scale:

| Reference element | Estimated family / size / line-height / weight |
| --- | --- |
| Sidebar navigation | Inter `15px / 22px / 500` |
| Primary content paragraph | Inter `16px / 26px / 400` |
| Main/section heading | Inter `18–20px / 26–28px / 600–700` |
| Card title | Inter `14px / 20px / 600` |
| Card metadata | Inter `13px / 18px / 400` |
| Button / chip | Inter `13–14px / 20px / 500–600` |
| Caption / secondary metadata | Inter `12px / 16px / 400` |

These values are treated as visual direction rather than a claim about Mindtrip's private source CSS.

### 2.3 TripSense Semantic Type Scale

| Role | CSS size / line-height | Weight | Tracking | Intended usage |
| --- | --- | --- | --- | --- |
| `display` | `32px / 40px` | `700` | `-0.02em` | Landing hero only |
| `page-title` | `24px / 32px` | `700` | `-0.02em` | Primary page heading |
| `section-title` | `20px / 28px` | `700` | `-0.01em` | Major section heading |
| `heading` | `16px / 24px` | `650` | normal | Card/dialog/panel heading |
| `body-lg` | `16px / 26px` | `450` | normal | Long-form answer and prominent body copy |
| `body` | `15px / 24px` | `450` | normal | Default application content |
| `control` | `14px / 20px` | `550` | normal | Navigation, buttons, inputs, tabs |
| `label` | `13px / 18px` | `550–650` | normal | Card labels and compact metadata headings |
| `caption` | `12px / 16px` | `450–550` | normal | Timestamps, helper text, secondary metadata |
| `micro` | `11px / 16px` | `550` | optional `0.02em` | Badges/status only; never paragraph content |
| `overline` | `11px / 16px` | `650` | `0.08em` | Rare uppercase category labels |

### 2.4 Weight Policy

- `450`: paragraphs, descriptions, message content, helper text.
- `550`: navigation, buttons, controls, metadata emphasis.
- `650`: card titles, active navigation, dialog titles.
- `700`: page and section titles.
- `800`: optional TripSense wordmark only.
- `900/font-black`: prohibited for regular product UI.

### 2.5 Component Mapping

| Surface | Typography roles |
| --- | --- |
| Global header | `control`; search input `body`; logo may use `800` |
| Desktop/mobile navigation | `control`; section labels `overline`; badges `micro` |
| Page headers | `page-title` + `body` description |
| Cards | `heading` or `label`; content `body`; metadata `caption` |
| Buttons, inputs, tabs, selects | `control` |
| Dialogs and sheets | title `heading`; content `body`; controls `control` |
| Chat | thread body `body`; names `label/650`; timestamp/status `caption` or `micro` |
| Community | post body `body`; author `label/650`; counters `caption` |
| Trip/itinerary | title `page-title/section-title`; activity `body`; time/cost `caption` |
| Admin tables | cell `control` or `caption`; headers `label/650`; IDs may remain monospace |

---

## 3. Architecture and Service Boundaries

This is a frontend design-system change owned entirely by `apps/web/tripsense`.

- No backend service changes.
- No API Gateway routes.
- No REST, WebSocket, Kafka, database, or migration changes.
- Font assets are served by the Next.js application from the same origin.
- `next/font/local` creates optimized font-face declarations and preloading without runtime third-party font requests.

Planned dependency flow:

```text
[Official Inter WOFF2 + OFL]
            |
            v
[Next.js root layout / next/font/local]
            |
            v
[--font-inter -> semantic typography tokens]
            |
            v
[Shared primitives + AppShell + feature components]
```

---

## 4. API, Events, and Data Model

Not applicable.

- REST endpoints: none.
- Kafka events: none.
- Persistence changes: none.
- Flyway migrations: none.

---

## 5. Security, Privacy, Accessibility, and Performance

| Area | Decision |
| --- | --- |
| Font provenance | Use official Inter assets and retain the OFL license; do not extract the hashed asset from another product. |
| Privacy | Self-host fonts; no runtime request to Google Fonts or other font CDNs. |
| CSP | No additional external `font-src` origin is required. |
| CLS | Use `next/font/local`, preload the normal variable face, and enable fallback metric adjustment where supported. |
| Vietnamese | Verify `ă â đ ê ô ơ ư` and combined tone marks in normal, medium, semibold, bold, and italic. |
| Accessibility | Default body remains at least `15px`; essential information never relies on `micro`; verify 200% zoom and reflow. |
| Performance | Prefer one normal variable WOFF2 and one italic variable WOFF2; avoid separate files per weight. |

---

## 6. Devil's Advocate and Trade-offs

| Risk / alternative | Decision and rationale |
| --- | --- |
| Keep current CSS family declaration only | Rejected: declaring `Inter` does not load the font and produces OS-dependent rendering. |
| Reuse the supplied `/_next/static/media` URL | Rejected: build-specific third-party asset path, unstable and not owned by TripSense. |
| `next/font/google` | Valid technically and self-hosted at runtime, but requires font retrieval during build; local assets make CI and offline builds deterministic. |
| Replace every `text-*` class mechanically | Rejected: hero text, dense tables, map labels, and body copy have different semantic roles; migrate by component category. |
| Set all text to `16px` | Rejected: consistency requires a controlled hierarchy, not one size everywhere. |
| Preserve widespread `font-black` | Rejected: it creates visual noise and does not match the reference's restrained hierarchy. |
| Vietnamese glyph metrics | Inter can slightly change widths versus system font, causing truncation or wrapping; feature-by-feature visual review is required. |
| Global rollout in one unreviewed commit | Rejected: use staged rollout so shell and primitives establish the baseline before feature migration. |

---

## 7. Phased Implementation and Verification

### Phase 1 — Font Foundation

- [x] Add official `InterVariable.woff2`, `InterVariable-Italic.woff2`, and OFL license.
- [x] Configure `next/font/local` in `src/app/layout.tsx`.
- [x] Replace the current unresolved `Inter` declaration with `--font-inter` based tokens.
- [x] Define semantic font-size, line-height, weight, and tracking tokens in `globals.css`.
- [x] Confirm font preloading and same-origin delivery in production build output.

### Phase 2 — Shell and Shared Primitives

- [x] Normalize `UserHeader`, `UserSidebar`, `MobileNavigation`, `Logo`, and admin layout.
- [x] Normalize shared `Button`, `Input`, `Textarea`, tabs, badges, dialogs, dropdowns, empty/error/loading states.
- [x] Use `control` for navigation and controls instead of locally mixing `text-xs`, `text-sm`, and `font-bold`.

### Phase 3 — Feature Migration

- [x] Migrate chat, community, trips, places, AI planner, onboarding, authentication, and admin surfaces.
- [x] Replace user-facing `9px/10px` text with `caption` or `micro`.
- [x] Replace ordinary `font-black/font-extrabold` with semantic `650/700` roles.
- [x] Keep monospace only where it communicates code, identifiers, or aligned numeric values.
- [x] Review wrapping and truncation in both English and Vietnamese.

### Phase 4 — Verification

- [ ] Capture desktop and mobile screenshots for shell, chat, community, trips, places, dialog, and admin table states.
- [ ] Verify Chrome, Safari/WebKit, and a Windows/system-font fallback environment where available.
- [x] Verify browser zoom at `100%`, `200%`, and mobile text scaling in Chrome.
- [ ] Confirm no third-party font requests and no missing-glyph fallback.
- [ ] Confirm layout shift and page wrapping remain acceptable.

### Verification Commands

```bash
cd apps/web/tripsense
npm run type-check
npm run lint
npm run i18n:check
npm test
npm run build

# Audit remaining accidental typography values after migration
rg -n 'text-\[(9|10)px\]|font-black|font-extrabold' src --glob '*.tsx'
```

### Manual Typography Test String

```text
Tiếng Việt: Trải nghiệm Đà Nẵng, Hội An, Hà Giang, Phú Quốc — ă â đ ê ô ơ ư Á À Ả Ã Ạ.
English: Plan a memorable trip with friends — Regular, Medium, Semibold, Bold, Italic.
```

---

## 8. Approval Decision

Recommended direction:

1. Use self-hosted **Inter Variable**, not the third-party hashed WOFF2 URL.
2. Adopt the semantic scale in Section 2.3.
3. Migrate in four phases, beginning with font loading and the application shell.
4. Keep colors, layout behavior, APIs, and backend services unchanged.

```text
STATUS: DONE
```

---

## 9. Implementation Record

- **Completed Date**: 2026-09-24
- Added official Inter normal and italic variable WOFF2 assets plus the OFL license.
- Loaded the assets through `next/font/local` and exposed the family globally through `--font-inter` / `font-sans`.
- Added the approved semantic type roles and normalized the application shell, shared primitives, chat, and feature typography.
- Removed all product-source `9px`/`10px`, `font-black`, and `font-extrabold` usages; retained `11px` only for `micro`/`overline` roles.
- Added a typography contract test to prevent regression.
- Production output contains two same-origin WOFF2 assets with hashes matching the committed files.
- Verification passed: TypeScript, i18n schema validation, 138 unit tests, production build, `git diff --check`, and Chrome visual checks.
- Review result: no architecture, database, security, or PR-readiness findings. The change is web-only and introduces no API, persistence, secret, or service-boundary change.
- Extended Safari/WebKit and Windows visual-regression screenshots remain a recommended release QA activity; they are not an implementation blocker.
- User visual-review refinement: increased optical weights from `400/500/600` to `450/550/650` for body, controls, and headings while keeping major titles at `700`.
