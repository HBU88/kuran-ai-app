import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../../core/constants/app_constants.dart';
import '../models/favorite_record.dart';

class FavoritesRepository {
  FavoritesRepository(this._preferences);

  final SharedPreferences _preferences;

  List<FavoriteRecord> getFavorites() {
    final raw = _preferences.getString(AppConstants.favoriteStorageKey);
    if (raw == null || raw.isEmpty) {
      return [];
    }

    final decoded = jsonDecode(raw) as List<dynamic>;
    return decoded
        .map((item) => FavoriteRecord.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<void> toggleFavorite(int ayahId) async {
    final favorites = getFavorites().toList();
    final index = favorites.indexWhere((item) => item.ayahId == ayahId);
    if (index >= 0) {
      favorites.removeAt(index);
    } else {
      favorites.add(FavoriteRecord(ayahId: ayahId, savedAt: DateTime.now()));
    }
    await _save(favorites);
  }

  Future<void> removeFavorite(int ayahId) async {
    final favorites =
        getFavorites().where((item) => item.ayahId != ayahId).toList();
    await _save(favorites);
  }

  bool isFavorite(int ayahId) {
    return getFavorites().any((item) => item.ayahId == ayahId);
  }

  Future<void> _save(List<FavoriteRecord> records) async {
    final raw = jsonEncode(records.map((item) => item.toJson()).toList());
    await _preferences.setString(AppConstants.favoriteStorageKey, raw);
  }
}
