package fu.tripsense.socialservice.entity;

import jakarta.persistence.*;
import lombok.*;
import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;

@Entity @Table(name = "social_comment_likes") @Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class CommentLike {
    @EmbeddedId private CommentLikeId id;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    @Embeddable @Getter @Setter @NoArgsConstructor @AllArgsConstructor @EqualsAndHashCode
    public static class CommentLikeId implements Serializable { @Column(name = "comment_id") private UUID commentId; @Column(name = "user_id") private UUID userId; }
}
