import 'package:flutter/material.dart';

import '../../core/ui/state_views.dart';
import '../../l10n/gen/app_localizations.dart';

/// Placeholder for tabs delivered in later phases (see docs/features/mobile-user-app.md).
class ComingSoonPage extends StatelessWidget {
  const ComingSoonPage({super.key, required this.title});

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
