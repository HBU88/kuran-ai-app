import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../../core/constants/app_constants.dart';
import '../../core/utils/date_utils.dart' as app_date_utils;
import '../models/ayah_model.dart';
import '../models/situation_intent_model.dart';
import '../sources/local/local_ayah_source.dart';

class AyahRepository {
  AyahRepository(this._source, this._preferences);

  final LocalAyahSource _source;
  final SharedPreferences _preferences;
  List<AyahModel>? _cache;

  Future<List<AyahModel>> getAllAyahs() async {
    _cache ??= await _source.loadAyahs();
    return _cache!;
  }

  Future<AyahModel> getTodayAyah(DateTime date) async {
    final ayahs = await getAllAyahs();
    final index = app_date_utils.dayOfYear(date) % ayahs.length;
    return ayahs[index];
  }

  Future<AyahModel?> getById(int id) async {
    final ayahs = await getAllAyahs();
    for (final ayah in ayahs) {
      if (ayah.id == id) {
        return ayah;
      }
    }
    return null;
  }

  Future<AyahModel> findByTags(List<String> tags, {String? seedText}) async {
    final result = await selectByTags(tags, normalizedInput: seedText ?? '');
    return result.ayah;
  }

  Future<AyahSelectionResult> selectByTags(
    List<String> tags, {
    required String normalizedInput,
  }) async {
    final analysis = SituationIntentAnalysis(
      rawInput: normalizedInput,
      normalizedInput: normalizedInput,
      primaryTheme: tags.isEmpty ? 'umut' : tags.first,
      secondaryThemes: tags.skip(1).toList(),
      emotion: tags.isEmpty ? 'umut' : tags.first,
      severity: 'medium',
      confidence: 0.4,
      aiEnabled: false,
      matchedKeywords: const [],
      themeScores: {
        for (final tag in tags) tag: tag == tags.first ? 10 : 4,
      },
    );
    return selectByIntent(analysis);
  }

  Future<AyahSelectionResult> selectByIntent(
    SituationIntentAnalysis analysis,
  ) async {
    final ayahs = await getAllAyahs();
    final safeInput = analysis.normalizedInput.toLowerCase().trim();
    final inputHash = safeInput.hashCode.abs();
    final primaryCandidates = _rankForIntent(
      ayahs: ayahs,
      analysis: analysis,
      primaryOnly: true,
    );
    var candidates = _rankForIntent(
      ayahs: ayahs,
      analysis: analysis,
      primaryOnly: false,
    );
    var usedAllAyahsFallback = false;
    final effectiveTheme = analysis.primaryTheme;

    if (candidates.isEmpty) {
      candidates = _rankForTag(ayahs, 'umut');
      usedAllAyahsFallback = true;
    }

    final history = _readThemeHistory();
    final shownBefore = List<int>.from(history[effectiveTheme] ?? const []);
    final topCandidates = candidates.take(3).toList();
    var remaining = topCandidates.where((ayah) {
      return !shownBefore.contains(ayah.id);
    }).toList();
    var resetHistoryForTheme = false;

    if (remaining.isEmpty) {
      history[effectiveTheme] = [];
      remaining = topCandidates.isEmpty ? candidates : topCandidates;
      resetHistoryForTheme = true;
    }

    final selectedAyah = remaining.first;
    final selectedIndex = candidates.indexWhere((ayah) {
      return ayah.id == selectedAyah.id;
    });
    final updatedHistory = [
      ...(history[effectiveTheme] ?? const <int>[]),
      selectedAyah.id,
    ];
    history[effectiveTheme] = updatedHistory;
    await _saveThemeHistory(history);

    return AyahSelectionResult(
      ayah: selectedAyah,
      primaryCandidateAyahIds:
          primaryCandidates.map((ayah) => ayah.id).toList(),
      candidateAyahIds: topCandidates.map((ayah) => ayah.id).toList(),
      shownHistoryAyahIds: shownBefore,
      updatedShownHistoryAyahIds: updatedHistory,
      inputHash: inputHash,
      selectedIndex: selectedIndex,
      usedSecondaryCandidates: false,
      usedAllAyahsFallback: usedAllAyahsFallback,
      resetHistoryForTheme: resetHistoryForTheme,
    );
  }

  List<AyahModel> _rankForTag(List<AyahModel> ayahs, String tag) {
    final ranked = ayahs.where((ayah) {
      return ayah.tags.contains(tag);
    }).toList();

    ranked.sort((a, b) {
      final aTagIndex = a.tags.indexOf(tag);
      final bTagIndex = b.tags.indexOf(tag);
      final tagComparison = aTagIndex.compareTo(bTagIndex);
      if (tagComparison != 0) {
        return tagComparison;
      }
      final lengthComparison = a.tags.length.compareTo(b.tags.length);
      if (lengthComparison != 0) {
        return lengthComparison;
      }
      return a.id.compareTo(b.id);
    });

    return ranked;
  }

  List<AyahModel> _rankForIntent({
    required List<AyahModel> ayahs,
    required SituationIntentAnalysis analysis,
    required bool primaryOnly,
  }) {
    final themeWeights = <String, int>{analysis.primaryTheme: 100};
    if (!primaryOnly) {
      for (var i = 0; i < analysis.secondaryThemes.length; i++) {
        themeWeights[analysis.secondaryThemes[i]] = 48 - (i * 8);
      }
    }

    final scored = <_ScoredAyah>[];
    for (final ayah in ayahs) {
      var score = 0;
      final searchableText = _normalizeForSearch(
        [
          ayah.surahNameTr,
          ayah.textTr,
          ayah.shortExplanation,
          ayah.tags.join(' '),
        ].join(' '),
      );
      for (final entry in themeWeights.entries) {
        final mappedTags = _datasetTagsForTheme(entry.key);
        for (var i = 0; i < ayah.tags.length; i++) {
          final tag = ayah.tags[i];
          final mappedIndex = mappedTags.indexOf(tag);
          if (mappedIndex == -1) {
            continue;
          }
          score += entry.value - (mappedIndex * 8) - (i * 3);
        }
        score += _textSignalBoost(
          searchableText: searchableText,
          theme: entry.key,
          weight: entry.value,
        );
      }

      score += _emotionBoost(ayah, analysis.emotion);
      score += _matchedPhraseBoost(
        searchableText: searchableText,
        matchedKeywords: analysis.matchedKeywords,
      );
      if (analysis.severity == 'high') {
        if (ayah.tags.contains('umut')) {
          score += 18;
        }
        if (ayah.tags.contains('sabır')) {
          score += 14;
        }
        if (ayah.tags.contains('tevekkül')) {
          score += 8;
        }
      }

      if (score > 0) {
        scored.add(_ScoredAyah(ayah: ayah, score: score));
      }
    }

    scored.sort((a, b) {
      final scoreComparison = b.score.compareTo(a.score);
      if (scoreComparison != 0) {
        return scoreComparison;
      }
      return a.ayah.id.compareTo(b.ayah.id);
    });

    return scored.map((entry) => entry.ayah).toList();
  }

  int _emotionBoost(AyahModel ayah, String emotion) {
    switch (emotion) {
      case 'korku':
        return ayah.tags.contains('korku') ? 20 : 0;
      case 'yalnızlık':
        return ayah.tags.contains('yalnızlık') ? 20 : 0;
      case 'pişmanlık':
        return ayah.tags.contains('tövbe') ? 20 : 0;
      case 'hastalık':
        return ayah.tags.contains('sabır') || ayah.tags.contains('umut')
            ? 18
            : 0;
      case 'bunalmış':
        return ayah.tags.contains('tevekkül') || ayah.tags.contains('umut')
            ? 18
            : 0;
      default:
        return 0;
    }
  }

  List<String> _datasetTagsForTheme(String theme) {
    const aliases = {
      'sabır': ['sabır', 'sebat', 'umut'],
      'umut': ['umut', 'tevekkül', 'sabır'],
      'tevekkül': ['tevekkül', 'umut', 'sabır'],
      'tövbe': ['tövbe', 'umut', 'irade'],
      'şükür': ['şükür', 'umut', 'tevekkül'],
      'korku': ['korku', 'tevekkül', 'umut'],
      'yalnızlık': ['yalnızlık', 'umut', 'tevekkül'],
      'irade': ['irade', 'sebat', 'tövbe'],
      'sebat': ['sebat', 'sabır', 'irade'],
      'affetmek': ['affetmek', 'sabır', 'tövbe'],
      'şifa': ['sabır', 'umut', 'tevekkül'],
      'hastalık': ['sabır', 'umut', 'tevekkül'],
      'kaygı': ['korku', 'tevekkül', 'umut'],
      'çaresizlik': ['umut', 'tevekkül', 'sabır'],
      'bağışlanma': ['tövbe', 'umut'],
      'nefs mücadelesi': ['irade', 'sebat', 'tövbe'],
      'ölüm korkusu': ['korku', 'tevekkül', 'umut'],
      'aile': ['sabır', 'affetmek', 'tevekkül'],
      'rızık': ['tevekkül', 'şükür', 'umut'],
      'imtihan': ['sabır', 'sebat', 'tevekkül'],
    };
    return aliases[theme] ?? [theme, 'umut'];
  }

  int _textSignalBoost({
    required String searchableText,
    required String theme,
    required int weight,
  }) {
    final signals = _textSignalsForTheme(theme);
    var boost = 0;
    for (final signal in signals) {
      if (searchableText.contains(_normalizeForSearch(signal))) {
        boost += (weight / 5).round();
      }
    }
    return boost.clamp(0, 36);
  }

  int _matchedPhraseBoost({
    required String searchableText,
    required List<String> matchedKeywords,
  }) {
    var boost = 0;
    for (final keyword in matchedKeywords) {
      final normalizedKeyword = _normalizeForSearch(keyword);
      for (final token in normalizedKeyword.split(' ')) {
        if (token.length < 4) {
          continue;
        }
        if (searchableText.contains(token)) {
          boost += 3;
        }
      }
    }
    return boost.clamp(0, 18);
  }

  List<String> _textSignalsForTheme(String theme) {
    const signals = {
      'sabır': ['sabır', 'zorluk', 'imtihan', 'dayan', 'yardım'],
      'umut': ['umut', 'kolaylık', 'rahmet', 'yakın', 'müjde'],
      'tevekkül': ['güven', 'allah', 'emanet', 'yakın', 'dua'],
      'tövbe': ['tövbe', 'bağış', 'rahmet', 'dönüş', 'pişman'],
      'şükür': ['şükür', 'nimet', 'hamd', 'teşekkür'],
      'korku': ['korku', 'emniyet', 'sığınak', 'yakın'],
      'yalnızlık': ['yalnız', 'yakın', 'dua', 'rahmet'],
      'irade': ['irade', 'nefs', 'mücadele', 'tercih'],
      'sebat': ['sebat', 'sabit', 'devam', 'istikamet'],
      'affetmek': ['aff', 'öfke', 'merhamet', 'adalet'],
      'şifa': ['şifa', 'hastalık', 'sabır', 'rahmet'],
      'hastalık': ['hastalık', 'şifa', 'sabır', 'imtihan'],
      'kaygı': ['korku', 'sakin', 'dua', 'güven'],
      'çaresizlik': ['yardım', 'kolaylık', 'umut', 'dua'],
      'bağışlanma': ['bağış', 'tövbe', 'rahmet', 'dönüş'],
      'nefs mücadelesi': ['nefs', 'irade', 'mücadele', 'sebat'],
      'ölüm korkusu': ['korku', 'dönüş', 'allah', 'emniyet'],
      'aile': ['sabır', 'merhamet', 'aff', 'adalet'],
      'rızık': ['rızık', 'nimet', 'tevekkül', 'şükür'],
      'imtihan': ['imtihan', 'musibet', 'sabır', 'zorluk'],
    };
    return signals[theme] ?? const [];
  }

  String _normalizeForSearch(String value) {
    return value
        .trim()
        .replaceAll('\u00A0', ' ')
        .replaceAll('İ', 'i')
        .replaceAll('I', 'ı')
        .toLowerCase()
        .replaceAll('\u0307', '')
        .replaceAll(RegExp(r'\s+'), ' ');
  }

  Map<String, List<int>> _readThemeHistory() {
    final raw = _preferences.getString(
      AppConstants.situationAyahHistoryStorageKey,
    );
    if (raw == null || raw.isEmpty) {
      return {};
    }

    final decoded = jsonDecode(raw) as Map<String, dynamic>;
    return decoded.map((key, value) {
      return MapEntry(key, List<int>.from(value as List<dynamic>));
    });
  }

  Future<void> _saveThemeHistory(Map<String, List<int>> history) async {
    await _preferences.setString(
      AppConstants.situationAyahHistoryStorageKey,
      jsonEncode(history),
    );
  }
}

class AyahSelectionResult {
  const AyahSelectionResult({
    required this.ayah,
    required this.primaryCandidateAyahIds,
    required this.candidateAyahIds,
    required this.shownHistoryAyahIds,
    required this.updatedShownHistoryAyahIds,
    required this.inputHash,
    required this.selectedIndex,
    required this.usedSecondaryCandidates,
    required this.usedAllAyahsFallback,
    required this.resetHistoryForTheme,
  });

  final AyahModel ayah;
  final List<int> primaryCandidateAyahIds;
  final List<int> candidateAyahIds;
  final List<int> shownHistoryAyahIds;
  final List<int> updatedShownHistoryAyahIds;
  final int inputHash;
  final int selectedIndex;
  final bool usedSecondaryCandidates;
  final bool usedAllAyahsFallback;
  final bool resetHistoryForTheme;
}

class _ScoredAyah {
  const _ScoredAyah({
    required this.ayah,
    required this.score,
  });

  final AyahModel ayah;
  final int score;
}
