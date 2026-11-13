import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:trip/core/errors/app_failure.dart';
import 'package:trip/features/auth/presentation/forgot_password_screen.dart';
import 'package:trip/features/auth/presentation/register_screen.dart';
import 'package:trip/features/auth/presentation/reset_password_screen.dart';
import 'package:trip/features/auth/presentation/verify_email_screen.dart';

import '../../support/fake_auth_repository.dart';
import '../../support/test_app.dart';

Finder _button(String label) => find.widgetWithText(FilledButton, label);

void main() {
  group('RegisterScreen', () {
    testWidgets('rejects short passwords and bad emails', (tester) async {
      final repo = FakeAuthRepository();
      await tester.pumpWidget(
        testApp(home: const RegisterScreen(), repo: repo),
      );

      await tester.enterText(find.byType(TextFormField).first, 'nope');
      await tester.enterText(find.byType(TextFormField).last, '123');
      await tester.tap(_button('Create account'));
      await tester.pump();

      expect(find.text('Enter a valid email address'), findsOneWidget);
      expect(
        find.text('Password must be at least 6 characters'),
        findsOneWidget,
      );
      expect(repo.registered, isEmpty);
    });

    testWidgets('registers then opens the OTP screen for that email', (
      tester,
    ) async {
      final repo = FakeAuthRepository();
      await tester.pumpWidget(
        testApp(home: const RegisterScreen(), repo: repo),
      );

      await tester.enterText(find.byType(TextFormField).first, 'a@b.com');
      await tester.enterText(find.byType(TextFormField).last, 'secret1');
      await tester.tap(_button('Create account'));
      await tester.pumpAndSettle();

      expect(repo.registered, ['a@b.com']);
      expect(find.text('VERIFY a@b.com'), findsOneWidget);
    });

    testWidgets('shows the conflict message from the server', (tester) async {
      final repo = FakeAuthRepository()
        ..registerError = const AppFailure(
          type: AppFailureType.conflict,
          serverMessage: 'Email already registered',
        );
      await tester.pumpWidget(
        testApp(home: const RegisterScreen(), repo: repo),
      );

      await tester.enterText(find.byType(TextFormField).first, 'a@b.com');
      await tester.enterText(find.byType(TextFormField).last, 'secret1');
      await tester.tap(_button('Create account'));
      await tester.pumpAndSettle();

      expect(find.text('Email already registered'), findsOneWidget);
    });
  });

  group('VerifyEmailScreen', () {
    testWidgets('requires a 6-digit code', (tester) async {
      final repo = FakeAuthRepository();
      await tester.pumpWidget(
        testApp(
          home: const VerifyEmailScreen(email: 'a@b.com'),
          repo: repo,
        ),
      );

      await tester.enterText(find.byType(TextFormField), '12');
      await tester.tap(_button('Verify'));
      await tester.pump();

      expect(find.text('Enter the 6-digit code'), findsOneWidget);
      expect(repo.verified, isEmpty);
    });

    testWidgets('verifies and returns to login with a confirmation', (
      tester,
    ) async {
      final repo = FakeAuthRepository();
      await tester.pumpWidget(
        testApp(
          home: const VerifyEmailScreen(email: 'a@b.com'),
          repo: repo,
        ),
      );

      await tester.enterText(find.byType(TextFormField), '123456');
      await tester.tap(_button('Verify'));
      await tester.pumpAndSettle();

      expect(repo.verified, ['a@b.com:123456']);
      expect(find.textContaining('LOGIN'), findsOneWidget);
      expect(find.text('Email verified. Please sign in.'), findsOneWidget);
    });

    testWidgets('resend requests a new code and confirms', (tester) async {
      final repo = FakeAuthRepository();
      await tester.pumpWidget(
        testApp(
          home: const VerifyEmailScreen(email: 'a@b.com'),
          repo: repo,
        ),
      );

      await tester.tap(find.text('Resend code'));
      await tester.pumpAndSettle();

      expect(repo.resent, ['a@b.com']);
      expect(find.text('A new code has been sent.'), findsOneWidget);
    });
  });

  group('ForgotPasswordScreen', () {
    testWidgets('validates the email', (tester) async {
      final repo = FakeAuthRepository();
      await tester.pumpWidget(
        testApp(home: const ForgotPasswordScreen(), repo: repo),
      );

      await tester.tap(_button('Send code'));
      await tester.pump();

      expect(find.text('This field is required'), findsOneWidget);
      expect(repo.forgot, isEmpty);
    });

    testWidgets('sends the code and opens the reset screen', (tester) async {
      final repo = FakeAuthRepository();
      await tester.pumpWidget(
        testApp(home: const ForgotPasswordScreen(), repo: repo),
      );

      await tester.enterText(find.byType(TextFormField), 'a@b.com');
      await tester.tap(_button('Send code'));
      await tester.pumpAndSettle();

      expect(repo.forgot, ['a@b.com']);
      expect(find.text('RESET a@b.com'), findsOneWidget);
    });
  });

  group('ResetPasswordScreen', () {
    testWidgets('requires both the code and a valid new password', (
      tester,
    ) async {
      final repo = FakeAuthRepository();
      await tester.pumpWidget(
        testApp(
          home: const ResetPasswordScreen(email: 'a@b.com'),
          repo: repo,
        ),
      );

      await tester.tap(_button('Update password'));
      await tester.pump();

      expect(find.text('Enter the 6-digit code'), findsOneWidget);
      expect(
        find.text('Password must be at least 6 characters'),
        findsOneWidget,
      );
      expect(repo.reset, isEmpty);
    });

    testWidgets('resets the password and returns to login', (tester) async {
      final repo = FakeAuthRepository();
      await tester.pumpWidget(
        testApp(
          home: const ResetPasswordScreen(email: 'a@b.com'),
          repo: repo,
        ),
      );

      await tester.enterText(find.byType(TextFormField).first, '654321');
      await tester.enterText(find.byType(TextFormField).last, 'newpass1');
      await tester.tap(_button('Update password'));
      await tester.pumpAndSettle();

      expect(repo.reset, ['a@b.com:654321']);
      expect(find.textContaining('LOGIN'), findsOneWidget);
      expect(find.text('Password updated. Please sign in.'), findsOneWidget);
    });
  });
}
