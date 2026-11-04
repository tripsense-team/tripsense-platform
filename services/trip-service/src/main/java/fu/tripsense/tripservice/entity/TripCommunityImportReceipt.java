package fu.tripsense.tripservice.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.*;

@Entity
@Table(name = "trip_community_import_receipts")
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TripCommunityImportReceipt {
  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;

  @Column(name = "user_id", nullable = false)
  private UUID userId;

  @Column(name = "idempotency_key", nullable = false)
  private UUID idempotencyKey;

  @Column(name = "request_fingerprint", nullable = false, length = 64)
  private String requestFingerprint;

  @Column(name = "source_post_id", nullable = false)
  private UUID sourcePostId;

  @Column(name = "source_snapshot_sha256", nullable = false, length = 64)
  private String sourceSnapshotSha256;

  @Column(name = "destination_trip_id", nullable = false)
  private UUID destinationTripId;

  @Column(name = "imported_day_count", nullable = false)
  private int importedDayCount;

  @Column(name = "imported_item_count", nullable = false)
  private int importedItemCount;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;
}
