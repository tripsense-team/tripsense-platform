package fu.tripsense.placeservice.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Service;
import org.springframework.util.MultiValueMap;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

@Slf4j
@Service
public class PlaceCloudinaryStorageService {

  private static final int MAX_IMAGE_BYTES = 10 * 1024 * 1024;
  private static final int MAX_LIST_PAGES = 20;
  private static final int MAX_DOWNLOAD_ATTEMPTS = 3;
  private static final long INITIAL_DOWNLOAD_BACKOFF_MS = 250L;

  private final String cloudName;
  private final String apiKey;
  private final String apiSecret;
  private final String folderPrefix;
  private final RestClient restClient;
  private final HttpClient httpClient;
  private final ObjectMapper objectMapper;

  @Autowired
  public PlaceCloudinaryStorageService(
      @Value("${cloudinary.cloud-name:}") String cloudName,
      @Value("${cloudinary.api-key:}") String apiKey,
      @Value("${cloudinary.api-secret:}") String apiSecret,
      @Value("${cloudinary.place-folder-prefix:tripsense/places}") String folderPrefix) {
    this(
        cloudName,
        apiKey,
        apiSecret,
        folderPrefix,
        RestClient.builder().build(),
        HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(8))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build());
  }

  PlaceCloudinaryStorageService(
      String cloudName,
      String apiKey,
      String apiSecret,
      String folderPrefix,
      RestClient restClient,
      HttpClient httpClient) {
    this.cloudName = cloudName != null ? cloudName.trim() : "";
    this.apiKey = apiKey != null ? apiKey.trim() : "";
    this.apiSecret = apiSecret != null ? apiSecret.trim() : "";
    this.folderPrefix =
        folderPrefix != null ? folderPrefix.trim().replaceAll("^/+|/+$", "") : "tripsense/places";
    this.restClient = restClient;
    this.httpClient = httpClient;
    this.objectMapper = new ObjectMapper();
  }

  public boolean isConfigured() {
    return StringUtils.hasText(cloudName)
        && StringUtils.hasText(apiKey)
        && StringUtils.hasText(apiSecret);
  }

  public boolean isCloudinaryUrl(String url) {
    return isPermanentCloudinaryUrl(url);
  }

  /** Verifies that a URL uses http(s) and points directly to Cloudinary's CDN host. */
  public static boolean isPermanentCloudinaryUrl(String url) {
    if (!StringUtils.hasText(url)) {
      return false;
    }
    try {
      URI uri = URI.create(url.trim());
      String scheme = uri.getScheme();
      String host = uri.getHost();
      if (scheme == null || host == null) {
        return false;
      }
      boolean validScheme =
          scheme.equalsIgnoreCase("https") || scheme.equalsIgnoreCase("http");
      String lowerHost = host.toLowerCase(Locale.ROOT);
      return validScheme
          && (lowerHost.equals("res.cloudinary.com") || lowerHost.endsWith(".res.cloudinary.com"));
    } catch (Exception ex) {
      return false;
    }
  }

  /**
   * Downloads validated image bytes from the remote provider URL and uploads them permanently to
   * Cloudinary under the place's folder. Never asks Cloudinary to fetch an unvalidated remote HTML
   * response.
   *
   * @param remoteUrl Active URL of the image (e.g., from ZioMap/Google)
   * @param providerPlaceId Unique provider place id used to isolate photos in folders
   * @param photoIndex Index of the photo in the gallery
   * @return The permanent Cloudinary secure URL, or empty if download/validation/upload fails
   */
  public Optional<String> uploadRemotePhoto(
      String remoteUrl, String providerPlaceId, int photoIndex) {
    if (!StringUtils.hasText(remoteUrl)) {
      return Optional.empty();
    }
    if (isCloudinaryUrl(remoteUrl)) {
      return Optional.of(remoteUrl);
    }
    if (!isConfigured()) {
      log.debug("Cloudinary is not configured; skipping permanent photo upload");
      return Optional.empty();
    }

    Optional<DownloadedImage> downloaded = downloadValidatedImage(remoteUrl);
    if (downloaded.isEmpty()) {
      return Optional.empty();
    }

    try {
      String cleanPlaceId = safeIdentifier(providerPlaceId);
      String folder = folderPrefix + "/" + cleanPlaceId;
      String publicId = "photo_" + photoIndex;
      DownloadedImage image = downloaded.get();

      MultipartBodyBuilder builder = new MultipartBodyBuilder();
      builder
          .part(
              "file",
              new ByteArrayResource(image.bytes()) {
                @Override
                public String getFilename() {
                  return publicId + "." + image.extension();
                }
              })
          .contentType(MediaType.parseMediaType(image.contentType()));
      builder.part("folder", folder);
      builder.part("public_id", publicId);
      builder.part("overwrite", "true");
      MultiValueMap<String, ?> body = builder.build();

      String response =
          restClient
              .post()
              .uri("https://api.cloudinary.com/v1_1/{cloudName}/image/upload", cloudName)
              .headers(headers -> headers.setBasicAuth(apiKey, apiSecret))
              .contentType(MediaType.MULTIPART_FORM_DATA)
              .body(body)
              .retrieve()
              .body(String.class);

      JsonNode result = objectMapper.readTree(response);
      String secureUrl = result != null ? result.path("secure_url").asText(null) : null;
      if (isCloudinaryUrl(secureUrl)) {
        log.info(
            "Uploaded place photo permanently to Cloudinary: {}/{} -> {}",
            folder,
            publicId,
            secureUrl);
        return Optional.of(secureUrl);
      }
    } catch (RestClientResponseException ex) {
      log.warn(
          "Cloudinary photo upload rejected for place '{}' (status {}): {}",
          providerPlaceId,
          ex.getStatusCode(),
          ex.getResponseBodyAsString());
    } catch (Exception ex) {
      log.warn(
          "Cloudinary photo upload failed for place '{}': {}",
          providerPlaceId,
          ex.getMessage());
    }
    return Optional.empty();
  }

  /**
   * Lists existing place photos already stored in Cloudinary under {@code folderPrefix/<placeId>/}
   * so MongoDB references can be recovered without external provider API calls.
   */
  public Map<String, List<String>> listExistingPlacePhotos() {
    if (!isConfigured()) {
      return Map.of();
    }
    Map<String, List<CloudinaryResourceRef>> grouped = new LinkedHashMap<>();
    String prefixWithSlash = folderPrefix + "/";
    String nextCursor = null;

    for (int page = 0; page < MAX_LIST_PAGES; page++) {
      try {
        StringBuilder uriBuilder =
            new StringBuilder("https://api.cloudinary.com/v1_1/")
                .append(cloudName)
                .append("/resources/image/upload?prefix=")
                .append(URLEncoder.encode(prefixWithSlash, StandardCharsets.UTF_8))
                .append("&max_results=500");
        if (StringUtils.hasText(nextCursor)) {
          uriBuilder
              .append("&next_cursor=")
              .append(URLEncoder.encode(nextCursor, StandardCharsets.UTF_8));
        }

        String response =
            restClient
                .get()
                .uri(URI.create(uriBuilder.toString()))
                .headers(headers -> headers.setBasicAuth(apiKey, apiSecret))
                .retrieve()
                .body(String.class);

        JsonNode root = objectMapper.readTree(response);
        JsonNode resources = root != null ? root.path("resources") : null;
        if (resources != null && resources.isArray()) {
          for (JsonNode item : resources) {
            String publicId = item.path("public_id").asText("");
            String secureUrl = item.path("secure_url").asText("");
            if (!publicId.startsWith(prefixWithSlash) || !isCloudinaryUrl(secureUrl)) {
              continue;
            }
            String remainder = publicId.substring(prefixWithSlash.length());
            int slashIdx = remainder.indexOf('/');
            if (slashIdx <= 0) {
              continue;
            }
            String folderKey = remainder.substring(0, slashIdx);
            grouped
                .computeIfAbsent(folderKey, ignored -> new ArrayList<>())
                .add(new CloudinaryResourceRef(publicId, secureUrl));
          }
        }
        nextCursor = root != null ? root.path("next_cursor").asText(null) : null;
        if (!StringUtils.hasText(nextCursor)) {
          break;
        }
      } catch (Exception ex) {
        log.warn("Failed to list Cloudinary place photos on page {}: {}", page, ex.getMessage());
        break;
      }
    }

    Map<String, List<String>> result = new TreeMap<>();
    grouped.forEach(
        (key, refs) -> {
          refs.sort(Comparator.comparing(CloudinaryResourceRef::publicId));
          result.put(key, refs.stream().map(CloudinaryResourceRef::secureUrl).distinct().toList());
        });
    return result;
  }

  Optional<DownloadedImage> downloadValidatedImage(String remoteUrl) {
    if (!StringUtils.hasText(remoteUrl)) {
      return Optional.empty();
    }
    URI uri;
    try {
      uri = URI.create(remoteUrl.trim());
    } catch (IllegalArgumentException ex) {
      log.warn("Invalid remote photo URL: {}", ex.getMessage());
      return Optional.empty();
    }
    String scheme = uri.getScheme();
    if (scheme == null
        || (!scheme.equalsIgnoreCase("https") && !scheme.equalsIgnoreCase("http"))) {
      return Optional.empty();
    }
    HttpRequest request =
        HttpRequest.newBuilder(uri)
            .timeout(Duration.ofSeconds(10))
            .header("User-Agent", "TripSense-PlaceService/1.0")
            .header("Accept", "image/jpeg,image/png,image/webp,image/*")
            .GET()
            .build();

    HttpResponse<byte[]> response = null;
    for (int attempt = 1; attempt <= MAX_DOWNLOAD_ATTEMPTS; attempt++) {
      try {
        HttpResponse<byte[]> candidate =
            httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());
        if (candidate.statusCode() == 200) {
          response = candidate;
          break;
        }
        if (attempt < MAX_DOWNLOAD_ATTEMPTS && isRetryableDownloadStatus(candidate.statusCode())) {
          long delayMs = INITIAL_DOWNLOAD_BACKOFF_MS * attempt;
          log.warn(
              "Remote photo download returned HTTP {} for host '{}'; retrying in {}ms (attempt {}/{})",
              candidate.statusCode(),
              uri.getHost(),
              delayMs,
              attempt,
              MAX_DOWNLOAD_ATTEMPTS);
          if (!sleepBackoff(delayMs)) {
            return Optional.empty();
          }
          continue;
        }
        log.warn(
            "Remote photo download returned HTTP {} for host '{}'",
            candidate.statusCode(),
            uri.getHost());
        return Optional.empty();
      } catch (InterruptedException ex) {
        Thread.currentThread().interrupt();
        log.warn("Remote photo download interrupted for host '{}'", uri.getHost());
        return Optional.empty();
      } catch (IOException ex) {
        if (attempt < MAX_DOWNLOAD_ATTEMPTS) {
          long delayMs = INITIAL_DOWNLOAD_BACKOFF_MS * attempt;
          log.warn(
              "Remote photo download I/O error ({}) for host '{}'; retrying in {}ms (attempt {}/{})",
              ex.getClass().getSimpleName(),
              uri.getHost(),
              delayMs,
              attempt,
              MAX_DOWNLOAD_ATTEMPTS);
          if (!sleepBackoff(delayMs)) {
            return Optional.empty();
          }
          continue;
        }
        log.warn("Remote photo download failed: {}", ex.getMessage());
        return Optional.empty();
      } catch (Exception ex) {
        log.warn("Remote photo download failed: {}", ex.getMessage());
        return Optional.empty();
      }
    }

    if (response == null) {
      return Optional.empty();
    }
    byte[] bytes = response.body();
    if (bytes == null || bytes.length == 0 || bytes.length > MAX_IMAGE_BYTES) {
      log.warn(
          "Remote photo byte size invalid ({} bytes) for host '{}'",
          bytes == null ? 0 : bytes.length,
          uri.getHost());
      return Optional.empty();
    }
    String headerContentType = response.headers().firstValue("content-type").orElse("");
    if (StringUtils.hasText(headerContentType)
        && !headerContentType.toLowerCase(Locale.ROOT).startsWith("image/")) {
      log.warn(
          "Remote photo download returned non-image content-type '{}' for host '{}'",
          headerContentType,
          uri.getHost());
      return Optional.empty();
    }
    Optional<ImageFormat> format = detectImageFormat(bytes);
    if (format.isEmpty()) {
      log.warn("Remote photo bytes failed image magic-byte check for host '{}'", uri.getHost());
      return Optional.empty();
    }
    return Optional.of(
        new DownloadedImage(bytes, format.get().mimeType(), format.get().extension()));
  }

  private static boolean isRetryableDownloadStatus(int statusCode) {
    return statusCode == 408 || statusCode == 429 || statusCode >= 500;
  }

  private static boolean sleepBackoff(long delayMs) {
    try {
      Thread.sleep(delayMs);
      return true;
    } catch (InterruptedException ex) {
      Thread.currentThread().interrupt();
      return false;
    }
  }

  private static Optional<ImageFormat> detectImageFormat(byte[] bytes) {
    if (bytes.length >= 3
        && (bytes[0] & 0xFF) == 0xFF
        && (bytes[1] & 0xFF) == 0xD8
        && (bytes[2] & 0xFF) == 0xFF) {
      return Optional.of(new ImageFormat("image/jpeg", "jpg"));
    }
    if (bytes.length >= 4
        && (bytes[0] & 0xFF) == 0x89
        && bytes[1] == 'P'
        && bytes[2] == 'N'
        && bytes[3] == 'G') {
      return Optional.of(new ImageFormat("image/png", "png"));
    }
    if (bytes.length >= 4
        && bytes[0] == 'G'
        && bytes[1] == 'I'
        && bytes[2] == 'F'
        && bytes[3] == '8') {
      return Optional.of(new ImageFormat("image/gif", "gif"));
    }
    if (bytes.length >= 12
        && bytes[0] == 'R'
        && bytes[1] == 'I'
        && bytes[2] == 'F'
        && bytes[3] == 'F'
        && bytes[8] == 'W'
        && bytes[9] == 'E'
        && bytes[10] == 'B'
        && bytes[11] == 'P') {
      return Optional.of(new ImageFormat("image/webp", "webp"));
    }
    return Optional.empty();
  }

  public String safeIdentifier(String id) {
    if (!StringUtils.hasText(id)) {
      return "default";
    }
    return id.replaceAll("[^A-Za-z0-9._-]", "_");
  }

  record DownloadedImage(byte[] bytes, String contentType, String extension) {}

  private record ImageFormat(String mimeType, String extension) {}

  private record CloudinaryResourceRef(String publicId, String secureUrl) {}
}

