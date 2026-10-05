# Security & Trust Boundaries: Place Search & Map Application

## Credentials

- `ZIOMAP_API_KEY` is a backend secret read by `place-service`. It is not present in frontend code, public responses, or versioned `docker-compose.yml` values.
- Production supplies the ZioMap key through a deployment secret. Local Compose may load it from the ignored service `.env` file.
- `NEXT_PUBLIC_MAPVINA_API_KEY` is only a browser-visible basemap style token. Restrict it by allowed origin/referrer, enabled API/style, quota, and rotation policy.
- There is no hard-coded fallback token. Without a MapVina token, the frontend uses the configured CARTO/OSM basemap fallback.

## Trust Boundaries

```text
Browser -> API Gateway -> Place Service -> ZioMap
Browser -> MapVina style endpoint (public restricted style token only)
```

Search, autocomplete, details, and nearby requests cannot bypass Gateway rate limits, service validation, cache, or persistence. External provider payloads are untrusted input.

## Authentication and Authorization

Current place endpoints are public read-only discovery endpoints and require no user identity. Future mutation or curation endpoints require authenticated role/ownership checks and a separate security review. No user-supplied identity is trusted in this feature.

## Input and Output Safety

- Bean validation constrains query length, coordinates, radius, and result limit.
- Repository access uses typed Spring Data queries rather than concatenated database expressions.
- Map popup provider values are inserted with DOM `textContent`; provider HTML is never interpolated into `innerHTML`.
- Website/social links accept only `http` and `https`; phone links accept a restricted telephone character set.
- External links use `noopener noreferrer`.
- Provider failures return sanitized errors without stack traces, internal URLs, credentials, or raw payload dumps.

## Abuse Controls

- Search autocomplete is debounced by 300 ms and stale requests are cancelled.
- API Gateway rate limiting protects `/api/places/**`; deployment limits should reflect ZioMap quota.
- Rate-limit identity uses the nearest untrusted address in `X-Forwarded-For` only when the immediate peer belongs to `TRUSTED_PROXY_CIDRS`. Headers received directly from untrusted peers are ignored.
- `TRUSTED_PROXY_CIDRS` must contain only the actual Next.js or reverse-proxy addresses/subnets. Broad values such as `0.0.0.0/0` let clients spoof rate-limit identities and are prohibited.
- Redis and MongoDB reduce repeated provider calls.
- Provider connect/read timeouts prevent unbounded request occupation.

## Residual Operational Requirements

- Rotate any credential that existed in prior repository history; removing it from the current file does not erase Git history.
- Configure Gateway rate-limit values, trusted proxy CIDRs, and MapVina allowed origins per environment.
- Monitor `503` rate and provider latency without logging query secrets or provider credentials.
