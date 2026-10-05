package fu.tripsense.placeservice.domain.model;

import java.time.Instant;
import java.util.UUID;
import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Version;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "user_place_collections")
@CompoundIndexes({
  @CompoundIndex(
      name = "uq_collection_owner_name",
      def = "{'ownerUserId': 1, 'normalizedName': 1}",
      unique = true),
  @CompoundIndex(
      name = "idx_collection_owner_updated",
      def = "{'ownerUserId': 1, 'updatedAt': -1}")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserPlaceCollection {
  @Id private UUID id;
  private UUID ownerUserId;
  private String name;
  private String normalizedName;
  @Version private Long version;
  private Instant createdAt;
  private Instant updatedAt;
}
