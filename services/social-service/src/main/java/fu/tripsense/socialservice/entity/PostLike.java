package fu.tripsense.socialservice.entity;

import jakarta.persistence.*;
import lombok.*;
import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;

@Entity @Table(name = "social_post_likes") @Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class PostLike {
    @EmbeddedId private PostLikeId id;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    @Embeddable @Getter @Setter @NoArgsConstructor @AllArgsConstructor @EqualsAndHashCode
    public static class PostLikeId implements Serializable { @Column(name = "post_id") private UUID postId; @Column(name = "user_id") private UUID userId; }
}
