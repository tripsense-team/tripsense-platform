package fu.tripsense.socialservice.chat;

import fu.tripsense.socialservice.client.PublicProfileClientResponse;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

public final class ChatDtos {
  private ChatDtos() {}

  public record CreateConversation(UUID recipientId) {}

  public record SendMessage(UUID clientMessageId, String type, String text, UUID sharedPostId) {}

  public record Receipt(String throughSeq) {}

  public record Mute(boolean muted) {}

  public record Block(UUID targetUserId) {}

  public record Report(UUID reportedUserId, UUID messageId, String reason, String details) {}

  public record Decision(String action, Integer durationHours, String reason) {}

  public record UnreadSummary(long unreadConversationsCount, long totalUnreadMessages) {}

  public record RegisterFcmToken(String fcmToken, String deviceType, String userAgent) {}

  public record UnregisterFcmToken(String fcmToken) {}

  public record TripCard(
      UUID id,
      String title,
      String location,
      Integer durationDays,
      String coverImage,
      boolean available) {}

  public record ReservationOffer(
      UUID id,
      UUID conversationId,
      UUID messageId,
      UUID senderId,
      UUID recipientId,
      String businessType,
      UUID businessId,
      String businessName,
      String businessThumbnail,
      String itemTitle,
      LocalDate checkInDate,
      LocalDate checkOutDate,
      LocalTime reservationTime,
      Integer adultsCount,
      Integer childrenCount,
      BigDecimal totalPrice,
      BigDecimal depositAmount,
      String currency,
      String inclusions,
      Instant expiresAt,
      String status,
      String declineReason,
      UUID bookingId,
      String bookingCode,
      Instant createdAt,
      Instant updatedAt) {}

  public record CreateReservationOffer(
      UUID clientMessageId,
      String businessType,
      UUID businessId,
      String businessName,
      String businessThumbnail,
      String itemTitle,
      LocalDate checkInDate,
      LocalDate checkOutDate,
      LocalTime reservationTime,
      Integer adultsCount,
      Integer childrenCount,
      BigDecimal totalPrice,
      BigDecimal depositAmount,
      String currency,
      String inclusions,
      Integer validHours) {}

  public record AcceptOfferResponse(
      UUID offerId,
      String status,
      UUID bookingId,
      String bookingCode,
      String redirectUrl,
      String message) {}

  public record DeclineOfferRequest(String reason) {}

  public record Message(
      UUID id,
      UUID clientMessageId,
      UUID conversationId,
      String seq,
      UUID senderId,
      String type,
      String text,
      TripCard sharedTrip,
      ReservationOffer offer,
      Instant createdAt,
      String status) {
    public Message(
        UUID id,
        UUID clientMessageId,
        UUID conversationId,
        String seq,
        UUID senderId,
        String type,
        String text,
        TripCard sharedTrip,
        Instant createdAt,
        String status) {
      this(
          id,
          clientMessageId,
          conversationId,
          seq,
          senderId,
          type,
          text,
          sharedTrip,
          null,
          createdAt,
          status);
    }
  }

  public record SendOutcome(Message message, boolean created) {}

  public record CreateOutcome(Conversation conversation, boolean created) {}

  public record Conversation(
      UUID id,
      PublicProfileClientResponse peer,
      String state,
      String requestDirection,
      Message lastMessage,
      long unreadCount,
      boolean muted,
      Instant updatedAt,
      boolean online) {}

  public record Page<T>(List<T> items, String nextCursor) {}

  public record ReportReceipt(UUID id, String status) {}

  public record ReportCase(
      UUID id,
      UUID conversationId,
      UUID reporterId,
      UUID reportedUserId,
      String reason,
      String details,
      String status,
      Instant createdAt,
      List<Message> evidence) {}
}
