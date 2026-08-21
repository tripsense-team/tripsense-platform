package fu.tripsense.placeservice.providers.mapvina.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class MapVinaAutocompleteResponse {

    private String status;
    private List<Prediction> predictions = new ArrayList<>();

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Prediction {
        @JsonProperty("place_id")
        private String placeId;

        private String description;
        private String name;

        @JsonProperty("formatted_address")
        private String formattedAddress;

        private String reference;

        @JsonProperty("structured_formatting")
        private StructuredFormatting structuredFormatting;

        private List<String> types = new ArrayList<>();
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
