enum ChatMode {
  chat,
  ayah,
  ilmihal,
}

extension ChatModeX on ChatMode {
  String get title {
    switch (this) {
      case ChatMode.chat:
        return 'HAKAI';
      case ChatMode.ayah:
        return 'Ayet Rehberi';
      case ChatMode.ilmihal:
        return 'Dinî Bilgiler';
    }
  }

  String get introTitle {
    switch (this) {
      case ChatMode.chat:
        return 'HAKAI ile günlük manevi rehberlik';
      case ChatMode.ayah:
        return 'Ayet Rehberi ile Kur’an merkezli rehberlik';
      case ChatMode.ilmihal:
        return 'Dinî Bilgiler ile pratik rehberlik';
    }
  }

  String get composerHint {
    switch (this) {
      case ChatMode.chat:
        return 'İçinden geçeni yaz...';
      case ChatMode.ayah:
        return 'İç hâline Kur’an’dan kısa bir tefekkür eşlik eder.';
      case ChatMode.ilmihal:
        return 'İbadet ve günlük dinî pratiklerle ilgili yazabilirsin.';
    }
  }

  List<String> get suggestionQuestions {
    switch (this) {
      case ChatMode.chat:
        return const [];
      case ChatMode.ayah:
        return const [
          'Sabır ile ilgili ayet',
          'İman hakkında ayet',
          'Korku ve endişe için ayet',
        ];
      case ChatMode.ilmihal:
        return const [
          'Abdest nasıl alınır?',
          'Namazın farzları nelerdir?',
          'Oruç hangi durumlarda bozulur?',
        ];
    }
  }

  String get endpointPath {
    switch (this) {
      case ChatMode.chat:
        return '/chat';
      case ChatMode.ayah:
        return '/ayah-chat';
      case ChatMode.ilmihal:
        return '/ilmihal-chat';
    }
  }
}
