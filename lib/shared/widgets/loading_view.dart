import 'package:flutter/material.dart';

import '../../theme/app_colors.dart';
import 'app_card.dart';

class LoadingView extends StatelessWidget {
  const LoadingView({super.key, this.message = 'Yükleniyor...'});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: AppCard(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(
              width: 26,
              height: 26,
              child: CircularProgressIndicator(strokeWidth: 2.4),
            ),
            const SizedBox(height: 16),
            Text(
              message,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: AppColors.textSecondary,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}
