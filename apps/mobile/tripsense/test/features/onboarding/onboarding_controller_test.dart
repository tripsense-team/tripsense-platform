import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:trip/core/errors/app_failure.dart';
import 'package:trip/features/auth/data/auth_repository_impl.dart';
import 'package:trip/features/auth/domain/app_user.dart';
import 'package:trip/features/auth/presentation/session_controller.dart';
import 'package:trip/features/onboarding/data/onboarding_repository_impl.dart';
import 'package:trip/features/onboarding/domain/onboarding_catalog.dart';
import 'package:trip/features/onboarding/domain/onboarding_profile.dart';
import 'package:trip/features/onboarding/presentation/onboarding_controller.dart';

import '../../support/fake_auth_repository.dart';
import '../../support/fake_onboarding_repository.dart';

const _newcomer = AppUser(
  id: 'u1',
  email: 'a@b.com',
  role: UserRole.user,
  hasPassword: true,
  onboardingRequired: true,
);

typedef _Setup = ({
  ProviderContainer container,
  FakeOnboardingRepository repo,
  OnboardingController controller,
});

Future<void> _settle() => Future<void>.delayed(Duration.zero);

Future<_Setup> _setup({FakeOnboardingRepository? repo}) async {
  final fake = repo ?? FakeOnboardingRepository();
  final container = ProviderContainer(
    overrides: [
      onboardingRepositoryProvider.overrideWithValue(fake),
      authRepositoryProvider.overrideWithValue(
        FakeAuthRepository(restored: _newcomer),
      ),
    ],
  );
  addTearDown(container.dispose);
  // Keep both providers alive (autoDispose would drop state between reads).
  container.listen(sessionControllerProvider, (_, _) {});
  container.listen(onboardingControllerProvider, (_, _) {});
  await _settle();
  await _settle();
  return (
    container: container,
    repo: fake,
    controller: container.read(onboardingControllerProvider.notifier),
  );
}

OnboardingState _state(_Setup s) =>
    s.container.read(onboardingControllerProvider);

/// Fills every required answer.
void _fillValid(OnboardingController c) {
  c.setName('Alex');
  c.toggleOption(Dimension.travelParty, 'COUPLE', single: true);
  c.toggleOption(Dimension.budgetTier, 'PREMIUM', single: true);
  c.setDailyBudget('700000');
  c.toggleOption(Dimension.stayStyle, 'HOTEL');
  c.toggleOption(Dimension.foodStyle, 'LOCAL_FOOD');
  c.toggleOption(Dimension.activityInterest, 'BEACH');
}

Future<void> _walkToLastStep(_Setup s) async {
  while (!_state(s).isLastStep) {
    await s.controller.next();
  }
}

void main() {
  group('loading', () {
    test('loads the saved profile into a draft starting at step 1', () async {
      final repo = FakeOnboardingRepository(
        profile: const OnboardingProfile(
          version: 5,
          completed: false,
          visited: ['hue'],
          freeText: 'note',
        ),
      );
      final s = await _setup(repo: repo);

      final state = _state(s);
      expect(state.loading, isFalse);
      expect(state.step, OnboardingStep.name);
      expect(state.draft.visited, ['hue']);
      expect(state.draft.freeText, 'note');
      expect(state.profile?.version, 5);
    });

    test('a load failure is surfaced and can be retried', () async {
      final repo = FakeOnboardingRepository()
        ..loadErrors.add(const AppFailure(type: AppFailureType.network));
      final s = await _setup(repo: repo);

      expect(_state(s).loadFailure?.type, AppFailureType.network);

      await s.controller.retryLoad();
      expect(_state(s).loadFailure, isNull);
      expect(_state(s).loading, isFalse);
    });

    test('an already completed profile clears the gate immediately', () async {
      final repo = FakeOnboardingRepository(
        profile: const OnboardingProfile(version: 9, completed: true),
      );
      final s = await _setup(repo: repo);

      final session = s.container.read(sessionControllerProvider);
      expect(
        (session as SessionAuthenticated).user.onboardingRequired,
        isFalse,
      );
      expect(repo.markCalls, 1);
    });
  });

  group('navigation', () {
    test(
      'cannot continue past the name step until a name is entered',
      () async {
        final s = await _setup();

        await s.controller.next();
        expect(_state(s).step, OnboardingStep.name);
        expect(_state(s).canContinue, isFalse);

        s.controller.setName('Alex');
        expect(_state(s).canContinue, isTrue);
        await s.controller.next();
        expect(_state(s).step, OnboardingStep.homeCity);
      },
    );

    test('back returns one step and never goes below the first', () async {
      final s = await _setup();
      s.controller.setName('Alex');
      await s.controller.next();

      s.controller.back();
      expect(_state(s).step, OnboardingStep.name);
      s.controller.back();
      expect(_state(s).step, OnboardingStep.name);
    });

    test('skip works on optional steps only', () async {
      final s = await _setup();
      s.controller.setName('Alex');
      await s.controller.next(); // home city (optional)
      await s.controller.skip();
      expect(_state(s).step, OnboardingStep.visited);

      await s.controller.skip();
      await s.controller.skip();
      expect(_state(s).step, OnboardingStep.travelParty);

      await s.controller.skip(); // required step: ignored
      expect(_state(s).step, OnboardingStep.travelParty);
    });
  });

  group('editing', () {
    test('home city toggles off when tapped again', () async {
      final s = await _setup();
      s.controller.setHomeCity('Hà Nội');
      expect(_state(s).draft.homeCity, 'Hà Nội');
      s.controller.setHomeCity('Hà Nội');
      expect(_state(s).draft.homeCity, isEmpty);
    });

    test('custom destinations get a slug ref and a label', () async {
      final s = await _setup();
      s.controller.setName('Alex');
      await s.controller.next();
      await s.controller.next(); // visited

      s.controller.addCustomPlace('Đảo Lý Sơn');

      expect(_state(s).draft.visited, ['dao-ly-son']);
      expect(_state(s).draft.customLabels['dao-ly-son'], 'Đảo Lý Sơn');
    });

    test('the 20-destination limit raises a visible issue', () async {
      final s = await _setup();
      s.controller.setName('Alex');
      await s.controller.next();
      await s.controller.next(); // visited
      for (var i = 0; i < maxPlacesPerList; i++) {
        s.controller.togglePlace('p$i');
      }

      s.controller.togglePlace('one-too-many');

      expect(_state(s).issue, OnboardingIssue.placesLimit);
      expect(_state(s).draft.visited.length, maxPlacesPerList);
    });

    test('custom options can be added and removed', () async {
      final s = await _setup();
      s.controller.addCustomOption(Dimension.foodStyle, 'Đi chợ đêm');
      expect(_state(s).draft.answers(Dimension.foodStyle), ['DI_CHO_DEM']);
      expect(_state(s).draft.customLabels['DI_CHO_DEM'], 'Đi chợ đêm');

      s.controller.removeCustomOption(Dimension.foodStyle, 'DI_CHO_DEM');
      expect(_state(s).draft.answers(Dimension.foodStyle), isEmpty);
      expect(_state(s).draft.customLabels, isEmpty);
    });

    test('quick tags append once and respect the length limit', () async {
      final s = await _setup();
      s.controller.addQuickTag('Cafés');
      s.controller.addQuickTag('Beach');
      s.controller.addQuickTag('Beach');
      expect(_state(s).draft.freeText, 'Cafés, Beach');

      s.controller.setFreeText('x' * (maxFreeTextLength - 2));
      s.controller.addQuickTag('Long tag');
      expect(_state(s).draft.freeText.length, maxFreeTextLength);
    });
  });

  group('submit', () {
    test(
      'saves, completes, marks the profile and clears the session gate',
      () async {
        final s = await _setup();
        _fillValid(s.controller);
        await _walkToLastStep(s);

        await s.controller.next();

        expect(s.repo.names, ['Alex']);
        expect(s.repo.saved.single.version, 1);
        expect(s.repo.saved.single.selections[Dimension.dailyBudgetVnd], [
          '700000',
        ]);
        expect(s.repo.completedVersions, [2]);
        expect(s.repo.markCalls, 1);

        final session = s.container.read(sessionControllerProvider);
        final user = (session as SessionAuthenticated).user;
        expect(user.onboardingRequired, isFalse);
        expect(user.name, 'Alex');
      },
    );

    test('a failed display-name update never blocks onboarding', () async {
      final repo = FakeOnboardingRepository()
        ..nameError = const AppFailure(type: AppFailureType.server);
      final s = await _setup(repo: repo);
      _fillValid(s.controller);
      await _walkToLastStep(s);

      await s.controller.next();

      expect(repo.completedVersions, isNotEmpty);
    });

    test('a version conflict reloads and retries the save once', () async {
      final repo = FakeOnboardingRepository()
        ..saveErrors.add(
          const AppFailure(type: AppFailureType.conflict, statusCode: 409),
        );
      final s = await _setup(repo: repo);
      _fillValid(s.controller);
      await _walkToLastStep(s);
      repo.profile = inProgress(version: 7);

      await s.controller.next();

      expect(repo.saved.single.version, 7);
      expect(repo.completedVersions, [8]);
    });

    test(
      'a conflict on an already-completed profile finishes gracefully',
      () async {
        final repo = FakeOnboardingRepository()
          ..saveErrors.add(const AppFailure(type: AppFailureType.conflict));
        final s = await _setup(repo: repo);
        _fillValid(s.controller);
        await _walkToLastStep(s);
        repo.profile = const OnboardingProfile(version: 9, completed: true);

        await s.controller.next();

        expect(repo.saved, isEmpty);
        final session = s.container.read(sessionControllerProvider);
        expect(
          (session as SessionAuthenticated).user.onboardingRequired,
          isFalse,
        );
      },
    );

    test(
      'complete failing but profile already completed still succeeds',
      () async {
        final repo = FakeOnboardingRepository()
          ..completeErrors.add(const AppFailure(type: AppFailureType.conflict));
        final s = await _setup(repo: repo);
        _fillValid(s.controller);
        await _walkToLastStep(s);
        repo.profile = const OnboardingProfile(version: 9, completed: true);

        await s.controller.next();

        final session = s.container.read(sessionControllerProvider);
        expect(
          (session as SessionAuthenticated).user.onboardingRequired,
          isFalse,
        );
      },
    );

    test(
      'network failures stay on the last step with a retryable error',
      () async {
        final repo = FakeOnboardingRepository()
          ..saveErrors.add(const AppFailure(type: AppFailureType.network));
        final s = await _setup(repo: repo);
        _fillValid(s.controller);
        await _walkToLastStep(s);

        await s.controller.next();

        final state = _state(s);
        expect(state.saving, isFalse);
        expect(state.failure?.type, AppFailureType.network);
        expect(state.isLastStep, isTrue);
        final session = s.container.read(sessionControllerProvider);
        expect(
          (session as SessionAuthenticated).user.onboardingRequired,
          isTrue,
        );

        await s.controller.next(); // retry succeeds
        expect(repo.completedVersions, isNotEmpty);
      },
    );

    test('an invalid budget sends the user back to the budget step', () async {
      final s = await _setup();
      _fillValid(s.controller);
      await _walkToLastStep(s);
      s.controller.setDailyBudget('');

      await s.controller.submit();

      expect(_state(s).step, OnboardingStep.budget);
      expect(_state(s).issue, OnboardingIssue.validation);
      expect(s.repo.saved, isEmpty);
    });

    test('server validation errors show the validation message', () async {
      final repo = FakeOnboardingRepository()
        ..saveErrors.add(
          const AppFailure(type: AppFailureType.validation, statusCode: 400),
        );
      final s = await _setup(repo: repo);
      _fillValid(s.controller);
      await _walkToLastStep(s);

      await s.controller.next();

      expect(_state(s).issue, OnboardingIssue.validation);
    });
  });
}
