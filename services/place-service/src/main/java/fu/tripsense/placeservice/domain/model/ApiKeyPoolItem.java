package fu.tripsense.placeservice.domain.model;

import java.time.Instant;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Transient;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "api_key_pool")
@CompoundIndex(name = "provider_key_hash_idx", def = "{'provider': 1, 'keyHash': 1}", unique = true)
public class ApiKeyPoolItem {

  @Id @Builder.Default private String id = UUID.randomUUID().toString();

  @Indexed private ApiKeyProvider provider;

  /** Transient in-memory plaintext key. Never persisted directly to MongoDB. */
  @Transient private String rawKey;

  /** AES-GCM encrypted ciphertext (Base64 encoded). */
  private String encryptedKey;

  /** Deterministic SHA-256 hash of trimmed key for indexing and uniqueness lookups. */
  @Indexed private String keyHash;

  private String maskedKey;

  @Indexed @Builder.Default private ApiKeyStatus status = ApiKeyStatus.AVAILABLE;

  @Builder.Default private long successCount = 0;

  private String failureReason;

  private Instant lastUsedAt;

  private Instant exhaustedAt;

  @Builder.Default private Instant createdAt = Instant.now();

  public static String mask(String key) {
    if (key == null || key.isBlank()) return "";
    String trimmed = key.trim();
    if (trimmed.length() <= 10) return "***";
    int prefixLen = Math.min(6, trimmed.length() / 3);
    int suffixLen = Math.min(4, trimmed.length() / 3);
    return trimmed.substring(0, prefixLen)
        + "..."
        + trimmed.substring(trimmed.length() - suffixLen);
  }
}
