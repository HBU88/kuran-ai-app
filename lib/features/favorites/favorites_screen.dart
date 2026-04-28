import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../shared/widgets/ayah_card.dart';
import '../../shared/widgets/ayah_detail_sheet.dart';
import '../../shared/widgets/loading_view.dart';
import 'favorites_controller.dart';

class FavoritesScreen extends StatefulWidget {
  const FavoritesScreen({super.key});

  @override
  State<FavoritesScreen> createState() => _FavoritesScreenState();
}

class _FavoritesScreenState extends State<FavoritesScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      if (!mounted) {
        return;
      }
      context.read<FavoritesController>().load();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Favoriler')),
      body: Consumer<FavoritesController>(
        builder: (context, controller, _) {
          if (controller.loading) {
            return const LoadingView(message: 'Favoriler yükleniyor...');
          }

          if (controller.favorites.isEmpty) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(
                  'Henüz favori ayetin yok. Beğendiğin ayetleri kalp simgesiyle buraya ekleyebilirsin.',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyLarge,
                ),
              ),
            );
          }

          return ListView.separated(
            padding: const EdgeInsets.fromLTRB(18, 8, 18, 28),
            itemCount: controller.favorites.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (context, index) {
              final ayah = controller.favorites[index];
              return InkWell(
                onTap: () => showAyahDetailSheet(context, ayah),
                borderRadius: BorderRadius.circular(8),
                child: AyahCard(
                  ayah: ayah,
                  showActions: false,
                  trailing: IconButton(
                    onPressed: () => controller.remove(ayah.id),
                    icon: const Icon(Icons.delete_outline_rounded),
                    tooltip: 'Sil',
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
