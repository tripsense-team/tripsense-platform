package fu.tripsense.recommendation.application;

import io.micrometer.core.instrument.MeterRegistry;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;

@Component
public class FeedbackRateLimiter {
  private static final DefaultRedisScript<Long> RESERVE =
      new DefaultRedisScript<>(
          """
          local current = tonumber(redis.call('GET', KEYS[1]) or '0')
          local requested = tonumber(ARGV[1])
          local limit = tonumber(ARGV[2])
          if current + requested > limit then
            return 0
          end
          redis.call('INCRBY', KEYS[1], requested)
          redis.call('EXPIRE', KEYS[1], 70)
          return 1
          """,
          Long.class);

  private final StringRedisTemplate redis;
  private final MeterRegistry meters;

  public FeedbackRateLimiter(StringRedisTemplate redis, MeterRegistry meters) {
    this.redis = redis;
    this.meters = meters;
  }

  public void reserve(UUID userId, int eventCount, int eventsPerMinute) {
    long minute = Instant.now().getEpochSecond() / 60;
    String key = "recommendation:feedback:rate:" + userId + ":" + minute;
    Long accepted =
        redis.execute(
            RESERVE,
            List.of(key),
            Integer.toString(eventCount),
            Integer.toString(eventsPerMinute));
    if (!Long.valueOf(1L).equals(accepted)) {
      meters.counter("tripsense.recommendation.feedback.rate_limit", "outcome", "rejected")
          .increment();
      throw new FeedbackRateLimitExceededException();
    }
    meters.counter("tripsense.recommendation.feedback.rate_limit", "outcome", "accepted")
        .increment(eventCount);
  }
}
