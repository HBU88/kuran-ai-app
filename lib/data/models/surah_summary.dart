class SurahSummary {
  const SurahSummary({
    required this.number,
    required this.nameAr,
    required this.nameTr,
    required this.revelationType,
    required this.ayahCount,
  });

  factory SurahSummary.fromJson(Map<String, dynamic> json) {
    return SurahSummary(
      number: json['id'] as int? ?? 0,
      nameAr: json['name'] as String? ?? '',
      nameTr: json['translation'] as String? ?? '',
      revelationType: json['type'] as String? ?? '',
      ayahCount: json['total_verses'] as int? ?? 0,
    );
  }

  final int number;
  final String nameAr;
  final String nameTr;
  final String revelationType;
  final int ayahCount;

  bool get isMeccan => revelationType == 'meccan';

  String get revelationLabel => isMeccan ? 'Mekke dönemi' : 'Medine dönemi';
}

class SurahDetail extends SurahSummary {
  const SurahDetail({
    required super.number,
    required super.nameAr,
    required super.nameTr,
    required super.revelationType,
    required super.ayahCount,
    required this.ayahs,
  });

  factory SurahDetail.fromJson(Map<String, dynamic> json) {
    final verses = json['verses'] as List<dynamic>? ?? const <dynamic>[];
    return SurahDetail(
      number: json['id'] as int? ?? 0,
      nameAr: json['name'] as String? ?? '',
      nameTr: json['translation'] as String? ?? '',
      revelationType: json['type'] as String? ?? '',
      ayahCount: json['total_verses'] as int? ?? 0,
      ayahs: verses
          .map((item) => SurahAyah.fromJson(item as Map<String, dynamic>))
          .toList(),
    );
  }

  final List<SurahAyah> ayahs;
}

class SurahAyah {
  const SurahAyah({
    required this.number,
    required this.arabic,
    required this.turkish,
  });

  factory SurahAyah.fromJson(Map<String, dynamic> json) {
    return SurahAyah(
      number: json['id'] as int? ?? 0,
      arabic: json['text'] as String? ?? '',
      turkish: json['translation'] as String? ?? '',
    );
  }

  final int number;
  final String arabic;
  final String turkish;
}
