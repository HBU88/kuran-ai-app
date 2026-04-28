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
import '../chat/chat_mode.dart';
import '../chat/chat_screen.dart';
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
                const _ModuleGrid(),
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
                          'Hazır. Rehberlik ve Dinî Bilgiler modüllerinden birini açabilirsin.',
                          style:
                              Theme.of(context).textTheme.bodySmall?.copyWith(
                                    color: AppColors.textSecondary,
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
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisSpacing: 12,
      mainAxisSpacing: 12,
      childAspectRatio: 1.08,
      children: [
        HomeMenuItem(
          label: 'Rehberlik',
          icon: Icons.menu_book_outlined,
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => const ChatScreen(mode: ChatMode.ayah),
            ),
          ),
        ),
        HomeMenuItem(
          label: 'Dinî Bilgiler',
          icon: Icons.library_books_outlined,
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => const ChatScreen(mode: ChatMode.ilmihal),
            ),
          ),
        ),
      ],
    );
  }
}
