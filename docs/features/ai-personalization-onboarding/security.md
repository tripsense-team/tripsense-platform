# Security

- Derive the user only from the validated JWT; no body field may select another user's profile.
- Enforce ownership on every read/write/delete/export. Treat unknown users and cross-user IDs as privacy-safe `404` where relevant.
- Dietary/religious information, home/work locations and free text are sensitive: minimize collection, show a purpose-specific consent, encrypt sensitive text/location at rest, redact logs and exclude from Community/advertising.
- Never store Google Calendar tokens, voice preferences, recordings or transcripts in onboarding. Later OAuth/speech integrations use separate consent, least-privilege scopes, revocation and backend-side encrypted tokens.
- AI receives purpose-limited derived signals. It cannot call User/Context databases or alter a signal without an auditable user action.
- Rate-limit writes, enforce payload size/enum allowlists, sanitize rendered free text, protect version conflicts, and audit export/delete/consent changes.
- The browser must fail closed for a gate-eligible account if it cannot read the onboarding lifecycle; it must not use local storage, client route history, or an untrusted body value as completion evidence. Completion acknowledgement is derived from the authenticated Context status only.
