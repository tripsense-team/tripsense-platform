import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/routes.dart';
import '../../../l10n/gen/app_localizations.dart';
import 'auth_form_support.dart';
import 'session_controller.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen>
    with SubmitMixin<LoginScreen> {
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
    final session = ref.watch(sessionControllerProvider);
    final roleBlocked =
        session is SessionUnauthenticated && session.roleBlocked;

    return AuthFormPage(
      title: l10n.authLoginTitle,
      showHero: true,
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
                autofillHints: const [AutofillHints.email],
                textInputAction: TextInputAction.next,
                decoration: InputDecoration(labelText: l10n.authEmail),
                validator: validators.email,
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _password,
                obscureText: true,
                autofillHints: const [AutofillHints.password],
                textInputAction: TextInputAction.done,
                decoration: InputDecoration(labelText: l10n.authPassword),
                validator: validators.requiredPassword,
                onFieldSubmitted: (_) => _submit(l10n),
              ),
            ],
          ),
        ),
        Align(
          alignment: Alignment.centerRight,
          child: TextButton(
            onPressed: () => context.push(Routes.forgotPassword),
            child: Text(l10n.authForgotPassword),
          ),
        ),
        if (roleBlocked) FormError(l10n.errWebOnlyRole),
        FormError(errorText),
        SubmitButton(
          label: l10n.authLoginButton,
          busy: busy,
          onPressed: () => _submit(l10n),
        ),
        const SizedBox(height: 16),
        Wrap(
          alignment: WrapAlignment.center,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            Text(l10n.authNoAccount),
            TextButton(
              onPressed: () => context.push(Routes.register),
              child: Text(l10n.authRegisterTitle),
            ),
          ],
        ),
      ],
    );
  }

  Future<void> _submit(AppLocalizations l10n) => submit(
    () => ref
        .read(sessionControllerProvider.notifier)
        .login(email: _email.text, password: _password.text),
    unauthorizedMessage: l10n.errBadCredentials,
  );
}
