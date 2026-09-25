package fu.tripsense.userservice.repository;

import fu.tripsense.userservice.entity.UserProfile;
import java.util.UUID;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface UserProfileRepository extends JpaRepository<UserProfile, UUID> {
  @Query(value = """
      SELECT p.user_id, p.display_name, p.avatar_url
      FROM user_profiles p JOIN users u ON u.id = p.user_id
      WHERE u.status = 'ACTIVE' AND p.display_name IS NOT NULL
        AND (lower(p.display_name) LIKE :prefix ESCAPE '!' OR lower(p.display_name) LIKE '% ' || :prefix ESCAPE '!')
      ORDER BY lower(p.display_name), p.user_id
      LIMIT :limit
      """, nativeQuery = true)
  List<Object[]> searchEnabledPublicNames(@Param("prefix") String prefix, @Param("limit") int limit);
}
