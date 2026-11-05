package fu.tripsense.socialservice.entity;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.*;

@Entity
@Table(name = "social_post_saves")
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SocialPostSave {
  @EmbeddedId private SocialPostSaveId id;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;
}
