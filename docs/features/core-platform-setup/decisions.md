# Decisions

## Final Decisions

- Use kebab-case Spring application names and Maven artifact names for TripSense services.
- Use `api-gateway` as the gateway service name.
- Use `discovery-server` as the Eureka service name.
- Use port `8080` for Gateway and `8761` for Eureka.
- Use ports `8081` through `8085` for currently implemented domain services.
- Configure implemented Spring services as Eureka clients.
- Configure Gateway routes with `lb://<service-name>` targets.

## Important Tradeoffs

- Renaming folders to kebab-case would make the source tree match the service names, but may create noisy file moves. This can be done during implementation if the user wants full naming consistency.
- Reserving ports for planned services helps future consistency, but application code should not be generated for those services until their own plans are approved.

## Rejected Alternatives

- Leave the incomplete discovery folder as documentation-only.
- Standardize only Gateway and discovery while leaving existing services with PascalCase names.
- Add all planned services now as empty Spring applications.
