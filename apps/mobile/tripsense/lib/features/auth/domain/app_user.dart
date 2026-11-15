enum UserRole { user, admin, moderator, partner }

UserRole parseUserRole(String? raw) {
  final value = raw?.trim().toUpperCase().replaceFirst('ROLE_', '');
  return switch (value) {
    'ADMIN' => UserRole.admin,
    'MODERATOR' => UserRole.moderator,
    'PARTNER' => UserRole.partner,
    _ => UserRole.user,
  };
}

/// Signed-in account. The mobile app serves travelers only.
class AppUser {
  const AppUser({
    required this.id,
    required this.email,
    required this.role,
    required this.hasPassword,
    this.name,
    this.avatarUrl,
    this.onboardingRequired = false,
  });

  factory AppUser.fromJson(Map<String, dynamic> json) => AppUser(
    id: json['id'] as String,
    email: json['email'] as String,
    role: parseUserRole(json['role'] as String?),
    hasPassword: json['hasPassword'] as bool? ?? true,
  );

  final String id;
  final String email;
  final UserRole role;
  final bool hasPassword;
  final String? name;
  final String? avatarUrl;
  final bool onboardingRequired;

  /// Admin / moderator / partner accounts are managed on the web.
  bool get isTraveler => role == UserRole.user;

  String get displayName => (name?.trim().isNotEmpty ?? false) ? name! : email;

  AppUser withProfile({
    String? name,
    String? avatarUrl,
    required bool onboardingRequired,
  }) => AppUser(
    id: id,
    email: email,
    role: role,
    hasPassword: hasPassword,
    name: name,
    avatarUrl: avatarUrl,
    onboardingRequired: onboardingRequired,
  );
}
