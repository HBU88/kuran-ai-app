import 'dart:async';
import 'dart:io' show Platform;
import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_compass/flutter_compass.dart';
import 'package:geolocator/geolocator.dart';

import '../../shared/widgets/app_card.dart';
import '../../shared/widgets/app_gradient_background.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_radius.dart';
import '../../theme/app_spacing.dart';
import 'qibla_calculator.dart';

class QiblaScreen extends StatefulWidget {
  const QiblaScreen({super.key});

  @override
  State<QiblaScreen> createState() => _QiblaScreenState();
}

class _QiblaScreenState extends State<QiblaScreen> {
  static const double _alignEnterThreshold = 5.0;
  static const double _alignExitThreshold = 10.0;
  static const double _headingSmoothingFactor = 0.22;

  StreamSubscription<CompassEvent>? _compassSubscription;

  Position? _position;
  double? _heading;
  double? _rawHeading;
  double? _qiblaBearing;
  double? _lockedRelativeRotation;
  String? _locationMessage;
  String? _compassMessage;
  LocationPermission? _locationPermission;
  bool? _locationServiceEnabled;
  bool _qiblaAligned = false;
  bool _locationLoading = true;
  DateTime? _lastDebugLogAt;

  @override
  void initState() {
    super.initState();
    _startCompassListener();
    _loadLocation();
  }

  @override
  void dispose() {
    _compassSubscription?.cancel();
    super.dispose();
  }

  void _startCompassListener() {
    final stream = FlutterCompass.events;
    if (stream == null) {
      setState(() {
        _compassMessage = 'Pusula sensörü kullanılamıyor.';
      });
      return;
    }

    _compassSubscription = stream.listen(
      (event) {
        if (!mounted) return;
        final heading = _resolveCompassHeading(event);
        setState(() {
          if (heading == null) {
            _rawHeading = null;
            _heading = null;
            _compassMessage = 'Pusula verisi alınamadı.';
          } else {
            _rawHeading = heading;
            _heading = _smoothHeading(_heading, heading);
            _compassMessage = null;
            _updateAlignmentState();
          }
        });
        _logQiblaDebug();
      },
      onError: (_) {
        if (!mounted) return;
        setState(() {
          _compassMessage = 'Pusula verisi alınamadı.';
        });
      },
    );
  }

  Future<void> _loadLocation() async {
    setState(() {
      _locationLoading = true;
      _locationMessage = null;
    });

    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      debugPrint('QIBLA_LOCATION service_enabled=$serviceEnabled');
      if (!serviceEnabled) {
        setState(() {
          _locationServiceEnabled = false;
          _locationMessage = 'Konum servisleri kapalı.';
          _locationLoading = false;
        });
        _logQiblaDebug(force: true);
        return;
      }
      _locationServiceEnabled = true;

      var permission = await Geolocator.checkPermission();
      debugPrint('QIBLA_LOCATION permission_before=$permission');
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        debugPrint('QIBLA_LOCATION permission_after_request=$permission');
      }
      _locationPermission = permission;

      if (permission == LocationPermission.denied) {
        setState(() {
          _locationPermission = permission;
          _locationMessage = 'Konum izni verilmedi.';
          _locationLoading = false;
        });
        _logQiblaDebug(force: true);
        return;
      }

      if (permission == LocationPermission.deniedForever) {
        setState(() {
          _locationPermission = permission;
          _locationMessage = 'Konum izni kalıcı olarak reddedildi.';
          _locationLoading = false;
        });
        _logQiblaDebug(force: true);
        return;
      }

      final position = await Geolocator.getCurrentPosition(
        locationSettings: _locationSettings,
      );
      debugPrint(
        'QIBLA_LOCATION position_success '
        'lat=${position.latitude.toStringAsFixed(6)} '
        'lon=${position.longitude.toStringAsFixed(6)} '
        'accuracy=${position.accuracy.toStringAsFixed(1)}',
      );

      final bearing = QiblaCalculator.bearingToKaaba(
        latitude: position.latitude,
        longitude: position.longitude,
      );

      if (!mounted) return;
      setState(() {
        _position = position;
        _qiblaBearing = bearing;
        _locationPermission = permission;
        _locationServiceEnabled = true;
        _locationLoading = false;
        _updateAlignmentState();
      });
      _logQiblaDebug(force: true);
    } catch (error) {
      debugPrint('QIBLA_LOCATION position_failure=$error');
      if (!mounted) return;
      setState(() {
        _locationMessage =
            'Konum alınamadı. Lütfen izin ve servis durumunu kontrol et.';
        _locationLoading = false;
      });
      _logQiblaDebug(force: true);
    }
  }

  LocationSettings get _locationSettings {
    if (Platform.isIOS) {
      return AppleSettings(
        accuracy: LocationAccuracy.best,
        activityType: ActivityType.other,
        pauseLocationUpdatesAutomatically: false,
      );
    }
    return const LocationSettings(
      accuracy: LocationAccuracy.high,
    );
  }

  Future<void> _openLocationSettings() async {
    await Geolocator.openAppSettings();
  }

  Future<void> _openServiceSettings() async {
    await Geolocator.openLocationSettings();
  }

  double? _resolveCompassHeading(CompassEvent event) {
    // flutter_compass maps iOS CLHeading.trueHeading into `heading` when
    // location permission is available; Android provides sensor azimuth.
    // If the platform plugin cannot provide a valid value, keep the UI waiting.
    final heading = event.heading;
    if (heading == null || heading.isNaN || !heading.isFinite) {
      return null;
    }
    if (Platform.isIOS && heading < 0) {
      return null;
    }
    return QiblaCalculator.normalizeDegrees(heading);
  }

  double _smoothHeading(double? previousHeading, double nextHeading) {
    if (previousHeading == null) return nextHeading;
    final delta = QiblaCalculator.normalizeSignedDegrees(
      nextHeading - previousHeading,
    );
    return QiblaCalculator.normalizeDegrees(
      previousHeading + delta * _headingSmoothingFactor,
    );
  }

  void _updateAlignmentState() {
    final qiblaBearing = _qiblaBearing;
    final heading = _heading;
    if (qiblaBearing == null || heading == null) {
      _qiblaAligned = false;
      _lockedRelativeRotation = null;
      return;
    }

    final rotation = QiblaCalculator.relativeRotation(
      bearingToKaaba: qiblaBearing,
      deviceHeading: heading,
    );
    final distance = rotation.abs();
    if (_qiblaAligned) {
      if (distance > _alignExitThreshold) {
        _qiblaAligned = false;
        _lockedRelativeRotation = null;
      } else {
        _lockedRelativeRotation = 0;
      }
      return;
    }

    if (distance <= _alignEnterThreshold) {
      _qiblaAligned = true;
      _lockedRelativeRotation = 0;
      HapticFeedback.mediumImpact();
    }
  }

  void _logQiblaDebug({bool force = false}) {
    if (!force) {
      final now = DateTime.now();
      final last = _lastDebugLogAt;
      if (last != null && now.difference(last).inSeconds < 2) {
        return;
      }
      _lastDebugLogAt = now;
    }

    final position = _position;
    final qiblaBearing = _qiblaBearing;
    final heading = _heading;
    final rawHeading = _rawHeading;
    final rotation = qiblaBearing == null || heading == null
        ? null
        : QiblaCalculator.relativeRotation(
            bearingToKaaba: qiblaBearing,
            deviceHeading: heading,
          );
    debugPrint(
      'QIBLA_DEBUG lat=${position?.latitude.toStringAsFixed(6) ?? '-'} '
      'lon=${position?.longitude.toStringAsFixed(6) ?? '-'} '
      'bearing=${qiblaBearing?.toStringAsFixed(2) ?? '-'} '
      'heading=${heading?.toStringAsFixed(2) ?? '-'} '
      'raw_heading=${rawHeading?.toStringAsFixed(2) ?? '-'} '
      'rotation=${rotation?.toStringAsFixed(2) ?? '-'} '
      'aligned=$_qiblaAligned',
    );
  }

  @override
  Widget build(BuildContext context) {
    final qiblaBearing = _qiblaBearing;
    final heading = _heading;
    final relativeRotation = qiblaBearing == null || heading == null
        ? null
        : QiblaCalculator.relativeRotation(
            bearingToKaaba: qiblaBearing,
            deviceHeading: heading,
          );
    final displayRotation =
        _qiblaAligned ? _lockedRelativeRotation ?? 0 : relativeRotation;
    final referenceNote = _buildReferenceValidationNote(_position);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Kıble'),
        actions: [
          IconButton(
            tooltip: 'Yenile',
            onPressed: _loadLocation,
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: AppGradientBackground(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(18, 12, 18, 28),
          children: [
            _HeroCard(
              qiblaBearing: qiblaBearing,
              heading: heading,
              locationMessage: _locationMessage,
              compassMessage: _compassMessage,
              isAligned: _qiblaAligned,
            ),
            const SizedBox(height: AppSpacing.large),
            AppCard(
              padding: const EdgeInsets.fromLTRB(18, 20, 18, 20),
              child: Column(
                children: [
                  _CompassDial(
                    relativeRotation: displayRotation,
                    heading: heading,
                    qiblaBearing: qiblaBearing,
                    isAligned: _qiblaAligned,
                    compassMessage: _compassMessage,
                  ),
                  const SizedBox(height: 22),
                  _AlignmentStatus(
                    isAligned: _qiblaAligned,
                    hasDirection: qiblaBearing != null && heading != null,
                  ),
                  const SizedBox(height: 16),
                  Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    alignment: WrapAlignment.center,
                    children: [
                      _MetricChip(
                        label: 'Mevcut yön',
                        value: heading == null
                            ? 'Bekleniyor'
                            : '${heading.toStringAsFixed(0)}°',
                      ),
                      _MetricChip(
                        label: 'Kıble açısı',
                        value: qiblaBearing == null
                            ? 'Bekleniyor'
                            : '${qiblaBearing.toStringAsFixed(0)}°',
                      ),
                      if (_position != null)
                        _MetricChip(
                          label: 'Konum',
                          value:
                              '${_position!.latitude.toStringAsFixed(4)}, ${_position!.longitude.toStringAsFixed(4)}',
                        ),
                    ],
                  ),
                ],
              ),
            ),
            if (kDebugMode) ...[
              const SizedBox(height: AppSpacing.large),
              _QiblaDebugCard(
                position: _position,
                qiblaBearing: qiblaBearing,
                heading: heading,
                relativeRotation: displayRotation,
                rawRelativeRotation: relativeRotation,
                isAligned: _qiblaAligned,
                referenceNote: referenceNote,
              ),
            ],
            const SizedBox(height: AppSpacing.large),
            AppCard(
              padding: const EdgeInsets.fromLTRB(18, 18, 18, 18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Durum',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                          color: AppColors.textPrimary,
                        ),
                  ),
                  const SizedBox(height: 14),
                  if (_locationLoading)
                    const _InfoLine(
                      icon: Icons.location_searching_rounded,
                      text: 'Konum bilgisi alınıyor...',
                    )
                  else if (_locationMessage != null)
                    _InfoLine(
                      icon: Icons.location_off_outlined,
                      text: _locationMessage!,
                    )
                  else
                    const _InfoLine(
                      icon: Icons.check_circle_outline,
                      text: 'Konum alındı.',
                    ),
                  const SizedBox(height: 10),
                  if (_compassMessage != null)
                    _InfoLine(
                      icon: Icons.explore_off_outlined,
                      text: _compassMessage!,
                    )
                  else
                    const _InfoLine(
                      icon: Icons.explore_outlined,
                      text: 'Pusula verisi aktif.',
                    ),
                  const SizedBox(height: 16),
                  Wrap(
                    spacing: 12,
                    runSpacing: 12,
                    children: [
                      _ActionButton(
                        label: 'Tekrar dene',
                        icon: Icons.refresh_rounded,
                        onPressed: _loadLocation,
                      ),
                      ..._locationActionButtons(),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.large),
            const _QiblaTrustFooter(),
          ],
        ),
      ),
    );
  }

  List<Widget> _locationActionButtons() {
    final serviceEnabled = _locationServiceEnabled;
    final permission = _locationPermission;
    if (serviceEnabled == false) {
      return [
        _ActionButton(
          label: 'Konum servislerini aç',
          icon: Icons.gps_fixed_rounded,
          onPressed: _openServiceSettings,
        ),
      ];
    }
    if (permission == LocationPermission.denied) {
      return [
        _ActionButton(
          label: 'Konum izni ver',
          icon: Icons.location_on_outlined,
          onPressed: _loadLocation,
        ),
      ];
    }
    if (permission == LocationPermission.deniedForever) {
      return [
        _ActionButton(
          label: 'Konum izni ver',
          icon: Icons.settings_outlined,
          onPressed: _openLocationSettings,
        ),
      ];
    }
    return [
      _ActionButton(
        label: 'İzin ayarları',
        icon: Icons.settings_outlined,
        onPressed: _openLocationSettings,
      ),
      _ActionButton(
        label: 'Konum servislerini aç',
        icon: Icons.gps_fixed_rounded,
        onPressed: _openServiceSettings,
      ),
    ];
  }

  String _buildReferenceValidationNote(Position? position) {
    const baseNote =
        'Diyanet için stabil ve belgelenmiş halka açık Kıble API endpoint’i doğrulanmadı; bu ekran Diyanet’i üretimde canlı bağımlılık olarak kullanmaz.';
    if (position == null) {
      return '$baseNote Manuel kontrol referansı: İstanbul 151-152°, Ankara 154° civarı.';
    }

    final nearest = _nearestReferenceCity(position);
    if (nearest == null) {
      return '$baseNote Yakın şehir referansı yok; hesap yerel formülle yapılır.';
    }
    final calculated = QiblaCalculator.bearingToKaaba(
      latitude: nearest.latitude,
      longitude: nearest.longitude,
    );
    return '$baseNote ${nearest.name} manuel referans: ${nearest.expectedBearingLabel}. '
        'Yerel formül referans koordinatta ${calculated.toStringAsFixed(1)}°. ${nearest.note}';
  }

  QiblaReferenceCity? _nearestReferenceCity(Position position) {
    QiblaReferenceCity? nearest;
    double? nearestDistanceSquared;
    for (final reference in QiblaCalculator.referenceCities) {
      final latDelta = position.latitude - reference.latitude;
      final lonDelta = position.longitude - reference.longitude;
      final distanceSquared = latDelta * latDelta + lonDelta * lonDelta;
      if (nearestDistanceSquared == null ||
          distanceSquared < nearestDistanceSquared) {
        nearest = reference;
        nearestDistanceSquared = distanceSquared;
      }
    }
    if (nearestDistanceSquared == null || nearestDistanceSquared > 1.0) {
      return null;
    }
    return nearest;
  }
}

class _QiblaTrustFooter extends StatelessWidget {
  const _QiblaTrustFooter();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 2, 8, 4),
      child: Column(
        children: [
          Text(
            'Kıble yönü, bulunduğunuz konum ve Kâbe koordinatları kullanılarak büyük daire yönü yöntemiyle hesaplanmaktadır.',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  height: 1.55,
                  color: AppColors.textSecondary.withValues(alpha: 0.82),
                  fontWeight: FontWeight.w500,
                ),
          ),
          const SizedBox(height: 5),
          Text(
            'Pusula doğruluğu cihaz sensörleri ve konum servislerine bağlıdır.',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  height: 1.45,
                  color: AppColors.textMuted.withValues(alpha: 0.78),
                ),
          ),
        ],
      ),
    );
  }
}

class _HeroCard extends StatelessWidget {
  const _HeroCard({
    required this.qiblaBearing,
    required this.heading,
    required this.locationMessage,
    required this.compassMessage,
    required this.isAligned,
  });

  final double? qiblaBearing;
  final double? heading;
  final String? locationMessage;
  final String? compassMessage;
  final bool isAligned;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 18),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(AppRadius.medium),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              AppColors.surfaceSoft.withValues(alpha: 0.92),
              AppColors.card.withValues(alpha: 0.95),
            ],
          ),
          border: Border.all(
            color: AppColors.primaryAccent.withValues(alpha: 0.14),
            width: 1,
          ),
          boxShadow: [
            BoxShadow(
              color: AppColors.primaryAccent.withValues(alpha: 0.08),
              blurRadius: 24,
              offset: const Offset(0, 12),
            ),
          ],
        ),
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(16),
                    gradient: LinearGradient(
                      colors: [
                        (isAligned
                                ? Colors.greenAccent
                                : AppColors.primaryAccent)
                            .withValues(alpha: 0.9),
                        (isAligned
                                ? Colors.greenAccent
                                : AppColors.primaryAccentSoft)
                            .withValues(alpha: 0.75),
                      ],
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.primaryAccent.withValues(alpha: 0.28),
                        blurRadius: 18,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: Icon(
                    isAligned
                        ? Icons.check_circle_outline_rounded
                        : Icons.explore_outlined,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        isAligned ? 'Kıble yönü bulundu' : 'Kıble yönü',
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                              fontWeight: FontWeight.w900,
                              letterSpacing: -0.2,
                            ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        isAligned
                            ? 'Bu yön kıble yönüdür.'
                            : 'Konum ve pusula verisiyle Kâbe yönünü gösterir.',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: AppColors.textSecondary,
                              height: 1.55,
                            ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                _MetricChip(
                  label: 'Kıble',
                  value: qiblaBearing == null
                      ? 'Bekleniyor'
                      : '${qiblaBearing!.toStringAsFixed(0)}°',
                ),
                _MetricChip(
                  label: 'Yön',
                  value: heading == null
                      ? 'Bekleniyor'
                      : '${heading!.toStringAsFixed(0)}°',
                ),
                _MetricChip(
                  label: 'Durum',
                  value: locationMessage != null
                      ? 'Konum sorunu'
                      : compassMessage != null
                          ? 'Pusula sorunu'
                          : 'Hazır',
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _QiblaDebugCard extends StatelessWidget {
  const _QiblaDebugCard({
    required this.position,
    required this.qiblaBearing,
    required this.heading,
    required this.relativeRotation,
    required this.rawRelativeRotation,
    required this.isAligned,
    required this.referenceNote,
  });

  final Position? position;
  final double? qiblaBearing;
  final double? heading;
  final double? relativeRotation;
  final double? rawRelativeRotation;
  final bool isAligned;
  final String referenceNote;

  @override
  Widget build(BuildContext context) {
    final textStyle = Theme.of(context).textTheme.bodySmall?.copyWith(
      color: AppColors.textSecondary,
      height: 1.5,
      fontFeatures: const [FontFeature.tabularFigures()],
    );
    return AppCard(
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Kıble debug',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w800,
                  color: AppColors.textPrimary,
                ),
          ),
          const SizedBox(height: 10),
          Text(
            [
              'Konum: ${_formatCoordinate(position?.latitude)}, ${_formatCoordinate(position?.longitude)}',
              'Kıble açısı: ${_formatDegrees(qiblaBearing)}',
              'Pusula yönü: ${_formatDegrees(heading)}',
              'Dönüş açısı: ${_formatSignedDegrees(relativeRotation)}',
              'Ham dönüş: ${_formatSignedDegrees(rawRelativeRotation)}',
              'Hizalı: ${isAligned ? 'Evet' : 'Hayır'}',
              'Referans: $referenceNote',
            ].join('\n'),
            style: textStyle,
          ),
        ],
      ),
    );
  }

  static String _formatCoordinate(double? value) {
    return value == null ? 'Bekleniyor' : value.toStringAsFixed(6);
  }

  static String _formatDegrees(double? value) {
    return value == null ? 'Bekleniyor' : '${value.toStringAsFixed(2)}°';
  }

  static String _formatSignedDegrees(double? value) {
    if (value == null) return 'Bekleniyor';
    final prefix = value > 0 ? '+' : '';
    return '$prefix${value.toStringAsFixed(2)}°';
  }
}

class _AlignmentStatus extends StatelessWidget {
  const _AlignmentStatus({
    required this.isAligned,
    required this.hasDirection,
  });

  final bool isAligned;
  final bool hasDirection;

  @override
  Widget build(BuildContext context) {
    final color = isAligned ? Colors.greenAccent : AppColors.primaryAccentSoft;
    final title = isAligned
        ? 'Kıble yönü bulundu'
        : hasDirection
            ? 'Telefonu yavaşça çevirin'
            : 'Konum ve pusula bekleniyor';
    final subtitle = isAligned
        ? 'Bu yön kıble yönüdür'
        : hasDirection
            ? 'Ok merkeze geldiğinde yön sabitlenecek.'
            : 'Yön hesabı için konum ve pusula verisi gerekir.';

    return AnimatedContainer(
      duration: const Duration(milliseconds: 220),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: color.withValues(alpha: isAligned ? 0.16 : 0.1),
        borderRadius: BorderRadius.circular(AppRadius.medium),
        border: Border.all(
          color: color.withValues(alpha: isAligned ? 0.5 : 0.28),
          width: isAligned ? 1.4 : 1,
        ),
        boxShadow: isAligned
            ? [
                BoxShadow(
                  color: color.withValues(alpha: 0.16),
                  blurRadius: 20,
                  offset: const Offset(0, 10),
                ),
              ]
            : null,
      ),
      child: Row(
        children: [
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 180),
            child: Icon(
              isAligned
                  ? Icons.check_circle_outline_rounded
                  : Icons.screen_rotation_alt_outlined,
              key: ValueKey<bool>(isAligned),
              color: color,
              size: 24,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        color: AppColors.textPrimary,
                        fontWeight: FontWeight.w800,
                      ),
                ),
                const SizedBox(height: 3),
                Text(
                  subtitle,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.textSecondary,
                      ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _CompassDial extends StatelessWidget {
  const _CompassDial({
    required this.relativeRotation,
    required this.heading,
    required this.qiblaBearing,
    required this.isAligned,
    required this.compassMessage,
  });

  final double? relativeRotation;
  final double? heading;
  final double? qiblaBearing;
  final bool isAligned;
  final String? compassMessage;

  @override
  Widget build(BuildContext context) {
    final angle =
        relativeRotation == null ? 0.0 : relativeRotation! * math.pi / 180.0;
    final accentColor =
        isAligned ? Colors.greenAccent : AppColors.primaryAccentSoft;
    final primaryColor = isAligned ? Colors.green : AppColors.primaryAccent;

    return Column(
      children: [
        AnimatedContainer(
          duration: const Duration(milliseconds: 220),
          curve: Curves.easeOutCubic,
          width: 278,
          height: 278,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            boxShadow: isAligned
                ? [
                    BoxShadow(
                      color: Colors.greenAccent.withValues(alpha: 0.24),
                      blurRadius: 34,
                      spreadRadius: 6,
                    ),
                  ]
                : null,
          ),
          child: Stack(
            alignment: Alignment.center,
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 220),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      AppColors.surfaceSoft.withValues(alpha: 0.96),
                      AppColors.surface.withValues(alpha: 0.96),
                      AppColors.appBackground.withValues(alpha: 1),
                    ],
                  ),
                  border: Border.all(
                    color:
                        primaryColor.withValues(alpha: isAligned ? 0.55 : 0.18),
                    width: isAligned ? 2 : 1.2,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.26),
                      blurRadius: 28,
                      offset: const Offset(0, 14),
                    ),
                    BoxShadow(
                      color: primaryColor.withValues(
                          alpha: isAligned ? 0.22 : 0.12),
                      blurRadius: isAligned ? 34 : 26,
                      spreadRadius: isAligned ? 5 : 2,
                    ),
                  ],
                ),
              ),
              Container(
                width: 230,
                height: 230,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: AppColors.divider.withValues(alpha: 0.75),
                    width: 1,
                  ),
                ),
              ),
              Container(
                width: 180,
                height: 180,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color:
                        primaryColor.withValues(alpha: isAligned ? 0.24 : 0.1),
                    width: 1,
                  ),
                ),
              ),
              Positioned(
                top: 18,
                child: _DirectionMark(
                  label: 'N',
                  glow: true,
                  color: accentColor,
                ),
              ),
              const Positioned(
                right: 18,
                child: _DirectionMark(
                  label: 'E',
                  color: AppColors.textSecondary,
                ),
              ),
              const Positioned(
                bottom: 18,
                child: _DirectionMark(
                  label: 'S',
                  color: AppColors.textSecondary,
                ),
              ),
              const Positioned(
                left: 18,
                child: _DirectionMark(
                  label: 'W',
                  color: AppColors.textSecondary,
                ),
              ),
              AnimatedRotation(
                turns: angle / (math.pi * 2),
                duration: isAligned
                    ? const Duration(milliseconds: 120)
                    : const Duration(milliseconds: 180),
                curve: Curves.easeOutCubic,
                child: Icon(
                  Icons.navigation_rounded,
                  size: isAligned ? 134 : 126,
                  color: accentColor,
                  shadows: [
                    Shadow(
                      color: primaryColor.withValues(
                          alpha: isAligned ? 0.45 : 0.28),
                      blurRadius: isAligned ? 24 : 16,
                    ),
                    Shadow(
                      color: Colors.black.withValues(alpha: 0.2),
                      blurRadius: 12,
                    ),
                  ],
                ),
              ),
              AnimatedContainer(
                duration: const Duration(milliseconds: 220),
                width: isAligned ? 34 : 26,
                height: isAligned ? 34 : 26,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: primaryColor,
                  boxShadow: [
                    BoxShadow(
                      color: primaryColor.withValues(alpha: 0.4),
                      blurRadius: isAligned ? 24 : 18,
                      spreadRadius: isAligned ? 6 : 4,
                    ),
                  ],
                ),
                child: isAligned
                    ? const Icon(
                        Icons.check_rounded,
                        size: 21,
                        color: Colors.white,
                      )
                    : null,
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        Text(
          heading == null
              ? 'Pusula verisi bekleniyor'
              : 'Mevcut yön ${heading!.toStringAsFixed(0)}°',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: AppColors.textSecondary,
                fontWeight: FontWeight.w600,
              ),
        ),
        const SizedBox(height: 6),
        Text(
          qiblaBearing == null
              ? 'Kıble açısı alınamadı'
              : 'Kıble açısı ${qiblaBearing!.toStringAsFixed(0)}°',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: AppColors.textMuted,
              ),
        ),
        if (compassMessage != null) ...[
          const SizedBox(height: 10),
          Text(
            compassMessage!,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: AppColors.textSecondary,
                ),
          ),
        ],
      ],
    );
  }
}

class _DirectionMark extends StatelessWidget {
  const _DirectionMark({
    required this.label,
    required this.color,
    this.glow = false,
  });

  final String label;
  final Color color;
  final bool glow;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 36,
      height: 36,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: color.withValues(alpha: glow ? 0.18 : 0.12),
        border: Border.all(
          color: color.withValues(alpha: 0.45),
          width: 1,
        ),
        boxShadow: glow
            ? [
                BoxShadow(
                  color: color.withValues(alpha: 0.26),
                  blurRadius: 12,
                ),
              ]
            : null,
      ),
      alignment: Alignment.center,
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelLarge?.copyWith(
              color: color,
              fontWeight: FontWeight.w800,
            ),
      ),
    );
  }
}

class _MetricChip extends StatelessWidget {
  const _MetricChip({
    required this.label,
    required this.value,
  });

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.surfaceSoft.withValues(alpha: 0.7),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: AppColors.divider.withValues(alpha: 0.75),
          width: 0.8,
        ),
      ),
      child: RichText(
        text: TextSpan(
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: AppColors.textSecondary,
              ),
          children: [
            TextSpan(
              text: '$label\n',
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
            TextSpan(
              text: value,
              style: const TextStyle(
                color: AppColors.textPrimary,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _InfoLine extends StatelessWidget {
  const _InfoLine({
    required this.icon,
    required this.text,
  });

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 18, color: AppColors.primaryAccentSoft),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            text,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  height: 1.5,
                  color: AppColors.textPrimary,
                ),
          ),
        ),
      ],
    );
  }
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({
    required this.label,
    required this.icon,
    required this.onPressed,
  });

  final String label;
  final IconData icon;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      onPressed: onPressed,
      icon: Icon(icon, size: 18),
      label: Text(label),
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.textPrimary,
        side: BorderSide(
          color: AppColors.primaryAccent.withValues(alpha: 0.32),
        ),
        backgroundColor: AppColors.surfaceSoft.withValues(alpha: 0.15),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.medium),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      ),
    );
  }
}
