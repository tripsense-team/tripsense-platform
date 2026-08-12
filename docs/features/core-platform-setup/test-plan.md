# Test Plan

## Unit Tests

No new domain unit tests are required unless implementation changes existing application logic.

## Configuration Tests

- Verify each touched Spring application loads its context.
- Verify Gateway route configuration parses successfully.
- Verify Eureka server starts with self-registration disabled.

## Integration Tests

- Start Eureka, Gateway, and one domain service.
- Confirm the domain service registers with Eureka under its kebab-case name.
- Confirm Gateway can route to the service by `lb://` service ID.

## Manual Verification

- Visit `http://localhost:8761/` and confirm registered service names.
- Confirm Gateway listens on `http://localhost:8080/`.
- Confirm implemented services use the documented local ports.

## Regression Risks

- Existing scripts or IDE configs may still reference PascalCase names.
- Direct calls to previous service ports may fail after standardization.
- Gateway routes may need to match actual controller paths in each service.
