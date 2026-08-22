# Stage 1: Build
FROM maven:3.9-eclipse-temurin-21 AS builder

WORKDIR /workspace

COPY pom.xml .

COPY services/api-gateway/pom.xml services/api-gateway/pom.xml
COPY services/discovery-server/pom.xml services/discovery-server/pom.xml
COPY services/place-service/pom.xml services/place-service/pom.xml
COPY services/user-service/pom.xml services/user-service/pom.xml
COPY services/mail-service/pom.xml services/mail-service/pom.xml
COPY services/trip-service/pom.xml services/trip-service/pom.xml

RUN mvn -B -pl services/trip-service -am dependency:go-offline

COPY services/trip-service/src services/trip-service/src

RUN mvn -B -pl services/trip-service -am clean package -DskipTests

# Stage 2: Runtime
FROM eclipse-temurin:21-jre

WORKDIR /app

COPY --from=builder /workspace/services/trip-service/target/*.jar app.jar

EXPOSE 8084

ENTRYPOINT ["java", "-jar", "app.jar"]