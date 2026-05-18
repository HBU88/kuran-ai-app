import 'package:flutter/material.dart';

import '../../../theme/app_colors.dart';
import '../../../theme/app_radius.dart';

class AssistantMessage extends StatelessWidget {
  const AssistantMessage({
    super.key,
    required this.text,
  });

  final String text;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: TweenAnimationBuilder<double>(
        duration: const Duration(milliseconds: 180),
        tween: Tween(begin: 0, end: 1),
        curve: Curves.easeOutCubic,
        builder: (context, value, child) {
          return Opacity(
            opacity: value,
            child: Transform.translate(
              offset: Offset(0, 12 * (1 - value)),
              child: child,
            ),
          );
        },
        child: Container(
          constraints: BoxConstraints(
            maxWidth: MediaQuery.sizeOf(context).width * 0.9,
          ),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                AppColors.surfaceSoft.withValues(alpha: 0.94),
                AppColors.surface.withValues(alpha: 0.88),
              ],
            ),
            borderRadius: BorderRadius.circular(AppRadius.xLarge),
            border: Border.all(
              color: AppColors.divider.withValues(alpha: 0.8),
              width: 0.8,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.22),
                blurRadius: 18,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          padding: const EdgeInsets.fromLTRB(16, 15, 16, 15),
          child: Text(
            text,
            style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  fontSize: 15.5,
                  height: 1.78,
                  color: AppColors.textPrimary,
                  fontWeight: FontWeight.w400,
                ),
          ),
        ),
      ),
    );
  }
}
