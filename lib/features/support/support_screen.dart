import 'dart:async';

import 'package:flutter/material.dart';
import 'package:in_app_purchase/in_app_purchase.dart';
import 'package:provider/provider.dart';

import '../../core/constants/app_routes.dart';
import '../../data/services/habit_tracking_service.dart';
import '../../data/services/support_service.dart';
import '../../shared/widgets/app_card.dart';
import '../../shared/widgets/app_gradient_background.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_spacing.dart';
import '../auth/auth_controller.dart';

class SupportScreen extends StatefulWidget {
  const SupportScreen({super.key});

  @override
  State<SupportScreen> createState() => _SupportScreenState();
}

class _SupportScreenState extends State<SupportScreen> {
  late final SupportService _supportService;

  @override
  void initState() {
    super.initState();
    _supportService = SupportService(
      verifyPurchase: _verifyPurchaseWithBackend,
    )..addListener(_handleSupportUpdate);
    _supportService.initialize();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      unawaited(context.read<HabitTrackingService>().trackSupportScreenOpen());
    });
  }

  @override
  void dispose() {
    _supportService
      ..removeListener(_handleSupportUpdate)
      ..dispose();
    super.dispose();
  }

  void _handleSupportUpdate() {
    if (!mounted) return;
    setState(() {});

    final message =
        _supportService.successMessage ?? _supportService.errorMessage;
    if (message == null) return;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
    _supportService.clearMessages();
  }

  Future<PurchaseBackendVerification> _verifyPurchaseWithBackend(
    PurchaseDetails purchase,
  ) async {
    final platform =
        Theme.of(context).platform == TargetPlatform.iOS ? 'ios' : 'android';
    final result = await context.read<AuthController>().verifyPurchase(
          productId: purchase.productID,
          platform: platform,
          transactionId: purchase.purchaseID,
          purchaseToken: purchase.verificationData.serverVerificationData,
        );
    return PurchaseBackendVerification(
      status: result?.status ?? 'pending',
      creditsGranted: result?.creditsGranted ?? 0,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('HAKAI’ye Destek Ol')),
      body: AppGradientBackground(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(18, 10, 18, 28),
          children: [
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(
                    Icons.volunteer_activism_outlined,
                    color: AppColors.primaryAccent,
                    size: 30,
                  ),
                  const SizedBox(height: 14),
                  Text(
                    'HAKAI’ye Destek Ol',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'HAKAI’nin gelişimine katkı sağlamak istersen, uygulama içi destek seçeneklerini kullanabilirsin.',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.large),
            if (_supportService.isLoading)
              const AppCard(
                child: Center(child: CircularProgressIndicator()),
              ),
            if (!_supportService.isLoading && !_supportService.hasProducts)
              const Padding(
                padding: EdgeInsets.only(bottom: 12),
                child: AppCard(
                  child: Text(
                    'Destek seçenekleri şu anda yüklenemedi. Aşağıdaki tutarlar App Store ürünleri etkinleşene kadar bilgilendirme amaçlı gösterilir.',
                  ),
                ),
              ),
            _SupportProductsList(
              products: _supportService.products,
              isPurchasing: _supportService.isPurchasing,
              onPurchasePressed: (product) {
                final auth = context.read<AuthController>();
                if (!auth.isLoggedIn) {
                  _showLoginRequiredDialog(context);
                  return;
                }
                unawaited(
                  context
                      .read<HabitTrackingService>()
                      .trackSupportPurchaseTapped(),
                );
                _supportService.purchaseSupportProduct(product);
              },
            ),
            const SizedBox(height: AppSpacing.medium),
            AppCard(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(
                    Icons.verified_user_outlined,
                    color: AppColors.primaryAccent,
                    size: 20,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Destek seçenekleri App Store üzerinden güvenli şekilde sunulur.',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _showLoginRequiredDialog(BuildContext context) async {
    final choice = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Giriş gerekli'),
        content: const Text(
          'Destek seçeneklerini kullanmak ve haklarını hesabına tanımlamak için giriş yapmalı veya hesap oluşturmalısın.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop('cancel'),
            child: const Text('Vazgeç'),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop('login'),
            child: const Text('Giriş yap'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop('register'),
            child: const Text('Hesap oluştur'),
          ),
        ],
      ),
    );
    if (!context.mounted) return;
    if (choice == 'login') {
      Navigator.pushNamed(context, AppRoutes.login);
    } else if (choice == 'register') {
      Navigator.pushNamed(context, AppRoutes.register);
    }
  }
}

class _SupportProductsList extends StatelessWidget {
  const _SupportProductsList({
    required this.products,
    required this.isPurchasing,
    required this.onPurchasePressed,
  });

  final List<ProductDetails> products;
  final bool isPurchasing;
  final ValueChanged<ProductDetails> onPurchasePressed;

  @override
  Widget build(BuildContext context) {
    final productById = {for (final product in products) product.id: product};
    final standardTiers = _supportTiers.take(2).toList();
    final specialTiers = _supportTiers.skip(2).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final tier in standardTiers) ...[
          _SupportTierCard(
            tier: tier,
            product: productById[tier.productId],
            isPurchasing: isPurchasing,
            onPurchasePressed: productById[tier.productId] == null
                ? null
                : () => onPurchasePressed(productById[tier.productId]!),
          ),
          const SizedBox(height: 12),
        ],
        const SizedBox(height: AppSpacing.small),
        Text(
          'Özel Destek',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                color: AppColors.textPrimary,
                fontWeight: FontWeight.w800,
              ),
        ),
        const SizedBox(height: AppSpacing.small),
        for (final tier in specialTiers) ...[
          _SupportTierCard(
            tier: tier,
            product: productById[tier.productId],
            isPurchasing: isPurchasing,
            onPurchasePressed: productById[tier.productId] == null
                ? null
                : () => onPurchasePressed(productById[tier.productId]!),
          ),
          const SizedBox(height: 12),
        ],
      ],
    );
  }
}

class _SupportTierCard extends StatelessWidget {
  const _SupportTierCard({
    required this.tier,
    required this.product,
    required this.isPurchasing,
    required this.onPurchasePressed,
  });

  final _SupportTier tier;
  final ProductDetails? product;
  final bool isPurchasing;
  final VoidCallback? onPurchasePressed;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      tier.title,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      product?.description.trim().isNotEmpty == true
                          ? product!.description
                          : tier.description,
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Text(
                product?.price ?? tier.fallbackAmount,
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      color: AppColors.primaryAccentSoft,
                      fontWeight: FontWeight.w800,
                    ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: isPurchasing ? null : onPurchasePressed,
              icon: isPurchasing
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.favorite_border_rounded),
              label: const Text('Destek ol'),
            ),
          ),
        ],
      ),
    );
  }
}

class _SupportTier {
  const _SupportTier({
    required this.productId,
    required this.title,
    required this.fallbackAmount,
    required this.description,
  });

  final String productId;
  final String title;
  final String fallbackAmount;
  final String description;
}

const _supportTiers = [
  _SupportTier(
    productId: SupportService.smallProductId,
    title: 'Küçük Destek',
    fallbackAmount: '99,99 TL',
    description: 'Uygulamanın gelişimini destekleyin.',
  ),
  _SupportTier(
    productId: SupportService.mediumProductId,
    title: 'Orta Destek',
    fallbackAmount: '149,99 TL',
    description: 'Uygulamanın gelişimini destekleyin.',
  ),
  _SupportTier(
    productId: SupportService.special199ProductId,
    title: 'Özel Destek',
    fallbackAmount: '199,99 TL',
    description: 'Uygulamanın gelişimini destekleyin.',
  ),
  _SupportTier(
    productId: SupportService.special299ProductId,
    title: 'Özel Destek',
    fallbackAmount: '299,99 TL',
    description: 'Uygulamanın gelişimini destekleyin.',
  ),
  _SupportTier(
    productId: SupportService.special499ProductId,
    title: 'Özel Destek',
    fallbackAmount: '499,99 TL',
    description: 'Uygulamanın gelişimini destekleyin.',
  ),
];
