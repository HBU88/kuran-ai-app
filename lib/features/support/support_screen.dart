import 'package:flutter/material.dart';
import 'package:in_app_purchase/in_app_purchase.dart';

import '../../data/services/support_service.dart';
import '../../shared/widgets/app_card.dart';
import '../../shared/widgets/app_gradient_background.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_spacing.dart';

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
    _supportService = SupportService()..addListener(_handleSupportUpdate);
    _supportService.initialize();
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
              )
            else if (!_supportService.hasProducts)
              const AppCard(
                child: Text('Destek seçenekleri şu anda yüklenemedi.'),
              )
            else
              _SupportProductsList(
                products: _supportService.products,
                isPurchasing: _supportService.isPurchasing,
                onPurchasePressed: _supportService.purchaseSupportProduct,
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
    final standardProducts = products
        .where((product) =>
            product.id == SupportService.smallProductId ||
            product.id == SupportService.mediumProductId)
        .toList();
    final specialProducts = products
        .where((product) => product.id.startsWith('support_special_'))
        .toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final product in standardProducts) ...[
          _SupportTierCard(
            product: product,
            title: _displayTitle(product),
            isPurchasing: isPurchasing,
            onPurchasePressed: () => onPurchasePressed(product),
          ),
          const SizedBox(height: 12),
        ],
        if (specialProducts.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.small),
          Text(
            'Özel Destek',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: AppColors.textPrimary,
                  fontWeight: FontWeight.w800,
                ),
          ),
          const SizedBox(height: AppSpacing.small),
          for (final product in specialProducts) ...[
            _SupportTierCard(
              product: product,
              title: 'Özel Destek',
              isPurchasing: isPurchasing,
              onPurchasePressed: () => onPurchasePressed(product),
            ),
            const SizedBox(height: 12),
          ],
        ],
      ],
    );
  }
}

class _SupportTierCard extends StatelessWidget {
  const _SupportTierCard({
    required this.product,
    required this.title,
    required this.isPurchasing,
    required this.onPurchasePressed,
  });

  final ProductDetails product;
  final String title;
  final bool isPurchasing;
  final VoidCallback onPurchasePressed;

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
                      title,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      product.description.isEmpty
                          ? _fallbackDescription(product.id)
                          : product.description,
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Text(
                product.price,
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

  String _fallbackDescription(String productId) {
    return switch (productId) {
      SupportService.smallProductId => 'Küçük destek seçeneği.',
      SupportService.mediumProductId => 'Orta destek seçeneği.',
      SupportService.special199ProductId => 'Özel destek seçeneği.',
      SupportService.special299ProductId => 'Özel destek seçeneği.',
      SupportService.special499ProductId => 'Özel destek seçeneği.',
      _ => 'Gönüllü uygulama desteği.',
    };
  }
}

String _displayTitle(ProductDetails product) {
  return switch (product.id) {
    SupportService.smallProductId => 'Küçük Destek',
    SupportService.mediumProductId => 'Orta Destek',
    SupportService.special199ProductId => 'Özel Destek',
    SupportService.special299ProductId => 'Özel Destek',
    SupportService.special499ProductId => 'Özel Destek',
    _ => product.title,
  };
}
