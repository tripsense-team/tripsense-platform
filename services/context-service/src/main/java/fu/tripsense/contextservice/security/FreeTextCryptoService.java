package fu.tripsense.contextservice.security;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Encrypts and decrypts sensitive free-text interview responses at rest using AES-GCM-256.
 */
@Service
public class FreeTextCryptoService {
  private static final Logger log = LoggerFactory.getLogger(FreeTextCryptoService.class);
  private static final String ALGORITHM = "AES/GCM/NoPadding";
  private static final int GCM_IV_LENGTH_BYTES = 12;
  private static final int GCM_TAG_LENGTH_BITS = 128;
  public static final String KEY_REF = "aes-gcm:v1";

  private final SecretKey secretKey;
  private final SecureRandom secureRandom = new SecureRandom();

  public FreeTextCryptoService(
      @Value("${context.encryption.secret:tripsense-context-onboarding-secure-key-32b}")
          String secret) {
    try {
      MessageDigest sha = MessageDigest.getInstance("SHA-256");
      byte[] keyBytes = sha.digest(secret.getBytes(StandardCharsets.UTF_8));
      this.secretKey = new SecretKeySpec(keyBytes, "AES");
      if ("tripsense-context-onboarding-secure-key-32b".equals(secret)) {
        log.warn(
            "FreeTextCryptoService is using the DEFAULT insecure encryption secret. Override CONTEXT_ENCRYPTION_SECRET in production!");
      } else {
        log.info("FreeTextCryptoService initialized with configured encryption secret");
      }
    } catch (Exception e) {
      throw new IllegalStateException("Failed to initialize AES key for FreeTextCryptoService", e);
    }
  }

  public byte[] encrypt(String plaintext) {
    if (plaintext == null || plaintext.trim().isEmpty()) {
      return null;
    }
    try {
      byte[] iv = new byte[GCM_IV_LENGTH_BYTES];
      secureRandom.nextBytes(iv);

      Cipher cipher = Cipher.getInstance(ALGORITHM);
      cipher.init(Cipher.ENCRYPT_MODE, secretKey, new GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv));
      byte[] encrypted = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));

      ByteBuffer byteBuffer = ByteBuffer.allocate(iv.length + encrypted.length);
      byteBuffer.put(iv);
      byteBuffer.put(encrypted);
      return byteBuffer.array();
    } catch (Exception e) {
      log.error("Failed to encrypt free-text payload", e);
      throw new IllegalStateException("Could not encrypt onboarding free text", e);
    }
  }

  public String decrypt(byte[] cipherBytes) {
    if (cipherBytes == null || cipherBytes.length <= GCM_IV_LENGTH_BYTES) {
      return null;
    }
    try {
      ByteBuffer byteBuffer = ByteBuffer.wrap(cipherBytes);
      byte[] iv = new byte[GCM_IV_LENGTH_BYTES];
      byteBuffer.get(iv);
      byte[] encrypted = new byte[byteBuffer.remaining()];
      byteBuffer.get(encrypted);

      Cipher cipher = Cipher.getInstance(ALGORITHM);
      cipher.init(Cipher.DECRYPT_MODE, secretKey, new GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv));
      byte[] plainBytes = cipher.doFinal(encrypted);
      return new String(plainBytes, StandardCharsets.UTF_8);
    } catch (Exception e) {
      log.warn("Failed to decrypt free-text payload (possibly invalid key or corrupted data): {}", e.getMessage());
      return null;
    }
  }
}
