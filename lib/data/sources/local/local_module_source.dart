import 'dart:convert';

import 'package:flutter/services.dart';

import '../../../core/constants/app_constants.dart';
import '../../models/dua_item.dart';
import '../../models/surah_summary.dart';

class LocalModuleSource {
  Future<List<DuaItem>> loadDuas() async {
    final raw = await rootBundle.loadString(AppConstants.duasAsset);
    final data = jsonDecode(raw) as List<dynamic>;
    return data
        .map((item) => DuaItem.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<List<SurahSummary>> loadSurahSummaries() async {
    final details = await loadSurahDetails();
    return details;
  }

  Future<List<SurahDetail>> loadSurahDetails() async {
    final raw = await rootBundle.loadString(AppConstants.fullQuranTrAsset);
    final data = jsonDecode(raw) as List<dynamic>;
    return data
        .map((item) => SurahDetail.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<SurahDetail?> loadSurahDetail(int surahNumber) async {
    final surahs = await loadSurahDetails();
    for (final surah in surahs) {
      if (surah.number == surahNumber) {
        return surah;
      }
    }
    return null;
  }
}
