import 'package:shared_preferences/shared_preferences.dart';

class HabitTrackingService {
  const HabitTrackingService(this._preferences);

  final SharedPreferences _preferences;

  static const _counterPrefix = 'habit_counter_';
  static const _lastSeenPrefix = 'habit_last_seen_';
  static const _tagCounterPrefix = 'habit_tag_counter_';

  Future<void> trackAppOpen() => _track('app_open');
  Future<void> trackDailyAyahView() => _track('daily_ayah_view');
  Future<void> trackChatMessageSent([String? topicOrTag]) =>
      _track('chat_message_sent', topicOrTag: topicOrTag);
  Future<void> trackChatResponseSuccess() => _track('chat_response_success');
  Future<void> trackChatResponseError() => _track('chat_response_error');
  Future<void> trackQiblaOpen() => _track('qibla_open');
  Future<void> trackPrayerTimesOpen() => _track('prayer_times_open');
  Future<void> trackSupportScreenOpen() => _track('support_screen_open');
  Future<void> trackSupportPurchaseTapped() =>
      _track('support_purchase_tapped');
  Future<void> trackFavoriteAdded() => _track('favorite_added');
  Future<void> trackShareAyahTapped() => _track('share_ayah_tapped');

  Future<void> _track(String eventName, {String? topicOrTag}) async {
    final counterKey = '$_counterPrefix$eventName';
    final lastSeenKey = '$_lastSeenPrefix$eventName';
    await _preferences.setInt(
      counterKey,
      (_preferences.getInt(counterKey) ?? 0) + 1,
    );
    await _preferences.setString(lastSeenKey, DateTime.now().toIso8601String());

    final safeTag = _safeTag(topicOrTag);
    if (safeTag == null) return;

    // Local-only, coarse tag counters for future retention timing. Do not store
    // raw chat messages or infer sensitive religious advertising profiles.
    final tagCounterKey = '$_tagCounterPrefix${eventName}_$safeTag';
    await _preferences.setInt(
      tagCounterKey,
      (_preferences.getInt(tagCounterKey) ?? 0) + 1,
    );
  }

  String? _safeTag(String? value) {
    final normalized = value?.trim().toLowerCase();
    if (normalized == null || normalized.isEmpty) return null;
    final sanitized = normalized
        .replaceAll(RegExp(r'[^a-z0-9ğüşöçıİ\s_-]', caseSensitive: false), '')
        .replaceAll(RegExp(r'\s+'), '_');
    if (sanitized.isEmpty) return null;
    return sanitized.length > 40 ? sanitized.substring(0, 40) : sanitized;
  }
}
