import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:in_app_purchase/in_app_purchase.dart';

class SupportService extends ChangeNotifier {
  SupportService({
    InAppPurchase? inAppPurchase,
  }) : _inAppPurchase = inAppPurchase ?? InAppPurchase.instance;

  static const smallProductId = 'support_small';
  static const mediumProductId = 'support_medium';
  static const special199ProductId = 'support_special_199';
  static const special299ProductId = 'support_special_299';
  static const special499ProductId = 'support_special_499';

  static const productIds = <String>{
    smallProductId,
    mediumProductId,
    special199ProductId,
    special299ProductId,
    special499ProductId,
  };

  final InAppPurchase _inAppPurchase;
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
      // support_small, support_medium, support_special_199,
      // support_special_299, support_special_499.
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
          // Support purchases are voluntary app support only. They do not
          // unlock premium religious content or feature access.
          // TODO: Add server-side receipt validation later if needed.
          _successMessage = 'Desteğin için teşekkür ederiz.';
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

int _compareSupportProducts(ProductDetails a, ProductDetails b) {
  return _supportProductOrder(a.id).compareTo(_supportProductOrder(b.id));
}

int _supportProductOrder(String productId) {
  return switch (productId) {
    SupportService.smallProductId => 0,
    SupportService.mediumProductId => 1,
    SupportService.special199ProductId => 2,
    SupportService.special299ProductId => 3,
    SupportService.special499ProductId => 4,
    _ => 5,
  };
}
