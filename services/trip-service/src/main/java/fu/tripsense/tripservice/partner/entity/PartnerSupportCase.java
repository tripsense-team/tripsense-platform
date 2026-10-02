package fu.tripsense.tripservice.partner.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.*;

@Entity
@Table(name = "partner_support_case")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PartnerSupportCase {

  @Id private UUID id;

  @Column(name = "resource_type", nullable = false, length = 40)
  private String resourceType; // HOTEL_BOOKING, GUIDE_INQUIRY, GUIDE_PROMOTION, MANAGEMENT_CLAIM

  @Column(name = "resource_id", nullable = false)
  private UUID resourceId;

  @Column(name = "business_id")
  private UUID businessId;

  @Column(name = "reporter_id", nullable = false)
  private UUID reporterId;

  @Column(name = "category", nullable = false, length = 80)
  private String category;

  @Column(name = "reason", nullable = false, length = 2000)
  private String reason;

  @Column(name = "state", nullable = false, length = 30)
  @Builder.Default
  private String state = "OPEN"; // OPEN, IN_PROGRESS, RESOLVED, CLOSED

  @Column(name = "assigned_admin")
  private UUID assignedAdmin;

  @Column(name = "resolution_action", length = 50)
  private String resolutionAction;

  @Column(name = "resolution_note", length = 2000)
  private String resolutionNote;

  @Column(name = "resolved_at")
  private Instant resolvedAt;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  @PrePersist
  void prePersist() {
    if (id == null) id = UUID.randomUUID();
    Instant now = Instant.now();
    if (createdAt == null) createdAt = now;
    if (updatedAt == null) updatedAt = now;
  }

  @PreUpdate
  void preUpdate() {
    updatedAt = Instant.now();
  }
}
