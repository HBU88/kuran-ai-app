import 'package:intl/intl.dart';

DateTime getEffectiveNowFromPrayerData({
  required num greenwichMeanTimeZone,
}) {
  final utcNow = DateTime.now().toUtc();
  final offsetMinutes = (greenwichMeanTimeZone * 60).round();
  return utcNow.add(Duration(minutes: offsetMinutes));
}

class PrayerTimeModel {
  const PrayerTimeModel({
    required this.gregorianDate,
    required this.hijriDateFormatted,
    required this.city,
    required this.country,
    required this.prayers,
    required this.rawPrayerStrings,
    required this.nextPrayerName,
    required this.nextPrayerTime,
    required this.remainingDuration,
    required this.source,
    required this.greenwichMeanTimeZone,
    required this.effectiveNowSource,
    required this.selectedCityId,
    required this.selectedCityName,
  });

  final DateTime gregorianDate;
  final String hijriDateFormatted;
  final String city;
  final String country;
  final Map<String, DateTime> prayers;
  final Map<String, String> rawPrayerStrings;
  final String nextPrayerName;
  final DateTime nextPrayerTime;
  final Duration remainingDuration;
  final String source;
  final num greenwichMeanTimeZone;
  final String effectiveNowSource;
  final int selectedCityId;
  final String selectedCityName;

  DateTime get date => gregorianDate;
  String get sourceType => source;
  Map<String, String> get rawTimings => rawPrayerStrings;

  String get imsak => formattedPrayerTime('İmsak');
  String get sunrise => formattedPrayerTime('Güneş');
  String get dhuhr => formattedPrayerTime('Öğle');
  String get asr => formattedPrayerTime('İkindi');
  String get maghrib => formattedPrayerTime('Akşam');
  String get isha => formattedPrayerTime('Yatsı');

  List<PrayerSlot> get slots {
    return prayers.entries.map((entry) {
      return PrayerSlot(
          name: entry.key, time: DateFormat('HH:mm').format(entry.value));
    }).toList();
  }

  PrayerTimeModel recompute(DateTime effectiveNow) {
    final recalculatedPrayers = _buildPrayers(
      rawPrayerStrings: rawPrayerStrings,
      effectiveNow: effectiveNow,
    );
    final next = findNextPrayer(recalculatedPrayers, effectiveNow);
    return PrayerTimeModel(
      gregorianDate: DateTime(
        effectiveNow.year,
        effectiveNow.month,
        effectiveNow.day,
      ),
      hijriDateFormatted: hijriDateFormatted,
      city: city,
      country: country,
      prayers: recalculatedPrayers,
      rawPrayerStrings: rawPrayerStrings,
      nextPrayerName: next.key,
      nextPrayerTime: next.value,
      remainingDuration: _remainingUntil(next.value, effectiveNow),
      source: source,
      greenwichMeanTimeZone: greenwichMeanTimeZone,
      effectiveNowSource: effectiveNowSource,
      selectedCityId: selectedCityId,
      selectedCityName: selectedCityName,
    );
  }

  String formattedPrayerTime(String name) {
    final value = prayers[name];
    if (value == null) {
      return '--:--';
    }
    return DateFormat('HH:mm').format(value);
  }

  String get formattedRemainingDuration {
    final totalSeconds = remainingDuration.inSeconds.clamp(0, 24 * 60 * 60);
    final hours = totalSeconds ~/ 3600;
    final minutes = (totalSeconds % 3600) ~/ 60;
    final seconds = totalSeconds % 60;
    if (hours > 0) {
      return '$hours sa ${minutes.toString().padLeft(2, '0')} dk';
    }
    return '$minutes dk ${seconds.toString().padLeft(2, '0')} sn';
  }

  List<PrayerSlotDateTime> parsedSlotsFor(DateTime now) {
    final recalculatedPrayers = _buildPrayers(
      rawPrayerStrings: rawPrayerStrings,
      effectiveNow: now,
    );
    return recalculatedPrayers.entries.map((entry) {
      return PrayerSlotDateTime(
        slot: PrayerSlot(
            name: entry.key, time: DateFormat('HH:mm').format(entry.value)),
        dateTime: entry.value,
      );
    }).toList();
  }

  PrayerNextInfo nextPrayerInfo(DateTime effectiveNow) {
    final recomputed = recompute(effectiveNow);
    return PrayerNextInfo(
      slot: PrayerSlot(
        name: recomputed.nextPrayerName,
        time: DateFormat('HH:mm').format(recomputed.nextPrayerTime),
      ),
      dateTime: recomputed.nextPrayerTime,
      isTomorrow: !isSameLocalDay(recomputed.nextPrayerTime, effectiveNow),
    );
  }

  PrayerSlot nextPrayer(DateTime effectiveNow) {
    return nextPrayerInfo(effectiveNow).slot;
  }

  static PrayerTimeModel fromRaw({
    required String city,
    required String country,
    required int selectedCityId,
    required String selectedCityName,
    required num greenwichMeanTimeZone,
    required String effectiveNowSource,
    required Map<String, String> rawPrayerStrings,
    required String hijriDateFormatted,
    required String source,
  }) {
    final effectiveNow = getEffectiveNowFromPrayerData(
      greenwichMeanTimeZone: greenwichMeanTimeZone,
    );
    final prayers = _buildPrayers(
      rawPrayerStrings: rawPrayerStrings,
      effectiveNow: effectiveNow,
    );
    final next = findNextPrayer(prayers, effectiveNow);

    return PrayerTimeModel(
      gregorianDate: DateTime(
        effectiveNow.year,
        effectiveNow.month,
        effectiveNow.day,
      ),
      hijriDateFormatted: hijriDateFormatted,
      city: city,
      country: country,
      prayers: prayers,
      rawPrayerStrings: rawPrayerStrings,
      nextPrayerName: next.key,
      nextPrayerTime: next.value,
      remainingDuration: _remainingUntil(next.value, effectiveNow),
      source: source,
      greenwichMeanTimeZone: greenwichMeanTimeZone,
      effectiveNowSource: effectiveNowSource,
      selectedCityId: selectedCityId,
      selectedCityName: selectedCityName,
    );
  }

  static DateTime buildPrayerDateTime({
    required String rawTime,
    required DateTime effectiveNow,
  }) {
    final clean = cleanPrayerTimeString(rawTime);
    final parts = clean.split(':');
    if (parts.length < 2) {
      throw FormatException('Invalid prayer time: $rawTime');
    }
    final hour = int.parse(parts[0]);
    final minute = int.parse(parts[1]);
    return DateTime(
      effectiveNow.year,
      effectiveNow.month,
      effectiveNow.day,
      hour,
      minute,
    );
  }

  static DateTime buildLocalPrayerDateTime({
    required DateTime now,
    required String rawTime,
  }) {
    return buildPrayerDateTime(rawTime: rawTime, effectiveNow: now);
  }

  static String cleanPrayerTimeString(String value) {
    final match = RegExp(r'(\d{1,2})\s*[:.]\s*(\d{2})')
        .firstMatch(value.replaceAll(RegExp(r'\s*\([^\)]*\)'), '').trim());
    if (match == null) {
      throw FormatException('Invalid prayer time: $value');
    }
    final hour = match.group(1)!.padLeft(2, '0');
    final minute = match.group(2)!;
    return '$hour:$minute';
  }

  static MapEntry<String, DateTime> findNextPrayer(
    Map<String, DateTime> prayers,
    DateTime now,
  ) {
    final ordered = prayers.entries.toList()
      ..sort((a, b) => a.value.compareTo(b.value));
    for (final entry in ordered) {
      if (entry.value.isAfter(now)) {
        return entry;
      }
    }
    final first = ordered.first;
    return MapEntry(
      first.key,
      first.value.add(const Duration(days: 1)),
    );
  }

  static bool isSameLocalDay(DateTime a, DateTime b) {
    return a.year == b.year && a.month == b.month && a.day == b.day;
  }

  static Map<String, DateTime> _buildPrayers({
    required Map<String, String> rawPrayerStrings,
    required DateTime effectiveNow,
  }) {
    return {
      for (final entry in rawPrayerStrings.entries)
        entry.key: buildPrayerDateTime(
          rawTime: entry.value,
          effectiveNow: effectiveNow,
        ),
    };
  }

  static Duration _remainingUntil(DateTime nextPrayerTime, DateTime now) {
    final remaining = nextPrayerTime.difference(now);
    if (remaining.isNegative) {
      return Duration.zero;
    }
    return remaining;
  }
}

class PrayerSlot {
  const PrayerSlot({
    required this.name,
    required this.time,
  });

  final String name;
  final String time;
}

class PrayerSlotDateTime {
  const PrayerSlotDateTime({
    required this.slot,
    required this.dateTime,
  });

  final PrayerSlot slot;
  final DateTime dateTime;
}

class PrayerNextInfo {
  const PrayerNextInfo({
    required this.slot,
    required this.dateTime,
    required this.isTomorrow,
  });

  final PrayerSlot slot;
  final DateTime dateTime;
  final bool isTomorrow;
}
