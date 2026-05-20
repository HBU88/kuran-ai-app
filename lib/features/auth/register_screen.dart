import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/constants/app_routes.dart';
import '../../shared/widgets/app_card.dart';
import '../../shared/widgets/app_gradient_background.dart';
import '../../theme/app_colors.dart';
import 'auth_controller.dart';
import 'auth_form_validators.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;
  bool _termsAccepted = false;
  bool _privacyAccepted = false;
  bool _marketingConsent = false;
  bool _adPersonalizationConsent = false;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Kayıt ol')),
      body: AppGradientBackground(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(18, 10, 18, 28),
          children: [
            AppCard(
              child: Form(
                key: _formKey,
                child: Consumer<AuthController>(
                  builder: (context, controller, _) {
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'İsteğe bağlı üyelik',
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Üyelik, gelecekte kayıtlı tercihler, favoriler, geçmiş, ek hesap seçenekleri ve projeye destek özellikleri için hazırlanır. Pazarlama ve kişiselleştirme izinleri isteğe bağlıdır.',
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                        const SizedBox(height: 18),
                        TextFormField(
                          controller: _emailController,
                          keyboardType: TextInputType.emailAddress,
                          autofillHints: const [AutofillHints.email],
                          decoration: const InputDecoration(
                            labelText: 'E-posta',
                            prefixIcon: Icon(Icons.mail_outline_rounded),
                          ),
                          validator: AuthFormValidators.email,
                        ),
                        const SizedBox(height: 12),
                        TextFormField(
                          controller: _passwordController,
                          obscureText: _obscurePassword,
                          autofillHints: const [AutofillHints.newPassword],
                          decoration: InputDecoration(
                            labelText: 'Şifre',
                            prefixIcon: const Icon(Icons.lock_outline_rounded),
                            suffixIcon: IconButton(
                              tooltip: _obscurePassword
                                  ? 'Şifreyi göster'
                                  : 'Şifreyi gizle',
                              onPressed: () => setState(
                                () => _obscurePassword = !_obscurePassword,
                              ),
                              icon: Icon(
                                _obscurePassword
                                    ? Icons.visibility_outlined
                                    : Icons.visibility_off_outlined,
                              ),
                            ),
                          ),
                          validator: AuthFormValidators.password,
                        ),
                        const SizedBox(height: 14),
                        CheckboxListTile(
                          contentPadding: EdgeInsets.zero,
                          value: _termsAccepted,
                          onChanged: (value) => setState(
                            () => _termsAccepted = value ?? false,
                          ),
                          title:
                              const Text('Kullanım şartlarını kabul ediyorum'),
                          controlAffinity: ListTileControlAffinity.leading,
                        ),
                        CheckboxListTile(
                          contentPadding: EdgeInsets.zero,
                          value: _privacyAccepted,
                          onChanged: (value) => setState(
                            () => _privacyAccepted = value ?? false,
                          ),
                          title: const Text(
                              'Gizlilik politikasını kabul ediyorum'),
                          controlAffinity: ListTileControlAffinity.leading,
                        ),
                        CheckboxListTile(
                          contentPadding: EdgeInsets.zero,
                          value: _marketingConsent,
                          onChanged: (value) => setState(
                            () => _marketingConsent = value ?? false,
                          ),
                          title: const Text('Ürün duyuruları alabilirim'),
                          controlAffinity: ListTileControlAffinity.leading,
                        ),
                        CheckboxListTile(
                          contentPadding: EdgeInsets.zero,
                          value: _adPersonalizationConsent,
                          onChanged: (value) => setState(
                            () => _adPersonalizationConsent = value ?? false,
                          ),
                          title: const Text(
                            'Reklam kişiselleştirmesine izin veriyorum',
                          ),
                          controlAffinity: ListTileControlAffinity.leading,
                        ),
                        if (!_termsAccepted || !_privacyAccepted) ...[
                          const SizedBox(height: 6),
                          Text(
                            'Kayıt için kullanım şartları ve gizlilik politikası kabul edilmeli.',
                            style:
                                Theme.of(context).textTheme.bodySmall?.copyWith(
                                      color: AppColors.textMuted,
                                    ),
                          ),
                        ],
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
                        const SizedBox(height: 18),
                        SizedBox(
                          width: double.infinity,
                          child: FilledButton.icon(
                            onPressed:
                                controller.isBusy ? null : () => _submit(),
                            icon: controller.isBusy
                                ? const SizedBox(
                                    width: 18,
                                    height: 18,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                    ),
                                  )
                                : const Icon(Icons.person_add_alt_rounded),
                            label: const Text('Kayıt ol'),
                          ),
                        ),
                        const SizedBox(height: 8),
                        TextButton(
                          onPressed: () => Navigator.pushReplacementNamed(
                            context,
                            AppRoutes.login,
                          ),
                          child: const Text('Hesabın var mı? Giriş yap'),
                        ),
                      ],
                    );
                  },
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (!_termsAccepted || !_privacyAccepted) {
      setState(() {});
      return;
    }

    final controller = context.read<AuthController>();
    final ok = await controller.register(
      email: _emailController.text.trim(),
      password: _passwordController.text,
      termsAccepted: _termsAccepted,
      privacyPolicyAccepted: _privacyAccepted,
      marketingConsent: _marketingConsent,
      adPersonalizationConsent: _adPersonalizationConsent,
    );
    if (!mounted || !ok) return;
    Navigator.pushNamedAndRemoveUntil(
      context,
      AppRoutes.account,
      ModalRoute.withName(AppRoutes.home),
    );
  }
}
