package fu.tripsense.tripservice.partner.service;

import fu.tripsense.tripservice.exception.TripServiceException;
import fu.tripsense.tripservice.partner.dto.PartnerNotificationDto;
import fu.tripsense.tripservice.partner.entity.PartnerNotification;
import fu.tripsense.tripservice.partner.repository.PartnerNotificationRepository;
import fu.tripsense.tripservice.security.AuthenticatedUser;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class PartnerNotificationService {

  private final PartnerNotificationRepository notificationRepository;

  @Transactional(readOnly = true)
  public List<PartnerNotificationDto> getMyNotifications(
      AuthenticatedUser user, boolean unreadOnly) {
    if (user == null) {
      throw new TripServiceException(
          "UNAUTHORIZED", "Authentication required", HttpStatus.UNAUTHORIZED);
    }
    List<PartnerNotification> list =
        unreadOnly
            ? notificationRepository.findByRecipientIdAndReadAtIsNullOrderByCreatedAtDesc(user.id())
            : notificationRepository.findByRecipientIdOrderByCreatedAtDesc(user.id());

    return list.stream().map(this::toDto).toList();
  }

  @Transactional
  public PartnerNotificationDto markAsRead(AuthenticatedUser user, UUID notificationId) {
    if (user == null) {
      throw new TripServiceException(
          "UNAUTHORIZED", "Authentication required", HttpStatus.UNAUTHORIZED);
    }

    PartnerNotification notification =
        notificationRepository
            .findByIdAndRecipientId(notificationId, user.id())
            .orElseThrow(
                () ->
                    new TripServiceException(
                        "NOTIFICATION_NOT_FOUND",
                        "Notification not found or access denied",
                        HttpStatus.NOT_FOUND));

    notification.setReadAt(Instant.now());
    notification = notificationRepository.save(notification);
    return toDto(notification);
  }

  private PartnerNotificationDto toDto(PartnerNotification n) {
    return PartnerNotificationDto.builder()
        .id(n.getId())
        .eventId(n.getEventId())
        .eventType(n.getEventType())
        .businessId(n.getBusinessId())
        .message(n.getMessage())
        .readAt(n.getReadAt())
        .createdAt(n.getCreatedAt())
        .build();
  }
}
