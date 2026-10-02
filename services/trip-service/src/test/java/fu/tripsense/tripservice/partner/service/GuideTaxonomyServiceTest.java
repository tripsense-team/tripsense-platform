package fu.tripsense.tripservice.partner.service;

import static org.assertj.core.api.Assertions.assertThat;

import fu.tripsense.tripservice.partner.dto.GuideTaxonomyDto;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class GuideTaxonomyServiceTest {

  private final GuideTaxonomyService taxonomyService = new GuideTaxonomyService();

  @Test
  @DisplayName("getTaxonomy: returns standard taxonomy with catalogVersion 1 and stable IDs")
  void getTaxonomy_success() {
    GuideTaxonomyDto taxonomy = taxonomyService.getTaxonomy();

    assertThat(taxonomy.catalogVersion()).isEqualTo(1);
    assertThat(taxonomy.areas()).isNotEmpty();
    assertThat(taxonomy.topics()).isNotEmpty();
    assertThat(taxonomy.skills()).isNotEmpty();
    assertThat(taxonomy.languages()).isNotEmpty();

    assertThat(taxonomy.areas()).anyMatch(a -> "HOI_AN".equals(a.id()));
    assertThat(taxonomy.topics()).anyMatch(t -> "FOOD_STREET".equals(t.id()));
    assertThat(taxonomy.skills()).anyMatch(s -> "HISTORICAL_KNOWLEDGE".equals(s.id()));
    assertThat(taxonomy.languages()).anyMatch(l -> "vi".equals(l.id()) && "en".equals(l.id()) == false);
  }
}
