package fu.tripsense.socialservice.chat;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import fu.tripsense.socialservice.chat.ChatDtos.Decision;
import fu.tripsense.socialservice.chat.ChatDtos.Page;
import fu.tripsense.socialservice.chat.ChatDtos.Report;
import fu.tripsense.socialservice.chat.ChatDtos.ReportCase;
import fu.tripsense.socialservice.chat.ChatDtos.ReportReceipt;
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

@ExtendWith(MockitoExtension.class)
class ChatModerationControllerTest {

  private MockMvc mockMvc;

  @Mock private ChatService chatService;

  @InjectMocks private ChatModerationController controller;

  private final ObjectMapper objectMapper = new ObjectMapper();

  private final UUID conversationId = UUID.randomUUID();
  private final UUID reportId = UUID.randomUUID();
  private final UUID reportedUserId = UUID.randomUUID();
  private final UUID reporterId = UUID.randomUUID();

  @BeforeEach
  void setUp() {
    mockMvc = MockMvcBuilders.standaloneSetup(controller).build();
  }

  @Test
  @DisplayName("POST /api/social/chat/conversations/{id}/reports returns 201 Created and receipt")
  void report_Success() throws Exception {
    Report request = new Report(reportedUserId, null, "SPAM", "Spam messages");
    ReportReceipt receipt = new ReportReceipt(reportId, "PENDING");
    when(chatService.report(eq(conversationId), eq(request))).thenReturn(receipt);

    mockMvc
        .perform(post("/api/social/chat/conversations/" + conversationId + "/reports")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data.id").value(reportId.toString()))
        .andExpect(jsonPath("$.data.status").value("PENDING"));

    verify(chatService).report(eq(conversationId), eq(request));
  }

  @Test
  @DisplayName("GET /api/social/moderation/chat-reports returns 200 and paginated report cases")
  void reports_Success() throws Exception {
    ReportCase reportCase = new ReportCase(
        reportId,
        conversationId,
        reporterId,
        reportedUserId,
        "HARASSMENT",
        "Offensive language",
        "PENDING",
        Instant.now(),
        List.of());
    when(chatService.reports("PENDING", null, 20))
        .thenReturn(new Page<>(List.of(reportCase), null));

    mockMvc
        .perform(get("/api/social/moderation/chat-reports")
            .param("status", "PENDING")
            .accept(MediaType.APPLICATION_JSON))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data.items[0].id").value(reportId.toString()))
        .andExpect(jsonPath("$.data.items[0].reason").value("HARASSMENT"));

    verify(chatService).reports("PENDING", null, 20);
  }

  @Test
  @DisplayName("POST /api/social/moderation/chat-reports/{id}/decision returns 200 and receipt")
  void decision_Success() throws Exception {
    Decision request = new Decision("RESTRICT_CHAT", 24, "Repeated harassment");
    ReportReceipt receipt = new ReportReceipt(reportId, "ACTIONED");
    when(chatService.decide(eq(reportId), eq(request))).thenReturn(receipt);

    mockMvc
        .perform(post("/api/social/moderation/chat-reports/" + reportId + "/decision")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data.status").value("ACTIONED"));

    verify(chatService).decide(eq(reportId), eq(request));
  }
}
