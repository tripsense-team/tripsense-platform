package fu.tripsense.socialservice.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "social_moderation_audit")
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SocialModerationAudit {
  @Id private UUID id;

  @Column(name = "report_id", nullable = false)
  private UUID reportId;

  @Column(name = "moderator_id", nullable = false)
  private UUID moderatorId;

  @Column(nullable = false, length = 32)
  private String action;

  @Column(name = "target_type", nullable = false, length = 16)
  private String targetType;

  @Column(name = "target_id", nullable = false)
  private UUID targetId;

  @Column(length = 500)
  private String note;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;
}
