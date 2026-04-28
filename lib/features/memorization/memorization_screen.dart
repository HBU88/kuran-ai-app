import 'package:flutter/material.dart';
import 'package:intl/intl.dart' show DateFormat;
import 'package:provider/provider.dart';

import '../../shared/widgets/app_card.dart';
import '../../shared/widgets/loading_view.dart';
import 'memorization_controller.dart';

class MemorizationScreen extends StatelessWidget {
  const MemorizationScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Ezber modülü')),
      body: Consumer<MemorizationController>(
        builder: (context, controller, _) {
          if (controller.loading) {
            return const LoadingView(message: 'Kısa sureler hazırlanıyor...');
          }

          final selected = controller.selectedSurah;
          if (selected == null) {
            return const Center(child: Text('Sure listesi yüklenemedi.'));
          }

          final progress = controller.progressFor(selected);
          final percent = progress.progressFor(selected.ayahs.length);

          return ListView(
            padding: const EdgeInsets.fromLTRB(18, 8, 18, 28),
            children: [
              SizedBox(
                height: 54,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: controller.surahs.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 8),
                  itemBuilder: (context, index) {
                    final surah = controller.surahs[index];
                    final selectedSurah = surah.id == selected.id;
                    return ChoiceChip(
                      label: Text(surah.nameTr),
                      selected: selectedSurah,
                      onSelected: (_) => controller.selectSurah(surah),
                    );
                  },
                ),
              ),
              const SizedBox(height: 14),
              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            '${selected.nameTr} Suresi',
                            style: Theme.of(context)
                                .textTheme
                                .titleLarge
                                ?.copyWith(fontWeight: FontWeight.w800),
                          ),
                        ),
                        Text(selected.nameAr),
                      ],
                    ),
                    const SizedBox(height: 14),
                    LinearProgressIndicator(value: percent),
                    const SizedBox(height: 8),
                    Text(
                      '%${(percent * 100).round()} tamamlandı · '
                      '${progress.repetitionCount} tekrar',
                    ),
                    if (progress.lastReviewedAt != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        'Son tekrar: ${DateFormat('dd.MM.yyyy HH:mm').format(progress.lastReviewedAt!)}',
                      ),
                    ],
                    const SizedBox(height: 14),
                    FilledButton.icon(
                      onPressed: controller.markReviewed,
                      icon: const Icon(Icons.done_all_rounded),
                      label: const Text('Bugün tekrar ettim'),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              for (final ayah in selected.ayahs)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: AppCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${selected.nameTr} ${ayah.number}',
                          style:
                              Theme.of(context).textTheme.titleMedium?.copyWith(
                                    fontWeight: FontWeight.w800,
                                  ),
                        ),
                        const SizedBox(height: 12),
                        Align(
                          alignment: Alignment.centerRight,
                          child: Directionality(
                            textDirection: TextDirection.rtl,
                            child: Text(
                              ayah.textAr,
                              textAlign: TextAlign.right,
                              style: Theme.of(context)
                                  .textTheme
                                  .headlineSmall
                                  ?.copyWith(height: 1.8),
                            ),
                          ),
                        ),
                        const SizedBox(height: 10),
                        Text(ayah.textTr),
                      ],
                    ),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}
