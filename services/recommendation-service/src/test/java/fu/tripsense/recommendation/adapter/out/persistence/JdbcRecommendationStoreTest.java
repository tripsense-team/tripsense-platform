package fu.tripsense.recommendation.adapter.out.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.Timestamp;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class JdbcRecommendationStoreTest {

  @Test
  void convertsInstantToJdbcTimestampForPostgresTimestamptzColumns() {
    Instant instant = Instant.parse("2026-09-25T04:11:12.260Z");

    Timestamp timestamp = JdbcRecommendationStore.sqlTimestamp(instant);

    assertThat(timestamp.toInstant()).isEqualTo(instant);
  }
}
