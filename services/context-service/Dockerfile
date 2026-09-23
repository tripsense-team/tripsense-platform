FROM maven:3.9-eclipse-temurin-21 AS builder
WORKDIR /workspace
COPY pom.xml .
COPY services/api-gateway/pom.xml services/api-gateway/pom.xml
COPY services/discovery-server/pom.xml services/discovery-server/pom.xml
COPY services/place-service/pom.xml services/place-service/pom.xml
COPY services/user-service/pom.xml services/user-service/pom.xml
COPY services/mail-service/pom.xml services/mail-service/pom.xml
COPY services/trip-service/pom.xml services/trip-service/pom.xml
COPY services/social-service/pom.xml services/social-service/pom.xml
COPY services/context-service/pom.xml services/context-service/pom.xml
RUN --mount=type=cache,target=/root/.m2 mvn -B -pl services/context-service -am dependency:go-offline
COPY services/context-service/src services/context-service/src
RUN --mount=type=cache,target=/root/.m2 mvn -B -pl services/context-service -am package -DskipTests

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=builder /workspace/services/context-service/target/*.jar app.jar
EXPOSE 8087
ENTRYPOINT ["java", "-jar", "app.jar"]
