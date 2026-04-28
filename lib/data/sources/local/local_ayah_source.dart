import 'dart:convert';

import 'package:flutter/services.dart';

import '../../../core/constants/app_constants.dart';
import '../../models/ayah_model.dart';
import '../../models/memorization_model.dart';

class LocalAyahSource {
  Future<List<AyahModel>> loadAyahs() async {
    final raw = await rootBundle.loadString(AppConstants.todayAyahAsset);
    final data = jsonDecode(raw) as List<dynamic>;
    return data
        .map((item) => AyahModel.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<List<MemorizationSurah>> loadSurahs() async {
    final raw = await rootBundle.loadString(AppConstants.surahAsset);
    final data = jsonDecode(raw) as List<dynamic>;
    return data
        .map((item) => MemorizationSurah.fromJson(item as Map<String, dynamic>))
        .toList();
  }
}
