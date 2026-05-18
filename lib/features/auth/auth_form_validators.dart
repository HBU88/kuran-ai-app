class AuthFormValidators {
  const AuthFormValidators._();

  static final _emailPattern = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');

  static String? email(String? value) {
    final text = value?.trim() ?? '';
    if (text.isEmpty) return 'E-posta gerekli.';
    if (!_emailPattern.hasMatch(text)) return 'Geçerli bir e-posta yaz.';
    return null;
  }

  static String? password(String? value) {
    final text = value ?? '';
    if (text.isEmpty) return 'Şifre gerekli.';
    if (text.length < 8) return 'Şifre en az 8 karakter olmalı.';
    return null;
  }
}
