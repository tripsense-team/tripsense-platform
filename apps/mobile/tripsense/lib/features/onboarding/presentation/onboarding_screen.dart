import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/design/app_tokens.dart';
import '../../../core/ui/failure_message.dart';
import '../../../core/ui/state_views.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../domain/onboarding_catalog.dart';
import 'onboarding_controller.dart';
import 'onboarding_steps.dart';
import 'option_labels.dart';

/// First-run wizard (web: `(main)/onboarding`). Required before the app.
class OnboardingScreen extends ConsumerWidget {
  const OnboardingScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(onboardingControllerProvider);
    final controller = ref.read(onboardingControllerProvider.notifier);

    return Scaffold(
      body: SafeArea(
        child: state.loading
            ? const LoadingView()
            : state.loadFailure != null
            ? ErrorView(
                error: state.loadFailure!,
                onRetry: controller.retryLoad,
              )
            : _Wizard(state: state, controller: controller),
      ),
    );
  }
}

class _Wizard extends StatelessWidget {
  const _Wizard({required this.state, required this.controller});

  final OnboardingState state;
  final OnboardingController controller;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final copy = stepCopy(l10n, state.step);

    return Column(
      // Stretch so narrow steps stay left-aligned instead of being centered.
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.page,
            AppSpacing.lg,
            AppSpacing.page,
            AppSpacing.sm,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                l10n.onbEyebrow.toUpperCase(),
                style: theme.textTheme.labelSmall?.copyWith(
                  color: context.colors.mutedForeground,
                ),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                l10n.onbProgress(state.stepIndex + 1, state.totalSteps),
                key: const Key('onboarding-progress'),
                style: theme.textTheme.bodySmall,
              ),
              const SizedBox(height: AppSpacing.sm),
              ClipRRect(
                borderRadius: BorderRadius.circular(AppRadius.pill),
                child: LinearProgressIndicator(
                  value: (state.stepIndex + 1) / state.totalSteps,
                  minHeight: 6,
                  backgroundColor: context.colors.secondary,
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: SingleChildScrollView(
            key: ValueKey(state.step),
            padding: const EdgeInsets.all(AppSpacing.page),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(copy.title, style: theme.textTheme.headlineSmall),
                if (copy.subtitle.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    copy.subtitle,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: context.colors.mutedForeground,
                    ),
                  ),
                ],
                const SizedBox(height: AppSpacing.xl),
                _StepBody(step: state.step),
              ],
            ),
          ),
        ),
        _BottomBar(state: state, controller: controller),
      ],
    );
  }
}

class _StepBody extends StatelessWidget {
  const _StepBody({required this.step});

  final OnboardingStep step;

  @override
  Widget build(BuildContext context) => switch (step) {
    OnboardingStep.name => const NameStep(),
    OnboardingStep.homeCity => const HomeCityStep(),
    OnboardingStep.visited ||
    OnboardingStep.bucketList => PlacesStep(step: step),
    OnboardingStep.budget => const BudgetStep(),
    OnboardingStep.note => const NoteStep(),
    OnboardingStep.travelParty ||
    OnboardingStep.stay ||
    OnboardingStep.food ||
    OnboardingStep.activity => PreferenceStepView(
      preference: preferenceFor(step)!,
    ),
  };
}

class _BottomBar extends StatelessWidget {
  const _BottomBar({required this.state, required this.controller});

  final OnboardingState state;
  final OnboardingController controller;

  String? _message(AppLocalizations l10n) {
    if (state.issue == OnboardingIssue.validation) {
      return l10n.onbValidationFailed;
    }
    final failure = state.failure;
    return failure == null ? null : failureMessage(l10n, failure);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final message = _message(l10n);

    return Container(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.page,
        AppSpacing.md,
        AppSpacing.page,
        AppSpacing.lg,
      ),
      decoration: BoxDecoration(
        color: context.colors.background,
        border: Border(top: BorderSide(color: context.colors.border)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (message != null)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.sm),
              child: Text(
                message,
                key: const Key('onboarding-error'),
                style: TextStyle(color: context.colors.destructive),
              ),
            ),
          Row(
            children: [
              if (state.stepIndex > 0) ...[
                OutlinedButton(
                  key: const Key('onboarding-back'),
                  onPressed: state.saving ? null : controller.back,
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size(96, 48),
                  ),
                  child: Text(l10n.commonBack),
                ),
                const SizedBox(width: AppSpacing.md),
              ],
              Expanded(
                child: FilledButton(
                  key: const Key('onboarding-continue'),
                  onPressed: state.canContinue ? controller.next : null,
                  child: state.saving
                      ? const SizedBox.square(
                          dimension: 22,
                          child: CircularProgressIndicator(strokeWidth: 2.5),
                        )
                      : Text(
                          state.isLastStep
                              ? l10n.onbFinish
                              : l10n.commonContinue,
                        ),
                ),
              ),
            ],
          ),
          if (state.step.isOptional && !state.saving)
            TextButton(
              key: const Key('onboarding-skip'),
              onPressed: controller.skip,
              child: Text(l10n.onbSkip),
            ),
        ],
      ),
    );
  }
}
