package fu.tripsense.contextservice.adapter.in.web;

import fu.tripsense.contextservice.application.PreferenceSignalReader.PreferenceSignal;
import java.time.Instant;

public record PreferenceResponse(
    String dimensionCode, String valueCode, double confidence, String source, Instant updatedAt) {
  static PreferenceResponse from(PreferenceSignal signal) {
    return new PreferenceResponse(
        signal.dimensionCode(),
        signal.valueCode(),
        signal.confidence(),
        signal.source(),
        signal.updatedAt());
  }
}
