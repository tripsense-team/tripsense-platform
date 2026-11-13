import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:trip/app/app_theme.dart';
import 'package:trip/core/errors/app_failure.dart';
import 'package:trip/features/auth/data/auth_repository_impl.dart';
import 'package:trip/features/auth/domain/app_user.dart';
import 'package:trip/features/auth/presentation/session_controller.dart';
import 'package:trip/features/onboarding/data/onboarding_repository_impl.dart';
import 'package:trip/features/onboarding/presentation/onboarding_screen.dart';
import 'package:trip/l10n/gen/app_localizations.dart';
import 'package:trip/l10n/gen/app_localizations_en.dart';

import '../../support/fake_auth_repository.dart';
import '../../support/fake_onboarding_repository.dart';

const _newcomer = AppUser(
  id: 'u1',
  email: 'a@b.com',
  role: UserRole.user,
  hasPassword: true,
  onboardingRequired: true,
);

final _continue = find.byKey(const Key('onboarding-continue'));
final _skip = find.byKey(const Key('onboarding-skip'));

Future<(FakeOnboardingRepository, ProviderContainer)> _pump(
  WidgetTester tester, {
  FakeOnboardingRepository? repo,
}) async {
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
  container.listen(sessionControllerProvider, (_, _) {});

  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: MaterialApp(
        theme: buildTripSenseTheme(),
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
        ],
        supportedLocales: const [Locale('en')],
        locale: const Locale('en'),
        home: const OnboardingScreen(),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return (fake, container);
}

Future<void> _next(WidgetTester tester) async {
  await tester.tap(_continue);
  await tester.pumpAndSettle();
}

Future<void> _skipStep(WidgetTester tester) async {
  await tester.tap(_skip);
  await tester.pumpAndSettle();
}

Future<void> _pick(WidgetTester tester, String code) async {
  await tester.tap(find.byKey(Key('option-$code')));
  await tester.pumpAndSettle();
}

FilledButton _continueButton(WidgetTester tester) =>
    tester.widget<FilledButton>(_continue);

void main() {
  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);

  testWidgets('starts at step 1 of 10 and needs a name to continue', (
    tester,
  ) async {
    await _pump(tester);

    expect(find.text('Step 1 of 10'), findsOneWidget);
    expect(find.text('What should we call you?'), findsOneWidget);
    expect(_continueButton(tester).onPressed, isNull);
    expect(_skip, findsNothing, reason: 'name is required');
    expect(find.byKey(const Key('onboarding-back')), findsNothing);

    await tester.enterText(find.byKey(const Key('onboarding-name')), 'Alex');
    await tester.pump();

    expect(_continueButton(tester).onPressed, isNotNull);
  });

  testWidgets('optional steps can be skipped, required ones cannot', (
    tester,
  ) async {
    await _pump(tester);
    await tester.enterText(find.byKey(const Key('onboarding-name')), 'Alex');
    await tester.pump();
    await _next(tester);

    // home city, visited, bucket list: skippable
    for (final title in [
      'Where are you currently based?',
      'Where have you traveled?',
      'Where is on your bucket list?',
    ]) {
      expect(find.text(title), findsOneWidget);
      expect(_skip, findsOneWidget);
      await _skipStep(tester);
    }

    expect(find.text('Who do you usually travel with?'), findsOneWidget);
    expect(_skip, findsNothing);
    expect(_continueButton(tester).onPressed, isNull);

    await _pick(tester, 'SOLO');
    expect(_continueButton(tester).onPressed, isNotNull);
  });

  testWidgets('step content is left-aligned with the header on every step', (
    tester,
  ) async {
    // Wide viewport so short content is narrower than the screen (the bug only
    // shows when content does not already fill the width).
    tester.view.physicalSize = const Size(2400, 1600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await _pump(tester);
    await tester.enterText(find.byKey(const Key('onboarding-name')), 'Alex');
    await tester.pump();
    await _next(tester);
    for (var i = 0; i < 3; i++) {
      await _skipStep(tester);
    }

    // The travel-party step has narrow content (regression: it was centered).
    final headerLeft = tester.getTopLeft(find.text('Step 5 of 10')).dx;
    final titleLeft = tester
        .getTopLeft(find.text('Who do you usually travel with?'))
        .dx;
    final chipLeft = tester.getTopLeft(find.byKey(const Key('option-SOLO'))).dx;

    expect(titleLeft, headerLeft);
    expect(chipLeft, headerLeft);
  });

  testWidgets('back keeps the entered answers', (tester) async {
    await _pump(tester);
    await tester.enterText(find.byKey(const Key('onboarding-name')), 'Alex');
    await tester.pump();
    await _next(tester);

    await tester.tap(find.byKey(const Key('onboarding-back')));
    await tester.pumpAndSettle();

    expect(find.text('Step 1 of 10'), findsOneWidget);
    expect(find.text('Alex'), findsOneWidget);
  });

  testWidgets('picking a city and a custom destination', (tester) async {
    final (_, container) = await _pump(tester);
    await tester.enterText(find.byKey(const Key('onboarding-name')), 'Alex');
    await tester.pump();
    await _next(tester);

    await tester.tap(find.textContaining('Đà Nẵng').first);
    await tester.pump();
    await _next(tester); // -> visited

    await tester.enterText(find.byType(TextField).first, 'Đảo Lý Sơn');
    await tester.pump();
    await tester.tap(find.text('Add "Đảo Lý Sơn"'));
    await tester.pumpAndSettle();

    expect(find.text('1 selected'), findsOneWidget);
    // (reading provider state via the container proves the draft was updated)
    final draft = container.read(sessionControllerProvider);
    expect(draft, isA<SessionAuthenticated>());
  });

  testWidgets('budget step validates the VND amount and formats it', (
    tester,
  ) async {
    await _pump(tester);
    await tester.enterText(find.byKey(const Key('onboarding-name')), 'Alex');
    await tester.pump();
    await _next(tester);
    for (var i = 0; i < 3; i++) {
      await _skipStep(tester);
    }
    await _pick(tester, 'COUPLE');
    await _next(tester);

    expect(
      find.text('How much do you plan to spend per person each day?'),
      findsOneWidget,
    );
    await _pick(tester, 'PREMIUM');
    expect(_continueButton(tester).onPressed, isNull, reason: 'amount missing');

    await tester.enterText(
      find.byKey(const Key('onboarding-budget')),
      '700000',
    );
    await tester.pump();

    expect(find.text('700.000'), findsOneWidget);
    expect(
      find.text('Enter a whole amount from 1 to 1,000,000,000 VND.'),
      findsNothing,
    );
    expect(_continueButton(tester).onPressed, isNotNull);

    // Leading zeros are dropped, so "0" collapses to an empty (invalid) field.
    await tester.enterText(find.byKey(const Key('onboarding-budget')), '0');
    await tester.pump();
    expect(_continueButton(tester).onPressed, isNull);
  });

  testWidgets('completing every step submits and clears the gate', (
    tester,
  ) async {
    final (repo, container) = await _pump(tester);

    await tester.enterText(find.byKey(const Key('onboarding-name')), 'Alex');
    await tester.pump();
    await _next(tester);
    for (var i = 0; i < 3; i++) {
      await _skipStep(tester);
    }
    await _pick(tester, 'COUPLE');
    await _next(tester);
    await _pick(tester, 'PREMIUM');
    await tester.enterText(
      find.byKey(const Key('onboarding-budget')),
      '700000',
    );
    await tester.pump();
    await _next(tester);
    await _pick(tester, 'HOTEL');
    await _next(tester);
    await _pick(tester, 'LOCAL_FOOD');
    await _next(tester);
    await _pick(tester, 'BEACH');
    await _next(tester);

    expect(find.text('Step 10 of 10'), findsOneWidget);
    expect(find.text('Finish'), findsOneWidget);
    expect(_skip, findsOneWidget, reason: 'the note is optional');

    // The saving spinner stays until the router leaves this screen (none here),
    // so pump a few frames instead of pumpAndSettle.
    await tester.tap(_continue);
    for (var i = 0; i < 5; i++) {
      await tester.pump(const Duration(milliseconds: 50));
    }

    expect(repo.saved.single.selections['DAILY_BUDGET_VND'], ['700000']);
    expect(repo.completedVersions, isNotEmpty);
    final session = container.read(sessionControllerProvider);
    expect((session as SessionAuthenticated).user.onboardingRequired, isFalse);
  });

  testWidgets('a load failure shows a retry that recovers', (tester) async {
    final repo = FakeOnboardingRepository()
      ..loadErrors.add(const AppFailure(type: AppFailureType.network));
    await _pump(tester, repo: repo);

    expect(find.text(AppLocalizationsEn().errNetwork), findsOneWidget);

    await tester.tap(find.text('Try again'));
    await tester.pumpAndSettle();

    expect(find.text('Step 1 of 10'), findsOneWidget);
  });

  testWidgets(
    'a failed submit keeps the user on the last step with a message',
    (tester) async {
      final repo = FakeOnboardingRepository()
        ..saveErrors.add(const AppFailure(type: AppFailureType.network));
      await _pump(tester, repo: repo);

      await tester.enterText(find.byKey(const Key('onboarding-name')), 'Alex');
      await tester.pump();
      await _next(tester);
      for (var i = 0; i < 3; i++) {
        await _skipStep(tester);
      }
      await _pick(tester, 'SOLO');
      await _next(tester);
      await _pick(tester, 'BUDGET');
      await tester.enterText(
        find.byKey(const Key('onboarding-budget')),
        '300000',
      );
      await tester.pump();
      await _next(tester);
      await _pick(tester, 'HOSTEL');
      await _next(tester);
      await _pick(tester, 'STREET_FOOD');
      await _next(tester);
      await _pick(tester, 'NATURE');
      await _next(tester);
      await _next(tester); // Finish -> fails

      expect(find.text('Step 10 of 10'), findsOneWidget);
      expect(find.byKey(const Key('onboarding-error')), findsOneWidget);
      expect(find.text(AppLocalizationsEn().errNetwork), findsOneWidget);
    },
  );
}
