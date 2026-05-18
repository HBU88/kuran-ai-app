import 'dart:convert';

import 'package:http/http.dart' as http;

class DiyanetPrayerService {
  DiyanetPrayerService({
    http.Client? client,
  }) : _client = client ?? http.Client();

  static const _baseUrl = 'https://awqatsalah.diyanet.gov.tr';

  final http.Client _client;
  int? lastStatusCode;
  String? lastResponseBody;
  String? lastRequestUrl;

  Future<Map<String, dynamic>> getDailyPrayerTimes(
    String accessToken, {
    required int cityId,
  }) async {
    try {
      final requestUri = Uri.parse(
        '$_baseUrl/api/PrayerTime/Daily/$cityId',
      );
      lastRequestUrl = requestUri.toString();
      final authorizationHeader = 'Bearer $accessToken';
      final response = await _client.get(
        requestUri,
        headers: {
          'Accept': 'application/json',
          'Authorization': authorizationHeader,
        },
      );
      lastStatusCode = response.statusCode;
      lastResponseBody = response.body;

      if (response.statusCode != 200) {
        throw DiyanetPrayerException(
          'Prayer fetch failed with status ${response.statusCode}. '
          'Body: ${response.body}',
          statusCode: response.statusCode,
          responseBody: response.body,
        );
      }

      final decoded = jsonDecode(response.body);
      if (decoded is Map<String, dynamic>) {
        return decoded;
      }
      if (decoded is List) {
        return {'data': decoded};
      }

      throw DiyanetPrayerException(
        'Prayer fetch response was not a JSON object.',
        statusCode: response.statusCode,
        responseBody: response.body,
      );
    } on FormatException catch (error) {
      throw DiyanetPrayerException(
        'Prayer fetch response could not be parsed.',
        cause: error,
        statusCode: lastStatusCode,
        responseBody: lastResponseBody,
      );
    } on http.ClientException catch (error) {
      throw DiyanetPrayerException(
        'Prayer fetch request failed.',
        cause: error,
      );
    }
  }
}

class DiyanetPrayerException implements Exception {
  const DiyanetPrayerException(
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
