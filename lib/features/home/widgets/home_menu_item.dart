import 'package:flutter/material.dart';

import '../../../theme/app_colors.dart';
import '../../../theme/app_radius.dart';

class HomeMenuItem extends StatelessWidget {
  const HomeMenuItem({
    super.key,
    required this.label,
    required this.subtitle,
    required this.iconAsset,
    required this.onTap,
    this.icon,
  });

  final String label;
  final String subtitle;
  final String iconAsset;
  final VoidCallback onTap;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.xLarge),
        child: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                AppColors.surface.withValues(alpha: 0.96),
                AppColors.surfaceElevated.withValues(alpha: 0.88),
              ],
            ),
            borderRadius: BorderRadius.circular(AppRadius.xLarge),
            border: Border.all(
              color: AppColors.divider.withValues(alpha: 0.7),
              width: 0.8,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.24),
                blurRadius: 20,
                offset: const Offset(0, 10),
              ),
              BoxShadow(
                color: AppColors.primaryAccent.withValues(alpha: 0.05),
                blurRadius: 18,
                offset: const Offset(0, -4),
              ),
            ],
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 15),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    color: AppColors.surfaceSoft.withValues(alpha: 0.92),
                    borderRadius: BorderRadius.circular(AppRadius.medium),
                    border: Border.all(
                      color: AppColors.primaryAccent.withValues(alpha: 0.24),
                      width: 0.9,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.primaryAccent.withValues(alpha: 0.18),
                        blurRadius: 18,
                        offset: const Offset(0, 6),
                      ),
                    ],
                  ),
                  child: Center(
                    child: SizedBox(
                      width: 56,
                      height: 56,
                      child: icon == null
                          ? Image.asset(
                              iconAsset,
                              fit: BoxFit.contain,
                              errorBuilder: (context, error, stackTrace) {
                                return Container(
                                  decoration: BoxDecoration(
                                    color: Colors.red.withValues(alpha: 0.18),
                                    borderRadius:
                                        BorderRadius.circular(AppRadius.small),
                                    border: Border.all(
                                      color: Colors.redAccent
                                          .withValues(alpha: 0.55),
                                    ),
                                  ),
                                  child: const Icon(
                                    Icons.broken_image_outlined,
                                    color: Colors.redAccent,
                                    size: 22,
                                  ),
                                );
                              },
                            )
                          : Icon(
                              icon,
                              color: AppColors.primaryAccent,
                              size: 34,
                            ),
                    ),
                  ),
                ),
                const Spacer(),
                Text(
                  label,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: AppColors.textPrimary,
                        fontWeight: FontWeight.w700,
                      ),
                ),
                const SizedBox(height: 5),
                Text(
                  subtitle,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.textSecondary,
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
