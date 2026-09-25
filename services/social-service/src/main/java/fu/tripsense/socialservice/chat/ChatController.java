package fu.tripsense.socialservice.chat;

import fu.tripsense.socialservice.chat.ChatDtos.*;
import fu.tripsense.socialservice.client.PublicProfileClientResponse;
import fu.tripsense.socialservice.dto.response.ApiResponse;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/social/chat")
@RequiredArgsConstructor
public class ChatController {
  private final ChatService chat;
  private final ChatRealtime realtime;

  @GetMapping(value="/events",produces=MediaType.TEXT_EVENT_STREAM_VALUE)
  public ResponseEntity<SseEmitter> events() {
    SseEmitter emitter=realtime.connect(chat.actorId());
    return ResponseEntity.ok().header(HttpHeaders.CACHE_CONTROL,"no-store")
        .header("X-Accel-Buffering","no").body(emitter);
  }

  @GetMapping("/unread-summary")
  public ApiResponse<UnreadSummary> unreadSummary() {
    return ApiResponse.success(chat.unreadSummary());
  }

  @PostMapping("/devices/fcm-token")
  public ApiResponse<Void> registerFcmToken(@RequestBody RegisterFcmToken request) {
    chat.registerFcmToken(request);
    return ApiResponse.success(null);
  }

  @DeleteMapping("/devices/fcm-token")
  public ApiResponse<Void> unregisterFcmToken(@RequestBody UnregisterFcmToken request) {
    chat.unregisterFcmToken(request);
    return ApiResponse.success(null);
  }

  @PostMapping("/devices/test-push")
  public ApiResponse<Boolean> testPushNotification() {
    boolean sent = chat.sendTestPushNotification();
    return ApiResponse.success(sent);
  }

  @GetMapping("/users")
  public ApiResponse<List<PublicProfileClientResponse>> users(@RequestParam String query,
      @RequestParam(defaultValue="10") int limit) {
    return ApiResponse.success(chat.searchUsers(query,limit));
  }

  @GetMapping("/conversations")
  public ApiResponse<Page<Conversation>> conversations(@RequestParam(defaultValue="all") String filter,
      @RequestParam(required=false) String cursor,@RequestParam(defaultValue="20") int limit) {
    return ApiResponse.success(chat.conversations(filter,cursor,limit));
  }

  @PostMapping("/conversations")
  public ResponseEntity<ApiResponse<Conversation>> create(@RequestBody CreateConversation request) {
    CreateOutcome outcome = chat.create(request.recipientId());
    return ResponseEntity.status(outcome.created() ? HttpStatus.CREATED : HttpStatus.OK)
        .body(ApiResponse.success(outcome.conversation()));
  }

  @GetMapping("/conversations/{id}/messages")
  public ApiResponse<Page<Message>> messages(@PathVariable UUID id,
      @RequestParam(required=false) String beforeSeq,@RequestParam(defaultValue="30") int limit) {
    return ApiResponse.success(chat.messages(id,beforeSeq,limit));
  }

  @PostMapping("/conversations/{id}/messages")
  public ResponseEntity<ApiResponse<Message>> send(@PathVariable UUID id,@RequestBody SendMessage request) {
    SendOutcome result=chat.send(id,request);
    return ResponseEntity.status(result.created()?HttpStatus.CREATED:HttpStatus.OK).body(ApiResponse.success(result.message()));
  }

  @PutMapping("/conversations/{id}/delivered")
  public ApiResponse<Conversation> delivered(@PathVariable UUID id,@RequestBody Receipt request) {
    return ApiResponse.success(chat.receipt(id,request,false));
  }

  @PutMapping("/conversations/{id}/read")
  public ApiResponse<Conversation> read(@PathVariable UUID id,@RequestBody Receipt request) {
    return ApiResponse.success(chat.receipt(id,request,true));
  }

  @PostMapping("/conversations/{id}/accept")
  public ApiResponse<Conversation> accept(@PathVariable UUID id) {
    return ApiResponse.success(chat.requestDecision(id,true));
  }

  @PostMapping("/conversations/{id}/decline")
  public ApiResponse<Conversation> decline(@PathVariable UUID id) {
    return ApiResponse.success(chat.requestDecision(id,false));
  }

  @PutMapping("/conversations/{id}/mute")
  public ApiResponse<Conversation> mute(@PathVariable UUID id,@RequestBody Mute request) {
    return ApiResponse.success(chat.mute(id,request.muted()));
  }

  @PostMapping("/blocks")
  public ApiResponse<Void> block(@RequestBody Block request) {
    chat.block(request.targetUserId()); return ApiResponse.success(null);
  }

  @DeleteMapping("/blocks/{targetUserId}")
  public ApiResponse<Void> unblock(@PathVariable UUID targetUserId) {
    chat.unblock(targetUserId); return ApiResponse.success(null);
  }

  @GetMapping("/blocks")
  public ApiResponse<Page<PublicProfileClientResponse>> blocks(@RequestParam(required=false) String cursor,
      @RequestParam(defaultValue="20") int limit) {
    return ApiResponse.success(chat.blocks(cursor,limit));
  }
}
