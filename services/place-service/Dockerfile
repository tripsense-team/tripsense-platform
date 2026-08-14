# Stage 1: Build stage
FROM maven:3.9-eclipse-temurin-21 AS builder

WORKDIR /workspace

COPY pom.xml .
COPY services/api-gateway/pom.xml services/api-gateway/pom.xml
COPY services/discovery-server/pom.xml services/discovery-server/pom.xml
COPY services/place-service/pom.xml services/place-service/pom.xml
COPY services/UserService/pom.xml services/UserService/pom.xml
COPY services/EmailService/pom.xml services/EmailService/pom.xml

RUN mvn -B -pl services/place-service -am dependency:go-offline

COPY services/place-service/src services/place-service/src
RUN mvn -B -pl services/place-service -am clean package -DskipTests

# Stage 2: Runtime stage
FROM eclipse-temurin:21-jre

WORKDIR /app

COPY --from=builder /workspace/services/place-service/target/*.jar app.jar

EXPOSE 8082

ENTRYPOINT ["java", "-jar", "app.jar"]
