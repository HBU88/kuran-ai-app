import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/constants/app_routes.dart';
import '../../shared/widgets/app_card.dart';
import '../../shared/widgets/app_gradient_background.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_spacing.dart';
import '../settings/settings_controller.dart';

class OnboardingScreen extends StatelessWidget {
  const OnboardingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: AppGradientBackground(
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(18, 24, 18, 24),
              child: AppCard(
                padding: const EdgeInsets.fromLTRB(20, 22, 20, 20),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 52,
                      height: 52,
                      decoration: BoxDecoration(
                        color: AppColors.primaryAccent.withValues(alpha: 0.14),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color:
                              AppColors.primaryAccent.withValues(alpha: 0.22),
                        ),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(10),
                        child: Image.asset(
                          'assets/app/qibla_icon.png',
                          fit: BoxFit.contain,
                          errorBuilder: (context, error, stackTrace) {
                            return const Icon(
                              Icons.explore_outlined,
                              color: AppColors.primaryAccent,
                            );
                          },
                        ),
                      ),
                    ),
                    const SizedBox(height: 18),
                    Text(
                      'HAKAI’ye hoş geldin',
                      style:
                          Theme.of(context).textTheme.headlineSmall?.copyWith(
                                fontWeight: FontWeight.w800,
                              ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      'HAKAI’yi hesap oluşturmadan da kullanabilirsin. HAKAI, Kur’an merkezli manevi rehberlik sunan günlük bir yol arkadaşıdır; Ayet Rehberi, Dinî Bilgiler ve diğer modüller misafir kullanımına açıktır.',
                      style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                            color: AppColors.textSecondary,
                          ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'Hesap oluşturmak ileride kayıtlı tercihler, favoriler, geçmiş ve ek hesap özellikleri için kullanılacaktır.',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    const SizedBox(height: AppSpacing.large),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton.icon(
                        onPressed: () => _continueAsGuest(context),
                        icon: const Icon(Icons.arrow_forward_rounded),
                        label: const Text('Misafir olarak devam et'),
                      ),
                    ),
                    const SizedBox(height: 10),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        onPressed: () => _goTo(context, AppRoutes.login),
                        icon: const Icon(Icons.login_rounded),
                        label: const Text('Giriş yap'),
                      ),
                    ),
                    const SizedBox(height: 10),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        onPressed: () => _goTo(context, AppRoutes.register),
                        icon: const Icon(Icons.person_add_alt_rounded),
                        label: const Text('Hesap oluştur'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _continueAsGuest(BuildContext context) async {
    await _markSeen(context);
    if (!context.mounted) return;
    Navigator.pushReplacementNamed(context, AppRoutes.home);
  }

  Future<void> _goTo(BuildContext context, String route) async {
    final navigator = Navigator.of(context);
    await _markSeen(context);
    if (!context.mounted) return;
    navigator.pushNamedAndRemoveUntil(AppRoutes.home, (route) => false);
    navigator.pushNamed(route);
  }

  Future<void> _markSeen(BuildContext context) {
    return context.read<SettingsController>().setAuthOnboardingSeen(true);
  }
}
