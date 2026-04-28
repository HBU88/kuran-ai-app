import 'package:flutter/foundation.dart';

import '../../data/models/ayah_model.dart';
import '../../data/repositories/ayah_repository.dart';
import '../../data/repositories/favorites_repository.dart';

class FavoritesController extends ChangeNotifier {
  FavoritesController(this._favoritesRepository, this._ayahRepository);

  final FavoritesRepository _favoritesRepository;
  final AyahRepository _ayahRepository;

  List<AyahModel> favorites = [];
  bool loading = false;

  bool isFavorite(int ayahId) => _favoritesRepository.isFavorite(ayahId);

  Future<void> load() async {
    loading = true;
    notifyListeners();

    final records = _favoritesRepository.getFavorites();
    final loaded = <AyahModel>[];
    for (final record in records) {
      final ayah = await _ayahRepository.getById(record.ayahId);
      if (ayah != null) {
        loaded.add(ayah);
      }
    }

    favorites = loaded.reversed.toList();
    loading = false;
    notifyListeners();
  }

  Future<void> toggle(AyahModel ayah) async {
    await _favoritesRepository.toggleFavorite(ayah.id);
    await load();
  }

  Future<void> remove(int ayahId) async {
    await _favoritesRepository.removeFavorite(ayahId);
    await load();
  }
}
