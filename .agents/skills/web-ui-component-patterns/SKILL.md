---
name: web-ui-component-patterns
description: UI design, layout, and component styling standards for TripSense Mindtrip-inspired web interface (apps/web/tripsense). Use when creating UI components, layout views, or applying CSS theme tokens.
---

# Web UI & Component Patterns Skill

Use this skill whenever designing, building, or styling UI components for `apps/web/tripsense`.

## Design System & Theme Rules

1. **Zero Hardcoded Colors**:
   - NEVER use static color hex values like `bg-[#ffffff]` or `text-[#000000]`.
   - ALWAYS use semantic CSS variables mapped from the tweakcn theme in `globals.css`:
     - Backgrounds: `bg-background`, `bg-card`, `bg-popover`, `bg-muted`, `bg-secondary`, `bg-accent`
     - Text: `text-foreground`, `text-card-foreground`, `text-muted-foreground`, `text-primary-foreground`
     - Borders: `border-border`, `border-input`
     - Focus & Ring: `outline-ring`, `ring-ring`
     - Accents: `bg-primary`, `text-primary`

2. **Rounded Radius & Shadows**:
   - Rounded corners: `rounded-lg`, `rounded-xl`, `rounded-2xl`, `rounded-full`.
   - Shadows: `shadow-2xs`, `shadow-xs`, `shadow-sm`, `shadow-md`.

3. **Micro-Animations & Interactions**:
   - Smooth transitions: `transition-all duration-200` or `duration-300`.
   - Image scaling on hover: `group-hover:scale-105 transition-transform duration-300`.
   - Interactive feedback: `active:scale-125 transition-transform`.

---

## Component Selection Guidelines

### 1. Primitive Controls (`@/components/ui/*`)
Use primitive UI controls from `@/components/ui/` for basic interactive elements:
- `Button`
- `Card`
- `Badge`
- `Avatar`
- `Input` / `Textarea`
- `Dialog` / `Sheet` / `DropdownMenu` / `Popover` / `Tabs`

### 2. Shared Utilities (`@/components/shared/*`)
Reuse shared cross-feature components from `@/components/shared/`:
- `Logo`
- `SearchInput`
- `Rating`
- `PriceDisplay`
- `FavoriteButton`
- `ShareButton`
- `ResponsiveDialog` (Modal on Desktop, Sheet on Mobile)
- `EmptyState` / `ErrorState` / `LoadingState`

### 3. Layout Compositions (`@/components/layout/*`)
Select the appropriate layout wrapper:
- **`AppShell`**: Full application layout with Header and Sidebar.
- **`PageContainer`**: Standard page layout wrapper with max-width and padding.
- **`SplitView`**: 2-pane layout (e.g. Content | Map or Chat | Itinerary).
- **`MapLayout`**: Full-screen or split map view.
- **`AuthLayout`**: Centered authentication form container.

---

## Code Standard Template

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export interface CustomComponentProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
}

export function CustomComponent({
  title,
  className,
  ...props
}: CustomComponentProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-4 text-card-foreground shadow-xs hover:shadow-sm transition-all",
        className
      )}
      {...props}
    >
      <h3 className="font-semibold text-foreground">{title}</h3>
    </div>
  );
}
```
