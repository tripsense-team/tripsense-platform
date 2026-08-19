# Stage 1: Build stage
FROM maven:3.9-eclipse-temurin-21 AS builder

WORKDIR /app

# Copy root pom (parent)
COPY pom.xml ./pom.xml

# Copy mail-service pom
COPY services/mail-service/pom.xml ./services/mail-service/pom.xml

# Download dependencies
RUN mvn -f services/mail-service/pom.xml dependency:go-offline -B

# Copy source code
COPY services/mail-service/src ./services/mail-service/src

# Build mail-service
RUN mvn -f services/mail-service/pom.xml clean package -DskipTests


# Stage 2: Runtime stage
FROM eclipse-temurin:21-jre

WORKDIR /app

COPY --from=builder /app/services/mail-service/target/*.jar app.jar

EXPOSE 8082

ENTRYPOINT ["java", "-jar", "app.jar"]