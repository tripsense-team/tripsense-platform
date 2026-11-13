// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appName => 'TripSense';

  @override
  String get commonRetry => 'Try again';

  @override
  String get commonCancel => 'Cancel';

  @override
  String get commonContinue => 'Continue';

  @override
  String get commonBack => 'Back';

  @override
  String get commonLogout => 'Log out';

  @override
  String get commonLoading => 'Loading…';

  @override
  String get commonEmpty => 'Nothing here yet';

  @override
  String get navExplore => 'Explore';

  @override
  String get navTrips => 'Trips';

  @override
  String get navAiPlanner => 'AI Planner';

  @override
  String get navCommunity => 'Community';

  @override
  String get navProfile => 'Profile';

  @override
  String get comingSoon => 'Coming soon';

  @override
  String get errNetwork => 'No internet connection. Please check your network.';

  @override
  String get errTimeout => 'The request took too long. Please try again.';

  @override
  String get errUnauthorized =>
      'Your session has expired. Please sign in again.';

  @override
  String get errForbidden =>
      'Your account is not activated or has been suspended.';

  @override
  String get errNotFound => 'We couldn\'t find what you were looking for.';

  @override
  String get errConflict => 'This already exists. Please check and try again.';

  @override
  String get errValidation =>
      'Some information is invalid. Please check and try again.';

  @override
  String get errRateLimited => 'Too many attempts. Please wait a moment.';

  @override
  String get errServer =>
      'Something went wrong on our side. Please try again later.';

  @override
  String get errUnknown => 'Something went wrong. Please try again.';

  @override
  String errIncident(String id) {
    return 'Reference: $id';
  }

  @override
  String get errBadCredentials => 'Incorrect email or password.';

  @override
  String get errWebOnlyRole =>
      'This account is managed on the TripSense website. Please sign in there.';

  @override
  String get authWelcomeTitle => 'Welcome to TripSense';

  @override
  String get authWelcomeSubtitle => 'Plan smarter trips with AI.';

  @override
  String get authLoginTitle => 'Sign in';

  @override
  String get authEmail => 'Email';

  @override
  String get authPassword => 'Password';

  @override
  String get authLoginButton => 'Sign in';

  @override
  String get authNoAccount => 'Don\'t have an account?';

  @override
  String get authRegisterTitle => 'Create account';

  @override
  String get authRegisterButton => 'Create account';

  @override
  String get authHaveAccount => 'Already have an account?';

  @override
  String get authForgotPassword => 'Forgot password?';

  @override
  String get authForgotSubtitle =>
      'Enter your email and we\'ll send you a 6-digit code.';

  @override
  String get authSendCode => 'Send code';

  @override
  String get authResetTitle => 'Reset password';

  @override
  String get authNewPassword => 'New password';

  @override
  String get authResetButton => 'Update password';

  @override
  String get authResetDone => 'Password updated. Please sign in.';

  @override
  String get authVerifyTitle => 'Verify your email';

  @override
  String authVerifySubtitle(String email) {
    return 'Enter the 6-digit code sent to $email.';
  }

  @override
  String get authOtpCode => '6-digit code';

  @override
  String get authVerifyButton => 'Verify';

  @override
  String get authResendCode => 'Resend code';

  @override
  String get authCodeSent => 'A new code has been sent.';

  @override
  String get authVerified => 'Email verified. Please sign in.';

  @override
  String get validationRequired => 'This field is required';

  @override
  String get validationEmail => 'Enter a valid email address';

  @override
  String validationPasswordMin(int min) {
    return 'Password must be at least $min characters';
  }

  @override
  String get validationOtp => 'Enter the 6-digit code';
}
