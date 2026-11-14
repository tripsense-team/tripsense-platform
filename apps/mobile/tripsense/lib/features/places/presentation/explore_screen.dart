import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/design/app_tokens.dart';
import '../../../app/routes.dart';
import '../../../core/ui/state_views.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../../collections/presentation/widgets/save_button.dart';
import '../domain/destinations.dart';
import '../domain/place.dart';
import 'explore_controller.dart';
import 'widgets/place_card.dart';

String _tabLabel(AppLocalizations l10n, ExploreTab tab) => switch (tab) {
  ExploreTab.forYou => l10n.exploreTabForYou,
  ExploreTab.food => l10n.exploreTabFood,
  ExploreTab.cafes => l10n.exploreTabCafes,
  ExploreTab.stays => l10n.exploreTabStays,
  ExploreTab.attractions => l10n.exploreTabAttractions,
};

class ExploreScreen extends ConsumerStatefulWidget {
  const ExploreScreen({super.key});

  @override
  ConsumerState<ExploreScreen> createState() => _ExploreScreenState();
}

class _ExploreScreenState extends ConsumerState<ExploreScreen> {
  final _controller = TextEditingController();
  final _focus = FocusNode();

  @override
  void dispose() {
    _controller.dispose();
    _focus.dispose();
    super.dispose();
  }

  void _submit(String text) {
    _focus.unfocus();
    ref.read(autocompleteControllerProvider.notifier).clear();
    ref.read(exploreControllerProvider.notifier).search(text);
  }

  void _clear() {
    _controller.clear();
    ref.read(autocompleteControllerProvider.notifier).clear();
    ref.read(exploreControllerProvider.notifier).clearSearch();
  }

  Future<void> _pickDestination() async {
    final l10n = AppLocalizations.of(context);
    final controller = ref.read(exploreControllerProvider.notifier);
    final current = ref.read(exploreControllerProvider).destination;
    final picked = await showModalBottomSheet<DestinationPreset>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: Text(
                l10n.exploreChooseDestination,
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ),
            for (final d in destinationPresets)
              ListTile(
                key: Key('destination-${d.id}'),
                title: Text(d.name),
                trailing: d.id == current.id ? const Icon(Icons.check) : null,
                onTap: () => Navigator.of(context).pop(d),
              ),
          ],
        ),
      ),
    );
    if (picked != null) controller.selectDestination(picked);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final state = ref.watch(exploreControllerProvider);
    final suggestions = ref.watch(autocompleteControllerProvider).value ?? [];
    final showSuggestions = _focus.hasFocus && suggestions.isNotEmpty;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.page,
            AppSpacing.sm,
            AppSpacing.page,
            AppSpacing.sm,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ActionChip(
                key: const Key('destination-pill'),
                avatar: const Icon(Icons.place_outlined, size: 18),
                label: Text(state.destination.name),
                onPressed: _pickDestination,
              ),
              const SizedBox(height: AppSpacing.md),
              TextField(
                key: const Key('explore-search'),
                controller: _controller,
                focusNode: _focus,
                textInputAction: TextInputAction.search,
                onChanged: (value) {
                  setState(() {});
                  ref
                      .read(autocompleteControllerProvider.notifier)
                      .onQueryChanged(value, state.destination);
                },
                onSubmitted: _submit,
                decoration: InputDecoration(
                  hintText: l10n.exploreSearchHint,
                  prefixIcon: const Icon(Icons.search),
                  suffixIcon: _controller.text.isEmpty
                      ? null
                      : IconButton(
                          key: const Key('explore-clear'),
                          tooltip: l10n.exploreClearSearch,
                          icon: const Icon(Icons.close),
                          onPressed: _clear,
                        ),
                ),
              ),
            ],
          ),
        ),
        SizedBox(
          height: 44,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.page),
            itemCount: ExploreTab.values.length,
            separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.sm),
            itemBuilder: (context, i) {
              final tab = ExploreTab.values[i];
              final selected = tab == state.tab;
              return ChoiceChip(
                key: Key('tab-${tab.name}'),
                label: Text(_tabLabel(l10n, tab)),
                showCheckmark: false,
                labelStyle: TextStyle(
                  fontWeight: FontWeight.w600,
                  color: selected
                      ? context.colors.primaryForeground
                      : context.colors.foreground,
                ),
                selected: selected,
                onSelected: (_) {
                  _controller.clear();
                  ref.read(exploreControllerProvider.notifier).selectTab(tab);
                },
              );
            },
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        Expanded(
          child: showSuggestions
              ? _Suggestions(
                  suggestions: suggestions,
                  onPick: (s) {
                    _controller.text = s.title;
                    _submit(s.title);
                  },
                )
              : _Results(state: state),
        ),
      ],
    );
  }
}

class _Suggestions extends StatelessWidget {
  const _Suggestions({required this.suggestions, required this.onPick});

  final List<PlaceSuggestion> suggestions;
  final ValueChanged<PlaceSuggestion> onPick;

  @override
  Widget build(BuildContext context) => ListView(
    children: [
      for (final s in suggestions)
        ListTile(
          leading: const Icon(Icons.search),
          title: Text(s.title, maxLines: 1, overflow: TextOverflow.ellipsis),
          subtitle: s.subtitle == null
              ? null
              : Text(s.subtitle!, maxLines: 1, overflow: TextOverflow.ellipsis),
          onTap: () => onPick(s),
        ),
    ],
  );
}

class _Results extends ConsumerWidget {
  const _Results({required this.state});

  final ExploreState state;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final controller = ref.read(exploreControllerProvider.notifier);

    return state.places.when(
      loading: () => const _Skeleton(),
      error: (error, _) => ErrorView(error: error, onRetry: controller.refresh),
      data: (places) {
        if (places.isEmpty) {
          return EmptyView(
            icon: Icons.search_off,
            message: '${l10n.exploreEmptyTitle}\n${l10n.exploreEmptyHint}',
          );
        }
        final header = state.isSearching
            ? l10n.exploreSearchResults(state.query)
            : (state.usedFallback ? l10n.exploreFallbackNote : null);
        return RefreshIndicator(
          onRefresh: controller.refresh,
          child: ListView.separated(
            key: const Key('explore-list'),
            padding: const EdgeInsets.all(AppSpacing.page),
            itemCount: places.length + (header == null ? 0 : 1),
            separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.lg),
            itemBuilder: (context, i) {
              if (header != null && i == 0) {
                return Text(
                  header,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: context.colors.mutedForeground,
                  ),
                );
              }
              final place = places[i - (header == null ? 0 : 1)];
              return PlaceCard(
                place: place,
                trailing: SaveButton(place: place),
                onTap: () => context.push(Routes.place(place.id), extra: place),
              );
            },
          ),
        );
      },
    );
  }
}

class _Skeleton extends StatelessWidget {
  const _Skeleton();

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return ListView.separated(
      key: const Key('explore-skeleton'),
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.all(AppSpacing.page),
      itemCount: 3,
      separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.lg),
      itemBuilder: (_, _) => Container(
        height: 240,
        decoration: BoxDecoration(
          color: colors.muted,
          borderRadius: BorderRadius.circular(AppRadius.xxl),
        ),
      ),
    );
  }
}
