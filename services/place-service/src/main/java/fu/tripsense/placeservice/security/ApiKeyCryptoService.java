package fu.tripsense.placeservice.security;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Encrypts and decrypts third-party API credentials stored in MongoDB using AES-GCM-256. Generates
 * deterministic SHA-256 hashes for indexed lookups without exposing credentials.
 */
@Slf4j
@Service
public class ApiKeyCryptoService {

  private static final String ALGORITHM = "AES/GCM/NoPadding";
  private static final int GCM_IV_LENGTH_BYTES = 12;
  private static final int GCM_TAG_LENGTH_BITS = 128;
  private static final String DEFAULT_SECRET = "tripsense-default-api-key-encryption-secret-32b";

  private final SecretKey primarySecretKey;
  private final SecretKey fallbackDefaultKey;
  private final SecureRandom secureRandom = new SecureRandom();

  public ApiKeyCryptoService(
      @Value(
              "${tripsense.places.encryption-secret:tripsense-default-api-key-encryption-secret-32b}")
          String secret) {
    try {
      String effectiveSecret =
          (secret == null || secret.isBlank()) ? DEFAULT_SECRET : secret.trim();
      this.primarySecretKey = deriveKey(effectiveSecret);
      this.fallbackDefaultKey = deriveKey(DEFAULT_SECRET);

      if (DEFAULT_SECRET.equals(effectiveSecret)) {
        log.warn(
            "[ApiKeyCryptoService] Using default encryption secret. Set API_KEY_ENCRYPTION_SECRET in production!");
      }
    } catch (Exception e) {
      throw new IllegalStateException("Failed to initialize AES key for ApiKeyCryptoService", e);
    }
  }

  private SecretKey deriveKey(String secret) throws NoSuchAlgorithmException {
    MessageDigest sha = MessageDigest.getInstance("SHA-256");
    byte[] keyBytes = sha.digest(secret.getBytes(StandardCharsets.UTF_8));
    return new SecretKeySpec(keyBytes, "AES");
  }

  /** Encrypts plaintext API key into Base64 encoded payload: [12-byte IV + AES-GCM ciphertext]. */
  public String encrypt(String plaintext) {
    if (plaintext == null || plaintext.trim().isEmpty()) {
      return null;
    }
    try {
      byte[] iv = new byte[GCM_IV_LENGTH_BYTES];
      secureRandom.nextBytes(iv);

      Cipher cipher = Cipher.getInstance(ALGORITHM);
      cipher.init(Cipher.ENCRYPT_MODE, primarySecretKey, new GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv));
      byte[] encrypted = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));

      ByteBuffer byteBuffer = ByteBuffer.allocate(iv.length + encrypted.length);
      byteBuffer.put(iv);
      byteBuffer.put(encrypted);
      return Base64.getEncoder().encodeToString(byteBuffer.array());
    } catch (Exception e) {
      log.error("[ApiKeyCryptoService] Failed to encrypt credential", e);
      throw new IllegalStateException("Could not encrypt API key credential", e);
    }
  }

  /** Decrypts Base64 encoded [12-byte IV + AES-GCM ciphertext] back to plaintext API key. */
  public String decrypt(String cipherBase64) {
    if (cipherBase64 == null || cipherBase64.trim().isEmpty()) {
      return null;
    }

    // 1. Try with primary configured key
    String result = doDecrypt(cipherBase64, primarySecretKey);
    if (result != null) {
      return result;
    }

    // 2. If primary failed and differs from default, try fallback default secret
    if (!primarySecretKey.equals(fallbackDefaultKey)) {
      log.warn(
          "[ApiKeyCryptoService] Decryption with primary secret failed, attempting fallback to DEFAULT_SECRET...");
      result = doDecrypt(cipherBase64, fallbackDefaultKey);
      if (result != null) {
        log.info("[ApiKeyCryptoService] Successfully decrypted payload using DEFAULT_SECRET fallback.");
        return result;
      }
    }

    log.warn("[ApiKeyCryptoService] Failed to decrypt credential payload with all available secrets");
    return null;
  }

  private String doDecrypt(String cipherBase64, SecretKey key) {
    try {
      byte[] cipherBytes = Base64.getDecoder().decode(cipherBase64);
      if (cipherBytes.length <= GCM_IV_LENGTH_BYTES) {
        return null;
      }
      ByteBuffer byteBuffer = ByteBuffer.wrap(cipherBytes);
      byte[] iv = new byte[GCM_IV_LENGTH_BYTES];
      byteBuffer.get(iv);
      byte[] encrypted = new byte[byteBuffer.remaining()];
      byteBuffer.get(encrypted);

      Cipher cipher = Cipher.getInstance(ALGORITHM);
      cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv));
      byte[] plainBytes = cipher.doFinal(encrypted);
      return new String(plainBytes, StandardCharsets.UTF_8);
    } catch (Exception e) {
      return null;
    }
  }

  /** Computes deterministic SHA-256 hex string of the trimmed key for unique database lookups. */
  public String hashKey(String plaintext) {
    if (plaintext == null || plaintext.trim().isEmpty()) {
      return null;
    }
    try {
      MessageDigest md = MessageDigest.getInstance("SHA-256");
      byte[] digest = md.digest(plaintext.trim().getBytes(StandardCharsets.UTF_8));
      StringBuilder hexString = new StringBuilder();
      for (byte b : digest) {
        String hex = Integer.toHexString(0xff & b);
        if (hex.length() == 1) hexString.append('0');
        hexString.append(hex);
      }
      return hexString.toString();
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException("SHA-256 algorithm unavailable", e);
    }
  }
}
