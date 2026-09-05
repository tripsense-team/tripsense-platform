# tripsense-platform

## Core Platform Services

Start the local Spring platform in this order:

```powershell
cd services/discovery-server
.\mvnw.cmd spring-boot:run

cd ..\place-service
.\mvnw.cmd spring-boot:run

cd ..\api-gateway
.\mvnw.cmd spring-boot:run
```

Default local ports:

| Service | Port | Environment Variable | Health |
| --- | --- | --- | --- |
| discovery-server | 8761 | `DISCOVERY_SERVER_PORT` | http://localhost:8761/actuator/health |
| api-gateway | 8080 | `API_GATEWAY_PORT` | http://localhost:8080/actuator/health |
| user-service | 8081 | `USER_SERVICE_PORT` | http://localhost:8081/actuator/health |
| mail-service | 8082 | `MAIL_SERVICE_PORT` | http://localhost:8082/actuator/health |
| place-service | 8083 | `PLACE_SERVICE_PORT` | http://localhost:8083/actuator/health |
| trip-service | 8084 | `TRIP_SERVICE_PORT` | http://localhost:8084/actuator/health |

Production and local configuration can override ports and network wiring via `env/.env` or system environment variables:

| Variable | Default |
| --- | --- |
| `DISCOVERY_SERVER_PORT` | `8761` |
| `API_GATEWAY_PORT` | `8080` |
| `USER_SERVICE_PORT` | `8081` |
| `MAIL_SERVICE_PORT` | `8082` |
| `PLACE_SERVICE_PORT` | `8083` |
| `TRIP_SERVICE_PORT` | `8084` |
| `SERVER_PORT` | service fallback port |
| `EUREKA_DEFAULT_ZONE` | `http://localhost:8761/eureka/` |
| `EUREKA_PREFER_IP_ADDRESS` | `true` |

For container deployments, set `EUREKA_DEFAULT_ZONE` to the discovery service DNS name, for example `http://discovery-server:8761/eureka/`.

Run service tests independently:

```powershell
cd services/api-gateway
.\mvnw.cmd -f ..\..\pom.xml test

cd ..\discovery-server; .\mvnw.cmd test
cd ..\api-gateway; .\mvnw.cmd test
cd ..\place-service; .\mvnw.cmd test
```

The service test profile disables Eureka client discovery so CI does not require a running registry for context-load tests.

The root Maven parent owns shared Spring Boot and Spring Cloud versions. New Spring services should inherit from `fu.tripsense:tripsense-platform` with `../../pom.xml` as the relative parent and should be added to the root `<modules>` list.

## Local Docker Compose

Copy the shared environment template before starting the backend stack:

```powershell
Copy-Item env/.env.example env/.env
docker compose --env-file env/.env config
docker compose --env-file env/.env up --build
```

`env/.env` supplies shared Compose secrets and Gateway settings. It is ignored by Git. Service-local development may instead use `services/place-service/.env`, while Next.js uses `apps/web/tripsense/.env.local` and the AI service uses `services/ai-service/.env`.

`TRUSTED_PROXY_CIDRS` must list only the actual Next.js or reverse-proxy peers in front of Gateway. The loopback defaults are suitable when Next.js and Gateway run directly on the same host; container deployments must set the exact proxy address or subnet.
