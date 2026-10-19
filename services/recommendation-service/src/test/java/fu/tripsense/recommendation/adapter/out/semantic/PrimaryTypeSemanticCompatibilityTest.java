package fu.tripsense.recommendation.adapter.out.semantic;

import static org.assertj.core.api.Assertions.assertThat;
import com.fasterxml.jackson.databind.ObjectMapper;
import fu.tripsense.recommendation.domain.PlaceSnapshot;
import org.junit.jupiter.api.Test;

class PrimaryTypeSemanticCompatibilityTest {
  @Test
  void classificationMetadataAloneDoesNotChangeEmbeddingDocumentHash() throws Exception {
    var json=new ObjectMapper().findAndRegisterModules();
    var typed=json.readValue("{\"id\":\"one\",\"name\":\"Cafe\",\"categories\":[\"cafe\",\"food\"],\"primaryType\":\"coffee_shop\"}",PlaceSnapshot.class);
    var legacy=json.readValue("{\"id\":\"one\",\"name\":\"Cafe\",\"categories\":[\"cafe\",\"food\"]}",PlaceSnapshot.class);
    var documents=new PlaceSemanticDocumentBuilder();
    assertThat(documents.build(typed).contentHash()).isEqualTo(documents.build(legacy).contentHash());
  }
}
