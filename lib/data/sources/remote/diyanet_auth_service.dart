import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

class DiyanetAuthService {
  DiyanetAuthService({
    http.Client? client,
    String userName = 'uckun.burak@gmail.com',
    String password = '7D-aK+y3',
  })  : _client = client ?? http.Client(),
        _userName = userName,
        _password = password;

  static final Uri _loginUri = Uri.parse(
    'https://awqatsalah.diyanet.gov.tr/Auth/Login',
  );

  final http.Client _client;
  final String _userName;
  final String _password;
  int? lastStatusCode;
  String? lastResponseBody;

  Future<String> login() async {
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
    debugPrint('LOGIN TARGET: $_loginUri');
    debugPrint('LOGIN PAYLOAD SHAPE: $payloadShape');
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
    debugPrint('LOGIN STATUS: ${response.statusCode}');
    debugPrint('LOGIN BODY: ${response.body}');
    return response;
  }

  String _accessTokenFromResponse(http.Response response) {
    if (response.statusCode != 200) {
      throw DiyanetAuthException(
        'Diyanet login failed with status ${response.statusCode}. '
        'Body: ${response.body}',
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
      parts.add('Body: $responseBody');
    }
    if (cause != null) {
      parts.add('Cause: $cause');
    }
    return parts.join(' ');
  }
}
