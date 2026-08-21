# PR Review: Place Search & MapVina Integration

- **Review Date**: 2026-08-21
- **Result**: REQUEST CHANGES
- **Scope**: Gateway routing, Next.js place/map implementation, `place-service`, tests, configuration, and feature documentation.

## Resolved Findings

| Severity | Finding | Resolution |
| --- | --- | --- |
| BLOCKER | Concrete ZioMap key in versioned Compose config | Removed; service loads environment/secret configuration. Rotate any historical credential. |
| BLOCKER | Provider data interpolated into popup HTML | Popup is constructed with DOM nodes and `textContent`; URL schemes and telephone values are validated. |
| HIGH | Browser bypassed Gateway for place-service/MapVina calls | Removed direct provider calls and service-specific rewrite; all place calls use `/api/places/**` through Gateway. |
| HIGH | Fake ratings, counts, status, and fallback places | Removed; optional facts stay absent when unavailable. |
| HIGH | Frontend called a nonexistent Google-review endpoint | Removed; detail refresh uses the supported place details contract. |
| MEDIUM | Provider failures looked like successful empty results | Local/cache fallback remains; no-fallback provider failure maps to `503`. |
| MEDIUM | Search service mixed search, persistence mapping, and details | Split into search, details, persistence, ranking, cache, and provider adapter responsibilities. |
| MEDIUM | Application services depended on concrete ZioMap behavior | Added `PlaceProvider`/`PlaceEnrichmentProvider`; HTTP client construction is injected/configured separately. |
| MEDIUM | Place service layer did not follow the repository's interface/implementation convention | Added focused service contracts under `service`, moved Spring beans to `service/impl` as `*ServiceImpl`, and changed controller/service dependencies to interfaces. |
| MEDIUM | Frontend had no regression tests for routing/XSS fixes | Added five Vitest tests covering Gateway-relative calls, errors, popup text safety, and URL rejection. |
| MEDIUM | Place route had no implemented abuse throttle | Added a Redis-backed Gateway rate limiter for `/api/places/**`. The key resolver trusts forwarded addresses only from `TRUSTED_PROXY_CIDRS` and ignores spoofed headers from direct clients. |
| LOW | Broad remote image allowlist | Restricted to explicit HTTPS hosts. |

## MVC and SOLID Assessment

- MVC layering is appropriate: controllers handle HTTP concerns, services own use cases, repositories own persistence, DTOs isolate transport, and provider adapters isolate external APIs.
- SRP: search, details, persistence, ranking, caching, popup construction, and API transport have separate responsibilities.
- DIP: application services depend on provider interfaces. Multi-provider selection still needs an explicit registry or qualifier strategy before OCP can be considered complete.
- ISP: enrichment is separated from the base search provider contract so consumers depend only on required capabilities.
- LSP: provider failures use a common exception contract and normalized DTOs; implementations must preserve these semantics.

## Verification

- Backend: 28 tests passed, 0 failures/errors (Java 21).
- API Gateway: 6 tests passed on Java 21, including route wiring plus trusted-proxy, forwarded-chain, spoofing, and invalid-CIDR behavior.
- Frontend: 5 tests passed; ESLint passed; TypeScript passed; Next.js production build passed.
- Dependency audit: `npm install` reported 0 vulnerabilities.

## Non-blocking Follow-ups

- Add a live Gateway + Redis rate-limit integration test in CI.
- Add browser-level card/marker interaction coverage.
- Rotate any provider credential that may remain in Git history and configure production token origin/quota restrictions.

## Open Merge Findings

- **HIGH**: A MapVina basemap POI ID is still passed to ZioMap place-details before the name/coordinate fallback. A ZioMap error bypasses that fallback and can return `503` for a valid clicked POI.
- **HIGH**: `deploy/docker-compose.yml`, `deploy/nginx/nginx.conf`, and `.github/workflows/cd.yml` still target legacy `auth-service`, `booking-service`, and `payment-service` paths/images rather than the modules in the current root Maven build. The root development Compose file is aligned; the production deployment bundle is not deploy-ready.
