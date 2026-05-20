import 'package:shared_preferences/shared_preferences.dart';

import '../../core/constants/app_constants.dart';

class ReligiousChatLimitService {
  const ReligiousChatLimitService(this._preferences);

  static const freeAnswerLimit = 5;

  final SharedPreferences _preferences;

  int get freeAnswersUsed =>
      _preferences.getInt(AppConstants.religiousChatFreeUsageStorageKey) ?? 0;

  int get freeAnswersRemaining {
    final remaining = freeAnswerLimit - freeAnswersUsed;
    return remaining > 0 ? remaining : 0;
  }

  bool get hasFreeAnswerRemaining => freeAnswersRemaining > 0;

  Future<int> recordFreeAnswerUsed() async {
    final next = (freeAnswersUsed + 1).clamp(0, freeAnswerLimit);
    await _preferences.setInt(
      AppConstants.religiousChatFreeUsageStorageKey,
      next,
    );
    return next;
  }
}
