package fu.tripsense.recommendation.config;

import jakarta.validation.constraints.*;
import java.time.Duration;
import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.validation.annotation.Validated;

@Data
@Component
@Validated
@ConfigurationProperties(prefix = "tripsense.recommendation.sections")
public class SectionFeedProperties {
  @Min(4)
  @Max(20)
  private int previewCandidatesPerCategory = 12;

  private Duration retrievalTimeout = Duration.ofSeconds(2);
  private Duration seedTtl = Duration.ofMinutes(5);

  @Min(1)
  @Max(100)
  private int seedMaxIds = 100;

  @Min(1024)
  @Max(65536)
  private int seedMaxBytes = 65536;

  @AssertTrue
  public boolean isValidDurations() {
    return retrievalTimeout != null
        && !retrievalTimeout.isNegative()
        && !retrievalTimeout.isZero()
        && retrievalTimeout.compareTo(Duration.ofSeconds(10)) <= 0
        && seedTtl != null
        && !seedTtl.isNegative()
        && !seedTtl.isZero()
        && seedTtl.compareTo(Duration.ofMinutes(5)) <= 0;
  }
}
