import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/utils/situation_tag_mapper.dart';
import '../../features/favorites/favorites_controller.dart';
import '../../shared/widgets/app_card.dart';
import '../../shared/widgets/ayah_card.dart';
import '../../shared/widgets/loading_view.dart';
import 'situation_ayah_controller.dart';

class SituationAyahScreen extends StatefulWidget {
  const SituationAyahScreen({super.key});

  @override
  State<SituationAyahScreen> createState() => _SituationAyahScreenState();
}

class _SituationAyahScreenState extends State<SituationAyahScreen> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Duruma göre ayet')),
      body: Consumer<SituationAyahController>(
        builder: (context, controller, _) {
          return ListView(
            padding: const EdgeInsets.fromLTRB(18, 8, 18, 28),
            children: [
              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Bugün nasılsın?',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _controller,
                      keyboardType: TextInputType.multiline,
                      textInputAction: TextInputAction.newline,
                      enableSuggestions: true,
                      autocorrect: true,
                      minLines: 2,
                      maxLines: 4,
                      decoration: const InputDecoration(
                        hintText:
                            'Kaygılıyım, zorlanıyorum, tövbe etmek istiyorum...',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        for (final prompt in SituationTagMapper.samplePrompts)
                          ActionChip(
                            label: Text(prompt),
                            onPressed: () {
                              _controller.text = prompt;
                              controller.search(prompt);
                            },
                          ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    FilledButton.icon(
                      onPressed: () => controller.search(_controller.text),
                      icon: const Icon(Icons.search_rounded),
                      label: const Text('Ayet öner'),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              if (controller.loading)
                const SizedBox(
                  height: 220,
                  child: LoadingView(message: 'Uygun ayet aranıyor...'),
                )
              else if (controller.ayah != null)
                _SituationResult(controller: controller)
              else
                Text(
                  'Bir durum yaz veya örneklerden birini seç. Sonuçta tema, ayet, meal, kısa açıklama ve dua görünecek.',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
            ],
          );
        },
      ),
    );
  }
}

class _SituationResult extends StatelessWidget {
  const _SituationResult({required this.controller});

  final SituationAyahController controller;

  @override
  Widget build(BuildContext context) {
    final ayah = controller.ayah!;
    final support = controller.support!;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Chip(label: Text('Tema: ${controller.selectedTag ?? ayah.tags.first}')),
        AyahCard(
          ayah: ayah,
          trailing: Consumer<FavoritesController>(
            builder: (context, favorites, _) {
              final favorite = favorites.isFavorite(ayah.id);
              return IconButton(
                onPressed: () => favorites.toggle(ayah),
                icon: Icon(
                  favorite
                      ? Icons.favorite_rounded
                      : Icons.favorite_border_rounded,
                ),
                tooltip: 'Favori',
              );
            },
          ),
        ),
        const SizedBox(height: 14),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Kısa açıklama',
                style: Theme.of(
                  context,
                ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 8),
              Text(support.explanation),
              const SizedBox(height: 16),
              Text(
                'Kısa dua',
                style: Theme.of(
                  context,
                ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 8),
              Text(support.dua),
              const SizedBox(height: 16),
              Text(
                'Bugün için küçük adım',
                style: Theme.of(
                  context,
                ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 8),
              Text(support.actionSuggestion),
            ],
          ),
        ),
      ],
    );
  }
}
