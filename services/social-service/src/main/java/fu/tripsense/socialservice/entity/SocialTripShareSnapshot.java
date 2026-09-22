package fu.tripsense.socialservice.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "social_trip_share_snapshots")
@IdClass(SocialTripShareSnapshotId.class)
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SocialTripShareSnapshot {
  @Id
  @Column(name = "post_id")
  private UUID postId;

  @Id
  @Column(name = "snapshot_version")
  private Integer snapshotVersion;

  @Column(name = "schema_version", nullable = false)
  private Short schemaVersion;

  @Column(name = "source_publication_revision", nullable = false)
  private Long sourcePublicationRevision;

  @Column(name = "payload_json", nullable = false, columnDefinition = "jsonb")
  @JdbcTypeCode(SqlTypes.JSON)
  private String payloadJson;

  @Column(name = "payload_sha256", nullable = false, length = 64)
  private String payloadSha256;

  @Column(name = "captured_at", nullable = false)
  private Instant capturedAt;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  @Column(name = "refresh_idempotency_key")
  private UUID refreshIdempotencyKey;
}
