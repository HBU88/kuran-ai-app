import 'package:flutter/material.dart';

import '../../data/models/chat_message_model.dart';

class ChatAyahCard extends StatelessWidget {
  const ChatAyahCard({
    super.key,
    required this.ayah,
  });

  final ChatSelectedAyah ayah;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        constraints: BoxConstraints(
          maxWidth: MediaQuery.sizeOf(context).width * 0.88,
        ),
        margin: const EdgeInsets.only(left: 4, top: 4, bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.94),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color:
                Theme.of(context).colorScheme.primary.withValues(alpha: 0.16),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 12,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              ayah.displayReference,
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
            ),
            const SizedBox(height: 10),
            Align(
              alignment: Alignment.centerRight,
              child: Directionality(
                textDirection: TextDirection.rtl,
                child: Text(
                  ayah.textAr,
                  textAlign: TextAlign.right,
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        height: 1.8,
                        fontWeight: FontWeight.w700,
                      ),
                ),
              ),
            ),
            const SizedBox(height: 12),
            Text(
              ayah.textTr,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    height: 1.5,
                    fontWeight: FontWeight.w700,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}
