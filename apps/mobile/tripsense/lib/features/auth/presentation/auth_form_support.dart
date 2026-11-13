import 'package:flutter/material.dart';

import '../../../app/design/app_tokens.dart';
import '../../../core/errors/app_failure.dart';
import '../../../core/ui/brand.dart';
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

/// Common page chrome (web auth look): logo, optional gradient hero, bold
/// title + muted subtitle, then the form. Scroll-safe and width-limited.
class AuthFormPage extends StatelessWidget {
  const AuthFormPage({
    super.key,
    required this.title,
    this.subtitle,
    required this.children,
    this.showBack = false,
    this.showHero = false,
  });

  final String title;
  final String? subtitle;
  final List<Widget> children;
  final bool showBack;
  final bool showHero;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final l10n = AppLocalizations.of(context);
    final colors = context.colors;

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.xl,
              AppSpacing.lg,
              AppSpacing.xl,
              AppSpacing.xl,
            ),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      if (showBack) ...[
                        IconButton.outlined(
                          onPressed: () => Navigator.maybePop(context),
                          icon: const Icon(Icons.arrow_back, size: 20),
                          tooltip: l10n.commonBack,
                          style: IconButton.styleFrom(
                            side: BorderSide(color: colors.border),
                          ),
                        ),
                        const SizedBox(width: AppSpacing.md),
                      ],
                      const BrandHeader(),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.xl),
                  if (showHero) ...[
                    BrandHero(
                      badge: l10n.authHeroBadge,
                      title: l10n.authHeroTitle,
                      subtitle: l10n.authHeroSubtitle,
                    ),
                    const SizedBox(height: AppSpacing.xl),
                  ],
                  Text(
                    title,
                    style: theme.textTheme.headlineSmall?.copyWith(
                      fontSize: 28,
                      letterSpacing: -0.6,
                    ),
                  ),
                  if (subtitle != null) ...[
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      subtitle!,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: colors.mutedForeground,
                      ),
                    ),
                  ],
                  const SizedBox(height: AppSpacing.xl),
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
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      child: InlineAlert(message!),
    );
  }
}

/// Primary pill button that shows a spinner while [busy].
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
        ? SizedBox.square(
            dimension: 22,
            child: CircularProgressIndicator(
              strokeWidth: 2.5,
              color: context.colors.primaryForeground,
            ),
          )
        : Text(label),
  );
}
