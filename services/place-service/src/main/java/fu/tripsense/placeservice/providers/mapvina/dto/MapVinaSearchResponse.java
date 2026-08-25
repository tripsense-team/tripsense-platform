package fu.tripsense.placeservice.providers.mapvina.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class MapVinaSearchResponse {

    private String type;
    private List<Feature> features = new ArrayList<>();

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Feature {
        private String type;
        private Geometry geometry;
        private Properties properties;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Geometry {
        private String type;
        private List<Double> coordinates = new ArrayList<>(); // [lng, lat]
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Properties {
        private String id;
        private String gid;
        private String layer;
        private String name;
        private String label;
        private String housenumber;
        private String street;
        private String locality;
        private String county;
        private String region;
        private String country;
        private String postalcode;
        private Double confidence;
        private Double distance;
    }
}
