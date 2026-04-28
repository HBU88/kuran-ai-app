import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/constants/app_constants.dart';
import '../../core/constants/app_routes.dart';
import '../../data/models/ayah_model.dart';
import '../../data/repositories/ayah_repository.dart';
import '../../shared/widgets/app_gradient_background.dart';
import '../../shared/widgets/app_logo.dart';
import '../../shared/widgets/ayah_card.dart';
import '../../shared/widgets/loading_view.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_radius.dart';
import '../../theme/app_spacing.dart';
import 'widgets/home_menu_item.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final repository = context.read<AyahRepository>();

    return Scaffold(
      extendBody: true,
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
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: 0,
        onDestinationSelected: (index) {
          if (index == 1) {
            Navigator.pushNamed(context, AppRoutes.chat);
          } else if (index == 2) {
            Navigator.pushNamed(context, AppRoutes.settings);
          }
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.menu_book_outlined),
            selectedIcon: Icon(Icons.menu_book_rounded),
            label: 'Rehberlik',
          ),
          NavigationDestination(
            icon: Icon(Icons.chat_bubble_outline_rounded),
            selectedIcon: Icon(Icons.chat_bubble_rounded),
            label: 'Sohbet',
          ),
          NavigationDestination(
            icon: Icon(Icons.tune_rounded),
            selectedIcon: Icon(Icons.tune_rounded),
            label: 'Ayarlar',
          ),
        ],
      ),
      body: FutureBuilder<AyahModel>(
        future: repository.getTodayAyah(DateTime.now()),
        builder: (context, snapshot) {
          if (!snapshot.hasData) {
            return const AppGradientBackground(
              child: LoadingView(message: 'Bugünün ayeti hazırlanıyor...'),
            );
          }

          final ayah = snapshot.data!;
          return AppGradientBackground(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
              children: [
                const SizedBox(height: 4),
                const AppLogo(),
                const SizedBox(height: 10),
                Text(
                  AppConstants.appTagline,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: AppColors.textSecondary,
                    height: 1.45,
                  ),
                ),
                const SizedBox(height: 20),
                Text(
                  'Bugünün Ayeti',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: AppColors.textSecondary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 12),
                AyahCard(ayah: ayah),
                const SizedBox(height: AppSpacing.large),
                const _MenuGrid(),
                const SizedBox(height: AppSpacing.large),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 14,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(AppRadius.large),
                    border: Border.all(
                      color: AppColors.divider.withValues(alpha: 0.55),
                      width: 0.7,
                    ),
                  ),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.circle_outlined,
                        size: 18,
                        color: AppColors.primaryAccent,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'Hazır. Sohbete geçebilir, ezberini takip edebilir veya favorileri açabilirsin.',
                          style: Theme.of(context).textTheme.bodySmall
                              ?.copyWith(color: AppColors.textSecondary),
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

class _MenuGrid extends StatelessWidget {
  const _MenuGrid();

  @override
  Widget build(BuildContext context) {
    return GridView.count(
      crossAxisCount: MediaQuery.sizeOf(context).width > 420 ? 3 : 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisSpacing: 12,
      mainAxisSpacing: 12,
      childAspectRatio: 1.08,
      children: [
        HomeMenuItem(
          label: 'Sohbet',
          icon: Icons.chat_bubble_outline_rounded,
          onTap: () => Navigator.pushNamed(context, AppRoutes.chat),
        ),
        HomeMenuItem(
          label: 'Ezber',
          icon: Icons.menu_book_outlined,
          onTap: () => Navigator.pushNamed(context, AppRoutes.memorization),
        ),
        HomeMenuItem(
          label: 'Kıble',
          icon: Icons.explore_outlined,
          onTap: () => Navigator.pushNamed(context, AppRoutes.settings),
        ),
        HomeMenuItem(
          label: 'Namaz Vakitleri',
          icon: Icons.schedule_outlined,
          onTap: () => Navigator.pushNamed(context, AppRoutes.prayerTimes),
        ),
        HomeMenuItem(
          label: 'Favoriler',
          icon: Icons.favorite_border_rounded,
          onTap: () => Navigator.pushNamed(context, AppRoutes.favorites),
        ),
      ],
    );
  }
}
