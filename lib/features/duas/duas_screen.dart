import 'package:flutter/material.dart';

import '../../data/models/dua_item.dart';
import '../../data/services/recommended_resource_service.dart';
import '../../data/sources/local/local_module_source.dart';
import '../../shared/widgets/app_gradient_background.dart';
import '../../shared/widgets/recommended_resource_card.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_radius.dart';
import '../../theme/app_spacing.dart';

class DuasScreen extends StatefulWidget {
  const DuasScreen({super.key});

  @override
  State<DuasScreen> createState() => _DuasScreenState();
}

class _DuasScreenState extends State<DuasScreen> {
  final _source = LocalModuleSource();
  final _searchController = TextEditingController();
  late final Future<List<DuaItem>> _duasFuture;
  String _query = '';

  @override
  void initState() {
    super.initState();
    _duasFuture = _source.loadDuas();
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
        title: const Text('Dualar'),
        actions: [
          IconButton(
            tooltip: 'Favoriler',
            onPressed: () {},
            icon: const Icon(Icons.star_border_rounded),
          ),
          const SizedBox(width: 6),
        ],
      ),
      body: AppGradientBackground(
        child: FutureBuilder<List<DuaItem>>(
          future: _duasFuture,
          builder: (context, snapshot) {
            final duas = snapshot.data ?? const <DuaItem>[];
            final filtered = _filterDuas(duas, _query);
            final sourcedDuas =
                filtered.where((dua) => !_isTurkishNiyaz(dua)).toList();
            final turkishNiyazlar =
                filtered.where((dua) => _isTurkishNiyaz(dua)).toList();

            return ListView(
              padding: const EdgeInsets.fromLTRB(18, 10, 18, 30),
              children: [
                _SearchField(
                  controller: _searchController,
                  hintText: 'Dua ara...',
                ),
                const SizedBox(height: AppSpacing.large),
                if (snapshot.connectionState == ConnectionState.waiting)
                  const _ModuleLoadingCard(text: 'Dualar hazırlanıyor...')
                else if (filtered.isEmpty)
                  const _ModuleEmptyCard(
                      text: 'Aramanıza uygun dua bulunamadı.')
                else ...[
                  _DuaSection(
                    icon: Icons.menu_book_rounded,
                    title: 'Kaynaklı Kısa Dualar',
                    duas: sourcedDuas,
                  ),
                  if (sourcedDuas.isNotEmpty && turkishNiyazlar.isNotEmpty)
                    const SizedBox(height: AppSpacing.medium),
                  _DuaSection(
                    icon: Icons.spa_rounded,
                    title: 'Günlük Hayat İçin Türkçe Niyazlar',
                    duas: turkishNiyazlar,
                  ),
                ],
              ],
            );
          },
        ),
      ),
    );
  }

  List<DuaItem> _filterDuas(List<DuaItem> duas, String query) {
    final normalizedQuery = _normalize(query);
    if (normalizedQuery.isEmpty) return duas;
    return duas.where((dua) {
      final haystack = _normalize(
        '${dua.title} ${dua.arabic} ${dua.transliteration} ${dua.turkishMeaning} ${dua.turkishPrayer} ${dua.source} ${dua.category} ${dua.tags.join(' ')}',
      );
      return haystack.contains(normalizedQuery);
    }).toList();
  }
}

class _DuaSection extends StatelessWidget {
  const _DuaSection({
    required this.icon,
    required this.title,
    required this.duas,
  });

  final IconData icon;
  final String title;
  final List<DuaItem> duas;

  @override
  Widget build(BuildContext context) {
    if (duas.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _ListHeader(
          icon: icon,
          title: title,
          trailing: '${duas.length}',
        ),
        const SizedBox(height: AppSpacing.small),
        for (final dua in duas) _DuaCard(dua: dua),
      ],
    );
  }
}

class _DuaCard extends StatelessWidget {
  const _DuaCard({required this.dua});

  final DuaItem dua;

  @override
  Widget build(BuildContext context) {
    return _GlowCard(
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => DuaDetailScreen(dua: dua),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          _NeonRoundIcon(
            icon: _isTurkishNiyaz(dua)
                ? Icons.spa_rounded
                : Icons.front_hand_outlined,
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  dua.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: AppColors.textPrimary,
                        fontWeight: FontWeight.w800,
                      ),
                ),
                const SizedBox(height: 7),
                if (dua.arabic.isNotEmpty) ...[
                  Text(
                    dua.arabic,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    textDirection: TextDirection.rtl,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          color: AppColors.secondaryAccent,
                          height: 1.55,
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                  const SizedBox(height: 7),
                ],
                Text(
                  dua.turkishPrayer.isNotEmpty
                      ? dua.turkishPrayer
                      : dua.turkishMeaning,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.textSecondary,
                        height: 1.45,
                      ),
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 6,
                  children: [
                    _MiniPill(text: dua.category, emphasized: true),
                    _MiniPill(
                      text: _isTurkishNiyaz(dua) ? 'Türkçe niyaz' : dua.source,
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          const Icon(
            Icons.chevron_right_rounded,
            color: AppColors.primaryAccent,
          ),
        ],
      ),
    );
  }
}

class DuaDetailScreen extends StatelessWidget {
  const DuaDetailScreen({
    super.key,
    required this.dua,
  });

  final DuaItem dua;

  // TODO: Add dua audio only for entries that are directly tied to verified
  // Quran ayah audio or separately licensed human recitation. Do not use AI
  // voice for Quran or Arabic religious recitation.
  @override
  Widget build(BuildContext context) {
    final recommendedResources = const RecommendedResourceService().matchByTags(
      [
        dua.category,
        dua.title,
        ...dua.tags,
      ],
    );

    return Scaffold(
      appBar: AppBar(title: Text(dua.title)),
      body: AppGradientBackground(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(18, 10, 18, 30),
          children: [
            _GlowCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      _NeonRoundIcon(
                        icon: _isTurkishNiyaz(dua)
                            ? Icons.spa_rounded
                            : Icons.front_hand_outlined,
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              dua.title,
                              style: Theme.of(context)
                                  .textTheme
                                  .headlineSmall
                                  ?.copyWith(fontWeight: FontWeight.w800),
                            ),
                            const SizedBox(height: 8),
                            Wrap(
                              spacing: 8,
                              runSpacing: 6,
                              children: [
                                _MiniPill(text: dua.category, emphasized: true),
                                _MiniPill(
                                  text: _isTurkishNiyaz(dua)
                                      ? 'Türkçe niyaz'
                                      : dua.source,
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  if (dua.arabic.isNotEmpty) ...[
                    const SizedBox(height: 24),
                    Text(
                      dua.arabic,
                      textDirection: TextDirection.rtl,
                      textAlign: TextAlign.right,
                      style:
                          Theme.of(context).textTheme.headlineSmall?.copyWith(
                                color: AppColors.secondaryAccent,
                                height: 1.75,
                                fontWeight: FontWeight.w600,
                              ),
                    ),
                  ],
                  if (dua.transliteration.isNotEmpty) ...[
                    const SizedBox(height: 22),
                    Text(
                      'Okunuşu',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            color: AppColors.primaryAccentSoft,
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      dua.transliteration,
                      style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                            color: AppColors.textSecondary,
                            height: 1.65,
                          ),
                    ),
                  ],
                  if (dua.turkishPrayer.isNotEmpty) ...[
                    const SizedBox(height: 22),
                    Container(
                      padding: const EdgeInsets.fromLTRB(14, 13, 14, 14),
                      decoration: BoxDecoration(
                        color: AppColors.primaryAccent.withValues(alpha: 0.07),
                        borderRadius: BorderRadius.circular(AppRadius.medium),
                        border: Border.all(
                          color:
                              AppColors.primaryAccent.withValues(alpha: 0.18),
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Türkçe Dua',
                            style: Theme.of(context)
                                .textTheme
                                .titleMedium
                                ?.copyWith(
                                  color: AppColors.primaryAccentSoft,
                                  fontWeight: FontWeight.w900,
                                ),
                          ),
                          const SizedBox(height: 10),
                          Text(
                            dua.turkishPrayer,
                            style:
                                Theme.of(context).textTheme.bodyLarge?.copyWith(
                                      color: AppColors.textPrimary,
                                      height: 1.72,
                                    ),
                          ),
                        ],
                      ),
                    ),
                  ],
                  if (dua.turkishMeaning.isNotEmpty) ...[
                    const SizedBox(height: 22),
                    Text(
                      'Türkçe anlamı',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            color: AppColors.primaryAccentSoft,
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      dua.turkishMeaning,
                      style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                            color: AppColors.textPrimary,
                          ),
                    ),
                  ],
                  if (dua.tags.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    Wrap(
                      spacing: 8,
                      runSpacing: 6,
                      children: [
                        for (final tag in dua.tags) _MiniPill(text: tag),
                      ],
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.medium),
            _GlowCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Kaynak notu',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          color: AppColors.textPrimary,
                          fontWeight: FontWeight.w800,
                        ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    dua.note.isEmpty
                        ? '${dua.source} referansı kullanıcıya dua metninin bağlamını göstermek için sunulur. Mealler ve açıklamalar güvenilir kaynaklarla birlikte değerlendirilmelidir.'
                        : dua.note,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ],
              ),
            ),
            if (recommendedResources.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.medium),
              RecommendedResourcesSection(resources: recommendedResources),
            ],
          ],
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

class _ListHeader extends StatelessWidget {
  const _ListHeader({
    required this.icon,
    required this.title,
    required this.trailing,
  });

  final IconData icon;
  final String title;
  final String trailing;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, color: AppColors.primaryAccent, size: 22),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            title,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: AppColors.textPrimary,
                  fontWeight: FontWeight.w700,
                ),
          ),
        ),
        Text(
          trailing,
          style: Theme.of(context).textTheme.labelMedium?.copyWith(
                color: AppColors.primaryAccent,
              ),
        ),
      ],
    );
  }
}

class _GlowCard extends StatelessWidget {
  const _GlowCard({
    required this.child,
    this.onTap,
  });

  final Widget child;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final card = Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.fromLTRB(14, 13, 14, 13),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            AppColors.surface.withValues(alpha: 0.96),
            AppColors.surfaceSoft.withValues(alpha: 0.72),
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
      child: child,
    );
    if (onTap == null) return card;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.medium),
        child: card,
      ),
    );
  }
}

class _NeonRoundIcon extends StatelessWidget {
  const _NeonRoundIcon({required this.icon});

  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 58,
      height: 58,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: AppColors.primaryAccent.withValues(alpha: 0.08),
        border: Border.all(
          color: AppColors.primaryAccent.withValues(alpha: 0.26),
        ),
        boxShadow: [
          BoxShadow(
            color: AppColors.primaryAccent.withValues(alpha: 0.16),
            blurRadius: 20,
          ),
        ],
      ),
      child: Icon(icon, color: AppColors.primaryAccent, size: 30),
    );
  }
}

class _MiniPill extends StatelessWidget {
  const _MiniPill({
    required this.text,
    this.emphasized = false,
  });

  final String text;
  final bool emphasized;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: emphasized
            ? AppColors.primaryAccent.withValues(alpha: 0.12)
            : AppColors.surfaceSoft.withValues(alpha: 0.62),
        borderRadius: BorderRadius.circular(AppRadius.small),
        border: Border.all(
          color: emphasized
              ? AppColors.primaryAccent.withValues(alpha: 0.24)
              : AppColors.divider.withValues(alpha: 0.7),
        ),
      ),
      child: Text(
        text,
        style: Theme.of(context).textTheme.labelMedium?.copyWith(
              color: emphasized
                  ? AppColors.primaryAccentSoft
                  : AppColors.textSecondary,
              fontSize: 12,
            ),
      ),
    );
  }
}

class _ModuleLoadingCard extends StatelessWidget {
  const _ModuleLoadingCard({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return _GlowCard(
      child: Row(
        children: [
          const SizedBox(
            width: 18,
            height: 18,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
          const SizedBox(width: 12),
          Text(text),
        ],
      ),
    );
  }
}

class _ModuleEmptyCard extends StatelessWidget {
  const _ModuleEmptyCard({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return _GlowCard(
      child: Text(
        text,
        style: Theme.of(context).textTheme.bodyMedium,
      ),
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

bool _isTurkishNiyaz(DuaItem dua) {
  return dua.source == 'Türkçe niyaz metni';
}
