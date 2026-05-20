class RecommendedResource {
  const RecommendedResource({
    required this.id,
    required this.title,
    required this.sourceLabel,
    required this.description,
    required this.url,
    required this.tags,
  });

  final String id;
  final String title;
  final String sourceLabel;
  final String description;
  final String url;
  final List<String> tags;
}
