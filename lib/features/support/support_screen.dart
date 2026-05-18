import 'package:flutter/material.dart';

import '../../shared/widgets/app_card.dart';
import '../../shared/widgets/app_gradient_background.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_spacing.dart';

class SupportScreen extends StatelessWidget {
  const SupportScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('HAKAI’yi Destekle')),
      body: AppGradientBackground(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(18, 10, 18, 28),
          children: [
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(
                    Icons.volunteer_activism_outlined,
                    color: AppColors.primaryAccent,
                    size: 30,
                  ),
                  const SizedBox(height: 14),
                  Text(
                    'Projeye destek yakında',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'HAKAI, Kur’an merkezli manevi rehberlik sunan günlük bir yol arkadaşıdır. Bu deneyimi güvenli Dinî Bilgiler akışıyla geliştirmeye devam ediyoruz.',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  const SizedBox(height: AppSpacing.medium),
                  Text(
                    'İleride kullanıcılar projeyi tek seferlik katkıyla destekleyebilecek. Bu ekranda şu an ödeme ya da abonelik işlemi yoktur.',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.large),
            const AppCard(
              child: _FutureRoadmap(),
            ),
          ],
        ),
      ),
    );
  }
}

class _FutureRoadmap extends StatelessWidget {
  const _FutureRoadmap();

  @override
  Widget build(BuildContext context) {
    // TODO: Add contextual affiliate recommendations only when they are
    // clearly separated from spiritual guidance and never based on sensitive
    // religious profiling inferred from chat content.
    // TODO: Add "Bu konuda önerilen kaynaklar" cards with transparent labels
    // and editorial review before any sponsored or affiliate placement.
    // TODO: Add shareable ayah cards generated from explicit user actions.
    // TODO: Add a trend-to-ayah social growth engine with manual approval
    // before publishing any trend mapping or social content.
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Gelecek fikirler',
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const SizedBox(height: 10),
        const _RoadmapItem('Önerilen kaynaklar kartları'),
        const _RoadmapItem('Paylaşılabilir ayet kartları'),
        const _RoadmapItem('Editör onaylı sosyal içerik akışları'),
      ],
    );
  }
}

class _RoadmapItem extends StatelessWidget {
  const _RoadmapItem(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(
            Icons.circle,
            size: 7,
            color: AppColors.primaryAccent,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              text,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ),
        ],
      ),
    );
  }
}
