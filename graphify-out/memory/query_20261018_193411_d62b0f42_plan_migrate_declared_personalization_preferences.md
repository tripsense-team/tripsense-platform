---
type: "query"
date: "2026-10-18T19:34:11.965818+00:00"
question: "Plan migrate declared personalization preferences from User to Context for Recommendation and AI, preserve User schema and discuss history/cache boundaries"
contributor: "graphify"
outcome: "useful"
source_nodes: ["RemoteRecommendationContextProvider", "JpaPreferenceSignalPublisher", "ExploreRecommendationCache"]
---

# Q: Plan migrate declared personalization preferences from User to Context for Recommendation and AI, preserve User schema and discuss history/cache boundaries

## Answer

Expanded using graph vocab: context preference personalization onboarding history consent chat profile. Graph pointed to OnboardingProfile and ExploreRecommendationService; source inspection confirmed RemoteRecommendationContextProvider gates Context and observed history with User consent, AI chat fetches User travel preferences. Revised waiting-for-approval plan reuses purpose-filtered Context signal array for declared preferences, preserves Recommendation-owned observed history under independent backend switch proposed default true, preserves impressions and User identity, and adds no cache or browser persistence. HOME_CITY and destination lists are not present in current preferences contract. No application implementation performed.

## Outcome

- Signal: useful

## Source Nodes

- RemoteRecommendationContextProvider
- JpaPreferenceSignalPublisher
- ExploreRecommendationCache