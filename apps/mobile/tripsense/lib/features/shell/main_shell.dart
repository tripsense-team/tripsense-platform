import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/design/app_tokens.dart';
import '../../app/routes.dart';
import '../../core/ui/brand.dart';
import '../../l10n/gen/app_localizations.dart';
import '../auth/presentation/session_controller.dart';

/// Header + bottom navigation shared by the five top-level traveler tabs.
/// Mirrors the web mobile layout: logo and user menu on top, five tabs below.
class MainShell extends StatelessWidget {
  const MainShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colors = context.colors;

    return Scaffold(
      appBar: AppBar(
        titleSpacing: AppSpacing.page,
        toolbarHeight: 64,
        title: const BrandHeader(size: 36),
        actions: const [
          _UserMenu(),
          SizedBox(width: AppSpacing.page),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Divider(color: colors.border, height: 1),
        ),
      ),
      body: navigationShell,
      bottomNavigationBar: DecoratedBox(
        decoration: BoxDecoration(
          border: Border(top: BorderSide(color: colors.border)),
        ),
        child: NavigationBar(
          selectedIndex: navigationShell.currentIndex,
          onDestinationSelected: (index) => navigationShell.goBranch(
            index,
            initialLocation: index == navigationShell.currentIndex,
          ),
          destinations: [
            NavigationDestination(
              icon: const Icon(Icons.explore_outlined),
              selectedIcon: const Icon(Icons.explore),
              label: l10n.navExplore,
            ),
            NavigationDestination(
              icon: const Icon(Icons.chat_bubble_outline),
              selectedIcon: const Icon(Icons.chat_bubble),
              label: l10n.navChat,
            ),
            NavigationDestination(
              icon: const Icon(Icons.place_outlined),
              selectedIcon: const Icon(Icons.place),
              label: l10n.navTrips,
            ),
            NavigationDestination(
              icon: const Icon(Icons.auto_awesome_outlined),
              selectedIcon: const Icon(Icons.auto_awesome),
              label: l10n.navAiPlanner,
            ),
            NavigationDestination(
              icon: const Icon(Icons.favorite_border),
              selectedIcon: const Icon(Icons.favorite),
              label: l10n.navSaved,
            ),
          ],
        ),
      ),
    );
  }
}

enum _MenuAction { community, profile, logout }

/// Round avatar opening the account menu (web header user menu).
class _UserMenu extends ConsumerWidget {
  const _UserMenu();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final session = ref.watch(sessionControllerProvider);
    final user = session is SessionAuthenticated ? session.user : null;
    final initial = (user?.displayName ?? '?').characters.first.toUpperCase();

    return PopupMenuButton<_MenuAction>(
      key: const Key('user-menu'),
      tooltip: l10n.navProfile,
      offset: const Offset(0, 48),
      onSelected: (action) {
        switch (action) {
          case _MenuAction.community:
            context.push(Routes.community);
          case _MenuAction.profile:
            context.push(Routes.profile);
          case _MenuAction.logout:
            ref.read(sessionControllerProvider.notifier).logout();
        }
      },
      itemBuilder: (_) => [
        PopupMenuItem(
          value: _MenuAction.community,
          child: _MenuRow(Icons.forum_outlined, l10n.navCommunity),
        ),
        PopupMenuItem(
          value: _MenuAction.profile,
          child: _MenuRow(Icons.person_outline, l10n.navProfile),
        ),
        const PopupMenuDivider(),
        PopupMenuItem(
          value: _MenuAction.logout,
          child: _MenuRow(Icons.logout, l10n.commonLogout),
        ),
      ],
      child: CircleAvatar(
        radius: 18,
        backgroundColor: context.colors.secondary,
        foregroundImage: user?.avatarUrl == null
            ? null
            : NetworkImage(user!.avatarUrl!),
        child: Text(
          initial,
          style: Theme.of(
            context,
          ).textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w700),
        ),
      ),
    );
  }
}

class _MenuRow extends StatelessWidget {
  const _MenuRow(this.icon, this.label);

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Icon(icon, size: 20),
      const SizedBox(width: AppSpacing.md),
      Text(label),
    ],
  );
}
