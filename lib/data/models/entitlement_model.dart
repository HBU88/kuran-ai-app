class EntitlementModel {
  const EntitlementModel({
    required this.userId,
    required this.religiousChatCreditsRemaining,
    required this.supporterStatus,
    this.updatedAt,
  });

  final String userId;
  final int religiousChatCreditsRemaining;
  final bool supporterStatus;
  final DateTime? updatedAt;

  factory EntitlementModel.fromJson(Map<String, dynamic> json) {
    return EntitlementModel(
      userId: json['user_id']?.toString() ?? '',
      religiousChatCreditsRemaining:
          _readInt(json['religious_chat_credits_remaining']),
      supporterStatus: json['supporter_status'] == true,
      updatedAt: _parseDate(json['updated_at']),
    );
  }
}

class ReligiousChatUsageStatus {
  const ReligiousChatUsageStatus({
    required this.religiousChatCreditsRemaining,
    required this.canConsume,
    required this.supporterStatus,
  });

  final int religiousChatCreditsRemaining;
  final bool canConsume;
  final bool supporterStatus;

  factory ReligiousChatUsageStatus.fromJson(Map<String, dynamic> json) {
    return ReligiousChatUsageStatus(
      religiousChatCreditsRemaining:
          _readInt(json['religious_chat_credits_remaining']),
      canConsume: json['can_consume'] == true,
      supporterStatus: json['supporter_status'] == true,
    );
  }
}

class PurchaseVerificationResult {
  const PurchaseVerificationResult({
    required this.status,
    required this.creditsGranted,
    required this.entitlements,
    this.message,
  });

  final String status;
  final int creditsGranted;
  final EntitlementModel entitlements;
  final String? message;

  factory PurchaseVerificationResult.fromJson(Map<String, dynamic> json) {
    final purchase = json['purchase'];
    final entitlements = json['entitlements'];
    return PurchaseVerificationResult(
      status: purchase is Map<String, dynamic>
          ? purchase['status']?.toString() ?? 'pending'
          : 'pending',
      creditsGranted: purchase is Map<String, dynamic>
          ? _readInt(purchase['credits_granted'])
          : 0,
      entitlements: entitlements is Map<String, dynamic>
          ? EntitlementModel.fromJson(entitlements)
          : const EntitlementModel(
              userId: '',
              religiousChatCreditsRemaining: 0,
              supporterStatus: false,
            ),
      message: json['message']?.toString(),
    );
  }
}

int _readInt(Object? value) {
  if (value is int) return value;
  return int.tryParse(value?.toString() ?? '') ?? 0;
}

DateTime? _parseDate(Object? value) {
  if (value is! String || value.isEmpty) return null;
  return DateTime.tryParse(value);
}
