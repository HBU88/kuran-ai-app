import 'dart:io';

import 'package:flutter/foundation.dart';

class AppConstants {
  const AppConstants._();

  static const appName = 'HAKAI';
  static const productionBackendApiBaseUrl =
      'https://hakai-backend.onrender.com';
  static const backendApiBaseUrl = String.fromEnvironment(
    'HAKAI_API_BASE_URL',
    defaultValue: String.fromEnvironment(
      'HAKAI_CHAT_API_BASE_URL',
      defaultValue: '',
    ),
  );
  static const debugDisableUsageLimits = bool.fromEnvironment(
    'DEBUG_DISABLE_USAGE_LIMITS',
  );
  static String get resolvedBackendApiBaseUrl {
    final configured = backendApiBaseUrl.trim();
    if (configured.isEmpty) {
      if (kReleaseMode || Platform.isIOS) {
        return productionBackendApiBaseUrl;
      }
      return 'http://10.0.2.2:3000';
    }

    final uri = Uri.tryParse(configured);
    final host = uri?.host.toLowerCase() ?? '';
    final isLocalhost =
        host == 'localhost' || host == '127.0.0.1' || host == '10.0.2.2';
    if (kReleaseMode && isLocalhost) {
      return productionBackendApiBaseUrl;
    }
    return configured;
  }

  static String get startupApiBaseUrlLogLine =>
      'HAKAI_STARTUP api_base_url=$resolvedBackendApiBaseUrl';
  static const appTagline =
      'Kur’an merkezli manevi rehberlik sunan günlük bir yol arkadaşı';
  static const welcomeMessage =
      'Selam, HAKAI’ye hoş geldin. Kur’an merkezli manevi rehberlik ve pratik dinî bilgilerle yanında olabilirim.';
  static const connectionFallbackMessage =
      'Bağlantı kurulamadı. Lütfen internet bağlantınızı kontrol edip tekrar deneyin.';
  static const appShareLinkPlaceholder = 'https://hakai.app';
  // TODO: Native launcher icon assets are separate; regenerate iOS/Android
  // launcher assets only when the app icon direction is finalized.
  static const logoAssetPlaceholder = 'assets/app/qibla_icon.png';
  static const defaultCity = 'Istanbul';
  static const defaultCountry = '';
  static const countryCode = defaultCountry;

  static const todayAyahAsset = 'assets/data/ayahs.json';
  static const surahAsset = 'assets/data/surahs.json';
  static const fullQuranTrAsset = 'assets/data/full_quran/source_tr.json';
  static const duasAsset = 'assets/data/duas.json';

  static const favoriteStorageKey = 'favorite_ayah_records';
  static const selectedCityStorageKey = 'selected_city';
  static const notificationEnabledStorageKey = 'notification_enabled';
  static const locationEnabledStorageKey = 'location_enabled';
  static const selectedCountryIdStorageKey = 'selected_country_id';
  static const selectedCountryNameStorageKey = 'selected_country_name';
  static const selectedStateIdStorageKey = 'selected_state_id';
  static const selectedStateNameStorageKey = 'selected_state_name';
  static const selectedCityIdStorageKey = 'selected_city_id';
  static const selectedCityNameStorageKey = 'selected_city_name';
  static const darkThemeStorageKey = 'dark_theme_enabled';
  static const memorizationStorageKey = 'memorization_progress';
  static const situationAyahHistoryStorageKey = 'situation_ayah_history';
  static const authOnboardingSeenStorageKey = 'auth_onboarding_seen';
  static const religiousChatFreeUsageStorageKey =
      'religious_chat_free_usage_count';
}
