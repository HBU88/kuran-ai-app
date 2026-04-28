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
        return 'Rehberlik';
      case ChatMode.ilmihal:
        return 'Dinî Bilgiler';
    }
  }

  String get introTitle {
    switch (this) {
      case ChatMode.chat:
        return 'HAKAI ile sakin bir sohbet';
      case ChatMode.ayah:
        return 'Rehberlik ile sakin bir sohbet';
      case ChatMode.ilmihal:
        return 'Dinî Bilgiler ile sakin bir sohbet';
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
