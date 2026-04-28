import '../../data/models/situation_intent_model.dart';

class SituationTagMapper {
  const SituationTagMapper._();

  static const samplePrompts = [
    'İyi değilim',
    'İçim daralıyor',
    'Çok yalnızım',
    'Allah beni affeder mi',
    'Alkolü bıraktım ama zorlanıyorum',
  ];

  static const supportedThemes = [
    'sabır',
    'umut',
    'tevekkül',
    'tövbe',
    'şükür',
    'korku',
    'yalnızlık',
    'irade',
    'sebat',
    'affetmek',
    'şifa',
    'hastalık',
    'kaygı',
    'çaresizlik',
    'bağışlanma',
    'nefs mücadelesi',
    'ölüm korkusu',
    'aile',
    'rızık',
    'imtihan',
  ];

  static const fallbackThemes = ['umut', 'tevekkül', 'sabır'];

  static SituationIntentAnalysis analyze(String input) {
    final normalizedInput = normalizeForMatching(input);
    final scores = <String, int>{};
    final matchedKeywords = <String>{};

    void scoreMatch(
      List<String> keywords,
      Map<String, int> weightedThemes,
    ) {
      for (final keyword in keywords) {
        final normalizedKeyword = normalizeForMatching(keyword);
        if (!normalizedInput.contains(normalizedKeyword)) {
          continue;
        }

        matchedKeywords.add(keyword);
        for (final entry in weightedThemes.entries) {
          scores[entry.key] = (scores[entry.key] ?? 0) + entry.value;
        }
      }
    }

    scoreMatch(
      [
        'iyi değilim',
        'kendimi iyi hissetmiyorum',
        'moralim bozuk',
        'çok kötüyüm',
        'kendimi kötü hissediyorum',
        'hiç iyi değilim',
        'mahvoldum',
        'çöktüm',
        'kalbim sıkışıyor',
        'yorgunum',
        'dayanamıyorum',
      ],
      {'umut': 9, 'sabır': 7, 'şifa': 4, 'çaresizlik': 3},
    );
    scoreMatch(
      [
        'çok hastayım',
        'hastayım',
        'hasta oldum',
        'acı çekiyorum',
        'ağrım var',
        'sağlığım kötü',
        'iyileşmek istiyorum',
        'doktor',
        'ameliyat',
        'hastane',
        'şifa istiyorum',
      ],
      {'şifa': 10, 'hastalık': 8, 'sabır': 5, 'umut': 4},
    );
    scoreMatch(
      [
        'içim daralıyor',
        'çok bunaldım',
        'bunaldım',
        'daralıyorum',
        'nefes alamıyorum',
        'sıkıldım',
        'içim sıkılıyor',
        'göğsüm daralıyor',
        'rahatlayamıyorum',
      ],
      {'kaygı': 10, 'tevekkül': 7, 'umut': 5, 'çaresizlik': 5},
    );
    scoreMatch(
      ['kaygı', 'kaygılıyım', 'endişe', 'endişeliyim', 'panik', 'stres'],
      {'kaygı': 9, 'tevekkül': 6, 'korku': 4, 'umut': 2},
    );
    scoreMatch(
      [
        'çok yalnızım',
        'yalnızım',
        'yalnız hissediyorum',
        'kimsem yok',
        'kimsesizim',
        'terk edildim',
        'kimse beni anlamıyor',
        'yanımda kimse yok',
      ],
      {'yalnızlık': 10, 'tevekkül': 6, 'umut': 4},
    );
    scoreMatch(
      [
        'allah beni affeder mi',
        'allah affeder mi',
        'affedilir miyim',
        'bağışlanır mıyım',
        'tövbe etmek istiyorum',
        'pişmanım',
        'günah işledim',
        'allah beni bağışlar mı',
        'çok günahım var',
        'kendimi affedemiyorum',
      ],
      {'tövbe': 10, 'bağışlanma': 9, 'umut': 5},
    );
    scoreMatch(
      [
        'çok korkuyorum',
        'korkuyorum',
        'çok korktum',
        'korku içindeyim',
        'ölmekten korkuyorum',
        'ölüm korkusu',
        'gelecekten korkuyorum',
        'başımıza bir şey gelecek',
      ],
      {'korku': 9, 'tevekkül': 7, 'umut': 4, 'ölüm korkusu': 5},
    );
    scoreMatch(
      [
        'ne yapacağımı bilmiyorum',
        'bilmiyorum',
        'çaresizim',
        'yolumu bulamıyorum',
        'kararsızım',
        'çıkış yolu yok',
        'ne yapmalıyım',
        'yol göster',
        'tükendim',
      ],
      {'çaresizlik': 9, 'tevekkül': 7, 'sabır': 5, 'umut': 4},
    );
    scoreMatch(
      [
        'alkolü bıraktım ama zorlanıyorum',
        'alkol',
        'içki',
        'bağımlılık',
        'bıraktım ama zorlanıyorum',
        'nefsimle mücadele',
        'nefs',
        'alışkanlık',
        'bırakmak',
        'harama dönmekten korkuyorum',
        'kendimi tutamıyorum',
      ],
      {'nefs mücadelesi': 10, 'irade': 8, 'sebat': 7, 'tövbe': 5},
    );
    scoreMatch(
      ['sabredemiyorum', 'sabretmek', 'sabır', 'zorlanıyorum', 'zor geliyor'],
      {'sabır': 8, 'sebat': 5, 'umut': 2},
    );
    scoreMatch(
      ['şükür', 'şükretmek', 'minnet', 'nimet', 'hamd'],
      {'şükür': 9, 'umut': 2},
    );
    scoreMatch(
      ['affetmek', 'affedemiyorum', 'affet', 'kırıldım', 'öfke', 'kızgınım'],
      {'affetmek': 9, 'sabır': 4},
    );
    scoreMatch(
      ['ailem', 'aile', 'annem', 'babam', 'eşim', 'çocuğum', 'evlilik'],
      {'aile': 8, 'sabır': 4, 'affetmek': 3},
    );
    scoreMatch(
      ['rızık', 'para', 'işsizim', 'borç', 'geçinemiyorum', 'iş bulamıyorum'],
      {'rızık': 9, 'tevekkül': 6, 'umut': 4, 'şükür': 2},
    );
    scoreMatch(
      ['imtihan', 'sınanıyorum', 'musibet', 'başımıza geldi', 'zor gün'],
      {'imtihan': 9, 'sabır': 7, 'tevekkül': 5, 'sebat': 3},
    );

    final rankedThemes = scores.entries.toList()
      ..sort((a, b) {
        final scoreComparison = b.value.compareTo(a.value);
        if (scoreComparison != 0) {
          return scoreComparison;
        }
        return _themePriority(a.key).compareTo(_themePriority(b.key));
      });

    final effectiveRankedThemes = rankedThemes.isEmpty
        ? [for (final theme in fallbackThemes) MapEntry(theme, 1)]
        : rankedThemes;
    final primaryTheme = effectiveRankedThemes.first.key;
    final secondaryThemes = effectiveRankedThemes
        .skip(1)
        .map((entry) => entry.key)
        .where((theme) => theme != primaryTheme)
        .take(3)
        .toList();

    return SituationIntentAnalysis(
      rawInput: input,
      normalizedInput: normalizedInput,
      primaryTheme: primaryTheme,
      secondaryThemes: secondaryThemes,
      emotion: _detectEmotion(
        normalizedInput: normalizedInput,
        primaryTheme: primaryTheme,
      ),
      severity: _detectSeverity(normalizedInput),
      confidence: _confidenceFor(
        matchedKeywords: matchedKeywords.length,
        rankedThemes: rankedThemes.length,
      ),
      aiEnabled: false,
      matchedKeywords: matchedKeywords.toList(),
      themeScores: {
        for (final entry in effectiveRankedThemes) entry.key: entry.value,
      },
    );
  }

  static List<String> mapTextToTags(String input) {
    return analyze(input).themes;
  }

  static String normalizeForMatching(String input) {
    return input
        .trim()
        .replaceAll('\u00A0', ' ')
        .replaceAll('İ', 'i')
        .replaceAll('I', 'ı')
        .toLowerCase()
        .replaceAll('\u0307', '')
        .replaceAll(RegExp(r'\s+'), ' ');
  }

  static String _detectEmotion({
    required String normalizedInput,
    required String primaryTheme,
  }) {
    if (_containsAny(normalizedInput, ['kork', 'panik', 'ölüm'])) {
      return 'korku';
    }
    if (_containsAny(normalizedInput, ['yalnız', 'kimsesiz', 'terk'])) {
      return 'yalnızlık';
    }
    if (_containsAny(normalizedInput, ['pişman', 'affeder', 'günah'])) {
      return 'pişmanlık';
    }
    if (_containsAny(normalizedInput, ['hasta', 'ağrı', 'şifa'])) {
      return 'hastalık';
    }
    if (_containsAny(normalizedInput, ['bunald', 'daral', 'çaresiz'])) {
      return 'bunalmış';
    }
    return primaryTheme;
  }

  static String _detectSeverity(String normalizedInput) {
    if (_containsAny(normalizedInput, [
      'çok',
      'hiç',
      'dayanamıyorum',
      'nefes alamıyorum',
      'çaresizim',
      'kötüyüm',
      'mahvoldum',
      'çöktüm',
      'tükendim',
      'ağır',
    ])) {
      return 'high';
    }
    if (_containsAny(normalizedInput, ['biraz', 'az', 'hafif'])) {
      return 'low';
    }
    return 'medium';
  }

  static double _confidenceFor({
    required int matchedKeywords,
    required int rankedThemes,
  }) {
    if (matchedKeywords == 0 || rankedThemes == 0) {
      return 0.35;
    }
    final confidence = 0.55 + (matchedKeywords * 0.08) + (rankedThemes * 0.03);
    return confidence.clamp(0.0, 0.95);
  }

  static bool _containsAny(String input, List<String> fragments) {
    return fragments.any(input.contains);
  }

  static int _themePriority(String theme) {
    final index = supportedThemes.indexOf(theme);
    return index == -1 ? supportedThemes.length : index;
  }
}
