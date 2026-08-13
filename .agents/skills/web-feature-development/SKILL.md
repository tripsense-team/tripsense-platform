---
name: web-feature-development
description: Step-by-step workflow and guidelines for building frontend features in TripSense Next.js web application (apps/web/tripsense). Use when creating new web features, adding API integrations, or writing feature components.
---

# Web Feature Development Skill

Use this skill whenever you are building, extending, or refactoring a frontend feature in `apps/web/tripsense`.

## Feature Architecture Guidelines

All features live under `apps/web/tripsense/src/features/<feature-name>/`.
Do NOT place raw business logic or large feature components directly in `src/app/`.

### Directory Structure

```text
src/features/<feature-name>/
├── components/           # Feature-specific presentation and container components
├── hooks/                # Custom React hooks scoped to this feature domain
├── services/             # API client methods for this feature domain
├── types/                # TypeScript interfaces and types for this feature
├── utils/                # Feature-specific helper utilities
└── index.ts              # Public barrel export file for this feature module
```

---

## Step-by-Step Feature Implementation Workflow

### Step 1: Define Types (`types/index.ts`)
Define strict TypeScript interfaces for domain entities, request payloads, and component props.

```typescript
export interface Destination {
  id: string;
  name: string;
  location: string;
  description?: string;
  rating?: number;
  priceLevel?: 1 | 2 | 3 | 4;
}
```

### Step 2: Define API Services (`services/<feature>-api.ts`)
Use the shared `apiClient` wrapper from `@/services/api-client`.

```typescript
import { apiClient } from "@/services/api-client";
import type { Destination } from "../types";

export async function getDestinations(): Promise<Destination[]> {
  return apiClient<Destination[]>("/destinations");
}
```

### Step 3: Build Presentation Components (`components/`)
- Keep components focused and modular.
- Use semantic CSS variables for styling (`bg-background`, `text-foreground`, `bg-card`, `border-border`).
- Reuse primitive controls from `@/components/ui/*` and shared components from `@/components/shared/*`.

### Step 4: Export Public Symbols (`index.ts`)
Only export symbols that external modules or pages need to import.

```typescript
export * from "./components/<feature>-view";
export * from "./types";
```

### Step 5: Integrate with App Router (`src/app/`)
Keep `page.tsx` minimal (Server Component by default) by simply rendering the feature view component.

```tsx
import { FeatureView } from "@/features/<feature-name>";

export default function FeaturePage() {
  return <FeatureView />;
}
```

---

## Verification Rules

After implementing any feature code:
1. Run `npm run lint` in `apps/web/tripsense` (0 errors).
2. Run `npx tsc --noEmit` in `apps/web/tripsense` (0 errors).
3. Run `npm run build` in `apps/web/tripsense` (clean build).
