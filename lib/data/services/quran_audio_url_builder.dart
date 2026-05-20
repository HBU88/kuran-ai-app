class QuranAudioUrlBuilder {
  const QuranAudioUrlBuilder._();

  static const QuranAudioSourceConfig defaultSource =
      QuranAudioSourceConfig.alQuranCloudAlafasy128;

  static String ayahUrl({
    required int surahNumber,
    required int ayahNumber,
    QuranAudioSourceConfig source = defaultSource,
  }) {
    final globalAyahNumber = globalAyahNumberFor(
      surahNumber: surahNumber,
      ayahNumber: ayahNumber,
    );
    return source.ayahUrl(globalAyahNumber);
  }

  static int globalAyahNumberFor({
    required int surahNumber,
    required int ayahNumber,
  }) {
    if (surahNumber < 1 || surahNumber > _ayahCounts.length) {
      throw ArgumentError.value(surahNumber, 'surahNumber');
    }
    final maxAyah = _ayahCounts[surahNumber - 1];
    if (ayahNumber < 1 || ayahNumber > maxAyah) {
      throw ArgumentError.value(ayahNumber, 'ayahNumber');
    }
    var offset = 0;
    for (var i = 0; i < surahNumber - 1; i++) {
      offset += _ayahCounts[i];
    }
    return offset + ayahNumber;
  }

  static const List<int> _ayahCounts = [
    7,
    286,
    200,
    176,
    120,
    165,
    206,
    75,
    129,
    109,
    123,
    111,
    43,
    52,
    99,
    128,
    111,
    110,
    98,
    135,
    112,
    78,
    118,
    64,
    77,
    227,
    93,
    88,
    69,
    60,
    34,
    30,
    73,
    54,
    45,
    83,
    182,
    88,
    75,
    85,
    54,
    53,
    89,
    59,
    37,
    35,
    38,
    29,
    18,
    45,
    60,
    49,
    62,
    55,
    78,
    96,
    29,
    22,
    24,
    13,
    14,
    11,
    11,
    18,
    12,
    12,
    30,
    52,
    52,
    44,
    28,
    28,
    20,
    56,
    40,
    31,
    50,
    40,
    46,
    42,
    29,
    19,
    36,
    25,
    22,
    17,
    19,
    26,
    30,
    20,
    15,
    21,
    11,
    8,
    8,
    19,
    5,
    8,
    8,
    11,
    11,
    8,
    3,
    9,
    5,
    4,
    7,
    3,
    6,
    3,
    5,
    4,
    5,
    6,
  ];
}

class QuranAudioSourceConfig {
  const QuranAudioSourceConfig({
    required this.name,
    required this.reciterLabel,
    required this.baseUrl,
    required this.bitrate,
    required this.edition,
    required this.attribution,
    required this.usageCaveat,
  });

  // Al Quran Cloud documents ayah-level CDN audio as:
  // https://cdn.islamic.network/quran/audio/{bitrate}/{edition}/{number}.mp3
  // where {number} is the global Quran ayah number from 1..6236.
  //
  // HAKAI must not use AI-generated Quran recitation. This source should remain
  // configurable and its usage/license terms should be reviewed before public
  // production launch or App Store metadata claims.
  static const alQuranCloudAlafasy128 = QuranAudioSourceConfig(
    name: 'Al Quran Cloud CDN',
    reciterLabel: 'Mishary Rashid Alafasy',
    baseUrl: 'https://cdn.islamic.network/quran/audio',
    bitrate: 128,
    edition: 'ar.alafasy',
    attribution: 'Al Quran Cloud / Islamic Network CDN, ar.alafasy',
    usageCaveat:
        'Ses kaynağı ve kullanım koşulları yayın öncesi ayrıca doğrulanmalıdır.',
  );

  final String name;
  final String reciterLabel;
  final String baseUrl;
  final int bitrate;
  final String edition;
  final String attribution;
  final String usageCaveat;

  String ayahUrl(int globalAyahNumber) {
    return '$baseUrl/$bitrate/$edition/$globalAyahNumber.mp3';
  }
}
