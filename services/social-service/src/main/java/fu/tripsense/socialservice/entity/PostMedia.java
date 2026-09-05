package fu.tripsense.socialservice.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "social_post_media")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PostMedia {
    @Id private UUID id;
    @Column(name = "post_id", nullable = false) private UUID postId;
    @Column(name = "public_id", nullable = false) private String publicId;
    @Column(name = "secure_url", nullable = false) private String secureUrl;
    @Column(name = "resource_type", nullable = false) private String resourceType;
    private String format;
    private Integer width;
    private Integer height;
    @Column(name = "sort_order", nullable = false) private short sortOrder;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
}
