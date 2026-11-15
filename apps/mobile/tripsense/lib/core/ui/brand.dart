import 'package:flutter/material.dart';

import '../../app/design/app_tokens.dart';
import '../../l10n/gen/app_localizations.dart';

/// Black round logo mark (compass), as in the web header.
class BrandMark extends StatelessWidget {
  const BrandMark({
    super.key,
    this.size = 40,
    this.icon = Icons.explore_outlined,
    this.round = false,
  });

  final double size;
  final IconData icon;

  /// Circle (onboarding badge) instead of the rounded-square logo tile.
  final bool round;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        // Same near-black as the web logo tile, in both themes.
        color: colors.foreground,
        shape: round ? BoxShape.circle : BoxShape.rectangle,
        borderRadius: round ? null : BorderRadius.circular(size * 0.32),
        boxShadow: AppShadows.card,
      ),
      child: Icon(icon, size: size * 0.58, color: colors.background),
    );
  }
}

/// Logo mark + "TripSense" wordmark.
class BrandHeader extends StatelessWidget {
  const BrandHeader({super.key, this.size = 36});

  final double size;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        BrandMark(size: size),
        const SizedBox(width: AppSpacing.md),
        Text(
          AppLocalizations.of(context).appName,
          style: theme.textTheme.titleLarge?.copyWith(
            fontWeight: FontWeight.w700,
            fontSize: 22,
            letterSpacing: -0.4,
          ),
        ),
      ],
    );
  }
}

/// Amber/orange hero banner with a badge, headline and subtitle
/// (web landing hero), used on the sign-in and sign-up screens.
class BrandHero extends StatelessWidget {
  const BrandHero({
    super.key,
    required this.badge,
    required this.title,
    required this.subtitle,
  });

  final String badge;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    const onHero = Colors.white;

    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadius.hero),
      child: DecoratedBox(
        decoration: const BoxDecoration(gradient: AppGradients.hero),
        child: DecoratedBox(
          decoration: const BoxDecoration(gradient: AppGradients.heroOverlay),
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.xl),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: onHero.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(AppRadius.pill),
                    border: Border.all(color: onHero.withValues(alpha: 0.35)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.auto_awesome, size: 16, color: onHero),
                      const SizedBox(width: 8),
                      Flexible(
                        child: Text(
                          badge,
                          style: theme.textTheme.labelMedium?.copyWith(
                            color: onHero,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.lg),
                Text(
                  title,
                  style: theme.textTheme.headlineMedium?.copyWith(
                    color: onHero,
                    fontSize: 34,
                    height: 1.1,
                    letterSpacing: -1,
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                Text(
                  subtitle,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: onHero.withValues(alpha: 0.92),
                    height: 1.45,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Red-tinted rounded message box (web auth error style).
class InlineAlert extends StatelessWidget {
  const InlineAlert(this.message, {super.key});

  final String message;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.destructive.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(AppRadius.xl),
        border: Border.all(color: colors.destructive.withValues(alpha: 0.25)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.error_outline, size: 18, color: colors.destructive),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              message,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: colors.destructive,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
