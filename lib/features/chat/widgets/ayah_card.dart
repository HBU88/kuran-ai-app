import 'package:flutter/material.dart';

import '../../../data/models/chat_message_model.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../theme/app_colors.dart';

class ChatAyahCard extends StatelessWidget {
  const ChatAyahCard({
    super.key,
    required this.ayah,
  });

  final ChatSelectedAyah ayah;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            ayah.displayReference,
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  color: AppColors.primaryAccentSoft,
                  letterSpacing: 0.2,
                  fontWeight: FontWeight.w700,
                ),
          ),
          const SizedBox(height: 14),
          Align(
            alignment: Alignment.centerRight,
            child: Directionality(
              textDirection: TextDirection.rtl,
              child: Text(
                ayah.textAr,
                textAlign: TextAlign.right,
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontSize: 21,
                      height: 1.82,
                      color: AppColors.textPrimary,
                      fontWeight: FontWeight.w600,
                    ),
              ),
            ),
          ),
          const SizedBox(height: 14),
          Text(
            ayah.textTr,
            style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  fontSize: 17,
                  height: 1.72,
                  color: AppColors.textPrimary,
                  fontWeight: FontWeight.w500,
                ),
          ),
          const SizedBox(height: 14),
          const _DisabledAudioNotice(),
        ],
      ),
    );
  }
}

class _DisabledAudioNotice extends StatelessWidget {
  const _DisabledAudioNotice();

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          TextButton.icon(
            onPressed: null,
            icon: const Icon(Icons.play_circle_outline_rounded, size: 18),
            label: const Text('Dinle'),
          ),
          Text(
            'Sesli dinleme yakında eklenecek.',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: AppColors.textMuted,
                ),
          ),
        ],
      ),
    );
  }
}
