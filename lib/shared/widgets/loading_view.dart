import 'package:flutter/material.dart';

import '../../theme/app_colors.dart';

class LoadingView extends StatelessWidget {
  const LoadingView({super.key, this.message = 'Y\u00fckleniyor...'});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const CircularProgressIndicator(),
          const SizedBox(height: 14),
          Text(
            message,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: AppColors.textSecondary,
                ),
          ),
        ],
      ),
    );
  }
}
