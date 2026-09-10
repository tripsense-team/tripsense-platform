package fu.tripsense.socialservice.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "social_posts")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class SocialPost {
    @Id private UUID id;
    @Column(name = "author_id", nullable = false) private UUID authorId;
    @Column(name = "author_display_name", nullable = false) private String authorDisplayName;
    @Column(name = "author_email") private String authorEmail;
    @Column(name = "post_type", nullable = false) private String postType;
    @Column(name = "idempotency_key") private UUID idempotencyKey;
    @Column(nullable = false) private String content;
    @Column(name = "like_count", nullable = false) private int likeCount;
    @Column(name = "comment_count", nullable = false) private int commentCount;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;
    @Column(name = "deleted_at") private Instant deletedAt;
    @Column(name = "deleted_by_user_id") private UUID deletedByUserId;
}
