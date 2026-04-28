import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../data/models/ayah_model.dart';
import '../../features/favorites/favorites_controller.dart';
import '../../theme/app_colors.dart';
import 'ayah_detail_sheet.dart';

class AyahCard extends StatelessWidget {
  const AyahCard({
    super.key,
    required this.ayah,
    this.showActions = true,
    this.trailing,
  });

  final AyahModel ayah;
  final bool showActions;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return AyahCardSurface(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  ayah.reference,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        color: AppColors.secondaryAccent,
                      ),
                ),
              ),
              if (trailing != null) trailing!,
            ],
          ),
          const SizedBox(height: 16),
          Align(
            alignment: Alignment.centerRight,
            child: Directionality(
              textDirection: TextDirection.rtl,
              child: Text(
                ayah.textAr,
                textAlign: TextAlign.right,
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontSize: 22,
                      height: 1.9,
                      color: AppColors.textPrimary,
                      fontWeight: FontWeight.w500,
                    ),
              ),
            ),
          ),
          const SizedBox(height: 18),
          Text(
            ayah.textTr,
            style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  fontSize: 19,
                  height: 1.82,
                  color: AppColors.textPrimary,
                  fontWeight: FontWeight.w500,
                ),
          ),
          if (ayah.shortExplanation.trim().isNotEmpty) ...[
            const SizedBox(height: 16),
            Text(
              ayah.shortExplanation,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: AppColors.textSecondary,
                    height: 1.75,
                  ),
            ),
          ],
          if (showActions) ...[
            const SizedBox(height: 20),
            Row(
              children: [
                Consumer<FavoritesController>(
                  builder: (context, favorites, _) {
                    final isFavorite = favorites.isFavorite(ayah.id);
                    return _AyahActionIcon(
                      icon: isFavorite
                          ? Icons.favorite_rounded
                          : Icons.favorite_border_rounded,
                      active: isFavorite,
                      tooltip:
                          isFavorite ? 'Favoriden \u00e7\u0131kar' : 'Favori',
                      onPressed: () => favorites.toggle(ayah),
                    );
                  },
                ),
                const SizedBox(width: 10),
                _AyahActionIcon(
                  icon: Icons.ios_share_rounded,
                  tooltip: 'Payla\u015f',
                  onPressed: () {
                    Share.share(
                      '${ayah.reference}\n\n${ayah.textTr}\n\n${ayah.textAr}',
                    );
                  },
                ),
                const Spacer(),
                TextButton(
                  onPressed: () => showAyahDetailSheet(context, ayah),
                  child: const Text('Detay'),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class AyahCardSurface extends StatelessWidget {
  const AyahCardSurface({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(24),
    this.margin = const EdgeInsets.symmetric(vertical: 12),
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry margin;

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      duration: const Duration(milliseconds: 180),
      curve: Curves.easeOutCubic,
      tween: Tween(begin: 0.98, end: 1),
      builder: (context, value, child) {
        return Opacity(
          opacity: ((value - 0.98) / 0.02).clamp(0, 1),
          child: Transform.scale(scale: value, child: child),
        );
      },
      child: Container(
        margin: margin,
        padding: padding,
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(
            color: AppColors.divider.withValues(alpha: 0.56),
            width: 0.7,
          ),
        ),
        child: child,
      ),
    );
  }
}

class _AyahActionIcon extends StatelessWidget {
  const _AyahActionIcon({
    required this.icon,
    required this.tooltip,
    required this.onPressed,
    this.active = false,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback onPressed;
  final bool active;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: SizedBox.square(
        dimension: 32,
        child: IconButton(
          onPressed: onPressed,
          padding: EdgeInsets.zero,
          style: IconButton.styleFrom(
            backgroundColor: AppColors.surfaceSoft,
            side: BorderSide(
              color: AppColors.divider.withValues(alpha: 0.7),
            ),
          ),
          icon: Icon(
            icon,
            size: 17,
            color: active ? AppColors.primaryAccent : AppColors.textSecondary,
          ),
        ),
      ),
    );
  }
}
