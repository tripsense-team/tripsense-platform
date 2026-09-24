package fu.tripsense.socialservice.dto.response;

public record DestinationWeatherResponse(
    String id,
    String cityName,
    String cityKey,
    Integer temperature,
    String condition,
    String conditionKey,
    String tempRange,
    Integer humidity,
    String updatedAt,
    String iconType,
    String travelTip,
    String travelTipKey
) {}
