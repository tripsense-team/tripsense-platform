package fu.tripsense.tripservice.partner.entity;

import fu.tripsense.tripservice.partner.enums.DocumentScanState;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.*;

@Entity
@Table(name = "partner_document")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PartnerDocument {

  @Id private UUID id;

  @Column(name = "business_id")
  private UUID businessId;

  @Column(name = "claim_id")
  private UUID claimId;

  @Column(name = "uploaded_by", nullable = false)
  private UUID uploadedBy;

  @Column(name = "object_key", nullable = false)
  private String objectKey;

  @Column(name = "file_version", length = 100)
  private String objectVersion;

  @Column(name = "file_hash", length = 128)
  private String contentHash;

  @Column(name = "file_name", nullable = false)
  private String fileName;

  @Column(name = "content_type", nullable = false, length = 100)
  private String mimeType;

  @Column(name = "size_bytes", nullable = false)
  private Long fileSizeBytes;

  @Enumerated(EnumType.STRING)
  @Column(name = "scan_state", nullable = false, length = 30)
  @Builder.Default
  private DocumentScanState scanState = DocumentScanState.PENDING;

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
