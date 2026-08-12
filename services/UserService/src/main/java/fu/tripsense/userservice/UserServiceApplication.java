package fu.tripsense.userservice;

import io.github.cdimascio.dotenv.Dotenv;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class UserServiceApplication {

    public static void main(String[] args) {
        String envFilename = System.getProperty("env.file", System.getenv().getOrDefault("ENV_FILE", ".env"));
        Dotenv dotenv = Dotenv.configure()
                .filename(envFilename)
                .ignoreIfMissing()
                .load();
        dotenv.entries().forEach(entry -> {
            if (System.getProperty(entry.getKey()) == null && System.getenv(entry.getKey()) == null) {
                System.setProperty(entry.getKey(), entry.getValue());
            }
        });
        SpringApplication.run(UserServiceApplication.class, args);
    }
}
