import 'package:flutter/material.dart';

import '../../../data/models/chat_message_model.dart';
import '../../../shared/widgets/ayah_card.dart';
import '../../../theme/app_colors.dart';

class ChatAyahCard extends StatelessWidget {
  const ChatAyahCard({
    super.key,
    required this.ayah,
  });

  final ChatSelectedAyah ayah;

  @override
  Widget build(BuildContext context) {
    return AyahCardSurface(
      padding: const EdgeInsets.all(22),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            ayah.displayReference,
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  color: AppColors.secondaryAccent,
                  letterSpacing: 0,
                ),
          ),
          const SizedBox(height: 14),
          const SizedBox(height: 2),
          Align(
            alignment: Alignment.centerRight,
            child: Directionality(
              textDirection: TextDirection.rtl,
              child: Text(
                ayah.textAr,
                textAlign: TextAlign.right,
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontSize: 22,
                      height: 1.82,
                      color: AppColors.textPrimary,
                      fontWeight: FontWeight.w500,
                    ),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            ayah.textTr,
            style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  fontSize: 18,
                  height: 1.8,
                  color: AppColors.textPrimary,
                  fontWeight: FontWeight.w500,
                ),
          ),
        ],
      ),
    );
  }
}
