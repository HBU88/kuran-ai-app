import 'dart:math' as math;

class QiblaCalculator {
  const QiblaCalculator._();

  static const double kaabaLatitude = 21.4225;
  static const double kaabaLongitude = 39.8262;

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
    return (_radToDeg(bearing) + 360.0) % 360.0;
  }

  static double relativeRotation({
    required double bearingToKaaba,
    required double deviceHeading,
  }) {
    return (bearingToKaaba - deviceHeading + 360.0) % 360.0;
  }

  static double _degToRad(double value) => value * math.pi / 180.0;

  static double _radToDeg(double value) => value * 180.0 / math.pi;
}
