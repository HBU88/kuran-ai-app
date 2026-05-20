import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app.dart';
import 'core/constants/app_constants.dart';
import 'core/utils/notification_helper.dart';
import 'data/repositories/ayah_repository.dart';
import 'data/repositories/favorites_repository.dart';
import 'data/repositories/memorization_repository.dart';
import 'data/repositories/prayer_repository.dart';
import 'data/repositories/settings_repository.dart';
import 'data/services/habit_tracking_service.dart';
import 'data/services/religious_chat_limit_service.dart';
import 'data/sources/local/local_ayah_source.dart';
import 'data/sources/remote/ai_service.dart';
import 'data/sources/remote/auth_service.dart';
import 'data/sources/remote/prayer_api_service.dart';
import 'features/auth/auth_controller.dart';
import 'features/favorites/favorites_controller.dart';
import 'features/memorization/memorization_controller.dart';
import 'features/prayer_times/prayer_times_controller.dart';
import 'features/settings/settings_controller.dart';
import 'features/situation_ayah/situation_ayah_controller.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  debugPrint(AppConstants.startupApiBaseUrlLogLine);

  final preferences = await SharedPreferences.getInstance();
  final localSource = LocalAyahSource();
  final ayahRepository = AyahRepository(localSource, preferences);
  final favoritesRepository = FavoritesRepository(preferences);
  final prayerRepository = PrayerRepository(PrayerApiService(), preferences);
  final memorizationRepository =
      MemorizationRepository(localSource, preferences);
  final settingsRepository = SettingsRepository(preferences);
  final habitTrackingService = HabitTrackingService(preferences);
  final religiousChatLimitService = ReligiousChatLimitService(preferences);
  final notificationHelper = NotificationHelper(
    FlutterLocalNotificationsPlugin(),
  );

  try {
    await notificationHelper.initialize();
  } catch (error, stackTrace) {
    debugPrint('HAKAI_STARTUP notification_init_failed=$error');
    FlutterError.reportError(
      FlutterErrorDetails(
        exception: error,
        stack: stackTrace,
        library: 'HAKAI startup',
        context: ErrorDescription('initializing notifications'),
      ),
    );
  }
  try {
    await habitTrackingService.trackAppOpen();
  } catch (error) {
    debugPrint('HAKAI_STARTUP habit_tracking_failed=$error');
  }

  runApp(
    MultiProvider(
      providers: [
        Provider.value(value: ayahRepository),
        Provider.value(value: favoritesRepository),
        Provider.value(value: prayerRepository),
        Provider.value(value: memorizationRepository),
        Provider.value(value: settingsRepository),
        Provider.value(value: notificationHelper),
        Provider.value(value: habitTrackingService),
        Provider.value(value: religiousChatLimitService),
        ChangeNotifierProvider(
          create: (_) => AuthController(AuthService()),
        ),
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
