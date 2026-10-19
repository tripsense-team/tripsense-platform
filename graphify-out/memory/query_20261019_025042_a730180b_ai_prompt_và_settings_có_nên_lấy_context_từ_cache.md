---
type: "query"
date: "2026-10-19T02:50:42.092855+00:00"
question: "AI prompt và Settings có nên lấy Context từ cache không?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["OnboardingProfile"]
---

# Q: AI prompt và Settings có nên lấy Context từ cache không?

## Answer

Expanded via graph vocab: context preference onboarding chat cache profile. Graph traversal exposed OnboardingProfile L7 but was broad and predates new cache; current source verification required. Current source: AI fetchUserContext calls Context preferences purpose TRIP_PLANNING; Context controller delegates to CachedPreferencesService, so AI transparently benefits when cache enabled. Settings reads full onboarding with no-store and saves version plus fields absent from preferences projection; keep DB-backed editing per approved cache scope, do not substitute compact preference cache. No application changes made.

## Outcome

- Signal: useful

## Source Nodes

- OnboardingProfile