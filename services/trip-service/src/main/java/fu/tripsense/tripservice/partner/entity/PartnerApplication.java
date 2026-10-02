package fu.tripsense.tripservice.partner.entity;

import fu.tripsense.tripservice.partner.enums.ApplicationState;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "partner_application")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PartnerApplication {

  @Id private UUID id;

  @Column(name = "business_id", nullable = false)
  private UUID businessId;

  @Column(nullable = false)
  private Integer revision;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "profile_snapshot", nullable = false, columnDefinition = "jsonb")
  private Map<String, Object> profileSnapshot;

  @Column(name = "checklist_id", length = 100)
  private String checklistId;

  @Column(name = "checklist_version", length = 50)
  private String checklistVersion;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "requested_capabilities", nullable = false, columnDefinition = "jsonb")
  private List<String> requestedCapabilities;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 30)
  @Builder.Default
  private ApplicationState state = ApplicationState.SUBMITTED;

  @Column(name = "is_reverification", nullable = false)
  @Builder.Default
  private boolean isReverification = false;

  @Version
  @Column(nullable = false)
  @Builder.Default
  private Long version = 0L;

  @Column(name = "submitted_at", nullable = false)
  private Instant submittedAt;

  @Column(name = "decided_at")
  private Instant decidedAt;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  @PrePersist
  void prePersist() {
    if (id == null) id = UUID.randomUUID();
    Instant now = Instant.now();
    if (submittedAt == null) submittedAt = now;
    if (createdAt == null) createdAt = now;
    if (updatedAt == null) updatedAt = now;
  }

  @PreUpdate
  void preUpdate() {
    updatedAt = Instant.now();
  }
}
