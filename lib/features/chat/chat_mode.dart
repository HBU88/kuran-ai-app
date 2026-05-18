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
        return 'HAKAI ile sakin bir sohbet';
      case ChatMode.ayah:
        return 'Ayet Rehberi ile sakin bir sohbet';
      case ChatMode.ilmihal:
        return 'Dinî Bilgiler ile sakin bir sohbet';
    }
  }

  String get composerHint {
    switch (this) {
      case ChatMode.chat:
        return 'Sorunuzu yazın...';
      case ChatMode.ayah:
        return 'Sorularınıza Kur’an’dan ayetlerle rehberlik edilir.';
      case ChatMode.ilmihal:
        return 'İbadetlerle ilgili dinî bilgileri sorabilirsiniz.';
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
