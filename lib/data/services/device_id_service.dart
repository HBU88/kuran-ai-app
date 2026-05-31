import 'dart:math';

import 'package:shared_preferences/shared_preferences.dart';

/// Generates and persists a stable anonymous device ID for server-side quota
/// tracking. The ID is a UUID v4 generated once and stored in SharedPreferences.
/// No personally-identifiable information is ever included.
class DeviceIdService {
  static const _storageKey = 'hakai_device_id';

  String? _cachedId;

  /// Returns the device ID, generating and persisting it on first call.
  Future<String> getDeviceId() async {
    if (_cachedId != null) return _cachedId!;
    final prefs = await SharedPreferences.getInstance();
    var id = prefs.getString(_storageKey);
    if (id == null || id.isEmpty) {
      id = _generateUuidV4();
      await prefs.setString(_storageKey, id);
    }
    _cachedId = id;
    return id;
  }

  /// Generates a RFC-4122 UUID v4 using dart:math (no extra package needed).
  static String _generateUuidV4() {
    final random = Random.secure();
    final bytes = List<int>.generate(16, (_) => random.nextInt(256));
    // Set version bits: version 4
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    // Set variant bits: 10xx
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    final hex =
        bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
    return '${hex.substring(0, 8)}-'
        '${hex.substring(8, 12)}-'
        '${hex.substring(12, 16)}-'
        '${hex.substring(16, 20)}-'
        '${hex.substring(20)}';
  }
}
