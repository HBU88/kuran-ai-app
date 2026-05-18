import 'package:flutter/material.dart';

import '../../core/constants/app_constants.dart';
import '../../theme/app_colors.dart';

class AppLogo extends StatelessWidget {
  const AppLogo({super.key, this.compact = false});

  final bool compact;

  @override
  Widget build(BuildContext context) {
    final iconSize = compact ? 34.0 : 44.0;
    final labelStyle = Theme.of(context).textTheme.titleMedium?.copyWith(
          color: AppColors.textPrimary,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.6,
        );

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: iconSize,
          height: iconSize,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                AppColors.surfaceSoft,
                AppColors.surfaceElevated,
              ],
            ),
            shape: BoxShape.circle,
            border: Border.all(
              color: AppColors.primaryAccent.withValues(alpha: 0.22),
              width: 0.8,
            ),
            boxShadow: [
              BoxShadow(
                color: AppColors.primaryAccent.withValues(alpha: 0.12),
                blurRadius: 18,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Padding(
            padding: const EdgeInsets.all(8),
            child: ClipOval(
              child: Image.asset(
                AppConstants.logoAssetPlaceholder,
                fit: BoxFit.contain,
                errorBuilder: (context, error, stackTrace) {
                  return const Icon(
                    Icons.auto_awesome_rounded,
                    color: AppColors.primaryAccent,
                  );
                },
              ),
            ),
          ),
        ),
        const SizedBox(width: 12),
        Text(AppConstants.appName, style: labelStyle),
      ],
    );
  }
}
