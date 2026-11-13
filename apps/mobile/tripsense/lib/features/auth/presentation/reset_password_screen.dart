import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/routes.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../data/auth_repository_impl.dart';
import 'auth_form_support.dart';

class ResetPasswordScreen extends ConsumerStatefulWidget {
  const ResetPasswordScreen({super.key, required this.email});

  final String email;

  @override
  ConsumerState<ResetPasswordScreen> createState() =>
      _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends ConsumerState<ResetPasswordScreen>
    with SubmitMixin<ResetPasswordScreen> {
  final _code = TextEditingController();
  final _password = TextEditingController();

  @override
  void dispose() {
    _code.dispose();
    _password.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final validators = AuthValidators(l10n);

    return AuthFormPage(
      showBack: true,
      title: l10n.authResetTitle,
      subtitle: l10n.authVerifySubtitle(widget.email),
      children: [
        Form(
          key: formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextFormField(
                controller: _code,
                keyboardType: TextInputType.number,
                maxLength: otpLength,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                autofillHints: const [AutofillHints.oneTimeCode],
                decoration: InputDecoration(labelText: l10n.authOtpCode),
                validator: validators.otp,
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: _password,
                obscureText: true,
                autofillHints: const [AutofillHints.newPassword],
                decoration: InputDecoration(labelText: l10n.authNewPassword),
                validator: validators.newPassword,
                onFieldSubmitted: (_) => _submit(l10n),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        FormError(errorText),
        SubmitButton(
          label: l10n.authResetButton,
          busy: busy,
          onPressed: () => _submit(l10n),
        ),
      ],
    );
  }

  Future<void> _submit(AppLocalizations l10n) => submit(() async {
    await ref
        .read(authRepositoryProvider)
        .resetPassword(
          email: widget.email,
          code: _code.text.trim(),
          newPassword: _password.text,
        );
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(l10n.authResetDone)));
    context.go(Routes.login);
  });
}
