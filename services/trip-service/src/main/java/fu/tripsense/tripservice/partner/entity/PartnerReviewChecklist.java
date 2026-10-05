package fu.tripsense.tripservice.partner.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "partner_review_checklist")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PartnerReviewChecklist {

  @EmbeddedId private ChecklistId id;

  @Column(nullable = false, length = 30)
  private String kind;

  @Column(nullable = false, length = 50)
  @Builder.Default
  private String region = "GLOBAL";

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "items_json", nullable = false, columnDefinition = "jsonb")
  private List<Map<String, Object>> itemsJson;

  @Column(name = "effective_at", nullable = false)
  private Instant effectiveAt;

  @PrePersist
  void prePersist() {
    if (effectiveAt == null) effectiveAt = Instant.now();
  }
}
