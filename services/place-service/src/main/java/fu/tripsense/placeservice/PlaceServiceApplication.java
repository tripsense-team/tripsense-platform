package fu.tripsense.placeservice;

import io.github.cdimascio.dotenv.Dotenv;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.mongodb.config.EnableMongoAuditing;

@SpringBootApplication
@EnableMongoAuditing
public class PlaceServiceApplication {

    public static void main(String[] args) {
        loadDotenv();
        SpringApplication.run(PlaceServiceApplication.class, args);
    }

    private static void loadDotenv() {
        String[] possibleDirectories = {"../../env", "../env", "env", "./"};
        for (String dir : possibleDirectories) {
            Dotenv dotenv = Dotenv.configure()
                    .directory(dir)
                    .ignoreIfMissing()
                    .load();

            dotenv.entries().forEach(entry -> {
                if (System.getProperty(entry.getKey()) == null && System.getenv(entry.getKey()) == null) {
                    System.setProperty(entry.getKey(), entry.getValue());
                }
            });
        }
    }
}
