import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/constants/app_constants.dart';
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
                      'Rehberlik, duruma göre ayet önerisi, favoriler, namaz vakitleri ve temel ezber takibini sakin bir deneyimde bir araya getirir.',
                    ),
                    const SizedBox(height: 10),
                    const Text(
                      'Dini hüküm veya fetva üretmez; ayet metinleri yerel veri havuzundan gelir.',
                    ),
                    const SizedBox(height: 10),
                    const Text(
                      'Logo hazırlığı: açık Kur’an/kitap ve sade geometrik motif; koyu yeşil, sıcak altın ve bej paleti.',
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
