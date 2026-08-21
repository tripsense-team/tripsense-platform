# Stage 1: Build stage
FROM maven:3.9-eclipse-temurin-21 AS builder

WORKDIR /build

COPY pom.xml ./pom.xml
COPY services/discovery-server ./services/discovery-server

WORKDIR /build/services/discovery-server
RUN mvn clean package -DskipTests -B

# Stage 2: Runtime stage
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

RUN addgroup -S tripsense && adduser -S tripsense -G tripsense

COPY --from=builder /build/services/discovery-server/target/*.jar app.jar

USER tripsense

EXPOSE 8761

ENTRYPOINT ["java", "-XX:+UseG1GC", "-XX:MaxRAMPercentage=75.0", "-jar", "app.jar"]
