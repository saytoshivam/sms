# Start with a base image that has JDK installed (Debian-based)
FROM amazoncorretto:21

# Set the working directory inside the container
WORKDIR /app

# Copy the build.gradle and settings.gradle files
COPY build.gradle settings.gradle /app/

# Copy the gradle wrapper and give execution permissions
COPY gradlew /app/
COPY gradle /app/gradle
RUN chmod +x ./gradlew

# Download all dependencies (allows caching this layer)
RUN ./gradlew dependencies --no-daemon

# Copy the source code
COPY . /app

# Build the Spring Boot application
RUN ./gradlew bootJar --no-daemon

# Expose the port the app runs on
EXPOSE 8080

# Run the Spring Boot application
ENTRYPOINT ["java", "-jar", "/app/build/libs/sms-0.0.1-SNAPSHOT.jar"]
