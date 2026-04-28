class FavoriteRecord {
  const FavoriteRecord({
    required this.ayahId,
    required this.savedAt,
  });

  final int ayahId;
  final DateTime savedAt;

  factory FavoriteRecord.fromJson(Map<String, dynamic> json) {
    return FavoriteRecord(
      ayahId: json['ayahId'] as int,
      savedAt: DateTime.parse(json['savedAt'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'ayahId': ayahId,
      'savedAt': savedAt.toIso8601String(),
    };
  }
}
