package fu.tripsense.tripservice.partner.service;

import fu.tripsense.tripservice.partner.dto.GuideTaxonomyDto;
import fu.tripsense.tripservice.partner.dto.TaxonomyItemDto;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class GuideTaxonomyService {

  private static final GuideTaxonomyDto TAXONOMY =
      new GuideTaxonomyDto(
          1,
          List.of(
              new TaxonomyItemDto("HOI_AN", "Hội An", "Hoi An"),
              new TaxonomyItemDto("DA_NANG", "Đà Nẵng", "Da Nang"),
              new TaxonomyItemDto("HUE", "Huế", "Hue"),
              new TaxonomyItemDto("HA_NOI", "Hà Nội", "Hanoi"),
              new TaxonomyItemDto("SAI_GON", "TP. Hồ Chí Minh", "Ho Chi Minh City"),
              new TaxonomyItemDto("NINH_BINH", "Ninh Bình", "Ninh Binh"),
              new TaxonomyItemDto("SAPA", "Sa Pa", "Sapa"),
              new TaxonomyItemDto("PHU_QUOC", "Phú Quốc", "Phu Quoc"),
              new TaxonomyItemDto("HA_GIANG", "Hà Giang", "Ha Giang"),
              new TaxonomyItemDto("DA_LAT", "Đà Lạt", "Da Lat")),
          List.of(
              new TaxonomyItemDto("FOOD_STREET", "Ẩm thực đường phố", "Street Food"),
              new TaxonomyItemDto("HERITAGE_CULTURE", "Di sản & Văn hóa", "Heritage & Culture"),
              new TaxonomyItemDto("PHOTOGRAPHY", "Nhiếp ảnh & Check-in", "Photography"),
              new TaxonomyItemDto("NIGHTLIFE", "Đời sống về đêm", "Nightlife"),
              new TaxonomyItemDto("TREKKING_NATURE", "Trekking & Thiên nhiên", "Trekking & Nature"),
              new TaxonomyItemDto("CYCLING", "Đạp xe & Làng quê", "Cycling & Countryside"),
              new TaxonomyItemDto("COFFEE_CULTURE", "Văn hóa Cà phê", "Coffee Culture"),
              new TaxonomyItemDto("LOCAL_CRAFTS", "Làng nghề thủ công", "Local Crafts")),
          List.of(
              new TaxonomyItemDto("HISTORICAL_KNOWLEDGE", "Kiến thức lịch sử sâu", "Deep Historical Knowledge"),
              new TaxonomyItemDto("PHOTOGRAPHY_SKILLS", "Kỹ năng chụp ảnh đẹp", "Photography Skills"),
              new TaxonomyItemDto("FIRST_AID", "Sơ cấp cứu cơ bản", "First Aid Certified"),
              new TaxonomyItemDto("VEGAN_DINING_NAVIGATOR", "Am hiểu món chay", "Vegan Dining Navigator"),
              new TaxonomyItemDto("LOCAL_DIALECT_INTERPRETER", "Phiên dịch tiếng địa phương", "Local Dialect Interpreter"),
              new TaxonomyItemDto("MOTORBIKE_TOURS", "Lái xe máy chuyên nghiệp", "Professional Motorbike Driver")),
          List.of(
              new TaxonomyItemDto("vi", "Tiếng Việt", "Vietnamese"),
              new TaxonomyItemDto("en", "Tiếng Anh", "English"),
              new TaxonomyItemDto("fr", "Tiếng Pháp", "French"),
              new TaxonomyItemDto("ja", "Tiếng Nhật", "Japanese"),
              new TaxonomyItemDto("ko", "Tiếng Hàn", "Korean"),
              new TaxonomyItemDto("zh", "Tiếng Trung", "Chinese"),
              new TaxonomyItemDto("de", "Tiếng Đức", "German"),
              new TaxonomyItemDto("es", "Tiếng Tây Ban Nha", "Spanish")));

  public GuideTaxonomyDto getTaxonomy() {
    return TAXONOMY;
  }
}
