// ignore_for_file: constant_identifier_names

import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../data/models/chat_message_model.dart';
import '../../shared/widgets/app_gradient_background.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_radius.dart';
import '../../theme/app_spacing.dart';
import '../../utils/chat_logger.dart';
import 'chat_controller.dart';
import 'widgets/assistant_message.dart';
import 'widgets/ayah_card.dart';
import 'widgets/user_bubble.dart';

const bool AUTO_RUN_CHAT_SMOKE_TEST = false;

class ChatScreen extends StatelessWidget {
  const ChatScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => ChatController(),
      child: const _ChatView(),
    );
  }
}

class _ChatView extends StatefulWidget {
  const _ChatView();

  @override
  State<_ChatView> createState() => _ChatViewState();
}

class _ChatViewState extends State<_ChatView> {
  final _textController = TextEditingController();
  final _scrollController = ScrollController();
  final Set<String> _loggedAssistantMessageIds = <String>{};
  bool _autoSmokeTestTriggered = false;

  @override
  void dispose() {
    _textController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _confirmAndClearChat(BuildContext context) async {
    final controller = context.read<ChatController>();
    if (controller.loading || controller.runningSmokeTest) {
      return;
    }

    final scaffoldMessenger = ScaffoldMessenger.of(context);

    final shouldClear = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          title: const Text('Sohbeti temizle'),
          content: const Text(
            'Bu sohbetteki mesajlar silinecek. Devam etmek istiyor musun?',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: const Text('Vazgeç'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(dialogContext).pop(true),
              child: const Text('Temizle'),
            ),
          ],
        );
      },
    );

    if (shouldClear != true || !mounted) {
      return;
    }

    controller.clearConversation();
    _loggedAssistantMessageIds.clear();
    _textController.clear();

    scaffoldMessenger.showSnackBar(
      const SnackBar(content: Text('Sohbet temizlendi.')),
    );
  }

  Future<void> _send(BuildContext context, [String? prompt]) async {
    final controller = context.read<ChatController>();
    final text = prompt ?? _textController.text;
    _textController.clear();
    if (kDebugMode && text.trim() == '/chat_smoke_test') {
      await controller.runDebugSmokeTest();
      _scrollToBottomSoon();
      return;
    }
    await controller.send(text);
    _scrollToBottomSoon();
  }

  void _scrollToBottomSoon() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollController.hasClients) {
        return;
      }
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeOutCubic,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      resizeToAvoidBottomInset: true,
      appBar: AppBar(
        title: const Text('Sohbet'),
        actions: [
          IconButton(
            tooltip: 'Sohbeti temizle',
            onPressed: () => _confirmAndClearChat(context),
            icon: const Icon(
              Icons.delete_outline,
              color: Colors.redAccent,
            ),
          ),
          const SizedBox(width: 6),
        ],
      ),
      body: AppGradientBackground(
        child: Consumer<ChatController>(
          builder: (context, controller, _) {
            _maybeAutoRunSmokeTest(controller);
            _scheduleRuntimeLogging(controller.messages);
            final shouldShowDebugMock = _shouldShowDebugMock(controller);
            return Column(
              children: [
                if (shouldShowDebugMock) const _DebugMockThread(),
                Expanded(
                  child: controller.isEmpty
                      ? const _EmptyChatIntro()
                      : ListView.builder(
                          controller: _scrollController,
                          padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
                          itemCount: controller.messages.length,
                          itemBuilder: (context, index) {
                            return Padding(
                              padding: const EdgeInsets.only(bottom: 16),
                              child: _ChatMessageItem(
                                message: controller.messages[index],
                              ),
                            );
                          },
                        ),
                ),
                if (controller.isEmpty)
                  _StarterPromptStrip(
                    prompts: ChatController.starterPrompts,
                    onPromptSelected: (prompt) => _send(context, prompt),
                  ),
                _ChatComposer(
                  controller: _textController,
                  sending: controller.loading,
                  onSend: () => _send(context),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  bool _shouldShowDebugMock(ChatController controller) {
    if (!kDebugMode || controller.messages.isEmpty) {
      return false;
    }

    final messages = controller.messages;
    final hasSuccessfulAssistant = messages.any(
      (message) => !message.isUser && message.technicalError == null,
    );
    if (hasSuccessfulAssistant) {
      return false;
    }

    final lastAssistant = messages.lastWhere(
      (message) => !message.isUser,
      orElse: () => messages.last,
    );
    return lastAssistant.technicalError != null;
  }

  void _scheduleRuntimeLogging(List<ChatMessageModel> messages) {
    if (messages.isEmpty) {
      return;
    }

    final assistantMessages = messages.where(
      (message) =>
          !message.isUser &&
          message.technicalError == null &&
          message.text.trim().isNotEmpty &&
          message.sourceUserText != null &&
          !_loggedAssistantMessageIds.contains(message.id),
    );

    if (assistantMessages.isEmpty) {
      return;
    }

    WidgetsBinding.instance.addPostFrameCallback((_) {
      for (final message in assistantMessages) {
        if (_loggedAssistantMessageIds.add(message.id)) {
          unawaited(logChatTurn(message));
        }
      }
    });
  }

  void _maybeAutoRunSmokeTest(ChatController controller) {
    if (!kDebugMode || !AUTO_RUN_CHAT_SMOKE_TEST || _autoSmokeTestTriggered) {
      return;
    }
    if (controller.loading || controller.runningSmokeTest) {
      return;
    }

    _autoSmokeTestTriggered = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !kDebugMode || !AUTO_RUN_CHAT_SMOKE_TEST) {
        return;
      }
      unawaited(controller.runDebugSmokeTest());
    });
  }
}

class _EmptyChatIntro extends StatelessWidget {
  const _EmptyChatIntro();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(24, 26, 24, 18),
      children: [
        Container(
          width: 56,
          height: 56,
          decoration: BoxDecoration(
            color: AppColors.surfaceSoft,
            borderRadius: BorderRadius.circular(AppRadius.large),
            border: Border.all(color: AppColors.divider),
          ),
          child: const Icon(
            Icons.auto_stories_rounded,
            color: AppColors.primaryAccent,
          ),
        ),
        const SizedBox(height: 22),
        Text(
          'Ayet merkezli sakin bir sohbet',
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const SizedBox(height: 12),
        Text(
          '\u0130\u00e7inden ge\u00e7eni yaz. Cevaplar, uygulaman\u0131n ayet havuzundan se\u00e7ilen i\u00e7eriklerle sakin ve \u00f6l\u00e7\u00fcl\u00fc bir rehberlik sunar.',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                height: 1.75,
              ),
        ),
      ],
    );
  }
}

class _ChatMessageItem extends StatelessWidget {
  const _ChatMessageItem({required this.message});

  final ChatMessageModel message;

  @override
  Widget build(BuildContext context) {
    if (kDebugMode && message.technicalError != null) {
      return const SizedBox.shrink();
    }
    return Column(
      crossAxisAlignment:
          message.isUser ? CrossAxisAlignment.end : CrossAxisAlignment.start,
      children: [
        if (message.isUser)
          UserBubble(text: message.text.trim())
        else
          AssistantMessage(text: _displayAssistantText(message)),
        if (!message.isUser && message.selectedAyah != null)
          ChatAyahCard(ayah: message.selectedAyah!),
      ],
    );
  }

  String _displayAssistantText(ChatMessageModel message) {
    final text = message.text.trim();
    if (message.isUser || message.selectedAyah == null || text.isEmpty) {
      return text;
    }

    final paragraphs = text.split(RegExp(r'\n\s*\n'));
    if (paragraphs.length > 1) {
      final leadIn = paragraphs.first.trim();
      if (leadIn.isNotEmpty) {
        return leadIn;
      }
    }

    return text;
  }
}

class _StarterPromptStrip extends StatelessWidget {
  const _StarterPromptStrip({
    required this.prompts,
    required this.onPromptSelected,
  });

  final List<String> prompts;
  final ValueChanged<String> onPromptSelected;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 8),
      child: Row(
        children: [
          for (final prompt in prompts) ...[
            ActionChip(
              label: Text(prompt),
              onPressed: () => onPromptSelected(prompt),
            ),
            const SizedBox(width: 10),
          ],
        ],
      ),
    );
  }
}

class _ChatComposer extends StatelessWidget {
  const _ChatComposer({
    required this.controller,
    required this.sending,
    required this.onSend,
  });

  final TextEditingController controller;
  final bool sending;
  final VoidCallback onSend;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
        child: Container(
          decoration: BoxDecoration(
            color: AppColors.surfaceSoft,
            borderRadius: BorderRadius.circular(AppRadius.xLarge),
            border: Border.all(
              color: AppColors.divider.withValues(alpha: 0.8),
            ),
          ),
          padding: const EdgeInsets.fromLTRB(10, 10, 10, 10),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: TextField(
                  controller: controller,
                  minLines: 1,
                  maxLines: 5,
                  keyboardType: TextInputType.multiline,
                  textInputAction: TextInputAction.newline,
                  style: Theme.of(context).textTheme.bodyLarge,
                  decoration: const InputDecoration(
                    hintText: '\u0130\u00e7inden ge\u00e7eni yaz...',
                    filled: false,
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    contentPadding: EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 12,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.small),
              SizedBox.square(
                dimension: 46,
                child: FilledButton(
                  onPressed: sending ? null : onSend,
                  style: FilledButton.styleFrom(
                    padding: EdgeInsets.zero,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppRadius.large),
                    ),
                  ),
                  child: sending
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.arrow_upward_rounded, size: 18),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DebugMockThread extends StatelessWidget {
  const _DebugMockThread();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.fromLTRB(20, 16, 20, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          UserBubble(text: 'Backend kapalıyken debug mock görünümü'),
          SizedBox(height: 14),
          AssistantMessage(
            text:
                'Bu yalnızca debug modda görünen örnek bloktur. Gerçek akış backend yanıtı geldiğinde burası otomatik olarak normal sohbet mesajlarıyla yer değiştirir.',
          ),
          ChatAyahCard(
            ayah: ChatSelectedAyah(
              id: 1,
              surah: 'surah',
              surahNumber: 94,
              ayah: 5,
              surahNameTr: 'İnşirah',
              textAr: 'فَإِنَّ مَعَ الْعُسْرِ يُسْرًا',
              textTr: 'Şüphesiz zorlukla beraber bir kolaylık vardır.',
              tags: ['umut', 'sabır'],
            ),
          ),
        ],
      ),
    );
  }
}
