import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:in_app_purchase/in_app_purchase.dart';

class SupportService extends ChangeNotifier {
  SupportService({
    InAppPurchase? inAppPurchase,
    Future<PurchaseBackendVerification> Function(PurchaseDetails purchase)?
        verifyPurchase,
  })  : _inAppPurchase = inAppPurchase ?? InAppPurchase.instance,
        _verifyPurchase = verifyPurchase;

  static const smallProductId = 'support_small';
  static const mediumProductId = 'support_medium';
  static const ozelProductId = 'support_ozel';
  static const buyukProductId = 'support_buyuk';
  static const plusProductId = 'support_plus';

  static const productIds = <String>{
    smallProductId,
    mediumProductId,
    ozelProductId,
    buyukProductId,
    plusProductId,
  };

  final InAppPurchase _inAppPurchase;
  final Future<PurchaseBackendVerification> Function(PurchaseDetails purchase)?
      _verifyPurchase;
  StreamSubscription<List<PurchaseDetails>>? _purchaseSubscription;

  bool _isLoading = false;
  bool _isPurchasing = false;
  bool _storeAvailable = false;
  String? _errorMessage;
  String? _successMessage;
  List<ProductDetails> _products = const [];

  bool get isLoading => _isLoading;
  bool get isPurchasing => _isPurchasing;
  bool get storeAvailable => _storeAvailable;
  String? get errorMessage => _errorMessage;
  String? get successMessage => _successMessage;
  List<ProductDetails> get products => List.unmodifiable(_products);
  bool get hasProducts => _products.isNotEmpty;

  Future<void> initialize() async {
    _isLoading = true;
    _errorMessage = null;
    _successMessage = null;
    notifyListeners();

    _purchaseSubscription ??= _inAppPurchase.purchaseStream.listen(
      _handlePurchaseUpdates,
      onError: (_) {
        _isPurchasing = false;
        _errorMessage = 'Destek işlemi şu anda tamamlanamadı.';
        notifyListeners();
      },
    );

    try {
      _storeAvailable = await _inAppPurchase.isAvailable();
      if (!_storeAvailable) {
        _products = const [];
        _errorMessage = 'Destek seçenekleri şu anda yüklenemedi.';
        return;
      }

      // TODO: Create matching consumable IAP products in App Store Connect:
      // support_small, support_medium, support_ozel, support_buyuk, support_plus.
      final response = await _inAppPurchase.queryProductDetails(productIds);
      if (response.error != null || response.productDetails.isEmpty) {
        _products = const [];
        _errorMessage = 'Destek seçenekleri şu anda yüklenemedi.';
        return;
      }

      _products = [...response.productDetails]..sort(_compareSupportProducts);
    } catch (_) {
      _products = const [];
      _errorMessage = 'Destek seçenekleri şu anda yüklenemedi.';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> purchaseSupportProduct(ProductDetails product) async {
    if (_isPurchasing) return;

    _isPurchasing = true;
    _errorMessage = null;
    _successMessage = null;
    notifyListeners();

    try {
      final purchaseParam = PurchaseParam(productDetails: product);
      await _inAppPurchase.buyConsumable(
        purchaseParam: purchaseParam,
        autoConsume: true,
      );
    } catch (_) {
      _isPurchasing = false;
      _errorMessage = 'Destek işlemi şu anda başlatılamadı.';
      notifyListeners();
    }
  }

  Future<void> _handlePurchaseUpdates(
    List<PurchaseDetails> purchaseDetailsList,
  ) async {
    for (final purchase in purchaseDetailsList) {
      switch (purchase.status) {
        case PurchaseStatus.pending:
          _isPurchasing = true;
          break;
        case PurchaseStatus.purchased:
        case PurchaseStatus.restored:
          final verification = await _verifyPurchase?.call(purchase);
          if (verification == null) {
            _errorMessage = 'Satın alma kaydı şu anda doğrulamaya alınamadı.';
          } else if (verification.status == 'verified') {
            _successMessage = 'Desteğin için teşekkür ederiz.';
          } else {
            _successMessage =
                'Desteğin alındı. App Store doğrulaması tamamlanınca kullanım hakların güncellenecek.';
          }
          _isPurchasing = false;
          break;
        case PurchaseStatus.error:
          _errorMessage = 'Destek işlemi şu anda tamamlanamadı.';
          _isPurchasing = false;
          break;
        case PurchaseStatus.canceled:
          _errorMessage = 'Destek işlemi iptal edildi.';
          _isPurchasing = false;
          break;
      }

      if (purchase.pendingCompletePurchase) {
        await _inAppPurchase.completePurchase(purchase);
      }
    }
    notifyListeners();
  }

  void clearMessages() {
    _errorMessage = null;
    _successMessage = null;
  }

  @override
  void dispose() {
    _purchaseSubscription?.cancel();
    super.dispose();
  }
}

class PurchaseBackendVerification {
  const PurchaseBackendVerification({
    required this.status,
    required this.creditsGranted,
  });

  final String status;
  final int creditsGranted;
}

int _compareSupportProducts(ProductDetails a, ProductDetails b) {
  return _supportProductOrder(a.id).compareTo(_supportProductOrder(b.id));
}

int _supportProductOrder(String productId) {
  return switch (productId) {
    SupportService.smallProductId => 0,
    SupportService.mediumProductId => 1,
    SupportService.ozelProductId => 2,
    SupportService.buyukProductId => 3,
    SupportService.plusProductId => 4,
    _ => 5,
  };
}
