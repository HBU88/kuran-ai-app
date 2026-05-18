import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'core/constants/app_constants.dart';
import 'core/constants/app_routes.dart';
import 'features/chat/chat_screen.dart';
import 'features/favorites/favorites_screen.dart';
import 'features/home/home_screen.dart';
import 'features/prayer_times/prayer_times_screen.dart';
import 'features/qibla/qibla_screen.dart';
import 'features/settings/settings_controller.dart';
import 'features/settings/settings_screen.dart';
import 'features/situation_ayah/situation_ayah_screen.dart';
import 'features/splash/splash_screen.dart';
import 'theme/app_theme.dart';

class QuranMvpApp extends StatelessWidget {
  const QuranMvpApp({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<SettingsController>(
      builder: (context, settings, _) {
        return MaterialApp(
          debugShowCheckedModeBanner: false,
          title: AppConstants.appName,
          theme: AppTheme.light(),
          darkTheme: AppTheme.dark(),
          themeMode:
              settings.darkThemeEnabled ? ThemeMode.dark : ThemeMode.light,
          initialRoute: AppRoutes.splash,
          routes: {
            AppRoutes.splash: (_) => const SplashScreen(),
            AppRoutes.home: (_) => const HomeScreen(),
            AppRoutes.chat: (_) => const ChatScreen(),
            AppRoutes.situationAyah: (_) => const SituationAyahScreen(),
            AppRoutes.favorites: (_) => const FavoritesScreen(),
            AppRoutes.prayerTimes: (_) => const PrayerTimesScreen(),
            AppRoutes.qibla: (_) => const QiblaScreen(),
            AppRoutes.settings: (_) => const SettingsScreen(),
          },
        );
      },
    );
  }
}
