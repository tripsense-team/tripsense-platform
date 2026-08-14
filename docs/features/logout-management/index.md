# Logout & Multi-Device Session Management

- **Status**: DONE
- **Feature Name**: logout-management
- **Affected Services**: `apps/web/tripsense`, `services/api-gateway`, `services/user-service`

## Overview

Provide users with flexible session termination options upon clicking "Log out":
1. **Log out of this device** (`POST /api/auth/logout`): Revokes the current device's refresh token and clears the HttpOnly cookie.
2. **Log out of all devices** (`POST /api/auth/logout-all`): Revokes all active refresh tokens/sessions across every device for the user and clears the HttpOnly cookie.

## Documentation Index

- [Requirements](./requirements.md)
- [Architecture](./architecture.md)
- [API Specifications](./api.md)
- [Data Model & Persistence](./data-model.md)
- [Security & Trust Boundaries](./security.md)
- [Decisions & Tradeoffs](./decisions.md)
- [Implementation Plan](./implementation-plan.md)
- [Test Plan](./test-plan.md)
