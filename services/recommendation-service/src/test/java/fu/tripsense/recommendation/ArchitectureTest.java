package fu.tripsense.recommendation;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

@AnalyzeClasses(packages = "fu.tripsense.recommendation")
class ArchitectureTest {
  @ArchTest
  static final ArchRule domainDoesNotDependOnOuterLayers =
      noClasses()
          .that()
          .resideInAPackage("..domain..")
          .should()
          .dependOnClassesThat()
          .resideInAnyPackage(
              "fu.tripsense.recommendation.application..",
              "fu.tripsense.recommendation.adapter..",
              "fu.tripsense.recommendation.api..",
              "fu.tripsense.recommendation.config..",
              "fu.tripsense.recommendation.security..");

  @ArchTest
  static final ArchRule applicationDoesNotDependOnTransportOrAdapters =
      noClasses()
          .that()
          .resideInAPackage("..application..")
          .should()
          .dependOnClassesThat()
          .resideInAnyPackage(
              "fu.tripsense.recommendation.adapter..", "fu.tripsense.recommendation.api..");
}
