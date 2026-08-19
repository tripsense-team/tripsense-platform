package fu.tripsense.placeservice.places;

import fu.tripsense.placeservice.places.PlaceModels.PlaceEnrichment;
import fu.tripsense.placeservice.places.PlaceModels.SearchResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/places")
public class PlacesController {

    private final PlaceSearchService placeSearchService;

    public PlacesController(PlaceSearchService placeSearchService) {
        this.placeSearchService = placeSearchService;
    }

    @GetMapping("/search")
    SearchResponse search(
            @RequestParam("q") String query,
            @RequestParam(value = "lat", required = false) Double latitude,
            @RequestParam(value = "lng", required = false) Double longitude
    ) {
        return placeSearchService.search(query, latitude, longitude);
    }

    @GetMapping("/{externalId}/enrichment")
    PlaceEnrichment enrichment(
            @PathVariable String externalId,
            @RequestParam("name") String name,
            @RequestParam(value = "address", required = false, defaultValue = "") String address,
            @RequestParam(value = "category", required = false, defaultValue = "") String category,
            @RequestParam("lat") double latitude,
            @RequestParam("lng") double longitude
    ) {
        return placeSearchService.enrich(externalId, name, address, category, latitude, longitude);
    }
}
