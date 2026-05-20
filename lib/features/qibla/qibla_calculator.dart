import 'dart:math' as math;

class QiblaCalculator {
  const QiblaCalculator._();

  static const double kaabaLatitude = 21.4224779;
  static const double kaabaLongitude = 39.8251832;
  static const List<QiblaReferenceCity> referenceCities = [
    QiblaReferenceCity(
      name: 'İstanbul',
      latitude: 41.0082,
      longitude: 28.9784,
      expectedBearingLabel: '151-152°',
      note: 'Yerel formül İstanbul merkezinde yaklaşık 151.6° üretir.',
    ),
    QiblaReferenceCity(
      name: 'Ankara',
      latitude: 39.9334,
      longitude: 32.8597,
      expectedBearingLabel: '154° civarı',
      note:
          'Bazı Diyanet/pusula referansları yaklaşık 154° verebilir; true-north yerel formül ilçe/merkez koordinatına göre farklılaşabilir.',
    ),
  ];

  // Primary runtime path: deterministic great-circle initial bearing from the
  // user's coordinates to Kaaba. The Kaaba coordinate reference follows public
  // Qibla documentation and remains local; Google, Diyanet, or other external
  // services are not runtime dependencies for this calculation.
  static double bearingToKaaba({
    required double latitude,
    required double longitude,
  }) {
    final lat1 = _degToRad(latitude);
    final lon1 = _degToRad(longitude);
    final lat2 = _degToRad(kaabaLatitude);
    final lon2 = _degToRad(kaabaLongitude);

    final deltaLon = lon2 - lon1;
    final y = math.sin(deltaLon) * math.cos(lat2);
    final x = math.cos(lat1) * math.sin(lat2) -
        math.sin(lat1) * math.cos(lat2) * math.cos(deltaLon);
    final bearing = math.atan2(y, x);
    return normalizeDegrees(_radToDeg(bearing));
  }

  static double relativeRotation({
    required double bearingToKaaba,
    required double deviceHeading,
  }) {
    return normalizeSignedDegrees(bearingToKaaba - deviceHeading);
  }

  static double normalizeDegrees(double value) {
    final normalized = value % 360.0;
    return normalized < 0 ? normalized + 360.0 : normalized;
  }

  static double normalizeSignedDegrees(double value) {
    final normalized = normalizeDegrees(value);
    return normalized > 180.0 ? normalized - 360.0 : normalized;
  }

  static double _degToRad(double value) => value * math.pi / 180.0;

  static double _radToDeg(double value) => value * 180.0 / math.pi;
}

class QiblaReferenceCity {
  const QiblaReferenceCity({
    required this.name,
    required this.latitude,
    required this.longitude,
    required this.expectedBearingLabel,
    required this.note,
  });

  final String name;
  final double latitude;
  final double longitude;
  final String expectedBearingLabel;
  final String note;
}
