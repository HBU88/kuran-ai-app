import 'package:dio/dio.dart';

abstract class PrayerProvider {
  Future<Map<String, dynamic>> fetchByCity({
    required String city,
    required String country,
  });
}

class AlAdhanPrayerProvider implements PrayerProvider {
  AlAdhanPrayerProvider({Dio? dio})
      : _dio = dio ??
            Dio(
              BaseOptions(
                baseUrl: 'https://api.aladhan.com/v1',
                connectTimeout: const Duration(seconds: 8),
                receiveTimeout: const Duration(seconds: 8),
              ),
            );

  final Dio _dio;

  @override
  Future<Map<String, dynamic>> fetchByCity({
    required String city,
    required String country,
  }) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/timingsByCity',
      queryParameters: {
        'city': city,
        'country': country,
        'method': 13,
      },
    );

    final data = response.data;
    if (data == null) {
      throw StateError('Prayer times response was empty.');
    }
    return data;
  }
}

class PrayerApiService extends AlAdhanPrayerProvider {
  PrayerApiService({super.dio});
}
