# Architecture & Product Decisions

1. **User Experience Choice**:
   - Instead of logging out immediately without asking, clicking "Log out" opens a clean confirmation modal giving the user 2 explicit choices:
     - "Log out of this device"
     - "Log out of all devices"
2. **Token Invalidation Strategy**:
   - Selected `token_version` increment strategy for `logout-all` because it provides instantaneous $O(1)$ revocation across all devices without needing distributed cache overhead (Redis) for basic MVP setup.
