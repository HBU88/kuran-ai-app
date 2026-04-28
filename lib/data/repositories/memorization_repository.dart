import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../../core/constants/app_constants.dart';
import '../models/memorization_model.dart';
import '../sources/local/local_ayah_source.dart';

class MemorizationRepository {
  MemorizationRepository(this._source, this._preferences);

  final LocalAyahSource _source;
  final SharedPreferences _preferences;

  Future<List<MemorizationSurah>> getSurahs() {
    return _source.loadSurahs();
  }

  Map<int, MemorizationProgress> getProgress() {
    final raw = _preferences.getString(AppConstants.memorizationStorageKey);
    if (raw == null || raw.isEmpty) {
      return {};
    }

    final decoded = jsonDecode(raw) as List<dynamic>;
    final progress = <int, MemorizationProgress>{};
    for (final item in decoded) {
      final record =
          MemorizationProgress.fromJson(item as Map<String, dynamic>);
      progress[record.surahId] = record;
    }
    return progress;
  }

  Future<MemorizationProgress> markReviewed({
    required MemorizationSurah surah,
  }) async {
    final all = getProgress();
    final current = all[surah.id] ?? MemorizationProgress.empty(surah.id);
    final completed =
        (current.completedAyahCount + 1).clamp(0, surah.ayahs.length).toInt();
    final updated = current.copyWith(
      completedAyahCount: completed,
      lastReviewedAt: DateTime.now(),
      repetitionCount: current.repetitionCount + 1,
    );
    all[surah.id] = updated;
    await _save(all.values.toList());
    return updated;
  }

  Future<void> _save(List<MemorizationProgress> progress) async {
    final raw = jsonEncode(progress.map((item) => item.toJson()).toList());
    await _preferences.setString(AppConstants.memorizationStorageKey, raw);
  }
}
