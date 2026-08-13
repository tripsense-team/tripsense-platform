package fu.tripsense.emailservice;

import io.github.cdimascio.dotenv.Dotenv;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class EmailServiceApplication {

    public static void main(String[] args) {
        loadDotenv();
        SpringApplication.run(EmailServiceApplication.class, args);
    }

    private static void loadDotenv() {
        Dotenv dotenv = Dotenv.configure()
                .directory("../../env")
                .filename(".env")
                .ignoreIfMissing()
                .load();

        dotenv.entries().forEach(entry -> {
            if (System.getProperty(entry.getKey()) == null) {
                System.setProperty(entry.getKey(), entry.getValue());
            }
        });
    }
}
