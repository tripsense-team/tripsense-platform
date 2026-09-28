package fu.tripsense.contextservice.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class FreeTextCryptoServiceTest {

  @Test
  @DisplayName("Should encrypt and decrypt successfully with configured secret")
  void shouldEncryptAndDecryptWithConfiguredSecret() {
    FreeTextCryptoService cryptoService =
        new FreeTextCryptoService("16d928e853a627b81918f5fb09577533e3e17c05271116baa81c96453edc5748");

    String plaintext = "I love quiet cafes and film photography.";
    byte[] encrypted = cryptoService.encrypt(plaintext);

    assertNotNull(encrypted);
    String decrypted = cryptoService.decrypt(encrypted);
    assertEquals(plaintext, decrypted);
  }

  @Test
  @DisplayName("Should decrypt payload encrypted with legacy default key when running with configured secret")
  void shouldDecryptLegacyDefaultKeyPayload() {
    FreeTextCryptoService legacyService =
        new FreeTextCryptoService("tripsense-context-onboarding-secure-key-32b");
    String plaintext = "Tôi thích chơi game, Thích chụp ảnh & ngắm cảnh";
    byte[] legacyEncrypted = legacyService.encrypt(plaintext);

    // New service instance with different configured secret
    FreeTextCryptoService configuredService =
        new FreeTextCryptoService("16d928e853a627b81918f5fb09577533e3e17c05271116baa81c96453edc5748");

    String decrypted = configuredService.decrypt(legacyEncrypted);
    assertEquals(plaintext, decrypted);
  }

  @Test
  @DisplayName("Should return null on null or empty input")
  void shouldHandleNullAndEmpty() {
    FreeTextCryptoService service =
        new FreeTextCryptoService("16d928e853a627b81918f5fb09577533e3e17c05271116baa81c96453edc5748");

    assertNull(service.encrypt(null));
    assertNull(service.encrypt("   "));
    assertNull(service.decrypt(null));
    assertNull(service.decrypt(new byte[5]));
  }
}
