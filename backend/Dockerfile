FROM eclipse-temurin:26-jre

# sets the working directory inside the backend container
WORKDIR /app

# copies the built spring boot jar into the container
COPY target/backend-0.0.1-SNAPSHOT.jar app.jar

# exposes the port used by the spring boot application
EXPOSE 8080

# starts the backend application when the container runs
ENTRYPOINT ["java", "-jar", "app.jar"]