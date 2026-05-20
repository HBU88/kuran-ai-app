import '../models/recommended_resource.dart';

class RecommendedResourceService {
  const RecommendedResourceService();

  static const int maxVisibleResources = 2;

  // Privacy note: these recommendations are matched only from the current
  // screen's local tags. HAKAI must not infer, store, or target sensitive
  // religious profiles from user messages or reading behavior.
  List<RecommendedResource> matchByTags(
    Iterable<String> tags, {
    int limit = maxVisibleResources,
  }) {
    final normalizedTags = tags.map(_normalize).where((tag) => tag.isNotEmpty);
    final tagSet = normalizedTags.toSet();
    if (tagSet.isEmpty) return const [];

    final scored = _mockResources
        .map((resource) => _ScoredResource(
              resource: resource,
              score: resource.tags
                  .map(_normalize)
                  .where(tagSet.contains)
                  .length,
            ))
        .where((item) => item.score > 0)
        .toList()
      ..sort((a, b) => b.score.compareTo(a.score));

    return scored.take(limit).map((item) => item.resource).toList();
  }
}

class _ScoredResource {
  const _ScoredResource({
    required this.resource,
    required this.score,
  });

  final RecommendedResource resource;
  final int score;
}

const _mockResources = <RecommendedResource>[
  RecommendedResource(
    id: 'quran_portal_reading',
    title: 'Kur’an-ı Kerim Okuma',
    sourceLabel: 'Kaynak',
    description: 'Ayetleri kendi bağlamında okumak için ilgili içerik.',
    url: 'https://kuran.diyanet.gov.tr',
    tags: ['kur’an', 'ayet', 'tefekkür', 'sabır', 'umut', 'şükür'],
  ),
  RecommendedResource(
    id: 'diyanet_religious_questions',
    title: 'Dinî Bilgiler ve Soru Cevap',
    sourceLabel: 'Kaynak',
    description: 'Bağlayıcı konularda yetkili kaynaklara yönelmek için öneri.',
    url: 'https://kurul.diyanet.gov.tr',
    tags: ['namaz', 'oruç', 'zekat', 'helal', 'haram', 'ilmihal', 'aile'],
  ),
  RecommendedResource(
    id: 'dua_reflection',
    title: 'Günlük Dua ve Tefekkür Notu',
    sourceLabel: 'İlgili içerik',
    description: 'Duanın anlamını günlük hayata taşımak için sakin bir okuma.',
    url: 'https://kuran.diyanet.gov.tr',
    tags: ['dua', 'niyaz', 'huzur', 'kalp', 'tövbe', 'şifa'],
  ),
  RecommendedResource(
    id: 'family_guidance',
    title: 'Aile ve Güzel Ahlak Okumaları',
    sourceLabel: 'Öneri',
    description: 'Aile huzuru, merhamet ve sorumluluk üzerine ilgili içerik.',
    url: 'https://diyanet.gov.tr',
    tags: ['aile', 'evlilik', 'çocuklar', 'anne baba', 'merhamet'],
  ),
  RecommendedResource(
    id: 'work_life_balance',
    title: 'Emek, Rızık ve Sorumluluk',
    sourceLabel: 'İlgili içerik',
    description: 'Helal kazanç, emek ve kanaat üzerine genel kaynak önerisi.',
    url: 'https://diyanet.gov.tr',
    tags: ['rızık', 'bereket', 'iş', 'geçim', 'borç', 'şükür'],
  ),
];

String _normalize(String value) {
  return value
      .toLowerCase()
      .replaceAll('â', 'a')
      .replaceAll('î', 'i')
      .replaceAll('û', 'u')
      .replaceAll('ı', 'i')
      .replaceAll('ğ', 'g')
      .replaceAll('ü', 'u')
      .replaceAll('ş', 's')
      .replaceAll('ö', 'o')
      .replaceAll('ç', 'c')
      .trim();
}
