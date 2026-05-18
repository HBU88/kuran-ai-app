import '../models/support_product.dart';

class SupportPaymentService {
  const SupportPaymentService();

  static const smallProductId = 'hakai_support_small';
  static const mediumProductId = 'hakai_support_medium';
  static const largeProductId = 'hakai_support_large';

  static const productIds = <String>[
    smallProductId,
    mediumProductId,
    largeProductId,
  ];

  Future<List<SupportProduct>> loadSupportProducts() async {
    // TODO: Add Flutter's official in_app_purchase package when dependency
    // resolution is available, then load StoreKit/App Store Connect product
    // metadata for the IDs below instead of returning disabled placeholders.
    // TODO: Configure matching one-time consumable/non-consumable support
    // products in App Store Connect according to App Review guidance.
    // TODO: Verify product IDs: hakai_support_small, hakai_support_medium,
    // hakai_support_large.
    // TODO: Test with StoreKit configuration and TestFlight sandbox.
    return const [
      SupportProduct(
        id: smallProductId,
        title: 'Küçük Destek',
        description: 'HAKAI’nin gelişimine küçük bir katkı.',
      ),
      SupportProduct(
        id: mediumProductId,
        title: 'Orta Destek',
        description: 'Uygulamanın daha kararlı çalışmasına destek.',
      ),
      SupportProduct(
        id: largeProductId,
        title: 'Güçlü Destek',
        description: 'Yeni özelliklerin hazırlanmasına daha güçlü katkı.',
      ),
    ];
  }

  Future<SupportPurchaseResult> purchaseSupportProduct(String productId) async {
    if (!productIds.contains(productId)) {
      return const SupportPurchaseResult(
        ok: false,
        message: 'Destek seçeneği bulunamadı.',
      );
    }
    return const SupportPurchaseResult(
      ok: false,
      message: 'Destek seçenekleri yakında aktif olacaktır.',
    );
  }

  Future<SupportPurchaseResult> restorePurchases() async {
    return const SupportPurchaseResult(
      ok: false,
      message: 'Geri yüklenebilir destek işlemi şu anda bulunmuyor.',
    );
  }
}

class SupportPurchaseResult {
  const SupportPurchaseResult({
    required this.ok,
    required this.message,
  });

  final bool ok;
  final String message;
}
