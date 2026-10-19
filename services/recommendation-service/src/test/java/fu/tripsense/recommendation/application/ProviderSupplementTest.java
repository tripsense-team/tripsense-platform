package fu.tripsense.recommendation.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

import fu.tripsense.recommendation.application.CandidateRetrievalPipeline.RetrievalOutcome;
import fu.tripsense.recommendation.application.port.*;
import fu.tripsense.recommendation.config.AlgorithmVersionCatalog;
import fu.tripsense.recommendation.config.RecommendationProperties;
import fu.tripsense.recommendation.domain.*;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ProviderSupplementTest {
  @Test
  void refreshReplacesPlaceRetainsSemanticAndDoesNotRetrieveOrRecordTwice() {
    var retrieval = mock(CandidateRetrievalPipeline.class);
    var fusion = mock(CandidateFusionStrategy.class);
    var recorder = mock(ImpressionRecorder.class);
    var context =
        new RecommendationContext(
                UUID.randomUUID(),
                UUID.randomUUID(),
                null,
                "test",
                "cafe",
                null,
                null,
                Set.of(),
                Set.of(),
                null,
                null,
                48)
            .withParallelRetrieval(true)
            .withExternalRefresh(false);
    var oldPlace =
        new CandidateGenerationResult(CandidateSource.PLACE_RETRIEVAL, List.of(), List.of());
    var semantic =
        new CandidateGenerationResult(
            CandidateSource.SEMANTIC,
            List.of(new Candidate("semantic-id", CandidateSource.SEMANTIC, 1, 0.8, null, null)),
            List.of());
    var fresh =
        new CandidateGenerationResult(
            CandidateSource.PLACE_RETRIEVAL,
            List.of(
                new Candidate("fresh-id", CandidateSource.PLACE_RETRIEVAL, 1, null, null, null)),
            List.of());
    when(retrieval.retrieve(context))
        .thenReturn(new RetrievalOutcome(List.of(oldPlace, semantic), List.of()));
    when(retrieval.retrievePlace(context))
        .thenReturn(new RetrievalOutcome(List.of(fresh), List.of()));
    var engine =
        new RecommendationApplicationService(
            mock(RecommendationContextProvider.class),
            retrieval,
            fusion,
            new CandidateFilterPipeline(List.of()),
            mock(CandidateEvidenceEnrichmentPipeline.class),
            mock(FeaturePipeline.class),
            mock(Ranker.class),
            mock(Diversifier.class),
            recorder,
            new AlgorithmVersionCatalog(new RecommendationProperties()),
            mock(RecommendationObservability.class));

    var first = engine.prepare(context);
    var refined = new ExploreQueryRelevancePolicy(new RecommendationProperties()).apply(first);
    assertThat(refined.retrieval()).isSameAs(first.retrieval());
    var supplemented = engine.supplementWithProvider(refined);

    assertThat(supplemented.retrieval().sources()).containsExactly(fresh, semantic);
    assertThat(supplemented.retrieval().sources().get(1)).isSameAs(semantic);
    verify(retrieval, times(1)).retrieve(context);
    verify(retrieval, times(1)).retrievePlace(context);
    verify(fusion).fuse(List.of(fresh, semantic));
    verifyNoInteractions(recorder);
    engine.record(supplemented);
    verify(recorder, times(1)).record(context, supplemented.result());
  }
}
