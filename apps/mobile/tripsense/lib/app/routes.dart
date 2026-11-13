/// Single source of truth for route paths.
abstract final class Routes {
  static const splash = '/';
  static const login = '/login';
  static const register = '/register';
  static const verifyEmail = '/verify-email';
  static const forgotPassword = '/forgot-password';
  static const resetPassword = '/reset-password';
  static const onboarding = '/onboarding';

  static const explore = '/explore';
  static const chat = '/chat';
  static const trips = '/trips';
  static const aiPlanner = '/ai-planner';
  static const saved = '/saved';
  static const community = '/community';
  static const profile = '/profile';

  static const emailParam = 'email';

  static String withEmail(String path, String email) =>
      Uri(path: path, queryParameters: {emailParam: email}).toString();

  /// Routes reachable without a session.
  static const publicPaths = {
    splash,
    login,
    register,
    verifyEmail,
    forgotPassword,
    resetPassword,
  };
}
