package fu.tripsense.contextservice.config;

import io.lettuce.core.ClientOptions;
import io.lettuce.core.RedisURI;
import io.lettuce.core.SocketOptions;
import io.lettuce.core.SslOptions;
import io.lettuce.core.TimeoutOptions;
import io.lettuce.core.protocol.CommandType;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisPassword;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceClientConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;

@Configuration
@EnableConfigurationProperties(PreferenceCacheProperties.class)
public class PreferenceCacheConfig {
  @Bean
  public LettuceConnectionFactory contextCacheConnectionFactory(
      PreferenceCacheProperties properties) {
    RedisURI uri;
    java.net.URI raw;
    try {
      raw = java.net.URI.create(properties.getRedisUrl());
      if (!java.util.Set.of("redis", "rediss").contains(raw.getScheme()) || raw.getHost() == null)
        throw new IllegalArgumentException();
      uri = RedisURI.create(properties.getRedisUrl());
    } catch (RuntimeException invalid) {
      // Do not include the URL/cause: it can contain ACL credentials.
      throw new IllegalArgumentException("Invalid Context cache Redis endpoint");
    }
    var standalone = new RedisStandaloneConfiguration(uri.getHost(), uri.getPort());
    standalone.setDatabase(uri.getDatabase());
    if (raw.getRawUserInfo() != null) {
      String[] credentials = raw.getRawUserInfo().split(":", 2);
      if (credentials.length == 2) {
        standalone.setUsername(decode(credentials[0]));
        standalone.setPassword(RedisPassword.of(decode(credentials[1])));
      } else standalone.setPassword(RedisPassword.of(decode(credentials[0])));
    }
    var builder =
        LettuceClientConfiguration.builder()
            // Spring uses this for RedisURI/activation as well as synchronous await.
            // TimeoutOptions below still expire ordinary commands at the short budget.
            .commandTimeout(properties.getConnectTimeout())
            .shutdownTimeout(java.time.Duration.ofMillis(100))
            .clientOptions(
                ClientOptions.builder()
                    .autoReconnect(false)
                    .disconnectedBehavior(ClientOptions.DisconnectedBehavior.REJECT_COMMANDS)
                    .socketOptions(
                        SocketOptions.builder()
                            .connectTimeout(properties.getConnectTimeout())
                            .build())
                    .sslOptions(
                        SslOptions.builder()
                            .handshakeTimeout(properties.getConnectTimeout())
                            .build())
                    .timeoutOptions(commandTimeouts(properties))
                    .build());
    if (uri.isSsl()) builder.useSsl();
    var factory = new LettuceConnectionFactory(standalone, builder.build());
    factory.setEagerInitialization(false);
    factory.setValidateConnection(false);
    return factory;
  }

  static TimeoutOptions commandTimeouts(PreferenceCacheProperties properties) {
    return TimeoutOptions.builder()
        .timeoutCommands()
        .timeoutSource(
            new TimeoutOptions.TimeoutSource() {
              @Override
              public long getTimeout(io.lettuce.core.protocol.RedisCommand<?, ?, ?> command) {
                var type = command.getType();
                boolean activation =
                    type == CommandType.HELLO
                        || type == CommandType.AUTH
                        || type == CommandType.AUTH2
                        || type == CommandType.SELECT
                        || type == CommandType.CLIENT
                        || type == CommandType.PING;
                return (activation
                        ? properties.getConnectTimeout()
                        : properties.getCommandTimeout())
                    .toMillis();
              }

              @Override
              public java.util.concurrent.TimeUnit getTimeUnit() {
                return java.util.concurrent.TimeUnit.MILLISECONDS;
              }
            })
        .build();
  }

  private static String decode(String value) {
    return java.net.URLDecoder.decode(
        value.replace("+", "%2B"), java.nio.charset.StandardCharsets.UTF_8);
  }

  @Bean
  StringRedisTemplate contextCacheRedisTemplate(
      LettuceConnectionFactory contextCacheConnectionFactory) {
    return new StringRedisTemplate(contextCacheConnectionFactory);
  }
}
