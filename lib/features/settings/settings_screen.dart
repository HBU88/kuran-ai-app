import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/constants/app_constants.dart';
import '../../core/constants/app_routes.dart';
import '../../shared/widgets/app_card.dart';
import 'settings_controller.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Ayarlar')),
      body: Consumer<SettingsController>(
        builder: (context, controller, _) {
          return ListView(
            padding: const EdgeInsets.fromLTRB(18, 8, 18, 28),
            children: [
              AppCard(
                padding: EdgeInsets.zero,
                child: Column(
                  children: [
                    SwitchListTile(
                      title: const Text('Koyu tema'),
                      subtitle: const Text('Daha sakin bir gece görünümü.'),
                      value: controller.darkThemeEnabled,
                      onChanged: controller.setDarkThemeEnabled,
                    ),
                    const Divider(height: 1),
                    SwitchListTile(
                      title: const Text('Bildirimler'),
                      subtitle: const Text('Namaz vakti tercihlerini saklar.'),
                      value: controller.notificationsEnabled,
                      onChanged: controller.setNotificationsEnabled,
                    ),
                    const Divider(height: 1),
                    SwitchListTile(
                      title: const Text('Konum kullanımı'),
                      subtitle: const Text(
                        'MVP şehir bazlıdır; GPS akışı sonraki sürüme hazırdır.',
                      ),
                      value: controller.locationEnabled,
                      onChanged: controller.setLocationEnabled,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              AppCard(
                padding: EdgeInsets.zero,
                child: ListTile(
                  leading: const Icon(Icons.person_outline_rounded),
                  title: const Text('Hesap'),
                  subtitle: const Text(
                    'İsteğe bağlı giriş, kayıt ve çıkış işlemleri.',
                  ),
                  trailing: const Icon(Icons.chevron_right_rounded),
                  onTap: () => Navigator.pushNamed(context, AppRoutes.account),
                ),
              ),
              const SizedBox(height: 18),
              AppCard(
                padding: EdgeInsets.zero,
                child: Column(
                  children: [
                    ListTile(
                      leading: const Icon(Icons.privacy_tip_outlined),
                      title: const Text('Gizlilik Politikası'),
                      trailing: const Icon(Icons.chevron_right_rounded),
                      onTap: () =>
                          Navigator.pushNamed(context, AppRoutes.privacy),
                    ),
                    const Divider(height: 1),
                    ListTile(
                      leading: const Icon(Icons.description_outlined),
                      title: const Text('Kullanım Şartları'),
                      trailing: const Icon(Icons.chevron_right_rounded),
                      onTap: () =>
                          Navigator.pushNamed(context, AppRoutes.terms),
                    ),
                    const Divider(height: 1),
                    ListTile(
                      leading: const Icon(Icons.psychology_alt_outlined),
                      title: const Text('Dinî İçerik ve Yapay Zekâ Açıklaması'),
                      trailing: const Icon(Icons.chevron_right_rounded),
                      onTap: () =>
                          Navigator.pushNamed(context, AppRoutes.disclaimer),
                    ),
                    const Divider(height: 1),
                    ListTile(
                      leading: const Icon(Icons.manage_accounts_outlined),
                      title: const Text('Hesap ve Verilerim'),
                      trailing: const Icon(Icons.chevron_right_rounded),
                      onTap: () =>
                          Navigator.pushNamed(context, AppRoutes.dataAccount),
                    ),
                    const Divider(height: 1),
                    ListTile(
                      leading: const Icon(Icons.info_outline_rounded),
                      title: const Text('Hakkında ve Kaynaklar'),
                      trailing: const Icon(Icons.chevron_right_rounded),
                      onTap: () => Navigator.pushNamed(
                        context,
                        AppRoutes.aboutSources,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              AppCard(
                padding: EdgeInsets.zero,
                child: ListTile(
                  leading: const Icon(Icons.volunteer_activism_outlined),
                  title: const Text('HAKAI’yi Destekle'),
                  subtitle: const Text(
                    'İleride tek seferlik katkıyla projeyi destekleme alanı.',
                  ),
                  trailing: const Icon(Icons.chevron_right_rounded),
                  onTap: () => Navigator.pushNamed(context, AppRoutes.support),
                ),
              ),
              const SizedBox(height: 18),
              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      AppConstants.appName,
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                    const SizedBox(height: 6),
                    const Text(AppConstants.appTagline),
                    const SizedBox(height: 10),
                    const Text(
                      'HAKAI, Kur’an merkezli manevi rehberlik sunan günlük bir yol arkadaşıdır.',
                    ),
                    const SizedBox(height: 10),
                    const Text(
                      'Dinî Bilgiler alanı pratik ilmihal bilgisini ölçülü ve bağlama duyarlı bir dille sunar.',
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
