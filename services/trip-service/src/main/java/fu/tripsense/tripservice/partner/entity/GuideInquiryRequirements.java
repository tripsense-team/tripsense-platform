package fu.tripsense.tripservice.partner.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "guide_inquiry_requirements")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GuideInquiryRequirements {

  @EmbeddedId private GuideInquiryRequirementsId id;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "data", nullable = false, columnDefinition = "jsonb")
  private String data;

  @Column(name = "created_by", nullable = false)
  private UUID createdBy;

  @Column(name = "created_at", nullable = false, updatable = false)
  @Builder.Default
  private Instant createdAt = Instant.now();
}
