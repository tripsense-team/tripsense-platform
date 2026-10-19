package fu.tripsense.placeservice.service;

import static org.assertj.core.api.Assertions.assertThat;

import fu.tripsense.placeservice.dto.DiscoveryCategory;
import java.nio.file.*;
import java.util.*;
import org.junit.jupiter.api.Test;

class DiscoveryCategoryContractTest {
  @Test
  void matchesSharedWireFixtures() throws Exception {
    Path root = Path.of("").toAbsolutePath();
    while (root != null && !Files.exists(root.resolve("contracts/discovery-category-v1.csv")))
      root = root.getParent();
    assertThat(root).isNotNull();
    for (String line :
        Files.readAllLines(root.resolve("contracts/discovery-category-v1.csv")).stream()
            .skip(1)
            .toList()) {
      var fields = line.split("\\|", -1);
      assertThat(
              DiscoveryCategory.valueOf(fields[0])
                  .matches(Arrays.asList(fields[2].split(";")), fields[1]))
          .as(line)
          .isEqualTo(Boolean.parseBoolean(fields[3]));
    }
  }

  @Test
  void primaryTypeAndLegacyOwnersMatchSharedContract() throws Exception {
    Path root = Path.of("").toAbsolutePath();
    while (root != null && !Files.exists(root.resolve("contracts/discovery-primary-v1.csv")))
      root = root.getParent();
    assertThat(root).isNotNull();
    for (String line :
        Files.readAllLines(root.resolve("contracts/discovery-primary-v1.csv")).stream()
            .skip(1)
            .toList()) {
      String[] f = line.split("\\|", -1);
      var cats = Arrays.asList(f[2].split(";"));
      var category = DiscoveryCategory.valueOf(f[0]);
      assertThat(category.matches(cats, f[1], f[3])).as(line).isEqualTo(Boolean.parseBoolean(f[4]));
      var owner = DiscoveryCategory.owner(cats, f[1], f[3]);
      assertThat(owner == null ? "UNKNOWN" : owner.name()).as(line).isEqualTo(f[5]);
    }
  }
}
