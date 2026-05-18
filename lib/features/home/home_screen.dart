import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/constants/app_constants.dart';
import '../../core/constants/app_routes.dart';
import '../../data/models/ayah_model.dart';
import '../../data/repositories/ayah_repository.dart';
import '../../shared/widgets/app_card.dart';
import '../../shared/widgets/app_gradient_background.dart';
import '../../shared/widgets/app_logo.dart';
import '../../shared/widgets/ayah_card.dart';
import '../../shared/widgets/loading_view.dart';
import '../../shared/widgets/section_title.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_radius.dart';
import '../../theme/app_spacing.dart';
import '../chat/chat_mode.dart';
import '../chat/chat_screen.dart';
import 'widgets/home_menu_item.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final repository = context.read<AyahRepository>();

    return Scaffold(
      appBar: AppBar(
        title: const AppLogo(compact: true),
        actions: [
          IconButton(
            onPressed: () => Navigator.pushNamed(context, AppRoutes.favorites),
            icon: const Icon(Icons.favorite_border_rounded),
            tooltip: 'Favoriler',
          ),
          IconButton(
            onPressed: () => Navigator.pushNamed(context, AppRoutes.settings),
            icon: const Icon(Icons.tune_rounded),
            tooltip: 'Ayarlar',
          ),
          const SizedBox(width: 6),
        ],
      ),
      body: FutureBuilder<AyahModel>(
        future: repository.getTodayAyah(DateTime.now()),
        builder: (context, snapshot) {
          if (!snapshot.hasData) {
            return const AppGradientBackground(
              child: LoadingView(
                message: 'Bugünün ayeti hazırlanıyor...',
              ),
            );
          }

          final ayah = snapshot.data!;
          return AppGradientBackground(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(18, 10, 18, 30),
              children: [
                const SizedBox(height: 4),
                AppCard(
                  padding: const EdgeInsets.fromLTRB(18, 18, 18, 18),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            width: 48,
                            height: 48,
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                                colors: [
                                  AppColors.primaryAccent
                                      .withValues(alpha: 0.22),
                                  AppColors.surfaceSoft,
                                ],
                              ),
                              borderRadius:
                                  BorderRadius.circular(AppRadius.medium),
                              border: Border.all(
                                color: AppColors.primaryAccent
                                    .withValues(alpha: 0.2),
                                width: 0.8,
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: AppColors.primaryAccent
                                      .withValues(alpha: 0.16),
                                  blurRadius: 16,
                                  offset: const Offset(0, 6),
                                ),
                              ],
                            ),
                            child: Padding(
                              padding: const EdgeInsets.all(8),
                              child: Image.asset(
                                'assets/app/launcher_icon.png',
                                fit: BoxFit.contain,
                                errorBuilder: (context, error, stackTrace) {
                                  return const Icon(
                                    Icons.auto_awesome_rounded,
                                    color: AppColors.primaryAccent,
                                  );
                                },
                              ),
                            ),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  AppConstants.appName,
                                  style: Theme.of(context)
                                      .textTheme
                                      .headlineMedium
                                      ?.copyWith(
                                        fontWeight: FontWeight.w800,
                                        letterSpacing: 0.6,
                                      ),
                                ),
                                const SizedBox(height: 5),
                                Text(
                                  AppConstants.appTagline,
                                  style: Theme.of(context)
                                      .textTheme
                                      .bodyMedium
                                      ?.copyWith(
                                        color: AppColors.textSecondary,
                                        height: 1.45,
                                      ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      const Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          _StatusChip(label: 'Kur’an'),
                          _StatusChip(label: 'Dinî Bilgiler'),
                          _StatusChip(label: 'Kıble'),
                          _StatusChip(label: 'Ezber'),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.large),
                SectionTitle(
                  'Bugünün Ayeti',
                  action: TextButton(
                    onPressed: () =>
                        Navigator.pushNamed(context, AppRoutes.chat),
                    child: const Text('Sohbete git'),
                  ),
                ),
                AyahCard(ayah: ayah),
                const SizedBox(height: AppSpacing.large),
                SectionTitle(
                  'Modüller',
                  action: Text(
                    'Hızlı erişim',
                    style: Theme.of(context).textTheme.labelMedium?.copyWith(
                          color: AppColors.textMuted,
                        ),
                  ),
                ),
                const _ModuleGrid(),
                const SizedBox(height: AppSpacing.large),
                AppCard(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                  child: Row(
                    children: [
                      Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color:
                              AppColors.primaryAccent.withValues(alpha: 0.14),
                          border: Border.all(
                            color:
                                AppColors.primaryAccent.withValues(alpha: 0.16),
                          ),
                        ),
                        child: const Icon(
                          Icons.circle_outlined,
                          size: 18,
                          color: AppColors.primaryAccent,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'Ayet Rehberi, Dinî Bilgiler, Namaz Vakitleri, Kıble ve Ezber modüllerine buradan ulaşabilirsin.',
                          style:
                              Theme.of(context).textTheme.bodyMedium?.copyWith(
                                    color: AppColors.textSecondary,
                                    height: 1.5,
                                  ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _ModuleGrid extends StatelessWidget {
  const _ModuleGrid();

  @override
  Widget build(BuildContext context) {
    final modules = [
      _ModuleData(
        label: 'Ayet Rehberi',
        subtitle: 'Duygularına ve sorularına ayetlerle rehberlik',
        iconAsset: 'assets/app/ayah_icon.png',
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => const ChatScreen(mode: ChatMode.ayah),
          ),
        ),
      ),
      _ModuleData(
        label: 'Dinî Bilgiler',
        subtitle: 'Namaz, ibadet, helal-haram ve günlük dinî sorular',
        iconAsset: 'assets/app/ilmihal_icon.png',
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => const ChatScreen(mode: ChatMode.ilmihal),
          ),
        ),
      ),
      _ModuleData(
        label: 'Namaz Vakitleri',
        subtitle: 'Günlük vakit takibi',
        iconAsset: 'assets/app/prayer_times_icon.png',
        onTap: () => Navigator.pushNamed(context, AppRoutes.prayerTimes),
      ),
      _ModuleData(
        label: 'Kıble',
        subtitle: 'Kıble yönünü bul',
        iconAsset: 'assets/app/qibla_icon.png',
        onTap: () => Navigator.pushNamed(context, AppRoutes.qibla),
      ),
      // TODO: Re-enable Memorization module after v1 release
    ];

    return GridView.builder(
      itemCount: modules.length,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: MediaQuery.sizeOf(context).width > 420 ? 3 : 2,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
        childAspectRatio: 0.86,
      ),
      itemBuilder: (context, index) {
        final module = modules[index];
        return HomeMenuItem(
          label: module.label,
          subtitle: module.subtitle,
          iconAsset: module.iconAsset,
          onTap: module.onTap,
        );
      },
    );
  }
}

class _ModuleData {
  const _ModuleData({
    required this.label,
    required this.subtitle,
    required this.iconAsset,
    required this.onTap,
  });

  final String label;
  final String subtitle;
  final String iconAsset;
  final VoidCallback onTap;
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.surfaceSoft.withValues(alpha: 0.78),
        borderRadius: BorderRadius.circular(AppRadius.large),
        border: Border.all(
          color: AppColors.divider.withValues(alpha: 0.85),
        ),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelMedium?.copyWith(
              color: AppColors.textPrimary,
              fontWeight: FontWeight.w600,
            ),
      ),
    );
  }
}
