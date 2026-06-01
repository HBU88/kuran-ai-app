import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';

import '../../core/utils/notification_helper.dart';
import '../../data/models/place_model.dart';
import '../../data/models/prayer_time_model.dart';
import '../../data/repositories/prayer_repository.dart';

class PrayerTimesController extends ChangeNotifier {
  PrayerTimesController(this._repository, this._notificationHelper);

  final PrayerRepository _repository;
  final NotificationHelper _notificationHelper;

  Timer? _clockTimer;

  PrayerTimeModel? prayerTimes;
  String city = '';
  String country = '';
  String? errorMessage;
  String? debugErrorMessage;
  int? debugLoginStatusCode;
  int? debugPrayerStatusCode;
  String debugSource = 'diyanet';
  String? debugPrayerEndpointUrl;
  int? debugNewCitySelectedId;
  String debugNewCitySelectedName = '';
  bool notificationsEnabled = false;
  bool notificationPermissionDenied = false;
  bool loading = false;
  bool countriesLoading = false;
  bool statesLoading = false;
  bool citiesLoading = false;
  bool savingLocation = false;
  DateTime deviceLocalNow = DateTime.now().toLocal();
  DateTime utcNow = DateTime.now().toUtc();
  DateTime effectiveNow = DateTime.now().toUtc();
  Duration timezoneOffset = DateTime.now().toLocal().timeZoneOffset;
  num? greenwichMeanTimeZone;
  String timezoneSource = '';
  Map<String, String> rawPrayerTimeStrings = {};
  Map<String, DateTime> parsedPrayerDateTimes = {};
  String nextPrayerName = '';
  DateTime? nextPrayerDateTime;
  Duration? remainingDuration;
  String sourceType = '';
  List<DiyanetCountry> countries = [];
  List<DiyanetState> states = [];
  List<DiyanetCity> cities = [];
  int? selectedCountryId;
  String selectedCountryName = '';
  int? selectedStateId;
  String selectedStateName = '';
  int? selectedCityId;
  String selectedCityName = '';
  String selectedLocationLabel = '';
  bool autoDetecting = false;
  String? autoDetectError;

  bool get canSaveLocation {
    return selectedCountryId != null &&
        selectedStateId != null &&
        selectedCityId != null &&
        !savingLocation;
  }

  Future<void> load({bool refreshPlaces = true}) async {
    loading = true;
    errorMessage = null;
    debugErrorMessage = null;
    debugLoginStatusCode = null;
    debugPrayerStatusCode = null;
    prayerTimes = null;
    city = _repository.selectedCity;
    country = _repository.selectedCountry;
    _syncSelectedLocationFromRepository();
    notificationsEnabled = _repository.notificationsEnabled;
    _refreshDebugState(null);
    notifyListeners();

    try {
      if (refreshPlaces) {
        await loadLocationOptions(notify: false);
      }
      debugPrayerEndpointUrl = _repository
          .prayerEndpointUrlFor(selectedCityId ?? _repository.selectedCityId);
      final model = await _repository.getTodayTimes(
        city: city,
        cityId: selectedCityId,
      );
      debugLoginStatusCode = _repository.lastLoginStatusCode;
      debugPrayerStatusCode = _repository.lastPrayerStatusCode;
      debugSource = _repository.source;
      debugPrayerEndpointUrl = _repository.lastPrayerEndpointUrl;
      final now = _getEffectiveNow(model);
      prayerTimes = model.recompute(now);
      _refreshDebugState(prayerTimes, effectiveNowOverride: now);
      _startClockTimer();
      await _scheduleNotificationsIfEnabled();
    } catch (error) {
      prayerTimes = null;
      errorMessage = 'Namaz vakitleri alınamadı. Lütfen tekrar deneyin.';
      debugErrorMessage = error.toString();
      debugLoginStatusCode = _repository.lastLoginStatusCode;
      debugPrayerStatusCode = _repository.lastPrayerStatusCode;
      debugSource = _repository.source;
      debugPrayerEndpointUrl = _repository.lastPrayerEndpointUrl;
      _refreshDebugState(null);
      _stopClockTimer();
    }

    loading = false;
    notifyListeners();
  }

  Future<void> changeCity(String value) async {
    final normalized = value.trim();
    if (normalized.isEmpty) {
      return;
    }
    await _repository.setSelectedCity(normalized);
    city = normalized;
    await load();
  }

  Future<void> loadLocationOptions({bool notify = true}) async {
    try {
      countriesLoading = true;
      if (notify) {
        notifyListeners();
      }
      countries = await _repository.getCountries();
      countriesLoading = false;
      if (notify) {
        notifyListeners();
      }

      if (selectedCountryId != null) {
        await _loadStates(selectedCountryId!, clearSelection: false);
      }
      if (selectedStateId != null) {
        await _loadCities(selectedStateId!, clearSelection: false);
      }
    } catch (error) {
      countriesLoading = false;
      statesLoading = false;
      citiesLoading = false;
      debugErrorMessage = error.toString();
      if (notify) {
        notifyListeners();
      }
    }
  }

  Future<void> selectCountry(int? countryId) async {
    selectedCountryId = countryId;
    selectedCountryName = _nameForCountry(countryId);
    selectedStateId = null;
    selectedStateName = '';
    selectedCityId = null;
    selectedCityName = '';
    prayerTimes = null;
    debugPrayerEndpointUrl = null;
    states = [];
    cities = [];
    _updateSelectedLocationLabel();
    notifyListeners();

    if (countryId != null) {
      await _repository.setSelectedCountry(
        countryId: countryId,
        countryName: selectedCountryName,
      );
      await _loadStates(countryId, clearSelection: true);
    }
  }

  Future<void> selectState(int? stateId) async {
    selectedStateId = stateId;
    selectedStateName = _nameForState(stateId);
    selectedCityId = null;
    selectedCityName = '';
    prayerTimes = null;
    debugPrayerEndpointUrl = null;
    cities = [];
    _updateSelectedLocationLabel();
    notifyListeners();

    if (stateId != null) {
      await _repository.setSelectedState(
        stateId: stateId,
        stateName: selectedStateName,
      );
      await _loadCities(stateId, clearSelection: true);
    }
  }

  Future<void> selectCity(int? cityId) async {
    selectedCityId = cityId;
    selectedCityName = _nameForCity(cityId);
    prayerTimes = null;
    debugNewCitySelectedId = cityId;
    debugNewCitySelectedName = selectedCityName;
    debugPrayerEndpointUrl =
        cityId == null ? null : _repository.prayerEndpointUrlFor(cityId);
    _updateSelectedLocationLabel();
    notifyListeners();

    if (cityId != null) {
      await _repository.setSelectedCityLocation(
        cityId: cityId,
        cityName: selectedCityName,
      );
      city = selectedCityName;
    }
  }

  Future<void> saveSelectedLocation() async {
    final countryId = selectedCountryId;
    final stateId = selectedStateId;
    final cityId = selectedCityId;
    if (countryId == null || stateId == null || cityId == null) {
      return;
    }

    savingLocation = true;
    loading = true;
    prayerTimes = null;
    debugNewCitySelectedId = cityId;
    debugNewCitySelectedName = selectedCityName;
    debugPrayerEndpointUrl = _repository.prayerEndpointUrlFor(cityId);
    notifyListeners();
    try {
      await _repository.setSelectedLocation(
        countryId: countryId,
        countryName: selectedCountryName,
        stateId: stateId,
        stateName: selectedStateName,
        cityId: cityId,
        cityName: selectedCityName,
      );
      city = selectedCityName;
      country = selectedCountryName;
      _syncSelectedLocationFromRepository();
      await load(refreshPlaces: false);
    } finally {
      savingLocation = false;
      notifyListeners();
    }
  }

  /// Bildirimleri açar/kapatır.
  ///
  /// [enabled] = true → izin ister; verilirse bildirimler zamanlanır.
  /// [enabled] = false → tüm bildirimler iptal edilir.
  ///
  /// İzin reddedilirse [notificationPermissionDenied] = true ayarlanır
  /// ve bildirimler açılmaz.
  Future<void> setNotificationsEnabled(bool enabled) async {
    if (enabled) {
      final granted = await _notificationHelper.requestPermission();
      if (!granted) {
        notificationPermissionDenied = true;
        notificationsEnabled = false;
        notifyListeners();
        return;
      }
      notificationPermissionDenied = false;
      notificationsEnabled = true;
      await _repository.setNotificationsEnabled(true);
      await _scheduleNotificationsIfEnabled();
      await _notificationHelper.showPrayerTogglePreview();
    } else {
      notificationPermissionDenied = false;
      notificationsEnabled = false;
      await _repository.setNotificationsEnabled(false);
      try {
        await _notificationHelper.cancelAllPrayerNotifications();
      } catch (e) {
        debugPrint('HAKAI_NOTIF cancel_failed=$e');
      }
    }
    notifyListeners();
  }

  /// Bildirimler açıksa ve vakitler yüklüyse bugünkü bildirimleri zamanlar.
  Future<void> _scheduleNotificationsIfEnabled() async {
    if (!notificationsEnabled) return;
    final times = prayerTimes;
    if (times == null) return;
    try {
      await _notificationHelper.schedulePrayerNotifications(
        times.prayers,
        city,
      );
    } catch (e) {
      debugPrint('HAKAI_NOTIF schedule_failed=$e');
    }
  }

  /// GPS-based auto-location.
  ///
  /// 1. Requests location permission (prompts user if needed).
  /// 2. Gets current GPS position.
  /// 3. Reverse-geocodes via Nominatim → Diyanet country/state/city.
  /// 4. Saves + loads prayer times for the detected city.
  ///
  /// Sets [autoDetecting] while running and [autoDetectError] on failure.
  Future<void> autoDetectLocation() async {
    autoDetecting = true;
    autoDetectError = null;
    notifyListeners();

    try {
      // --- Permission ---
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        autoDetectError = 'Konum servisleri kapalı. Lütfen açın.';
        return;
      }

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          autoDetectError = 'Konum izni reddedildi.';
          return;
        }
      }
      if (permission == LocationPermission.deniedForever) {
        autoDetectError =
            'Konum izni kalıcı olarak reddedildi. Ayarlardan izin verin.';
        return;
      }

      // --- Position ---
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.low, // city-level is enough
          timeLimit: Duration(seconds: 15),
        ),
      );

      // --- Diyanet match ---
      final result = await _repository.autoDetectFromCoordinates(
        position.latitude,
        position.longitude,
      );

      if (result == null) {
        autoDetectError =
            'Konumunuz için şehir bulunamadı. Lütfen manuel seçin.';
        return;
      }

      // --- Save & load ---
      await _repository.setSelectedLocation(
        countryId: result.country.id,
        countryName: result.country.name,
        stateId: result.state.id,
        stateName: result.state.name,
        cityId: result.city.id,
        cityName: result.city.name,
      );
      _syncSelectedLocationFromRepository();
      await load(refreshPlaces: true);
    } on LocationServiceDisabledException {
      autoDetectError = 'Konum servisleri kapalı. Lütfen açın.';
    } catch (e) {
      autoDetectError = 'Konum alınamadı: ${e.toString().split('\n').first}';
    } finally {
      autoDetecting = false;
      notifyListeners();
    }
  }

  void refreshClock() {
    final model = prayerTimes;
    if (model == null) {
      _refreshDebugState(null);
    } else {
      final now = _getEffectiveNow(model);
      prayerTimes = model.recompute(now);
      _refreshDebugState(prayerTimes, effectiveNowOverride: now);
    }
    notifyListeners();
  }

  void _startClockTimer() {
    _clockTimer ??= Timer.periodic(const Duration(seconds: 1), (_) {
      refreshClock();
    });
  }

  void _stopClockTimer() {
    _clockTimer?.cancel();
    _clockTimer = null;
  }

  Future<void> _loadStates(
    int countryId, {
    required bool clearSelection,
  }) async {
    statesLoading = true;
    notifyListeners();
    states = await _repository.getStates(countryId);
    statesLoading = false;
    if (clearSelection) {
      selectedStateId = null;
      selectedStateName = '';
      selectedCityId = null;
      selectedCityName = '';
      cities = [];
      prayerTimes = null;
      debugPrayerEndpointUrl = null;
      _updateSelectedLocationLabel();
    }
    notifyListeners();
  }

  Future<void> _loadCities(
    int stateId, {
    required bool clearSelection,
  }) async {
    citiesLoading = true;
    notifyListeners();
    cities = await _repository.getCities(stateId);
    citiesLoading = false;
    if (clearSelection) {
      selectedCityId = null;
      selectedCityName = '';
      prayerTimes = null;
      debugPrayerEndpointUrl = null;
      _updateSelectedLocationLabel();
    }
    notifyListeners();
  }

  void _syncSelectedLocationFromRepository() {
    final hasStoredCountry = _repository.selectedCountryIdOrNull != null;
    selectedCountryId = _repository.selectedCountryIdOrNull;
    selectedCountryName = _repository.selectedCountry;
    selectedStateId = _repository.selectedStateIdOrNull;
    selectedStateName =
        selectedStateId == null ? '' : _repository.selectedStateName;
    selectedCityId = _repository.selectedCityIdOrNull;
    selectedCityName =
        selectedCityId == null ? '' : _repository.selectedCityName;

    if (!hasStoredCountry) {
      selectedCountryId = _repository.selectedCountryId;
      selectedCountryName = _repository.selectedCountry;
      selectedStateId = _repository.selectedStateId;
      selectedStateName = _repository.selectedStateName;
      selectedCityId = _repository.selectedCityId;
      selectedCityName = _repository.selectedCityName;
      selectedLocationLabel = _repository.selectedLocationLabel;
    } else {
      _updateSelectedLocationLabel();
    }
  }

  void _updateSelectedLocationLabel() {
    selectedLocationLabel = [
      selectedCountryName,
      selectedStateName,
      selectedCityName,
    ].where((part) => part.isNotEmpty).join(' / ');
  }

  String _nameForCountry(int? countryId) {
    for (final country in countries) {
      if (country.id == countryId) {
        return country.name;
      }
    }
    return '';
  }

  String _nameForState(int? stateId) {
    for (final state in states) {
      if (state.id == stateId) {
        return state.name;
      }
    }
    return '';
  }

  String _nameForCity(int? cityId) {
    for (final city in cities) {
      if (city.id == cityId) {
        return city.name;
      }
    }
    return '';
  }

  void _refreshDebugState(
    PrayerTimeModel? times, {
    DateTime? effectiveNowOverride,
  }) {
    deviceLocalNow = DateTime.now().toLocal();
    utcNow = DateTime.now().toUtc();
    timezoneOffset = deviceLocalNow.timeZoneOffset;
    if (times == null) {
      effectiveNow = utcNow;
      greenwichMeanTimeZone = null;
      timezoneSource = '';
    } else {
      effectiveNow = effectiveNowOverride ?? _getEffectiveNow(times);
      greenwichMeanTimeZone = times.greenwichMeanTimeZone;
      timezoneSource = times.effectiveNowSource;
    }

    if (times == null) {
      rawPrayerTimeStrings = {};
      parsedPrayerDateTimes = {};
      nextPrayerName = '';
      nextPrayerDateTime = null;
      remainingDuration = null;
      sourceType = '';
      return;
    }

    rawPrayerTimeStrings = times.rawPrayerStrings;
    parsedPrayerDateTimes = {
      for (final entry in times.prayers.entries) entry.key: entry.value,
    };
    nextPrayerName = times.nextPrayerName;
    nextPrayerDateTime = times.nextPrayerTime;
    remainingDuration = times.remainingDuration;
    sourceType = times.source;
  }

  DateTime _getEffectiveNow(PrayerTimeModel model) {
    return getEffectiveNowFromPrayerData(
      greenwichMeanTimeZone: model.greenwichMeanTimeZone,
    );
  }

  @override
  void dispose() {
    _stopClockTimer();
    super.dispose();
  }
}
