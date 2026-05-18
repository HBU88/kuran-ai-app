import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:permission_handler/permission_handler.dart';

class NotificationHelper {
  NotificationHelper(this._plugin);

  final FlutterLocalNotificationsPlugin _plugin;

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

  Future<void> showPrayerTogglePreview() async {
    final status = await Permission.notification.request();
    if (!status.isGranted && !status.isLimited) {
      return;
    }

    const androidDetails = AndroidNotificationDetails(
      'prayer_times',
      'Namaz vakitleri',
      channelDescription: 'Namaz vakti hatirlaticilari',
      importance: Importance.defaultImportance,
      priority: Priority.defaultPriority,
    );
    const darwinDetails = DarwinNotificationDetails();
    const details = NotificationDetails(
      android: androidDetails,
      iOS: darwinDetails,
      macOS: darwinDetails,
    );
    await _plugin.show(
      1,
      'Bildirimler açık',
      'Namaz vakti hatırlatmaları etkinleştirildi.',
      details,
    );
  }
}
