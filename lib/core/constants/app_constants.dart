class AppConstants {
  const AppConstants._();

  static const appName = 'HAKAI';
  static const backendApiBaseUrl = String.fromEnvironment(
    'HAKAI_API_BASE_URL',
    defaultValue: String.fromEnvironment(
      'HAKAI_CHAT_API_BASE_URL',
      defaultValue: '',
    ),
  );
  static const appTagline =
      'Kur’an merkezli manevi rehberlik sunan günlük bir yol arkadaşı';
  static const welcomeMessage =
      'Selam, HAKAI’ye hoş geldin. Kur’an merkezli manevi rehberlik ve pratik dinî bilgilerle yanında olabilirim.';
  static const connectionFallbackMessage =
      'Şu anda bağlantı kurulamadı. Lütfen tekrar deneyin.';
  static const logoAssetPlaceholder = 'assets/app/launcher_icon.png';
  static const defaultCity = 'Istanbul';
  static const defaultCountry = '';
  static const countryCode = defaultCountry;

  static const todayAyahAsset = 'assets/data/ayahs.json';
  static const surahAsset = 'assets/data/surahs.json';

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
}
