package fu.tripsense.placeservice.controller;

import fu.tripsense.placeservice.dto.AdminPlaceCatalogDtos.Detail;
import fu.tripsense.placeservice.dto.AdminPlaceCatalogDtos.MutationRequest;
import fu.tripsense.placeservice.dto.AdminPlaceCatalogDtos.Page;
import fu.tripsense.placeservice.dto.ApiResponse;
import fu.tripsense.placeservice.exception.PlaceActionException;
import fu.tripsense.placeservice.security.AuthenticatedUser;
import fu.tripsense.placeservice.service.AdminPlaceCatalogService;
import jakarta.validation.Valid;
import java.net.URI;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.beans.factory.annotation.Value;

@RestController
@RequestMapping("/api/places/admin/catalog")
public class AdminPlaceCatalogController {
  private final AdminPlaceCatalogService service;
  private final boolean writesEnabled;

  public AdminPlaceCatalogController(AdminPlaceCatalogService service,
      @Value("${tripsense.places.admin.catalog-writes-enabled:false}") boolean writesEnabled) {
    this.service = service;
    this.writesEnabled = writesEnabled;
  }

  @GetMapping
  public ResponseEntity<ApiResponse<Page>> list(
      @RequestParam(required = false) String q,
      @RequestParam(defaultValue = "ACTIVE") String lifecycle,
      @RequestParam(defaultValue = "ALL") String source,
      @RequestParam(required = false) String category,
      @RequestParam(required = false) String city,
      @RequestParam(required = false) String cursor,
      @RequestParam(defaultValue = "24") int size) {
    return noStore(ApiResponse.ok(service.list(q, lifecycle, source, category, city, cursor, size)));
  }

  @GetMapping("/{placeId}")
  public ResponseEntity<ApiResponse<Detail>> detail(@PathVariable String placeId) {
    Detail detail = service.detail(placeId);
    return noStore(ApiResponse.ok(detail), detail.version());
  }

  @PostMapping
  public ResponseEntity<ApiResponse<Detail>> create(@Valid @RequestBody MutationRequest request,
      Authentication authentication) {
    requireWritesEnabled();
    Detail detail = service.create(request, actor(authentication));
    return ResponseEntity.created(URI.create("/api/places/admin/catalog/" + detail.id()))
        .cacheControl(CacheControl.noStore()).eTag(etag(detail.version())).body(ApiResponse.ok(detail));
  }

  @PutMapping("/{placeId}")
  public ResponseEntity<ApiResponse<Detail>> update(@PathVariable String placeId,
      @RequestHeader(value = HttpHeaders.IF_MATCH, required = false) String ifMatch,
      @Valid @RequestBody MutationRequest request, Authentication authentication) {
    requireWritesEnabled();
    Detail detail = service.update(placeId, revision(ifMatch), request, actor(authentication));
    return noStore(ApiResponse.ok(detail), detail.version());
  }

  @DeleteMapping("/{placeId}")
  public ResponseEntity<Void> archive(@PathVariable String placeId,
      @RequestHeader(value = HttpHeaders.IF_MATCH, required = false) String ifMatch,
      Authentication authentication) {
    requireWritesEnabled();
    service.archive(placeId, revision(ifMatch), actor(authentication));
    return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
  }

  @PostMapping("/{placeId}/restore")
  public ResponseEntity<ApiResponse<Detail>> restore(@PathVariable String placeId,
      @RequestHeader(value = HttpHeaders.IF_MATCH, required = false) String ifMatch,
      Authentication authentication) {
    requireWritesEnabled();
    Detail detail = service.restore(placeId, revision(ifMatch), actor(authentication));
    return noStore(ApiResponse.ok(detail), detail.version());
  }

  private String actor(Authentication authentication) {
    if (authentication == null || !(authentication.getPrincipal() instanceof AuthenticatedUser user))
      throw new PlaceActionException(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "Authentication is required");
    return user.id().toString();
  }

  private void requireWritesEnabled() {
    if (!writesEnabled) {
      throw new PlaceActionException(HttpStatus.SERVICE_UNAVAILABLE, "PLACE_ADMIN_WRITES_DISABLED",
          "Place catalog writes are temporarily disabled");
    }
  }

  private long revision(String value) {
    if (value == null || value.isBlank())
      throw new PlaceActionException(HttpStatus.PRECONDITION_REQUIRED, "PRECONDITION_REQUIRED", "If-Match revision is required");
    try {
      String raw = value.trim();
      if (!raw.startsWith("\"") || !raw.endsWith("\"")) throw new NumberFormatException();
      long parsed = Long.parseLong(raw.substring(1, raw.length() - 1));
      if (parsed < 0) throw new NumberFormatException();
      return parsed;
    } catch (NumberFormatException invalid) {
      throw new PlaceActionException(HttpStatus.BAD_REQUEST, "INVALID_REVISION", "If-Match revision is invalid");
    }
  }

  private String etag(long version) { return "\"" + version + "\""; }

  private <T> ResponseEntity<ApiResponse<T>> noStore(ApiResponse<T> body) {
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body);
  }

  private <T> ResponseEntity<ApiResponse<T>> noStore(ApiResponse<T> body, long version) {
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).eTag(etag(version)).body(body);
  }
}
