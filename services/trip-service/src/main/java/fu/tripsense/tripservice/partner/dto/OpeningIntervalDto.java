package fu.tripsense.tripservice.partner.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.time.LocalTime;
import lombok.Builder;

@Builder
public record OpeningIntervalDto(
    @Min(1) @Max(7) int dayOfWeek,
    @NotNull @JsonFormat(pattern = "HH:mm") LocalTime opensAt,
    @NotNull @JsonFormat(pattern = "HH:mm") LocalTime closesAt
) {}
