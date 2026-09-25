package fu.tripsense.socialservice.chat;

import fu.tripsense.socialservice.chat.ChatDtos.*;
import fu.tripsense.socialservice.dto.response.ApiResponse;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

@RestController
@RequiredArgsConstructor
public class ChatModerationController {
  private final ChatService chat;

  @PostMapping("/api/social/chat/conversations/{id}/reports")
  public ResponseEntity<ApiResponse<ReportReceipt>> report(@PathVariable UUID id, @RequestBody Report request) {
    return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(chat.report(id, request)));
  }

  @GetMapping("/api/social/moderation/chat-reports")
  public ApiResponse<Page<ReportCase>> reports(@RequestParam(defaultValue="PENDING") String status,
      @RequestParam(required=false) String cursor,@RequestParam(defaultValue="20") int limit) {
    return ApiResponse.success(chat.reports(status,cursor,limit));
  }

  @PostMapping("/api/social/moderation/chat-reports/{id}/decision")
  public ApiResponse<ReportReceipt> decision(@PathVariable UUID id,@RequestBody Decision request) {
    return ApiResponse.success(chat.decide(id,request));
  }
}
