import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/routes.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../data/auth_repository_impl.dart';
import 'auth_form_support.dart';

class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  ConsumerState<ForgotPasswordScreen> createState() =>
      _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen>
    with SubmitMixin<ForgotPasswordScreen> {
  final _email = TextEditingController();

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    return AuthFormPage(
      showBack: true,
      title: l10n.authForgotPassword,
      subtitle: l10n.authForgotSubtitle,
      children: [
        Form(
          key: formKey,
          child: TextFormField(
            controller: _email,
            keyboardType: TextInputType.emailAddress,
            autofillHints: const [AutofillHints.email],
            decoration: InputDecoration(labelText: l10n.authEmail),
            validator: AuthValidators(l10n).email,
            onFieldSubmitted: (_) => _submit(),
          ),
        ),
        const SizedBox(height: 16),
        FormError(errorText),
        SubmitButton(
          label: l10n.authSendCode,
          busy: busy,
          onPressed: _submit,
        ),
      ],
    );
  }

  Future<void> _submit() => submit(() async {
    final email = _email.text.trim();
    await ref.read(authRepositoryProvider).forgotPassword(email: email);
    if (mounted) {
      unawaited(context.push(Routes.withEmail(Routes.resetPassword, email)));
    }
  });
}
