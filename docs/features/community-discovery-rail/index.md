# Community Discovery Rail

**STATUS: APPROVED**

Bring the remaining meaningful parts of the `test.html` Community rail to TripSense without demo data: fix the owned-trip picker first, then add public creator identity, follow/discovery, a canonical destination contract, a privacy-safe public-share trend and provider-backed weather.

## Scope sequence

1. **P0 — Trip picker reliability:** diagnose and repair the existing My Trips → preview → publish flow.
2. **E — Public social profile:** safe public identity contract.
3. **F — Follow and creator discovery:** persisted follow loop and suggestion rail.
4. **H — Canonical public destination:** a safe Place reference for contextual features.
5. **I — Public-share destination trend:** a thresholded aggregate labelled “Điểm đến được cộng đồng chia sẻ nhiều hôm nay”, never an assertion of live visits.
6. **J — Weather:** cached backend weather for an explicit public destination.

Weather, creators, Follow and destination trend remain absent until their preceding slice is complete. Actual visits, arrivals and live location require a separately approved opt-in Trip event and Context aggregate. This plan does not change the approved public-itinerary policy.

## Documents

- [Requirements](requirements.md)
- [Architecture](architecture.md)
- [API](api.md)
- [Data model](data-model.md)
- [Security](security.md)
- [Decisions](decisions.md)
- [Implementation plan](implementation-plan.md)
- [Test plan](test-plan.md)

STATUS: APPROVED
