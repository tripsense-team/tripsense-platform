import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../l10n/gen/app_localizations.dart';
import '../../auth/presentation/session_controller.dart';

/// Minimal profile (Phase 1). Full profile & settings land in Phase 6.
class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final session = ref.watch(sessionControllerProvider);
    final user = session is SessionAuthenticated ? session.user : null;

    return Scaffold(
      appBar: AppBar(title: Text(l10n.navProfile)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (user != null)
            ListTile(
              leading: CircleAvatar(
                backgroundImage: user.avatarUrl == null
                    ? null
                    : NetworkImage(user.avatarUrl!),
                child: user.avatarUrl == null
                    ? Text(user.displayName.characters.first.toUpperCase())
                    : null,
              ),
              title: Text(user.displayName),
              subtitle: Text(user.email),
            ),
          const SizedBox(height: 16),
          OutlinedButton.icon(
            icon: const Icon(Icons.logout),
            label: Text(l10n.commonLogout),
            onPressed: () =>
                ref.read(sessionControllerProvider.notifier).logout(),
          ),
        ],
      ),
    );
  }
}
