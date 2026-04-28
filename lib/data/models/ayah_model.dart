class AyahModel {
  const AyahModel({
    required this.id,
    required this.surahNumber,
    required this.surahNameAr,
    required this.surahNameTr,
    required this.ayahNumber,
    required this.textAr,
    required this.textTr,
    required this.tags,
    required this.shortExplanation,
    required this.source,
  });

  final int id;
  final int surahNumber;
  final String surahNameAr;
  final String surahNameTr;
  final int ayahNumber;
  final String textAr;
  final String textTr;
  final List<String> tags;
  final String shortExplanation;
  final String source;

  String get reference => '$surahNameTr $ayahNumber';

  factory AyahModel.fromJson(Map<String, dynamic> json) {
    return AyahModel(
      id: _readInt(json['id']),
      surahNumber: _readInt(json['surahNumber']),
      surahNameAr: json['surahNameAr']?.toString() ?? '',
      surahNameTr:
          json['surah']?.toString() ?? json['surahNameTr']?.toString() ?? '',
      ayahNumber: _readInt(json['ayahNumber'] ?? json['ayah']),
      textAr: json['text_ar']?.toString() ?? json['textAr']?.toString() ?? '',
      textTr: json['text_tr']?.toString() ?? json['textTr']?.toString() ?? '',
      tags: List<String>.from(json['tags'] as List<dynamic>),
      shortExplanation: json['short_explanation']?.toString() ??
          json['shortExplanation']?.toString() ??
          json['notes']?.toString() ??
          '',
      source: json['source']?.toString() ??
          'Kur\'an-ı Kerim - seçilmiş MVP meal özeti',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'surah': surahNameTr,
      'surahNumber': surahNumber,
      'ayah': ayahNumber,
      'ayahNumber': ayahNumber,
      'text_ar': textAr,
      'text_tr': textTr,
      'tags': tags,
      'short_explanation': shortExplanation,
      'notes': shortExplanation,
    };
  }
}

int _readInt(Object? value) {
  if (value is int) {
    return value;
  }
  return int.parse(value.toString());
}
