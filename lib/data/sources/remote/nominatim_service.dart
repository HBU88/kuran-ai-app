import 'dart:convert';

import 'package:http/http.dart' as http;

/// Nominatim (OpenStreetMap) reverse geocoding.
/// Terms: requires a User-Agent, max 1 req/sec (fire-and-forget, single call).
class NominatimService {
  NominatimService({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  static const _baseUrl = 'https://nominatim.openstreetmap.org';

  Future<NominatimAddress?> reverseGeocode(
    double latitude,
    double longitude,
  ) async {
    final uri = Uri.parse('$_baseUrl/reverse').replace(
      queryParameters: {
        'lat': latitude.toStringAsFixed(6),
        'lon': longitude.toStringAsFixed(6),
        'format': 'json',
        'accept-language': 'tr',
        'zoom': '10', // city level
      },
    );

    try {
      final response = await _client
          .get(uri, headers: const {
            'User-Agent': 'HAKAI-App/1.0 (namaz vakitleri)',
            'Accept': 'application/json',
          })
          .timeout(const Duration(seconds: 10));

      if (response.statusCode != 200) return null;

      final decoded = jsonDecode(response.body);
      if (decoded is! Map<String, dynamic>) return null;

      final address = decoded['address'];
      if (address is! Map<String, dynamic>) return null;

      final city = _firstNonEmpty(address, const [
        'city',
        'town',
        'village',
        'municipality',
        'county',
      ]);
      final state = _firstNonEmpty(address, const [
        'province',
        'state',
        'region',
      ]);
      final countryCode =
          (address['country_code'] as String? ?? '').toLowerCase();

      if (city == null || city.isEmpty) return null;

      return NominatimAddress(
        city: city,
        state: state ?? '',
        countryCode: countryCode,
      );
    } catch (_) {
      return null;
    }
  }

  String? _firstNonEmpty(Map<String, dynamic> map, List<String> keys) {
    for (final key in keys) {
      final value = map[key];
      if (value is String && value.trim().isNotEmpty) {
        return value.trim();
      }
    }
    return null;
  }
}

class NominatimAddress {
  const NominatimAddress({
    required this.city,
    required this.state,
    required this.countryCode,
  });

  final String city;
  final String state;
  final String countryCode;

  @override
  String toString() =>
      'NominatimAddress(city: $city, state: $state, countryCode: $countryCode)';
}
