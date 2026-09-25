# Feature Index

Track every feature that enters the multi-agent workflow.

| Feature | Status | Affected Services | Documentation |
| --- | --- | --- | --- |
| `web-control-sizing-system` | DONE | `apps/web/tripsense` | [Docs](./web-control-sizing-system.md) |
| `web-typography-system` | DONE | `apps/web/tripsense` | [Docs](./web-typography-system.md) |
| `adaptive-ai-travel-chat-redesign` | DONE | `services/ai-service`, `services/place-service`, `apps/web/tripsense` | [Docs](./adaptive-ai-travel-chat-redesign.md) |
| `live-ai-agent-activity-stream` | DONE | `services/ai-service`, `apps/web/tripsense` | [Docs](./live-ai-agent-activity-stream.md) |
| `agentic-place-discovery-ingestion` | DONE | `apps/web/tripsense`, `services/api-gateway`, `services/ai-service`, `services/place-service` | [Docs](./agentic-place-discovery-ingestion.md) |
| `ai-chat-travel-platform` | APPROVED; IMPLEMENTING B–E AND RICH ITINERARY; PHOTO MODAL LOCAL TRIAL APPROVED, PRODUCTION DISPLAY GATED; SHARED PHOTO PERSISTENCE WAITING FOR APPROVAL | `apps/web/tripsense`, `services/api-gateway`, `services/ai-service`, `services/place-service`, `services/trip-service`, `services/user-service` | [Docs](./ai-native-travel-platform-plan.md) |
| `chat-to-trip-handoff` | DONE | `apps/web/tripsense`, `services/api-gateway`, `services/trip-service` | [Docs](./chat-to-trip-handoff.md) |
| `logout-management` | DONE | `apps/web/tripsense`, `services/api-gateway`, `services/user-service` | [Docs](./logout-management/index.md) |
| `manage-trip-itinerary` | IMPLEMENTING | `apps/web/tripsense`, `services/api-gateway`, `services/trip-service`, `services/place-service`, `services/ai-service`, `services/user-service` | [Docs](./manage-trip-itinerary/index.md) |
| `places-maps-integration` | DONE | `apps/web/tripsense`, `services/api-gateway`, `services/place-service` | [Docs](./places-maps-integration/index.md) |
| `social-post-management` | DONE | `apps/web/tripsense`, `services/social-service`, `services/api-gateway`, `services/user-service` (profile snapshot) | [Docs](./social-post-management/index.md) |
| `trip-sharing` | IMPLEMENTING | `apps/web/tripsense`, `services/api-gateway`, `services/social-service`, `services/trip-service` | [Docs](./trip-sharing/index.md) |
| `trip-collaboration` | IMPLEMENTING | `apps/web/tripsense`, `services/api-gateway`, `services/trip-service` | [Docs](./trip-collaboration.md) |
| `community-experience-redesign` | IMPLEMENTING | `apps/web/tripsense`, `services/social-service`, `services/trip-service`, `services/api-gateway` | [Docs](./community-experience-redesign/index.md) |
| `community-discovery-rail` | APPROVED | `apps/web/tripsense`, `services/social-service`, `services/user-service`, `services/trip-service`, `services/api-gateway`; future `context-service` | [Docs](./community-discovery-rail/index.md) |
| `google-oauth-login` | DONE | `apps/web/tripsense`, `services/api-gateway`, `services/user-service` | [Docs](./google-oauth-login/index.md) |
| `ai-personalization-onboarding` | APPROVED | `apps/web/tripsense`, `services/user-service`, `services/place-service`, `services/context-service`, `services/ai-service`, `services/api-gateway` | [Docs](./ai-personalization-onboarding/index.md) |
| `user-chat` | DONE | `apps/web/tripsense`, `services/api-gateway`, `services/social-service`, `services/user-service` | [Docs](./user-chat.md) |
| `community-creator-discovery` | DONE | `services/social-service`, `services/user-service`, `apps/web/tripsense` | [Docs](./community-creator-discovery.md) |
| `community-trending-destinations` | DONE | `services/social-service`, `apps/web/tripsense`, `services/api-gateway` | [Docs](./community-trending-destinations.md) |
| `auth-token-cleanup-cronjob` | DONE | `services/user-service` | [Docs](./auth-token-cleanup-cronjob.md) |
| `community-destination-weather` | DONE | `services/social-service`, `apps/web/tripsense`, `services/api-gateway` | [Docs](./community-destination-weather.md) |
| `chat-notifications-and-unread-badge` | DONE | `services/social-service`, `apps/web/tripsense`, `services/api-gateway` | [Docs](./chat-notifications-and-unread-badge.md) |

## Statuses

- `DRAFT`: feature request captured but not reviewed.
- `WAITING_FOR_APPROVAL`: final single-file plan is ready in `docs/features/<feature-name>.md` and blocked on human approval.
- `APPROVED`: human approved the plan (`STATUS: APPROVED`).
- `IMPLEMENTING`: approved implementation is in progress.
- `DONE`: implementation, tests, review, and docs are complete.

## Template

- New features should use the unified single-file template: [docs/features/_template/feature-plan-template.md](./_template/feature-plan-template.md).

## Related

- [Feature Planning Workflow](../workflows/multi-agent-feature-workflow.md)
- [TripSense Architecture](../architecture/tripsense-architecture.md)
