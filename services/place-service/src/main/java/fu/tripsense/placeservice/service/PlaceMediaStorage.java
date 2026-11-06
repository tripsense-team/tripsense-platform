package fu.tripsense.placeservice.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Set;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.multipart.MultipartFile;

@Slf4j
@Service
public class PlaceMediaStorage {
  public static final long MAX_IMAGE_BYTES = 10L * 1024 * 1024;
  private static final long MAX_PIXELS = 40_000_000L;
  private static final int MAX_DIMENSION = 12_000;
  private static final Set<String> ALLOWED_MIME =
      Set.of("image/jpeg", "image/png", "image/webp");

  private final String cloudName;
  private final String apiKey;
  private final String apiSecret;
  private final String folderPrefix;
  private final Set<String> providerHosts;
  private final RestClient restClient;
  private final HttpClient httpClient;
  private final ObjectMapper objectMapper;

  public PlaceMediaStorage(
      @Value("${cloudinary.cloud-name:}") String cloudName,
      @Value("${cloudinary.api-key:}") String apiKey,
      @Value("${cloudinary.api-secret:}") String apiSecret,
      @Value("${cloudinary.place-folder-prefix:tripsense/places}") String folderPrefix,
      @Value("${ziomap.photo-allowed-hosts:lh3.googleusercontent.com,ziomap-api.socibi.com}")
          String providerHosts,
      ObjectMapper objectMapper) {
    this.cloudName = cloudName.trim();
    this.apiKey = apiKey.trim();
    this.apiSecret = apiSecret.trim();
    this.folderPrefix = folderPrefix.replaceAll("^/+|/+$", "");
    this.providerHosts =
        java.util.Arrays.stream(providerHosts.split(","))
            .map(String::trim)
            .map(value -> value.toLowerCase(Locale.ROOT))
            .filter(value -> !value.isBlank())
            .collect(java.util.stream.Collectors.toUnmodifiableSet());
    this.objectMapper = objectMapper;
    this.restClient = RestClient.create();
    this.httpClient =
        HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .followRedirects(HttpClient.Redirect.NEVER)
            .build();
  }

  public StoredMedia upload(String placeId, String assetId, MultipartFile file) {
    try {
      String declaredType = normalizeMime(file == null ? null : file.getContentType());
      byte[] bytes = file == null ? new byte[0] : file.getBytes();
      return upload(placeId, assetId, bytes, declaredType, safeFileName(file == null ? null : file.getOriginalFilename()));
    } catch (IOException exception) {
      throw new IllegalArgumentException("Unable to read image", exception);
    }
  }

  public StoredMedia importProviderUrl(String placeId, String assetId, String url) {
    URI uri = trustedProviderUri(url);
    try {
      HttpRequest request =
          HttpRequest.newBuilder(uri)
              .timeout(Duration.ofSeconds(12))
              .header("Accept", "image/jpeg,image/png,image/webp")
              .GET()
              .build();
      HttpResponse<java.io.InputStream> response =
          httpClient.send(request, HttpResponse.BodyHandlers.ofInputStream());
      if (response.statusCode() != 200) {
        throw new IllegalStateException("Provider image is unavailable");
      }
      long declaredLength =
          response.headers().firstValueAsLong("Content-Length").orElse(-1L);
      if (declaredLength > MAX_IMAGE_BYTES) {
        throw new IllegalArgumentException("Image exceeds 10 MB");
      }
      String contentType =
          normalizeMime(response.headers().firstValue("Content-Type").orElse(null));
      byte[] bytes = readBounded(response.body());
      return upload(placeId, assetId, bytes, contentType, "provider-image");
    } catch (InterruptedException exception) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException("Provider image import was interrupted", exception);
    } catch (IOException exception) {
      throw new IllegalStateException("Provider image import failed", exception);
    }
  }

  public StoredMedia upload(
      String placeId, String assetId, byte[] bytes, String declaredType, String fileName) {
    ValidatedImage validated = validate(bytes, declaredType);
    requireConfigured();
    String publicId = publicId(placeId, assetId);
    long timestamp = Instant.now().getEpochSecond();
    String signature =
        sign(
            "folder="
                + folder(placeId)
                + "&overwrite=false&public_id="
                + assetId
                + "&timestamp="
                + timestamp);

    MultipartBodyBuilder body = new MultipartBodyBuilder();
    body.part("api_key", apiKey);
    body.part("folder", folder(placeId));
    body.part("overwrite", "false");
    body.part("public_id", assetId);
    body.part("signature", signature);
    body.part("timestamp", Long.toString(timestamp));
    ByteArrayResource resource =
        new ByteArrayResource(bytes) {
          @Override
          public String getFilename() {
            return fileName;
          }
        };
    body.part("file", resource)
        .filename(fileName)
        .contentType(MediaType.parseMediaType(validated.mimeType()));
    try {
      String response =
          restClient
              .post()
              .uri("https://api.cloudinary.com/v1_1/{cloudName}/image/upload", cloudName)
              .contentType(MediaType.MULTIPART_FORM_DATA)
              .body(body.build())
              .retrieve()
              .body(String.class);
      JsonNode result = objectMapper.readTree(response);
      String returnedPublicId = result.path("public_id").asText("");
      String secureUrl = result.path("secure_url").asText("");
      if (!publicId.equals(returnedPublicId) || !trustedDeliveryUrl(secureUrl)) {
        throw new IllegalStateException("Image provider returned an invalid asset response");
      }
      return new StoredMedia(
          publicId,
          deliveryUrl(publicId),
          validated.mimeType(),
          bytes.length,
          result.path("width").asInt(validated.width()),
          result.path("height").asInt(validated.height()),
          sha256(bytes));
    } catch (RestClientResponseException exception) {
      log.warn("Cloudinary place upload rejected status={}", exception.getStatusCode().value());
      throw new IllegalStateException("Place image upload failed", exception);
    } catch (Exception exception) {
      log.warn("Cloudinary place upload failed type={}", exception.getClass().getSimpleName());
      throw new IllegalStateException("Place image upload failed", exception);
    }
  }

  public void delete(String placeId, String publicId) {
    requireConfigured();
    if (!expectedPublicId(placeId, publicId)) {
      throw new IllegalArgumentException("Invalid place image reference");
    }
    long timestamp = Instant.now().getEpochSecond();
    String signature = sign("invalidate=true&public_id=" + publicId + "&timestamp=" + timestamp);
    MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
    body.add("api_key", apiKey);
    body.add("invalidate", "true");
    body.add("public_id", publicId);
    body.add("signature", signature);
    body.add("timestamp", Long.toString(timestamp));
    restClient
        .post()
        .uri("https://api.cloudinary.com/v1_1/{cloudName}/image/destroy", cloudName)
        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
        .body(body)
        .retrieve()
        .toBodilessEntity();
  }

  public String deliveryUrl(String publicId) {
    if (cloudName.isBlank() || publicId == null || publicId.isBlank()) return null;
    return "https://res.cloudinary.com/"
        + cloudName
        + "/image/upload/f_auto,q_auto/"
        + publicId;
  }

  public boolean configured() {
    return !cloudName.isBlank() && !apiKey.isBlank() && !apiSecret.isBlank();
  }

  public boolean healthy(String publicId) {
    String url = deliveryUrl(publicId);
    if (url == null) return false;
    try {
      HttpRequest request =
          HttpRequest.newBuilder(URI.create(url))
              .timeout(Duration.ofSeconds(5))
              .method("HEAD", HttpRequest.BodyPublishers.noBody())
              .build();
      int status = httpClient.send(request, HttpResponse.BodyHandlers.discarding()).statusCode();
      return status >= 200 && status < 400;
    } catch (InterruptedException exception) {
      Thread.currentThread().interrupt();
      return false;
    } catch (RuntimeException | IOException exception) {
      return false;
    }
  }

  private ValidatedImage validate(byte[] bytes, String declaredType) {
    if (bytes == null || bytes.length == 0 || bytes.length > MAX_IMAGE_BYTES) {
      throw new IllegalArgumentException("Image must be between 1 byte and 10 MB");
    }
    String detected = detectMime(bytes);
    if (!ALLOWED_MIME.contains(detected)
        || (declaredType != null && !declaredType.equals(detected))) {
      throw new IllegalArgumentException("Image content does not match an allowed type");
    }
    int[] dimensions = dimensions(bytes, detected);
    if (dimensions[0] < 1
        || dimensions[1] < 1
        || dimensions[0] > MAX_DIMENSION
        || dimensions[1] > MAX_DIMENSION
        || (long) dimensions[0] * dimensions[1] > MAX_PIXELS) {
      throw new IllegalArgumentException("Image dimensions are unsafe");
    }
    return new ValidatedImage(detected, dimensions[0], dimensions[1]);
  }

  private int[] dimensions(byte[] bytes, String mimeType) {
    if ("image/webp".equals(mimeType)) return webpDimensions(bytes);
    try (ImageInputStream input = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
      var readers = ImageIO.getImageReaders(input);
      if (!readers.hasNext()) throw new IllegalArgumentException("Image cannot be decoded");
      ImageReader reader = readers.next();
      try {
        reader.setInput(input, true, true);
        return new int[] {reader.getWidth(0), reader.getHeight(0)};
      } finally {
        reader.dispose();
      }
    } catch (IOException exception) {
      throw new IllegalArgumentException("Image cannot be decoded", exception);
    }
  }

  private int[] webpDimensions(byte[] bytes) {
    if (bytes.length < 30) throw new IllegalArgumentException("WebP image is incomplete");
    String chunk = new String(bytes, 12, 4, StandardCharsets.US_ASCII);
    if ("VP8X".equals(chunk)) {
      return new int[] {1 + le24(bytes, 24), 1 + le24(bytes, 27)};
    }
    if ("VP8L".equals(chunk) && bytes.length >= 25 && (bytes[20] & 0xff) == 0x2f) {
      int b1 = bytes[21] & 0xff;
      int b2 = bytes[22] & 0xff;
      int b3 = bytes[23] & 0xff;
      int b4 = bytes[24] & 0xff;
      return new int[] {1 + b1 + ((b2 & 0x3f) << 8), 1 + (b2 >> 6) + (b3 << 2) + ((b4 & 0x0f) << 10)};
    }
    if ("VP8 ".equals(chunk) && bytes.length >= 30) {
      int width = ByteBuffer.wrap(bytes, 26, 2).order(ByteOrder.LITTLE_ENDIAN).getShort() & 0x3fff;
      int height = ByteBuffer.wrap(bytes, 28, 2).order(ByteOrder.LITTLE_ENDIAN).getShort() & 0x3fff;
      return new int[] {width, height};
    }
    throw new IllegalArgumentException("Unsupported WebP layout");
  }

  private int le24(byte[] bytes, int offset) {
    return (bytes[offset] & 0xff)
        | ((bytes[offset + 1] & 0xff) << 8)
        | ((bytes[offset + 2] & 0xff) << 16);
  }

  private String detectMime(byte[] bytes) {
    if (bytes.length >= 3
        && (bytes[0] & 0xff) == 0xff
        && (bytes[1] & 0xff) == 0xd8
        && (bytes[2] & 0xff) == 0xff) return "image/jpeg";
    if (bytes.length >= 8
        && (bytes[0] & 0xff) == 0x89
        && bytes[1] == 0x50
        && bytes[2] == 0x4e
        && bytes[3] == 0x47
        && bytes[4] == 0x0d
        && bytes[5] == 0x0a
        && bytes[6] == 0x1a
        && bytes[7] == 0x0a) return "image/png";
    if (bytes.length >= 12
        && "RIFF".equals(new String(bytes, 0, 4, StandardCharsets.US_ASCII))
        && "WEBP".equals(new String(bytes, 8, 4, StandardCharsets.US_ASCII))) return "image/webp";
    return "application/octet-stream";
  }

  private URI trustedProviderUri(String value) {
    try {
      URI uri = URI.create(value);
      String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);
      boolean approved = providerHosts.stream().anyMatch(item -> host.equals(item) || host.endsWith("." + item));
      if (!"https".equalsIgnoreCase(uri.getScheme())
          || uri.getUserInfo() != null
          || uri.getPort() != -1
          || !approved) {
        throw new IllegalArgumentException("Provider image host is not approved");
      }
      return uri;
    } catch (IllegalArgumentException exception) {
      throw new IllegalArgumentException("Provider image URL is invalid", exception);
    }
  }

  private byte[] readBounded(java.io.InputStream input) throws IOException {
    try (input; ByteArrayOutputStream output = new ByteArrayOutputStream()) {
      byte[] buffer = new byte[8192];
      int total = 0;
      for (int read; (read = input.read(buffer)) != -1; ) {
        total += read;
        if (total > MAX_IMAGE_BYTES) throw new IllegalArgumentException("Image exceeds 10 MB");
        output.write(buffer, 0, read);
      }
      return output.toByteArray();
    }
  }

  private void requireConfigured() {
    if (!configured()) throw new IllegalStateException("Place image storage is not configured");
  }

  private String folder(String placeId) {
    return folderPrefix + "/" + safeId(placeId);
  }

  private String publicId(String placeId, String assetId) {
    return folder(placeId) + "/" + safeId(assetId);
  }

  private boolean expectedPublicId(String placeId, String publicId) {
    return publicId != null && publicId.startsWith(folder(placeId) + "/") && !publicId.contains("..");
  }

  private String safeId(String value) {
    if (value == null || !value.matches("[A-Za-z0-9._:-]{1,200}")) {
      throw new IllegalArgumentException("Invalid media identifier");
    }
    return value;
  }

  private String normalizeMime(String value) {
    if (value == null || value.isBlank()) return null;
    return value.split(";", 2)[0].trim().toLowerCase(Locale.ROOT);
  }

  private String safeFileName(String value) {
    if (value == null || value.isBlank()) return "place-image";
    String name = value.replaceAll("[^A-Za-z0-9._-]", "_");
    return name.length() > 120 ? name.substring(name.length() - 120) : name;
  }

  private String sign(String parameters) {
    try {
      return HexFormat.of()
          .formatHex(
              MessageDigest.getInstance("SHA-1")
                  .digest((parameters + apiSecret).getBytes(StandardCharsets.UTF_8)));
    } catch (Exception exception) {
      throw new IllegalStateException("Unable to sign image request", exception);
    }
  }

  private String sha256(byte[] bytes) {
    try {
      return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
    } catch (Exception exception) {
      throw new IllegalStateException("Unable to fingerprint image", exception);
    }
  }

  private boolean trustedDeliveryUrl(String url) {
    return url != null
        && url.startsWith("https://res.cloudinary.com/" + cloudName + "/image/upload/");
  }

  private record ValidatedImage(String mimeType, int width, int height) {}

  public record StoredMedia(
      String publicId,
      String url,
      String mimeType,
      long byteSize,
      int width,
      int height,
      String checksumSha256) {}
}
