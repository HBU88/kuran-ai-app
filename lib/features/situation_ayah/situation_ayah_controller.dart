import 'package:flutter/foundation.dart';

import '../../core/utils/situation_tag_mapper.dart';
import '../../data/models/ayah_model.dart';
import '../../data/repositories/ayah_repository.dart';
import '../../data/sources/remote/ai_service.dart';
import '../../data/sources/remote/situation_intent_service.dart';

class SituationAyahController extends ChangeNotifier {
  SituationAyahController(
    this._ayahRepository,
    this._aiService, {
    SituationIntentService? intentService,
  }) : _intentService = intentService ?? const SituationIntentService();

  final AyahRepository _ayahRepository;
  final AiService _aiService;
  final SituationIntentService _intentService;

  AyahModel? ayah;
  AiAyahSupport? support;
  String? selectedTag;
  String rawInput = '';
  String normalizedInput = '';
  List<String> matchedKeywords = [];
  List<String> detectedTags = [];
  String primaryTag = '';
  List<String> secondaryTags = [];
  Map<String, int> tagScores = {};
  String emotion = '';
  String severity = '';
  double confidence = 0;
  bool aiEnabled = false;
  List<int> primaryCandidateAyahIds = [];
  List<int> candidateAyahIds = [];
  List<int> shownHistoryAyahIds = [];
  List<int> updatedShownHistoryAyahIds = [];
  int inputHash = 0;
  int candidateCount = 0;
  int selectedIndex = -1;
  bool usedFallbackTags = false;
  bool usedSecondaryCandidates = false;
  bool usedAllAyahsFallback = false;
  bool resetHistoryForTheme = false;
  bool loading = false;

  String get userInput => rawInput;
  int? get selectedAyahId => ayah?.id;
  String get explanationSource => support?.sourceType ?? '-';

  Future<void> search(String input) async {
    loading = true;
    ayah = null;
    support = null;
    selectedTag = null;
    rawInput = input;
    normalizedInput = SituationTagMapper.normalizeForMatching(input);
    matchedKeywords = [];
    detectedTags = [];
    primaryTag = '';
    secondaryTags = [];
    tagScores = {};
    emotion = '';
    severity = '';
    confidence = 0;
    aiEnabled = false;
    primaryCandidateAyahIds = [];
    candidateAyahIds = [];
    shownHistoryAyahIds = [];
    updatedShownHistoryAyahIds = [];
    inputHash = normalizedInput.hashCode.abs();
    candidateCount = 0;
    selectedIndex = -1;
    usedFallbackTags = false;
    usedSecondaryCandidates = false;
    usedAllAyahsFallback = false;
    resetHistoryForTheme = false;
    notifyListeners();

    final analysis = await _intentService.analyze(input);
    rawInput = analysis.rawInput;
    normalizedInput = analysis.normalizedInput;
    matchedKeywords = analysis.matchedKeywords;
    detectedTags = analysis.themes;
    primaryTag = analysis.primaryTheme;
    secondaryTags = analysis.secondaryThemes;
    tagScores = analysis.themeScores;
    emotion = analysis.emotion;
    severity = analysis.severity;
    confidence = analysis.confidence;
    aiEnabled = analysis.aiEnabled;
    usedFallbackTags = !analysis.aiEnabled;
    selectedTag = analysis.primaryTheme;

    final selection = await _ayahRepository.selectByIntent(analysis);
    primaryCandidateAyahIds = selection.primaryCandidateAyahIds;
    candidateAyahIds = selection.candidateAyahIds;
    shownHistoryAyahIds = selection.shownHistoryAyahIds;
    updatedShownHistoryAyahIds = selection.updatedShownHistoryAyahIds;
    inputHash = selection.inputHash;
    candidateCount = selection.candidateAyahIds.length;
    selectedIndex = selection.selectedIndex;
    usedSecondaryCandidates = selection.usedSecondaryCandidates;
    usedAllAyahsFallback = selection.usedAllAyahsFallback;
    resetHistoryForTheme = selection.resetHistoryForTheme;

    final aiText = await _aiService.createSupportText(
      ayah: selection.ayah,
      tag: selectedTag!,
      rawInput: analysis.rawInput,
      normalizedInput: analysis.normalizedInput,
      emotion: analysis.emotion,
      severity: analysis.severity,
    );

    ayah = selection.ayah;
    support = aiText;
    loading = false;
    notifyListeners();
  }
}
