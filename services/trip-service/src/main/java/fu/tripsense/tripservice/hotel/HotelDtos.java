package fu.tripsense.tripservice.hotel;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public final class HotelDtos {
  private HotelDtos() {}
  public record PropertyInput(
      @NotBlank @Size(max=160) String name,
      @NotBlank @Size(max=120) String destination,
      @NotBlank @Size(max=500) String address,
      @NotBlank @Size(max=80) String timeZone,
      @NotBlank @Pattern(regexp="[0-2][0-9]:[0-5][0-9]") String checkInTime,
      @NotBlank @Pattern(regexp="[0-2][0-9]:[0-5][0-9]") String checkOutTime,
      UUID businessId) {
    public PropertyInput(String name,String destination,String address,String timeZone,String checkInTime,String checkOutTime) {
      this(name,destination,address,timeZone,checkInTime,checkOutTime,null);
    }
  }
  public record DemoPaymentInput(@NotBlank @Pattern(regexp="SUCCESS|FAILURE|EXPIRED") String outcome) {}
  public record RoomInput(
      @NotBlank @Size(max=160) String name,
      @Min(1) @Max(20) int capacity,
      BigDecimal nightlyPrice,
      Integer allocation) {
    public RoomInput(String name, int capacity) {
      this(name, capacity, null, null);
    }
  }
  public record InventoryInput(@NotNull LocalDate from, @NotNull LocalDate to,
      @Min(0) @Max(10000) int allocation,
      @NotNull @DecimalMin("0.01") @DecimalMax("99999999999999.99") @Digits(integer=14,fraction=2) BigDecimal nightlyPrice,
      boolean stopSell) {}
  public record HoldInput(@NotNull UUID roomTypeId, @NotNull LocalDate checkIn,
      @NotNull LocalDate checkOut, @Min(1) @Max(10) int quantity, @Min(1) @Max(200) int guests) {}
  public record StatusInput(@NotBlank @Pattern(regexp="ACTIVE|REJECTED|SUSPENDED") String status) {}
  public record HotelTransitionInput(Long expectedVersion, String reason) {}
}
