package fu.tripsense.contextservice.adapter.in.web;

import jakarta.validation.constraints.PositiveOrZero;

public record CompleteOnboardingRequest(@PositiveOrZero long version) {}
