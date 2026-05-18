import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
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
  StreamSubscription<CompassEvent>? _compassSubscription;

  Position? _position;
  double? _heading;
  double? _qiblaBearing;
  String? _locationMessage;
  String? _compassMessage;
  bool _locationLoading = true;

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
        final heading = event.heading;
        setState(() {
          if (heading == null || heading.isNaN) {
            _heading = null;
            _compassMessage = 'Pusula verisi alınamadı.';
          } else {
            _heading = heading;
            _compassMessage = null;
          }
        });
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
      if (!serviceEnabled) {
        setState(() {
          _locationMessage = 'Konum servisi kapalı.';
          _locationLoading = false;
        });
        return;
      }

      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }

      if (permission == LocationPermission.denied) {
        setState(() {
          _locationMessage = 'Konum izni verilmedi.';
          _locationLoading = false;
        });
        return;
      }

      if (permission == LocationPermission.deniedForever) {
        setState(() {
          _locationMessage = 'Konum izni kalıcı olarak reddedildi.';
          _locationLoading = false;
        });
        return;
      }

      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
        ),
      );

      final bearing = QiblaCalculator.bearingToKaaba(
        latitude: position.latitude,
        longitude: position.longitude,
      );

      if (!mounted) return;
      setState(() {
        _position = position;
        _qiblaBearing = bearing;
        _locationLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _locationMessage = 'Konum alınamadı.';
        _locationLoading = false;
      });
    }
  }

  Future<void> _openLocationSettings() async {
    await Geolocator.openAppSettings();
  }

  Future<void> _openServiceSettings() async {
    await Geolocator.openLocationSettings();
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
            ),
            const SizedBox(height: AppSpacing.large),
            AppCard(
              padding: const EdgeInsets.fromLTRB(18, 20, 18, 20),
              child: Column(
                children: [
                  _CompassDial(
                    relativeRotation: relativeRotation,
                    heading: heading,
                    qiblaBearing: qiblaBearing,
                    compassMessage: _compassMessage,
                  ),
                  const SizedBox(height: 22),
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
                      _ActionButton(
                        label: 'İzin ayarları',
                        icon: Icons.settings_outlined,
                        onPressed: _openLocationSettings,
                      ),
                      _ActionButton(
                        label: 'Konum ayarları',
                        icon: Icons.gps_fixed_rounded,
                        onPressed: _openServiceSettings,
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.large),
            AppCard(
              padding: const EdgeInsets.fromLTRB(18, 16, 18, 16),
              child: Text(
                'Kıble oku, cihaz yönüne göre döner. Konum veya pusula verisi yoksa yön hesabı yapılamaz.',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      height: 1.6,
                      color: AppColors.textSecondary,
                    ),
              ),
            ),
          ],
        ),
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
  });

  final double? qiblaBearing;
  final double? heading;
  final String? locationMessage;
  final String? compassMessage;

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
                        AppColors.primaryAccent.withValues(alpha: 0.9),
                        AppColors.primaryAccentSoft.withValues(alpha: 0.75),
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
                  child: const Icon(
                    Icons.explore_outlined,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Kıble yönü',
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                              fontWeight: FontWeight.w900,
                              letterSpacing: -0.2,
                            ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Konum ve pusula verisiyle Kâbe yönünü gösterir.',
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

class _CompassDial extends StatelessWidget {
  const _CompassDial({
    required this.relativeRotation,
    required this.heading,
    required this.qiblaBearing,
    required this.compassMessage,
  });

  final double? relativeRotation;
  final double? heading;
  final double? qiblaBearing;
  final String? compassMessage;

  @override
  Widget build(BuildContext context) {
    final angle = relativeRotation == null
        ? 0.0
        : relativeRotation! * math.pi / 180.0;

    return Column(
      children: [
        SizedBox(
          width: 278,
          height: 278,
          child: Stack(
            alignment: Alignment.center,
            children: [
              Container(
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
                    color: AppColors.primaryAccent.withValues(alpha: 0.18),
                    width: 1.2,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.26),
                      blurRadius: 28,
                      offset: const Offset(0, 14),
                    ),
                    BoxShadow(
                      color: AppColors.primaryAccent.withValues(alpha: 0.12),
                      blurRadius: 26,
                      spreadRadius: 2,
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
                    color: AppColors.primaryAccent.withValues(alpha: 0.1),
                    width: 1,
                  ),
                ),
              ),
              const Positioned(
                top: 18,
                child: _DirectionMark(
                  label: 'N',
                  glow: true,
                  color: AppColors.primaryAccentSoft,
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
              Transform.rotate(
                angle: angle,
                child: TweenAnimationBuilder<double>(
                  tween: Tween<double>(
                    begin: 0,
                    end: relativeRotation ?? 0,
                  ),
                  duration: const Duration(milliseconds: 250),
                  builder: (context, value, child) {
                    return child!;
                  },
                  child: Icon(
                    Icons.navigation_rounded,
                    size: 126,
                    color: AppColors.primaryAccentSoft,
                    shadows: [
                      Shadow(
                        color: AppColors.primaryAccent.withValues(alpha: 0.28),
                        blurRadius: 16,
                      ),
                      Shadow(
                        color: Colors.black.withValues(alpha: 0.2),
                        blurRadius: 12,
                      ),
                    ],
                  ),
                ),
              ),
              Container(
                width: 26,
                height: 26,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.primaryAccent,
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.primaryAccent.withValues(alpha: 0.4),
                      blurRadius: 18,
                      spreadRadius: 4,
                    ),
                  ],
                ),
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
