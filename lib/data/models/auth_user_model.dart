class AuthUserModel {
  const AuthUserModel({
    required this.id,
    required this.email,
    required this.createdAt,
    required this.termsAcceptedAt,
    required this.privacyPolicyAcceptedAt,
    required this.marketingConsent,
    required this.adPersonalizationConsent,
  });

  final String id;
  final String email;
  final DateTime? createdAt;
  final DateTime? termsAcceptedAt;
  final DateTime? privacyPolicyAcceptedAt;
  final bool marketingConsent;
  final bool adPersonalizationConsent;

  factory AuthUserModel.fromJson(Map<String, dynamic> json) {
    return AuthUserModel(
      id: json['id']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      createdAt: _parseDate(json['created_at']),
      termsAcceptedAt: _parseDate(json['terms_accepted_at']),
      privacyPolicyAcceptedAt: _parseDate(json['privacy_policy_accepted_at']),
      marketingConsent: json['marketing_consent'] == true,
      adPersonalizationConsent: json['ad_personalization_consent'] == true,
    );
  }

  static DateTime? _parseDate(Object? value) {
    if (value is! String || value.isEmpty) return null;
    return DateTime.tryParse(value);
  }
}
