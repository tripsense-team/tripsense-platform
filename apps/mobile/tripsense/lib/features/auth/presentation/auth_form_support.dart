import 'package:flutter/material.dart';

import '../../../core/errors/app_failure.dart';
import '../../../core/ui/failure_message.dart';
import '../../../l10n/gen/app_localizations.dart';

const minPasswordLength = 6;
const otpLength = 6;

final _emailPattern = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');

/// Field validators returning localized messages (null = valid).
class AuthValidators {
  const AuthValidators(this.l10n);
  final AppLocalizations l10n;

  String? email(String? value) {
    final text = value?.trim() ?? '';
    if (text.isEmpty) return l10n.validationRequired;
    return _emailPattern.hasMatch(text) ? null : l10n.validationEmail;
  }

  String? requiredPassword(String? value) =>
      (value == null || value.isEmpty) ? l10n.validationRequired : null;

  String? newPassword(String? value) =>
      (value ?? '').length >= minPasswordLength
      ? null
      : l10n.validationPasswordMin(minPasswordLength);

  String? otp(String? value) => RegExp(r'^\d{6}$').hasMatch(value?.trim() ?? '')
      ? null
      : l10n.validationOtp;
}

/// Shared busy/error handling for single-action auth forms.
mixin SubmitMixin<T extends StatefulWidget> on State<T> {
  final formKey = GlobalKey<FormState>();
  bool busy = false;
  String? errorText;

  /// Validates, runs [action], and surfaces an [AppFailure] as [errorText].
  Future<void> submit(
    Future<void> Function() action, {
    String? unauthorizedMessage,
  }) async {
    if (busy || !(formKey.currentState?.validate() ?? false)) return;
    final l10n = AppLocalizations.of(context);
    setState(() {
      busy = true;
      errorText = null;
    });
    try {
      await action();
    } on AppFailure catch (failure) {
      if (!mounted) return;
      setState(
        () => errorText = failureMessage(
          l10n,
          failure,
          unauthorized: unauthorizedMessage,
        ),
      );
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }
}

/// Common page chrome: scroll-safe, padded, title + optional subtitle.
class AuthFormPage extends StatelessWidget {
  const AuthFormPage({
    super.key,
    required this.title,
    this.subtitle,
    required this.children,
    this.showBack = false,
  });

  final String title;
  final String? subtitle;
  final List<Widget> children;
  final bool showBack;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: showBack ? AppBar() : null,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(title, style: theme.textTheme.headlineMedium),
                  if (subtitle != null) ...[
                    const SizedBox(height: 8),
                    Text(
                      subtitle!,
                      style: theme.textTheme.bodyLarge?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                  const SizedBox(height: 24),
                  ...children,
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class FormError extends StatelessWidget {
  const FormError(this.message, {super.key});
  final String? message;

  @override
  Widget build(BuildContext context) {
    if (message == null) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Text(
        message!,
        style: TextStyle(color: Theme.of(context).colorScheme.error),
      ),
    );
  }
}

/// Primary button that shows a spinner while [busy].
class SubmitButton extends StatelessWidget {
  const SubmitButton({
    super.key,
    required this.label,
    required this.busy,
    required this.onPressed,
  });

  final String label;
  final bool busy;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) => FilledButton(
    onPressed: busy ? null : onPressed,
    child: busy
        ? const SizedBox.square(
            dimension: 22,
            child: CircularProgressIndicator(strokeWidth: 2.5),
          )
        : Text(label),
  );
}
