package fu.tripsense.userservice;

import io.github.cdimascio.dotenv.Dotenv;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import java.io.File;

@SpringBootApplication
public class UserServiceApplication {

    public static void main(String[] args) {
        loadDotenv();
        SpringApplication.run(UserServiceApplication.class, args);
    }

    private static void loadDotenv() {
        File envFile = findEnvFile();
        if (envFile != null) {
            Dotenv dotenv = Dotenv.configure()
                    .directory(envFile.getParent() != null ? envFile.getParent() : ".")
                    .filename(envFile.getName())
                    .ignoreIfMissing()
                    .load();
            dotenv.entries().forEach(entry -> {
                if (System.getProperty(entry.getKey()) == null && System.getenv(entry.getKey()) == null) {
                    System.setProperty(entry.getKey(), entry.getValue());
                }
            });
        }
    }

    private static File findEnvFile() {
        File[] candidates = new File[]{
                new File("../../env/.env"),
                new File("../env/.env"),
                new File("env/.env"),
                new File(".env")
        };
        for (File f : candidates) {
            if (f.exists()) return f;
        }
        return null;
    }
}
