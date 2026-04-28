class ChatMessageModel {
  const ChatMessageModel({
    required this.id,
    required this.role,
    required this.text,
    required this.createdAt,
    this.sourceUserText,
    this.selectedAyah,
    this.intent,
    this.primaryTheme,
    this.responseType,
    this.redirectModule,
    this.contextTopic,
    this.ayahUsed,
    this.topAyahIds,
    this.secondaryThemes,
    this.emotion,
    this.severity,
    this.technicalError,
    this.debugHttpStatus,
    this.debugResponseBody,
    this.debugParsedErrorMessage,
    this.debugSentHistoryCount,
    this.debug,
  });

  final String id;
  final String role;
  final String text;
  final DateTime createdAt;
  final String? sourceUserText;
  final ChatSelectedAyah? selectedAyah;
  final String? intent;
  final String? primaryTheme;
  final String? responseType;
  final String? redirectModule;
  final String? contextTopic;
  final bool? ayahUsed;
  final List<int>? topAyahIds;
  final List<String>? secondaryThemes;
  final String? emotion;
  final String? severity;
  final String? technicalError;
  final int? debugHttpStatus;
  final String? debugResponseBody;
  final String? debugParsedErrorMessage;
  final int? debugSentHistoryCount;
  final ChatDebugInfo? debug;

  bool get isUser => role == 'user';

  int? get selectedAyahId => selectedAyah?.id;

  String get topAyahIdsDebugText {
    final ids = topAyahIds;
    if (ids == null || ids.isEmpty) {
      return '-';
    }
    return ids.join(', ');
  }

  String get selectedAyahIdDebugText {
    final id = selectedAyahId;
    return id == null || id <= 0 ? '-' : id.toString();
  }
}

class ChatDebugInfo {
  const ChatDebugInfo({
    this.engineVersion,
    this.routing,
    this.rankingDebug,
    this.selectedReason,
  });

  final String? engineVersion;
  final ChatDebugRouting? routing;
  final ChatRankingDebug? rankingDebug;
  final String? selectedReason;

  factory ChatDebugInfo.fromJson(Map<String, dynamic> json) {
    final routingJson = _readJsonMap(json['routing']);
    final rankingJson = _readJsonMap(json['ranking_debug']);
    return ChatDebugInfo(
      engineVersion: _readString(json['engine_version']),
      routing:
          routingJson == null ? null : ChatDebugRouting.fromJson(routingJson),
      rankingDebug:
          rankingJson == null ? null : ChatRankingDebug.fromJson(rankingJson),
      selectedReason: _readString(json['selected_reason']),
    );
  }
}

class ChatDebugRouting {
  const ChatDebugRouting({
    this.intent,
    this.subIntent,
    this.responseType,
    this.contextTopic,
  });

  final String? intent;
  final String? subIntent;
  final String? responseType;
  final String? contextTopic;

  factory ChatDebugRouting.fromJson(Map<String, dynamic> json) {
    return ChatDebugRouting(
      intent: _readString(json['intent']),
      subIntent: _readString(json['sub_intent']),
      responseType: _readString(json['response_type']),
      contextTopic: _readString(json['context_topic']),
    );
  }
}

class ChatRankingDebug {
  const ChatRankingDebug({
    this.selectedAyahId,
    this.candidateScores = const [],
  });

  final int? selectedAyahId;
  final List<ChatCandidateScore> candidateScores;

  factory ChatRankingDebug.fromJson(Map<String, dynamic> json) {
    final rawScores = json['candidate_scores'];
    final candidateScores = rawScores is List
        ? rawScores
            .map((item) => _readJsonMap(item))
            .whereType<Map<String, dynamic>>()
            .map(ChatCandidateScore.fromJson)
            .toList()
        : const <ChatCandidateScore>[];
    return ChatRankingDebug(
      selectedAyahId: _readNullableInt(json['selected_ayah_id']),
      candidateScores: candidateScores,
    );
  }
}

class ChatCandidateScore {
  const ChatCandidateScore({
    required this.ayahId,
    required this.primaryThemeScore,
    required this.secondaryThemeScore,
    required this.emotionScore,
    required this.severityScore,
    required this.contextScore,
    required this.repetitionPenalty,
    required this.finalScore,
  });

  final int ayahId;
  final num primaryThemeScore;
  final num secondaryThemeScore;
  final num emotionScore;
  final num severityScore;
  final num contextScore;
  final num repetitionPenalty;
  final num finalScore;

  factory ChatCandidateScore.fromJson(Map<String, dynamic> json) {
    return ChatCandidateScore(
      ayahId: _readInt(json['ayah_id']),
      primaryThemeScore: _readNum(json['primary_theme_score']),
      secondaryThemeScore: _readNum(json['secondary_theme_score']),
      emotionScore: _readNum(json['emotion_score']),
      severityScore: _readNum(json['severity_score']),
      contextScore: _readNum(json['context_score']),
      repetitionPenalty: _readNum(json['repetition_penalty']),
      finalScore: _readNum(json['final_score']),
    );
  }
}

class ChatSelectedAyah {
  const ChatSelectedAyah({
    required this.id,
    required this.surah,
    required this.surahNumber,
    required this.ayah,
    required this.surahNameTr,
    required this.textAr,
    required this.textTr,
    required this.tags,
  });

  final int id;
  final String surah;
  final int surahNumber;
  final int ayah;
  final String? surahNameTr;
  final String textAr;
  final String textTr;
  final List<String> tags;

  String get displayReference {
    final preferredName =
        (surahNameTr != null && surahNameTr!.trim().isNotEmpty)
            ? surahNameTr!.trim()
            : _surahNameTrFromNumber(surahNumber) ?? surah;
    if (preferredName.isEmpty) {
      return '$surahNumber:$ayah';
    }
    return '$preferredName $surahNumber:$ayah';
  }

  factory ChatSelectedAyah.fromJson(Map<String, dynamic> json) {
    return ChatSelectedAyah(
      id: _readInt(json['id']),
      surah: json['surah']?.toString() ?? '',
      surahNumber: _readInt(json['surahNumber']),
      ayah: _readInt(json['ayah']),
      surahNameTr: _readString(json['surahNameTr']) ??
          _readString(json['surah_name_tr']) ??
          _readString(json['surah_tr']),
      textAr: json['text_ar']?.toString() ?? '',
      textTr: json['text_tr']?.toString() ?? '',
      tags: _readStringList(json['tags']),
    );
  }
}

int _readInt(Object? value) {
  if (value is int) {
    return value;
  }
  return int.tryParse(value?.toString() ?? '') ?? 0;
}

int? _readNullableInt(Object? value) {
  if (value == null) {
    return null;
  }
  final parsed = _readInt(value);
  return parsed > 0 ? parsed : null;
}

num _readNum(Object? value) {
  if (value is num) {
    return value;
  }
  return num.tryParse(value?.toString() ?? '') ?? 0;
}

String? _readString(Object? value) {
  final text = value?.toString();
  if (text == null || text.isEmpty) {
    return null;
  }
  return text;
}

Map<String, dynamic>? _readJsonMap(Object? value) {
  if (value is Map<String, dynamic>) {
    return value;
  }
  if (value is Map) {
    return value.map(
      (key, item) => MapEntry(key.toString(), item),
    );
  }
  return null;
}

List<String> _readStringList(Object? value) {
  if (value is! List) {
    return const [];
  }
  return value.map((item) => item.toString()).toList();
}

String? _surahNameTrFromNumber(int surahNumber) {
  switch (surahNumber) {
    case 1:
      return 'Fatiha';
    case 2:
      return 'Bakara';
    case 3:
      return 'Âl-i İmrân';
    case 4:
      return 'Nisa';
    case 5:
      return 'Maide';
    case 6:
      return 'Enam';
    case 7:
      return 'Araf';
    case 8:
      return 'Enfal';
    case 9:
      return 'Tevbe';
    case 10:
      return 'Yunus';
    case 11:
      return 'Hud';
    case 12:
      return 'Yusuf';
    case 13:
      return 'Ra\'d';
    case 14:
      return 'İbrahim';
    case 15:
      return 'Hicr';
    case 16:
      return 'Nahl';
    case 17:
      return 'İsra';
    case 18:
      return 'Kehf';
    case 19:
      return 'Meryem';
    case 20:
      return 'Taha';
    case 21:
      return 'Enbiya';
    case 22:
      return 'Hac';
    case 23:
      return 'Müminun';
    case 24:
      return 'Nur';
    case 25:
      return 'Furkan';
    case 26:
      return 'Şuara';
    case 27:
      return 'Neml';
    case 28:
      return 'Kasas';
    case 29:
      return 'Ankebut';
    case 30:
      return 'Rum';
    case 31:
      return 'Lokman';
    case 32:
      return 'Secde';
    case 33:
      return 'Ahzab';
    case 34:
      return 'Sebe';
    case 35:
      return 'Fatır';
    case 36:
      return 'Yasin';
    case 37:
      return 'Saffat';
    case 38:
      return 'Sad';
    case 39:
      return 'Zümer';
    case 40:
      return 'Mümin';
    case 41:
      return 'Fussilet';
    case 42:
      return 'Şura';
    case 43:
      return 'Zuhruf';
    case 44:
      return 'Duhan';
    case 45:
      return 'Casiye';
    case 46:
      return 'Ahkaf';
    case 47:
      return 'Muhammed';
    case 48:
      return 'Fetih';
    case 49:
      return 'Hucurat';
    case 50:
      return 'Kaf';
    case 51:
      return 'Zariyat';
    case 52:
      return 'Tur';
    case 53:
      return 'Necm';
    case 54:
      return 'Kamer';
    case 55:
      return 'Rahman';
    case 56:
      return 'Vakia';
    case 57:
      return 'Hadid';
    case 58:
      return 'Mücadele';
    case 59:
      return 'Haşr';
    case 60:
      return 'Mümtehine';
    case 61:
      return 'Saff';
    case 62:
      return 'Cuma';
    case 63:
      return 'Münafikun';
    case 64:
      return 'Teğabun';
    case 65:
      return 'Talak';
    case 66:
      return 'Tahrim';
    case 67:
      return 'Mülk';
    case 68:
      return 'Kalem';
    case 69:
      return 'Hakka';
    case 70:
      return 'Mearic';
    case 71:
      return 'Nuh';
    case 72:
      return 'Cin';
    case 73:
      return 'Müzzemmil';
    case 74:
      return 'Müddessir';
    case 75:
      return 'Kıyamet';
    case 76:
      return 'İnsan';
    case 77:
      return 'Mürselat';
    case 78:
      return 'Nebe';
    case 79:
      return 'Naziat';
    case 80:
      return 'Abese';
    case 81:
      return 'Tekvir';
    case 82:
      return 'İnfitar';
    case 83:
      return 'Mutaffifin';
    case 84:
      return 'İnşikak';
    case 85:
      return 'Buruc';
    case 86:
      return 'Tarık';
    case 87:
      return 'Ala';
    case 88:
      return 'Gaşiye';
    case 89:
      return 'Fecr';
    case 90:
      return 'Beled';
    case 91:
      return 'Şems';
    case 92:
      return 'Leyl';
    case 93:
      return 'Duha';
    case 94:
      return 'İnşirah';
    case 95:
      return 'Tin';
    case 96:
      return 'Alak';
    case 97:
      return 'Kadir';
    case 98:
      return 'Beyyine';
    case 99:
      return 'Zilzal';
    case 100:
      return 'Adiyat';
    case 101:
      return 'Karia';
    case 102:
      return 'Tekasür';
    case 103:
      return 'Asr';
    case 104:
      return 'Hümeze';
    case 105:
      return 'Fil';
    case 106:
      return 'Kureyş';
    case 107:
      return 'Maun';
    case 108:
      return 'Kevser';
    case 109:
      return 'Kafirun';
    case 110:
      return 'Nasr';
    case 111:
      return 'Tebbet';
    case 112:
      return 'İhlas';
    case 113:
      return 'Felak';
    case 114:
      return 'Nas';
    default:
      return null;
  }
}
