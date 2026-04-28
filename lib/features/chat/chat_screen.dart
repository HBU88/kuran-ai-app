import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../data/models/chat_message_model.dart';
import '../../shared/widgets/app_gradient_background.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_radius.dart';
import '../../theme/app_spacing.dart';
import '../../utils/chat_logger.dart';
import 'chat_controller.dart';
import 'chat_mode.dart';
import 'widgets/assistant_message.dart';
import 'widgets/ayah_card.dart';
import 'widgets/user_bubble.dart';

class ChatScreen extends StatelessWidget {
  const ChatScreen({
    super.key,
    this.mode = ChatMode.chat,
  });

  final ChatMode mode;

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => ChatController(mode: mode),
      child: _ChatView(mode: mode),
    );
  }
}

class _ChatView extends StatefulWidget {
  const _ChatView({required this.mode});

  final ChatMode mode;

  @override
  State<_ChatView> createState() => _ChatViewState();
}

class _ChatViewState extends State<_ChatView> {
  final _textController = TextEditingController();
  final _scrollController = ScrollController();
  final Set<String> _loggedAssistantMessageIds = <String>{};

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
        title: Text(widget.mode.title),
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
            _scheduleRuntimeLogging(controller.messages);
            return Column(
              children: [
                Expanded(
                  child: controller.isEmpty
                      ? _EmptyChatIntro(mode: widget.mode)
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
}

class _EmptyChatIntro extends StatelessWidget {
  const _EmptyChatIntro({required this.mode});

  final ChatMode mode;

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
          mode.introTitle,
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const SizedBox(height: 12),
        Text(
          'İçinden geçeni yaz. Cevaplar, uygulamanın ayet havuzundan veya dinî bilgi havuzundan seçilen içeriklerle sakin ve ölçülü bir rehberlik sunar.',
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
    if (message.technicalError != null) {
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
        if (!message.isUser && message.redirectModule != null)
          _ModuleRedirectAction(targetModule: message.redirectModule!),
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

class _ModuleRedirectAction extends StatelessWidget {
  const _ModuleRedirectAction({required this.targetModule});

  final String targetModule;

  @override
  Widget build(BuildContext context) {
    final isIlmihal = targetModule == 'ilmihal';
    final label = isIlmihal ? "Dinî Bilgiler'e git" : "Rehberlik'e git";
    final mode = isIlmihal ? ChatMode.ilmihal : ChatMode.ayah;

    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Align(
        alignment: Alignment.centerLeft,
        child: FilledButton.tonalIcon(
          onPressed: () {
            Navigator.of(context).pushReplacement(
              MaterialPageRoute(
                builder: (_) => ChatScreen(mode: mode),
              ),
            );
          },
          icon: Icon(
            isIlmihal ? Icons.menu_book_rounded : Icons.auto_stories_rounded,
          ),
          label: Text(label),
        ),
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
                    hintText: 'İçinden geçeni yaz...',
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
