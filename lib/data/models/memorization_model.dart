class MemorizationProgress {
  const MemorizationProgress({
    required this.surahId,
    required this.completedAyahCount,
    required this.lastReviewedAt,
    required this.repetitionCount,
  });

  final int surahId;
  final int completedAyahCount;
  final DateTime? lastReviewedAt;
  final int repetitionCount;

  double progressFor(int totalAyahs) {
    if (totalAyahs == 0) {
      return 0;
    }
    return (completedAyahCount / totalAyahs).clamp(0, 1).toDouble();
  }

  MemorizationProgress copyWith({
    int? completedAyahCount,
    DateTime? lastReviewedAt,
    int? repetitionCount,
  }) {
    return MemorizationProgress(
      surahId: surahId,
      completedAyahCount: completedAyahCount ?? this.completedAyahCount,
      lastReviewedAt: lastReviewedAt ?? this.lastReviewedAt,
      repetitionCount: repetitionCount ?? this.repetitionCount,
    );
  }

  factory MemorizationProgress.empty(int surahId) {
    return MemorizationProgress(
      surahId: surahId,
      completedAyahCount: 0,
      lastReviewedAt: null,
      repetitionCount: 0,
    );
  }

  factory MemorizationProgress.fromJson(Map<String, dynamic> json) {
    final lastReviewed = json['lastReviewedAt'] as String?;
    return MemorizationProgress(
      surahId: json['surahId'] as int,
      completedAyahCount: json['completedAyahCount'] as int,
      lastReviewedAt:
          lastReviewed == null ? null : DateTime.parse(lastReviewed),
      repetitionCount: json['repetitionCount'] as int,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'surahId': surahId,
      'completedAyahCount': completedAyahCount,
      'lastReviewedAt': lastReviewedAt?.toIso8601String(),
      'repetitionCount': repetitionCount,
    };
  }
}

class MemorizationSurah {
  const MemorizationSurah({
    required this.id,
    required this.number,
    required this.nameTr,
    required this.nameAr,
    required this.ayahs,
  });

  final int id;
  final int number;
  final String nameTr;
  final String nameAr;
  final List<MemorizationAyah> ayahs;

  factory MemorizationSurah.fromJson(Map<String, dynamic> json) {
    return MemorizationSurah(
      id: json['id'] as int,
      number: json['number'] as int,
      nameTr: json['nameTr'] as String,
      nameAr: json['nameAr'] as String,
      ayahs: (json['ayahs'] as List<dynamic>)
          .map(
              (item) => MemorizationAyah.fromJson(item as Map<String, dynamic>))
          .toList(),
    );
  }
}

class MemorizationAyah {
  const MemorizationAyah({
    required this.number,
    required this.textAr,
    required this.textTr,
  });

  final int number;
  final String textAr;
  final String textTr;

  factory MemorizationAyah.fromJson(Map<String, dynamic> json) {
    return MemorizationAyah(
      number: json['number'] as int,
      textAr: json['textAr'] as String,
      textTr: json['textTr'] as String,
    );
  }
}
