package fu.tripsense.tripservice.partner.repository;

import fu.tripsense.tripservice.partner.entity.PartnerRentalItem;
import fu.tripsense.tripservice.partner.enums.RentalCategory;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PartnerRentalItemRepository extends JpaRepository<PartnerRentalItem, UUID> {

  List<PartnerRentalItem> findByBusinessIdOrderByCreatedAtDesc(UUID businessId);

  List<PartnerRentalItem> findByBusinessIdAndActiveTrueOrderByNameAsc(UUID businessId);

  Page<PartnerRentalItem> findByActiveTrueOrderByCreatedAtDesc(Pageable pageable);

  Page<PartnerRentalItem> findByActiveTrueAndCategoryOrderByCreatedAtDesc(
      RentalCategory category, Pageable pageable);

  List<PartnerRentalItem> findByActiveTrueOrderByCreatedAtDesc();

  List<PartnerRentalItem> findByActiveTrueAndCategoryOrderByCreatedAtDesc(RentalCategory category);

  @Query(
      "SELECT r FROM PartnerRentalItem r WHERE r.active = true "
          + "AND (:category IS NULL OR r.category = :category) "
          + "ORDER BY r.createdAt DESC")
  Page<PartnerRentalItem> searchActiveRentalItems(
      @Param("category") RentalCategory category, Pageable pageable);
}
