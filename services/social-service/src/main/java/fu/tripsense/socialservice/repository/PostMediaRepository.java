package fu.tripsense.socialservice.repository;

import fu.tripsense.socialservice.entity.PostMedia;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PostMediaRepository extends JpaRepository<PostMedia, UUID> {
  List<PostMedia> findByPostIdInOrderBySortOrderAsc(Collection<UUID> postIds);
}
