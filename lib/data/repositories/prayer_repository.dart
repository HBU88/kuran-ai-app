import 'dart:collection';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/constants/app_constants.dart';
import '../models/place_model.dart';
import '../models/prayer_time_model.dart';
import '../sources/remote/diyanet_auth_service.dart';
import '../sources/remote/diyanet_place_service.dart';
import '../sources/remote/diyanet_prayer_service.dart';
import '../sources/remote/nominatim_service.dart';
import '../sources/remote/prayer_api_service.dart';

class PrayerRepository {
  PrayerRepository(
    PrayerProvider legacyProvider,
    this._preferences, {
    DiyanetAuthService? authService,
    DiyanetPlaceService? placeService,
    DiyanetPrayerService? prayerService,
    NominatimService? nominatimService,
    int defaultCityId = _defaultFallbackCityId,
  })  : _authService = authService ?? DiyanetAuthService(),
        _placeService = placeService ?? DiyanetPlaceService(),
        _prayerService = prayerService ?? DiyanetPrayerService(),
        _nominatimService = nominatimService ?? NominatimService(),
        _legacyProvider = legacyProvider,
        _defaultCityId = defaultCityId;

  static const _defaultFallbackCityId = 9541;
  static const _defaultFallbackCityName = 'Istanbul';
  static const _defaultFallbackCountryName = 'Turkey';

  final SharedPreferences _preferences;
  final DiyanetAuthService _authService;
  final DiyanetPlaceService _placeService;
  final DiyanetPrayerService _prayerService;
  final NominatimService _nominatimService;
  final PrayerProvider _legacyProvider;
  final int _defaultCityId;
  String? _accessToken;
  int? _lastLoginStatusCode;
  int? _lastPrayerStatusCode;
  String? _lastRawErrorMessage;

  int? get lastLoginStatusCode => _lastLoginStatusCode;
  int? get lastPrayerStatusCode => _lastPrayerStatusCode;
  String? get lastRawErrorMessage => _lastRawErrorMessage;
  String? get lastPrayerEndpointUrl => _prayerService.lastRequestUrl;
  String get source => _lastSource;
  String _lastSource = 'diyanet';

  String get selectedCity =>
      _preferences.getString(AppConstants.selectedCityNameStorageKey) ??
      _preferences.getString(AppConstants.selectedCityStorageKey) ??
      _defaultFallbackCityName;

  String get selectedCountry =>
      _preferences.getString(AppConstants.selectedCountryNameStorageKey) ??
      _defaultFallbackCountryName;

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
    _lastSource = 'diyanet';

    _logPrayerRequest(
      city: selectedCityName,
      district: selectedCityName,
      source: 'diyanet',
    );

    try {
      if (!_authService.isConfigured) {
        throw const DiyanetAuthException(
          'Diyanet credentials are not configured.',
        );
      }
      final accessToken = await _getAccessToken();
      _lastLoginStatusCode = _authService.lastStatusCode;

      final json = await _prayerService.getDailyPrayerTimes(
        accessToken,
        cityId: prayerCityId,
      );
      _lastPrayerStatusCode = _prayerService.lastStatusCode;

      final model = _fromDiyanetJson(
        json: json,
        city: selectedCityName,
        country: selectedCountry,
        cityId: prayerCityId,
      );
      _logPrayerResponse(
        success: true,
        status: _lastPrayerStatusCode ?? _lastLoginStatusCode,
        source: 'diyanet',
      );
      return model;
    } catch (error) {
      _lastLoginStatusCode = _authService.lastStatusCode;
      _lastPrayerStatusCode = _prayerService.lastStatusCode;
      _lastRawErrorMessage = error.toString();
      _logPrayerResponse(
        success: false,
        status: _lastPrayerStatusCode ?? _lastLoginStatusCode,
        source: 'diyanet',
        error: _safePrayerError(error),
      );
      return _getLegacyTodayTimes(
        city: selectedCityName,
        country: selectedCountry,
        cityId: prayerCityId,
        cause: error,
      );
    }
  }

  Future<PrayerTimeModel> _getLegacyTodayTimes({
    required String city,
    required String country,
    required int cityId,
    required Object cause,
  }) async {
    final fallbackCountry =
        country.trim().isEmpty ? _defaultFallbackCountryName : country.trim();
    _lastSource = 'aladhan_fallback';
    _logPrayerRequest(
      city: city,
      district: city,
      source: _lastSource,
    );
    try {
      final json = await _legacyProvider.fetchByCity(
        city: city,
        country: fallbackCountry,
      );
      final model = _fromLegacyJson(
        json: json,
        city: city,
        country: fallbackCountry,
        cityId: cityId,
      );
      _logPrayerResponse(
        success: true,
        status: 200,
        source: _lastSource,
      );
      return model;
    } catch (fallbackError) {
      _logPrayerResponse(
        success: false,
        source: _lastSource,
        error: _safePrayerError(fallbackError),
      );
      throw PrayerRepositoryException(
        'Prayer time providers failed. Diyanet error: ${_safePrayerError(cause)}. '
        'Fallback error: ${_safePrayerError(fallbackError)}',
        cause: fallbackError,
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

  /// Reverse-geocode [latitude]/[longitude] → Diyanet country/state/city.
  ///
  /// Returns null if:
  ///  - Nominatim is unreachable or returns no city
  ///  - No Diyanet country/state/city name matches well enough
  Future<DiyanetAutoDetectResult?> autoDetectFromCoordinates(
    double latitude,
    double longitude,
  ) async {
    final address =
        await _nominatimService.reverseGeocode(latitude, longitude);
    debugPrint(
      'HAKAI_PRAYER_AUTODETECT nominatim=$address',
    );
    if (address == null) return null;

    final token = await _getAccessToken();

    // ---- Find country ----
    final countries = await _placeService.getCountries(token);
    DiyanetCountry? matchedCountry;
    if (address.countryCode == 'tr') {
      // Fast path — Turkey is almost always the target
      matchedCountry =
          _findBestNameMatch(countries, 'Turkey', getName: (c) => c.name) ??
          _findBestNameMatch(countries, 'Türkiye', getName: (c) => c.name) ??
          _findBestNameMatch(countries, address.countryCode, getName: (c) => c.name);
    } else {
      matchedCountry = _findBestNameMatch(
        countries,
        address.countryCode,
        getName: (c) => c.name,
      );
    }
    if (matchedCountry == null) {
      debugPrint('HAKAI_PRAYER_AUTODETECT no country match');
      return null;
    }

    // ---- Find state / province ----
    final states = await _placeService.getStates(token, matchedCountry.id);
    final matchedState = _findBestNameMatch(states, address.state, getName: (s) => s.name);
    if (matchedState == null) {
      debugPrint('HAKAI_PRAYER_AUTODETECT no state match for "${address.state}"');
      return null;
    }

    // ---- Find city ----
    final cities = await _placeService.getCities(token, matchedState.id);
    final matchedCity = _findBestNameMatch(cities, address.city, getName: (c) => c.name);
    if (matchedCity == null) {
      // Fall back to first city in the matched state (state capital)
      if (cities.isEmpty) {
        debugPrint('HAKAI_PRAYER_AUTODETECT no cities in state');
        return null;
      }
      debugPrint(
        'HAKAI_PRAYER_AUTODETECT city "${address.city}" not found, using ${cities.first.name}',
      );
      return DiyanetAutoDetectResult(
        country: matchedCountry,
        state: matchedState,
        city: cities.first,
        isExactCityMatch: false,
      );
    }

    debugPrint(
      'HAKAI_PRAYER_AUTODETECT matched ${matchedCountry.name} / ${matchedState.name} / ${matchedCity.name}',
    );
    return DiyanetAutoDetectResult(
      country: matchedCountry,
      state: matchedState,
      city: matchedCity,
      isExactCityMatch: true,
    );
  }

  /// Fuzzy name match — normalizes Turkish chars and compares.
  /// Returns the best match from [items] for [query], or null if no close match.
  T? _findBestNameMatch<T>(
    List<T> items,
    String query, {
    required String Function(T) getName,
  }) {
    if (items.isEmpty || query.isEmpty) return null;

    final normalizedQuery = _normalizeName(query);

    // 1. Exact normalized match
    for (final item in items) {
      if (_normalizeName(getName(item)) == normalizedQuery) return item;
    }

    // 2. Starts-with match
    for (final item in items) {
      final n = _normalizeName(getName(item));
      if (n.startsWith(normalizedQuery) || normalizedQuery.startsWith(n)) {
        return item;
      }
    }

    // 3. Contains match (for e.g. "İstanbul" ↔ "Istanbul ili")
    for (final item in items) {
      final n = _normalizeName(getName(item));
      if (n.contains(normalizedQuery) || normalizedQuery.contains(n)) {
        return item;
      }
    }

    return null;
  }

  String _normalizeName(String value) {
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
        // strip common suffixes (ili, ili merkezi, province, etc.)
        .replaceAll(RegExp(r'\s+(ili|province|eyaleti|merkezi)$'), '');
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

  PrayerTimeModel _fromLegacyJson({
    required Map<String, dynamic> json,
    required String city,
    required String country,
    required int cityId,
  }) {
    final data = json['data'];
    if (data is! Map<String, dynamic>) {
      throw StateError('Fallback prayer response missing data object.');
    }
    final timings = data['timings'];
    if (timings is! Map) {
      throw StateError('Fallback prayer timings missing from API response.');
    }
    final timingMap = _toStringKeyedMap(timings);
    final date = data['date'];
    final dateMap = date is Map ? _toStringKeyedMap(date) : <String, dynamic>{};
    final hijri = dateMap['hijri'];
    final hijriMap =
        hijri is Map ? _toStringKeyedMap(hijri) : <String, dynamic>{};
    final rawPrayerStrings = LinkedHashMap<String, String>.from({
      'İmsak': _requiredTime(timingMap, const ['Fajr', 'fajr'], 'Fajr'),
      'Güneş':
          _requiredTime(timingMap, const ['Sunrise', 'sunrise'], 'Sunrise'),
      'Öğle': _requiredTime(timingMap, const ['Dhuhr', 'dhuhr'], 'Dhuhr'),
      'İkindi': _requiredTime(timingMap, const ['Asr', 'asr'], 'Asr'),
      'Akşam':
          _requiredTime(timingMap, const ['Maghrib', 'maghrib'], 'Maghrib'),
      'Yatsı': _requiredTime(timingMap, const ['Isha', 'isha'], 'Isha'),
    });

    return PrayerTimeModel.fromRaw(
      city: city,
      country: country,
      selectedCityId: cityId,
      selectedCityName: city,
      greenwichMeanTimeZone:
          DateTime.now().toLocal().timeZoneOffset.inMinutes / 60,
      effectiveNowSource: 'device_timezone_fallback',
      rawPrayerStrings: rawPrayerStrings,
      hijriDateFormatted: _readLegacyHijriDate(hijriMap),
      source: 'aladhan_fallback',
    );
  }

  String _readLegacyHijriDate(Map<String, dynamic> hijri) {
    final day = _readString(hijri, const ['day']);
    final year = _readString(hijri, const ['year']);
    final month = hijri['month'];
    String? monthName;
    if (month is Map) {
      final monthMap = _toStringKeyedMap(month);
      // Türkçe isim varsa önce onu al; yoksa numara üzerinden Türkçe isim dene
      final rawName = _readString(monthMap, const ['tr', 'en']);
      final monthNumber = int.tryParse(monthMap['number']?.toString() ?? '');
      monthName = _hijriMonthTr(monthNumber) ?? rawName;
    }
    return [day, monthName, year]
        .whereType<String>()
        .where((part) => part.isNotEmpty)
        .join(' ');
  }

  /// Hicri ay numarasından (1–12) Türkçe ay adı döndürür.
  static String? _hijriMonthTr(int? number) {
    const months = [
      null,           // 0 — geçersiz
      'Muharrem',     // 1
      'Safer',        // 2
      'Rebiülevvel',  // 3
      'Rebiülahir',   // 4
      'Cemaziyelevvel', // 5
      'Cemaziyelahir',  // 6
      'Recep',        // 7
      'Şaban',        // 8
      'Ramazan',      // 9
      'Şevval',       // 10
      'Zilkade',      // 11
      'Zilhicce',     // 12
    ];
    if (number == null || number < 1 || number > 12) return null;
    return months[number];
  }

  void _logPrayerRequest({
    required String city,
    required String district,
    required String source,
  }) {
    debugPrint(
      'HAKAI_PRAYER_REQUEST city=$city district=$district source=$source',
    );
  }

  void _logPrayerResponse({
    required bool success,
    required String source,
    int? status,
    String? error,
  }) {
    debugPrint(
      'HAKAI_PRAYER_RESPONSE success=$success status=${status ?? '-'} '
      'source=$source error=${error ?? '-'}',
    );
  }

  String _safePrayerError(Object error) {
    return error
        .toString()
        .replaceAll(RegExp(r'password=[^,\\s]+'), 'password=<hidden>');
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
      final monthRaw = hijriMap['month'];
      String? monthName;
      if (monthRaw is Map) {
        final monthMap = _toStringKeyedMap(monthRaw);
        final monthNumber = int.tryParse(monthMap['number']?.toString() ?? '');
        monthName = _hijriMonthTr(monthNumber) ??
            _readString(monthMap, const ['tr', 'en']);
      } else {
        monthName = _readString(hijriMap, const ['month', 'monthName']);
      }
      return [
        _readString(hijriMap, const ['day']),
        monthName,
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

/// Result of a successful GPS-based auto-detection.
class DiyanetAutoDetectResult {
  const DiyanetAutoDetectResult({
    required this.country,
    required this.state,
    required this.city,
    required this.isExactCityMatch,
  });

  final DiyanetCountry country;
  final DiyanetState state;
  final DiyanetCity city;

  /// True if a Diyanet city name matched the Nominatim city.
  /// False if we fell back to the state's first city.
  final bool isExactCityMatch;
}
