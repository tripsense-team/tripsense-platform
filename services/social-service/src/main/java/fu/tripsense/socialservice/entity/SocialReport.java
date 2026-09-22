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
import lombok.Setter;

@Entity
@Table(name = "social_reports")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SocialReport {
  @Id private UUID id;

  @Column(name = "target_type", nullable = false, length = 16)
  private String targetType;

  @Column(name = "target_id", nullable = false)
  private UUID targetId;

  @Column(name = "post_id", nullable = false)
  private UUID postId;

  @Column(name = "reporter_id", nullable = false)
  private UUID reporterId;

  @Column(nullable = false, length = 32)
  private String reason;

  @Column(length = 500)
  private String details;

  @Column(nullable = false, length = 24)
  private String status;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  @Column(name = "reviewed_at")
  private Instant reviewedAt;

  @Column(name = "reviewed_by")
  private UUID reviewedBy;

  @Column(name = "moderator_note", length = 500)
  private String moderatorNote;
}
