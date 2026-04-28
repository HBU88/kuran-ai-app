import 'package:flutter/material.dart';

import '../../../theme/app_colors.dart';
import '../../../theme/app_radius.dart';

class UserBubble extends StatelessWidget {
  const UserBubble({
    super.key,
    required this.text,
  });

  final String text;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerRight,
      child: TweenAnimationBuilder<double>(
        duration: const Duration(milliseconds: 160),
        tween: Tween(begin: 0, end: 1),
        curve: Curves.easeOutCubic,
        builder: (context, value, child) {
          return Opacity(
            opacity: value,
            child: Transform.translate(
              offset: Offset(16 * (1 - value), 0),
              child: child,
            ),
          );
        },
        child: Container(
          constraints: BoxConstraints(
            maxWidth: MediaQuery.sizeOf(context).width * 0.72,
          ),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
          decoration: BoxDecoration(
            color: AppColors.userBubble,
            borderRadius: BorderRadius.circular(AppRadius.large),
            border: Border.all(
              color: AppColors.divider.withValues(alpha: 0.65),
            ),
          ),
          child: Text(
            text,
            style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  color: AppColors.textPrimary,
                  fontWeight: FontWeight.w400,
                ),
          ),
        ),
      ),
    );
  }
}
