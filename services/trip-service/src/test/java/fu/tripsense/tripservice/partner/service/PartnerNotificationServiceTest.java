package fu.tripsense.tripservice.partner.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import fu.tripsense.tripservice.exception.TripServiceException;
import fu.tripsense.tripservice.partner.dto.PartnerNotificationDto;
import fu.tripsense.tripservice.partner.entity.PartnerNotification;
import fu.tripsense.tripservice.partner.repository.PartnerNotificationRepository;
import fu.tripsense.tripservice.security.AuthenticatedUser;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PartnerNotificationServiceTest {

  @Mock private PartnerNotificationRepository notificationRepository;

  private PartnerNotificationService notificationService;

  private final UUID userId = UUID.randomUUID();
  private final AuthenticatedUser user =
      new AuthenticatedUser(userId, "partner@example.com", "ROLE_PARTNER");

  @BeforeEach
  void setUp() {
    notificationService = new PartnerNotificationService(notificationRepository);
  }

  @Test
  @DisplayName("getMyNotifications: should return notifications for user")
  void getMyNotifications_success() {
    PartnerNotification n1 =
        PartnerNotification.builder()
            .id(UUID.randomUUID())
            .eventId(UUID.randomUUID())
            .recipientId(userId)
            .eventType("PartnerApplicationApproved")
            .message("Congratulations! Your business application has been approved.")
            .createdAt(Instant.now())
            .build();

    when(notificationRepository.findByRecipientIdOrderByCreatedAtDesc(userId))
        .thenReturn(List.of(n1));

    List<PartnerNotificationDto> result = notificationService.getMyNotifications(user, false);

    assertThat(result).hasSize(1);
    assertThat(result.getFirst().eventType()).isEqualTo("PartnerApplicationApproved");
    assertThat(result.getFirst().message()).contains("approved");
  }

  @Test
  @DisplayName("getMyNotifications: unreadOnly should filter read notifications")
  void getMyNotifications_unreadOnly() {
    PartnerNotification n1 =
        PartnerNotification.builder()
            .id(UUID.randomUUID())
            .eventId(UUID.randomUUID())
            .recipientId(userId)
            .eventType("PartnerApplicationApproved")
            .message("Approved")
            .readAt(null)
            .createdAt(Instant.now())
            .build();

    when(notificationRepository.findByRecipientIdAndReadAtIsNullOrderByCreatedAtDesc(userId))
        .thenReturn(List.of(n1));

    List<PartnerNotificationDto> result = notificationService.getMyNotifications(user, true);

    assertThat(result).hasSize(1);
    verify(notificationRepository).findByRecipientIdAndReadAtIsNullOrderByCreatedAtDesc(userId);
  }

  @Test
  @DisplayName("getMyNotifications: unauthenticated user throws 401")
  void getMyNotifications_unauthorized() {
    assertThatThrownBy(() -> notificationService.getMyNotifications(null, false))
        .isInstanceOf(TripServiceException.class)
        .hasMessageContaining("Authentication required");
  }

  @Test
  @DisplayName("markAsRead: marks notification as read when user is recipient")
  void markAsRead_success() {
    UUID nid = UUID.randomUUID();
    PartnerNotification n =
        PartnerNotification.builder()
            .id(nid)
            .eventId(UUID.randomUUID())
            .recipientId(userId)
            .eventType("PartnerApplicationApproved")
            .message("Approved")
            .readAt(null)
            .createdAt(Instant.now())
            .build();

    when(notificationRepository.findByIdAndRecipientId(nid, userId)).thenReturn(Optional.of(n));
    when(notificationRepository.save(any(PartnerNotification.class))).thenAnswer(inv -> inv.getArgument(0));

    PartnerNotificationDto res = notificationService.markAsRead(user, nid);

    assertThat(res.readAt()).isNotNull();
    verify(notificationRepository).save(n);
  }

  @Test
  @DisplayName("markAsRead: throws 404 when notification does not belong to user")
  void markAsRead_notFound() {
    UUID nid = UUID.randomUUID();
    when(notificationRepository.findByIdAndRecipientId(nid, userId)).thenReturn(Optional.empty());

    assertThatThrownBy(() -> notificationService.markAsRead(user, nid))
        .isInstanceOf(TripServiceException.class)
        .hasMessageContaining("not found or access denied");
  }
}
