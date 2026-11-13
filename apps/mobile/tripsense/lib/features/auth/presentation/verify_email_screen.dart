import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/routes.dart';
import '../../../core/errors/app_failure.dart';
import '../../../core/ui/failure_message.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../data/auth_repository_impl.dart';
import 'auth_form_support.dart';

class VerifyEmailScreen extends ConsumerStatefulWidget {
  const VerifyEmailScreen({super.key, required this.email});

  final String email;

  @override
  ConsumerState<VerifyEmailScreen> createState() => _VerifyEmailScreenState();
}

class _VerifyEmailScreenState extends ConsumerState<VerifyEmailScreen>
    with SubmitMixin<VerifyEmailScreen> {
  final _code = TextEditingController();

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final validators = AuthValidators(l10n);

    return AuthFormPage(
      showBack: true,
      title: l10n.authVerifyTitle,
      subtitle: l10n.authVerifySubtitle(widget.email),
      children: [
        Form(
          key: formKey,
          child: TextFormField(
            controller: _code,
            keyboardType: TextInputType.number,
            maxLength: otpLength,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            autofillHints: const [AutofillHints.oneTimeCode],
            decoration: InputDecoration(labelText: l10n.authOtpCode),
            validator: validators.otp,
            onFieldSubmitted: (_) => _verify(l10n),
          ),
        ),
        FormError(errorText),
        SubmitButton(
          label: l10n.authVerifyButton,
          busy: busy,
          onPressed: () => _verify(l10n),
        ),
        TextButton(
          onPressed: busy ? null : () => _resend(l10n),
          child: Text(l10n.authResendCode),
        ),
      ],
    );
  }

  Future<void> _verify(AppLocalizations l10n) => submit(() async {
    await ref
        .read(authRepositoryProvider)
        .verifyEmail(email: widget.email, code: _code.text.trim());
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(l10n.authVerified)));
    context.go(Routes.login);
  });

  Future<void> _resend(AppLocalizations l10n) async {
    final messenger = ScaffoldMessenger.of(context);
    try {
      await ref.read(authRepositoryProvider).resendCode(email: widget.email);
      messenger.showSnackBar(SnackBar(content: Text(l10n.authCodeSent)));
    } on AppFailure catch (failure) {
      messenger.showSnackBar(
        SnackBar(content: Text(failureMessage(l10n, failure))),
      );
    }
  }
}
