package fu.tripsense.socialservice.repository;

import fu.tripsense.socialservice.entity.PostMedia;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface PostMediaRepository extends JpaRepository<PostMedia, UUID> { List<PostMedia> findByPostIdInOrderBySortOrderAsc(Collection<UUID> postIds); }
