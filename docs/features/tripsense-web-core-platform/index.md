# TripSense Web Core Platform

STATUS: APPROVED

Plan the TripSense web application and core travel-planning data layer while preserving the repository's gateway-fronted, service-owned data architecture.

The pasted request asks to build a full Next.js application with Trip CRUD, Itinerary CRUD, place search/detail, VietMap maps/routing, external place enrichment, TripSense ratings, favorites, collections, and AI-ready candidate APIs. A priority change approved on 2026-08-18 inserts an approved Milestone 0 provider proof of concept before Trip CRUD.

Milestone 0 validates a Mindtrip-like place discovery flow using `Next.js -> API Gateway -> place-service -> VietMap / OpenTripMap / Wikimedia`. Trip CRUD, Itinerary CRUD, and AI recommendation remain out of scope until this POC is complete and separately approved.

## Current Project State

- `apps/web/tripsense` exists as a minimal Next.js 16 App Router project with Tailwind 4, TypeScript, React 19, and ESLint.
- The web app currently has only starter files under `app/` and no TripSense feature modules.
- `services/api-gateway`, `services/discovery-server`, `services/place-service`, and `services/ai-service` exist.
- `place-service` is currently skeletal; no place domain controllers or persistence were found under `src/main/java`.
- `trip-service`, `itinerary-service`, `review-service`, `user-service`, and `identity-service` are planned but not present in the source tree.
- The gateway currently routes `/api/places/**` to `place-service`; trip, itinerary, review, user, and internal routes are not implemented.
- No Prisma schema or web-app database setup exists.

## Required Files

- [requirements.md](requirements.md)
- [architecture.md](architecture.md)
- [api.md](api.md)
- [data-model.md](data-model.md)
- [security.md](security.md)
- [decisions.md](decisions.md)
- [implementation-plan.md](implementation-plan.md)
- [test-plan.md](test-plan.md)
- [provider-verification.md](provider-verification.md)

## Related

- [Feature Index](../index.md)
- [Multi-Agent Feature Workflow](../../workflows/multi-agent-feature-workflow.md)
- [TripSense Architecture](../../architecture/tripsense-architecture.md)
- [Service Boundaries](../../architecture/service-boundaries.md)
