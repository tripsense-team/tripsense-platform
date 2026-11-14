import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/design/app_tokens.dart';
import '../../../app/routes.dart';
import '../../../core/errors/app_failure.dart';
import '../../../core/ui/failure_message.dart';
import '../../../core/ui/state_views.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../domain/collections.dart';
import 'collections_controller.dart';
import 'saved_screen.dart';

void _showError(BuildContext context, Object error) {
  final l10n = AppLocalizations.of(context);
  final failure = error is AppFailure
      ? error
      : const AppFailure(type: AppFailureType.unknown);
  ScaffoldMessenger.of(
    context,
  ).showSnackBar(SnackBar(content: Text(failureMessage(l10n, failure))));
}

class CollectionsScreen extends ConsumerWidget {
  const CollectionsScreen({super.key});

  Future<void> _edit(
    BuildContext context,
    WidgetRef ref, [
    PlaceCollection? existing,
  ]) async {
    final name = await showDialog<String>(
      context: context,
      builder: (_) => _NameDialog(
        initial: existing?.name ?? '',
        renaming: existing != null,
      ),
    );
    if (name == null || name.isEmpty || !context.mounted) return;
    final notifier = ref.read(collectionsControllerProvider.notifier);
    try {
      if (existing == null) {
        await notifier.create(name);
      } else {
        await notifier.rename(existing.id, name);
      }
    } on Object catch (e) {
      if (context.mounted) _showError(context, e);
    }
  }

  Future<void> _delete(
    BuildContext context,
    WidgetRef ref,
    PlaceCollection collection,
  ) async {
    final l10n = AppLocalizations.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(l10n.collectionDelete),
        content: Text(l10n.collectionDeleteHint),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(l10n.commonCancel),
          ),
          FilledButton(
            key: const Key('collection-confirm-delete'),
            onPressed: () => Navigator.of(context).pop(true),
            child: Text(l10n.commonDelete),
          ),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;
    try {
      await ref
          .read(collectionsControllerProvider.notifier)
          .delete(collection.id);
    } on Object catch (e) {
      if (context.mounted) _showError(context, e);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final collections = ref.watch(collectionsControllerProvider);
    final notifier = ref.read(collectionsControllerProvider.notifier);

    return Scaffold(
      appBar: AppBar(title: Text(l10n.collectionsTitle)),
      floatingActionButton: FloatingActionButton.extended(
        key: const Key('collection-new'),
        onPressed: () => _edit(context, ref),
        icon: const Icon(Icons.create_new_folder_outlined),
        label: Text(l10n.collectionCreate),
      ),
      body: collections.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(error: e, onRetry: notifier.refresh),
        data: (items) => items.isEmpty
            ? EmptyView(
                icon: Icons.folder_outlined,
                message:
                    '${l10n.collectionsEmptyTitle}\n${l10n.collectionsEmptyHint}',
              )
            : RefreshIndicator(
                onRefresh: notifier.refresh,
                child: ListView.separated(
                  padding: const EdgeInsets.all(AppSpacing.page),
                  itemCount: items.length,
                  separatorBuilder: (_, _) =>
                      const SizedBox(height: AppSpacing.md),
                  itemBuilder: (context, i) {
                    final c = items[i];
                    return Card(
                      margin: EdgeInsets.zero,
                      child: ListTile(
                        key: Key('collection-${c.id}'),
                        leading: const Icon(Icons.folder_outlined),
                        title: Text(
                          c.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        subtitle: Text(
                          l10n.collectionPlacesCount(c.placeCount),
                        ),
                        onTap: () => context.push(
                          Routes.collectionDetail(c.id),
                          extra: c,
                        ),
                        trailing: PopupMenuButton<String>(
                          key: Key('collection-menu-${c.id}'),
                          onSelected: (v) => v == 'edit'
                              ? _edit(context, ref, c)
                              : _delete(context, ref, c),
                          itemBuilder: (_) => [
                            PopupMenuItem(
                              value: 'edit',
                              child: Text(l10n.commonEdit),
                            ),
                            PopupMenuItem(
                              value: 'delete',
                              child: Text(l10n.commonDelete),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),
      ),
    );
  }
}

class CollectionDetailScreen extends StatelessWidget {
  const CollectionDetailScreen({super.key, required this.collection});

  final PlaceCollection collection;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(collection.name)),
    body: SavedPlacesList(collectionId: collection.id),
  );
}

/// Owns its text controller so it is disposed only after the dialog is gone.
class _NameDialog extends StatefulWidget {
  const _NameDialog({required this.initial, required this.renaming});

  final String initial;
  final bool renaming;

  @override
  State<_NameDialog> createState() => _NameDialogState();
}

class _NameDialogState extends State<_NameDialog> {
  late final _controller = TextEditingController(text: widget.initial);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return AlertDialog(
      title: Text(
        widget.renaming ? l10n.collectionRename : l10n.collectionCreate,
      ),
      content: TextField(
        key: const Key('collection-name'),
        controller: _controller,
        autofocus: true,
        maxLength: maxCollectionNameLength,
        decoration: InputDecoration(hintText: l10n.collectionNameHint),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: Text(l10n.commonCancel),
        ),
        FilledButton(
          key: const Key('collection-save'),
          onPressed: () => Navigator.of(context).pop(_controller.text.trim()),
          child: Text(l10n.commonSave),
        ),
      ],
    );
  }
}
