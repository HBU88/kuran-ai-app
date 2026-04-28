// ignore_for_file: prefer_single_quotes

import 'package:flutter/foundation.dart';
import 'dart:math';

import '../../data/models/chat_message_model.dart';
import '../../data/sources/remote/chat_agent_service.dart';

class ChatController extends ChangeNotifier {
  ChatController({ChatAgentService? service})
    : _service = service ?? ChatAgentService();

  final ChatAgentService _service;

  final List<ChatMessageModel> _messages = [];
  bool loading = false;
  bool runningSmokeTest = false;
  String? errorMessage;
  String? debugErrorMessage;

  static const starterPrompts = [
    "iyi değilim",
    "çok yalnızım",
    "Allah beni affeder mi",
    "içim daralıyor",
    "çok hastayım",
    "ne yapacağımı bilmiyorum",
  ];

  static const _smokeTestPools = {
    "ayah": [
      "sabır ile ilgili ayet var mı",
      "korku hakkında ayet paylaş",
      "umut veren bir ayet söyler misin",
      "tövbe ile ilgili ayet var mı",
      "yalnızlıkla ilgili ayet var mı",
    ],
    "knowledge": [
      "akşam namazı kaç rekat",
      "abdest nasıl alınır",
      "orucu bozan şeyler nelerdir",
      "zekât kimlere verilir",
      "dua nasıl edilir",
    ],
    "prophet": [
      "Hz Muhammed nasıl biriydi",
      "peygamberimizin ahlakı nasıldı",
      "peygamberimiz hakkında Kur'an'da ne geçiyor",
      "Resulullah insanlara nasıl davranırdı",
    ],
    "support": [
      "çok korkuyorum",
      "içim daralıyor",
      "moralim bozuk",
      "yalnız hissediyorum",
      "endişeliyim",
    ],
    "casual": ["merhaba", "nasılsın", "bugün biraz konuşabilir miyiz"],
  };

  List<ChatMessageModel> get messages => List.unmodifiable(_messages);
  bool get isEmpty => _messages.isEmpty;

  void clearConversation() {
    if (_messages.isEmpty && !loading && !runningSmokeTest) {
      errorMessage = null;
      debugErrorMessage = null;
      return;
    }

    _messages.clear();
    loading = false;
    runningSmokeTest = false;
    errorMessage = null;
    debugErrorMessage = null;
    notifyListeners();
  }

  Future<void> send(String rawMessage) async {
    final message = rawMessage.trim();
    if (message.isEmpty || loading) {
      return;
    }

    errorMessage = null;
    debugErrorMessage = null;
    final history = _recentHistory();
    _messages.add(
      ChatMessageModel(
        id: _nextId(),
        role: 'user',
        text: message,
        createdAt: DateTime.now(),
      ),
    );
    loading = true;
    notifyListeners();

    try {
      final response = await _service.sendMessage(message, history: history);
      _messages.add(
        _assistantMessageFromResponse(
          response,
          sourceUserText: message,
          sentHistoryCount: history.length,
        ),
      );
    } on ChatAgentException catch (error) {
      errorMessage = error.toString();
      debugErrorMessage = error.toString();
      _messages.add(
        ChatMessageModel(
          id: _nextId(),
          role: 'assistant',
          text: 'Şu an cevap oluşturulamadı. Lütfen tekrar deneyin.',
          createdAt: DateTime.now(),
          sourceUserText: message,
          technicalError: error.toString(),
          debugHttpStatus: error.statusCode,
          debugResponseBody: error.responseBody,
          debugParsedErrorMessage: error.parsedErrorMessage,
          debugSentHistoryCount: history.length,
        ),
      );
    } catch (error) {
      errorMessage = error.toString();
      debugErrorMessage = error.toString();
      _messages.add(
        ChatMessageModel(
          id: _nextId(),
          role: 'assistant',
          text: 'Şu an cevap oluşturulamadı. Lütfen tekrar deneyin.',
          createdAt: DateTime.now(),
          sourceUserText: message,
          technicalError: error.toString(),
          debugSentHistoryCount: history.length,
        ),
      );
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  Future<void> runDebugSmokeTest({Random? random}) async {
    if (!kDebugMode || runningSmokeTest || loading) {
      return;
    }

    runningSmokeTest = true;
    notifyListeners();

    try {
      final rng = random ?? Random();
      final prompts = [
        _pickOne(_smokeTestPools['ayah']!, rng),
        _pickOne(_smokeTestPools['knowledge']!, rng),
        _pickOne(_smokeTestPools['prophet']!, rng),
        _pickOne(_smokeTestPools['support']!, rng),
        _pickOne(_smokeTestPools['casual']!, rng),
      ];

      for (final prompt in prompts) {
        await _sendSmokePrompt(prompt);
        await Future<void>.delayed(const Duration(milliseconds: 500));
      }
    } finally {
      runningSmokeTest = false;
      notifyListeners();
    }
  }

  Future<void> _sendSmokePrompt(String prompt) async {
    final beforeCount = _messages.length;
    await send(prompt);
    await _waitForMessageGrowth(beforeCount + 2);
  }

  Future<void> _waitForMessageGrowth(int targetLength) async {
    var attempts = 0;
    while (_messages.length < targetLength && attempts < 100) {
      await Future<void>.delayed(const Duration(milliseconds: 25));
      attempts += 1;
    }
  }

  ChatMessageModel _assistantMessageFromResponse(
    Map<String, dynamic> json, {
    required String sourceUserText,
    required int sentHistoryCount,
  }) {
    _validateResponse(json);
    final selectedAyahJson = json['selected_ayah'];
    final debugJson = json['debug'];
    return ChatMessageModel(
      id: _nextId(),
      role: 'assistant',
      text: json['assistant_text']?.toString() ?? '',
      createdAt: DateTime.now(),
      sourceUserText: sourceUserText,
      selectedAyah: selectedAyahJson is Map<String, dynamic>
          ? ChatSelectedAyah.fromJson(selectedAyahJson)
          : null,
      intent: json['intent']?.toString(),
      primaryTheme: json['primary_theme']?.toString(),
      responseType: json['response_type']?.toString(),
      contextTopic: json['context_topic']?.toString(),
      ayahUsed: json['ayah_used'] == true,
      topAyahIds: _readIntList(json['top_ayah_ids']),
      secondaryThemes: _readStringList(json['secondary_themes']),
      emotion: json['emotion']?.toString(),
      severity: json['severity']?.toString(),
      debugSentHistoryCount: sentHistoryCount,
      debug: debugJson is Map<String, dynamic>
          ? ChatDebugInfo.fromJson(debugJson)
          : debugJson is Map
          ? ChatDebugInfo.fromJson(
              Map<String, dynamic>.from(
                debugJson.map((key, value) => MapEntry(key.toString(), value)),
              ),
            )
          : null,
    );
  }

  void _validateResponse(Map<String, dynamic> json) {
    final missing = <String>[];
    for (final key in const [
      'intent',
      'response_type',
      'assistant_text',
      'selected_ayah',
    ]) {
      if (!json.containsKey(key)) {
        missing.add(key);
      }
    }
    if (missing.isNotEmpty) {
      throw ChatAgentException(
        'HAKAI response missing required fields: ${missing.join(', ')}.',
        responseBody: json.toString(),
      );
    }
  }

  String _nextId() {
    return DateTime.now().microsecondsSinceEpoch.toString();
  }

  List<Map<String, dynamic>> _recentHistory() {
    return _messages.where(_shouldSendInHistory).toList().takeLast(6).map((
      message,
    ) {
      return {
        'role': message.role,
        'text': message.text,
        if (message.intent != null) 'intent': message.intent,
        if (message.primaryTheme != null) 'primary_theme': message.primaryTheme,
        if (message.responseType != null) 'response_type': message.responseType,
        if (message.selectedAyahId != null)
          'selected_ayah_id': message.selectedAyahId,
        if (!message.isUser && message.secondaryThemes != null)
          'secondary_themes': message.secondaryThemes,
        if (!message.isUser && message.emotion != null)
          'emotion': message.emotion,
        if (!message.isUser && message.severity != null)
          'severity': message.severity,
        if (!message.isUser && message.contextTopic != null)
          'context_topic': message.contextTopic,
      };
    }).toList();
  }

  bool _shouldSendInHistory(ChatMessageModel message) {
    if (message.isUser) {
      return true;
    }
    return message.technicalError == null &&
        message.responseType != null &&
        message.text.trim().isNotEmpty;
  }
}

extension _RecentMessages<T> on List<T> {
  Iterable<T> takeLast(int count) {
    if (length <= count) {
      return this;
    }
    return skip(length - count);
  }
}

List<int> _readIntList(Object? value) {
  if (value is! List) {
    return const [];
  }
  return value
      .map((item) => item is int ? item : int.tryParse(item.toString()) ?? 0)
      .where((item) => item > 0)
      .toList();
}

List<String> _readStringList(Object? value) {
  if (value is! List) {
    return const [];
  }
  return value.map((item) => item.toString()).toList();
}

T _pickOne<T>(List<T> values, Random rng) {
  if (values.isEmpty) {
    throw StateError('Cannot pick from an empty list.');
  }
  return values[rng.nextInt(values.length)];
}
