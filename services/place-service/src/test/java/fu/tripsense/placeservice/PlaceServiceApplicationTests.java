package fu.tripsense.placeservice;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import fu.tripsense.placeservice.domain.repository.PlaceRepository;
import org.springframework.data.redis.core.StringRedisTemplate;
import fu.tripsense.placeservice.service.PlaceCacheService;
import fu.tripsense.placeservice.service.PlaceDetailsService;
import fu.tripsense.placeservice.service.PlacePersistenceService;
import fu.tripsense.placeservice.service.PlaceRankingService;
import fu.tripsense.placeservice.service.PlaceSearchService;
import fu.tripsense.placeservice.service.impl.PlaceCacheServiceImpl;
import fu.tripsense.placeservice.service.impl.PlaceDetailsServiceImpl;
import fu.tripsense.placeservice.service.impl.PlacePersistenceServiceImpl;
import fu.tripsense.placeservice.service.impl.PlaceRankingServiceImpl;
import fu.tripsense.placeservice.service.impl.PlaceSearchServiceImpl;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = {
        "spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.mongo.MongoAutoConfiguration,org.springframework.boot.autoconfigure.data.mongo.MongoDataAutoConfiguration,org.springframework.boot.autoconfigure.data.mongo.MongoRepositoriesAutoConfiguration"
})
@ActiveProfiles("test")
class PlaceServiceApplicationTests {

    @MockitoBean
    private PlaceRepository placeRepository;

    @MockitoBean
    private StringRedisTemplate stringRedisTemplate;

    @Autowired private PlaceSearchService placeSearchService;
    @Autowired private PlaceDetailsService placeDetailsService;
    @Autowired private PlaceCacheService placeCacheService;
    @Autowired private PlacePersistenceService placePersistenceService;
    @Autowired private PlaceRankingService placeRankingService;

    @Test
    void contextLoads() {
        assertThat(placeSearchService).isInstanceOf(PlaceSearchServiceImpl.class);
        assertThat(placeDetailsService).isInstanceOf(PlaceDetailsServiceImpl.class);
        assertThat(placeCacheService).isInstanceOf(PlaceCacheServiceImpl.class);
        assertThat(placePersistenceService).isInstanceOf(PlacePersistenceServiceImpl.class);
        assertThat(placeRankingService).isInstanceOf(PlaceRankingServiceImpl.class);
    }

}
