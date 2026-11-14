import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/design/app_tokens.dart';
import '../../../app/routes.dart';
import '../../../core/ui/state_views.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../../places/presentation/widgets/place_card.dart';
import 'collections_controller.dart';
import 'widgets/save_button.dart';

/// Saved places list (optionally for one collection), with pull to refresh
/// and infinite scroll.
class SavedPlacesList extends ConsumerWidget {
  const SavedPlacesList({super.key, this.collectionId, this.header});

  final String? collectionId;
  final Widget? header;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final provider = savedPlacesProvider(collectionId);
    final saved = ref.watch(provider);
    final notifier = ref.read(provider.notifier);

    return saved.when(
      loading: () => const LoadingView(),
      error: (e, _) => ErrorView(error: e, onRetry: notifier.refresh),
      data: (list) {
        if (list.items.isEmpty) {
          return RefreshIndicator(
            onRefresh: notifier.refresh,
            child: ListView(
              children: [
                if (header != null)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(
                      AppSpacing.page,
                      AppSpacing.page,
                      AppSpacing.page,
                      0,
                    ),
                    child: header,
                  ),
                const SizedBox(height: AppSpacing.xxl),
                EmptyView(
                  icon: Icons.bookmark_border,
                  message: '${l10n.savedEmptyTitle}\n${l10n.savedEmptyHint}',
                ),
              ],
            ),
          );
        }
        return RefreshIndicator(
          onRefresh: notifier.refresh,
          child: NotificationListener<ScrollNotification>(
            onNotification: (n) {
              if (n.metrics.extentAfter < 600) notifier.loadMore();
              return false;
            },
            child: ListView.separated(
              key: const Key('saved-list'),
              padding: const EdgeInsets.all(AppSpacing.page),
              itemCount: list.items.length + (header == null ? 0 : 1),
              separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.lg),
              itemBuilder: (context, i) {
                if (header != null && i == 0) return header!;
                final item = list.items[i - (header == null ? 0 : 1)];
                return PlaceCard(
                  place: item.place,
                  trailing: SaveButton(place: item.place),
                  onTap: () => context.push(
                    Routes.place(item.place.id),
                    extra: item.place,
                  ),
                );
              },
            ),
          ),
        );
      },
    );
  }
}

/// "Saved" bottom tab: collection filter chips + saved places.
class SavedScreen extends ConsumerStatefulWidget {
  const SavedScreen({super.key});

  @override
  ConsumerState<SavedScreen> createState() => _SavedScreenState();
}

class _SavedScreenState extends ConsumerState<SavedScreen> {
  String? _collectionId;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final collections = ref.watch(collectionsControllerProvider).value ?? [];

    final header = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                l10n.savedTitle,
                style: theme.textTheme.headlineSmall?.copyWith(
                  fontSize: 28,
                  letterSpacing: -0.6,
                ),
              ),
            ),
            IconButton(
              key: const Key('manage-collections'),
              tooltip: l10n.savedManageCollections,
              icon: const Icon(Icons.folder_outlined),
              onPressed: () => context.push(Routes.collections),
            ),
          ],
        ),
        Text(
          l10n.savedDescription,
          style: theme.textTheme.bodyMedium?.copyWith(
            color: context.colors.mutedForeground,
          ),
        ),
        if (collections.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.md),
          SizedBox(
            height: 44,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                _chip(l10n.savedAll, null),
                for (final c in collections)
                  _chip('${c.name} (${c.placeCount})', c.id),
              ],
            ),
          ),
        ],
      ],
    );

    return SavedPlacesList(
      key: ValueKey(_collectionId),
      collectionId: _collectionId,
      header: header,
    );
  }

  Widget _chip(String label, String? id) {
    final selected = _collectionId == id;
    final colors = context.colors;
    return Padding(
      padding: const EdgeInsets.only(right: AppSpacing.sm),
      child: ChoiceChip(
        key: Key('saved-chip-${id ?? 'all'}'),
        label: Text(label),
        showCheckmark: false,
        labelStyle: TextStyle(
          fontWeight: FontWeight.w600,
          color: selected ? colors.primaryForeground : colors.foreground,
        ),
        selected: selected,
        onSelected: (_) => setState(() => _collectionId = id),
      ),
    );
  }
}
