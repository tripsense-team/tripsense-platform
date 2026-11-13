import 'package:flutter/material.dart';

import '../../app/design/app_tokens.dart';
import '../../core/ui/state_views.dart';
import '../../l10n/gen/app_localizations.dart';

/// Placeholder body for features delivered in later phases
/// (see docs/features/mobile-user-app.md). Used inside the bottom tabs.
class ComingSoonPage extends StatelessWidget {
  const ComingSoonPage({super.key, required this.title});

  final String title;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.page,
          AppSpacing.lg,
          AppSpacing.page,
          0,
        ),
        child: Text(
          title,
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
            fontSize: 28,
            letterSpacing: -0.6,
          ),
        ),
      ),
      Expanded(
        child: EmptyView(
          message: AppLocalizations.of(context).comingSoon,
          icon: Icons.construction_outlined,
        ),
      ),
    ],
  );
}

/// Full-screen variant (with a back button) for routes opened from the menu.
class ComingSoonScreen extends StatelessWidget {
  const ComingSoonScreen({super.key, required this.title});

  final String title;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(title)),
    body: EmptyView(
      message: AppLocalizations.of(context).comingSoon,
      icon: Icons.construction_outlined,
    ),
  );
}
