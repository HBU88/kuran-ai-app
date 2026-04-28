import 'package:flutter/material.dart';

import '../../../theme/app_colors.dart';
import '../../../theme/app_radius.dart';

class HomeMenuItem extends StatelessWidget {
  const HomeMenuItem({
    super.key,
    required this.label,
    required this.icon,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(AppRadius.large),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.large),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 15),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadius.large),
            border: Border.all(
              color: AppColors.divider.withValues(alpha: 0.6),
              width: 0.7,
            ),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: AppColors.surfaceSoft,
                  borderRadius: BorderRadius.circular(AppRadius.medium),
                  border: Border.all(
                    color: AppColors.divider.withValues(alpha: 0.55),
                    width: 0.6,
                  ),
                ),
                child: CustomPaint(
                  painter: _MenuGlyphPainter(icon),
                ),
              ),
              const SizedBox(height: 9),
              Text(
                label,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      color: AppColors.textPrimary,
                      fontWeight: FontWeight.w400,
                    ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MenuGlyphPainter extends CustomPainter {
  _MenuGlyphPainter(this.icon);

  final IconData icon;

  @override
  void paint(Canvas canvas, Size size) {
    final accent = Paint()
      ..color = AppColors.primaryAccent
      ..strokeWidth = 1.8
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    final cream = Paint()
      ..color = AppColors.textPrimary
      ..strokeWidth = 1.8
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    final fill = Paint()
      ..color = AppColors.secondaryAccent
      ..style = PaintingStyle.fill;

    void drawChat() {
      final bubble = RRect.fromRectAndRadius(
        Rect.fromLTWH(size.width * 0.2, size.height * 0.26, size.width * 0.52,
            size.height * 0.34),
        Radius.circular(size.width * 0.09),
      );
      canvas.drawRRect(bubble, cream);
      canvas.drawPath(
        Path()
          ..moveTo(size.width * 0.35, size.height * 0.60)
          ..lineTo(size.width * 0.28, size.height * 0.78)
          ..lineTo(size.width * 0.45, size.height * 0.64),
        cream,
      );
      canvas.drawLine(
        Offset(size.width * 0.31, size.height * 0.38),
        Offset(size.width * 0.61, size.height * 0.38),
        accent,
      );
      canvas.drawLine(
        Offset(size.width * 0.31, size.height * 0.48),
        Offset(size.width * 0.53, size.height * 0.48),
        accent,
      );
    }

    void drawBook() {
      final left = Path()
        ..moveTo(size.width * 0.5, size.height * 0.28)
        ..lineTo(size.width * 0.25, size.height * 0.36)
        ..lineTo(size.width * 0.25, size.height * 0.72)
        ..lineTo(size.width * 0.5, size.height * 0.64)
        ..close();
      final right = Path()
        ..moveTo(size.width * 0.5, size.height * 0.28)
        ..lineTo(size.width * 0.75, size.height * 0.36)
        ..lineTo(size.width * 0.75, size.height * 0.72)
        ..lineTo(size.width * 0.5, size.height * 0.64)
        ..close();
      canvas.drawPath(left, cream);
      canvas.drawPath(right, cream);
      canvas.drawLine(
        Offset(size.width * 0.5, size.height * 0.28),
        Offset(size.width * 0.5, size.height * 0.72),
        accent,
      );
      canvas.drawLine(
        Offset(size.width * 0.34, size.height * 0.44),
        Offset(size.width * 0.44, size.height * 0.47),
        accent,
      );
      canvas.drawLine(
        Offset(size.width * 0.56, size.height * 0.47),
        Offset(size.width * 0.66, size.height * 0.44),
        accent,
      );
    }

    void drawCompass() {
      canvas.drawCircle(
        Offset(size.width * 0.5, size.height * 0.5),
        size.width * 0.24,
        cream,
      );
      canvas.drawLine(
        Offset(size.width * 0.5, size.height * 0.26),
        Offset(size.width * 0.5, size.height * 0.74),
        accent,
      );
      canvas.drawLine(
        Offset(size.width * 0.36, size.height * 0.50),
        Offset(size.width * 0.64, size.height * 0.50),
        accent,
      );
      canvas.drawPath(
        Path()
          ..moveTo(size.width * 0.5, size.height * 0.34)
          ..lineTo(size.width * 0.58, size.height * 0.50)
          ..lineTo(size.width * 0.5, size.height * 0.66)
          ..lineTo(size.width * 0.42, size.height * 0.50)
          ..close(),
        fill,
      );
    }

    void drawClock() {
      canvas.drawCircle(
        Offset(size.width * 0.5, size.height * 0.5),
        size.width * 0.26,
        cream,
      );
      canvas.drawLine(
        Offset(size.width * 0.5, size.height * 0.50),
        Offset(size.width * 0.5, size.height * 0.34),
        accent,
      );
      canvas.drawLine(
        Offset(size.width * 0.5, size.height * 0.50),
        Offset(size.width * 0.63, size.height * 0.56),
        accent,
      );
    }

    void drawHeart() {
      final path = Path()
        ..moveTo(size.width * 0.50, size.height * 0.72)
        ..cubicTo(size.width * 0.18, size.height * 0.52, size.width * 0.22,
            size.height * 0.26, size.width * 0.50, size.height * 0.38)
        ..cubicTo(size.width * 0.78, size.height * 0.26, size.width * 0.82,
            size.height * 0.52, size.width * 0.50, size.height * 0.72);
      canvas.drawPath(path, cream);
      canvas.drawPath(
        Path()
          ..moveTo(size.width * 0.42, size.height * 0.42)
          ..lineTo(size.width * 0.58, size.height * 0.42),
        accent,
      );
    }

    if (icon == Icons.chat_bubble_outline_rounded) {
      drawChat();
    } else if (icon == Icons.menu_book_outlined) {
      drawBook();
    } else if (icon == Icons.explore_outlined) {
      drawCompass();
    } else if (icon == Icons.schedule_outlined) {
      drawClock();
    } else {
      drawHeart();
    }
  }

  @override
  bool shouldRepaint(covariant _MenuGlyphPainter oldDelegate) =>
      oldDelegate.icon != icon;
}
