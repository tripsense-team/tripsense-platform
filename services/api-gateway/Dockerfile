# Stage 1: Build stage
FROM maven:3.9-eclipse-temurin-21 AS builder

WORKDIR /build

COPY pom.xml ./pom.xml
COPY services/api-gateway ./services/api-gateway

WORKDIR /build/services/api-gateway
RUN mvn clean package -DskipTests -B

# Stage 2: Runtime stage
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

RUN addgroup -S tripsense && adduser -S tripsense -G tripsense

COPY --from=builder /build/services/api-gateway/target/*.jar app.jar

USER tripsense

EXPOSE 8080

ENTRYPOINT ["java", "-XX:+UseG1GC", "-XX:MaxRAMPercentage=75.0", "-jar", "app.jar"]
