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

RUN mvn -B -pl services/discovery-server -am dependency:go-offline

COPY services/discovery-server/src services/discovery-server/src

RUN mvn -B -pl services/discovery-server -am clean package -DskipTests


# Stage 2: Runtime
FROM eclipse-temurin:21-jre

WORKDIR /app

RUN apt-get update \
    && apt-get install -y curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /workspace/services/discovery-server/target/*.jar app.jar

EXPOSE 8761

ENTRYPOINT ["java", "-jar", "app.jar"]