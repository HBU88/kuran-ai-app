import 'package:flutter/material.dart';

import '../../data/models/support_product.dart';
import '../../data/services/support_payment_service.dart';
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
  final SupportPaymentService _paymentService = const SupportPaymentService();
  late final Future<List<SupportProduct>> _productsFuture;

  @override
  void initState() {
    super.initState();
    _productsFuture = _paymentService.loadSupportProducts();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('HAKAI’yi Destekle')),
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
                    'HAKAI’yi Destekle',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'HAKAI, Kur’an merkezli manevi rehberliği daha fazla kişiye ulaştırmak ve uygulamayı geliştirmeye devam etmek için hazırlanıyor.',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  const SizedBox(height: AppSpacing.medium),
                  Text(
                    'Dilersen tek seferlik bir destekle bu projenin gelişimine katkıda bulunabilirsin. Desteğin; uygulamanın geliştirilmesine, daha kararlı çalışmasına ve yeni özelliklerin hazırlanmasına yardımcı olur.',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  const SizedBox(height: AppSpacing.medium),
                  Text(
                    'Destek olmak tamamen isteğe bağlıdır. HAKAI’nin temel özelliklerini kullanmaya devam edebilirsin.',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.large),
            FutureBuilder<List<SupportProduct>>(
              future: _productsFuture,
              builder: (context, snapshot) {
                final products = snapshot.data ?? const <SupportProduct>[];
                if (products.isEmpty &&
                    snapshot.connectionState != ConnectionState.done) {
                  return const AppCard(
                    child: Center(child: CircularProgressIndicator()),
                  );
                }
                return Column(
                  children: [
                    for (final product in products) ...[
                      _SupportTierCard(
                        product: product,
                        onPurchasePressed: () => _purchaseProduct(product.id),
                        onUnavailablePressed: () =>
                            _showPendingMessage(context),
                      ),
                      const SizedBox(height: 12),
                    ],
                    AppCard(
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Icon(
                            Icons.info_outline_rounded,
                            color: AppColors.primaryAccent,
                            size: 20,
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              'Destek seçenekleri yakında aktif olacaktır.',
                              style: Theme.of(context).textTheme.bodyMedium,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  void _showPendingMessage(BuildContext context) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Destek seçenekleri yakında aktif olacaktır.'),
      ),
    );
  }

  Future<void> _purchaseProduct(String productId) async {
    final result = await _paymentService.purchaseSupportProduct(productId);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(result.message)),
    );
  }
}

class _SupportTierCard extends StatelessWidget {
  const _SupportTierCard({
    required this.product,
    required this.onPurchasePressed,
    required this.onUnavailablePressed,
  });

  final SupportProduct product;
  final VoidCallback onPurchasePressed;
  final VoidCallback onUnavailablePressed;

  @override
  Widget build(BuildContext context) {
    final priceLabel = product.priceLabel ?? 'Yakında aktif olacak';
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
                      product.title,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      product.description,
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Text(
                priceLabel,
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      color: AppColors.textMuted,
                    ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: product.isAvailable
                  ? onPurchasePressed
                  : onUnavailablePressed,
              icon: const Icon(Icons.lock_clock_rounded),
              label: Text(
                product.isAvailable ? 'Destek ol' : 'Yakında aktif olacak',
              ),
            ),
          ),
        ],
      ),
    );
  }
}
