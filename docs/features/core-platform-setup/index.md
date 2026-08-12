# Core Platform Setup

STATUS: APPROVED

Standardize the TripSense Spring platform foundation: API Gateway, Eureka discovery server, service naming, and local port conventions.

## Summary

The repository already contains Spring service folders for API Gateway, Trip, Place, Context, Itinerary, and Review services. The discovery server folder exists but is incomplete. Current Spring application names and Maven artifacts use mixed PascalCase names, while the platform documentation uses kebab-case service names.

This plan aligns the source tree with the TripSense architecture before feature work builds on unstable service wiring.

## Required Files

- [requirements.md](requirements.md)
- [architecture.md](architecture.md)
- [api.md](api.md)
- [data-model.md](data-model.md)
- [security.md](security.md)
- [decisions.md](decisions.md)
- [implementation-plan.md](implementation-plan.md)
- [test-plan.md](test-plan.md)

## Related

- [Feature Index](../index.md)
- [Multi-Agent Feature Workflow](../../workflows/multi-agent-feature-workflow.md)
- [TripSense Architecture](../../architecture/tripsense-architecture.md)
- [Service Boundaries](../../architecture/service-boundaries.md)
