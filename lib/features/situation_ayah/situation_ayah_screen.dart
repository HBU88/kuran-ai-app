import 'package:flutter/foundation.dart';
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
  String _debugRawInput = '';
  String _debugNormalizedInput = '';

  static const _testInputs = [
    'iyi değilim',
    'çok hastayım',
    'içim daralıyor',
    'çok bunaldım',
    'çok yalnızım',
    'Allah beni affeder mi',
    'çok korkuyorum',
    'ne yapacağımı bilmiyorum',
    'alkolü bıraktım ama zorlanıyorum',
  ];

  @override
  void initState() {
    super.initState();
    _controller.addListener(_syncInputDebug);
  }

  @override
  void dispose() {
    _controller.removeListener(_syncInputDebug);
    _controller.dispose();
    super.dispose();
  }

  void _syncInputDebug() {
    if (!kDebugMode) {
      return;
    }
    setState(() {
      _debugRawInput = _controller.text;
      _debugNormalizedInput = SituationTagMapper.normalizeForMatching(
        _controller.text,
      );
    });
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
                    if (kDebugMode) ...[
                      const SizedBox(height: 10),
                      _SituationInputDebugCard(
                        rawInput: _debugRawInput,
                        normalizedInput: _debugNormalizedInput,
                      ),
                    ],
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
              const SizedBox(height: 14),
              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Geçici test modu',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        for (final input in _testInputs)
                          ActionChip(
                            label: Text(input),
                            onPressed: () {
                              _controller.text = input;
                              controller.search(input);
                            },
                          ),
                      ],
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
        Chip(
          label: Text('Tema: ${controller.selectedTag ?? ayah.tags.first}'),
        ),
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
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
              ),
              const SizedBox(height: 8),
              Text(support.explanation),
              const SizedBox(height: 16),
              Text(
                'Kısa dua',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
              ),
              const SizedBox(height: 8),
              Text(support.dua),
              const SizedBox(height: 16),
              Text(
                'Bugün için küçük adım',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
              ),
              const SizedBox(height: 8),
              Text(support.actionSuggestion),
            ],
          ),
        ),
        if (kDebugMode) _SituationDebugPanel(controller: controller),
      ],
    );
  }
}

class _SituationInputDebugCard extends StatelessWidget {
  const _SituationInputDebugCard({
    required this.rawInput,
    required this.normalizedInput,
  });

  final String rawInput;
  final String normalizedInput;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.black12,
        borderRadius: BorderRadius.circular(8),
      ),
      child: DefaultTextStyle.merge(
        style: Theme.of(context).textTheme.bodySmall,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'INPUT DEBUG',
              style: TextStyle(fontWeight: FontWeight.bold),
            ),
            Text('Raw input: $rawInput'),
            Text('Normalized input: $normalizedInput'),
          ],
        ),
      ),
    );
  }
}

class _SituationDebugPanel extends StatelessWidget {
  const _SituationDebugPanel({required this.controller});

  final SituationAyahController controller;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(top: 16),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.black12,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'DEBUG MODE',
            style: TextStyle(fontWeight: FontWeight.bold),
          ),
          Text('Raw input: ${controller.userInput}'),
          Text('Normalized input: ${controller.normalizedInput}'),
          Text('AI enabled: ${controller.aiEnabled}'),
          Text('Primary theme: ${controller.primaryTag}'),
          Text('Secondary themes: ${_formatList(controller.secondaryTags)}'),
          Text('Emotion: ${controller.emotion}'),
          Text('Severity: ${controller.severity}'),
          Text('Confidence: ${controller.confidence.toStringAsFixed(2)}'),
          Text('Input hash: ${controller.inputHash}'),
          Text('Candidate count: ${controller.candidateCount}'),
          Text('Detected themes: ${_formatList(controller.detectedTags)}'),
          Text('Keywords: ${_formatList(controller.matchedKeywords)}'),
          Text(
            'Primary candidates: ${_formatList(controller.primaryCandidateAyahIds)}',
          ),
          Text(
            'Top candidate ayah ids: ${_formatList(controller.candidateAyahIds)}',
          ),
          Text(
            'Shown history: ${_formatList(controller.shownHistoryAyahIds)}',
          ),
          Text(
            'History after selection: ${_formatList(controller.updatedShownHistoryAyahIds)}',
          ),
          Text('Selected index: ${controller.selectedIndex}'),
          Text('Selected: ${controller.selectedAyahId ?? '-'}'),
          Text('History reset: ${controller.resetHistoryForTheme}'),
          Text('Source: ${controller.explanationSource}'),
        ],
      ),
    );
  }

  String _formatList(Iterable<Object> values) {
    return values.isEmpty ? '-' : values.join(', ');
  }
}
