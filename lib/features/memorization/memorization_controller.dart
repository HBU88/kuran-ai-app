import 'package:flutter/foundation.dart';

import '../../data/models/memorization_model.dart';
import '../../data/repositories/memorization_repository.dart';

class MemorizationController extends ChangeNotifier {
  MemorizationController(this._repository);

  final MemorizationRepository _repository;

  List<MemorizationSurah> surahs = [];
  Map<int, MemorizationProgress> progress = {};
  MemorizationSurah? selectedSurah;
  bool loading = false;

  Future<void> load() async {
    loading = true;
    notifyListeners();

    surahs = await _repository.getSurahs();
    progress = _repository.getProgress();
    selectedSurah ??= surahs.isEmpty ? null : surahs.first;

    loading = false;
    notifyListeners();
  }

  void selectSurah(MemorizationSurah surah) {
    selectedSurah = surah;
    notifyListeners();
  }

  MemorizationProgress progressFor(MemorizationSurah surah) {
    return progress[surah.id] ?? MemorizationProgress.empty(surah.id);
  }

  Future<void> markReviewed() async {
    final surah = selectedSurah;
    if (surah == null) {
      return;
    }
    final updated = await _repository.markReviewed(surah: surah);
    progress = {...progress, surah.id: updated};
    notifyListeners();
  }
}
