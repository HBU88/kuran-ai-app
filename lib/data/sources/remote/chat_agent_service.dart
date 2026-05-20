import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../../../core/constants/app_constants.dart';
import '../../../features/chat/chat_mode.dart';

class ChatAgentService {
  ChatAgentService({
    http.Client? client,
    String baseUrl = AppConstants.backendApiBaseUrl,
    this.requestTimeout = const Duration(seconds: 45),
  })  : _client = client ?? http.Client(),
        _baseUrl = _resolveBaseUrl(baseUrl);

  final http.Client _client;
  final String _baseUrl;
  final Duration requestTimeout;

  static String _resolveBaseUrl(String configuredBaseUrl) {
    final value = configuredBaseUrl.trim();
    if (value.isEmpty) {
      return AppConstants.resolvedBackendApiBaseUrl;
    }

    final uri = Uri.tryParse(value);
    final host = uri?.host.toLowerCase() ?? '';
    final isLocalhost =
        host == 'localhost' || host == '127.0.0.1' || host == '10.0.2.2';
    if (kReleaseMode && isLocalhost) {
      return AppConstants.productionBackendApiBaseUrl;
    }
    return value;
  }

  Future<Map<String, dynamic>> sendMessage(
    String message, {
    List<Map<String, dynamic>> history = const [],
    ChatMode mode = ChatMode.chat,
  }) async {
    final target = Uri.parse('$_baseUrl${mode.endpointPath}');
    final sourceScreen = mode.sourceScreen;
    final requestBody = {
      'message': message,
      'history': history,
      if (sourceScreen != null) 'source_screen': sourceScreen,
    };
    _debugPrintChatRequest(
      target: target,
      sourceScreen: sourceScreen,
      message: message,
    );
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
        AppConstants.connectionFallbackMessage,
        isTimeout: true,
        isTransient: true,
        originalError: error,
      );
    } on SocketException catch (error) {
      throw ChatAgentException(
        AppConstants.connectionFallbackMessage,
        isNetworkError: true,
        isTransient: true,
        originalError: error,
      );
    } on http.ClientException catch (error) {
      throw ChatAgentException(
        AppConstants.connectionFallbackMessage,
        isNetworkError: true,
        isTransient: true,
        originalError: error,
      );
    }
    final decodedBody = utf8.decode(response.bodyBytes);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      final parsedError = _readParsedError(decodedBody);
      throw ChatAgentException(
        AppConstants.connectionFallbackMessage,
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

  void _debugPrintChatRequest({
    required Uri target,
    required String? sourceScreen,
    required String message,
  }) {
    const debugChatRawLogs =
        bool.fromEnvironment('DEBUG_CHAT_RAW_LOGS', defaultValue: false);
    final debugFlags = [
      'debug_disable_usage_limits='
          '${!kReleaseMode && AppConstants.debugDisableUsageLimits}',
      'debug_chat_raw_logs=${!kReleaseMode && debugChatRawLogs}',
      'release_mode=$kReleaseMode',
    ].join(',');
    final normalizedPreview = message.replaceAll(RegExp(r'\s+'), ' ').trim();
    final preview = normalizedPreview.length <= 80
        ? normalizedPreview
        : normalizedPreview.substring(0, 80);
    debugPrint(
      'HAKAI_CHAT_REQUEST endpoint=$target '
      'source_screen=${sourceScreen ?? '-'} '
      'debug_flags=$debugFlags '
      'message_preview=$preview',
    );
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
    this.isConfigurationError = false,
  });

  final String message;
  final int? statusCode;
  final String? responseBody;
  final String? parsedErrorMessage;
  final Object? originalError;
  final bool isTimeout;
  final bool isNetworkError;
  final bool isTransient;
  final bool isConfigurationError;

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
