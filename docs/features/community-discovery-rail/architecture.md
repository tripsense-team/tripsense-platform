# Architecture

## Affected services

| Slice                            | Owner                             | Supporting services                               |
| -------------------------------- | --------------------------------- | ------------------------------------------------- |
| P0 picker                        | `trip-service` owner list; Web UX | Gateway, Social preview                           |
| E public profile                 | `user-service`                    | Web, Social author projection                     |
| F follows/suggestions            | `social-service`                  | User public-profile batch contract, Gateway, Web  |
| H public destination             | `place-service` contract          | Trip, Social, Web                                 |
| I public-share destination trend | `social-service` aggregate        | Place public-destination projection, Gateway, Web |
| J weather                        | future `context-service`          | Place, Gateway, Web                               |

## Flow

```text
Web -> Gateway -> Trip: owned trip list
Web -> Gateway -> Social -> Trip: preview/publication

Web -> Gateway -> Social: follow/suggestions
Web -> Gateway -> User: public-profile batch

Web -> Gateway -> Social: public-share destination trend
Social -> Place: bounded public-destination projection/event (never a database read)

Web -> Gateway -> Context: weather(canonical public destination)
Context -> approved weather provider
```

All public browser traffic goes through Gateway. No service reads another service's database or entity.

## Communication

- P0 keeps the current synchronous Trip projection call because publication needs an immediate owner-authorized result.
- Social can consume an asynchronous public-profile change/deactivation event to maintain a minimal local author projection; a bounded User batch read is the transitional compatibility path, never a per-card call.
- Weather is a synchronous cached read; provider calls are isolated behind Context and not made per feed card.
- I is a Social-owned aggregate updated within local Social transactions when an eligible public trip share is created, visibility changes or is removed, plus a bounded daily reconciliation. It uses an immutable internal public-destination reference supplied by H; only allowlisted display data reaches Web.
- Actual-travel trends are deferred: Trip would publish consented, revisioned events and future Context would aggregate them asynchronously. Social cannot infer them from post timestamps.

## Rejected alternatives

- Re-enable hardcoded Weather/Follow/creator cards.
- Use the current `/api/users/profile/{id}` endpoint, which includes private profile data.
- Store follows in User or create cross-service foreign keys.
- Query weather from free text, raw coordinates or browser-held provider credentials.
- Let Social access Trip or User databases.
- Call public-share popularity an actual visit trend, group mutable free-text `destinationName`, or expose raw Trip/Place IDs to Web.
