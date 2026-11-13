import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/design/app_tokens.dart';
import '../../../core/ui/brand.dart';
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
        Expanded(
          child: SingleChildScrollView(
            key: ValueKey(state.step),
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.page,
              AppSpacing.xl,
              AppSpacing.page,
              AppSpacing.page,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const BrandMark(
                  size: 48,
                  icon: Icons.auto_awesome,
                  round: true,
                ),
                const SizedBox(height: AppSpacing.xl),
                Text(
                  copy.title,
                  style: theme.textTheme.headlineSmall?.copyWith(
                    fontSize: 26,
                    letterSpacing: -0.6,
                  ),
                ),
                if (copy.subtitle.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    copy.subtitle,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: context.colors.mutedForeground,
                      height: 1.5,
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

/// Progress + navigation, pinned to the bottom (web footer).
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
    final theme = Theme.of(context);
    final colors = context.colors;
    final message = _message(l10n);
    final progress = (state.stepIndex + 1) / state.totalSteps;
    final labelStyle = theme.textTheme.bodySmall?.copyWith(
      color: colors.mutedForeground,
      fontWeight: FontWeight.w600,
    );

    return Container(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.page,
        AppSpacing.md,
        AppSpacing.page,
        AppSpacing.lg,
      ),
      decoration: BoxDecoration(
        color: colors.background,
        border: Border(top: BorderSide(color: colors.border)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (message != null)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.md),
              child: KeyedSubtree(
                key: const Key('onboarding-error'),
                child: InlineAlert(message),
              ),
            ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                l10n.onbProgress(state.stepIndex + 1, state.totalSteps),
                key: const Key('onboarding-progress'),
                style: labelStyle,
              ),
              Text(
                l10n.onbProgressPercent((progress * 100).round()),
                style: labelStyle,
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          ClipRRect(
            borderRadius: BorderRadius.circular(AppRadius.pill),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 6,
              color: colors.foreground,
              backgroundColor: colors.muted,
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          Row(
            children: [
              if (state.stepIndex > 0) ...[
                OutlinedButton.icon(
                  key: const Key('onboarding-back'),
                  onPressed: state.saving ? null : controller.back,
                  icon: const Icon(Icons.chevron_left, size: 20),
                  label: Text(l10n.commonBack),
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size(110, 48),
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
              ],
              Expanded(
                child: FilledButton(
                  key: const Key('onboarding-continue'),
                  onPressed: state.canContinue ? controller.next : null,
                  child: state.saving
                      ? SizedBox.square(
                          dimension: 22,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.5,
                            color: colors.primaryForeground,
                          ),
                        )
                      : Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              state.isLastStep
                                  ? l10n.onbFinish
                                  : l10n.commonContinue,
                            ),
                            const SizedBox(width: 4),
                            const Icon(Icons.chevron_right, size: 20),
                          ],
                        ),
                ),
              ),
            ],
          ),
          if (state.step.isOptional && !state.saving)
            Padding(
              padding: const EdgeInsets.only(top: AppSpacing.xs),
              child: TextButton(
                key: const Key('onboarding-skip'),
                onPressed: controller.skip,
                child: Text(
                  l10n.onbSkip,
                  style: TextStyle(color: colors.mutedForeground),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
