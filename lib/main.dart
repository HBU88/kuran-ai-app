import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app.dart';
import 'core/utils/notification_helper.dart';
import 'data/repositories/ayah_repository.dart';
import 'data/repositories/favorites_repository.dart';
import 'data/repositories/memorization_repository.dart';
import 'data/repositories/prayer_repository.dart';
import 'data/repositories/settings_repository.dart';
import 'data/sources/local/local_ayah_source.dart';
import 'data/sources/remote/ai_service.dart';
import 'data/sources/remote/prayer_api_service.dart';
import 'features/favorites/favorites_controller.dart';
import 'features/memorization/memorization_controller.dart';
import 'features/prayer_times/prayer_times_controller.dart';
import 'features/settings/settings_controller.dart';
import 'features/situation_ayah/situation_ayah_controller.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final preferences = await SharedPreferences.getInstance();
  final localSource = LocalAyahSource();
  final ayahRepository = AyahRepository(localSource, preferences);
  final favoritesRepository = FavoritesRepository(preferences);
  final prayerRepository = PrayerRepository(PrayerApiService(), preferences);
  final memorizationRepository =
      MemorizationRepository(localSource, preferences);
  final settingsRepository = SettingsRepository(preferences);
  final notificationHelper = NotificationHelper(
    FlutterLocalNotificationsPlugin(),
  );

  await notificationHelper.initialize();

  runApp(
    MultiProvider(
      providers: [
        Provider.value(value: ayahRepository),
        Provider.value(value: favoritesRepository),
        Provider.value(value: prayerRepository),
        Provider.value(value: memorizationRepository),
        Provider.value(value: settingsRepository),
        Provider.value(value: notificationHelper),
        ChangeNotifierProvider(
          create: (_) =>
              FavoritesController(favoritesRepository, ayahRepository)..load(),
        ),
        ChangeNotifierProvider(
          create: (_) => SituationAyahController(
            ayahRepository,
            const AiService(),
          ),
        ),
        ChangeNotifierProvider(
          create: (_) => PrayerTimesController(prayerRepository)..load(),
        ),
        ChangeNotifierProvider(
          create: (_) => MemorizationController(memorizationRepository)..load(),
        ),
        ChangeNotifierProvider(
          create: (_) => SettingsController(settingsRepository)..load(),
        ),
      ],
      child: const QuranMvpApp(),
    ),
  );
}
