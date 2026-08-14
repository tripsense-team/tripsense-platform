FROM maven:3.9-eclipse-temurin-17 AS builder

WORKDIR /app

COPY pom.xml .
COPY services/api-gateway/pom.xml services/api-gateway/pom.xml
COPY services/discovery-server/pom.xml services/discovery-server/pom.xml
COPY services/place-service/pom.xml services/place-service/pom.xml
RUN mvn -B -pl services/api-gateway -am dependency:go-offline

COPY services/api-gateway/src services/api-gateway/src
RUN mvn -B -pl services/api-gateway -am package -DskipTests

FROM eclipse-temurin:17-jre

WORKDIR /app

COPY --from=builder /app/services/api-gateway/target/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
