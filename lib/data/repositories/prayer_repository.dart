import 'dart:collection';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/constants/app_constants.dart';
import '../models/place_model.dart';
import '../models/prayer_time_model.dart';
import '../sources/remote/diyanet_auth_service.dart';
import '../sources/remote/diyanet_place_service.dart';
import '../sources/remote/diyanet_prayer_service.dart';
import '../sources/remote/prayer_api_service.dart';

class PrayerRepository {
  PrayerRepository(
    PrayerProvider legacyProvider,
    this._preferences, {
    DiyanetAuthService? authService,
    DiyanetPlaceService? placeService,
    DiyanetPrayerService? prayerService,
    int defaultCityId = _defaultFallbackCityId,
  })  : _authService = authService ?? DiyanetAuthService(),
        _placeService = placeService ?? DiyanetPlaceService(),
        _prayerService = prayerService ?? DiyanetPrayerService(),
        _defaultCityId = defaultCityId;

  static const _defaultFallbackCityId = 9541;
  static const _defaultFallbackCityName = 'Istanbul';

  final SharedPreferences _preferences;
  final DiyanetAuthService _authService;
  final DiyanetPlaceService _placeService;
  final DiyanetPrayerService _prayerService;
  final int _defaultCityId;
  String? _accessToken;
  int? _lastLoginStatusCode;
  int? _lastPrayerStatusCode;
  String? _lastRawErrorMessage;

  int? get lastLoginStatusCode => _lastLoginStatusCode;
  int? get lastPrayerStatusCode => _lastPrayerStatusCode;
  String? get lastRawErrorMessage => _lastRawErrorMessage;
  String? get lastPrayerEndpointUrl => _prayerService.lastRequestUrl;
  String get source => 'diyanet';

  String get selectedCity =>
      _preferences.getString(AppConstants.selectedCityNameStorageKey) ??
      _preferences.getString(AppConstants.selectedCityStorageKey) ??
      _defaultFallbackCityName;

  String get selectedCountry =>
      _preferences.getString(AppConstants.selectedCountryNameStorageKey) ?? '';

  int? get selectedCountryId =>
      _preferences.getInt(AppConstants.selectedCountryIdStorageKey);

  int? get selectedCountryIdOrNull =>
      _preferences.getInt(AppConstants.selectedCountryIdStorageKey);

  String get selectedStateName =>
      _preferences.getString(AppConstants.selectedStateNameStorageKey) ?? '';

  int? get selectedStateId =>
      _preferences.getInt(AppConstants.selectedStateIdStorageKey);

  int? get selectedStateIdOrNull =>
      _preferences.getInt(AppConstants.selectedStateIdStorageKey);

  String get selectedCityName =>
      _preferences.getString(AppConstants.selectedCityNameStorageKey) ??
      _defaultFallbackCityName;

  int get selectedCityId =>
      _preferences.getInt(AppConstants.selectedCityIdStorageKey) ??
      _defaultCityId;

  int? get selectedCityIdOrNull =>
      _preferences.getInt(AppConstants.selectedCityIdStorageKey);

  String get selectedLocationLabel {
    return [
      selectedCountry,
      selectedStateName,
      selectedCityName,
    ].where((part) => part.isNotEmpty).join(' / ');
  }

  String prayerEndpointUrlFor(int cityId) {
    return 'https://awqatsalah.diyanet.gov.tr/api/PrayerTime/Daily/$cityId';
  }

  bool get notificationsEnabled =>
      _preferences.getBool(AppConstants.notificationEnabledStorageKey) ?? false;

  Future<void> setSelectedCity(String city) async {
    await _preferences.setString(AppConstants.selectedCityStorageKey, city);
  }

  Future<void> setSelectedCountry({
    required int countryId,
    required String countryName,
  }) async {
    await _preferences.setInt(
      AppConstants.selectedCountryIdStorageKey,
      countryId,
    );
    await _preferences.setString(
      AppConstants.selectedCountryNameStorageKey,
      countryName,
    );
    await _clearSelectedState();
    await _clearSelectedCity();
  }

  Future<void> setSelectedState({
    required int stateId,
    required String stateName,
  }) async {
    await _preferences.setInt(AppConstants.selectedStateIdStorageKey, stateId);
    await _preferences.setString(
      AppConstants.selectedStateNameStorageKey,
      stateName,
    );
    await _clearSelectedCity();
  }

  Future<void> setSelectedCityLocation({
    required int cityId,
    required String cityName,
  }) async {
    await _preferences.setInt(AppConstants.selectedCityIdStorageKey, cityId);
    await _preferences.setString(
      AppConstants.selectedCityNameStorageKey,
      cityName,
    );
    await _preferences.setString(AppConstants.selectedCityStorageKey, cityName);
  }

  Future<void> setSelectedLocation({
    required int countryId,
    required String countryName,
    required int stateId,
    required String stateName,
    required int cityId,
    required String cityName,
  }) async {
    await _preferences.setInt(
      AppConstants.selectedCountryIdStorageKey,
      countryId,
    );
    await _preferences.setString(
      AppConstants.selectedCountryNameStorageKey,
      countryName,
    );
    await _preferences.setInt(AppConstants.selectedStateIdStorageKey, stateId);
    await _preferences.setString(
      AppConstants.selectedStateNameStorageKey,
      stateName,
    );
    await _preferences.setInt(AppConstants.selectedCityIdStorageKey, cityId);
    await _preferences.setString(
      AppConstants.selectedCityNameStorageKey,
      cityName,
    );
    await _preferences.setString(AppConstants.selectedCityStorageKey, cityName);
  }

  Future<void> setNotificationsEnabled(bool enabled) async {
    await _preferences.setBool(
      AppConstants.notificationEnabledStorageKey,
      enabled,
    );
  }

  Future<PrayerTimeModel> getTodayTimes({String? city, int? cityId}) async {
    final persistedCityId = selectedCityIdOrNull;
    final prayerCityId = cityId ?? persistedCityId ?? _defaultCityId;
    final selectedCityName = city ?? this.selectedCityName;

    _lastLoginStatusCode = null;
    _lastPrayerStatusCode = null;
    _lastRawErrorMessage = null;

    try {
      if (kDebugMode) {
        debugPrint('SELECTED COUNTRY ID: ${selectedCountryId ?? '-'}');
        debugPrint('SELECTED STATE ID: ${selectedStateId ?? '-'}');
        debugPrint('SELECTED CITY ID: $prayerCityId');
        debugPrint('SELECTED CITY NAME: $selectedCityName');
        debugPrint('PRAYER TARGET: ${prayerEndpointUrlFor(prayerCityId)}');
      }
      final accessToken = await _getAccessToken();
      _lastLoginStatusCode = _authService.lastStatusCode;
      if (kDebugMode) {
        debugPrint('Diyanet token received: $accessToken');
      }

      final json = await _prayerService.getDailyPrayerTimes(
        accessToken,
        cityId: prayerCityId,
      );
      _lastPrayerStatusCode = _prayerService.lastStatusCode;
      if (kDebugMode) {
        debugPrint('Diyanet prayer JSON response: ${jsonEncode(json)}');
      }

      return _fromDiyanetJson(
        json: json,
        city: selectedCityName,
        country: selectedCountry,
        cityId: prayerCityId,
      );
    } catch (error, stackTrace) {
      _lastLoginStatusCode = _authService.lastStatusCode;
      _lastPrayerStatusCode = _prayerService.lastStatusCode;
      _lastRawErrorMessage = error.toString();
      if (kDebugMode) {
        debugPrint('Diyanet prayer flow error: $_lastRawErrorMessage');
        debugPrintStack(stackTrace: stackTrace);
      }
      throw PrayerRepositoryException(
        'Diyanet prayer flow failed. Original error: $error',
        cause: error,
      );
    }
  }

  Future<List<DiyanetCountry>> getCountries() async {
    return _placeService.getCountries(await _getAccessToken());
  }

  Future<List<DiyanetState>> getStates(int countryId) async {
    return _placeService.getStates(await _getAccessToken(), countryId);
  }

  Future<List<DiyanetCity>> getCities(int stateId) async {
    return _placeService.getCities(await _getAccessToken(), stateId);
  }

  Future<DiyanetCity> getCityDetail(int cityId) async {
    return _placeService.getCityDetail(await _getAccessToken(), cityId);
  }

  Future<String> _getAccessToken() async {
    final token = _accessToken;
    if (token != null && token.isNotEmpty) {
      return token;
    }
    _accessToken = await _authService.login();
    return _accessToken!;
  }

  PrayerTimeModel _fromDiyanetJson({
    required Map<String, dynamic> json,
    required String city,
    required String country,
    required int cityId,
  }) {
    final payload = _findPrayerPayload(json);
    if (payload == null) {
      throw StateError('Diyanet prayer timings missing from API response.');
    }

    final rawPrayerStrings = LinkedHashMap<String, String>.from({
      'İmsak': _requiredTime(
        payload,
        const ['Fajr', 'fajr', 'imsak', 'Imsak', 'İmsak', 'sabah'],
        'Fajr',
      ),
      'Güneş': _requiredTime(
        payload,
        const ['Sunrise', 'sunrise', 'gunes', 'Gunes', 'Güneş'],
        'Sunrise',
      ),
      'Öğle': _requiredTime(
        payload,
        const ['Dhuhr', 'dhuhr', 'ogle', 'Ogle', 'Öğle', 'oglen'],
        'Dhuhr',
      ),
      'İkindi': _requiredTime(
        payload,
        const ['Asr', 'asr', 'ikindi', 'Ikindi', 'İkindi'],
        'Asr',
      ),
      'Akşam': _requiredTime(
        payload,
        const ['Maghrib', 'maghrib', 'aksam', 'Aksam', 'Akşam'],
        'Maghrib',
      ),
      'Yatsı': _requiredTime(
        payload,
        const ['Isha', 'isha', 'yatsi', 'Yatsi', 'Yatsı'],
        'Isha',
      ),
    });
    final timezoneInfo = _readTimezoneInfo(payload);

    return PrayerTimeModel.fromRaw(
      city: _readString(payload, const [
            'city',
            'cityName',
            'sehir',
            'Sehir',
            'Şehir',
            'il',
            'Il',
          ]) ??
          city,
      country: country,
      selectedCityId: cityId,
      selectedCityName: city,
      greenwichMeanTimeZone: timezoneInfo.greenwichMeanTimeZone,
      effectiveNowSource: timezoneInfo.source,
      rawPrayerStrings: rawPrayerStrings,
      hijriDateFormatted: _extractHijriDateFormatted(json, payload),
      source: 'diyanet',
    );
  }

  Future<void> _clearSelectedState() async {
    await _preferences.remove(AppConstants.selectedStateIdStorageKey);
    await _preferences.remove(AppConstants.selectedStateNameStorageKey);
  }

  Future<void> _clearSelectedCity() async {
    await _preferences.remove(AppConstants.selectedCityIdStorageKey);
    await _preferences.remove(AppConstants.selectedCityNameStorageKey);
    await _preferences.remove(AppConstants.selectedCityStorageKey);
  }

  Map<String, dynamic>? _findPrayerPayload(Object? value, [int depth = 0]) {
    if (depth > 5) {
      return null;
    }

    if (value is List) {
      for (final item in value) {
        final payload = _findPrayerPayload(item, depth + 1);
        if (payload != null) {
          return payload;
        }
      }
      return null;
    }

    if (value is! Map) {
      return null;
    }

    final map = _toStringKeyedMap(value);
    if (_hasPrayerTimes(map)) {
      return map;
    }

    for (final key in const [
      'data',
      'result',
      'results',
      'items',
      'value',
      'awqat',
      'prayerTimes',
      'timings',
    ]) {
      final payload = _findPrayerPayload(map[key], depth + 1);
      if (payload != null) {
        return payload;
      }
    }

    for (final entry in map.entries) {
      if (entry.value is Map || entry.value is List) {
        final payload = _findPrayerPayload(entry.value, depth + 1);
        if (payload != null) {
          return payload;
        }
      }
    }

    return null;
  }

  Object? _readValue(Map<String, dynamic> json, List<String> keys) {
    for (final key in keys) {
      if (json.containsKey(key)) {
        return json[key];
      }
    }

    final normalizedKeys = {
      for (final key in keys) _normalizeKey(key),
    };
    for (final entry in json.entries) {
      if (normalizedKeys.contains(_normalizeKey(entry.key))) {
        return entry.value;
      }
    }

    return null;
  }

  bool _hasPrayerTimes(Map<String, dynamic> map) {
    return _readString(
                map, const ['Fajr', 'fajr', 'imsak', 'Imsak', 'İmsak']) !=
            null &&
        _readString(map, const ['Isha', 'isha', 'yatsi', 'Yatsi', 'Yatsı']) !=
            null;
  }

  String _requiredTime(
    Map<String, dynamic> json,
    List<String> keys,
    String label,
  ) {
    final value = _readString(json, keys);
    if (value == null || value.isEmpty) {
      throw StateError('Diyanet $label time missing from API response.');
    }
    return value;
  }

  String? _readString(Map<String, dynamic> json, List<String> keys) {
    for (final key in keys) {
      final value = json[key];
      if (value is String && value.trim().isNotEmpty) {
        return value.trim();
      }
      if (value != null && value is! Map && value is! List) {
        final stringValue = value.toString().trim();
        if (stringValue.isNotEmpty) {
          return stringValue;
        }
      }
    }

    final normalizedKeys = {
      for (final key in keys) _normalizeKey(key),
    };
    for (final entry in json.entries) {
      if (!normalizedKeys.contains(_normalizeKey(entry.key))) {
        continue;
      }
      final value = entry.value;
      if (value is String && value.trim().isNotEmpty) {
        return value.trim();
      }
      if (value != null && value is! Map && value is! List) {
        final stringValue = value.toString().trim();
        if (stringValue.isNotEmpty) {
          return stringValue;
        }
      }
    }

    return null;
  }

  String _extractHijriDateFormatted(
    Map<String, dynamic> root,
    Map<String, dynamic> payload,
  ) {
    final direct = _readString(payload, const [
          'hijriDateShort',
          'hicriTarihKisa',
          'HijriDateShort',
          'HicriTarihKisa',
          'hijriDate',
          'hicriTarih',
          'HijriDate',
          'HicriTarih',
        ]) ??
        _readString(root, const [
          'hijriDateShort',
          'hicriTarihKisa',
          'HijriDateShort',
          'HicriTarihKisa',
          'hijriDate',
          'hicriTarih',
          'HijriDate',
          'HicriTarih',
        ]);
    if (direct != null) {
      return direct;
    }

    final hijri = payload['hijri'] ?? root['hijri'];
    if (hijri is Map) {
      final hijriMap = _toStringKeyedMap(hijri);
      return [
        _readString(hijriMap, const ['day']),
        _readString(hijriMap, const ['month', 'monthName']),
        _readString(hijriMap, const ['year']),
      ].whereType<String>().where((part) => part.isNotEmpty).join(' ');
    }

    return '';
  }

  _DiyanetTimezoneInfo _readTimezoneInfo(Map<String, dynamic> payload) {
    final greenwichValue = _readValue(payload, const [
      'greenwichMeanTimeZone',
      'GreenwichMeanTimeZone',
    ]);
    final greenwichOffset = _parseTimezoneOffset(greenwichValue);
    if (greenwichOffset != null) {
      return _DiyanetTimezoneInfo(
        greenwichMeanTimeZone: greenwichOffset,
        source: 'diyanet_greenwichMeanTimeZone',
      );
    }

    final longIsoValue = _readString(payload, const [
      'gregorianDateLongIso8601',
      'GregorianDateLongIso8601',
    ]);
    final shortIsoValue = _readString(payload, const [
      'gregorianDateShortIso8601',
      'GregorianDateShortIso8601',
    ]);
    final isoOffset = _readOffsetFromIso8601(longIsoValue ?? shortIsoValue);
    if (isoOffset != null) {
      return _DiyanetTimezoneInfo(
        greenwichMeanTimeZone: isoOffset,
        source: longIsoValue == null
            ? 'diyanet_gregorianDateShortIso8601_offset'
            : 'diyanet_gregorianDateLongIso8601_offset',
      );
    }

    throw StateError('Diyanet timezone missing from API response.');
  }

  num? _parseTimezoneOffset(Object? value) {
    if (value is num) {
      return value;
    }
    if (value == null) {
      return null;
    }
    return num.tryParse(value.toString().trim());
  }

  num? _readOffsetFromIso8601(String? value) {
    if (value == null || value.isEmpty) {
      return null;
    }
    final match = RegExp(r'([+-])(\d{2}):(\d{2})$').firstMatch(value);
    if (match == null) {
      return null;
    }
    final sign = match.group(1) == '-' ? -1 : 1;
    final hours = int.parse(match.group(2)!);
    final minutes = int.parse(match.group(3)!);
    return sign * (hours + minutes / 60);
  }

  Map<String, dynamic> _toStringKeyedMap(Map value) {
    return {
      for (final entry in value.entries) entry.key.toString(): entry.value,
    };
  }

  String _normalizeKey(String value) {
    return value
        .trim()
        .toLowerCase()
        .replaceAll('ı', 'i')
        .replaceAll('İ', 'i')
        .replaceAll('ğ', 'g')
        .replaceAll('Ğ', 'g')
        .replaceAll('ü', 'u')
        .replaceAll('Ü', 'u')
        .replaceAll('ş', 's')
        .replaceAll('Ş', 's')
        .replaceAll('ö', 'o')
        .replaceAll('Ö', 'o')
        .replaceAll('ç', 'c')
        .replaceAll('Ç', 'c')
        .replaceAll(RegExp(r'[^a-z0-9]'), '');
  }
}

class PrayerRepositoryException implements Exception {
  const PrayerRepositoryException(this.message, {this.cause});

  final String message;
  final Object? cause;

  @override
  String toString() {
    if (cause == null) {
      return message;
    }
    return '$message Cause: $cause';
  }
}

class _DiyanetTimezoneInfo {
  const _DiyanetTimezoneInfo({
    required this.greenwichMeanTimeZone,
    required this.source,
  });

  final num greenwichMeanTimeZone;
  final String source;
}
