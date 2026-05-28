import 'dart:convert';

import 'package:http/http.dart' as http;

class DiyanetAuthService {
  DiyanetAuthService({
    http.Client? client,
    String? userName,
    String? password,
  })  : _client = client ?? http.Client(),
        _userName = (userName ?? _defaultUserName).trim(),
        _password = password ?? _defaultPassword;

  static final Uri _loginUri = Uri.parse(
    const String.fromEnvironment(
      'DIYANET_AUTH_URL',
      defaultValue: 'https://awqatsalah.diyanet.gov.tr/Auth/Login',
    ),
  );
  static const _defaultUserName = String.fromEnvironment(
    'DIYANET_API_USERNAME',
    defaultValue: '',
  );
  static const _defaultPassword = String.fromEnvironment(
    'DIYANET_API_PASSWORD',
    defaultValue: '',
  );

  final http.Client _client;
  final String _userName;
  final String _password;
  int? lastStatusCode;
  String? lastResponseBody;

  bool get isConfigured => _userName.isNotEmpty && _password.isNotEmpty;

  Future<String> login() async {
    if (!isConfigured) {
      throw const DiyanetAuthException(
        'Diyanet credentials are not configured.',
      );
    }

    try {
      final response = await _postLogin(
        payload: {
          'email': _userName,
          'password': _password,
        },
        payloadShape: 'email/password',
      );

      if (_shouldRetryWithCSharpPayload(response)) {
        final retryResponse = await _postLogin(
          payload: {
            'Email': _userName,
            'Password': _password,
          },
          payloadShape: 'Email/Password',
        );
        return _accessTokenFromResponse(retryResponse);
      }

      return _accessTokenFromResponse(response);
    } on FormatException catch (error) {
      throw DiyanetAuthException(
        'Diyanet login response could not be parsed.',
        cause: error,
        statusCode: lastStatusCode,
        responseBody: lastResponseBody,
      );
    } on http.ClientException catch (error) {
      throw DiyanetAuthException(
        'Diyanet login request failed.',
        cause: error,
      );
    }
  }

  Future<http.Response> _postLogin({
    required Map<String, String> payload,
    required String payloadShape,
  }) async {
    final response = await _client.post(
      _loginUri,
      headers: const {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: jsonEncode(payload),
    );
    lastStatusCode = response.statusCode;
    lastResponseBody = response.body;
    return response;
  }

  String _accessTokenFromResponse(http.Response response) {
    if (response.statusCode != 200) {
      throw DiyanetAuthException(
        'Diyanet login failed with status ${response.statusCode}.',
        statusCode: response.statusCode,
        responseBody: response.body,
      );
    }

    final decoded = jsonDecode(response.body);
    if (decoded is! Map<String, dynamic>) {
      throw DiyanetAuthException(
        'Diyanet login response was not a JSON object.',
        statusCode: response.statusCode,
        responseBody: response.body,
      );
    }

    final accessToken = _readAccessToken(decoded);
    if (accessToken is! String || accessToken.isEmpty) {
      throw DiyanetAuthException(
        'Diyanet login response did not include accessToken.',
        statusCode: response.statusCode,
        responseBody: response.body,
      );
    }

    return accessToken;
  }

  bool _shouldRetryWithCSharpPayload(http.Response response) {
    if (response.statusCode != 406) {
      return false;
    }
    final body = response.body.toLowerCase();
    return body.contains('email') || body.contains('e-posta');
  }

  String? _readAccessToken(Map<String, dynamic> json) {
    for (final key in const ['accessToken', 'access_token', 'token']) {
      final value = json[key];
      if (value is String && value.isNotEmpty) {
        return value;
      }
    }

    final data = json['data'];
    if (data is Map<String, dynamic>) {
      return _readAccessToken(data);
    }

    return null;
  }
}

class DiyanetAuthException implements Exception {
  const DiyanetAuthException(
    this.message, {
    this.cause,
    this.statusCode,
    this.responseBody,
  });

  final String message;
  final Object? cause;
  final int? statusCode;
  final String? responseBody;

  @override
  String toString() {
    final parts = [message];
    if (statusCode != null) {
      parts.add('Status: $statusCode');
    }
    if (responseBody != null && responseBody!.isNotEmpty) {
      parts.add('Body length: ${responseBody!.length}');
    }
    if (cause != null) {
      parts.add('Cause: $cause');
    }
    return parts.join(' ');
  }
}
