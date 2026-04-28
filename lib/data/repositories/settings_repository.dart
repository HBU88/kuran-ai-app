import 'package:shared_preferences/shared_preferences.dart';

import '../../core/constants/app_constants.dart';

class SettingsRepository {
  SettingsRepository(this._preferences);

  final SharedPreferences _preferences;

  bool get darkThemeEnabled =>
      _preferences.getBool(AppConstants.darkThemeStorageKey) ?? false;

  bool get notificationsEnabled =>
      _preferences.getBool(AppConstants.notificationEnabledStorageKey) ?? false;

  bool get locationEnabled =>
      _preferences.getBool(AppConstants.locationEnabledStorageKey) ?? false;

  Future<void> setDarkThemeEnabled(bool enabled) async {
    await _preferences.setBool(AppConstants.darkThemeStorageKey, enabled);
  }

  Future<void> setNotificationsEnabled(bool enabled) async {
    await _preferences.setBool(
      AppConstants.notificationEnabledStorageKey,
      enabled,
    );
  }

  Future<void> setLocationEnabled(bool enabled) async {
    await _preferences.setBool(AppConstants.locationEnabledStorageKey, enabled);
  }
}
