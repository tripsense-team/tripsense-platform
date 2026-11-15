import 'package:flutter/services.dart';

const _maxDigits = 10; // up to 1.000.000.000

/// "700000" -> "700.000" (Vietnamese thousands separator).
String formatVnd(String digits) {
  final buffer = StringBuffer();
  for (var i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 == 0) buffer.write('.');
    buffer.write(digits[i]);
  }
  return buffer.toString();
}

/// Keeps only digits (no leading zero, max 10) and shows grouped thousands.
/// The raw digits are recovered with [digitsOf].
class VndInputFormatter extends TextInputFormatter {
  const VndInputFormatter();

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    var digits = digitsOf(newValue.text).replaceFirst(RegExp(r'^0+'), '');
    if (digits.length > _maxDigits) digits = digits.substring(0, _maxDigits);
    final text = formatVnd(digits);
    return TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
  }
}

String digitsOf(String text) => text.replaceAll(RegExp(r'[^0-9]'), '');
