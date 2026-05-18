import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import '../../../core/constants/app_constants.dart';
import '../../../features/chat/chat_mode.dart';

class ChatAgentService {
  ChatAgentService({
    http.Client? client,
    String baseUrl = AppConstants.backendApiBaseUrl,
    this.requestTimeout = const Duration(seconds: 12),
  })  : _client = client ?? http.Client(),
        _baseUrl = baseUrl;

  final http.Client _client;
  final String _baseUrl;
  final Duration requestTimeout;

  Future<Map<String, dynamic>> sendMessage(
    String message, {
    List<Map<String, dynamic>> history = const [],
    ChatMode mode = ChatMode.chat,
  }) async {
    final target = Uri.parse('$_baseUrl${mode.endpointPath}');
    final requestBody = {'message': message, 'history': history};
    http.Response response;
    try {
      response = await _client
          .post(
            target,
            headers: const {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            },
            body: jsonEncode(requestBody),
          )
          .timeout(requestTimeout);
    } on TimeoutException catch (error) {
      throw ChatAgentException(
        'Şu anda bağlantı kurulamadı. Lütfen tekrar deneyin.',
        isTimeout: true,
        isTransient: true,
        originalError: error,
      );
    } on SocketException catch (error) {
      throw ChatAgentException(
        'Şu anda bağlantı kurulamadı. Lütfen tekrar deneyin.',
        isNetworkError: true,
        isTransient: true,
        originalError: error,
      );
    } on http.ClientException catch (error) {
      throw ChatAgentException(
        'Şu anda bağlantı kurulamadı. Lütfen tekrar deneyin.',
        isNetworkError: true,
        isTransient: true,
        originalError: error,
      );
    }
    final decodedBody = utf8.decode(response.bodyBytes);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      final parsedError = _readParsedError(decodedBody);
      throw ChatAgentException(
        'Şu anda bağlantı kurulamadı. Lütfen tekrar deneyin.',
        statusCode: response.statusCode,
        responseBody: decodedBody,
        parsedErrorMessage: parsedError,
        isTransient: true,
      );
    }

    final decoded = jsonDecode(decodedBody);
    if (decoded is! Map<String, dynamic>) {
      throw ChatAgentException(
        'HAKAI response was not a JSON object.',
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
    this.originalError,
    this.isTimeout = false,
    this.isNetworkError = false,
    this.isTransient = false,
  });

  final String message;
  final int? statusCode;
  final String? responseBody;
  final String? parsedErrorMessage;
  final Object? originalError;
  final bool isTimeout;
  final bool isNetworkError;
  final bool isTransient;

  bool get showRetryAction => isTimeout || isNetworkError || isTransient;

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
    if (originalError != null) {
      parts.add('Cause: $originalError');
    }
    return parts.join(' ');
  }
}
