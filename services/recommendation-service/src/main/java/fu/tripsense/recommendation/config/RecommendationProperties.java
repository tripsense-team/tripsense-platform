package fu.tripsense.recommendation.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import java.time.Duration;
import java.util.EnumMap;
import java.util.Map;
import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Data
@Validated
@ConfigurationProperties(prefix = "tripsense.recommendation")
public class RecommendationProperties {
  @Valid private Retrieval retrieval = new Retrieval();
  @Valid private Features features = new Features();
  @Valid private Ranking ranking = new Ranking();
  @Valid private Diversity diversity = new Diversity();
  @Valid private Profile profile = new Profile();
  @Valid private Downstream downstream = new Downstream();
  @Valid private Semantic semantic = new Semantic();
  @Valid private Feedback feedback = new Feedback();
  @Valid private Versions versions = new Versions();

  @Data
  public static class Retrieval {
    @Min(1)
    private int sourceLimit = 50;

    @Min(1)
    private int rrfK = 60;

    @Min(1)
    private int candidateMultiplier = 3;

    private Duration maximumPlaceAge = Duration.ofDays(30);
  }

  @Data
  public static class Features {
    @DecimalMin("0.1")
    private double distanceTauKm = 5.0;

    @DecimalMin("0.0")
    @DecimalMax("5.0")
    private double priorRating = 4.0;

    @DecimalMin("0.1")
    private double ratingConfidenceThreshold = 20.0;
  }

  @Data
  public static class Ranking {
    @DecimalMin("0.000001")
    private double rrfNormalizationPivot = 0.01;

    private double retrievalWeight = 0.20;
    private double semanticWeight = 0.15;
    private double preferenceWeight = 0.20;
    private double geographicWeight = 0.15;
    private double qualityWeight = 0.15;
    private double quietnessWeight = 0.15;
    private double contextWeight = 0.10;
    private double popularityWeight = 0.05;
    private double historyWeight = 0.05;
    private double dislikeConflictPenalty = 0.50;
    private double negativeFeedbackPenalty = 0.40;
  }

  @Data
  public static class Diversity {
    private boolean enabled = true;

    @DecimalMin("0.0")
    @DecimalMax("1.0")
    private double lambda = 0.75;
  }

  @Data
  public static class Profile {
    @DecimalMin("0.0")
    private double temporalDecayLambda = 0.01;

    private double longTermWeight = 0.50;
    private double tripWeight = 0.30;
    private double sessionWeight = 0.20;
    private Map<Interaction, Double> interactionWeights = defaultInteractionWeights();

    private static Map<Interaction, Double> defaultInteractionWeights() {
      Map<Interaction, Double> values = new EnumMap<>(Interaction.class);
      values.put(Interaction.VIEW, 0.10);
      values.put(Interaction.CLICK, 0.30);
      values.put(Interaction.DETAIL_VIEW, 0.40);
      values.put(Interaction.LIKE, 0.80);
      values.put(Interaction.SAVE, 1.00);
      values.put(Interaction.ADD_TO_TRIP, 1.50);
      values.put(Interaction.DISMISS, -0.60);
      values.put(Interaction.DISLIKE, -1.00);
      return values;
    }
  }

  public enum Interaction {
    VIEW,
    CLICK,
    DETAIL_VIEW,
    LIKE,
    SAVE,
    ADD_TO_TRIP,
    DISMISS,
    DISLIKE
  }

  @Data
  public static class Downstream {
    @NotBlank private String placeUrl = "http://place-service:8082";
    @NotBlank private String contextUrl = "http://context-service:8087";
    @NotBlank private String tripUrl = "http://trip-service:8084";
    @NotBlank private String userUrl = "http://user-service:8081";
    private Duration timeout = Duration.ofSeconds(12);
  }

  @Data
  public static class Semantic {
    private boolean enabled = false;
    private String embeddingBaseUrl = "";
    private String embeddingApiKey = "";
    private String embeddingModel = "text-embedding-3-small";
    private String qdrantUrl = "http://qdrant:6333";
    private String qdrantApiKey = "";
    private String collection = "tripsense_places";
    private Duration cacheTtl = Duration.ofDays(7);
  }

  @Data
  public static class Feedback {
    private Duration maxClockSkew = Duration.ofMinutes(10);

    @Min(1)
    private int maxHistoryEvents = 5000;
  }

  @Data
  public static class Versions {
    private String retrieval = "place-retrieval-v2";
    private String fusion = "rrf-v1";
    private String embedding = "none";
    private String feature = "features-v2-availability-aware";
    private String ranking = "heuristic-v2-evidence-aware";
    private String diversity = "mmr-v1";
  }
}
