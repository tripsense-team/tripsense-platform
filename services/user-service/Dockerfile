# Stage 1: Build stage
FROM maven:3.9-eclipse-temurin-21 AS builder

WORKDIR /app

# Copy root parent POM
COPY pom.xml ./pom.xml

# Copy user-service POM
COPY services/user-service/pom.xml ./services/user-service/pom.xml

# Download dependencies
RUN mvn -f services/user-service/pom.xml dependency:go-offline -B

# Copy source code
COPY services/user-service/src ./services/user-service/src

# Build application
RUN mvn -f services/user-service/pom.xml clean package -DskipTests


# Stage 2: Runtime stage
FROM eclipse-temurin:21-jre

WORKDIR /app

COPY --from=builder /app/services/user-service/target/*.jar app.jar

EXPOSE 8081

ENTRYPOINT ["java", "-jar", "app.jar"]