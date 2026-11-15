import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/app_failure.dart';
import '../../auth/presentation/session_controller.dart';
import '../data/onboarding_repository_impl.dart';
import '../domain/onboarding_catalog.dart';
import '../domain/onboarding_draft.dart';
import '../domain/onboarding_profile.dart';

/// Reasons the wizard shows an inline message (besides [AppFailure]).
enum OnboardingIssue { none, validation, placesLimit }

class OnboardingState {
  const OnboardingState({
    this.loading = true,
    this.loadFailure,
    this.profile,
    this.draft = const OnboardingDraft(),
    this.step = OnboardingStep.name,
    this.saving = false,
    this.issue = OnboardingIssue.none,
    this.failure,
  });

  final bool loading;

  /// Set when the saved profile could not be loaded (retry available).
  final AppFailure? loadFailure;
  final OnboardingProfile? profile;
  final OnboardingDraft draft;
  final OnboardingStep step;
  final bool saving;
  final OnboardingIssue issue;

  /// Submit failure to show (network, server...).
  final AppFailure? failure;

  int get stepIndex => step.index;
  int get totalSteps => OnboardingStep.values.length;
  bool get isLastStep => step == OnboardingStep.values.last;
  bool get canContinue => draft.isStepValid(step) && !saving;

  OnboardingState copyWith({
    bool? loading,
    AppFailure? loadFailure,
    bool clearLoadFailure = false,
    OnboardingProfile? profile,
    OnboardingDraft? draft,
    OnboardingStep? step,
    bool? saving,
    OnboardingIssue? issue,
    AppFailure? failure,
    bool clearFailure = false,
  }) => OnboardingState(
    loading: loading ?? this.loading,
    loadFailure: clearLoadFailure ? null : loadFailure ?? this.loadFailure,
    profile: profile ?? this.profile,
    draft: draft ?? this.draft,
    step: step ?? this.step,
    saving: saving ?? this.saving,
    issue: issue ?? this.issue,
    failure: clearFailure ? null : failure ?? this.failure,
  );
}

final onboardingControllerProvider =
    NotifierProvider.autoDispose<OnboardingController, OnboardingState>(
      OnboardingController.new,
    );

class OnboardingController extends Notifier<OnboardingState> {
  @override
  OnboardingState build() {
    unawaited(_load());
    return const OnboardingState();
  }

  Future<void> retryLoad() {
    state = const OnboardingState();
    return _load();
  }

  Future<void> _load() async {
    try {
      final profile = await ref.read(onboardingRepositoryProvider).load();
      if (profile.completed) {
        await _finish();
        return;
      }
      final session = ref.read(sessionControllerProvider);
      final name = session is SessionAuthenticated ? session.user.name : null;
      state = state.copyWith(
        loading: false,
        profile: profile,
        draft: OnboardingDraft.fromProfile(profile, name: name ?? ''),
      );
    } on AppFailure catch (failure) {
      state = state.copyWith(loading: false, loadFailure: failure);
    }
  }

  // ---- draft edits ---------------------------------------------------------

  void _edit(OnboardingDraft Function(OnboardingDraft draft) change) {
    state = state.copyWith(
      draft: change(state.draft),
      issue: OnboardingIssue.none,
      clearFailure: true,
    );
  }

  void setName(String value) => _edit((d) => d.copyWith(name: value));

  void setHomeCity(String value) => _edit(
    (d) => d.copyWith(homeCity: d.homeCity == value ? '' : value.trim()),
  );

  void toggleOption(String dimension, String code, {bool single = false}) =>
      _edit((d) => d.toggleOption(dimension, code, single: single));

  void togglePlace(String ref) {
    final before = state.draft;
    final after = before.togglePlace(state.step, ref);
    if (identical(before, after)) {
      state = state.copyWith(issue: OnboardingIssue.placesLimit);
      return;
    }
    state = state.copyWith(
      draft: after,
      issue: OnboardingIssue.none,
      clearFailure: true,
    );
  }

  /// Adds a destination typed by the user (not in the curated list).
  void addCustomPlace(String label) {
    final text = label.trim();
    final ref = toPlaceRef(text);
    if (ref.isEmpty) return;
    _edit((d) => d.copyWith(customLabels: {...d.customLabels, ref: text}));
    togglePlace(ref);
  }

  /// Adds an answer typed by the user to a multi-answer dimension.
  void addCustomOption(String dimension, String label) {
    final text = label.trim();
    if (text.isEmpty) return;
    final code = toOptionCode(text);
    _edit(
      (d) => d
          .copyWith(customLabels: {...d.customLabels, code: text})
          .toggleOption(dimension, code),
    );
  }

  void removeCustomOption(String dimension, String code) => _edit((d) {
    final labels = {...d.customLabels}..remove(code);
    return d
        .copyWith(customLabels: labels)
        .copyWith(
          selections: {
            ...d.selections,
            dimension: [
              for (final item in d.answers(dimension))
                if (item != code) item,
            ],
          },
        );
  });

  void setDailyBudget(String digits) =>
      _edit((d) => d.copyWith(dailyBudget: digits));

  void setFreeText(String value) => _edit((d) => d.copyWith(freeText: value));

  void addQuickTag(String text) => _edit((d) {
    final current = d.freeText.trim();
    if (current.isEmpty) return d.copyWith(freeText: text);
    if (current.contains(text)) return d.copyWith(freeText: current);
    final combined = '$current, $text';
    return d.copyWith(
      freeText: combined.length > maxFreeTextLength
          ? combined.substring(0, maxFreeTextLength)
          : combined,
    );
  });

  // ---- navigation ----------------------------------------------------------

  void back() {
    if (state.saving || state.stepIndex == 0) return;
    state = state.copyWith(
      step: OnboardingStep.values[state.stepIndex - 1],
      issue: OnboardingIssue.none,
      clearFailure: true,
    );
  }

  /// Advances; on the last step it saves and completes onboarding.
  Future<void> next() async {
    if (!state.canContinue) return;
    if (!state.isLastStep) {
      state = state.copyWith(
        step: OnboardingStep.values[state.stepIndex + 1],
        issue: OnboardingIssue.none,
        clearFailure: true,
      );
      return;
    }
    await submit();
  }

  /// "Skip for now": same as continue, valid only on optional steps.
  Future<void> skip() => state.step.isOptional ? next() : Future.value();

  // ---- submit --------------------------------------------------------------

  Future<void> submit() async {
    if (state.saving) return;
    final draft = state.draft;
    final invalid = draft.firstInvalidStep;
    if (invalid != null) {
      state = state.copyWith(step: invalid, issue: OnboardingIssue.validation);
      return;
    }

    state = state.copyWith(
      saving: true,
      issue: OnboardingIssue.none,
      clearFailure: true,
    );
    final repo = ref.read(onboardingRepositoryProvider);
    try {
      final name = draft.name.trim();
      try {
        await repo.updateDisplayName(name);
      } on AppFailure {
        // A display-name problem must not block onboarding.
      }

      final saved = await _saveWithRetry(
        draft.toRequest(state.profile?.version ?? 0),
      );
      if (saved == null) return; // finished elsewhere; already finalized

      try {
        await repo.complete(saved.version);
      } on AppFailure {
        final latest = await repo.load();
        if (!latest.completed) rethrow;
      }
      await _finish(displayName: name);
    } on AppFailure catch (failure) {
      state = state.copyWith(
        saving: false,
        issue: failure.type == AppFailureType.validation
            ? OnboardingIssue.validation
            : OnboardingIssue.none,
        failure: failure,
      );
    }
  }

  /// Saves once; on a version conflict reloads and retries one time.
  Future<OnboardingProfile?> _saveWithRetry(
    OnboardingSaveRequest request,
  ) async {
    final repo = ref.read(onboardingRepositoryProvider);
    try {
      return await repo.save(request);
    } on AppFailure catch (failure) {
      if (failure.type != AppFailureType.conflict) rethrow;
      final fresh = await repo.load();
      if (fresh.completed) {
        await _finish();
        return null;
      }
      return repo.save(request.withVersion(fresh.version));
    }
  }

  Future<void> _finish({String? displayName}) async {
    try {
      await ref.read(onboardingRepositoryProvider).markProfileComplete();
    } on AppFailure {
      // Already marked or transient; the session flag below is what unblocks UI.
    }
    ref
        .read(sessionControllerProvider.notifier)
        .onboardingCompleted(displayName: displayName);
  }
}
