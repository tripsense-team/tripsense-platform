# Provider Verification

STATUS: BLOCKED_ON_PROVIDER_RATE_LIMITS

Verification date: 2026-08-18

Milestone 0 verifies the real provider path before Trip CRUD and Itinerary CRUD continue.

```text
Next.js Web
   -> API Gateway
   -> Place Service
   -> VietMap API
   -> OpenTripMap API
   -> Wikimedia / Wikipedia public APIs
```

## Environment

| Configuration | Result |
| --- | --- |
| VietMap Service Key | configured |
| VietMap Tilemap Key | configured |
| OpenTripMap API Key | configured |
| Wikimedia API Key | not required |

## Provider Responsibilities

| Provider | Responsibility | Status |
| --- | --- | --- |
| VietMap | map rendering, search, coordinates, routing, distance, travel time | functional before rate-limit event |
| OpenTripMap | primary external place image, description, tourism metadata, Wikipedia/Wikidata references | configured |
| Wikimedia / Wikipedia | fallback image and content when OpenTripMap matches but has no usable image | configured, public API |
| TripSense | own ratings, feedback, intelligence, future AI-ready data | not implemented in Milestone 0 |

## Runtime Health

| Component | URL | Result |
| --- | --- | --- |
| Discovery Server | `http://localhost:8761/actuator/health` | 200 before provider-rate-limit event |
| API Gateway | `http://localhost:8080/actuator/health` | 200 before provider-rate-limit event |
| Place Service | `http://localhost:8082/actuator/health` | 200 before provider-rate-limit event |
| Next.js Explore | `http://localhost:3000/explore` | implemented; screenshots still require a fresh backend run with current code |

## Provider Smoke Tests

| Test | Path | Result |
| --- | --- | --- |
| VietMap search through Place Service | `GET /api/places/search?q=coffee&lat=16.0544&lng=108.2022` | 10 normalized TripSense place DTOs before later rate-limit event |
| VietMap route through API Gateway | `POST /api/routes` | distance `183.7m`, duration `132s`, 9 geometry points before this iteration |
| OpenTripMap provider compile test | `mvn test` | pass |
| Frontend no-hover request behavior | marker/card hover handlers | no popup open and no provider fetch on hover |

## 20-Place Verification Attempt

A 20-place run completed before the targeted selector rerun. It is useful for provider behavior, but it is not the final acceptance dataset because the initial attraction query produced non-attraction VietMap autocomplete results. A targeted rerun was started and then stopped when VietMap returned HTTP 429 during place detail lookup.

| Place | Category | VietMap | OpenTripMap Match | Match Confidence | OTM Image | Wikimedia Image | Description |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Mua Ban Chim Canh A.Do | Attractions | yes | no | n/a | no | no | no |
| Diem Ban Smart A Da Nang | Attractions | yes | no | n/a | no | no | no |
| Ban Dieu Hanh Thi Cong Cong Trinh Thuy Dien A Vuong | Attractions | yes | no | n/a | no | no | no |
| Cho Thue Ban Ghe A Chinh | Attractions | yes | no | n/a | no | no | no |
| Kien Truc A.V.A | Attractions | yes | no | n/a | no | no | no |
| My Khe Beach | Beach/Nature | yes | yes | 0.73 | no | no | no |
| My Khe Beach Villa | Beach/Nature | yes | no | n/a | no | no | no |
| Chung Cu My Khe Beach | Beach/Nature | yes | no | n/a | no | no | no |
| Chung Cu My Khe Beach | Beach/Nature | yes | no | n/a | no | no | no |
| Picklehead My Khe Beach Pickleball Club | Beach/Nature | yes | no | n/a | no | no | no |
| Dopamine 2hand & Coffee | Cafe | yes | no | n/a | no | no | no |
| Gia Lai Coffee | Cafe | yes | no | n/a | no | no | no |
| Cau 3 Coffee | Cafe | yes | no | n/a | no | no | no |
| Ca Phe D7 | Cafe | yes | no | n/a | no | no | no |
| Ca Phe 44 | Cafe | yes | no | n/a | no | no | no |
| Coi Nguon Restaurant | Restaurant | yes | no | n/a | no | no | no |
| Coi Nguon Restaurant | Restaurant | yes | no | n/a | no | no | no |
| Thanh Truc Restaurant | Restaurant | yes | no | n/a | no | no | no |
| Tuyen Son Restaurant | Restaurant | yes | no | n/a | no | no | no |
| Anna Restaurant | Restaurant | yes | no | n/a | no | no | no |

## Partial Totals

| Metric | Value |
| --- | --- |
| Attempted places | 20 |
| VietMap found | 20 |
| OpenTripMap matched | 1 |
| OpenTripMap images | 0 |
| Wikimedia images | 0 |
| Any real external image | 0 |
| Descriptions | 0 |
| Provider errors in completed attempt | 0 |
| Targeted rerun status | stopped after VietMap HTTP 429 |

## Category Summary

Attractions:

- matched 0/5
- image 0/5
- description 0/5
- note: initial query results were not valid attraction candidates; targeted rerun was blocked by VietMap HTTP 429

Beach/Nature:

- matched 1/5
- image 0/5
- description 0/5

Cafe:

- matched 0/5
- image 0/5
- description 0/5

Restaurant:

- matched 0/5
- image 0/5
- description 0/5

## Provider Errors

| Provider | Error | Sanitized status |
| --- | --- | --- |
| Wikimedia | HTTP 429 occurred in an earlier fallback attempt when fallback was too broad | resolver now only calls Wikimedia after an OpenTripMap match without image |
| VietMap | HTTP 429 during targeted rerun | stop provider verification until rate limit resets |

## Outcome

Do not treat this as final acceptance coverage for OpenTripMap/Wikimedia. The current evidence is not strong enough to accept OpenTripMap as the image provider for a Mindtrip-like map experience, but the final keep-or-replace recommendation should wait for a clean targeted 20-place run after VietMap rate limits reset.

Trip CRUD and Itinerary CRUD remain blocked until a human approves the next step.

## Visual Evidence

Local screenshots from earlier VietMap POC remain under ignored runtime artifacts:

- `.codex-run/explore-desktop.png`
- `.codex-run/explore-mobile.png`

Fresh click-popup screenshots for OpenTripMap/Wikimedia require a clean backend run with current code after provider rate limits reset.
