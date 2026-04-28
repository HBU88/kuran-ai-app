import '../../models/ayah_model.dart';

class AiService {
  const AiService();

  static const _enabledByConfig = bool.fromEnvironment(
    'SITUATION_AI_ENABLED',
  );
  static const _analysisApiKey = String.fromEnvironment(
    'SITUATION_AI_API_KEY',
  );

  static bool get _realAiConfigured {
    return _enabledByConfig && _analysisApiKey.trim().isNotEmpty;
  }

  static const fallbackExplanations = {
    'sabır':
        'Bu ayet, zorlandığında hemen dağılmadan Allah\'tan güç isteyerek devam etmeyi hatırlatır. Sabır burada sessizce tükenmek değil, kalbi koruyarak doğru adımı sürdürmektir.',
    'umut':
        'Bu ayet, karanlık hissin son söz olmadığını ve Allah\'ın rahmet kapısının açık olduğunu hatırlatır. Bugün küçük bir iyilik bile kalbe yeniden yön verebilir.',
    'tevekkül':
        'Bu ayet, elinden geleni yaptıktan sonra kalbi Allah\'ın hikmetine emanet etmeyi öğretir. Tevekkül, çabayı bırakmak değil, sonucu tek başına taşımamaktır.',
    'tövbe':
        'Bu ayet, dönüş kapısının açık olduğunu ve pişmanlığın yeni bir başlangıca dönüşebileceğini hatırlatır. Allah\'a yönelen kalp, geçmişinin yüküyle baş başa bırakılmaz.',
    'şükür':
        'Bu ayet, nimeti fark etmenin kalbi yumuşattığını ve hayatı daha dengeli görmeyi öğrettiğini hatırlatır. Şükür, sıradan görünen güzellikleri Allah\'tan bilmektir.',
    'korku':
        'Bu ayet, korkunun içinde bile Allah\'ın yakınlığının ve bilgisinin kalbe sığınak olduğunu hatırlatır. Kaygı büyürken kalbi dua ile sakinleştirmek mümkündür.',
    'yalnızlık':
        'Bu ayet, insan kendini yalnız hissettiğinde bile Allah\'ın yakınlığının değişmediğini hatırlatır. Kalbin görülüyor, duyuluyor ve rahmetten uzak değil.',
    'irade':
        'Bu ayet, nefsle mücadelede küçük ama istikrarlı seçimlerin değerli olduğunu hatırlatır. İrade, bir anda kusursuz olmak değil, tekrar doğruya yönelmeyi seçmektir.',
    'sebat':
        'Bu ayet, doğru yolda kalmanın bazen yavaş ama kararlı yürümek olduğunu hatırlatır. Küçük adımlar da Allah katında emek ve yöneliş taşır.',
    'affetmek':
        'Bu ayet, affın kalbi öfkenin yükünden kurtarmaya niyet etmek olduğunu hatırlatır. Affetmek haksızlığı onaylamak değil, merhameti ve adaleti birlikte aramaktır.',
  };

  static const fallbackDuas = {
    'sabır':
        'Allah\'ım, bana sabrı ağır bir yük değil, kalbimi toparlayan bir güç kıl.',
    'umut':
        'Allah\'ım, ümidimi diri tut; beni rahmetinden ve güzel akıbetten mahrum bırakma.',
    'tevekkül':
        'Allah\'ım, çabamı bereketlendir ve kalbimi sana güvenmenin huzuruyla sakinleştir.',
    'tövbe':
        'Allah\'ım, hatalarımı bağışla; beni samimi dönüşte ve güzel istikamette sabit kıl.',
    'şükür':
        'Allah\'ım, verdiğin nimetleri fark eden, koruyan ve hayra kullanan kullarından eyle.',
    'korku':
        'Allah\'ım, korkularımı bana zarar vermeyen bir uyanıklığa çevir ve kalbime emniyet ver.',
    'yalnızlık':
        'Allah\'ım, yalnızlık hissimi yakınlığınla hafiflet; bana hayırlı dostluklar ve iç huzuru ver.',
    'irade':
        'Allah\'ım, irademi güçlendir; beni faydasız alışkanlıklardan güzel tercihlere yönelt.',
    'sebat':
        'Allah\'ım, ayaklarımı hak ve hayır üzerinde sabit kıl; başladığım hayrı bırakmamam için bana güç ver.',
    'affetmek':
        'Allah\'ım, kalbimi yumuşat; beni adaletten ayırmadan affa ve merhamete yaklaştır.',
  };

  static const fallbackActions = {
    'sabır':
        'Bugün zor gelen bir işi küçük bir parçaya böl ve sadece ilk adımı sakin şekilde tamamla.',
    'umut':
        'Bugün şükredebildiğin üç küçük nimeti not al ve birini kısa bir dua ile an.',
    'tevekkül':
        'Bugün kontrol edebildiğin tek bir adımı seç; gerisini bilinçli olarak dua ile Allah\'a bırak.',
    'tövbe':
        'Bugün seni hataya yaklaştıran bir tetikleyiciyi fark et ve ondan uzaklaşmak için küçük bir tedbir al.',
    'şükür':
        'Bugün bir nimetin karşılığında kısa bir teşekkür et veya küçük bir iyilik yap.',
    'korku':
        'Bugün kaygını tek cümleyle yaz, sonra yanına yapabileceğin en küçük doğru adımı ekle.',
    'yalnızlık':
        'Bugün güvendiğin bir kişiye kısa ve sade bir selam mesajı gönder.',
    'irade':
        'Bugün zorlandığın alışkanlık için sadece bir koruyucu sınır belirle.',
    'sebat':
        'Bugün sürdürmek istediğin iyi davranışı en küçük haliyle de olsa tekrar et.',
    'affetmek':
        'Bugün kırgınlığını büyüten bir cümleyi tekrar etmek yerine susup dua etmeyi dene.',
  };

  Future<AiAyahSupport> createSupportText({
    required AyahModel ayah,
    required String tag,
    required String rawInput,
    required String normalizedInput,
    required String emotion,
    required String severity,
  }) async {
    final normalizedTag = _supportTagFor(tag);

    if (!_realAiConfigured) {
      return AiAyahSupport(
        explanation: fallbackExplanations[normalizedTag] ??
            fallbackExplanations['umut']!,
        dua: fallbackDuas[normalizedTag] ?? fallbackDuas['umut']!,
        actionSuggestion:
            fallbackActions[normalizedTag] ?? fallbackActions['umut']!,
        sourceType: 'Fallback',
      );
    }

    return AiAyahSupport(
      explanation:
          fallbackExplanations[normalizedTag] ?? fallbackExplanations['umut']!,
      dua: fallbackDuas[normalizedTag] ?? fallbackDuas['umut']!,
      actionSuggestion:
          fallbackActions[normalizedTag] ?? fallbackActions['umut']!,
      sourceType: 'AI',
    );
  }

  String _supportTagFor(String tag) {
    const aliases = {
      'şifa': 'sabır',
      'hastalık': 'sabır',
      'kaygı': 'tevekkül',
      'çaresizlik': 'umut',
      'bağışlanma': 'tövbe',
      'nefs mücadelesi': 'irade',
      'ölüm korkusu': 'korku',
      'aile': 'sabır',
      'rızık': 'tevekkül',
      'imtihan': 'sabır',
    };
    final normalized = tag.toLowerCase().trim();
    return aliases[normalized] ?? normalized;
  }
}

class AiAyahSupport {
  const AiAyahSupport({
    required this.explanation,
    required this.dua,
    required this.actionSuggestion,
    required this.sourceType,
  });

  final String explanation;
  final String dua;
  final String actionSuggestion;
  final String sourceType;

  String get action => actionSuggestion;
  String get source => sourceType;
}
