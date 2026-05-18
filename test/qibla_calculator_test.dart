import 'package:flutter_test/flutter_test.dart';
import 'package:kuran_uygulamasi/features/qibla/qibla_calculator.dart';

void main() {
  test('bearing to Kaaba from Istanbul is within expected range', () {
    final bearing = QiblaCalculator.bearingToKaaba(
      latitude: 41.0082,
      longitude: 28.9784,
    );

    expect(bearing, greaterThan(135));
    expect(bearing, lessThan(170));
  });

  test('relative rotation is normalized to 0..360', () {
    final rotation = QiblaCalculator.relativeRotation(
      bearingToKaaba: 20,
      deviceHeading: 350,
    );

    expect(rotation, closeTo(30, 0.001));
  });
}
