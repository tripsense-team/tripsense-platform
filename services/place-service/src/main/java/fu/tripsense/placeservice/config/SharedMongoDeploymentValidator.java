package fu.tripsense.placeservice.config;

import java.util.Arrays;
import java.util.Set;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

/** Prevents an accidental process-local Mongo target in shared server environments. */
@Component
public class SharedMongoDeploymentValidator implements ApplicationRunner {
  private static final Set<String> SHARED_PROFILES = Set.of("staging", "stage", "production", "prod");
  private final Environment environment;

  public SharedMongoDeploymentValidator(Environment environment) {
    this.environment = environment;
  }

  @Override
  public void run(ApplicationArguments args) {
    boolean shared = Arrays.stream(environment.getActiveProfiles())
        .map(String::toLowerCase).anyMatch(SHARED_PROFILES::contains);
    if (!shared) return;
    String raw = environment.getProperty("MONGODB_URI");
    if (raw == null || raw.isBlank()) {
      throw new IllegalStateException("MONGODB_URI must be explicitly configured for a shared environment");
    }
    try {
      int scheme = raw.indexOf("://");
      if (scheme < 0) throw new IllegalArgumentException();
      String authority = raw.substring(scheme + 3).split("/", 2)[0];
      int credentials = authority.lastIndexOf('@');
      if (credentials >= 0) authority = authority.substring(credentials + 1);
      String[] hosts = authority.split(",");
      if (hosts.length == 0) throw new IllegalArgumentException();
      for (String value : hosts) {
        String host = value.trim();
        if (host.startsWith("[")) host = host.substring(1, host.indexOf(']'));
        else if (host.contains(":")) host = host.substring(0, host.lastIndexOf(':'));
        if (host.isBlank() || Set.of("localhost", "127.0.0.1", "::1").contains(host.toLowerCase())) {
          throw new IllegalStateException("MONGODB_URI must target shared infrastructure, not localhost");
        }
      }
    } catch (RuntimeException invalid) {
      if (invalid instanceof IllegalStateException state) throw state;
      throw new IllegalStateException("MONGODB_URI is invalid for a shared environment");
    }
  }
}
