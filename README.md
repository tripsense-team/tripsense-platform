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

| Service | Port | Health |
| --- | --- | --- |
| discovery-server | 8761 | http://localhost:8761/actuator/health |
| api-gateway | 8080 | http://localhost:8080/actuator/health |
| place-service | 8082 | http://localhost:8082/actuator/health |

Production and CI/CD configuration must override network wiring through environment variables instead of editing YAML:

| Variable | Default |
| --- | --- |
| `SERVER_PORT` | service-specific local port |
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
