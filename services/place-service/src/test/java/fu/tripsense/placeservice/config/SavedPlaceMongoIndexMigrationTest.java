package fu.tripsense.placeservice.config;

import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.IndexDefinition;
import org.springframework.data.mongodb.core.index.IndexOperations;

@ExtendWith(MockitoExtension.class)
class SavedPlaceMongoIndexMigrationTest {
  @Mock private MongoTemplate mongoTemplate;
  @Mock private IndexOperations collectionIndexes;
  @Mock private IndexOperations savedPlaceIndexes;

  @Test
  void installsAllSavedPlaceIndexesExplicitly() {
    when(mongoTemplate.indexOps("user_place_collections")).thenReturn(collectionIndexes);
    when(mongoTemplate.indexOps("user_saved_places")).thenReturn(savedPlaceIndexes);

    new SavedPlaceMongoIndexMigration(mongoTemplate).ensureIndexes();

    verify(collectionIndexes, times(2))
        .createIndex(org.mockito.ArgumentMatchers.any(IndexDefinition.class));
    verify(savedPlaceIndexes, times(3))
        .createIndex(org.mockito.ArgumentMatchers.any(IndexDefinition.class));
  }
}
