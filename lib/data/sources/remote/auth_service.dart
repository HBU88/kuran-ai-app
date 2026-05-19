import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../../../core/constants/app_constants.dart';
import '../../models/auth_user_model.dart';

class AuthService {
  AuthService({
    http.Client? client,
    String baseUrl = AppConstants.backendApiBaseUrl,
    this.requestTimeout = const Duration(seconds: 12),
  })  : _client = client ?? http.Client(),
        _baseUrl = _resolveBaseUrl(baseUrl);

  final http.Client _client;
  final String _baseUrl;
  final Duration requestTimeout;

  String? _accessToken;

  bool get isLoggedIn => _accessToken != null;

  // Tokens are intentionally memory-only for now. Do not persist bearer tokens
  // in SharedPreferences; move to Keychain/Keystore-backed secure storage when
  // the login UI is enabled.
  String? get accessTokenForCurrentSession => _accessToken;

  Future<AuthSession> register({
    required String email,
    required String password,
    required bool termsAccepted,
    required bool privacyPolicyAccepted,
    bool marketingConsent = false,
    bool adPersonalizationConsent = false,
  }) {
    return _postAuth('/auth/register', {
      'email': email,
      'password': password,
      'terms_accepted': termsAccepted,
      'privacy_policy_accepted': privacyPolicyAccepted,
      'marketing_consent': marketingConsent,
      'ad_personalization_consent': adPersonalizationConsent,
    });
  }

  Future<AuthSession> login({
    required String email,
    required String password,
  }) {
    return _postAuth('/auth/login', {
      'email': email,
      'password': password,
    });
  }

  Future<AuthUserModel> me() async {
    final token = _accessToken;
    if (token == null) {
      throw const AuthServiceException('Oturum bulunamadı.');
    }

    final response = await _send(
      () => _client.get(
        Uri.parse('$_baseUrl/me'),
        headers: {
          'Accept': 'application/json',
          'Authorization': 'Bearer $token',
        },
      ),
    );
    final decoded = _decodeObject(response);
    final user = decoded['user'];
    if (user is! Map<String, dynamic>) {
      throw const AuthServiceException('Kullanıcı yanıtı okunamadı.');
    }
    return AuthUserModel.fromJson(user);
  }

  Future<String> forgotPassword({
    required String email,
  }) async {
    final response = await _send(
      () => _client.post(
        Uri.parse('$_baseUrl/auth/forgot-password'),
        headers: const {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({'email': email}),
      ),
    );
    final decoded = _decodeObject(response);
    return decoded['message']?.toString() ??
        'Eğer bu e-posta adresiyle kayıtlı bir hesap varsa, şifre yenileme bağlantısı gönderilecektir.';
  }

  Future<void> resetPassword({
    required String token,
    required String newPassword,
  }) async {
    await _send(
      () => _client.post(
        Uri.parse('$_baseUrl/auth/reset-password'),
        headers: const {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'token': token,
          'new_password': newPassword,
        }),
      ),
    );
  }

  Future<void> logout() async {
    final token = _accessToken;
    _accessToken = null;
    if (token == null) return;

    try {
      await _send(
        () => _client.post(
          Uri.parse('$_baseUrl/auth/logout'),
          headers: {
            'Accept': 'application/json',
            'Authorization': 'Bearer $token',
          },
        ),
      );
    } on AuthServiceException {
      // Logout remains client-side token deletion with JWT bearer auth.
    }
  }

  Future<void> deleteAccount() async {
    final token = _accessToken;
    if (token == null) {
      throw const AuthServiceException('Oturum bulunamadı.');
    }

    await _send(
      () => _client.delete(
        Uri.parse('$_baseUrl/me'),
        headers: {
          'Accept': 'application/json',
          'Authorization': 'Bearer $token',
        },
      ),
    );
    _accessToken = null;
  }

  Future<AuthSession> _postAuth(
    String path,
    Map<String, dynamic> body,
  ) async {
    final response = await _send(
      () => _client.post(
        Uri.parse('$_baseUrl$path'),
        headers: const {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: jsonEncode(body),
      ),
    );
    final decoded = _decodeObject(response);
    final user = decoded['user'];
    final token = decoded['token'];
    if (user is! Map<String, dynamic> || token is! String || token.isEmpty) {
      throw const AuthServiceException('Oturum yanıtı okunamadı.');
    }
    _accessToken = token;
    return AuthSession(
      user: AuthUserModel.fromJson(user),
      accessToken: token,
    );
  }

  Future<http.Response> _send(Future<http.Response> Function() request) async {
    try {
      final response = await request().timeout(requestTimeout);
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw AuthServiceException(
          _readError(response) ?? 'Kimlik doğrulama isteği başarısız oldu.',
          statusCode: response.statusCode,
        );
      }
      return response;
    } on TimeoutException catch (error) {
      throw AuthServiceException(
        'Şu anda bağlantı kurulamadı. Lütfen tekrar deneyin.',
        originalError: error,
      );
    } on SocketException catch (error) {
      throw AuthServiceException(
        'Şu anda bağlantı kurulamadı. Lütfen tekrar deneyin.',
        originalError: error,
      );
    } on http.ClientException catch (error) {
      throw AuthServiceException(
        'Şu anda bağlantı kurulamadı. Lütfen tekrar deneyin.',
        originalError: error,
      );
    }
  }

  Map<String, dynamic> _decodeObject(http.Response response) {
    final decoded = jsonDecode(utf8.decode(response.bodyBytes));
    if (decoded is! Map<String, dynamic>) {
      throw AuthServiceException(
        'HAKAI auth response was not a JSON object.',
        statusCode: response.statusCode,
      );
    }
    return decoded;
  }

  String? _readError(http.Response response) {
    try {
      final decoded = _decodeObject(response);
      return decoded['error']?.toString();
    } catch (_) {
      return null;
    }
  }

  static String _resolveBaseUrl(String configuredBaseUrl) {
    final value = configuredBaseUrl.trim();
    if (value.isEmpty) {
      if (kReleaseMode || Platform.isIOS) {
        return AppConstants.productionBackendApiBaseUrl;
      }
      return 'http://10.0.2.2:3000';
    }

    final uri = Uri.tryParse(value);
    final host = uri?.host.toLowerCase() ?? '';
    final isLocalhost =
        host == 'localhost' || host == '127.0.0.1' || host == '10.0.2.2';
    if (kReleaseMode && isLocalhost) {
      throw const AuthServiceException(
        'HAKAI_API_BASE_URL release için localhost olamaz.',
        isConfigurationError: true,
      );
    }
    return value;
  }
}

class AuthSession {
  const AuthSession({
    required this.user,
    required this.accessToken,
  });

  final AuthUserModel user;
  final String accessToken;
}

class AuthServiceException implements Exception {
  const AuthServiceException(
    this.message, {
    this.statusCode,
    this.originalError,
    this.isConfigurationError = false,
  });

  final String message;
  final int? statusCode;
  final Object? originalError;
  final bool isConfigurationError;

  @override
  String toString() {
    final parts = [message];
    if (statusCode != null) {
      parts.add('Status: $statusCode');
    }
    if (originalError != null) {
      parts.add('Cause: $originalError');
    }
    return parts.join(' ');
  }
}
