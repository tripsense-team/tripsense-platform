package fu.tripsense.placeservice.providers.ziomap.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class ZioMapAutocompleteResponse {

    private List<ZioMapAutocompletePrediction> predictions = new ArrayList<>();

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ZioMapAutocompletePrediction {
        private String description;

        @JsonProperty("place_id")
        private String placeId;

        private List<String> types = new ArrayList<>();

        @JsonProperty("structured_formatting")
        private StructuredFormatting structuredFormatting;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class StructuredFormatting {
        @JsonProperty("main_text")
        private String mainText;

        @JsonProperty("secondary_text")
        private String secondaryText;
    }
}
