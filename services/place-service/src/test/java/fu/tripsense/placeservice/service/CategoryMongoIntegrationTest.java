package fu.tripsense.placeservice.service;

import static org.assertj.core.api.Assertions.*;

import com.mongodb.ConnectionString;
import com.mongodb.MongoClientSettings;
import com.mongodb.client.MongoClients;
import fu.tripsense.placeservice.domain.model.Place;
import fu.tripsense.placeservice.dto.*;
import java.net.ServerSocket;
import java.nio.file.Files;
import java.util.*;
import java.util.concurrent.TimeUnit;
import org.bson.Document;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.data.mongodb.core.MongoTemplate;

/** Uses only a disposable localhost server; never loads repository database credentials. */
@EnabledIfSystemProperty(named = "place.category.integration", matches = "true")
class CategoryMongoIntegrationTest {
  @Test
  void realMongoAcceptsHomestayRegexAndQueriesEveryCategoryBeforeLimit() throws Exception {
    int port;
    try (var socket = new ServerSocket(0)) {
      port = socket.getLocalPort();
    }
    var directory = Files.createTempDirectory("tripsense-category-mongo-");
    Process server = null;
    try {
      server =
          new ProcessBuilder(
                  System.getProperty("place.category.mongod", "mongod"),
                  "--bind_ip",
                  "127.0.0.1",
                  "--port",
                  Integer.toString(port),
                  "--dbpath",
                  directory.toString(),
                  "--quiet")
              .redirectOutput(ProcessBuilder.Redirect.DISCARD)
              .redirectError(ProcessBuilder.Redirect.DISCARD)
              .start();
      var settings =
          MongoClientSettings.builder()
              .applyConnectionString(new ConnectionString("mongodb://127.0.0.1:" + port))
              .applyToClusterSettings(b -> b.serverSelectionTimeout(300, TimeUnit.MILLISECONDS))
              .build();
      try (var client = MongoClients.create(settings)) {
        var db = client.getDatabase("category_test");
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(8);
        boolean ready = false;
        while (System.nanoTime() < deadline && server.isAlive()) {
          try {
            db.runCommand(new Document("ping", 1));
            ready = true;
            break;
          } catch (com.mongodb.MongoException notReady) {
            Thread.sleep(30);
          }
        }
        assertThat(ready).as("disposable MongoDB started").isTrue();
        var collection = db.getCollection("places");
        collection.createIndex(new Document("location", "2dsphere"));
        collection.insertMany(
            List.of(
                place("hotel", "Hotel", "hotel"),
                place("home", "An Home Stay Đà Nẵng", "lodging"),
                place("food", "Restaurant", "restaurant"),
                place("cafe", "Cafe", "cafe"),
                place("false", "Homestayer Hotel", "hotel")));
        collection.insertMany(
            List.of(
                place("primary-coffee", "Cafe with restaurant tags", "restaurant")
                    .append("primaryType", "coffee_shop"),
                place("primary-museum", "Museum with cafe tags", "cafe")
                    .append("primaryType", "museum"),
                place("primary-hotel", "Hotel with cafe tags", "cafe")
                    .append("primaryType", "hotel")));
        var mongo = new MongoTemplate(client, "category_test");
        for (var category :
            List.of(DiscoveryCategory.HOMESTAY, DiscoveryCategory.FOOD, DiscoveryCategory.CAFE)) {
          var request =
              new PlaceCategoryBatchRequest(
                  16.0544, 108.2022, 35000, List.of(category), 12, 2592000L, List.of(), false);
          var found = mongo.find(PlaceCategoryBatchService.query(request, category), Place.class);
          if (category == DiscoveryCategory.CAFE)
            assertThat(
                    found.stream()
                        .filter(p -> p.getId().equals("primary-coffee"))
                        .findFirst()
                        .orElseThrow()
                        .getPrimaryType())
                .isEqualTo("coffee_shop");
          assertThat(found)
              .extracting(Place::getId)
              .containsExactlyInAnyOrderElementsOf(
                  switch (category) {
                    case HOMESTAY -> List.of("home");
                    case FOOD -> List.of("food");
                    case CAFE -> List.of("cafe", "primary-coffee");
                    default -> throw new AssertionError();
                  });
        }
      }
    } finally {
      if (server != null) {
        server.destroy();
        if (!server.waitFor(5, TimeUnit.SECONDS)) {
          server.destroyForcibly();
          server.waitFor(5, TimeUnit.SECONDS);
        }
      }
      try (var paths = Files.walk(directory)) {
        for (var path : paths.sorted(Comparator.reverseOrder()).toList())
          Files.deleteIfExists(path);
      }
    }
  }

  private Document place(String id, String name, String category) {
    return new Document("_id", id)
        .append("name", name)
        .append("categories", List.of(category))
        .append("businessStatus", "OPERATIONAL")
        .append(
            "location",
            new Document("type", "Point").append("coordinates", List.of(108.2022, 16.0544)));
  }
}
