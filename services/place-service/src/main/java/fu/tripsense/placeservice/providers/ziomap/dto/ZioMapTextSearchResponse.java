package fu.tripsense.placeservice.providers.ziomap.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.ArrayList;
import java.util.List;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class ZioMapTextSearchResponse {

  private List<ZioMapTextSearchPlace> places = new ArrayList<>();
}
