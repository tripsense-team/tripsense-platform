import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/design/app_tokens.dart';
import '../../../../l10n/gen/app_localizations.dart';
import '../../../places/domain/place.dart';
import '../collections_controller.dart';
import '../save_to_collection_sheet.dart';

/// Heart on a place card: filled when the place is in any collection.
class SaveButton extends ConsumerWidget {
  const SaveButton({super.key, required this.place});

  final Place place;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final colors = context.colors;
    // Cheap no-op once the status is known; batches with the other cards.
    ref.read(savedStatusProvider.notifier).request([place.id]);
    final saved = ref.watch(
      savedStatusProvider.select((m) => m[place.id]?.isNotEmpty ?? false),
    );

    return Material(
      color: colors.background.withValues(alpha: 0.9),
      shape: const CircleBorder(),
      child: IconButton(
        key: Key('save-${place.id}'),
        tooltip: saved ? l10n.saveButtonSaved : l10n.saveButtonSave,
        icon: Icon(
          saved ? Icons.favorite : Icons.favorite_border,
          color: saved ? colors.rose : colors.foreground,
        ),
        onPressed: () => showSaveToCollectionSheet(context, place),
      ),
    );
  }
}
