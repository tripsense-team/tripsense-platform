package fu.tripsense.contextservice.config;

import jakarta.annotation.PostConstruct;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("context.preferences-cache")
public class PreferenceCacheProperties {
  private boolean enabled = false;
  private String redisUrl = "redis://localhost:6381";
  private String keySecret = "";
  private Duration ttl = Duration.ofMinutes(10);
  private Duration commandTimeout = Duration.ofMillis(100);
  private Duration connectTimeout = Duration.ofMillis(800);
  private int maxLoads = 16;
  private int maxRequests = 64;
  private Duration admissionWait = Duration.ofMillis(25);
  private Duration followerWait = Duration.ofMillis(750);
  private Duration failureBackoff = Duration.ofSeconds(5);
  private int failureThreshold = 3;

  // Explicit accessors: never generate a toString containing the Redis URL or HMAC secret.
  public boolean isEnabled() {
    return enabled;
  }

  public void setEnabled(boolean value) {
    enabled = value;
  }

  public String getRedisUrl() {
    return redisUrl;
  }

  public void setRedisUrl(String value) {
    redisUrl = value;
  }

  public String getKeySecret() {
    return keySecret;
  }

  public void setKeySecret(String value) {
    keySecret = value;
  }

  public Duration getTtl() {
    return ttl;
  }

  public void setTtl(Duration value) {
    ttl = value;
  }

  public Duration getCommandTimeout() {
    return commandTimeout;
  }

  public void setCommandTimeout(Duration value) {
    commandTimeout = value;
  }

  public Duration getConnectTimeout() {
    return connectTimeout;
  }

  public void setConnectTimeout(Duration value) {
    connectTimeout = value;
  }

  public int getMaxLoads() {
    return maxLoads;
  }

  public void setMaxLoads(int value) {
    maxLoads = value;
  }

  public int getMaxRequests() {
    return maxRequests;
  }

  public void setMaxRequests(int value) {
    maxRequests = value;
  }

  public Duration getAdmissionWait() {
    return admissionWait;
  }

  public void setAdmissionWait(Duration value) {
    admissionWait = value;
  }

  public Duration getFollowerWait() {
    return followerWait;
  }

  public void setFollowerWait(Duration value) {
    followerWait = value;
  }

  public Duration getFailureBackoff() {
    return failureBackoff;
  }

  public void setFailureBackoff(Duration value) {
    failureBackoff = value;
  }

  public int getFailureThreshold() {
    return failureThreshold;
  }

  public void setFailureThreshold(int value) {
    failureThreshold = value;
  }

  @PostConstruct
  public void validate() {
    if (maxLoads < 1
        || maxLoads > 256
        || maxRequests < maxLoads
        || maxRequests > 1024
        || failureThreshold < 1
        || failureThreshold > 20)
      throw new IllegalArgumentException("Invalid cache capacity configuration");
    check(ttl, Duration.ofSeconds(1), Duration.ofHours(1));
    check(commandTimeout, Duration.ofMillis(10), Duration.ofSeconds(1));
    check(connectTimeout, Duration.ofMillis(10), Duration.ofSeconds(2));
    if (connectTimeout.compareTo(commandTimeout) < 0)
      throw new IllegalArgumentException(
          "Context cache activation budget must cover command budget");
    check(admissionWait, Duration.ZERO, Duration.ofMillis(100));
    check(followerWait, Duration.ofMillis(10), Duration.ofSeconds(2));
    check(failureBackoff, Duration.ofMillis(100), Duration.ofMinutes(1));
  }

  private static void check(Duration value, Duration min, Duration max) {
    if (value == null || value.compareTo(min) < 0 || value.compareTo(max) > 0)
      throw new IllegalArgumentException("Invalid cache timeout/TTL configuration");
  }
}
