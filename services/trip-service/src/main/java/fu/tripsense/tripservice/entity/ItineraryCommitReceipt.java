package fu.tripsense.tripservice.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "itinerary_commit_receipts", uniqueConstraints =
        @UniqueConstraint(name = "uq_itinerary_commit_owner_key", columnNames = {"owner_user_id", "idempotency_key"}))
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ItineraryCommitReceipt {
    @Id private UUID id;
    @Column(name = "owner_user_id", nullable = false) private UUID ownerUserId;
    @Column(name = "trip_id", nullable = false) private UUID tripId;
    @Column(name = "proposal_id", nullable = false, length = 36) private String proposalId;
    @Column(name = "proposal_hash", nullable = false, length = 64) private String proposalHash;
    @Column(name = "idempotency_key", nullable = false, length = 120) private String idempotencyKey;
    @Column(name = "request_hash", nullable = false, length = 64) private String requestHash;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "result_json", nullable = false, columnDefinition = "jsonb") private Map<String, Object> resultJson;
    @Column(name = "created_at", nullable = false) private Instant createdAt;

    @PrePersist void prePersist() {
        if (id == null) id = UUID.randomUUID();
        if (createdAt == null) createdAt = Instant.now();
    }
}
