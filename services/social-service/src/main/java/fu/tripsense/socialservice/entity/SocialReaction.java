package fu.tripsense.socialservice.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.*;

@Entity
@Table(
    name = "social_reactions",
    uniqueConstraints = {
      @UniqueConstraint(
          name = "uq_social_reactions",
          columnNames = {"user_id", "target_type", "target_id"})
    })
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SocialReaction {
  @Id private UUID id;

  @Column(name = "target_type", nullable = false, length = 16)
  private String targetType;

  @Column(name = "target_id", nullable = false)
  private UUID targetId;

  @Column(name = "user_id", nullable = false)
  private UUID userId;

  @Column(name = "reaction_type", nullable = false, length = 16)
  @Builder.Default
  private String reactionType = "LIKE";

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;
}
