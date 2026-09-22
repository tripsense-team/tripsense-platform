package fu.tripsense.userservice.repository;

import fu.tripsense.userservice.entity.User;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {

  Optional<User> findByEmail(String email);

  Optional<User> findByAuthProviderAndProviderId(String authProvider, String providerId);

  boolean existsByEmail(String email);
}
