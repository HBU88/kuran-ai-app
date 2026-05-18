import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'package:kuran_uygulamasi/features/chat/widgets/assistant_message.dart';
import 'package:kuran_uygulamasi/features/home/widgets/home_menu_item.dart';
import 'package:kuran_uygulamasi/main.dart' as app;
import '.generated/ilmihal_visual_regression_cases.g.dart';

late final IntegrationTestWidgetsFlutterBinding binding;

void main() {
  binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  final cases = _loadCases();
  if (cases.isEmpty) {
    throw StateError('No ilmihal visual regression cases were provided.');
  }

  for (final regressionCase in cases) {
    testWidgets('ilmihal ${regressionCase.id}', (WidgetTester tester) async {
      await _runVisualScenario(
        tester,
        screenshotName: 'ilmihal_${regressionCase.id}_failure',
        body: () async {
          await _launchAppAndOpenIlmihal(tester);
          await _sendMessage(tester, regressionCase.query);
          await _waitFor(tester, find.byType(AssistantMessage));
          await tester.pumpAndSettle(const Duration(milliseconds: 250));
          final assistantText = _assistantBubbleText(tester).toLowerCase();
          if (assistantText.trim().isEmpty) {
            throw StateError(
              'Assistant response bubble rendered without any readable text.',
            );
          }
          for (final expected in regressionCase.expectedTextContains) {
            if (!assistantText.contains(expected.toLowerCase())) {
              throw StateError(
                'Expected assistant response to contain "$expected" but got: $assistantText',
              );
            }
          }
        },
      );
    });
  }
}

List<_RegressionCase> _loadCases() {
  final decoded = utf8.decode(base64Decode(ilmihalVisualRegressionCasesBase64));
  final parsed = jsonDecode(decoded);
  if (parsed is! List) {
    throw StateError('Visual regression cases must be a JSON array.');
  }

  return parsed
      .map((item) => _RegressionCase.fromJson(item as Map<String, dynamic>))
      .toList();
}

Future<void> _runVisualScenario(
  WidgetTester tester, {
  required String screenshotName,
  required Future<void> Function() body,
}) async {
  await binding.convertFlutterSurfaceToImage();
  try {
    await body();
  } catch (_) {
    await _captureFailureScreenshot(tester, screenshotName);
    rethrow;
  }
}

Future<void> _captureFailureScreenshot(
  WidgetTester tester,
  String screenshotName,
) async {
  await tester.pump(const Duration(milliseconds: 250));
  final bytes = await binding.takeScreenshot(screenshotName);
  expect(bytes, isNotEmpty, reason: 'Expected a non-empty screenshot payload.');
}

String _assistantBubbleText(WidgetTester tester) {
  final assistantFinder = find.byType(AssistantMessage);
  final textFinder = find.descendant(
    of: assistantFinder,
    matching: find.byType(Text),
  );
  final buffer = StringBuffer();
  for (final widget in tester.widgetList<Text>(textFinder)) {
    final text =
        widget.data?.trim() ?? widget.textSpan?.toPlainText().trim() ?? '';
    if (text.isNotEmpty) {
      if (buffer.isNotEmpty) {
        buffer.writeln();
      }
      buffer.write(text);
    }
  }
  return buffer.toString();
}

Future<void> _launchAppAndOpenIlmihal(WidgetTester tester) async {
  await app.main();
  await tester.pump();
  final ilmihalFinder = find.widgetWithText(HomeMenuItem, 'Dinî Bilgiler');
  await _waitFor(tester, find.widgetWithText(HomeMenuItem, 'Ayet Rehberi'));
  await _waitFor(tester, ilmihalFinder);
  await tester.ensureVisible(ilmihalFinder);
  await tester.pumpAndSettle(const Duration(milliseconds: 250));
  await tester.tap(ilmihalFinder);
  await tester.pump();
  await _waitFor(tester, find.text('Dinî Bilgiler ile sakin bir sohbet'));
}

Future<void> _sendMessage(WidgetTester tester, String text) async {
  await tester.tap(find.byType(TextField));
  await tester.enterText(find.byType(TextField), text);
  await tester.pump();
  await tester.tap(find.byIcon(Icons.arrow_upward_rounded));
  await tester.pump();
  await _waitFor(
    tester,
    find.byType(AssistantMessage),
    timeout: const Duration(seconds: 45),
  );
}

Future<void> _waitFor(
  WidgetTester tester,
  Finder finder, {
  Duration timeout = const Duration(seconds: 30),
}) async {
  final deadline = DateTime.now().add(timeout);
  while (DateTime.now().isBefore(deadline)) {
    if (finder.evaluate().isNotEmpty) {
      return;
    }
    await tester.pump(const Duration(milliseconds: 200));
  }
  throw TestFailure('Timed out waiting for $finder');
}

class _RegressionCase {
  _RegressionCase({
    required this.id,
    required this.query,
    required this.expectedTextContains,
  });

  factory _RegressionCase.fromJson(Map<String, dynamic> json) {
    return _RegressionCase(
      id: (json['id'] ?? '').toString(),
      query: (json['query'] ?? '').toString(),
      expectedTextContains:
          List<String>.from(json['expected_text_contains'] ?? const <String>[]),
    );
  }

  final String id;
  final String query;
  final List<String> expectedTextContains;
}
