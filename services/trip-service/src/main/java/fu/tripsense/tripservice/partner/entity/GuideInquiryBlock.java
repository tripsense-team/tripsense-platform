package fu.tripsense.tripservice.partner.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.*;

@Entity
@Table(name = "guide_inquiry_block")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GuideInquiryBlock {

  @EmbeddedId private GuideInquiryBlockId id;

  @Column(name = "actor_id", nullable = false)
  private UUID actorId;

  @Column(name = "reason", length = 500)
  private String reason;

  @Column(name = "is_active", nullable = false)
  @Builder.Default
  private boolean isActive = true;

  @Column(name = "created_at", nullable = false, updatable = false)
  @Builder.Default
  private Instant createdAt = Instant.now();

  @Column(name = "updated_at", nullable = false)
  @Builder.Default
  private Instant updatedAt = Instant.now();

  @PreUpdate
  public void preUpdate() {
    this.updatedAt = Instant.now();
  }
}
