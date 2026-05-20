class DuaItem {
  const DuaItem({
    required this.id,
    required this.title,
    required this.arabic,
    required this.transliteration,
    required this.turkishMeaning,
    required this.turkishPrayer,
    required this.source,
    required this.category,
    required this.tags,
    required this.note,
  });

  factory DuaItem.fromJson(Map<String, dynamic> json) {
    final tags = json['tags'] as List<dynamic>? ?? const <dynamic>[];
    return DuaItem(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      arabic: json['arabic'] as String? ?? '',
      transliteration: json['transliteration'] as String? ?? '',
      turkishMeaning:
          json['turkishMeaning'] as String? ?? json['turkish'] as String? ?? '',
      turkishPrayer: json['turkishPrayer'] as String? ?? '',
      source: json['source'] as String? ?? '',
      category: json['category'] as String? ?? '',
      tags: tags.map((tag) => tag.toString()).toList(),
      note: json['note'] as String? ?? '',
    );
  }

  final String id;
  final String title;
  final String arabic;
  final String transliteration;
  final String turkishMeaning;
  final String turkishPrayer;
  final String source;
  final String category;
  final List<String> tags;
  final String note;
}
