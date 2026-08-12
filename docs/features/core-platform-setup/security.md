# Security

## Authentication

No authentication behavior is introduced by this setup.

## Authorization

No authorization behavior is introduced by this setup.

## Ownership Validation

No domain ownership validation changes.

## Input Validation

No domain input validation changes.

## Secrets

No external credentials or secrets are required. Eureka URLs and local ports are non-secret configuration.

## Abuse Cases

- Eureka dashboard should be treated as local development infrastructure and not exposed publicly by deployment defaults.
- Gateway should remain the public ingress point; direct public exposure of domain service ports should be avoided outside local development.

## Trust Boundaries

Client traffic crosses into the backend through API Gateway. Discovery server and domain services are internal platform components.

## Security Decisions

- Do not add temporary credentials or disable future security controls in application code.
- Keep security implementation for identity/auth as a separate approved feature.
