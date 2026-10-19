---
type: "query"
date: "2026-10-18T18:53:47.730735+00:00"
question: "Why Place returns zero candidates while semantic Explore results look useful; inspect without restarting services"
contributor: "graphify"
outcome: "useful"
source_nodes: ["PlaceRankingServiceImpl", "PlaceSearchServiceImpl", "SemanticCandidateGenerator", "ExploreQueryRelevancePolicy", "MaximumRadiusFilter"]
---

# Q: Why Place returns zero candidates while semantic Explore results look useful; inspect without restarting services

## Answer

Expanded graph vocabulary: place semantic candidate geographic filter ranking. Verified current source: PlaceSearchServiceImpl ranks with PlaceRankingServiceImpl before withinRadius; removed_after_ranking_geo combines lexical rejection and geography and cannot attribute zero to radius alone. PlaceRankingServiceImpl treats cafe/ca/phe as generic and demands remaining distinguishing tokens in name/address/categories; a synthetic offline reflection invocation on compiled code with Moc Coffee and cafe/ca phe categories scored ca phe=15, ca phe chill=0 and rank returned zero. This proves the rule, not the exact real-record cause for request 8ef. Semantic uses Qdrant vector similarity then canonical/category/business/radius filters and ExploreQueryRelevancePolicy; same context radius is enforced, no lexical chill-presence requirement. Qdrant query is global top50 with no payload geo filter; Mongo text retrieval is also top50 before spatial filtering. Place performs provider persistence before rank/radius filtering. Existing logs show sourcePlace timeout3008ms and semantic1931ms then returned43. Recommend aligning recommendation retrieval soft intent versus hard constraints, batch persistence after evidence review, and evaluate semantic-first provider fallback; no implementation authorized or performed.

## Outcome

- Signal: useful

## Source Nodes

- PlaceRankingServiceImpl
- PlaceSearchServiceImpl
- SemanticCandidateGenerator
- ExploreQueryRelevancePolicy
- MaximumRadiusFilter