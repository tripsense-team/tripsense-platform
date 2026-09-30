package fu.tripsense.socialservice.dto.response;

import java.util.List;

public record PlaceReviewsResponse(
    String placeRef,
    PlaceReviewSummaryResponse summary,
    int page,
    int size,
    long totalElements,
    int totalPages,
    List<PlaceReviewItemResponse> items,
    PlaceReviewItemResponse currentUserReview) {}
