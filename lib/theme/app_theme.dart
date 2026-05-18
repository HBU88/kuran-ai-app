import 'package:flutter/material.dart';

import 'app_colors.dart';
import 'app_radius.dart';

class AppTheme {
  const AppTheme._();

  static ThemeData dark() {
    const colorScheme = ColorScheme.dark(
      primary: AppColors.primaryAccent,
      onPrimary: AppColors.appBackground,
      secondary: AppColors.primaryAccentSoft,
      onSecondary: AppColors.appBackground,
      surface: AppColors.surface,
      onSurface: AppColors.textPrimary,
      error: Color(0xFFEA8686),
      onError: AppColors.appBackground,
    );

    final base = ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: AppColors.appBackground,
      fontFamily: 'Noto Serif',
      fontFamilyFallback: const ['serif'],
    );

    final textTheme = base.textTheme.copyWith(
      displaySmall: const TextStyle(
        fontSize: 34,
        height: 1.1,
        fontWeight: FontWeight.w700,
        color: AppColors.textPrimary,
      ),
      headlineMedium: const TextStyle(
        fontSize: 30,
        height: 1.12,
        fontWeight: FontWeight.w700,
        color: AppColors.textPrimary,
      ),
      headlineSmall: const TextStyle(
        fontSize: 24,
        height: 1.18,
        fontWeight: FontWeight.w700,
        color: AppColors.textPrimary,
      ),
      titleLarge: const TextStyle(
        fontSize: 22,
        height: 1.22,
        fontWeight: FontWeight.w700,
        color: AppColors.textPrimary,
      ),
      titleMedium: const TextStyle(
        fontSize: 17,
        height: 1.28,
        fontWeight: FontWeight.w600,
        color: AppColors.textPrimary,
      ),
      titleSmall: const TextStyle(
        fontSize: 14,
        height: 1.35,
        fontWeight: FontWeight.w500,
        color: AppColors.textSecondary,
      ),
      bodyLarge: const TextStyle(
        fontSize: 16,
        height: 1.65,
        fontWeight: FontWeight.w400,
        color: AppColors.textPrimary,
      ),
      bodyMedium: const TextStyle(
        fontSize: 15,
        height: 1.6,
        fontWeight: FontWeight.w400,
        color: AppColors.textSecondary,
      ),
      bodySmall: const TextStyle(
        fontSize: 13,
        height: 1.5,
        fontWeight: FontWeight.w400,
        color: AppColors.textSecondary,
      ),
      labelLarge: const TextStyle(
        fontSize: 15,
        height: 1.2,
        fontWeight: FontWeight.w600,
        color: AppColors.textPrimary,
      ),
      labelMedium: const TextStyle(
        fontSize: 13,
        height: 1.35,
        fontWeight: FontWeight.w500,
        color: AppColors.textSecondary,
      ),
    );

    return base.copyWith(
      textTheme: textTheme,
      dividerColor: AppColors.divider,
      splashColor: Colors.transparent,
      highlightColor: Colors.transparent,
      appBarTheme: const AppBarTheme(
        elevation: 0,
        centerTitle: false,
        backgroundColor: Colors.transparent,
        foregroundColor: AppColors.textPrimary,
        surfaceTintColor: Colors.transparent,
        titleTextStyle: TextStyle(
          fontSize: 20,
          height: 1.15,
          fontWeight: FontWeight.w700,
          color: AppColors.textPrimary,
        ),
      ),
      scaffoldBackgroundColor: AppColors.appBackground,
      cardTheme: CardThemeData(
        color: AppColors.surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.xLarge),
          side: const BorderSide(color: AppColors.divider, width: 0.8),
        ),
      ),
      dividerTheme: const DividerThemeData(
        color: AppColors.divider,
        thickness: 1,
        space: 1,
      ),
      iconTheme: const IconThemeData(
        color: AppColors.textSecondary,
        size: 20,
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: AppColors.surface.withValues(alpha: 0.92),
        indicatorColor: AppColors.surfaceSoft,
        labelTextStyle: WidgetStateProperty.resolveWith(
          (states) => TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w500,
            color: states.contains(WidgetState.selected)
                ? AppColors.textPrimary
                : AppColors.textMuted,
          ),
        ),
        iconTheme: WidgetStateProperty.resolveWith(
          (states) => IconThemeData(
            color: states.contains(WidgetState.selected)
                ? AppColors.primaryAccent
                : AppColors.textMuted,
            size: 20,
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.surfaceSoft.withValues(alpha: 0.86),
        hintStyle: const TextStyle(
          fontSize: 15,
          fontWeight: FontWeight.w400,
          color: AppColors.textMuted,
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 18,
          vertical: 16,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.large),
          borderSide: const BorderSide(color: AppColors.divider),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.large),
          borderSide: const BorderSide(color: AppColors.divider),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.large),
          borderSide: const BorderSide(
            color: AppColors.primaryAccent,
            width: 1.1,
          ),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          elevation: 0,
          backgroundColor: AppColors.primaryAccent,
          foregroundColor: AppColors.appBackground,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.large),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          textStyle: textTheme.labelLarge,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.textPrimary,
          side: const BorderSide(color: AppColors.divider),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.large),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.primaryAccent,
          textStyle: textTheme.labelLarge,
        ),
      ),
      iconButtonTheme: IconButtonThemeData(
        style: IconButton.styleFrom(
          foregroundColor: AppColors.textSecondary,
          backgroundColor: AppColors.surfaceSoft.withValues(alpha: 0.75),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.large),
          ),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: AppColors.surfaceSoft.withValues(alpha: 0.9),
        selectedColor: AppColors.primaryAccent.withValues(alpha: 0.18),
        disabledColor: AppColors.surfaceSoft,
        side: const BorderSide(color: AppColors.divider, width: 0.8),
        labelStyle: textTheme.bodySmall!.copyWith(color: AppColors.textPrimary),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.large),
        ),
      ),
      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: AppColors.primaryAccent,
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: AppColors.surface,
        surfaceTintColor: Colors.transparent,
      ),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: AppColors.primaryAccent,
        foregroundColor: AppColors.appBackground,
      ),
    );
  }

  static ThemeData light() => dark();
}
