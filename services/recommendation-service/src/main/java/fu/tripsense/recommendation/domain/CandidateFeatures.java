package fu.tripsense.recommendation.domain;

import java.util.List;

public record CandidateFeatures(
    String placeId,
    PlaceSnapshot place,
    List<CandidateSourceEvidence> sourceEvidence,
    Retrieval retrieval,
    Semantic semantic,
    Preference preference,
    Geographic geographic,
    Quality quality,
    Quietness quietness,
    Contextual contextual,
    History history) {
  public CandidateFeatures {
    sourceEvidence = sourceEvidence == null ? List.of() : List.copyOf(sourceEvidence);
  }
  public CandidateFeatures(String placeId, PlaceSnapshot place, List<CandidateSourceEvidence> sourceEvidence,
      Retrieval retrieval, Semantic semantic, Preference preference, Geographic geographic, Quality quality,
      Contextual contextual, History history) {
    this(placeId, place, sourceEvidence, retrieval, semantic, preference, geographic, quality,
        Quietness.unavailable(), contextual, history);
  }
  public static CandidateFeatures empty(FusedCandidate c) {
    return new CandidateFeatures(c.placeId(), c.place(), c.sources(), new Retrieval(c.fusionScore(), c.sources().size(), null), Semantic.unavailable(), Preference.unavailable(), Geographic.unavailable(), Quality.unavailable(), Quietness.unavailable(), Contextual.unavailable(), History.unavailable());
  }
  public CandidateFeatures withSemantic(Semantic v) { return copy(retrieval, v, preference, geographic, quality, quietness, contextual, history); }
  public CandidateFeatures withRetrieval(Retrieval v) { return copy(v, semantic, preference, geographic, quality, quietness, contextual, history); }
  public CandidateFeatures withPreference(Preference v) { return copy(retrieval, semantic, v, geographic, quality, quietness, contextual, history); }
  public CandidateFeatures withGeographic(Geographic v) { return copy(retrieval, semantic, preference, v, quality, quietness, contextual, history); }
  public CandidateFeatures withQuality(Quality v) { return copy(retrieval, semantic, preference, geographic, v, quietness, contextual, history); }
  public CandidateFeatures withQuietness(Quietness v) { return copy(retrieval, semantic, preference, geographic, quality, v, contextual, history); }
  public CandidateFeatures withContextual(Contextual v) { return copy(retrieval, semantic, preference, geographic, quality, quietness, v, history); }
  public CandidateFeatures withHistory(History v) { return copy(retrieval, semantic, preference, geographic, quality, quietness, contextual, v); }
  private CandidateFeatures copy(Retrieval r, Semantic s, Preference p, Geographic g, Quality q, Quietness quiet, Contextual c, History h) {
    return new CandidateFeatures(placeId, place, sourceEvidence, r, s, p, g, q, quiet, c, h);
  }
  public record Retrieval(double rrfScore, int sourceCount, Double lexicalRelevance) {}
  public record Semantic(boolean available, double querySimilarity, double userSimilarity) { static Semantic unavailable() { return new Semantic(false, 0, 0); } }
  public record Preference(boolean available, double categoryMatch, boolean explicitMatch, boolean dislikeConflict) { static Preference unavailable() { return new Preference(false, 0, false, false); } }
  public record Geographic(boolean available, Double distanceKm, double distanceScore) { static Geographic unavailable() { return new Geographic(false, null, 0); } }
  public record Quality(boolean ratingAvailable, boolean popularityAvailable, Double rawRating, Integer reviewCount, double bayesianRating, double popularity) {
    public Quality(boolean available, Double rawRating, int reviewCount, double bayesianRating, double popularity) {
      this(available, available, rawRating, reviewCount, bayesianRating, popularity);
    }
    static Quality unavailable() { return new Quality(false, false, null, null, 0, 0); }
    public boolean available() { return ratingAvailable || popularityAvailable; }
  }
  public record Quietness(boolean available, Double score, Integer evidenceCount, String source) { static Quietness unavailable() { return new Quietness(false, null, null, null); } }
  public record Contextual(boolean available, double tripDestinationMatch, double sessionRelevance) { static Contextual unavailable() { return new Contextual(false, 0, 0); } }
  public record History(boolean available, boolean previouslySeen, boolean previouslySaved, boolean previouslyAddedToTrip, boolean previousNegativeFeedback) { static History unavailable() { return new History(false, false, false, false, false); } }
}
