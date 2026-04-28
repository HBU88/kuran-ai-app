import 'package:flutter/material.dart';

import '../../shared/widgets/app_gradient_background.dart';
import '../../shared/widgets/app_card.dart';

class QiblaScreen extends StatelessWidget {
  const QiblaScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Kıble')),
      body: AppGradientBackground(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(18, 8, 18, 28),
          children: [
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.explore_outlined),
                  const SizedBox(height: 12),
                  Text(
                    'Kıble yönü',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Bu modül, konum bazlı kıble yönü desteği için ayrılmıştır.',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          height: 1.6,
                        ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
