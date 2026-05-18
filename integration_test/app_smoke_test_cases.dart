import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'package:kuran_uygulamasi/core/constants/app_constants.dart';
import 'package:kuran_uygulamasi/features/chat/chat_screen.dart';
import 'package:kuran_uygulamasi/features/chat/widgets/assistant_message.dart';
import 'package:kuran_uygulamasi/features/chat/widgets/ayah_card.dart';
import 'package:kuran_uygulamasi/features/home/widgets/home_menu_item.dart';
import 'package:kuran_uygulamasi/main.dart' as app;
import 'package:kuran_uygulamasi/shared/widgets/ayah_card.dart' as home_widgets;

late final IntegrationTestWidgetsFlutterBinding binding;

Future<void> main() async {
  binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('app opens successfully', (WidgetTester tester) async {
    await _runVisualScenario(
      tester,
      screenshotName: 'app_opens_successfully_failure',
      body: () async {
        await _launchAppAndWaitForHome(tester);
        await _requireAtLeastOne(
          tester,
          find.text(AppConstants.appName),
        );
        await _requireExactlyOne(
          tester,
          find.byType(home_widgets.AyahCard),
        );
      },
    );
  });

  testWidgets('home screen loads', (WidgetTester tester) async {
    await _runVisualScenario(
      tester,
      screenshotName: 'home_screen_loads_failure',
      body: () async {
        await _launchAppAndWaitForHome(tester);
        await _requireExactlyOne(
          tester,
          find.widgetWithText(HomeMenuItem, 'Ayet Rehberi'),
        );
        await _requireExactlyOne(
          tester,
          find.widgetWithText(HomeMenuItem, 'Dinî Bilgiler'),
        );
        await _requireExactlyOne(
          tester,
          find.byType(home_widgets.AyahCard),
        );
      },
    );
  });

  testWidgets('Ayet Rehberi opens', (WidgetTester tester) async {
    await _runVisualScenario(
      tester,
      screenshotName: 'ayet_rehberi_opens_failure',
      body: () async {
        await _launchAppAndWaitForHome(tester);
        await _openChatMode(tester, 'Ayet Rehberi');
        await _requireExactlyOne(tester, find.byType(ChatScreen));
      },
    );
  });

  testWidgets('Dinî Bilgiler opens', (WidgetTester tester) async {
    await _runVisualScenario(
      tester,
      screenshotName: 'ilmihal_rehberi_opens_failure',
      body: () async {
        await _launchAppAndWaitForHome(tester);
        await _openChatMode(tester, 'Dinî Bilgiler');
        await _requireExactlyOne(tester, find.byType(ChatScreen));
      },
    );
  });

  testWidgets('user can type a message', (WidgetTester tester) async {
    await _runVisualScenario(
      tester,
      screenshotName: 'user_can_type_message_failure',
      body: () async {
        await _launchAppAndWaitForHome(tester);
        await _openChatMode(tester, 'Dinî Bilgiler');
        const prompt = 'arkadan konuşmak günah mı';
        await _typeMessage(tester, prompt);
        await _requireAtLeastOne(tester, find.text(prompt));
        await _requireExactlyOne(tester, find.byType(TextField));
      },
    );
  });

  testWidgets('response bubble appears', (WidgetTester tester) async {
    await _runVisualScenario(
      tester,
      screenshotName: 'response_bubble_appears_failure',
      body: () async {
        await _launchAppAndWaitForHome(tester);
        await _openChatMode(tester, 'Dinî Bilgiler');
        await _sendMessage(tester, 'arkadan konuşmak günah mı');
        await _scrollChatIntoView(tester, find.byType(AssistantMessage));
        await _requireAtLeastOne(tester, find.byType(AssistantMessage));
        await _requireAtLeastOne(tester, find.textContaining('Gıybet'));
      },
    );
  });

  testWidgets('redirect message appears correctly',
      (WidgetTester tester) async {
    await _runVisualScenario(
      tester,
      screenshotName: 'redirect_message_appears_failure',
      body: () async {
        await _launchAppAndWaitForHome(tester);
        await _openChatMode(tester, 'Dinî Bilgiler');
        await _sendMessage(tester, 'Allah beni affeder mi');
        await _scrollChatIntoView(tester, find.textContaining('Tövbe'));
        await _scrollChatIntoView(
            tester, find.textContaining("Ayet Rehberi'ne git"));
        await _requireAtLeastOne(tester, find.textContaining('Tövbe'));
        await _requireAtLeastOne(
            tester, find.textContaining("Ayet Rehberi'ne git"));

        await tester.tap(find.text("Ayet Rehberi'ne git"));
        await tester.pump();
        await _requireExactlyOne(tester, find.byType(ChatScreen));
      },
    );
  });

  testWidgets('redirect message appears for pişmanlık',
      (WidgetTester tester) async {
    await _runVisualScenario(
      tester,
      screenshotName: 'redirect_message_pismanlik_failure',
      body: () async {
        await _launchAppAndWaitForHome(tester);
        await _openChatMode(tester, 'Ayet Rehberi');
        await _sendMessage(tester, 'çok pişmanım');
        await _scrollChatIntoView(tester, find.textContaining('daha uygundur'));
        await _scrollChatIntoView(
            tester, find.textContaining("Dinî Bilgiler'e git"));
        await _requireAtLeastOne(tester, find.textContaining('daha uygundur'));
        await _requireAtLeastOne(
            tester, find.textContaining("Dinî Bilgiler'e git"));
      },
    );
  });

  testWidgets('AyahCard appears for yalnızlık', (WidgetTester tester) async {
    await _runVisualScenario(
      tester,
      screenshotName: 'ayah_card_yalnizlik_failure',
      body: () async {
        await _launchAppAndWaitForHome(tester);
        await _openChatMode(tester, 'Ayet Rehberi');
        await _sendMessage(tester, 'yalnız hissediyorum');
        await _scrollChatIntoView(tester, find.byType(ChatAyahCard));
        await _requireAtLeastOne(tester, find.byType(ChatAyahCard));
      },
    );
  });

  for (final scenario in const [
    (
      name: 'Ayet Rehberi shows support for çok hastayım',
      prompt: 'çok hastayım',
      fragment: 'Şuara 26:80',
      screenshot: 'ayet_support_cok_hastayim_failure',
    ),
    (
      name: 'Ayet Rehberi shows support for borcum var',
      prompt: 'borcum var',
      fragment: 'Hud 11:6',
      screenshot: 'ayet_support_borcum_var_failure',
    ),
    (
      name: 'Ayet Rehberi shows support for birini kaybettim',
      prompt: 'birini kaybettim',
      fragment: 'Bakara 2:153',
      screenshot: 'ayet_support_birini_kaybettim_failure',
    ),
    (
      name: 'Ayet Rehberi shows support for Allah benden uzak mı',
      prompt: 'Allah benden uzak mı',
      fragment: 'Bakara 2:186',
      screenshot: 'ayet_support_allah_benden_uzak_mi_failure',
    ),
    (
      name: 'Ayet Rehberi shows support for yalnız hissediyorum',
      prompt: 'yalnız hissediyorum',
      fragment: 'Bakara 2:186',
      screenshot: 'ayet_support_yalniz_hissediyorum_failure',
    ),
  ]) {
    testWidgets(scenario.name, (WidgetTester tester) async {
      await _runVisualScenario(
        tester,
        screenshotName: scenario.screenshot,
        body: () async {
          await _launchAppAndWaitForHome(tester);
          await _openChatMode(tester, 'Ayet Rehberi');
          await _sendMessage(tester, scenario.prompt);
          await _scrollChatIntoView(
              tester, find.textContaining(scenario.fragment));
          await _scrollChatIntoView(tester, find.byType(ChatAyahCard));
          await _requireAtLeastOne(tester, find.byType(ChatAyahCard));
          await _requireAtLeastOne(
              tester, find.textContaining(scenario.fragment));
        },
      );
    });
  }
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

Future<void> _requireExactlyOne(WidgetTester tester, Finder finder) async {
  final count = finder.evaluate().length;
  if (count != 1) {
    throw StateError('Expected exactly one match for $finder, found $count.');
  }
}

Future<void> _requireAtLeastOne(WidgetTester tester, Finder finder) async {
  final count = finder.evaluate().length;
  if (count < 1) {
    throw StateError('Expected at least one match for $finder, found $count.');
  }
}

Future<void> _launchAppAndWaitForHome(WidgetTester tester) async {
  await app.main();
  await tester.pump();
  final ayetFinder = find.widgetWithText(HomeMenuItem, 'Ayet Rehberi');
  final ilmihalFinder = find.widgetWithText(HomeMenuItem, 'Dinî Bilgiler');
  await _waitFor(tester, ayetFinder);
  await _waitFor(tester, ilmihalFinder);
  await tester.ensureVisible(ayetFinder);
  await tester.ensureVisible(ilmihalFinder);
  await tester.pumpAndSettle(const Duration(milliseconds: 250));
}

Future<void> _openChatMode(WidgetTester tester, String label) async {
  final menuItem = find.widgetWithText(HomeMenuItem, label);
  await tester.ensureVisible(menuItem);
  await tester.pumpAndSettle(const Duration(milliseconds: 150));
  await tester.tap(menuItem);
  await tester.pump();
  await tester.pumpAndSettle(const Duration(milliseconds: 300));
  await _waitFor(
    tester,
    find.textContaining('sakin bir sohbet'),
    timeout: const Duration(seconds: 45),
  );
}

Future<void> _typeMessage(WidgetTester tester, String text) async {
  await tester.ensureVisible(find.byType(TextField));
  await tester.pumpAndSettle(const Duration(milliseconds: 150));
  await tester.tap(find.byType(TextField));
  await tester.enterText(find.byType(TextField), text);
  await tester.pump();
}

Future<void> _sendMessage(WidgetTester tester, String text) async {
  await _typeMessage(tester, text);
  await tester.ensureVisible(find.byIcon(Icons.arrow_upward_rounded));
  await tester.pumpAndSettle(const Duration(milliseconds: 150));
  await tester.tap(find.byIcon(Icons.arrow_upward_rounded));
  await tester.pumpAndSettle(const Duration(milliseconds: 300));
  await _waitFor(
    tester,
    find.byType(AssistantMessage),
    timeout: const Duration(seconds: 60),
  );
  await _scrollChatIntoView(tester, find.byType(AssistantMessage));
  await tester.pumpAndSettle(const Duration(milliseconds: 250));
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

Future<void> _scrollChatIntoView(
  WidgetTester tester,
  Finder finder, {
  Duration timeout = const Duration(seconds: 45),
}) async {
  final deadline = DateTime.now().add(timeout);
  final scrollable = find.byType(ListView);

  while (DateTime.now().isBefore(deadline)) {
    if (finder.evaluate().isNotEmpty) {
      await tester.ensureVisible(finder.first);
      await tester.pumpAndSettle(const Duration(milliseconds: 250));
      if (finder.evaluate().isNotEmpty) {
        return;
      }
    }

    try {
      await tester.scrollUntilVisible(
        finder,
        240,
        scrollable: scrollable,
        maxScrolls: 20,
      );
      await tester.pumpAndSettle(const Duration(milliseconds: 250));
      if (finder.evaluate().isNotEmpty) {
        return;
      }
    } catch (_) {
      // Keep waiting for late-arriving chat content.
    }

    await tester.pump(const Duration(milliseconds: 200));
  }

  throw TestFailure('Timed out waiting to scroll $finder into view');
}
