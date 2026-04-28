import 'package:flutter/material.dart';

import '../../core/constants/app_constants.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_radius.dart';

class AppLogo extends StatelessWidget {
  const AppLogo({super.key, this.compact = false});

  final bool compact;

  @override
  Widget build(BuildContext context) {
    final iconSize = compact ? 34.0 : 42.0;
    final labelStyle = Theme.of(context).textTheme.titleMedium?.copyWith(
          color: AppColors.textPrimary,
          fontWeight: FontWeight.w600,
        );

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: iconSize,
          height: iconSize,
          decoration: BoxDecoration(
            color: AppColors.surfaceSoft,
            borderRadius: BorderRadius.circular(AppRadius.large),
            border: Border.all(
              color: AppColors.divider.withValues(alpha: 0.55),
              width: 0.7,
            ),
          ),
          child: CustomPaint(painter: _LogoPainter()),
        ),
        const SizedBox(width: 12),
        Text(AppConstants.appName, style: labelStyle),
      ],
    );
  }
}

class _LogoPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final bg = Paint()..color = AppColors.surfaceSoft;
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Offset.zero & size,
        Radius.circular(size.width * 0.26),
      ),
      bg,
    );

    final centerX = size.width / 2;
    final cover = Paint()
      ..color = AppColors.primaryAccent
      ..style = PaintingStyle.fill;
    final page = Paint()
      ..color = AppColors.textPrimary
      ..style = PaintingStyle.fill;
    final line = Paint()
      ..color = AppColors.appBackground
      ..strokeWidth = size.width * 0.032
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;
    final subtle = Paint()
      ..color = AppColors.secondaryAccent
      ..strokeWidth = size.width * 0.02
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;
    final outline = Paint()
      ..color = AppColors.appBackground
      ..strokeWidth = size.width * 0.028
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;

    // Rehal stand, flatter and cleaner
    canvas.drawLine(
      Offset(size.width * 0.28, size.height * 0.86),
      Offset(centerX - size.width * 0.07, size.height * 0.66),
      outline,
    );
    canvas.drawLine(
      Offset(size.width * 0.72, size.height * 0.86),
      Offset(centerX + size.width * 0.07, size.height * 0.66),
      outline,
    );
    canvas.drawLine(
      Offset(size.width * 0.31, size.height * 0.84),
      Offset(centerX - size.width * 0.025, size.height * 0.69),
      subtle,
    );
    canvas.drawLine(
      Offset(size.width * 0.69, size.height * 0.84),
      Offset(centerX + size.width * 0.025, size.height * 0.69),
      subtle,
    );
    canvas.drawLine(
      Offset(size.width * 0.42, size.height * 0.69),
      Offset(size.width * 0.58, size.height * 0.69),
      subtle..strokeWidth = size.width * 0.028,
    );

    // Open Quran pages
    final leftPage = Path()
      ..moveTo(centerX, size.height * 0.68)
      ..lineTo(size.width * 0.28, size.height * 0.70)
      ..lineTo(size.width * 0.30, size.height * 0.31)
      ..lineTo(centerX, size.height * 0.42)
      ..close();
    final rightPage = Path()
      ..moveTo(centerX, size.height * 0.68)
      ..lineTo(size.width * 0.72, size.height * 0.70)
      ..lineTo(size.width * 0.70, size.height * 0.31)
      ..lineTo(centerX, size.height * 0.42)
      ..close();

    final leftCover = Path()
      ..moveTo(size.width * 0.31, size.height * 0.30)
      ..lineTo(centerX, size.height * 0.42)
      ..lineTo(centerX, size.height * 0.25)
      ..lineTo(size.width * 0.32, size.height * 0.22)
      ..close();
    final rightCover = Path()
      ..moveTo(size.width * 0.69, size.height * 0.30)
      ..lineTo(centerX, size.height * 0.42)
      ..lineTo(centerX, size.height * 0.25)
      ..lineTo(size.width * 0.68, size.height * 0.22)
      ..close();

    canvas.drawPath(leftPage, page);
    canvas.drawPath(rightPage, page);
    canvas.drawPath(leftCover, cover);
    canvas.drawPath(rightCover, cover);
    canvas.drawLine(
      Offset(centerX, size.height * 0.25),
      Offset(centerX, size.height * 0.69),
      outline,
    );
    canvas.drawPath(leftPage, outline);
    canvas.drawPath(rightPage, outline);
    canvas.drawPath(leftCover, outline);
    canvas.drawPath(rightCover, outline);

    for (final y in [0.36, 0.45, 0.54]) {
      canvas.drawLine(
        Offset(size.width * 0.35, size.height * y),
        Offset(size.width * 0.47, size.height * (y + 0.02)),
        line,
      );
      canvas.drawLine(
        Offset(size.width * 0.65, size.height * y),
        Offset(size.width * 0.53, size.height * (y + 0.02)),
        line,
      );
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
