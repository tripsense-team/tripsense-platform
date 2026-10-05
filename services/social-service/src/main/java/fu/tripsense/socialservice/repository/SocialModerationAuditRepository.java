package fu.tripsense.socialservice.repository;

import fu.tripsense.socialservice.entity.SocialModerationAudit;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SocialModerationAuditRepository
    extends JpaRepository<SocialModerationAudit, UUID> {}
