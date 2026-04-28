import 'dart:convert';
import 'dart:io';

import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';

import '../data/models/chat_message_model.dart';

Future<void> logChatTurn(ChatMessageModel message) async {
  if (message.isUser) {
    return;
  }

  final userText = message.sourceUserText?.trim();
  final assistantText = message.text.trim();
  if (userText == null || userText.isEmpty || assistantText.isEmpty) {
    return;
  }

  final timestamp =
      DateFormat('yyyy-MM-dd HH:mm:ss').format(message.createdAt.toLocal());
  final theme = _resolvedTheme(message);
  final buffer = StringBuffer()
    ..writeln('[$timestamp]')
    ..writeln('USER: $userText')
    ..writeln('ASSISTANT: $assistantText')
    ..writeln('AYAH_ID: ${message.selectedAyahId ?? '-'}')
    ..writeln('THEME: $theme')
    ..writeln('EMOTION: ${message.emotion ?? '-'}')
    ..writeln('TYPE: ${message.responseType ?? '-'}')
    ..writeln()
    ..writeln('-------------------------------------')
    ..writeln();

  final logsDirCandidates = await _resolveLogDirectories();
  for (final logsDir in logsDirCandidates) {
    try {
      if (!await logsDir.exists()) {
        await logsDir.create(recursive: true);
      }
      final file =
          File('${logsDir.path}${Platform.pathSeparator}chat_runtime_log.txt');
      await file.writeAsBytes(
        utf8.encode(buffer.toString()),
        mode: FileMode.append,
        flush: true,
      );
      return;
    } catch (_) {
      continue;
    }
  }
}

Future<List<Directory>> _resolveLogDirectories() async {
  if (Platform.isAndroid) {
    try {
      final base = await getApplicationDocumentsDirectory();
      return [Directory('${base.path}${Platform.pathSeparator}logs')];
    } catch (_) {
      return [Directory('/data/data/com.example.kuran_uygulamasi/files/logs')];
    }
  }

  return [Directory('logs')];
}

String _resolvedTheme(ChatMessageModel message) {
  final primaryTheme = message.primaryTheme?.trim();
  final hasPrimaryTheme = primaryTheme != null && primaryTheme.isNotEmpty;

  if (message.responseType == 'direct_answer' &&
      message.selectedAyahId == null) {
    return hasPrimaryTheme ? primaryTheme : 'genel';
  }

  return hasPrimaryTheme ? primaryTheme : '-';
}
