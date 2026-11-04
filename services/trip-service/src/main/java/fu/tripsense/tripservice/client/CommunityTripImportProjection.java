package fu.tripsense.tripservice.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.time.*;
import java.util.*;

@JsonIgnoreProperties(ignoreUnknown = true)
public record CommunityTripImportProjection(
    int schemaVersion,
    String payloadSha256,
    UUID postId,
    Instant publishedAt,
    Snapshot snapshot) {

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record Snapshot(
      int schemaVersion,
      long publicationRevision,
      Instant publishedAt,
      String datePrecision,
      String timePrecision,
      Summary summary,
      List<Day> days) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record Summary(
      String name,
      String destinationName,
      String coverImageUrl,
      int dayCount,
      int itineraryItemCount,
      List<Highlight> highlights) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record Highlight(String title, String placeName, int dayNumber) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record Day(int dayNumber, LocalDate date, List<Item> items) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record Item(
      int order,
      String title,
      String type,
      LocalTime startTime,
      LocalTime endTime,
      Integer durationMinutes,
      String placeName) {}
}
