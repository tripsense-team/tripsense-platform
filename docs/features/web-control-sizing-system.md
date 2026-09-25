# Web Control & Icon Sizing System — Specification & Implementation Plan

`STATUS: DONE`

- **Owner Component**: `apps/web/tripsense`
- **Affected Components**: Shared button primitive, user/admin/landing shell, navigation, chat controls, feature action buttons
- **Created Date**: 2026-09-24
- **Approved Date**: 2026-09-24
- **Approval**: User explicitly responded `Implement` in the Codex task.
- **Reference Direction**: Mindtrip-inspired control density from the supplied screenshot
- **Related Feature**: [`web-typography-system`](./web-typography-system.md)
- **Target PR Boundaries**: Phase 1 (shared sizing contract), Phase 2 (shell/navigation), Phase 3 (feature actions), Phase 4 (visual/accessibility verification)

---

## 1. Goal & Requirements

### 1.1 Problem Statement

After adopting the heavier Inter scale, TripSense controls now look visually undersized relative to their labels. The current shared button baseline is `36px`, the small variant is `32px`, icon buttons are `36px`, and shared button icons are `16px`. Main sidebar icons are also `16px`. The supplied reference uses larger control surfaces and stronger `18–20px` primary icons.

The goal is to increase perceived usability and visual balance without blindly enlarging status icons, map markers, dense admin cells, or non-interactive metadata.

### 1.2 In Scope

- Define one shared button-height and icon-size contract.
- Increase shared buttons and primary action icons.
- Increase header, sidebar, mobile navigation, and primary chat controls.
- Add an explicit compact `xs` button size for genuinely dense secondary actions.
- Preserve focus states, disabled states, loading states, alignment, responsive behavior, and semantic colors.
- Verify pointer and touch target usability at desktop, mobile, and 200% zoom.

### 1.3 Out of Scope

- Changing typography, color palette, border-radius system, or page layout.
- Enlarging decorative illustrations, avatars, map pins, rating stars, status dots, or inline metadata icons.
- Backend, API Gateway, REST, WebSocket, Kafka, database, or migration changes.
- Copying proprietary Mindtrip assets or exact component geometry.

### 1.4 Approved Target Scale

| Role | Control box | Icon | Usage |
| --- | ---: | ---: | --- |
| `xs` | `32px` | `14px` | Dense table/menu/metadata action only |
| `sm` | `36px` | `16px` | Secondary compact action |
| `default` | `40px` | `18px` | Standard application button |
| `lg` | `44px` | `20px` | Primary CTA and mobile-important action |
| `icon` | `40 × 40px` | `20px` | Header and toolbar icon button |
| Mobile primary target | at least `44 × 44px` | `20px` | Important touch action |
| Navigation icon | row at least `40px` | `20px` | Sidebar/mobile navigation |

### 1.5 Acceptance Criteria

- [x] Shared `Button` implements `xs`, `sm`, `default`, `lg`, and `icon` sizes from the approved scale.
- [x] Standard buttons render at least `40px` high; important mobile actions provide a `44px` target.
- [x] Header and sidebar primary icons render at `20px` with balanced label spacing.
- [x] Chat new-conversation, profile/action, composer-send, and request actions no longer use a `32px` primary target.
- [x] Dense admin/table/menu actions may remain `32px` only through the explicit `xs` variant.
- [x] Decorative/status/metadata icons are not enlarged indiscriminately.
- [x] Button labels and icons remain vertically centered in English and Vietnamese.
- [x] No toolbar wrapping, clipping, overlap, or horizontal overflow at desktop, mobile, or 200% zoom.
- [x] Keyboard focus visibility and disabled/loading states remain unchanged.
- [x] Type-check, lint, i18n validation, unit tests, production build, and visual checks pass.

---

## 2. Architecture & Service Boundaries

This is a frontend design-system change owned entirely by `apps/web/tripsense`.

```text
[Shared Button size variants + icon contract]
                     |
                     v
[Header / Sidebar / Navigation / Chat]
                     |
                     v
[Feature actions migrate by interaction priority]
```

- No new service or frontend dependency.
- No network contract or service communication change.
- No cross-service data access or persistence impact.
- Existing semantic theme colors and component behavior remain unchanged.

---

## 3. API, Events, and Data Model

Not applicable.

- REST endpoints: none.
- Kafka events: none.
- DTO changes: none.
- Database schema/migration: none.

---

## 4. Accessibility, Security, and Performance

| Area | Decision |
| --- | --- |
| Accessibility | Larger targets improve pointer/touch usability; keep existing focus-visible ring and accessible labels. |
| Icon semantics | Decorative icons remain hidden or presentation-only where currently applicable; icon-only buttons retain `aria-label`. |
| Security/privacy | No auth, input, secret, logging, or user-data flow changes. |
| Performance | Reuse existing Lucide SVG components; no new assets, packages, or runtime requests. |
| Responsive behavior | Use `xs` deliberately in dense desktop contexts and `lg`/minimum `44px` for important mobile actions. |

---

## 5. Devil's Advocate & Trade-offs

| Risk / alternative | Decision |
| --- | --- |
| Replace every `h-4 w-4` globally | Rejected: would enlarge timestamps, status, rating, map, and decorative icons incorrectly. |
| Make every button `44px` | Rejected: too loose for desktop tables, menus, and dense side panels. |
| Keep `sm=32px` | Rejected: it perpetuates the current undersized appearance; add explicit `xs=32px` instead. |
| Let each feature choose arbitrary sizes | Rejected: recreates the inconsistency this system is intended to remove. |
| Increase icons without targets | Rejected: larger glyphs inside small hit areas look cramped and do not improve usability. |
| Global primitive change only | Insufficient: many existing components override button height and child icon dimensions locally; migrate shell and priority actions explicitly. |

---

## 6. Phased Implementation & Verification

### Phase 1 — Shared Contract

- [x] Update `Button` variants to `xs=32`, `sm=36`, `default=40`, `lg=44`, `icon=40`.
- [x] Map icon sizes to `14`, `16`, `18`, and `20px` by variant.
- [x] Keep loading spinner aligned with the selected size.
- [x] Add/update primitive tests for generated variant classes and loading semantics.

### Phase 2 — Shell & Navigation

- [x] Migrate user, landing, and admin header actions to `40px` targets and `20px` icons.
- [x] Increase desktop sidebar navigation icons to `20px` and enforce at least `40px` rows.
- [x] Verify mobile navigation remains balanced and important actions meet `44px` touch targets.
- [x] Preserve collapse controls as deliberate compact actions where appropriate.

### Phase 3 — Priority Feature Actions

- [x] Migrate chat primary actions: new conversation, profile/actions, composer send, request actions, and dialogs.
- [x] Migrate common feature CTAs that inherit the shared primitive.
- [x] Convert truly dense `32px` actions to explicit `size="xs"` rather than local height overrides.
- [x] Leave metadata/status/decorative icons unchanged unless they are the sole interactive affordance.

### Phase 4 — Verification

- [x] Audit interactive `32px` overrides and document intentional exceptions.
- [x] Verify desktop shell, mobile shell, chat, dialogs, admin table, and map toolbar visually.
- [x] Verify English/Vietnamese wrapping and browser zoom at `100%` and `200%`.
- [x] Run automated validation and production build.

### Verification Commands

```bash
cd apps/web/tripsense
npm run type-check
npm run lint
npm run i18n:check
npm test
npm run build

rg -n 'className="[^"]*h-8 w-8|className="[^"]*h-8[^"].*size="icon"' src --glob '*.tsx'
```

---

## 7. Approval Gate

Recommended implementation:

1. Increase shared controls first, then migrate explicit overrides by interaction priority.
2. Use `20px` for primary navigation/header icons and `18px` for standard text-button icons.
3. Preserve `14–16px` for non-primary metadata/status icons.
4. Use the new `xs` size for intentional dense actions instead of arbitrary `h-8` overrides.

Implementation was explicitly approved by the user on 2026-09-24 and is complete.

```text
STATUS: DONE
```

---

## 8. Implementation & Review Record

### Delivered

- Added the five-level shared control contract and variant-driven icon sizing.
- Increased shell, navigation, dialog, sheet, chat, social, trip, place, and AI-workspace interaction targets according to their priority.
- Reserved `32px` controls for deliberate dense contexts through `size="xs"`; mobile-important chat actions use `44px` targets.
- Preserved smaller decorative, status, rating, avatar, map-marker, and metadata glyphs.
- Removed invalid nested interactive markup from the new-chat user row while retaining its full-row click target.

### Verification

| Check | Result |
| --- | --- |
| `npm run type-check` | Passed |
| `npm run lint` | Passed with 0 errors; 37 pre-existing/non-blocking warnings outside this sizing change remain |
| `npm run i18n:check` | Passed with English/Vietnamese schema parity |
| `npm test` | Passed: 28 files, 145 tests |
| `npm run build` | Passed; all application routes compiled/rendered |
| Mobile visual/DOM check | Passed at `390px`; document width equals viewport width |
| 200% zoom-equivalent check | Passed at `720px`; no horizontal overflow |
| Rendered control measurement | Header icon controls `40 × 40px` with `20px` glyphs; primary mobile chat controls `44px` |

### Required Reviews

- **Architecture**: PASS — frontend-only design-system change; no service boundary, gateway, REST, Kafka, or dependency changes.
- **Database**: N/A/PASS — no schema, migration, persistence, transaction, or data ownership changes.
- **Security**: PASS — no authentication, authorization, identity, secret, logging, or user-data flow changes; accessible names and focus behavior remain present.
- **PR readiness**: PASS — no blocker, high, or medium findings; contract tests, responsive checks, documentation, and production build are complete.
