import 'package:flutter/material.dart';

import '../../data/models/surah_summary.dart';
import '../../data/sources/local/local_module_source.dart';
import '../../shared/widgets/app_gradient_background.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_radius.dart';
import '../../theme/app_spacing.dart';

enum _SurahFilter { all, meccan, medinan }

class SurahsScreen extends StatefulWidget {
  const SurahsScreen({super.key});

  @override
  State<SurahsScreen> createState() => _SurahsScreenState();
}

class _SurahsScreenState extends State<SurahsScreen> {
  final _source = LocalModuleSource();
  final _searchController = TextEditingController();
  late final Future<List<SurahSummary>> _surahsFuture;
  _SurahFilter _filter = _SurahFilter.all;
  String _query = '';

  @override
  void initState() {
    super.initState();
    _surahsFuture = _source.loadSurahSummaries();
    _searchController.addListener(() {
      setState(() {
        _query = _searchController.text;
      });
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Sureler'),
        actions: [
          IconButton(
            tooltip: 'Okuma',
            onPressed: () {},
            icon: const Icon(Icons.menu_book_outlined),
          ),
          const SizedBox(width: 6),
        ],
      ),
      body: AppGradientBackground(
        child: FutureBuilder<List<SurahSummary>>(
          future: _surahsFuture,
          builder: (context, snapshot) {
            final surahs = snapshot.data ?? const <SurahSummary>[];
            final filtered = _filterSurahs(surahs);

            return ListView(
              padding: const EdgeInsets.fromLTRB(18, 10, 18, 30),
              children: [
                _SearchField(
                  controller: _searchController,
                  hintText: 'Sure ara...',
                ),
                const SizedBox(height: AppSpacing.medium),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      _FilterPill(
                        label: 'Tümü',
                        selected: _filter == _SurahFilter.all,
                        onTap: () => setState(() {
                          _filter = _SurahFilter.all;
                        }),
                      ),
                      _FilterPill(
                        label: 'Mekke',
                        selected: _filter == _SurahFilter.meccan,
                        onTap: () => setState(() {
                          _filter = _SurahFilter.meccan;
                        }),
                      ),
                      _FilterPill(
                        label: 'Medine',
                        selected: _filter == _SurahFilter.medinan,
                        onTap: () => setState(() {
                          _filter = _SurahFilter.medinan;
                        }),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.medium),
                if (snapshot.connectionState == ConnectionState.waiting)
                  const _StateCard(text: 'Sureler hazırlanıyor...')
                else if (filtered.isEmpty)
                  const _StateCard(text: 'Aramanıza uygun sure bulunamadı.')
                else
                  ...filtered.map((surah) => _SurahCard(surah: surah)),
              ],
            );
          },
        ),
      ),
    );
  }

  List<SurahSummary> _filterSurahs(List<SurahSummary> surahs) {
    final normalizedQuery = _normalize(_query);
    return surahs.where((surah) {
      final matchesFilter = switch (_filter) {
        _SurahFilter.all => true,
        _SurahFilter.meccan => surah.isMeccan,
        _SurahFilter.medinan => !surah.isMeccan,
      };
      if (!matchesFilter) return false;
      if (normalizedQuery.isEmpty) return true;
      final haystack = _normalize(
        '${surah.number} ${surah.nameTr} ${surah.nameAr} ${surah.revelationLabel}',
      );
      return haystack.contains(normalizedQuery);
    }).toList();
  }
}

class _SurahCard extends StatelessWidget {
  const _SurahCard({required this.surah});

  final SurahSummary surah;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => SurahDetailScreen(surahNumber: surah.number),
          ),
        ),
        borderRadius: BorderRadius.circular(AppRadius.medium),
        child: Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                AppColors.surface.withValues(alpha: 0.96),
                AppColors.surfaceSoft.withValues(alpha: 0.74),
              ],
            ),
            borderRadius: BorderRadius.circular(AppRadius.medium),
            border: Border.all(
              color: AppColors.primaryAccent.withValues(alpha: 0.18),
              width: 0.8,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.26),
                blurRadius: 18,
                offset: const Offset(0, 10),
              ),
              BoxShadow(
                color: AppColors.primaryAccent.withValues(alpha: 0.07),
                blurRadius: 18,
                offset: const Offset(0, -3),
              ),
            ],
          ),
          child: Row(
            children: [
              _SurahNumberBadge(number: surah.number),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${surah.nameTr} Suresi',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            color: AppColors.textPrimary,
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 6,
                      runSpacing: 4,
                      children: [
                        _MetaText(surah.revelationLabel),
                        const _MetaDot(),
                        _MetaText('${surah.ayahCount} Ayet'),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Flexible(
                child: Text(
                  surah.nameAr,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.right,
                  textDirection: TextDirection.rtl,
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        color: AppColors.secondaryAccent,
                        fontWeight: FontWeight.w600,
                      ),
                ),
              ),
              const SizedBox(width: 8),
              const Icon(
                Icons.chevron_right_rounded,
                color: AppColors.primaryAccent,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class SurahDetailScreen extends StatefulWidget {
  const SurahDetailScreen({
    super.key,
    required this.surahNumber,
  });

  final int surahNumber;

  @override
  State<SurahDetailScreen> createState() => _SurahDetailScreenState();
}

class _SurahDetailScreenState extends State<SurahDetailScreen> {
  final _source = LocalModuleSource();
  late final Future<SurahDetail?> _surahFuture;

  @override
  void initState() {
    super.initState();
    _surahFuture = _source.loadSurahDetail(widget.surahNumber);
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<SurahDetail?>(
      future: _surahFuture,
      builder: (context, snapshot) {
        final surah = snapshot.data;
        return Scaffold(
          appBar: AppBar(
            title: Text(surah == null ? 'Sure' : '${surah.nameTr} Suresi'),
          ),
          body: AppGradientBackground(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(18, 10, 18, 30),
              children: [
                if (snapshot.connectionState == ConnectionState.waiting)
                  const _StateCard(text: 'Sure hazırlanıyor...')
                else if (surah == null)
                  const _StateCard(text: 'Sure bilgisi bulunamadı.')
                else ...[
                  _SurahDetailHeader(surah: surah),
                  const SizedBox(height: AppSpacing.medium),
                  if (surah.ayahs.isEmpty)
                    const _StateCard(
                      text: 'Bu sure için ayet detay verisi henüz eklenmedi.',
                    )
                  else
                    ...surah.ayahs.map(
                      (ayah) => _AyahDetailCard(
                        ayah: ayah,
                      ),
                    ),
                ],
              ],
            ),
          ),
        );
      },
    );
  }
}

class _SurahDetailHeader extends StatelessWidget {
  const _SurahDetailHeader({required this.surah});

  final SurahDetail surah;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 18),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            AppColors.surface.withValues(alpha: 0.96),
            AppColors.surfaceSoft.withValues(alpha: 0.76),
          ],
        ),
        borderRadius: BorderRadius.circular(AppRadius.large),
        border: Border.all(
          color: AppColors.primaryAccent.withValues(alpha: 0.22),
        ),
        boxShadow: [
          BoxShadow(
            color: AppColors.primaryAccent.withValues(alpha: 0.1),
            blurRadius: 22,
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              _SurahNumberBadge(number: surah.number),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${surah.nameTr} Suresi',
                      style:
                          Theme.of(context).textTheme.headlineSmall?.copyWith(
                                fontWeight: FontWeight.w800,
                              ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      surah.nameAr,
                      textDirection: TextDirection.rtl,
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            color: AppColors.secondaryAccent,
                          ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _DetailPill(text: surah.revelationLabel),
              _DetailPill(text: '${surah.ayahCount} Ayet'),
              _DetailPill(text: '${surah.number}. Sure'),
            ],
          ),
        ],
      ),
    );
  }
}

class _AyahDetailCard extends StatelessWidget {
  const _AyahDetailCard({
    required this.ayah,
  });

  final SurahAyah ayah;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.fromLTRB(16, 15, 16, 15),
      decoration: BoxDecoration(
        color: AppColors.surface.withValues(alpha: 0.82),
        borderRadius: BorderRadius.circular(AppRadius.medium),
        border: Border.all(
          color: AppColors.divider.withValues(alpha: 0.85),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: _DetailPill(text: '${ayah.number}. Ayet')),
              const SizedBox(width: 8),
              const _AudioButton(),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            'Sesli dinleme yakında eklenecek.',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: AppColors.textMuted,
                ),
          ),
          const SizedBox(height: 14),
          Text(
            ayah.arabic,
            textDirection: TextDirection.rtl,
            textAlign: TextAlign.right,
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  color: AppColors.secondaryAccent,
                  height: 1.75,
                ),
          ),
          const SizedBox(height: 12),
          Text(
            ayah.turkish,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: AppColors.textPrimary,
                  height: 1.55,
                ),
          ),
        ],
      ),
    );
  }
}

class _AudioButton extends StatelessWidget {
  const _AudioButton();

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: 'Sesli dinleme yakında eklenecek.',
      child: TextButton.icon(
        onPressed: null,
        icon: const Icon(Icons.play_circle_outline_rounded, size: 18),
        label: const Text('Dinle'),
      ),
    );
  }
}

class _DetailPill extends StatelessWidget {
  const _DetailPill({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.primaryAccent.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(AppRadius.small),
        border: Border.all(
          color: AppColors.primaryAccent.withValues(alpha: 0.24),
        ),
      ),
      child: Text(
        text,
        style: Theme.of(context).textTheme.labelMedium?.copyWith(
              color: AppColors.primaryAccentSoft,
              fontWeight: FontWeight.w700,
            ),
      ),
    );
  }
}

class _SurahNumberBadge extends StatelessWidget {
  const _SurahNumberBadge({required this.number});

  final int number;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 52,
      height: 52,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: AppColors.primaryAccent.withValues(alpha: 0.08),
        border: Border.all(
          color: AppColors.primaryAccent.withValues(alpha: 0.62),
          width: 1.2,
        ),
        boxShadow: [
          BoxShadow(
            color: AppColors.primaryAccent.withValues(alpha: 0.14),
            blurRadius: 18,
          ),
        ],
      ),
      child: Text(
        '$number',
        style: Theme.of(context).textTheme.titleMedium?.copyWith(
              color: AppColors.primaryAccentSoft,
              fontWeight: FontWeight.w800,
            ),
      ),
    );
  }
}

class _FilterPill extends StatelessWidget {
  const _FilterPill({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.large),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
          decoration: BoxDecoration(
            color: selected
                ? AppColors.primaryAccent.withValues(alpha: 0.14)
                : AppColors.surfaceSoft.withValues(alpha: 0.74),
            borderRadius: BorderRadius.circular(AppRadius.large),
            border: Border.all(
              color: selected
                  ? AppColors.primaryAccent.withValues(alpha: 0.62)
                  : AppColors.divider.withValues(alpha: 0.78),
            ),
            boxShadow: selected
                ? [
                    BoxShadow(
                      color: AppColors.primaryAccent.withValues(alpha: 0.18),
                      blurRadius: 16,
                    ),
                  ]
                : null,
          ),
          child: Text(
            label,
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: selected
                      ? AppColors.primaryAccentSoft
                      : AppColors.textSecondary,
                  fontWeight: selected ? FontWeight.w800 : FontWeight.w500,
                ),
          ),
        ),
      ),
    );
  }
}

class _SearchField extends StatelessWidget {
  const _SearchField({
    required this.controller,
    required this.hintText,
  });

  final TextEditingController controller;
  final String hintText;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      textInputAction: TextInputAction.search,
      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
            color: AppColors.textPrimary,
          ),
      decoration: InputDecoration(
        hintText: hintText,
        prefixIcon: const Icon(Icons.search_rounded),
        suffixIcon: controller.text.isEmpty
            ? null
            : IconButton(
                tooltip: 'Temizle',
                onPressed: controller.clear,
                icon: const Icon(Icons.close_rounded),
              ),
      ),
    );
  }
}

class _MetaText extends StatelessWidget {
  const _MetaText(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: AppColors.textSecondary,
          ),
    );
  }
}

class _MetaDot extends StatelessWidget {
  const _MetaDot();

  @override
  Widget build(BuildContext context) {
    return Text(
      '•',
      style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: AppColors.primaryAccent,
          ),
    );
  }
}

class _StateCard extends StatelessWidget {
  const _StateCard({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surface.withValues(alpha: 0.82),
        borderRadius: BorderRadius.circular(AppRadius.medium),
        border: Border.all(color: AppColors.divider),
      ),
      child: Text(text),
    );
  }
}

String _normalize(String value) {
  return value
      .toLowerCase()
      .replaceAll('â', 'a')
      .replaceAll('î', 'i')
      .replaceAll('û', 'u')
      .replaceAll('ı', 'i')
      .replaceAll('ğ', 'g')
      .replaceAll('ü', 'u')
      .replaceAll('ş', 's')
      .replaceAll('ö', 'o')
      .replaceAll('ç', 'c')
      .trim();
}
