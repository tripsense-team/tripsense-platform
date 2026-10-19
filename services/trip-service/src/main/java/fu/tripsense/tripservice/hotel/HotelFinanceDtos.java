package fu.tripsense.tripservice.hotel;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public class HotelFinanceDtos {

  public record PayoutAccountInput(
      @NotBlank String bankCode,
      @NotBlank String bankName,
      @NotBlank String accountNumber,
      @NotBlank String accountHolderName,
      String branchName) {}

  public record WithdrawalInput(
      @NotNull @Positive BigDecimal amount) {}

  public record RefundInput(
      String reason,
      @NotBlank String bankCode,
      @NotBlank String bankName,
      @NotBlank String accountNumber,
      @NotBlank String accountHolderName) {}

  public record PayoutCompletionInput(
      String bankReferenceCode,
      String proofImageUrl,
      String adminNotes) {}

  public record RejectInput(
      @NotBlank String reason) {}
}
