import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../data/models/chat_message_model.dart';
import '../../shared/widgets/app_card.dart';
import '../../shared/widgets/app_gradient_background.dart';
import '../../shared/widgets/loading_view.dart';
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
        child: SafeArea(
          top: false,
          child: Consumer<ChatController>(
            builder: (context, controller, _) {
              _scheduleRuntimeLogging(controller.messages);
              return Column(
                children: [
                  Expanded(
                    child: controller.loading && controller.isEmpty
                        ? const LoadingView(message: 'Hazırlanıyor...')
                        : ListView(
                            controller: _scrollController,
                            padding: const EdgeInsets.fromLTRB(18, 12, 18, 20),
                            children: [
                              _ChatHero(mode: widget.mode),
                              const SizedBox(height: AppSpacing.large),
                              if (controller.isEmpty)
                                _EmptyChatIntro(mode: widget.mode)
                              else
                                ..._buildMessages(
                                  context,
                                  controller,
                                  controller.messages,
                                ),
                              const SizedBox(height: AppSpacing.large),
                            ],
                          ),
                  ),
                  if (controller.isEmpty &&
                      widget.mode.suggestionQuestions.isNotEmpty)
                    _SuggestionStrip(
                      suggestions: widget.mode.suggestionQuestions,
                      onSuggestionSelected: (suggestion) {
                        _textController.text = suggestion;
                        _textController.selection = TextSelection.collapsed(
                          offset: suggestion.length,
                        );
                      },
                    ),
                  _ChatComposer(
                    controller: _textController,
                    sending: controller.loading,
                    onSend: () => _send(context),
                    hintText: widget.mode.composerHint,
                  ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }

  List<Widget> _buildMessages(
    BuildContext context,
    ChatController controller,
    List<ChatMessageModel> messages,
  ) {
    final items = <Widget>[];
    for (final message in messages) {
      items.add(
        Padding(
          padding: const EdgeInsets.only(bottom: 14),
          child: _ChatMessageItem(
            message: message,
            onRetry: message.canRetry && message.sourceUserText != null
                ? () => controller.send(message.sourceUserText!)
                : null,
          ),
        ),
      );
    }
    return items;
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

class _ChatHero extends StatelessWidget {
  const _ChatHero({required this.mode});

  final ChatMode mode;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
      child: Row(
        children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  AppColors.primaryAccent.withValues(alpha: 0.18),
                  AppColors.surfaceSoft,
                ],
              ),
              borderRadius: BorderRadius.circular(AppRadius.medium),
              border: Border.all(
                color: AppColors.primaryAccent.withValues(alpha: 0.18),
              ),
            ),
            child: Icon(
              mode == ChatMode.ayah
                  ? Icons.auto_stories_rounded
                  : mode == ChatMode.ilmihal
                      ? Icons.menu_book_rounded
                      : Icons.chat_bubble_outline_rounded,
              color: AppColors.primaryAccent,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  mode.title,
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                ),
                const SizedBox(height: 4),
                Text(
                  mode.introTitle,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: AppColors.textSecondary,
                      ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _EmptyChatIntro extends StatelessWidget {
  const _EmptyChatIntro({required this.mode});

  final ChatMode mode;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 60,
            height: 60,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  AppColors.primaryAccent.withValues(alpha: 0.2),
                  AppColors.surfaceSoft,
                ],
              ),
              borderRadius: BorderRadius.circular(AppRadius.large),
              border: Border.all(
                color: AppColors.primaryAccent.withValues(alpha: 0.18),
              ),
            ),
            child: const Icon(
              Icons.auto_stories_rounded,
              color: AppColors.primaryAccent,
            ),
          ),
          const SizedBox(height: 18),
          Text(
            mode.introTitle,
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 10),
          Text(
            mode.composerHint,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  height: 1.7,
                  color: AppColors.textSecondary,
                ),
          ),
        ],
      ),
    );
  }
}

class _ChatMessageItem extends StatelessWidget {
  const _ChatMessageItem({
    required this.message,
    this.onRetry,
  });

  final ChatMessageModel message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment:
          message.isUser ? CrossAxisAlignment.end : CrossAxisAlignment.start,
      children: [
        if (message.isUser)
          UserBubble(text: message.text.trim())
        else
          AssistantMessage(text: _displayAssistantText(message)),
        if (!message.isUser && message.selectedAyah != null)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: ChatAyahCard(ayah: message.selectedAyah!),
          ),
        if (!message.isUser && message.redirectModule != null)
          _ModuleRedirectAction(targetModule: message.redirectModule!),
        if (!message.isUser && message.canRetry && onRetry != null)
          Padding(
            padding: const EdgeInsets.only(top: 10),
            child: Align(
              alignment: Alignment.centerLeft,
              child: TextButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh_rounded, size: 18),
                label: const Text('Tekrar dene'),
              ),
            ),
          ),
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
    final label = isIlmihal ? "Dinî Bilgiler'e git" : "Ayet Rehberi'ne git";
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

class _SuggestionStrip extends StatelessWidget {
  const _SuggestionStrip({
    required this.suggestions,
    required this.onSuggestionSelected,
  });

  final List<String> suggestions;
  final ValueChanged<String> onSuggestionSelected;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 0, 18, 8),
      child: Wrap(
        spacing: 10,
        runSpacing: 10,
        children: [
          for (final suggestion in suggestions)
            ActionChip(
              backgroundColor: AppColors.surfaceSoft.withValues(alpha: 0.86),
              side: BorderSide(
                color: AppColors.divider.withValues(alpha: 0.85),
              ),
              label: Text(suggestion),
              onPressed: () => onSuggestionSelected(suggestion),
            ),
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
    required this.hintText,
  });

  final TextEditingController controller;
  final bool sending;
  final VoidCallback onSend;
  final String hintText;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(18, 8, 18, 16),
        child: AppCard(
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
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
                  decoration: InputDecoration(
                    hintText: hintText,
                    filled: false,
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 10,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.small),
              SizedBox.square(
                dimension: 50,
                child: FilledButton(
                  onPressed: sending ? null : onSend,
                  style: FilledButton.styleFrom(
                    padding: EdgeInsets.zero,
                    backgroundColor: AppColors.primaryAccent,
                    foregroundColor: AppColors.appBackground,
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
