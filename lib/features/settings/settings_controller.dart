import 'package:flutter/foundation.dart';

import '../../data/repositories/settings_repository.dart';

class SettingsController extends ChangeNotifier {
  SettingsController(this._repository);

  final SettingsRepository _repository;

  bool darkThemeEnabled = false;
  bool notificationsEnabled = false;
  bool locationEnabled = false;

  void load() {
    darkThemeEnabled = _repository.darkThemeEnabled;
    notificationsEnabled = _repository.notificationsEnabled;
    locationEnabled = _repository.locationEnabled;
    notifyListeners();
  }

  Future<void> setDarkThemeEnabled(bool enabled) async {
    darkThemeEnabled = enabled;
    await _repository.setDarkThemeEnabled(enabled);
    notifyListeners();
  }

  Future<void> setNotificationsEnabled(bool enabled) async {
    notificationsEnabled = enabled;
    await _repository.setNotificationsEnabled(enabled);
    notifyListeners();
  }

  Future<void> setLocationEnabled(bool enabled) async {
    locationEnabled = enabled;
    await _repository.setLocationEnabled(enabled);
    notifyListeners();
  }
}
