package fu.tripsense.socialservice.chat;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import fu.tripsense.socialservice.chat.ChatDtos.*;
import fu.tripsense.socialservice.client.PublicProfileClientResponse;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@ExtendWith(MockitoExtension.class)
class ChatControllerTest {

  private MockMvc mockMvc;

  @Mock private ChatService chatService;
  @Mock private ChatRealtime chatRealtime;

  @InjectMocks private ChatController chatController;

  private final ObjectMapper objectMapper = new ObjectMapper();

  private final UUID actorId = UUID.randomUUID();
  private final UUID recipientId = UUID.randomUUID();
  private final UUID conversationId = UUID.randomUUID();

  @BeforeEach
  void setUp() {
    mockMvc = MockMvcBuilders.standaloneSetup(chatController).build();
  }

  @Test
  @DisplayName("events endpoint connects SSE and returns text/event-stream")
  void events_Success() throws Exception {
    when(chatService.actorId()).thenReturn(actorId);
    when(chatRealtime.connect(actorId)).thenReturn(new SseEmitter(60000L));

    mockMvc
        .perform(get("/api/social/chat/events"))
        .andExpect(status().isOk())
        .andExpect(header().string("Cache-Control", "no-store"))
        .andExpect(header().string("X-Accel-Buffering", "no"));

    verify(chatRealtime).connect(actorId);
  }

  @Test
  @DisplayName("users endpoint delegates search to chatService")
  void users_Success() throws Exception {
    PublicProfileClientResponse profile = new PublicProfileClientResponse(recipientId, "Linh", "avatar.jpg");
    when(chatService.searchUsers("linh", 10)).thenReturn(List.of(profile));

    mockMvc
        .perform(get("/api/social/chat/users")
            .param("query", "linh")
            .param("limit", "10")
            .accept(MediaType.APPLICATION_JSON))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data[0].userId").value(recipientId.toString()))
        .andExpect(jsonPath("$.data[0].displayName").value("Linh"));

    verify(chatService).searchUsers("linh", 10);
  }

  @Test
  @DisplayName("conversations list endpoint returns paginated conversations")
  void conversations_Success() throws Exception {
    Conversation conversation = new Conversation(
        conversationId,
        new PublicProfileClientResponse(recipientId, "Linh", null),
        "ACTIVE",
        "NONE",
        null,
        0,
        false,
        Instant.now(),
        true);
    when(chatService.conversations("all", null, 20))
        .thenReturn(new Page<>(List.of(conversation), null));

    mockMvc
        .perform(get("/api/social/chat/conversations")
            .param("filter", "all")
            .accept(MediaType.APPLICATION_JSON))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data.items[0].id").value(conversationId.toString()))
        .andExpect(jsonPath("$.data.items[0].state").value("ACTIVE"));

    verify(chatService).conversations("all", null, 20);
  }

  @Test
  @DisplayName("create returns 201 Created when a new draft conversation is created")
  void create_NewDraft_Returns201() throws Exception {
    Conversation conversation = new Conversation(
        conversationId,
        new PublicProfileClientResponse(recipientId, "Linh", null),
        "DRAFT",
        "NONE",
        null,
        0,
        false,
        Instant.now(),
        false);
    when(chatService.create(recipientId)).thenReturn(new CreateOutcome(conversation, true));

    mockMvc
        .perform(post("/api/social/chat/conversations")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(new CreateConversation(recipientId))))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data.id").value(conversationId.toString()))
        .andExpect(jsonPath("$.data.state").value("DRAFT"));

    verify(chatService).create(recipientId);
  }

  @Test
  @DisplayName("create returns 200 OK when conversation already exists")
  void create_ExistingConversation_Returns200() throws Exception {
    Conversation conversation = new Conversation(
        conversationId,
        new PublicProfileClientResponse(recipientId, "Linh", null),
        "ACTIVE",
        "NONE",
        null,
        0,
        false,
        Instant.now(),
        true);
    when(chatService.create(recipientId)).thenReturn(new CreateOutcome(conversation, false));

    mockMvc
        .perform(post("/api/social/chat/conversations")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(new CreateConversation(recipientId))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data.id").value(conversationId.toString()));

    verify(chatService).create(recipientId);
  }

  @Test
  @DisplayName("messages list endpoint returns paginated messages")
  void messages_Success() throws Exception {
    UUID messageId = UUID.randomUUID();
    Message message = new Message(
        messageId,
        UUID.randomUUID(),
        conversationId,
        "1",
        actorId,
        "TEXT",
        "Hello",
        null,
        Instant.now(),
        "sent");
    when(chatService.messages(conversationId, null, 30))
        .thenReturn(new Page<>(List.of(message), null));

    mockMvc
        .perform(get("/api/social/chat/conversations/" + conversationId + "/messages")
            .accept(MediaType.APPLICATION_JSON))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data.items[0].id").value(messageId.toString()))
        .andExpect(jsonPath("$.data.items[0].text").value("Hello"));

    verify(chatService).messages(conversationId, null, 30);
  }

  @Test
  @DisplayName("send message returns 201 when message is newly created")
  void send_NewMessage_Returns201() throws Exception {
    UUID clientMsgId = UUID.randomUUID();
    SendMessage request = new SendMessage(clientMsgId, "TEXT", "Hello!", null);
    Message message = new Message(
        UUID.randomUUID(),
        clientMsgId,
        conversationId,
        "10",
        actorId,
        "TEXT",
        "Hello!",
        null,
        Instant.now(),
        "sent");
    when(chatService.send(conversationId, request)).thenReturn(new SendOutcome(message, true));

    mockMvc
        .perform(post("/api/social/chat/conversations/" + conversationId + "/messages")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data.clientMessageId").value(clientMsgId.toString()))
        .andExpect(jsonPath("$.data.text").value("Hello!"));

    verify(chatService).send(conversationId, request);
  }

  @Test
  @DisplayName("send message returns 200 when duplicate key is retried identically")
  void send_DuplicateKeyRetry_Returns200() throws Exception {
    UUID clientMsgId = UUID.randomUUID();
    SendMessage request = new SendMessage(clientMsgId, "TEXT", "Hello!", null);
    Message message = new Message(
        UUID.randomUUID(),
        clientMsgId,
        conversationId,
        "10",
        actorId,
        "TEXT",
        "Hello!",
        null,
        Instant.now(),
        "sent");
    when(chatService.send(conversationId, request)).thenReturn(new SendOutcome(message, false));

    mockMvc
        .perform(post("/api/social/chat/conversations/" + conversationId + "/messages")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true));

    verify(chatService).send(conversationId, request);
  }

  @Test
  @DisplayName("delivered receipt endpoint updates delivery sequence")
  void delivered_Success() throws Exception {
    Receipt receipt = new Receipt("15");
    Conversation conversation = new Conversation(
        conversationId,
        new PublicProfileClientResponse(recipientId, "Linh", null),
        "ACTIVE",
        "NONE",
        null,
        0,
        false,
        Instant.now(),
        true);
    when(chatService.receipt(conversationId, receipt, false)).thenReturn(conversation);

    mockMvc
        .perform(put("/api/social/chat/conversations/" + conversationId + "/delivered")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(receipt)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true));

    verify(chatService).receipt(conversationId, receipt, false);
  }

  @Test
  @DisplayName("read receipt endpoint advances read cursor")
  void read_Success() throws Exception {
    Receipt receipt = new Receipt("15");
    Conversation conversation = new Conversation(
        conversationId,
        new PublicProfileClientResponse(recipientId, "Linh", null),
        "ACTIVE",
        "NONE",
        null,
        0,
        false,
        Instant.now(),
        true);
    when(chatService.receipt(conversationId, receipt, true)).thenReturn(conversation);

    mockMvc
        .perform(put("/api/social/chat/conversations/" + conversationId + "/read")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(receipt)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true));

    verify(chatService).receipt(conversationId, receipt, true);
  }

  @Test
  @DisplayName("accept request endpoint activates conversation")
  void accept_Success() throws Exception {
    Conversation conversation = new Conversation(
        conversationId,
        new PublicProfileClientResponse(recipientId, "Linh", null),
        "ACTIVE",
        "NONE",
        null,
        0,
        false,
        Instant.now(),
        true);
    when(chatService.requestDecision(conversationId, true)).thenReturn(conversation);

    mockMvc
        .perform(post("/api/social/chat/conversations/" + conversationId + "/accept"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data.state").value("ACTIVE"));

    verify(chatService).requestDecision(conversationId, true);
  }

  @Test
  @DisplayName("decline request endpoint marks conversation declined")
  void decline_Success() throws Exception {
    Conversation conversation = new Conversation(
        conversationId,
        new PublicProfileClientResponse(recipientId, "Linh", null),
        "DECLINED",
        "NONE",
        null,
        0,
        false,
        Instant.now(),
        false);
    when(chatService.requestDecision(conversationId, false)).thenReturn(conversation);

    mockMvc
        .perform(post("/api/social/chat/conversations/" + conversationId + "/decline"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data.state").value("DECLINED"));

    verify(chatService).requestDecision(conversationId, false);
  }

  @Test
  @DisplayName("mute endpoint updates muted state")
  void mute_Success() throws Exception {
    Conversation conversation = new Conversation(
        conversationId,
        new PublicProfileClientResponse(recipientId, "Linh", null),
        "ACTIVE",
        "NONE",
        null,
        0,
        true,
        Instant.now(),
        true);
    when(chatService.mute(conversationId, true)).thenReturn(conversation);

    mockMvc
        .perform(put("/api/social/chat/conversations/" + conversationId + "/mute")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(new Mute(true))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data.muted").value(true));

    verify(chatService).mute(conversationId, true);
  }

  @Test
  @DisplayName("block and unblock endpoints call chatService")
  void blockAndUnblock_Success() throws Exception {
    mockMvc
        .perform(post("/api/social/chat/blocks")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(new Block(recipientId))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true));

    verify(chatService).block(recipientId);

    mockMvc
        .perform(delete("/api/social/chat/blocks/" + recipientId))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true));

    verify(chatService).unblock(recipientId);
  }

  @Test
  @DisplayName("blocks list endpoint returns paginated blocked users")
  void blocks_Success() throws Exception {
    PublicProfileClientResponse blockedUser = new PublicProfileClientResponse(recipientId, "Blocked Person", null);
    when(chatService.blocks(null, 20)).thenReturn(new Page<>(List.of(blockedUser), null));

    mockMvc
        .perform(get("/api/social/chat/blocks")
            .accept(MediaType.APPLICATION_JSON))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data.items[0].userId").value(recipientId.toString()));

    verify(chatService).blocks(null, 20);
  }

  @Test
  @DisplayName("GET /api/social/chat/unread-summary returns unread count")
  void unreadSummary_Success() throws Exception {
    when(chatService.unreadSummary()).thenReturn(new UnreadSummary(2L, 5L));

    mockMvc
        .perform(get("/api/social/chat/unread-summary")
            .accept(MediaType.APPLICATION_JSON))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data.unreadConversationsCount").value(2))
        .andExpect(jsonPath("$.data.totalUnreadMessages").value(5));

    verify(chatService).unreadSummary();
  }

  @Test
  @DisplayName("POST /api/social/chat/devices/fcm-token registers FCM token")
  void registerFcmToken_Success() throws Exception {
    RegisterFcmToken request = new RegisterFcmToken("token-xyz", "WEB", "Safari");

    mockMvc
        .perform(post("/api/social/chat/devices/fcm-token")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true));

    verify(chatService).registerFcmToken(request);
  }

  @Test
  @DisplayName("DELETE /api/social/chat/devices/fcm-token unregisters FCM token")
  void unregisterFcmToken_Success() throws Exception {
    UnregisterFcmToken request = new UnregisterFcmToken("token-xyz");

    mockMvc
        .perform(delete("/api/social/chat/devices/fcm-token")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true));

    verify(chatService).unregisterFcmToken(request);
  }
}
