<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# TripSense Web Application Agent Rules (`apps/web/tripsense`)

All AI Coding Agents modifying code in this web application must strictly follow these engineering guardrails:

## 1. Zero-Leak Error Handling & Client Logging

- Read and strictly adhere to [docs/ERROR_HANDLING_AND_LOGGING_STANDARDS.md](../../docs/ERROR_HANDLING_AND_LOGGING_STANDARDS.md).
- **NEVER** render raw server errors, SQL queries, JDBC exceptions, Spring stack traces, or internal error dumps to the UI, forms, or toasts.
- All API requests MUST use `apiClient` from `@/services/api-client`, which automatically intercepts and sanitizes errors using `error-sanitizer.ts`.
- When catching errors in components, use `getSafeErrorMessage(err)` or `err.message` from `ApiError`.
- **NEVER** call `console.log()` on sensitive data (JWT tokens, passwords, auth store states, raw backend traces). Any debug logging must be wrapped in `if (process.env.NODE_ENV === "development")`.

## 2. Internationalization (i18n)

- Read and adhere to [docs/I18N_STANDARDS.md](../../docs/I18N_STANDARDS.md).
- Do not hardcode UI strings in JSX components; use `useTranslation()` from `@/i18n`.
- Maintain 100% key parity between `en.json` and `vi.json` and verify with `npm run i18n:check`.

## 3. UX Feedback & Toasts

- Read and adhere to [docs/UX_FEEDBACK_GUIDELINES.md](../../docs/UX_FEEDBACK_GUIDELINES.md).
- Do not toast micro-interactions (like, bookmark, tab switch). Use inline feedback or state reflection.
