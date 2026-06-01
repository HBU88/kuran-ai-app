import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:timezone/timezone.dart' as tz;

/// Namaz vakitleri için 10 dakika öncesi iOS local notification yöneticisi.
///
/// Kullanım:
///   1. `initialize()` → app başlarken bir kez çağır.
///   2. `requestPermission()` → kullanıcıdan izin iste.
///   3. `schedulePrayerNotifications(prayers, cityName)` → vakitler yüklenince çağır.
///   4. `cancelAllPrayerNotifications()` → bildirimler kapatılınca.
class NotificationHelper {
  NotificationHelper(this._plugin);

  final FlutterLocalNotificationsPlugin _plugin;

  // Sabit bildirim ID'leri: her vakit için 100-105 arası.
  static const _prayerNotificationIds = {
    'İmsak': 100,
    'Güneş': 101,
    'Öğle': 102,
    'İkindi': 103,
    'Akşam': 104,
    'Yatsı': 105,
  };

  // İzin verildiğinde bir kez gösterilen "bildirimler açıldı" önizlemesi.
  static const _previewNotificationId = 1;

  Future<void> initialize() async {
    const android = AndroidInitializationSettings('@mipmap/ic_launcher');
    const darwin = DarwinInitializationSettings(
      requestAlertPermission: false,
      requestBadgePermission: false,
      requestSoundPermission: false,
    );
    const settings = InitializationSettings(
      android: android,
      iOS: darwin,
      macOS: darwin,
    );
    await _plugin.initialize(settings);
  }

  /// iOS bildirim iznini ister. [true] → izin verildi.
  Future<bool> requestPermission() async {
    // iOS-specific permission request via flutter_local_notifications
    final iOSPlugin =
        _plugin.resolvePlatformSpecificImplementation<
            IOSFlutterLocalNotificationsPlugin>();
    if (iOSPlugin != null) {
      final granted = await iOSPlugin.requestPermissions(
        alert: true,
        badge: true,
        sound: true,
      );
      return granted ?? false;
    }
    // Fallback: permission_handler
    final status = await Permission.notification.request();
    return status.isGranted || status.isLimited;
  }

  /// Mevcut bildirim iznini kontrol eder (sorgulamadan).
  Future<bool> hasPermission() async {
    final status = await Permission.notification.status;
    return status.isGranted || status.isLimited;
  }

  /// Bugünün namaz vakitleri için 10 dakika öncesi bildirimleri zamanlar.
  ///
  /// [prayers] — PrayerTimeModel.prayers (vakit adı → DateTime)
  /// [cityName] — bildirim metninde gösterilecek şehir adı
  ///
  /// Geçmiş vakitler atlanır. Gelecekteki tüm vakitler için birer
  /// bildirim oluşturulur.
  Future<void> schedulePrayerNotifications(
    Map<String, DateTime> prayers,
    String cityName,
  ) async {
    await cancelAllPrayerNotifications();

    final now = DateTime.now();
    int scheduled = 0;

    for (final entry in prayers.entries) {
      final name = entry.key;
      final id = _prayerNotificationIds[name];
      if (id == null) continue; // Bilinmeyen vakit adı

      // 10 dk öncesi (device local timezone'da)
      final prayerLocal = DateTime(
        now.year,
        now.month,
        now.day,
        entry.value.hour,
        entry.value.minute,
      );
      final notifyAt = prayerLocal.subtract(const Duration(minutes: 10));

      if (notifyAt.isBefore(now)) {
        // Bu vakit geçmiş, atla
        continue;
      }

      try {
        await _plugin.zonedSchedule(
          id,
          '🕌 Namaz vakti yaklaşıyor',
          '$name namazına 10 dakika kaldı${cityName.isNotEmpty ? ' — $cityName' : ''}',
          tz.TZDateTime.from(notifyAt, tz.local),
          _notificationDetails(),
          androidScheduleMode: AndroidScheduleMode.exactAllowWhileIdle,
          uiLocalNotificationDateInterpretation:
              UILocalNotificationDateInterpretation.absoluteTime,
        );
        scheduled++;
        debugPrint(
          'HAKAI_NOTIF scheduled: $name @ ${notifyAt.hour}:${notifyAt.minute.toString().padLeft(2, '0')}',
        );
      } catch (e) {
        debugPrint('HAKAI_NOTIF schedule_error: $name → $e');
      }
    }

    debugPrint('HAKAI_NOTIF total_scheduled=$scheduled for $cityName');
  }

  /// Tüm namaz vakti bildirimlerini iptal eder.
  Future<void> cancelAllPrayerNotifications() async {
    for (final id in _prayerNotificationIds.values) {
      await _plugin.cancel(id);
    }
    debugPrint('HAKAI_NOTIF cancelled all prayer notifications');
  }

  /// Bildirimler açıldığında bir kez gösterilen önizleme bildirimi.
  Future<void> showPrayerTogglePreview() async {
    await _plugin.show(
      _previewNotificationId,
      '✅ Bildirimler açık',
      'Namaz vakitlerine 10 dakika kala hatırlatılacaksınız.',
      _notificationDetails(),
    );
  }

  NotificationDetails _notificationDetails() {
    const androidDetails = AndroidNotificationDetails(
      'prayer_times',
      'Namaz Vakitleri',
      channelDescription: 'Namaz vakti 10 dakika öncesi hatırlatmaları',
      importance: Importance.high,
      priority: Priority.high,
    );
    const darwinDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: false,
      presentSound: true,
    );
    return const NotificationDetails(
      android: androidDetails,
      iOS: darwinDetails,
      macOS: darwinDetails,
    );
  }
}
