package fu.tripsense.userservice.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "travel_preferences")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TravelPreference {
    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "personalization_enabled", nullable = false)
    private boolean personalizationEnabled;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    @Builder.Default
    private Map<String, Object> preferences = new HashMap<>();

    @Column(name = "consented_at")
    private Instant consentedAt;

    @Version
    private Long version;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void prePersist() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
        if (preferences == null) preferences = new HashMap<>();
    }

    @PreUpdate
    void preUpdate() { updatedAt = Instant.now(); }
}
