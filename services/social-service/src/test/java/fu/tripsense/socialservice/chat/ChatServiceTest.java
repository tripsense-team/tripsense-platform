package fu.tripsense.socialservice.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import fu.tripsense.socialservice.chat.ChatDtos.*;
import fu.tripsense.socialservice.client.PublicProfileClientResponse;
import fu.tripsense.socialservice.client.UserPublicProfileClient;
import fu.tripsense.socialservice.exception.SocialException;
import fu.tripsense.socialservice.security.AuthenticatedUser;
import fu.tripsense.socialservice.security.CurrentUserProvider;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ChatServiceTest {

  @Mock private JdbcTemplate db;
  @Mock private CurrentUserProvider current;
  @Mock private UserPublicProfileClient profiles;
  @Mock private ChatRealtime realtime;
  @Mock private ChatPushNotificationService pushNotificationService;

  private ChatService service;

  private final UUID me = UUID.randomUUID();
  private final UUID peer = UUID.randomUUID();
  private final UUID conversationId = UUID.randomUUID();
  private final AuthenticatedUser authUser = new AuthenticatedUser(me, "me@tripsense.app", "ROLE_USER");

  private ChatService.Thread mockThread(String state, UUID initiator) {
    UUID low = me.toString().compareTo(peer.toString()) < 0 ? me : peer;
    UUID high = low.equals(me) ? peer : me;
    return new ChatService.Thread(conversationId, low, high, initiator, state, 10L, null, Instant.now());
  }

  @BeforeEach
  void setUp() {
    service = new ChatService(db, current, profiles, realtime, pushNotificationService);
    when(current.requiredUser()).thenReturn(authUser);
    when(current.bearerToken()).thenReturn("mock-bearer-token");
    when(profiles.requireEnabled(any(UUID.class), anyString()))
        .thenReturn(new PublicProfileClientResponse(peer, "Peer User", null));
    when(profiles.fetchPublicProfiles(anyCollection()))
        .thenReturn(Map.of(peer, new PublicProfileClientResponse(peer, "Peer User", null)));

    // Default thread query mock
    ChatService.Thread t = mockThread("ACTIVE", me);
    when(db.query(contains("SELECT * FROM chat_conversations WHERE id=?"), any(RowMapper.class), any(UUID.class), eq(me), eq(me)))
        .thenReturn(List.of(t));
    when(db.query(contains("SELECT last_delivered_seq,last_read_seq FROM chat_participants"), any(RowMapper.class), eq(conversationId), any()))
        .thenReturn(List.of(new long[]{10L, 10L}));
    when(db.queryForObject(contains("SELECT last_read_seq FROM chat_participants"), eq(Long.class), eq(conversationId), eq(me)))
        .thenReturn(10L);
    when(db.queryForObject(contains("SELECT count(*) FROM chat_messages WHERE conversation_id=? AND sender_id<>?"), eq(Long.class), eq(conversationId), eq(me), any()))
        .thenReturn(0L);
    when(db.queryForObject(contains("SELECT muted FROM chat_participants"), eq(Boolean.class), eq(conversationId), eq(me)))
        .thenReturn(false);
    when(db.queryForObject(contains("SELECT version FROM chat_conversations WHERE id=?"), eq(Long.class), eq(conversationId)))
        .thenReturn(1L);
    when(db.queryForObject(contains("SELECT count(*) FROM chat_blocks"), eq(Integer.class), any(), any(), any(), any()))
        .thenReturn(0);
    when(db.queryForObject(contains("SELECT count(*) FROM chat_restrictions"), eq(Integer.class), any(), any()))
        .thenReturn(0);
  }

  // =================== searchUsers ===================

  @Test
  @DisplayName("searchUsers validates query length and limits")
  void searchUsers_QueryValidation() {
    assertThatThrownBy(() -> service.searchUsers("a", 10))
        .isInstanceOf(SocialException.class)
        .extracting("status").isEqualTo(HttpStatus.BAD_REQUEST);

    assertThatThrownBy(() -> service.searchUsers("valid", 0))
        .isInstanceOf(SocialException.class)
        .extracting("status").isEqualTo(HttpStatus.BAD_REQUEST);

    assertThatThrownBy(() -> service.searchUsers("valid", 25))
        .isInstanceOf(SocialException.class)
        .extracting("status").isEqualTo(HttpStatus.BAD_REQUEST);
  }

  @Test
  @DisplayName("searchUsers filters self and blocked users")
  void searchUsers_FiltersSelfAndBlocked() {
    PublicProfileClientResponse p1 = new PublicProfileClientResponse(me, "Me", null);
    PublicProfileClientResponse p2 = new PublicProfileClientResponse(peer, "Peer", null);
    UUID blockedUser = UUID.randomUUID();
    PublicProfileClientResponse p3 = new PublicProfileClientResponse(blockedUser, "Blocked", null);

    when(profiles.search("linh", 10, "mock-bearer-token")).thenReturn(List.of(p1, p2, p3));
    when(db.queryForObject(contains("SELECT count(*) FROM chat_blocks"), eq(Integer.class), eq(me), eq(peer), eq(peer), eq(me)))
        .thenReturn(0);
    when(db.queryForObject(contains("SELECT count(*) FROM chat_blocks"), eq(Integer.class), eq(me), eq(blockedUser), eq(blockedUser), eq(me)))
        .thenReturn(1);

    List<PublicProfileClientResponse> results = service.searchUsers("linh", 10);

    assertThat(results).hasSize(1);
    assertThat(results.get(0).userId()).isEqualTo(peer);
  }

  // =================== create ===================

  @Test
  @DisplayName("create throws 400 when recipient is self or null")
  void create_SelfOrNull_Throws400() {
    assertThatThrownBy(() -> service.create(me))
        .isInstanceOf(SocialException.class)
        .extracting("status").isEqualTo(HttpStatus.BAD_REQUEST);

    assertThatThrownBy(() -> service.create(null))
        .isInstanceOf(SocialException.class)
        .extracting("status").isEqualTo(HttpStatus.BAD_REQUEST);
  }

  @Test
  @DisplayName("create throws 403 when pair is blocked")
  void create_BlockedPair_Throws403() {
    when(db.queryForObject(contains("SELECT count(*) FROM chat_blocks"), eq(Integer.class), any(), any(), any(), any()))
        .thenReturn(1);

    assertThatThrownBy(() -> service.create(peer))
        .isInstanceOf(SocialException.class)
        .extracting("status").isEqualTo(HttpStatus.FORBIDDEN);
  }

  @Test
  @DisplayName("create returns CreateOutcome with created=true for new direct thread")
  void create_NewConversation_Success() {
    when(db.query(contains("SELECT * FROM chat_conversations WHERE user_low_id=? AND user_high_id=?"), any(RowMapper.class), any(), any()))
        .thenReturn(List.of());

    CreateOutcome outcome = service.create(peer);

    assertThat(outcome.created()).isTrue();
    verify(db).update(contains("INSERT INTO chat_conversations"), any(), any(), any(), eq(me));
    verify(db).update(contains("INSERT INTO chat_participants"), any(), any(), any(), any());
  }

  @Test
  @DisplayName("create returns CreateOutcome with created=false when conversation already exists")
  void create_ExistingConversation_ReturnsFalse() {
    ChatService.Thread existing = mockThread("ACTIVE", me);
    when(db.query(contains("SELECT * FROM chat_conversations WHERE user_low_id=? AND user_high_id=?"), any(RowMapper.class), any(), any()))
        .thenReturn(List.of(existing));

    CreateOutcome outcome = service.create(peer);

    assertThat(outcome.created()).isFalse();
    verify(db, never()).update(contains("INSERT INTO chat_conversations"), any(), any(), any(), any());
  }

  // =================== send ===================

  @Test
  @DisplayName("send throws 400 when message payload is invalid")
  void send_InvalidPayload_Throws400() {
    assertThatThrownBy(() -> service.send(conversationId, new SendMessage(UUID.randomUUID(), "TEXT", "", null)))
        .isInstanceOf(SocialException.class)
        .extracting("status").isEqualTo(HttpStatus.BAD_REQUEST);

    String longText = "a".repeat(2001);
    assertThatThrownBy(() -> service.send(conversationId, new SendMessage(UUID.randomUUID(), "TEXT", longText, null)))
        .isInstanceOf(SocialException.class)
        .extracting("status").isEqualTo(HttpStatus.BAD_REQUEST);

    assertThatThrownBy(() -> service.send(conversationId, new SendMessage(UUID.randomUUID(), "TEXT", "hello\u0000world", null)))
        .isInstanceOf(SocialException.class)
        .extracting("status").isEqualTo(HttpStatus.BAD_REQUEST);

    assertThatThrownBy(() -> service.send(conversationId, new SendMessage(UUID.randomUUID(), "TEXT", "hello", UUID.randomUUID())))
        .isInstanceOf(SocialException.class)
        .extracting("status").isEqualTo(HttpStatus.BAD_REQUEST);

    assertThatThrownBy(() -> service.send(conversationId, new SendMessage(null, "TEXT", "hello", null)))
        .isInstanceOf(SocialException.class)
        .extracting("status").isEqualTo(HttpStatus.BAD_REQUEST);
  }

  @Test
  @DisplayName("send returns idempotent prior message if already sent with same clientMessageId and payload")
  void send_IdempotentRetry_ReturnsExisting() {
    UUID clientMsgId = UUID.randomUUID();
    SendMessage request = new SendMessage(clientMsgId, "TEXT", "Hello there", null);
    Message prior = new Message(UUID.randomUUID(), clientMsgId, conversationId, "5", me, "TEXT", "Hello there", null, Instant.now(), "sent");

    when(db.query(contains("SELECT * FROM chat_messages WHERE sender_id=? AND client_message_id=?"), any(RowMapper.class), eq(me), eq(clientMsgId)))
        .thenReturn(List.of(prior));

    SendOutcome outcome = service.send(conversationId, request);

    assertThat(outcome.created()).isFalse();
    assertThat(outcome.message().clientMessageId()).isEqualTo(clientMsgId);
    verify(db, never()).update(contains("INSERT INTO chat_messages"), any(), any(), any(), any(), any(), any(), any());
  }

  @Test
  @DisplayName("send throws 409 conflict when duplicate clientMessageId is sent with different text")
  void send_DuplicateKeyDifferentPayload_Throws409() {
    UUID clientMsgId = UUID.randomUUID();
    SendMessage request = new SendMessage(clientMsgId, "TEXT", "Different text!", null);
    Message prior = new Message(UUID.randomUUID(), clientMsgId, conversationId, "5", me, "TEXT", "Original text", null, Instant.now(), "sent");

    when(db.query(contains("SELECT * FROM chat_messages WHERE sender_id=? AND client_message_id=?"), any(RowMapper.class), eq(me), eq(clientMsgId)))
        .thenReturn(List.of(prior));

    assertThatThrownBy(() -> service.send(conversationId, request))
        .isInstanceOf(SocialException.class)
        .extracting("status").isEqualTo(HttpStatus.CONFLICT);
  }

  @Test
  @DisplayName("send inserts message and advances conversation state")
  void send_NewMessage_Success() {
    UUID clientMsgId = UUID.randomUUID();
    SendMessage request = new SendMessage(clientMsgId, "TEXT", "Xin chào!", null);

    when(db.query(contains("SELECT * FROM chat_messages WHERE sender_id=? AND client_message_id=?"), any(RowMapper.class), eq(me), eq(clientMsgId)))
        .thenReturn(List.of())
        .thenReturn(List.of())
        .thenReturn(List.of(new Message(UUID.randomUUID(), clientMsgId, conversationId, "11", me, "TEXT", "Xin chào!", null, Instant.now(), "sent")));
    when(db.queryForObject(contains("INSERT INTO chat_messages"), eq(Long.class), any(), any(), any(), any(), any(), any(), any()))
        .thenReturn(11L);

    SendOutcome outcome = service.send(conversationId, request);

    assertThat(outcome.created()).isTrue();
    verify(db).update(contains("UPDATE chat_conversations SET state="), eq(11L), eq(conversationId));
    verify(realtime, atLeastOnce()).afterCommit(any(), eq(conversationId), eq("MESSAGE_CREATED"), anyLong());
  }

  @Test
  @DisplayName("send throws 409 when conversation is already PENDING")
  void send_PendingConversation_Throws409() {
    ChatService.Thread pending = mockThread("PENDING", me);
    when(db.query(contains("SELECT * FROM chat_conversations WHERE id=?"), any(RowMapper.class), eq(conversationId), eq(me), eq(me)))
        .thenReturn(List.of(pending));

    assertThatThrownBy(() -> service.send(conversationId, new SendMessage(UUID.randomUUID(), "TEXT", "Next message", null)))
        .isInstanceOf(SocialException.class)
        .extracting("status").isEqualTo(HttpStatus.CONFLICT);
  }

  @Test
  @DisplayName("send throws 409 when conversation was DECLINED within 30 days")
  void send_DeclinedCooldown_Throws409() {
    UUID low = me.toString().compareTo(peer.toString()) < 0 ? me : peer;
    UUID high = low.equals(me) ? peer : me;
    ChatService.Thread declined = new ChatService.Thread(
        conversationId, low, high, me, "DECLINED", 1L, Instant.now().minus(5, ChronoUnit.DAYS), Instant.now());
    when(db.query(contains("SELECT * FROM chat_conversations WHERE id=?"), any(RowMapper.class), eq(conversationId), eq(me), eq(me)))
        .thenReturn(List.of(declined));

    assertThatThrownBy(() -> service.send(conversationId, new SendMessage(UUID.randomUUID(), "TEXT", "Reopen request", null)))
        .isInstanceOf(SocialException.class)
        .extracting("status").isEqualTo(HttpStatus.CONFLICT);
  }

  // =================== receipts ===================

  @Test
  @DisplayName("receipt updates delivered cursor and emits DELIVERED event")
  void receipt_Delivered_Success() {
    when(db.queryForObject(contains("SELECT count(*) FROM chat_messages WHERE conversation_id=? AND seq=?"), eq(Integer.class), eq(conversationId), eq(10L)))
        .thenReturn(1);
    when(db.update(contains("UPDATE chat_participants SET last_delivered_seq="), any(), any(), any(), any()))
        .thenReturn(1);

    Conversation result = service.receipt(conversationId, new Receipt("10"), false);

    assertThat(result).isNotNull();
    verify(realtime, atLeastOnce()).afterCommit(any(), eq(conversationId), eq("DELIVERED"), anyLong());
  }

  @Test
  @DisplayName("receipt updates read cursor and emits READ event")
  void receipt_Read_Success() {
    when(db.queryForObject(contains("SELECT count(*) FROM chat_messages WHERE conversation_id=? AND seq=?"), eq(Integer.class), eq(conversationId), eq(10L)))
        .thenReturn(1);
    when(db.update(contains("UPDATE chat_participants SET last_read_seq="), any(Object[].class)))
        .thenReturn(1);

    Conversation result = service.receipt(conversationId, new Receipt("10"), true);

    assertThat(result).isNotNull();
    verify(realtime, atLeastOnce()).afterCommit(any(), eq(conversationId), eq("READ"), anyLong());
  }

  // =================== requestDecision ===================

  @Test
  @DisplayName("requestDecision accept changes state to ACTIVE")
  void requestDecision_Accept_Success() {
    ChatService.Thread pending = mockThread("PENDING", peer); // peer initiated, so caller (me) can accept
    when(db.query(contains("SELECT * FROM chat_conversations WHERE id=?"), any(RowMapper.class), eq(conversationId), eq(me), eq(me)))
        .thenReturn(List.of(pending));

    Conversation result = service.requestDecision(conversationId, true);

    assertThat(result).isNotNull();
    verify(db).update(contains("UPDATE chat_conversations SET state=?, declined_at="), eq("ACTIVE"), eq(true), eq(conversationId));
    verify(realtime, atLeastOnce()).afterCommit(any(), eq(conversationId), eq("REQUEST_ACCEPTED"), anyLong());
  }

  @Test
  @DisplayName("requestDecision decline changes state to DECLINED")
  void requestDecision_Decline_Success() {
    ChatService.Thread pending = mockThread("PENDING", peer);
    when(db.query(contains("SELECT * FROM chat_conversations WHERE id=?"), any(RowMapper.class), eq(conversationId), eq(me), eq(me)))
        .thenReturn(List.of(pending));

    Conversation result = service.requestDecision(conversationId, false);

    assertThat(result).isNotNull();
    verify(db).update(contains("UPDATE chat_conversations SET state=?, declined_at="), eq("DECLINED"), eq(false), eq(conversationId));
    verify(realtime, atLeastOnce()).afterCommit(any(), eq(conversationId), eq("REQUEST_DECLINED"), anyLong());
  }

  @Test
  @DisplayName("requestDecision throws 409 if initiator tries to accept own request")
  void requestDecision_InitiatorSelfAccept_Throws409() {
    ChatService.Thread pending = mockThread("PENDING", me); // me initiated
    when(db.query(contains("SELECT * FROM chat_conversations WHERE id=?"), any(RowMapper.class), eq(conversationId), eq(me), eq(me)))
        .thenReturn(List.of(pending));

    assertThatThrownBy(() -> service.requestDecision(conversationId, true))
        .isInstanceOf(SocialException.class)
        .extracting("status").isEqualTo(HttpStatus.CONFLICT);
  }

  // =================== mute ===================

  @Test
  @DisplayName("mute updates participant muted flag")
  void mute_Success() {
    Conversation result = service.mute(conversationId, true);

    assertThat(result).isNotNull();
    verify(db).update(contains("UPDATE chat_participants SET muted=?"), eq(true), eq(conversationId), eq(me));
    verify(realtime, atLeastOnce()).afterCommit(any(), eq(conversationId), eq("MUTE_CHANGED"), anyLong());
  }

  // =================== block & unblock ===================

  @Test
  @DisplayName("block throws 400 when blocking self or null")
  void block_Self_Throws400() {
    assertThatThrownBy(() -> service.block(me))
        .isInstanceOf(SocialException.class)
        .extracting("status").isEqualTo(HttpStatus.BAD_REQUEST);

    assertThatThrownBy(() -> service.block(null))
        .isInstanceOf(SocialException.class)
        .extracting("status").isEqualTo(HttpStatus.BAD_REQUEST);
  }

  @Test
  @DisplayName("block inserts into chat_blocks")
  void block_Success() {
    when(db.query(contains("SELECT * FROM chat_conversations WHERE (user_low_id=?"), any(RowMapper.class), any(), any(), any(), any()))
        .thenReturn(List.of());

    service.block(peer);

    verify(db).update(contains("INSERT INTO chat_blocks"), eq(me), eq(peer));
  }

  @Test
  @DisplayName("unblock deletes from chat_blocks")
  void unblock_Success() {
    when(db.query(contains("SELECT * FROM chat_conversations WHERE (user_low_id=?"), any(RowMapper.class), any(), any(), any(), any()))
        .thenReturn(List.of());

    service.unblock(peer);

    verify(db).update(contains("DELETE FROM chat_blocks"), eq(me), eq(peer));
  }

  // =================== report & decide ===================

  @Test
  @DisplayName("report creates pending report case")
  void report_Success() {
    Message reportedMsg = new Message(UUID.randomUUID(), UUID.randomUUID(), conversationId, "5", peer, "TEXT", "Bad msg", null, Instant.now(), "sent");
    when(db.queryForObject(contains("SELECT count(*) FROM chat_reports WHERE reporter_id=?"), eq(Integer.class), eq(me)))
        .thenReturn(0);
    when(db.queryForObject(contains("SELECT count(*) FROM chat_reports WHERE conversation_id=?"), eq(Integer.class), eq(conversationId), eq(me), eq(peer)))
        .thenReturn(0);
    when(db.query(contains("SELECT * FROM chat_messages WHERE conversation_id=? AND sender_id=?"), any(RowMapper.class), eq(conversationId), eq(peer)))
        .thenReturn(List.of(reportedMsg));

    ReportReceipt receipt = service.report(conversationId, new Report(peer, null, "SPAM", "Spam message"));

    assertThat(receipt.status()).isEqualTo("PENDING");
    verify(db).update(contains("INSERT INTO chat_reports"), any(), eq(conversationId), eq(me), eq(peer), any(), eq("SPAM"), eq("Spam message"));
  }

  @Test
  @DisplayName("report throws 429 when hourly report limit exceeded")
  void report_RateLimit_Throws429() {
    when(db.queryForObject(contains("SELECT count(*) FROM chat_reports WHERE reporter_id=?"), eq(Integer.class), eq(me)))
        .thenReturn(5);

    assertThatThrownBy(() -> service.report(conversationId, new Report(peer, null, "SPAM", null)))
        .isInstanceOf(SocialException.class)
        .extracting("status").isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
  }

  @Test
  @DisplayName("report throws 409 when pending report already exists")
  void report_AlreadyPending_Throws409() {
    when(db.queryForObject(contains("SELECT count(*) FROM chat_reports WHERE reporter_id=?"), eq(Integer.class), eq(me)))
        .thenReturn(0);
    when(db.queryForObject(contains("SELECT count(*) FROM chat_reports WHERE conversation_id=?"), eq(Integer.class), eq(conversationId), eq(me), eq(peer)))
        .thenReturn(1);

    assertThatThrownBy(() -> service.report(conversationId, new Report(peer, null, "SPAM", null)))
        .isInstanceOf(SocialException.class)
        .extracting("status").isEqualTo(HttpStatus.CONFLICT);
  }

  @Test
  @DisplayName("decide validates action and duration bounds")
  void decide_Validation() {
    UUID reportId = UUID.randomUUID();

    assertThatThrownBy(() -> service.decide(reportId, new Decision("INVALID", null, "Reason")))
        .isInstanceOf(SocialException.class)
        .extracting("status").isEqualTo(HttpStatus.BAD_REQUEST);

    assertThatThrownBy(() -> service.decide(reportId, new Decision("RESTRICT_CHAT", 1000, "Reason")))
        .isInstanceOf(SocialException.class)
        .extracting("status").isEqualTo(HttpStatus.BAD_REQUEST);

    assertThatThrownBy(() -> service.decide(reportId, new Decision("RESTRICT_CHAT", null, "Reason")))
        .isInstanceOf(SocialException.class)
        .extracting("status").isEqualTo(HttpStatus.BAD_REQUEST);
  }

  @Test
  @DisplayName("decide dismiss updates status and inserts audit row")
  void decide_Dismiss_Success() {
    UUID reportId = UUID.randomUUID();
    ReportCase reportCase = new ReportCase(reportId, conversationId, UUID.randomUUID(), peer, "SPAM", null, "PENDING", Instant.now(), List.of());
    when(db.query(contains("SELECT * FROM chat_reports WHERE id=? FOR UPDATE"), any(RowMapper.class), eq(reportId)))
        .thenReturn(List.of(reportCase));

    ReportReceipt receipt = service.decide(reportId, new Decision("DISMISS", null, "Not spam"));

    assertThat(receipt.status()).isEqualTo("DISMISSED");
    verify(db).update(contains("UPDATE chat_reports SET status=?,reviewed_at="), eq("DISMISSED"), eq(me), eq("DISMISS"), eq(reportId));
    verify(db).update(contains("INSERT INTO chat_moderation_audits"), any(), eq(reportId), eq(me), eq("DISMISS"), eq("Not spam"));
  }

  @Test
  @DisplayName("decide restrict chat updates status, restriction table, and audit log")
  void decide_RestrictChat_Success() {
    UUID reportId = UUID.randomUUID();
    ReportCase reportCase = new ReportCase(reportId, conversationId, UUID.randomUUID(), peer, "HARASSMENT", null, "PENDING", Instant.now(), List.of());
    when(db.query(contains("SELECT * FROM chat_reports WHERE id=? FOR UPDATE"), any(RowMapper.class), eq(reportId)))
        .thenReturn(List.of(reportCase));

    ReportReceipt receipt = service.decide(reportId, new Decision("RESTRICT_CHAT", 48, "Harassment violation"));

    assertThat(receipt.status()).isEqualTo("ACTIONED");
    verify(db).update(contains("INSERT INTO chat_restrictions"), eq(peer), eq(48), eq("Harassment violation"), eq(me));
    verify(db).update(contains("INSERT INTO chat_moderation_audits"), any(), eq(reportId), eq(me), eq("RESTRICT_CHAT"), eq("Harassment violation"));
  }

  @Test
  @DisplayName("unreadSummary queries distinct conversations count and total unread messages")
  void unreadSummary_Success() {
    when(db.queryForObject(contains("SELECT coalesce(count(DISTINCT c.id), 0)"), eq(Long.class), any(), any(), any(), any(), any(), any()))
        .thenReturn(3L);
    when(db.queryForObject(contains("SELECT coalesce(count(m.id), 0)"), eq(Long.class), any(), any(), any(), any(), any(), any()))
        .thenReturn(8L);

    UnreadSummary summary = service.unreadSummary();

    assertThat(summary.unreadConversationsCount()).isEqualTo(3L);
    assertThat(summary.totalUnreadMessages()).isEqualTo(8L);
  }

  @Test
  @DisplayName("registerFcmToken inserts or updates token in chat_fcm_tokens")
  void registerFcmToken_Success() {
    RegisterFcmToken request = new RegisterFcmToken("fcm-sample-token-123", "WEB", "Chrome 128");

    service.registerFcmToken(request);

    verify(db).update(contains("INSERT INTO chat_fcm_tokens"), eq(me), eq("fcm-sample-token-123"), eq("WEB"), eq("Chrome 128"));
  }

  @Test
  @DisplayName("registerFcmToken throws exception when token is blank")
  void registerFcmToken_BlankToken_Throws() {
    RegisterFcmToken request = new RegisterFcmToken("   ", "WEB", null);

    assertThatThrownBy(() -> service.registerFcmToken(request))
        .isInstanceOf(SocialException.class)
        .satisfies(ex -> assertThat(((SocialException) ex).code()).isEqualTo("INVALID_TOKEN"));
  }

  @Test
  @DisplayName("unregisterFcmToken deletes token for current user")
  void unregisterFcmToken_Success() {
    UnregisterFcmToken request = new UnregisterFcmToken("fcm-sample-token-123");

    service.unregisterFcmToken(request);

    verify(db).update(contains("DELETE FROM chat_fcm_tokens WHERE user_id = ? AND fcm_token = ?"), eq(me), eq("fcm-sample-token-123"));
  }
}
