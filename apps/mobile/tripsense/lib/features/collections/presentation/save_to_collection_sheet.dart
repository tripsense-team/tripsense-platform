import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/design/app_tokens.dart';
import '../../../core/errors/app_failure.dart';
import '../../../core/ui/failure_message.dart';
import '../../../core/ui/state_views.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../../places/domain/place.dart';
import '../domain/collections.dart';
import 'collections_controller.dart';

Future<void> showSaveToCollectionSheet(BuildContext context, Place place) =>
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => SaveToCollectionSheet(place: place),
    );

String _message(AppLocalizations l10n, Object error) => failureMessage(
  l10n,
  error is AppFailure ? error : const AppFailure(type: AppFailureType.unknown),
);

class SaveToCollectionSheet extends ConsumerStatefulWidget {
  const SaveToCollectionSheet({super.key, required this.place});

  final Place place;

  @override
  ConsumerState<SaveToCollectionSheet> createState() => _SheetState();
}

class _SheetState extends ConsumerState<SaveToCollectionSheet> {
  final _name = TextEditingController();
  late final Set<String> _selected;
  bool _saving = false;
  bool _creating = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _selected = {...?ref.read(savedStatusProvider)[widget.place.id]};
    // Make sure the real status is known (e.g. opened before the batch ran).
    ref.read(savedStatusProvider.notifier).request([widget.place.id]);
  }

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _create() async {
    final name = _name.text.trim();
    if (name.isEmpty || _creating) return;
    setState(() {
      _creating = true;
      _error = null;
    });
    final l10n = AppLocalizations.of(context);
    try {
      final created = await ref
          .read(collectionsControllerProvider.notifier)
          .create(name);
      if (!mounted) return;
      setState(() {
        _selected.add(created.id);
        _name.clear();
      });
    } on Object catch (e) {
      if (mounted) setState(() => _error = _message(l10n, e));
    } finally {
      if (mounted) setState(() => _creating = false);
    }
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    final l10n = AppLocalizations.of(context);
    final navigator = Navigator.of(context);
    try {
      await ref
          .read(savedStatusProvider.notifier)
          .update(widget.place.id, _selected);
      if (mounted) navigator.pop();
    } on Object catch (e) {
      if (mounted) {
        setState(() {
          _saving = false;
          _error = _message(l10n, e);
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final collections = ref.watch(collectionsControllerProvider);

    return Padding(
      padding: EdgeInsets.only(
        left: AppSpacing.page,
        right: AppSpacing.page,
        bottom: MediaQuery.viewInsetsOf(context).bottom + AppSpacing.lg,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            l10n.saveToCollection,
            style: theme.textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            widget.place.name,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: context.colors.mutedForeground,
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          Row(
            children: [
              Expanded(
                child: TextField(
                  key: const Key('new-collection-name'),
                  controller: _name,
                  maxLength: maxCollectionNameLength,
                  buildCounter:
                      (
                        _, {
                        required currentLength,
                        required isFocused,
                        maxLength,
                      }) => null,
                  textInputAction: TextInputAction.done,
                  onSubmitted: (_) => _create(),
                  onChanged: (_) => setState(() {}),
                  decoration: InputDecoration(
                    hintText: l10n.collectionNameHint,
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              OutlinedButton(
                key: const Key('create-collection'),
                style: OutlinedButton.styleFrom(minimumSize: const Size(0, 48)),
                onPressed: _name.text.trim().isEmpty || _creating
                    ? null
                    : _create,
                child: Text(l10n.commonCreate),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Flexible(
            child: collections.when(
              loading: () => const Padding(
                padding: EdgeInsets.all(AppSpacing.xl),
                child: LoadingView(),
              ),
              error: (e, _) => ErrorView(
                error: e,
                onRetry: ref
                    .read(collectionsControllerProvider.notifier)
                    .refresh,
              ),
              data: (items) => items.isEmpty
                  ? Padding(
                      padding: const EdgeInsets.all(AppSpacing.lg),
                      child: Text(
                        l10n.collectionsEmptyHint,
                        textAlign: TextAlign.center,
                      ),
                    )
                  : ListView(
                      shrinkWrap: true,
                      children: [
                        for (final c in items)
                          CheckboxListTile(
                            key: Key('pick-${c.id}'),
                            value: _selected.contains(c.id),
                            title: Text(c.name),
                            secondary: Text('${c.placeCount}'),
                            controlAffinity: ListTileControlAffinity.leading,
                            onChanged: (on) => setState(() {
                              if (on ?? false) {
                                _selected.add(c.id);
                              } else {
                                _selected.remove(c.id);
                              }
                            }),
                          ),
                      ],
                    ),
            ),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(top: AppSpacing.sm),
              child: Text(
                _error!,
                key: const Key('save-error'),
                style: TextStyle(color: context.colors.destructive),
              ),
            ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: _saving ? null : () => Navigator.of(context).pop(),
                  child: Text(l10n.commonCancel),
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: FilledButton(
                  key: const Key('save-memberships'),
                  onPressed: _saving ? null : _save,
                  child: Text(l10n.commonSave),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
