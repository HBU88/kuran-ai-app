import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../models/place_model.dart';

class DiyanetPlaceService {
  DiyanetPlaceService({http.Client? client})
      : _client = client ?? http.Client();

  static const _baseUrl = 'https://awqatsalah.diyanet.gov.tr';

  final http.Client _client;

  Future<List<DiyanetCountry>> getCountries(String token) async {
    final json = await _getJson(
      token: token,
      path: '/api/Place/Countries',
    );
    return _readDataList(json).map(DiyanetCountry.fromJson).toList();
  }

  Future<List<DiyanetState>> getStates(String token, int countryId) async {
    final json = await _getJson(
      token: token,
      path: '/api/Place/States/$countryId',
    );
    return _readDataList(json).map(DiyanetState.fromJson).toList();
  }

  Future<List<DiyanetCity>> getCities(String token, int stateId) async {
    final json = await _getJson(
      token: token,
      path: '/api/Place/Cities/$stateId',
    );
    return _readDataList(json).map(DiyanetCity.fromJson).toList();
  }

  Future<DiyanetCity> getCityDetail(String token, int cityId) async {
    final json = await _getJson(
      token: token,
      path: '/api/Place/CityDetail/$cityId',
    );
    final data = json['data'];
    if (data is! Map<String, dynamic>) {
      throw const DiyanetPlaceException(
        'City detail response did not include a data object.',
      );
    }
    return DiyanetCity.fromJson(data);
  }

  Future<Map<String, dynamic>> _getJson({
    required String token,
    required String path,
  }) async {
    final uri = Uri.parse('$_baseUrl$path');
    final response = await _client.get(
      uri,
      headers: {
        'Accept': 'application/json',
        'Authorization': 'Bearer $token',
      },
    );

    if (response.statusCode != 200) {
      throw DiyanetPlaceException(
        'Place request failed with status ${response.statusCode}. '
        'Body: ${response.body}',
      );
    }

    final decoded = jsonDecode(response.body);
    if (decoded is! Map<String, dynamic>) {
      throw const DiyanetPlaceException(
        'Place response was not a JSON object.',
      );
    }
    return decoded;
  }

  List<Map<String, dynamic>> _readDataList(Map<String, dynamic> json) {
    final data = json['data'];
    if (data is! List) {
      throw const DiyanetPlaceException(
        'Place response did not include a data list.',
      );
    }
    return data.whereType<Map<String, dynamic>>().toList();
  }
}

class DiyanetPlaceException implements Exception {
  const DiyanetPlaceException(this.message);

  final String message;

  @override
  String toString() => message;
}
