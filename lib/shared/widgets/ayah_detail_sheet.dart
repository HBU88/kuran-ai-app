import 'package:flutter/material.dart';

import '../../data/models/ayah_model.dart';

Future<void> showAyahDetailSheet(BuildContext context, AyahModel ayah) {
  return showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    builder: (context) {
      return Padding(
        padding: EdgeInsets.fromLTRB(
          22,
          8,
          22,
          MediaQuery.of(context).viewInsets.bottom + 28,
        ),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                '${ayah.surahNameTr} ${ayah.ayahNumber}',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w600,
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
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                          height: 1.8,
                          fontWeight: FontWeight.w500,
                        ),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                ayah.textTr,
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      height: 1.5,
                      fontWeight: FontWeight.w500,
                    ),
              ),
              const SizedBox(height: 12),
              Text(
                ayah.shortExplanation,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      height: 1.5,
                    ),
              ),
              const SizedBox(height: 14),
              Wrap(
                spacing: 8,
                children: [
                  for (final tag in ayah.tags) Chip(label: Text(tag)),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                ayah.source,
                style: Theme.of(context).textTheme.labelMedium,
              ),
            ],
          ),
        ),
      );
    },
  );
}
