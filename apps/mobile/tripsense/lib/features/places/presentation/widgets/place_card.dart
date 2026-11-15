import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../../../app/design/app_tokens.dart';
import '../../../../l10n/gen/app_localizations.dart';
import '../../domain/opening_hours.dart';
import '../../domain/place.dart';

/// Photo with a gradient + name fallback (most places have no approved photo yet).
class PlaceImage extends StatelessWidget {
  const PlaceImage({super.key, required this.place, this.aspectRatio = 16 / 10});

  final Place place;
  final double aspectRatio;

  @override
  Widget build(BuildContext context) {
    final url = place.coverUrl;
    return AspectRatio(
      aspectRatio: aspectRatio,
      child: url == null
          ? _Fallback(name: place.name)
          : CachedNetworkImage(
              imageUrl: url,
              fit: BoxFit.cover,
              memCacheWidth: 900,
              placeholder: (_, _) => _Fallback(name: place.name),
              errorWidget: (_, _, _) => _Fallback(name: place.name),
            ),
    );
  }
}

class _Fallback extends StatelessWidget {
  const _Fallback({required this.name});

  final String name;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(gradient: AppGradients.hero),
      alignment: Alignment.center,
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Text(
        name,
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
        textAlign: TextAlign.center,
        style: Theme.of(context).textTheme.titleMedium?.copyWith(
          color: Colors.white,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class RatingRow extends StatelessWidget {
  const RatingRow({super.key, required this.place});

  final Place place;

  @override
  Widget build(BuildContext context) {
    if (!place.hasRating) return const SizedBox.shrink();
    final l10n = AppLocalizations.of(context);
    final colors = context.colors;
    final style = Theme.of(context).textTheme.bodyMedium;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.star_rounded, size: 18, color: colors.amber),
        const SizedBox(width: 2),
        Text(
          place.rating!.toStringAsFixed(1),
          style: style?.copyWith(fontWeight: FontWeight.w700),
        ),
        if (place.ratingCount != null) ...[
          const SizedBox(width: 4),
          Text(
            l10n.placeReviewsCount(place.ratingCount!),
            style: style?.copyWith(color: colors.mutedForeground),
          ),
        ],
      ],
    );
  }
}

class PlaceCard extends StatelessWidget {
  const PlaceCard({super.key, required this.place, required this.onTap});

  final Place place;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = context.colors;
    final l10n = AppLocalizations.of(context);
    final today = todayOpeningHours(place.openingHours, DateTime.now());
    final category = place.categoryLabel;

    return Material(
      color: colors.card,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.xxl),
        side: BorderSide(color: colors.border),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Stack(
              children: [
                PlaceImage(place: place),
                if (category != null)
                  Positioned(
                    left: AppSpacing.md,
                    top: AppSpacing.md,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: colors.background.withValues(alpha: 0.9),
                        borderRadius: BorderRadius.circular(AppRadius.pill),
                      ),
                      child: Text(
                        category,
                        style: theme.textTheme.labelMedium?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
            Padding(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    place.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  if (place.hasRating) ...[
                    const SizedBox(height: 4),
                    RatingRow(place: place),
                  ],
                  if (place.address != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      place.address!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: colors.mutedForeground,
                      ),
                    ),
                  ],
                  if (today != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      l10n.placeOpenToday(today),
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: colors.emerald,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
