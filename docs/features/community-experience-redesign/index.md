# Community Experience Redesign

**STATUS: IMPLEMENTING**

Build the production Community around the composition and visual language of [`test.html`](../../../test.html): a compact hero, dual-mode composer, newest feed with distinct update/trip cards, and a contextual desktop rail. Existing valid social behavior and deep links remain intact.

The confirmed Trip Share use case is **publishing a detailed travel itinerary**, not reducing it to a summary-only post. The feed remains lightweight, while the typed trip-share detail displays an immutable, owner-previewed `PublicTripSnapshot` arranged by day. Private source-trip entities are never serialized directly.

## Target experience

- **Share an update:** text and up to ten verified images using the existing standard-post flow.
- **Share a trip:** select an owned trip, review the exact public itinerary, explicitly choose visibility, and publish through the typed Trip Share flow.
- **Newest feed:** server-paginated `All / Updates / Shared trips`; feed cards receive summary data only.
- **Trip detail:** day-by-day public itinerary, reactions and discussion; it never grants another user access to the canonical source trip.
- **Contextual rail:** Community guidance ships first. Follow, Save, Weather, Suggested Creators and Recent Destinations appear only after their real backend slices exist.

## Delivery phases

1. **Phase A — immediate containment:** stop returning/writing the unsafe legacy itinerary shape, scrub old raw JSON, align visibility, and fix production integration configuration.
2. **Phase B — supported Community shell:** implement the `test.html` hero, 8/4 layout, dual composer, type-filtered feed and distinct cards using supported capabilities only.
3. **Phase C — safe detailed publication:** add preview-bound `PublicTripSnapshot V1`, versioned immutable persistence, typed detail and legacy-share republish.
4. **Phase D — public readiness:** add minimum report/audited removal before broadly enabling detailed `PUBLIC` publication.

Each phase has its own release gate. Approval of this plan does not approve later Follow, Save, Weather or Discovery implementations.

## Documents

- [Requirements and exact V1 field policy](requirements.md)
- [Architecture](architecture.md)
- [API contracts](api.md)
- [Data model and migration](data-model.md)
- [Security](security.md)
- [Decisions](decisions.md)
- [Implementation plan](implementation-plan.md)
- [Test plan](test-plan.md)
- [Implementation impact and verification](implementation-report.md)
- [Final review results](review-results.md)
- [`test.html` production mapping](test-html-review.md)
- [Longer-term feature roadmap](feature-roadmap.md)

## Related

- [Social Post Management](../social-post-management/index.md)
- [Trip Sharing](../trip-sharing/index.md)
- [Feature index](../index.md)

STATUS: IMPLEMENTING
