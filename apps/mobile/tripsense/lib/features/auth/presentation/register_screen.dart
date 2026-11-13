import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/routes.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../data/auth_repository_impl.dart';
import 'auth_form_support.dart';

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen>
    with SubmitMixin<RegisterScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final validators = AuthValidators(l10n);

    return AuthFormPage(
      showBack: true,
      title: l10n.authRegisterTitle,
      subtitle: l10n.authWelcomeSubtitle,
      children: [
        Form(
          key: formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextFormField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                autofillHints: const [AutofillHints.newUsername],
                textInputAction: TextInputAction.next,
                decoration: InputDecoration(labelText: l10n.authEmail),
                validator: validators.email,
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _password,
                obscureText: true,
                autofillHints: const [AutofillHints.newPassword],
                textInputAction: TextInputAction.done,
                decoration: InputDecoration(labelText: l10n.authPassword),
                validator: validators.newPassword,
                onFieldSubmitted: (_) => _submit(),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        FormError(errorText),
        SubmitButton(
          label: l10n.authRegisterButton,
          busy: busy,
          onPressed: _submit,
        ),
      ],
    );
  }

  Future<void> _submit() => submit(() async {
    final email = _email.text.trim();
    await ref
        .read(authRepositoryProvider)
        .register(email: email, password: _password.text);
    if (mounted) context.go(Routes.withEmail(Routes.verifyEmail, email));
  });
}
