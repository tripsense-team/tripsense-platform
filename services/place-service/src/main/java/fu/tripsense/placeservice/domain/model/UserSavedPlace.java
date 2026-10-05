package fu.tripsense.placeservice.domain.model;

import java.time.Instant;
import java.util.UUID;
import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "user_saved_places")
@CompoundIndexes({
  @CompoundIndex(
      name = "uq_saved_owner_collection_place",
      def = "{'ownerUserId': 1, 'collectionId': 1, 'placeRef': 1}",
      unique = true),
  @CompoundIndex(name = "idx_saved_owner_place", def = "{'ownerUserId': 1, 'placeRef': 1}"),
  @CompoundIndex(
      name = "idx_saved_owner_saved_at",
      def = "{'ownerUserId': 1, 'savedAt': -1}")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserSavedPlace {
  @Id private UUID id;
  private UUID ownerUserId;
  private UUID collectionId;
  private String placeRef;
  private Instant savedAt;
}
