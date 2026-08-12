# Implementation Plan

STATUS: IMPLEMENTING

Implementation may start only when this feature status is `APPROVED`.

## Tasks

1. Complete `services/discovery-server` as a Spring Boot Eureka server.
2. Configure discovery server:
   - `spring.application.name=discovery-server`
   - `server.port=8761`
   - disable self-registration and registry fetch.
3. Standardize API Gateway:
   - Maven artifact/name to `api-gateway`
   - `spring.application.name=api-gateway`
   - `server.port=8080`
   - Spring Cloud Gateway dependencies if missing
   - Eureka client dependencies if missing
   - route definitions for implemented services.
4. Standardize implemented domain services:
   - Maven artifact/name to kebab-case
   - `spring.application.name` to kebab-case
   - assign documented ports
   - add Eureka client dependency/configuration if missing.
5. Update service documentation and local startup notes.
6. Rebuild services to ensure generated resources align with source configuration.

## Verification

- Run Maven tests for every touched Spring service.
- Start discovery server and verify dashboard on `http://localhost:8761/`.
- Start Gateway and at least one domain service, then verify the service appears in Eureka.
- Verify Gateway route resolution through Eureka for one implemented service.

## Human Approval

Approved by user for implementation.
