FROM maven:3.9-eclipse-temurin-17 AS builder

WORKDIR /app

COPY pom.xml .
COPY services/api-gateway/pom.xml services/api-gateway/pom.xml
COPY services/discovery-server/pom.xml services/discovery-server/pom.xml
COPY services/place-service/pom.xml services/place-service/pom.xml
RUN mvn -B -pl services/discovery-server -am dependency:go-offline

COPY services/discovery-server/src services/discovery-server/src
RUN mvn -B -pl services/discovery-server -am package -DskipTests

FROM eclipse-temurin:17-jre

WORKDIR /app

COPY --from=builder /app/services/discovery-server/target/*.jar app.jar

EXPOSE 8761

ENTRYPOINT ["java", "-jar", "app.jar"]
