import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/design/app_tokens.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../data/places_repository_impl.dart';
import '../domain/opening_hours.dart';
import '../domain/place.dart';
import 'widgets/place_card.dart';

/// Loads richer details; the list item stays visible as the fallback.
final placeDetailsProvider = FutureProvider.autoDispose.family<Place, Place>((
  ref,
  seed,
) async {
  final near = seed.location;
  try {
    final details = await ref
        .read(placesRepositoryProvider)
        .details(seed.id, name: seed.name, near: near);
    return seed.mergedWith(details);
  } on Object {
    return seed;
  }
});

class PlaceDetailScreen extends ConsumerWidget {
  const PlaceDetailScreen({super.key, required this.place});

  final Place place;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final shown = ref.watch(placeDetailsProvider(place)).value ?? place;
    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            pinned: true,
            expandedHeight: 260,
            leading: Padding(
              padding: const EdgeInsets.all(6),
              child: CircleAvatar(
                backgroundColor: context.colors.background.withValues(
                  alpha: 0.9,
                ),
                child: IconButton(
                  key: const Key('place-back'),
                  tooltip: AppLocalizations.of(context).placeBack,
                  icon: const Icon(Icons.arrow_back),
                  onPressed: () => Navigator.of(context).maybePop(),
                ),
              ),
            ),
            flexibleSpace: FlexibleSpaceBar(
              background: PlaceImage(place: shown, aspectRatio: 1),
            ),
          ),
          SliverToBoxAdapter(child: _Body(place: shown)),
        ],
      ),
    );
  }
}

class _Body extends StatelessWidget {
  const _Body({required this.place});

  final Place place;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = context.colors;
    final l10n = AppLocalizations.of(context);
    final days = parseOpeningHours(place.openingHours);
    final todayLabel = todayOpeningHours(place.openingHours, DateTime.now());

    return Padding(
      padding: const EdgeInsets.all(AppSpacing.page),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            place.name,
            style: theme.textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          RatingRow(place: place),
          if (place.address != null) ...[
            const SizedBox(height: AppSpacing.sm),
            _InfoLine(icon: Icons.place_outlined, text: place.address!),
          ],
          if (place.description != null)
            _Section(
              title: l10n.placeAbout,
              child: Text(place.description!, style: theme.textTheme.bodyLarge),
            ),
          if (days.isNotEmpty)
            _Section(
              title: l10n.placeHours,
              child: Column(
                children: [
                  for (final day in days)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 3),
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              day.day,
                              style: theme.textTheme.bodyMedium?.copyWith(
                                fontWeight: day.hours == todayLabel
                                    ? FontWeight.w700
                                    : null,
                              ),
                            ),
                          ),
                          Text(
                            day.hours,
                            style: theme.textTheme.bodyMedium?.copyWith(
                              color: colors.mutedForeground,
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          if (place.phone != null || place.website != null)
            _Section(
              title: l10n.placeContact,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (place.phone != null)
                    _InfoLine(icon: Icons.phone_outlined, text: place.phone!),
                  if (place.website != null)
                    _InfoLine(icon: Icons.public, text: place.website!),
                ],
              ),
            ),
          if (place.reviews.isNotEmpty)
            _Section(
              title: l10n.placeReviews,
              child: Column(
                children: [
                  for (final review in place.reviews) _ReviewTile(review),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: AppSpacing.xl),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: Theme.of(
            context,
          ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: AppSpacing.md),
        child,
      ],
    ),
  );
}

class _InfoLine extends StatelessWidget {
  const _InfoLine({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 3),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 18, color: context.colors.mutedForeground),
        const SizedBox(width: AppSpacing.sm),
        Expanded(child: Text(text)),
      ],
    ),
  );
}

class _ReviewTile extends StatelessWidget {
  const _ReviewTile(this.review);

  final PlaceReview review;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = context.colors;
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(AppSpacing.lg),
        decoration: BoxDecoration(
          border: Border.all(color: colors.border),
          borderRadius: BorderRadius.circular(AppRadius.xl),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    review.author,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                if (review.rating != null) ...[
                  Icon(Icons.star_rounded, size: 16, color: colors.amber),
                  Text(review.rating!.toStringAsFixed(1)),
                ],
              ],
            ),
            if (review.text != null) ...[
              const SizedBox(height: 4),
              Text(review.text!, style: theme.textTheme.bodyMedium),
            ],
          ],
        ),
      ),
    );
  }
}
