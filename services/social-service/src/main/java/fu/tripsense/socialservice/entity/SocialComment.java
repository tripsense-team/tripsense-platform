package fu.tripsense.socialservice.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

@Entity @Table(name = "social_comments") @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class SocialComment {
    @Id private UUID id;
    @Column(name = "post_id", nullable = false) private UUID postId;
    @Column(name = "parent_comment_id") private UUID parentCommentId;
    @Column(name = "author_id", nullable = false) private UUID authorId;
    @Column(name = "author_display_name", nullable = false) private String authorDisplayName;
    @Column(name = "author_email") private String authorEmail;
    @Column(nullable = false) private String content;
    @Column(name = "like_count", nullable = false) private int likeCount;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;
    @Column(name = "deleted_at") private Instant deletedAt;
    @Column(name = "deleted_by_user_id") private UUID deletedByUserId;
}
