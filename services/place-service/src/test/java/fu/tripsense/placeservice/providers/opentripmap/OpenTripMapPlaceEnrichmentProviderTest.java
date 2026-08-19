package fu.tripsense.placeservice.providers.opentripmap;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class OpenTripMapPlaceEnrichmentProviderTest {

    @Test
    void normalizesVietnamesePlaceNamesForMatching() {
        assertThat(OpenTripMapPlaceEnrichmentProvider.normalizeName("Cau Rong - Da Nang"))
                .isEqualTo("cau rong da nang");
        assertThat(OpenTripMapPlaceEnrichmentProvider.normalizeName("Ca Phe 44"))
                .isEqualTo("ca phe 44");
    }

    @Test
    void exactNameScoresHigherThanPartialName() {
        double exact = OpenTripMapPlaceEnrichmentProvider.nameSimilarity("My Khe Beach", "My Khe Beach");
        double partial = OpenTripMapPlaceEnrichmentProvider.nameSimilarity("My Khe Beach", "My Khe Beach Villa");

        assertThat(exact).isGreaterThan(partial);
        assertThat(partial).isGreaterThan(0.8);
    }
}
