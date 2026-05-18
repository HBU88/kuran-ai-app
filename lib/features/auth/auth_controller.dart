import 'package:flutter/foundation.dart';

import '../../data/models/auth_user_model.dart';
import '../../data/sources/remote/auth_service.dart';

class AuthController extends ChangeNotifier {
  AuthController(this._service);

  final AuthService _service;

  AuthUserModel? user;
  bool isBusy = false;
  String? errorMessage;
  String? infoMessage;

  bool get isLoggedIn => user != null && _service.isLoggedIn;

  Future<bool> login({
    required String email,
    required String password,
  }) async {
    return _run(() async {
      final session = await _service.login(email: email, password: password);
      user = session.user;
    });
  }

  Future<bool> register({
    required String email,
    required String password,
    required bool termsAccepted,
    required bool privacyPolicyAccepted,
    required bool marketingConsent,
    required bool adPersonalizationConsent,
  }) async {
    return _run(() async {
      final session = await _service.register(
        email: email,
        password: password,
        termsAccepted: termsAccepted,
        privacyPolicyAccepted: privacyPolicyAccepted,
        marketingConsent: marketingConsent,
        adPersonalizationConsent: adPersonalizationConsent,
      );
      user = session.user;
    });
  }

  Future<void> logout() async {
    isBusy = true;
    errorMessage = null;
    notifyListeners();
    await _service.logout();
    user = null;
    isBusy = false;
    notifyListeners();
  }

  Future<bool> deleteAccount() async {
    isBusy = true;
    errorMessage = null;
    infoMessage = null;
    notifyListeners();
    try {
      await _service.deleteAccount();
      user = null;
      infoMessage = 'Hesabın silindi. Misafir olarak devam edebilirsin.';
      isBusy = false;
      notifyListeners();
      return true;
    } on AuthServiceException catch (error) {
      errorMessage = error.message;
    } catch (_) {
      errorMessage = 'Hesap silme işlemi tamamlanamadı.';
    }
    isBusy = false;
    notifyListeners();
    return false;
  }

  Future<bool> forgotPassword({
    required String email,
  }) async {
    return _run(() async {
      infoMessage = await _service.forgotPassword(email: email);
    });
  }

  Future<bool> resetPassword({
    required String token,
    required String newPassword,
  }) async {
    return _run(() async {
      await _service.resetPassword(token: token, newPassword: newPassword);
      infoMessage = 'Şifren yenilendi. Yeni şifrenle giriş yapabilirsin.';
    });
  }

  Future<bool> _run(Future<void> Function() action) async {
    isBusy = true;
    errorMessage = null;
    infoMessage = null;
    notifyListeners();
    try {
      await action();
      isBusy = false;
      notifyListeners();
      return true;
    } on AuthServiceException catch (error) {
      errorMessage = error.message;
    } catch (_) {
      errorMessage = 'İşlem tamamlanamadı. Lütfen tekrar deneyin.';
    }
    isBusy = false;
    notifyListeners();
    return false;
  }
}
