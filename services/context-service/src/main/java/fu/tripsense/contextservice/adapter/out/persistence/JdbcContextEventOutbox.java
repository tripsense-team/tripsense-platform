package fu.tripsense.contextservice.adapter.out.persistence;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import fu.tripsense.contextservice.application.ContextEventOutbox;
import fu.tripsense.contextservice.domain.OnboardingProfile;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Stores the integration event in the same local transaction as the profile update. */
@Repository
public class JdbcContextEventOutbox implements ContextEventOutbox {
  private final JdbcTemplate jdbc;
  private final ObjectMapper objectMapper;

  public JdbcContextEventOutbox(JdbcTemplate jdbc, ObjectMapper objectMapper) {
    this.jdbc = jdbc;
    this.objectMapper = objectMapper;
  }

  @Override
  public void recordProfileChanged(OnboardingProfile profile) {
    try {
      String payload =
          objectMapper.writeValueAsString(
              Map.of(
                  "userId",
                  profile.userId(),
                  "profileVersion",
                  profile.version(),
                  "changedDimensions",
                  profile.selections().keySet()));
      jdbc.update(
          "INSERT INTO context_outbox (id, aggregate_id, event_type, payload, created_at) VALUES (?, ?, ?, CAST(? AS jsonb), ?)",
          UUID.randomUUID(),
          profile.id(),
          "PreferenceProfileChanged.v1",
          payload,
          java.sql.Timestamp.from(Instant.now()));
    } catch (JsonProcessingException exception) {
      throw new IllegalStateException("Cannot serialize context event", exception);
    }
  }
}
