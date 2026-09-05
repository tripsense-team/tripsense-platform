package fu.tripsense.socialservice;

import io.github.cdimascio.dotenv.Dotenv;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

@SpringBootApplication
@EnableDiscoveryClient
public class SocialServiceApplication {
    public static void main(String[] args) {
        loadDotenv();
        SpringApplication.run(SocialServiceApplication.class, args);
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
