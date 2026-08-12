package fu.tripsense.emailservice;

import io.github.cdimascio.dotenv.Dotenv;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import java.io.File;

@SpringBootApplication
public class EmailServiceApplication {

    public static void main(String[] args) {
        loadDotenv();
        SpringApplication.run(EmailServiceApplication.class, args);
    }

    private static void loadDotenv() {
        File envFile = new File(".env");
        if (envFile.exists()) {
            Dotenv dotenv = Dotenv.configure().ignoreIfMissing().load();
            dotenv.entries().forEach(entry -> {
                if (System.getProperty(entry.getKey()) == null) {
                    System.setProperty(entry.getKey(), entry.getValue());
                }
            });
        }
    }
}
