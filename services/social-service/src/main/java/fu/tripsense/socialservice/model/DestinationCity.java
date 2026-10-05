package fu.tripsense.socialservice.model;

import fu.tripsense.socialservice.dto.response.DestinationWeatherResponse;
import java.util.Arrays;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum DestinationCity {
  DALAT(
      "dalat",
      "Đà Lạt",
      "destinationDalat",
      11.9404,
      108.4583,
      "weatherTipDalat",
      "Thời tiết se lạnh lý tưởng để săn mây và đi cà phê",
      19,
      "14° – 22°",
      75,
      "Mây nhẹ",
      "weatherConditionPartlyCloudy",
      "partlyCloudy"),

  PHUQUOC(
      "phuquoc",
      "Phú Quốc",
      "destinationPhuQuoc",
      10.2289,
      103.9572,
      "weatherTipPhuQuoc",
      "Biển êm sóng nhẹ, rất thích hợp lặn ngắm san hô",
      29,
      "26° – 31°",
      68,
      "Nắng ráo",
      "weatherConditionSunny",
      "sunny"),

  DANANG(
      "danang",
      "Đà Nẵng",
      "destinationDaNang",
      16.0544,
      108.2022,
      "weatherTipDaNang",
      "Thời tiết hoàn hảo cho tắm biển Mỹ Khê và lên Bán đảo Sơn Trà",
      28,
      "25° – 30°",
      70,
      "Nắng đẹp",
      "weatherConditionSunny",
      "sunny"),

  HANOI(
      "hanoi",
      "Hà Nội",
      "destinationHaNoi",
      21.0285,
      105.8542,
      "weatherTipHaNoi",
      "Gió mát nhẹ thích hợp dạo quanh Hồ Tây và Phố Cổ",
      24,
      "21° – 26°",
      62,
      "Dịu mát",
      "weatherConditionCool",
      "cool"),

  SAPA(
      "sapa",
      "Sa Pa",
      "destinationSaPa",
      22.3364,
      103.8438,
      "weatherTipSaPa",
      "Nên chuẩn bị áo ấm khi lên đỉnh Fansipan",
      16,
      "12° – 18°",
      82,
      "Se lạnh có sương",
      "weatherConditionCool",
      "cool"),

  NINHBINH(
      "ninhbinh",
      "Ninh Bình",
      "destinationNinhBinh",
      20.2506,
      105.9745,
      "weatherTipNinhBinh",
      "Rất đẹp để chèo thuyền Tràng An và Tam Cốc",
      26,
      "22° – 28°",
      65,
      "Nắng nhẹ",
      "weatherConditionSunny",
      "sunny");

  private final String id;
  private final String cityName;
  private final String cityKey;
  private final double latitude;
  private final double longitude;
  private final String travelTipKey;
  private final String travelTip;
  private final int defaultTemp;
  private final String defaultRange;
  private final int defaultHumidity;
  private final String defaultCondition;
  private final String defaultConditionKey;
  private final String defaultIcon;

  public static DestinationCity fromId(String cityId) {
    if (cityId == null || cityId.isBlank()) {
      return DALAT;
    }
    String normalized = cityId.trim().toLowerCase();
    return Arrays.stream(values())
        .filter(c -> c.id.equalsIgnoreCase(normalized))
        .findFirst()
        .orElse(DALAT);
  }

  public DestinationWeatherResponse toFallbackResponse() {
    return new DestinationWeatherResponse(
        this.id,
        this.cityName,
        this.cityKey,
        this.defaultTemp,
        this.defaultCondition,
        this.defaultConditionKey,
        this.defaultRange,
        this.defaultHumidity,
        "Vừa cập nhật",
        this.defaultIcon,
        this.travelTip,
        this.travelTipKey);
  }
}
