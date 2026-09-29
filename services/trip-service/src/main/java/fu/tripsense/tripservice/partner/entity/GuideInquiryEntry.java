package fu.tripsense.tripservice.partner.entity;

import fu.tripsense.tripservice.partner.enums.GuideInquiryEntryKind;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "guide_inquiry_entry")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GuideInquiryEntry {

  @Id private UUID id;

  @Column(name = "inquiry_id", nullable = false)
  private UUID inquiryId;

  @Column(name = "seq", nullable = false)
  private Integer seq;

  @Column(name = "actor_id", nullable = false)
  private UUID actorId;

  @Column(name = "role_snapshot", nullable = false, length = 30)
  private String roleSnapshot;

  @Enumerated(EnumType.STRING)
  @Column(name = "kind", nullable = false, length = 30)
  private GuideInquiryEntryKind kind;

  @Column(name = "body", length = 2000)
  private String body;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "payload", columnDefinition = "jsonb")
  private String payload;

  @Column(name = "created_at", nullable = false, updatable = false)
  @Builder.Default
  private Instant createdAt = Instant.now();
}
