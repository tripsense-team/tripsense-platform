import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:trip/features/onboarding/domain/onboarding_catalog.dart';
import 'package:trip/features/onboarding/domain/onboarding_draft.dart';
import 'package:trip/features/onboarding/domain/onboarding_profile.dart';
import 'package:trip/features/onboarding/presentation/vnd_input_formatter.dart';

/// A draft that passes every step.
OnboardingDraft validDraft() => const OnboardingDraft(
  name: 'Alex',
  dailyBudget: '700000',
  selections: {
    Dimension.travelParty: ['COUPLE'],
    Dimension.budgetTier: ['PREMIUM'],
    Dimension.stayStyle: ['HOTEL'],
    Dimension.foodStyle: ['LOCAL_FOOD'],
    Dimension.activityInterest: ['BEACH'],
  },
);

void main() {
  group('catalog helpers', () {
    test('foldVietnamese strips diacritics and lowercases', () {
      expect(foldVietnamese('Đà Nẵng'), 'da nang');
      expect(foldVietnamese('Huế'), 'hue');
      expect(foldVietnamese('TP. Hồ Chí Minh'), 'tp. ho chi minh');
    });

    test('toPlaceRef builds stable slugs like the web', () {
      expect(toPlaceRef('Đà Nẵng'), 'da-nang');
      expect(toPlaceRef('TP. Hồ Chí Minh'), 'tp-ho-chi-minh');
      expect(toPlaceRef('  Hà   Giang  '), 'ha-giang');
      expect(toPlaceRef('!!!'), '');
      expect(toPlaceRef('a' * 200).length, 80);
    });

    test('toOptionCode builds backend-safe upper-case codes', () {
      expect(toOptionCode('Đi chợ đêm'), 'DI_CHO_DEM');
      expect(toOptionCode('Spa & Wellness'), 'SPA_WELLNESS');
      expect(toOptionCode('???'), 'CUSTOM');
      expect(
        RegExp(r'^[A-Z0-9_\-]{1,80}$').hasMatch(toOptionCode('Cà phê 24/7')),
        isTrue,
      );
    });

    test('every curated destination has a valid reference', () {
      for (final d in [...popularDestinations, ...popularHomeCities]) {
        expect(
          RegExp(r'^[A-Za-z0-9_:\-]{1,160}$').hasMatch(d.ref),
          isTrue,
          reason: d.name,
        );
      }
    });

    test('only optional steps can be skipped', () {
      final optional = OnboardingStep.values.where((s) => s.isOptional);
      expect(optional, [
        OnboardingStep.homeCity,
        OnboardingStep.visited,
        OnboardingStep.bucketList,
        OnboardingStep.note,
      ]);
    });
  });

  group('VND formatting', () {
    test('groups thousands with dots', () {
      expect(formatVnd('7'), '7');
      expect(formatVnd('700000'), '700.000');
      expect(formatVnd('1000000000'), '1.000.000.000');
    });

    test('formatter keeps digits only, drops leading zeros, caps at 10', () {
      const formatter = VndInputFormatter();
      String run(String text) => formatter
          .formatEditUpdate(
            TextEditingValue.empty,
            TextEditingValue(text: text),
          )
          .text;

      expect(run('0700000'), '700.000');
      expect(run('12ab34'), '1.234');
      expect(run('99999999999'), '9.999.999.999');
      expect(digitsOf('700.000'), '700000');
    });
  });

  group('OnboardingProfile.fromJson', () {
    test('parses the context-service document', () {
      final profile = OnboardingProfile.fromJson({
        'version': 3,
        'status': 'IN_PROGRESS',
        'selections': {
          'TRAVEL_PARTY': ['SOLO'],
        },
        'places': {
          'VISITED': ['da-nang'],
          'WANT_TO_VISIT': ['tokyo', 'bali'],
        },
        'attributes': {'HOME_CITY': '{"name":"Hà Nội"}'},
        'freeText': 'slow travel',
      });

      expect(profile.version, 3);
      expect(profile.completed, isFalse);
      expect(profile.selections['TRAVEL_PARTY'], ['SOLO']);
      expect(profile.visited, ['da-nang']);
      expect(profile.wantToVisit, ['tokyo', 'bali']);
      expect(profile.freeText, 'slow travel');
    });

    test('tolerates missing fields and detects COMPLETED', () {
      final profile = OnboardingProfile.fromJson({'status': 'COMPLETED'});
      expect(profile.completed, isTrue);
      expect(profile.version, 0);
      expect(profile.selections, isEmpty);
    });
  });

  group('OnboardingDraft validation', () {
    test('name is required; optional steps are always valid', () {
      const empty = OnboardingDraft();
      expect(empty.isStepValid(OnboardingStep.name), isFalse);
      expect(
        const OnboardingDraft(name: '  ').isStepValid(OnboardingStep.name),
        isFalse,
      );
      for (final step in [
        OnboardingStep.homeCity,
        OnboardingStep.visited,
        OnboardingStep.bucketList,
        OnboardingStep.note,
      ]) {
        expect(empty.isStepValid(step), isTrue, reason: '$step');
      }
    });

    test('preference steps need at least one answer', () {
      const empty = OnboardingDraft();
      for (final step in [
        OnboardingStep.travelParty,
        OnboardingStep.stay,
        OnboardingStep.food,
        OnboardingStep.activity,
      ]) {
        expect(empty.isStepValid(step), isFalse, reason: '$step');
      }
      expect(validDraft().isStepValid(OnboardingStep.stay), isTrue);
    });

    test('budget needs a tier AND a whole VND amount from 1 to 1e9', () {
      final base = validDraft();
      expect(base.isStepValid(OnboardingStep.budget), isTrue);

      for (final bad in ['', '0', '05', '-5', '1.5', '1000000001', 'abc']) {
        expect(
          base.copyWith(dailyBudget: bad).hasValidDailyBudget,
          isFalse,
          reason: bad,
        );
      }
      expect(
        base.copyWith(dailyBudget: '1000000000').hasValidDailyBudget,
        isTrue,
      );
      expect(
        base.copyWith(selections: {}).isStepValid(OnboardingStep.budget),
        isFalse,
      );
    });

    test('free text is limited to 2000 characters', () {
      final long = validDraft().copyWith(freeText: 'x' * 2001);
      expect(long.isStepValid(OnboardingStep.note), isFalse);
    });

    test('firstInvalidStep points at the earliest blocking step', () {
      expect(const OnboardingDraft().firstInvalidStep, OnboardingStep.name);
      expect(validDraft().firstInvalidStep, isNull);
      expect(
        validDraft().copyWith(dailyBudget: '').firstInvalidStep,
        OnboardingStep.budget,
      );
    });
  });

  group('OnboardingDraft edits', () {
    test('single answers replace, multiple answers toggle', () {
      var draft = const OnboardingDraft();
      draft = draft.toggleOption(Dimension.travelParty, 'SOLO', single: true);
      draft = draft.toggleOption(Dimension.travelParty, 'COUPLE', single: true);
      expect(draft.answers(Dimension.travelParty), ['COUPLE']);

      draft = draft.toggleOption(Dimension.stayStyle, 'HOTEL');
      draft = draft.toggleOption(Dimension.stayStyle, 'HOSTEL');
      expect(draft.answers(Dimension.stayStyle), ['HOTEL', 'HOSTEL']);
      draft = draft.toggleOption(Dimension.stayStyle, 'HOTEL');
      expect(draft.answers(Dimension.stayStyle), ['HOSTEL']);
    });

    test('places toggle per list and stop at the maximum', () {
      var draft = const OnboardingDraft();
      draft = draft.togglePlace(OnboardingStep.visited, 'da-nang');
      draft = draft.togglePlace(OnboardingStep.bucketList, 'tokyo');
      expect(draft.visited, ['da-nang']);
      expect(draft.wantToVisit, ['tokyo']);

      draft = draft.togglePlace(OnboardingStep.visited, 'da-nang');
      expect(draft.visited, isEmpty);

      var full = const OnboardingDraft();
      for (var i = 0; i < maxPlacesPerList; i++) {
        full = full.togglePlace(OnboardingStep.visited, 'p$i');
      }
      final blocked = full.togglePlace(OnboardingStep.visited, 'extra');
      expect(identical(blocked, full), isTrue);
      expect(blocked.visited.length, maxPlacesPerList);
    });
  });

  group('OnboardingDraft.toRequest', () {
    test('builds a valid request with the daily budget as digits', () {
      final request = validDraft().toRequest(4);

      expect(request.version, 4);
      expect(request.selections[Dimension.dailyBudgetVnd], ['700000']);
      expect(request.selections[Dimension.travelParty], ['COUPLE']);
      expect(request.freeText, isNull);
      expect(request.toJson()['places'], {
        'VISITED': <String>[],
        'WANT_TO_VISIT': <String>[],
      });
    });

    test('falls back to safe defaults like the web', () {
      final request = const OnboardingDraft(name: 'A').toRequest(0);

      expect(request.selections[Dimension.travelParty], ['SOLO']);
      expect(request.selections[Dimension.budgetTier], ['MID_RANGE']);
      expect(request.selections[Dimension.dailyBudgetVnd], [
        defaultDailyBudgetVnd,
      ]);
    });

    test('drops unknown dimensions, bad codes and bad place refs', () {
      final draft = validDraft().copyWith(
        selections: {
          ...validDraft().selections,
          'HACKED_DIMENSION': ['X'],
          Dimension.foodStyle: ['LOCAL_FOOD', 'bad code!', ''],
        },
        visited: ['da-nang', 'not valid!', 'ok_ref:1'],
        wantToVisit: ['<script>'],
      );
      final request = draft.toRequest(1);

      expect(request.selections.containsKey('HACKED_DIMENSION'), isFalse);
      expect(request.selections[Dimension.foodStyle], ['LOCAL_FOOD']);
      expect(request.visited, ['da-nang', 'ok_ref:1']);
      expect(request.wantToVisit, isEmpty);
    });

    test('stores the home city and custom labels as JSON attributes', () {
      final draft = validDraft().copyWith(
        homeCity: 'Đà Nẵng',
        customLabels: {'DI_CHO': 'Đi chợ'},
      );
      final attributes = draft.toRequest(1).attributes;

      expect(jsonDecode(attributes['HOME_CITY']!), {
        'name': 'Đà Nẵng',
        'placeRef': 'da-nang',
        'country': 'Vietnam',
      });
      expect(jsonDecode(attributes['CUSTOM_PREFERENCE_LABELS']!), {
        'DI_CHO': 'Đi chợ',
      });
    });

    test('trims free text and caps it at 2000 characters', () {
      expect(
        validDraft().copyWith(freeText: '  hi  ').toRequest(1).freeText,
        'hi',
      );
      expect(
        validDraft()
            .copyWith(freeText: 'x' * 2500)
            .toRequest(1)
            .freeText!
            .length,
        2000,
      );
    });
  });

  group('OnboardingDraft.fromProfile', () {
    test('restores a saved in-progress draft', () {
      final profile = OnboardingProfile.fromJson({
        'version': 2,
        'status': 'IN_PROGRESS',
        'selections': {
          'TRAVEL_PARTY': ['FAMILY'],
          'DAILY_BUDGET_VND': ['900000'],
        },
        'places': {
          'VISITED': ['hue'],
          'WANT_TO_VISIT': ['seoul'],
        },
        'attributes': {
          'HOME_CITY': '{"name":"Hà Nội","placeRef":"ha-noi"}',
          'CUSTOM_PREFERENCE_LABELS': '{"DI_CHO":"Đi chợ"}',
        },
        'freeText': 'notes',
      });

      final draft = OnboardingDraft.fromProfile(profile, name: 'Alex');

      expect(draft.name, 'Alex');
      expect(draft.homeCity, 'Hà Nội');
      expect(draft.dailyBudget, '900000');
      expect(draft.answers(Dimension.travelParty), ['FAMILY']);
      expect(draft.selections.containsKey(Dimension.dailyBudgetVnd), isFalse);
      expect(draft.visited, ['hue']);
      expect(draft.wantToVisit, ['seoul']);
      expect(draft.customLabels, {'DI_CHO': 'Đi chợ'});
      expect(draft.freeText, 'notes');
    });

    test('survives malformed attribute JSON', () {
      final profile = OnboardingProfile.fromJson({
        'attributes': {
          'HOME_CITY': 'Cần Thơ',
          'CUSTOM_PREFERENCE_LABELS': '{oops',
        },
      });
      final draft = OnboardingDraft.fromProfile(profile);

      expect(draft.homeCity, 'Cần Thơ');
      expect(draft.customLabels, isEmpty);
    });
  });
}
