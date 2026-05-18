import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/constants/app_routes.dart';
import '../../shared/widgets/app_card.dart';
import '../../shared/widgets/app_gradient_background.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_spacing.dart';
import 'auth_controller.dart';

class AccountScreen extends StatelessWidget {
  const AccountScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Hesap')),
      body: AppGradientBackground(
        child: Consumer<AuthController>(
          builder: (context, controller, _) {
            return ListView(
              padding: const EdgeInsets.fromLTRB(18, 10, 18, 28),
              children: [
                AppCard(
                  child: controller.isLoggedIn
                      ? _SignedInCard(controller: controller)
                      : const _GuestCard(),
                ),
                const SizedBox(height: AppSpacing.large),
                AppCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Gizlilik',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Üyelik, ileride kayıtlı tercihler, favoriler, geçmiş, premium seçenekler ve projeye destek akışları için güvenli bir temel sağlar.',
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ],
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _GuestCard extends StatelessWidget {
  const _GuestCard();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Misafir olarak devam ediyorsun',
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w800,
              ),
        ),
        const SizedBox(height: 8),
        Text(
          'Kur’an merkezli manevi rehberlik, Ayet Rehberi, Dinî Bilgiler ve diğer modülleri giriş yapmadan kullanabilirsin.',
          style: Theme.of(context).textTheme.bodyMedium,
        ),
        const SizedBox(height: 18),
        Row(
          children: [
            Expanded(
              child: FilledButton.icon(
                onPressed: () => Navigator.pushNamed(context, AppRoutes.login),
                icon: const Icon(Icons.login_rounded),
                label: const Text('Giriş yap'),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: () =>
                    Navigator.pushNamed(context, AppRoutes.register),
                icon: const Icon(Icons.person_add_alt_rounded),
                label: const Text('Kayıt ol'),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _SignedInCard extends StatelessWidget {
  const _SignedInCard({required this.controller});

  final AuthController controller;

  @override
  Widget build(BuildContext context) {
    final user = controller.user;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Hesabın açık',
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w800,
              ),
        ),
        const SizedBox(height: 8),
        Text(
          user?.email ?? '',
          style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                color: AppColors.textPrimary,
              ),
        ),
        const SizedBox(height: 8),
        Text(
          'Üyelik isteğe bağlıdır; misafir deneyimi aktif kalır.',
          style: Theme.of(context).textTheme.bodyMedium,
        ),
        const SizedBox(height: 18),
        OutlinedButton.icon(
          onPressed: controller.isBusy ? null : controller.logout,
          icon: const Icon(Icons.logout_rounded),
          label: const Text('Çıkış yap'),
        ),
      ],
    );
  }
}
