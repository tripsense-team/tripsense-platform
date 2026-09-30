package fu.tripsense.socialservice.repository;

import fu.tripsense.socialservice.entity.PlaceReview;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PlaceReviewRepository extends JpaRepository<PlaceReview, UUID> {
  Page<PlaceReview> findByPlaceRefAndStatusAndDeletedAtIsNullOrderByCreatedAtDesc(
      String placeRef, String status, Pageable pageable);

  Optional<PlaceReview> findByIdAndDeletedAtIsNull(UUID id);

  Optional<PlaceReview> findByAuthorUserIdAndPlaceRefAndDeletedAtIsNull(
      UUID authorUserId, String placeRef);

  @Query(
      "select count(r), coalesce(avg(r.rating), 0) from PlaceReview r "
          + "where r.placeRef = :placeRef and r.status = 'PUBLISHED' and r.deletedAt is null")
  Object[] summarize(@Param("placeRef") String placeRef);
}
