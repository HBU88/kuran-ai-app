import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../../core/utils/situation_tag_mapper.dart';
import '../../models/situation_intent_model.dart';

class SituationIntentService {
  const SituationIntentService({http.Client? client}) : _client = client;

  static const _enabledByConfig = bool.fromEnvironment(
    'SITUATION_AI_ENABLED',
  );
  static const _analysisEndpoint = String.fromEnvironment(
    'SITUATION_AI_ENDPOINT',
  );
  static const _analysisApiKey = String.fromEnvironment(
    'SITUATION_AI_API_KEY',
  );
  static const _analysisModel = String.fromEnvironment(
    'SITUATION_AI_MODEL',
    defaultValue: 'intent-analyzer',
  );

  static bool get realAiConfigured {
    return _enabledByConfig &&
        _analysisEndpoint.trim().isNotEmpty &&
        _analysisApiKey.trim().isNotEmpty;
  }

  final http.Client? _client;

  Future<SituationIntentAnalysis> analyze(String rawInput) async {
    if (realAiConfigured) {
      try {
        return await _analyzeWithAi(rawInput);
      } catch (_) {
      }
    }

    final fallback = SituationTagMapper.analyze(rawInput);
    return fallback;
  }

  Future<SituationIntentAnalysis> _analyzeWithAi(String rawInput) async {
    final client = _client ?? http.Client();
    final fallback = SituationTagMapper.analyze(rawInput);
    final response = await client.post(
      Uri.parse(_analysisEndpoint),
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $_analysisApiKey',
      },
      body: jsonEncode({
        'model': _analysisModel,
        'input': rawInput,
        'supported_themes': SituationTagMapper.supportedThemes,
        'output_schema': {
          'primary_theme': 'string',
          'secondary_themes': ['string'],
          'emotion': 'string',
          'severity': 'low|medium|high',
          'confidence': 'number',
        },
        'rules': [
          'Return only structured intent JSON.',
          'Do not choose or invent ayahs.',
          'Use only supported_themes.',
          'Use gentle, non-fatwa wording if notes are included.',
        ],
      }),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw StateError(
        'AI intent request failed: ${response.statusCode} ${response.body}',
      );
    }

    final decoded = jsonDecode(response.body);
    final payload = _readAnalysisPayload(decoded);
    final primaryTheme = _safeTheme(
      payload['primary_theme']?.toString(),
      fallback.primaryTheme,
    );
    final secondaryThemes = _readSecondaryThemes(
      payload['secondary_themes'],
      fallback.secondaryThemes,
      primaryTheme,
    );
    final emotion = payload['emotion']?.toString().trim();
    final severity = payload['severity']?.toString().trim();
    final confidence = payload['confidence'];

    return SituationIntentAnalysis(
      rawInput: fallback.rawInput,
      normalizedInput: fallback.normalizedInput,
      primaryTheme: primaryTheme,
      secondaryThemes: secondaryThemes,
      emotion: emotion == null || emotion.isEmpty ? fallback.emotion : emotion,
      severity: _safeSeverity(severity, fallback.severity),
      confidence: _safeConfidence(confidence, fallback.confidence),
      aiEnabled: true,
      matchedKeywords: fallback.matchedKeywords,
      themeScores: {
        primaryTheme: 100,
        for (var i = 0; i < secondaryThemes.length; i++)
          secondaryThemes[i]: 48 - (i * 8),
      },
    );
  }

  Map<String, dynamic> _readAnalysisPayload(Object? decoded) {
    if (decoded is Map<String, dynamic>) {
      final data = decoded['data'];
      if (data is Map<String, dynamic>) {
        return data;
      }
      final analysis = decoded['analysis'];
      if (analysis is Map<String, dynamic>) {
        return analysis;
      }
      return decoded;
    }
    throw const FormatException('AI intent response was not a JSON object.');
  }

  String _safeTheme(String? value, String fallback) {
    final normalized = value?.trim();
    if (normalized != null &&
        SituationTagMapper.supportedThemes.contains(normalized)) {
      return normalized;
    }
    return fallback;
  }

  List<String> _readSecondaryThemes(
    Object? value,
    List<String> fallback,
    String primaryTheme,
  ) {
    final rawThemes = value is List ? value : fallback;
    return rawThemes
        .map((item) => item.toString().trim())
        .where(SituationTagMapper.supportedThemes.contains)
        .where((theme) => theme != primaryTheme)
        .toSet()
        .take(3)
        .toList();
  }

  String _safeSeverity(String? value, String fallback) {
    const allowed = {'low', 'medium', 'high'};
    final normalized = value?.toLowerCase().trim();
    if (normalized != null && allowed.contains(normalized)) {
      return normalized;
    }
    return fallback;
  }

  double _safeConfidence(Object? value, double fallback) {
    final parsed = value is num ? value.toDouble() : double.tryParse('$value');
    if (parsed == null) {
      return fallback;
    }
    return parsed.clamp(0.0, 1.0);
  }
}
