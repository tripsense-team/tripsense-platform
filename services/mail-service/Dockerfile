# Stage 1: Build stage
FROM maven:3.9-eclipse-temurin-21 AS builder

WORKDIR /build

COPY pom.xml ./pom.xml
COPY services/mail-service ./services/mail-service

WORKDIR /build/services/mail-service
RUN mvn clean package -DskipTests -B

# Stage 2: Runtime stage
FROM eclipse-temurin:21-jre

WORKDIR /app

RUN groupadd --system tripsense && useradd --system --gid tripsense tripsense

COPY --from=builder /build/services/mail-service/target/*.jar app.jar

USER tripsense

EXPOSE 8082

ENTRYPOINT ["java", "-jar", "app.jar"]
