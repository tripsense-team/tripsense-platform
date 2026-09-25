package fu.tripsense.socialservice.repository;

import fu.tripsense.socialservice.entity.SocialTrendingDestination;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SocialTrendingDestinationRepository
    extends JpaRepository<SocialTrendingDestination, String> {

  List<SocialTrendingDestination> findByIsActiveTrueOrderBySortOrderAsc();
}
