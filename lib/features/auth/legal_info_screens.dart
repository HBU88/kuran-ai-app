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
              'HAKAI, Kur’an merkezli günlük manevi rehberlik sunar. Uygulama misafir olarak kullanılabilir; hesap oluşturmak isteğe bağlıdır.',
        ),
        _LegalSection(
          title: 'Kişisel veri yaklaşımı',
          body:
              'HAKAI kişisel verilerini satmaz. Hesap oluşturursan e-posta adresin, şifre özetin ve onay zamanların saklanabilir. Şifren düz metin olarak saklanmaz.',
        ),
        _LegalSection(
          title: 'Misafir kullanım',
          body:
              'Giriş yapmadan Ayet Rehberi, Dinî Bilgiler ve diğer temel alanları kullanabilirsin. Misafir kullanım hesap verisi oluşturmaz.',
        ),
        _LegalSection(
          title: 'Mesajların işlenmesi',
          body:
              'Yazdığın mesajlar yanıt oluşturmak için geçici olarak işlenebilir. HAKAI, gereğinden fazla kişisel veri toplamamaya özen gösterir.',
        ),
        _LegalSection(
          title: 'Reklam ve takip',
          body:
              'HAKAI içinde reklam SDK’sı, takip SDK’sı, IDFA veya AppTrackingTransparency izni kullanılmaz.',
        ),
        _LegalSection(
          title: 'Önerilen kaynaklar',
          body:
              '“Bu konuda önerilen kaynaklar” kartları yerel ve etiket temelli olarak gösterilir. Bu öneriler kullanıcı profili oluşturmak veya kişisel takip yapmak için kullanılmaz.',
        ),
        _LegalSection(
          title: 'Dış bağlantılar',
          body:
              'Önerilen kaynaklardaki dış bağlantılar yalnızca kullanıcı karta dokunduğunda açılır. HAKAI arka planda dış bağlantı açmaz.',
        ),
        _LegalSection(
          title: 'Uygulama içi destek',
          body:
              'HAKAI’ye destek seçenekleri App Store In-App Purchase üzerinden sunulur. Dış ödeme bağlantısı, banka hesabı veya uygulama dışı ödeme yönlendirmesi kullanılmaz.',
        ),
        _LegalSection(
          title: 'Konum izni',
          body:
              'Konum izni yalnızca Kıble yönü ve etkinse namaz vaktiyle ilgili konum özellikleri için kullanılır. Kıble hesabı, bulunduğun konum ile Kâbe koordinatları arasındaki yöne dayanır.',
        ),
        _LegalSection(
          title: 'Dinî içerik sınırı',
          body:
              'HAKAI bir fetva makamı değildir. Bağlayıcı dinî konularda Diyanet İşleri Başkanlığı veya ehil uzmanlara başvurulmalıdır.',
        ),
        _LegalSection(
          title: 'Sorumluluk',
          body:
              'Uygulamadaki bilgiler genel rehberlik amaçlıdır. Önemli kararlar için güvenilir kaynaklar ve yetkin kişilerle birlikte değerlendirme yapılmalıdır.',
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
              'HAKAI, Kur’an merkezli manevi rehberlik ve günlük destek sunar. Uygulama bir fetva makamı değildir.',
        ),
        _LegalSection(
          title: 'Sınırlar',
          body:
              'HAKAI, ehil din âlimlerinin, resmî dinî kurumların, doktorların, hukuk danışmanlarının, finansal danışmanların veya acil yardım birimlerinin yerine geçmez.',
        ),
        _LegalSection(
          title: 'Hassas konular',
          body:
              'Dinî hüküm, sağlık, psikoloji, hukuk, şiddet, kendine zarar verme veya acil durum içeren konularda uygun ve yetkin kişilerden destek alman gerekir.',
        ),
        _LegalSection(
          title: 'Kullanım sorumluluğu',
          body:
              'Uygulamadaki içerikler genel bilgilendirme ve manevi destek amacı taşır. Yanıtlar tek başına kesin karar veya bağlayıcı hüküm yerine kullanılmamalıdır.',
        ),
        _LegalSection(
          title: 'Uygulama içi destek',
          body:
              'HAKAI’ye destek satın almaları tamamen isteğe bağlıdır. Destek vermek temel dinî içeriklere erişimi açmaz, kapatmaz veya kullanıcıya dinî bir üstünlük sağlamaz.',
        ),
        _LegalSection(
          title: 'Önerilen kaynaklar',
          body:
              'Önerilen dış kaynaklar kullanıcı dokunduğunda uygulama dışında açılır. Bu kaynakların içerik, hizmet ve gizlilik uygulamaları ilgili sağlayıcıların sorumluluğundadır.',
        ),
        _LegalSection(
          title: 'Sorumluluk sınırı',
          body:
              'HAKAI, bilgileri dikkatle sunmayı amaçlar; ancak yanıtların her durumda eksiksiz, hatasız veya kişisel durumuna uygun olacağını garanti etmez.',
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

class AboutSourcesScreen extends StatelessWidget {
  const AboutSourcesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const _LegalArticleScreen(
      title: 'Hakkında ve Kaynaklar',
      sections: [
        _LegalSection(
          title: 'Kıble yönü',
          body:
              'Kıble yönü, bulunduğunuz konum ile Kâbe koordinatları arasındaki büyük daire başlangıç yönü hesaplanarak belirlenir. Kâbe koordinatları: 21.4224779, 39.8251832.',
        ),
        _LegalSection(
          title: 'Pusula',
          body:
              'Pusula doğruluğu cihaz sensörleri, manyetik alan etkileri ve konum servislerinin doğruluğuna bağlıdır.',
        ),
        _LegalSection(
          title: 'Ayet içerikleri',
          body:
              'Ayet yönlendirmeleri Kur’an merkezli olarak hazırlanır; dinî hüküm/fetva amacı taşımaz.',
        ),
        _LegalSection(
          title: 'Sesli okuma',
          body:
              'Kur’an sesli okuma özelliği, doğrulanmış kârî kayıtları üzerinden sunulmalıdır. Ses kaynakları ve kullanım koşulları ayrıca belirtilir; yapay zekâ ile üretilmiş Kur’an tilaveti kullanılmaz.',
        ),
        _LegalSection(
          title: 'Dinî bilgiler',
          body:
              'Dinî bilgiler modülü genel bilgilendirme amacı taşır. Detaylı ve bağlayıcı dinî konularda Diyanet İşleri Başkanlığı veya ehil uzmanlara başvurulmalıdır.',
        ),
        _LegalSection(
          title: 'Referans notları',
          body:
              'Kur’an ve dua içerikleri güvenilir kaynaklarla doğrulanarak sunulmalıdır. Bağlayıcı dinî konularda Diyanet İşleri Başkanlığı veya ehil uzmanlara başvurulmalıdır.',
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
