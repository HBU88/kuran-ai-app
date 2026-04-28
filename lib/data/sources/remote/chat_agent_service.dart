import 'dart:convert';

import 'package:http/http.dart' as http;

class ChatAgentService {
  ChatAgentService({
    http.Client? client,
    String baseUrl = 'http://10.0.2.2:3000',
  })  : _client = client ?? http.Client(),
        _baseUrl = baseUrl;

  final http.Client _client;
  final String _baseUrl;

  Future<Map<String, dynamic>> sendMessage(
    String message, {
    List<Map<String, dynamic>> history = const [],
  }) async {
    final target = Uri.parse('$_baseUrl/chat');
    final requestBody = {
      'message': message,
      'history': history,
    };
    final response = await _client.post(
      target,
      headers: const {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: jsonEncode(requestBody),
    );
    final decodedBody = utf8.decode(response.bodyBytes);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      final parsedError = _readParsedError(decodedBody);
      throw ChatAgentException(
        'Chat agent request failed with status ${response.statusCode}. '
        'Body: $decodedBody',
        statusCode: response.statusCode,
        responseBody: decodedBody,
        parsedErrorMessage: parsedError,
      );
    }

    final decoded = jsonDecode(decodedBody);
    if (decoded is! Map<String, dynamic>) {
      throw ChatAgentException(
        'Chat agent response was not a JSON object.',
        statusCode: response.statusCode,
        responseBody: decodedBody,
      );
    }

    return Map<String, dynamic>.from(decoded);
  }

  String? _readParsedError(String body) {
    try {
      final decoded = jsonDecode(body);
      if (decoded is Map<String, dynamic>) {
        return decoded['error']?.toString() ?? decoded['detail']?.toString();
      }
    } catch (_) {
      return null;
    }
    return null;
  }
}

class ChatAgentException implements Exception {
  const ChatAgentException(
    this.message, {
    this.statusCode,
    this.responseBody,
    this.parsedErrorMessage,
  });

  final String message;
  final int? statusCode;
  final String? responseBody;
  final String? parsedErrorMessage;

  @override
  String toString() {
    final parts = [message];
    if (statusCode != null) {
      parts.add('Status: $statusCode');
    }
    if (responseBody != null && responseBody!.isNotEmpty) {
      parts.add('Body: $responseBody');
    }
    if (parsedErrorMessage != null && parsedErrorMessage!.isNotEmpty) {
      parts.add('Parsed error: $parsedErrorMessage');
    }
    return parts.join(' ');
  }
}
