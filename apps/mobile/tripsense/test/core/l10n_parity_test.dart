import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

Map<String, dynamic> _arb(String name) =>
    jsonDecode(File('lib/l10n/$name').readAsStringSync())
        as Map<String, dynamic>;

Set<String> _messageKeys(Map<String, dynamic> arb) =>
    arb.keys.where((key) => !key.startsWith('@')).toSet();

/// Mirrors the web `i18n:check` rule: every locale must define the same keys.
void main() {
  final en = _arb('app_en.arb');
  final vi = _arb('app_vi.arb');

  test('vi and en define exactly the same message keys', () {
    expect(_messageKeys(vi).difference(_messageKeys(en)), isEmpty,
        reason: 'keys only in vi');
    expect(_messageKeys(en).difference(_messageKeys(vi)), isEmpty,
        reason: 'keys only in en');
  });

  test('placeholders are used identically in both languages', () {
    final placeholder = RegExp(r'\{(\w+)\}');
    for (final key in _messageKeys(en)) {
      final inEn = placeholder
          .allMatches(en[key] as String)
          .map((m) => m.group(1))
          .toSet();
      final inVi = placeholder
          .allMatches(vi[key] as String)
          .map((m) => m.group(1))
          .toSet();
      expect(inVi, inEn, reason: 'placeholders of "$key"');
    }
  });

  test('no translation is empty', () {
    for (final arb in [en, vi]) {
      for (final key in _messageKeys(arb)) {
        expect((arb[key] as String).trim(), isNotEmpty, reason: key);
      }
    }
  });
}
