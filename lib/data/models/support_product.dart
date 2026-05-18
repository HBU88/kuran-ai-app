class SupportProduct {
  const SupportProduct({
    required this.id,
    required this.title,
    this.description = '',
    this.priceLabel,
    this.isAvailable = false,
  });

  final String id;
  final String title;
  final String description;
  final String? priceLabel;
  final bool isAvailable;
}
