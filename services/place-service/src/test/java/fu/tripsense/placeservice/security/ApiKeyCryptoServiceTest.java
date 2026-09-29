package fu.tripsense.placeservice.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ApiKeyCryptoServiceTest {

  private ApiKeyCryptoService cryptoService;

  @BeforeEach
  void setUp() {
    cryptoService = new ApiKeyCryptoService("test-secret-key-at-least-32-bytes-long!!");
  }

  @Test
  void encryptAndDecrypt_validPlaintext_roundTripsCorrectly() {
    String originalKey = "eyJ1c2VySWQiOiIxMjM0NSIsImFwaUtleSI6InNlY3JldC10b2tlbiJ9";

    String encrypted = cryptoService.encrypt(originalKey);
    assertThat(encrypted).isNotNull().isNotEqualTo(originalKey);

    String decrypted = cryptoService.decrypt(encrypted);
    assertThat(decrypted).isEqualTo(originalKey);
  }

  @Test
  void encrypt_producesDifferentCiphertextsDueToRandomIv() {
    String key = "ziomap_test_key_12345";
    String cipher1 = cryptoService.encrypt(key);
    String cipher2 = cryptoService.encrypt(key);

    assertThat(cipher1).isNotEqualTo(cipher2);
    assertThat(cryptoService.decrypt(cipher1)).isEqualTo(key);
    assertThat(cryptoService.decrypt(cipher2)).isEqualTo(key);
  }

  @Test
  void hashKey_producesConsistentDeterministicSha256Hex() {
    String key = "my-secret-key";
    String hash1 = cryptoService.hashKey(key);
    String hash2 = cryptoService.hashKey("  my-secret-key  ");

    assertThat(hash1).isNotNull().hasSize(64);
    assertThat(hash1).isEqualTo(hash2);
    assertThat(hash1).isNotEqualTo(key);
  }

  @Test
  void decrypt_corruptedPayload_returnsNullGracefully() {
    String corrupted = "invalid-base-64-or-truncated";
    String result = cryptoService.decrypt(corrupted);
    assertThat(result).isNull();
  }

  @Test
  void encrypt_nullOrBlank_returnsNull() {
    assertThat(cryptoService.encrypt(null)).isNull();
    assertThat(cryptoService.encrypt("   ")).isNull();
    assertThat(cryptoService.decrypt(null)).isNull();
    assertThat(cryptoService.decrypt("   ")).isNull();
    assertThat(cryptoService.hashKey(null)).isNull();
  }

  @Test
  void constructor_withBlankOrNullSecret_fallsBackToDefaultSecret() {
    ApiKeyCryptoService defaultService = new ApiKeyCryptoService("tripsense-default-api-key-encryption-secret-32b");
    ApiKeyCryptoService blankService = new ApiKeyCryptoService("   ");
    ApiKeyCryptoService nullService = new ApiKeyCryptoService(null);

    String key = "test-secret-value-123";
    String encryptedWithDefault = defaultService.encrypt(key);

    assertThat(blankService.decrypt(encryptedWithDefault)).isEqualTo(key);
    assertThat(nullService.decrypt(encryptedWithDefault)).isEqualTo(key);
  }

  @Test
  void decrypt_withFallbackToDefaultSecret_succeedsWhenPrimarySecretDiffers() {
    // Encrypted using default secret (like old database records)
    ApiKeyCryptoService defaultService = new ApiKeyCryptoService("tripsense-default-api-key-encryption-secret-32b");
    String original = "my-secret-token-xyz";
    String encryptedWithDefault = defaultService.encrypt(original);

    // New service instance with a custom production secret
    ApiKeyCryptoService customService = new ApiKeyCryptoService("brand-new-custom-production-secret-12345678");

    // Must still decrypt correctly thanks to fallback
    assertThat(customService.decrypt(encryptedWithDefault)).isEqualTo(original);
  }
}
