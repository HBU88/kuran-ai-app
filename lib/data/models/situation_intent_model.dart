class SituationIntentAnalysis {
  const SituationIntentAnalysis({
    required this.rawInput,
    required this.normalizedInput,
    required this.primaryTheme,
    required this.secondaryThemes,
    required this.emotion,
    required this.severity,
    required this.confidence,
    required this.aiEnabled,
    required this.matchedKeywords,
    required this.themeScores,
  });

  final String rawInput;
  final String normalizedInput;
  final String primaryTheme;
  final List<String> secondaryThemes;
  final String emotion;
  final String severity;
  final double confidence;
  final bool aiEnabled;
  final List<String> matchedKeywords;
  final Map<String, int> themeScores;

  List<String> get themes => [primaryTheme, ...secondaryThemes];

  Map<String, dynamic> toJson() {
    return {
      'primary_theme': primaryTheme,
      'secondary_themes': secondaryThemes,
      'emotion': emotion,
      'severity': severity,
      'confidence': confidence,
    };
  }
}
