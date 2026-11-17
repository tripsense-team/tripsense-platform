package fu.tripsense.tripservice.partner.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import fu.tripsense.tripservice.partner.dto.RestaurantMenuImageUploadDto;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.multipart.MultipartFile;

@Service
public class RestaurantMenuImageStorage {
  private static final Logger log = LoggerFactory.getLogger(RestaurantMenuImageStorage.class);
  public static final long MAX_IMAGE_BYTES = 5L * 1024 * 1024;
  private static final Set<String> ALLOWED_MIME_TYPES = Set.of("image/jpeg", "image/png", "image/webp");
  private static final Set<String> ALLOWED_SECTIONS = Set.of("restaurant-menu", "rental-items");
  private static final String DEFAULT_SECTION = "restaurant-menu";

  private final String cloudName;
  private final String apiKey;
  private final String apiSecret;
  private final String folderPrefix;
  private final RestClient restClient;

  public RestaurantMenuImageStorage(
      @Value("${cloudinary.cloud-name:}") String cloudName,
      @Value("${cloudinary.api-key:}") String apiKey,
      @Value("${cloudinary.api-secret:}") String apiSecret,
      @Value("${cloudinary.partner-folder-prefix:tripsense/partners}") String folderPrefix) {
    this.cloudName = cloudName;
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.folderPrefix = folderPrefix;
    this.restClient = RestClient.create();
  }

  public RestaurantMenuImageUploadDto upload(UUID businessId, MultipartFile file) {
    return upload(businessId, DEFAULT_SECTION, file);
  }

  /** Uploads a verified partner image into Cloudinary under the allowed business section folder. */
  public RestaurantMenuImageUploadDto upload(UUID businessId, String section, MultipartFile file) {
    String validSection = requireValidSection(section);
    validate(file);
    requireConfigured();

    String folder = businessFolder(businessId, validSection);
    String assetId = UUID.randomUUID().toString();

    MultipartBodyBuilder body = new MultipartBodyBuilder();
    body.part("allowed_formats", "jpg,jpeg,png,webp");
    body.part("folder", folder);
    body.part("overwrite", "false");
    body.part("public_id", assetId);
    try {
      byte[] bytes = file.getBytes();
      ByteArrayResource resource = new ByteArrayResource(bytes) {
        @Override
        public String getFilename() {
          return safeFileName(file.getOriginalFilename());
        }
      };
      body.part("file", resource)
          .filename(safeFileName(file.getOriginalFilename()))
          .contentType(MediaType.parseMediaType(file.getContentType()));
      String response = restClient.post()
          .uri("https://api.cloudinary.com/v1_1/{cloudName}/image/upload", cloudName)
          .headers(headers -> headers.setBasicAuth(apiKey, apiSecret))
          .contentType(MediaType.MULTIPART_FORM_DATA)
          .body(body.build())
          .retrieve()
          .body(String.class);
      JsonNode result = new ObjectMapper().readTree(response);

      String publicId = result == null ? null : result.path("public_id").asText(null);
      String secureUrl = result == null ? null : result.path("secure_url").asText(null);
      if (!expectedPublicId(businessId, validSection, publicId) || !isTrustedDeliveryUrl(secureUrl)) {
        log.warn("Cloudinary partner image upload returned an invalid response (publicIdValid={}, secureUrlValid={})",
            expectedPublicId(businessId, validSection, publicId), isTrustedDeliveryUrl(secureUrl));
        throw new IllegalStateException("Image provider returned an invalid asset response");
      }
      return new RestaurantMenuImageUploadDto(publicId, secureUrl);
    } catch (RestClientResponseException exception) {
      log.warn("Cloudinary partner image upload rejected (httpStatus={})", exception.getStatusCode().value());
      throw new IllegalStateException("Partner image upload failed", exception);
    } catch (Exception exception) {
      log.warn("Cloudinary partner image upload failed (exceptionType={})", exception.getClass().getSimpleName());
      throw new IllegalStateException("Partner image upload failed", exception);
    }
  }

  public void delete(UUID businessId, String publicId) {
    delete(businessId, DEFAULT_SECTION, publicId);
  }

  /** Deletes an uploaded partner image from Cloudinary after checking section-scoped prefix ownership. */
  public void delete(UUID businessId, String section, String publicId) {
    String validSection = requireValidSection(section);
    requireConfigured();
    if (!expectedPublicId(businessId, validSection, publicId)) {
      throw new IllegalArgumentException("Invalid partner image reference");
    }
    MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
    body.add("public_id", publicId);
    restClient.post()
        .uri("https://api.cloudinary.com/v1_1/{cloudName}/image/destroy", cloudName)
        .headers(headers -> headers.setBasicAuth(apiKey, apiSecret))
        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
        .body(body)
        .retrieve()
        .toBodilessEntity();
  }

  public String imageUrl(String publicId) {
    if (publicId == null || publicId.isBlank() || cloudName.isBlank()) return null;
    return "https://res.cloudinary.com/" + cloudName + "/image/upload/f_auto,q_auto/" + publicId;
  }

  public boolean isValidReference(UUID businessId, String publicId) {
    return isValidReference(businessId, DEFAULT_SECTION, publicId);
  }

  public boolean isValidReference(UUID businessId, String section, String publicId) {
    String validSection = requireValidSection(section);
    return publicId == null || publicId.isBlank() || expectedPublicId(businessId, validSection, publicId);
  }

  private void validate(MultipartFile file) {
    if (file == null || file.isEmpty() || file.getSize() > MAX_IMAGE_BYTES) {
      throw new IllegalArgumentException("Image must be between 1 byte and 5 MB");
    }
    String contentType = file.getContentType();
    if (contentType == null || !ALLOWED_MIME_TYPES.contains(contentType.toLowerCase())) {
      throw new IllegalArgumentException("Unsupported image type");
    }
    try {
      byte[] header = file.getBytes();
      boolean matches = switch (contentType.toLowerCase()) {
        case "image/jpeg" -> header.length >= 3 && (header[0] & 0xff) == 0xff
            && (header[1] & 0xff) == 0xd8 && (header[2] & 0xff) == 0xff;
        case "image/png" -> header.length >= 8 && (header[0] & 0xff) == 0x89
            && header[1] == 0x50 && header[2] == 0x4e && header[3] == 0x47
            && header[4] == 0x0d && header[5] == 0x0a && header[6] == 0x1a && header[7] == 0x0a;
        case "image/webp" -> header.length >= 12 && new String(header, 0, 4, StandardCharsets.US_ASCII).equals("RIFF")
            && new String(header, 8, 4, StandardCharsets.US_ASCII).equals("WEBP");
        default -> false;
      };
      if (!matches) throw new IllegalArgumentException("Image content does not match its declared type");
    } catch (java.io.IOException exception) {
      throw new IllegalArgumentException("Unable to read image", exception);
    }
  }

  private void requireConfigured() {
    if (cloudName.isBlank() || apiKey.isBlank() || apiSecret.isBlank()) {
      throw new IllegalStateException("Restaurant menu image storage is not configured");
    }
  }

  private String requireValidSection(String section) {
    if (section == null || !ALLOWED_SECTIONS.contains(section)) {
      throw new IllegalArgumentException("Unsupported partner image section");
    }
    return section;
  }

  private String businessFolder(UUID businessId, String section) {
    return folderPrefix + "/" + businessId + "/" + section;
  }

  private boolean expectedPublicId(UUID businessId, String section, String publicId) {
    String prefix = businessFolder(businessId, section) + "/";
    if (publicId == null || !publicId.startsWith(prefix)) return false;
    try {
      UUID.fromString(publicId.substring(prefix.length()));
      return true;
    } catch (IllegalArgumentException exception) {
      return false;
    }
  }

  private boolean isTrustedDeliveryUrl(String url) {
    return url != null && url.startsWith("https://res.cloudinary.com/" + cloudName + "/image/upload/");
  }

  private String safeFileName(String fileName) {
    if (fileName == null || fileName.isBlank()) return "dish-image";
    String name = fileName.replaceAll("[^A-Za-z0-9._-]", "_");
    return name.length() > 120 ? name.substring(name.length() - 120) : name;
  }
}
