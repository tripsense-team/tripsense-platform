package fu.tripsense.socialservice.dto.response;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public record PublicTripSnapshotResponse(
    int schemaVersion,
    long publicationRevision,
    Instant publishedAt,
    String datePrecision,
    String timePrecision,
    Summary summary,
    List<Day> days) {
  public record Summary(
      String name,
      String destinationName,
      String coverImageUrl,
      int dayCount,
      int itineraryItemCount,
      List<Highlight> highlights) {}

  public record Highlight(String title, String placeName, int dayNumber) {}

  public record Day(int dayNumber, LocalDate date, List<Item> items) {}

  public record Item(
      int order,
      String title,
      String type,
      LocalTime startTime,
      LocalTime endTime,
      Integer durationMinutes,
      String placeName) {}
}
