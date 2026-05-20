import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../data/models/recommended_resource.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_radius.dart';
import '../../theme/app_spacing.dart';
import 'app_card.dart';

class RecommendedResourcesSection extends StatelessWidget {
  const RecommendedResourcesSection({
    super.key,
    required this.resources,
  });

  final List<RecommendedResource> resources;

  @override
  Widget build(BuildContext context) {
    final visibleResources = resources.take(2).toList();
    if (visibleResources.isEmpty) return const SizedBox.shrink();

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.auto_awesome_outlined,
                color: AppColors.primaryAccent,
                size: 20,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Bu konuda önerilen kaynaklar',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.small),
          for (final resource in visibleResources) ...[
            RecommendedResourceCard(resource: resource),
            if (resource != visibleResources.last)
              const SizedBox(height: AppSpacing.small),
          ],
        ],
      ),
    );
  }
}

class RecommendedResourceCard extends StatelessWidget {
  const RecommendedResourceCard({
    super.key,
    required this.resource,
  });

  final RecommendedResource resource;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadius.medium),
        onTap: () => _openResource(context),
        child: Container(
          padding: const EdgeInsets.fromLTRB(12, 11, 12, 11),
          decoration: BoxDecoration(
            color: AppColors.surfaceSoft.withValues(alpha: 0.54),
            borderRadius: BorderRadius.circular(AppRadius.medium),
            border: Border.all(
              color: AppColors.primaryAccent.withValues(alpha: 0.16),
            ),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.primaryAccent.withValues(alpha: 0.1),
                ),
                child: const Icon(
                  Icons.menu_book_outlined,
                  color: AppColors.primaryAccent,
                  size: 18,
                ),
              ),
              const SizedBox(width: 11),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      resource.sourceLabel,
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: AppColors.primaryAccentSoft,
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      resource.title,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                            color: AppColors.textPrimary,
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      resource.description,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: AppColors.textSecondary,
                            height: 1.35,
                          ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              const Icon(
                Icons.open_in_new_rounded,
                color: AppColors.textMuted,
                size: 18,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _openResource(BuildContext context) async {
    final messenger = ScaffoldMessenger.of(context);
    final uri = Uri.tryParse(resource.url);
    if (uri == null) {
      messenger.showSnackBar(
        const SnackBar(content: Text('Kaynak şu anda açılamıyor.')),
      );
      return;
    }

    final opened = await launchUrl(
      uri,
      mode: LaunchMode.externalApplication,
    );
    if (!opened) {
      messenger.showSnackBar(
        const SnackBar(content: Text('Kaynak şu anda açılamıyor.')),
      );
    }
  }
}
