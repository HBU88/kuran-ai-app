import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/constants/app_routes.dart';
import '../../shared/widgets/app_card.dart';
import '../../shared/widgets/app_gradient_background.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_spacing.dart';
import 'auth_controller.dart';

class PrivacyPolicyScreen extends StatelessWidget {
  const PrivacyPolicyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const _LegalArticleScreen(
      title: 'Gizlilik Politikası',
      sections: [
        _LegalSection(
          title: 'Kısa özet',
          body:
              'HAKAI, Kur’an merkezli manevi rehberlik sunan günlük bir yol arkadaşıdır. Uygulama misafir olarak kullanılabilir; hesap oluşturmak isteğe bağlıdır.',
        ),
        _LegalSection(
          title: 'Hesap verileri',
          body:
              'Hesap oluşturursan e-posta adresin, şifre özetin, şartlar ve gizlilik kabul zamanların, pazarlama izni ve reklam kişiselleştirme izni saklanır. Şifren düz metin olarak saklanmaz.',
        ),
        _LegalSection(
          title: 'Misafir kullanım',
          body:
              'Giriş yapmadan Ayet Rehberi, Dinî Bilgiler ve diğer temel alanları kullanabilirsin. Misafir kullanım hesap verisi oluşturmaz.',
        ),
        _LegalSection(
          title: 'Sohbet ve günlükler',
          body:
              'Sohbet mesajların yanıt üretmek için işlenebilir. Günlükler mümkün olduğunca azaltılır; üretim ortamında ayrıntılı sohbet günlükleri kapalı tutulacak şekilde tasarlanmıştır.',
        ),
        _LegalSection(
          title: 'Reklam ve profilleme',
          body:
              'HAKAI, sohbet içeriğinden hassas dinî reklam profili çıkarmaz ve saklamaz. Pazarlama izni ve reklam kişiselleştirme izni varsayılan olarak kapalıdır. Şu anda reklam veya affiliate bağlantı aktif değildir.',
        ),
        _LegalSection(
          title: 'Destek ve ödeme',
          body:
              'İleride projeyi destekleme seçenekleri Apple uyumlu uygulama içi satın alma ile eklenebilir. Bu görevde ödeme, reklam veya harici ödeme bağlantısı etkinleştirilmemiştir.',
        ),
        _LegalSection(
          title: 'Veri talepleri',
          body:
              'Hesap verilerini silme talebini uygulama içinden başlatabilirsin. Veri erişimi veya destek için iletişim adresi eklenecek. TODO: destek e-posta adresi.',
        ),
      ],
    );
  }
}

class TermsOfUseScreen extends StatelessWidget {
  const TermsOfUseScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const _LegalArticleScreen(
      title: 'Kullanım Şartları',
      sections: [
        _LegalSection(
          title: 'Amaç',
          body:
              'HAKAI, Kur’an merkezli manevi rehberlik ve kısa destek sunar. Uygulama bir fetva makamı değildir.',
        ),
        _LegalSection(
          title: 'Sınırlar',
          body:
              'HAKAI, ehil din âlimlerinin, resmî dinî kurumların, sağlık uzmanlarının, hukuk danışmanlarının veya acil yardım birimlerinin yerine geçmez.',
        ),
        _LegalSection(
          title: 'Hassas konular',
          body:
              'Dinî hüküm, sağlık, psikoloji, hukuk, şiddet, kendine zarar verme veya acil durum içeren konularda uygun ve yetkin kişilerden destek alman gerekir.',
        ),
        _LegalSection(
          title: 'Destek seçenekleri',
          body:
              'Destek ödemeleri ileride aktif olursa tamamen isteğe bağlıdır. Destek vermek manevî üstünlük, dinî fayda veya temel özelliklere ayrıcalıklı erişim anlamına gelmez.',
        ),
        _LegalSection(
          title: 'Temel kullanım',
          body:
              'Misafir kullanım ve temel rehberlik alanları uygulamanın tasarlandığı şekilde erişilebilir kalır.',
        ),
      ],
    );
  }
}

class GuidanceDisclaimerScreen extends StatelessWidget {
  const GuidanceDisclaimerScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const _LegalArticleScreen(
      title: 'Dinî İçerik ve Yapay Zekâ Açıklaması',
      sections: [
        _LegalSection(
          title: 'Yapay zekâ desteği',
          body:
              'HAKAI yanıtları yapay zekâ desteğiyle üretebilir. Bu yanıtlar eksik, hatalı veya bağlamına göre yetersiz olabilir.',
        ),
        _LegalSection(
          title: 'Kaynak kontrolü',
          body:
              'Kur’an meali, yorum ve ayet bağlamı güvenilir kaynaklarla birlikte değerlendirilmelidir. Önemli kararlar için tek başına uygulama yanıtına dayanma.',
        ),
        _LegalSection(
          title: 'Dinî hükümler',
          body:
              'Fetva veya bağlayıcı dinî hüküm gereken durumlarda ehil âlimlere ya da güvenilir kurumlara danışmalısın.',
        ),
        _LegalSection(
          title: 'Profesyonel destek',
          body:
              'Tıbbî, psikolojik, hukukî, kendine zarar verme, şiddet veya acil durumlarda uygun profesyonel destek ya da yerel acil yardım birimleriyle iletişime geç.',
        ),
      ],
    );
  }
}

class DataAccountScreen extends StatelessWidget {
  const DataAccountScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Hesap ve Verilerim')),
      body: AppGradientBackground(
        child: Consumer<AuthController>(
          builder: (context, controller, _) {
            return ListView(
              padding: const EdgeInsets.fromLTRB(18, 10, 18, 28),
              children: [
                AppCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Veri ve hesap durumu',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        controller.isLoggedIn
                            ? 'Aktif hesabın: ${controller.user?.email ?? ''}'
                            : 'Şu anda misafir olarak kullanıyorsun. Aktif bir hesap olmadığı için silinecek hesap verisi yok.',
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                      const SizedBox(height: 12),
                      const Text(
                        'Misafir kullanım devam eder. Hesap silme işlemi yalnızca oturum açılmış kullanıcı kaydını hedefler.',
                      ),
                      if (controller.errorMessage != null) ...[
                        const SizedBox(height: 12),
                        Text(
                          controller.errorMessage!,
                          style:
                              Theme.of(context).textTheme.bodySmall?.copyWith(
                                    color: AppColors.primaryAccentSoft,
                                  ),
                        ),
                      ],
                      if (controller.infoMessage != null) ...[
                        const SizedBox(height: 12),
                        Text(
                          controller.infoMessage!,
                          style:
                              Theme.of(context).textTheme.bodySmall?.copyWith(
                                    color: AppColors.primaryAccent,
                                  ),
                        ),
                      ],
                      const SizedBox(height: 18),
                      if (controller.isLoggedIn)
                        OutlinedButton.icon(
                          onPressed: controller.isBusy
                              ? null
                              : () => _confirmDelete(context, controller),
                          icon: const Icon(Icons.delete_outline_rounded),
                          label: const Text('Hesabımı Sil'),
                        )
                      else
                        FilledButton.icon(
                          onPressed: () =>
                              Navigator.pushNamed(context, AppRoutes.login),
                          icon: const Icon(Icons.login_rounded),
                          label: const Text('Giriş yap'),
                        ),
                    ],
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  Future<void> _confirmDelete(
    BuildContext context,
    AuthController controller,
  ) async {
    final shouldDelete = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          title: const Text('Hesabımı Sil'),
          content: const Text(
            'Bu işlem hesabınızı ve ilişkili yerel kullanıcı verilerinizi siler. Devam etmek istiyor musunuz?',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: const Text('Vazgeç'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(dialogContext, true),
              child: const Text('Sil'),
            ),
          ],
        );
      },
    );
    if (shouldDelete != true || !context.mounted) return;
    final deleted = await controller.deleteAccount();
    if (!context.mounted || !deleted) return;
    Navigator.pushNamedAndRemoveUntil(
      context,
      AppRoutes.home,
      (route) => false,
    );
  }
}

class _LegalArticleScreen extends StatelessWidget {
  const _LegalArticleScreen({
    required this.title,
    required this.sections,
  });

  final String title;
  final List<_LegalSection> sections;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: AppGradientBackground(
        child: ListView.separated(
          padding: const EdgeInsets.fromLTRB(18, 10, 18, 28),
          itemBuilder: (context, index) {
            final section = sections[index];
            return AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    section.title,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                  ),
                  const SizedBox(height: 8),
                  Text(section.body),
                ],
              ),
            );
          },
          separatorBuilder: (_, __) =>
              const SizedBox(height: AppSpacing.medium),
          itemCount: sections.length,
        ),
      ),
    );
  }
}

class _LegalSection {
  const _LegalSection({
    required this.title,
    required this.body,
  });

  final String title;
  final String body;
}
