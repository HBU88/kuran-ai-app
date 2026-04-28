import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/utils/notification_helper.dart';
import '../../shared/widgets/app_card.dart';
import '../../shared/widgets/loading_view.dart';
import 'prayer_times_controller.dart';

class PrayerTimesScreen extends StatefulWidget {
  const PrayerTimesScreen({super.key});

  @override
  State<PrayerTimesScreen> createState() => _PrayerTimesScreenState();
}

class _PrayerTimesScreenState extends State<PrayerTimesScreen> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Namaz vakitleri')),
      body: Consumer<PrayerTimesController>(
        builder: (context, controller, _) {
          return ListView(
            padding: const EdgeInsets.fromLTRB(18, 8, 18, 28),
            children: [
              _LocationPickerCard(controller: controller),
              const SizedBox(height: 18),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Bildirimleri aç'),
                subtitle: const Text('MVP için tercih yerel olarak saklanır.'),
                value: controller.notificationsEnabled,
                onChanged: (value) async {
                  await controller.setNotificationsEnabled(value);
                  if (!context.mounted) {
                    return;
                  }
                  if (value) {
                    final notificationHelper =
                        context.read<NotificationHelper>();
                    await notificationHelper.showPrayerTogglePreview();
                  }
                },
              ),
              const SizedBox(height: 8),
              if (controller.loading)
                const SizedBox(
                  height: 220,
                  child: LoadingView(message: 'Vakitler getiriliyor...'),
                )
              else if (controller.errorMessage != null)
                Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    AppCard(child: Text(controller.errorMessage!)),
                    if (kDebugMode) ...[
                      const SizedBox(height: 14),
                      _PrayerErrorDebugCard(controller: controller),
                    ],
                  ],
                )
              else if (controller.prayerTimes != null)
                _PrayerTimesContent(controller: controller)
              else
                const Text('Vakitler alınamadı. Lütfen tekrar deneyin.'),
            ],
          );
        },
      ),
    );
  }
}

class _LocationPickerCard extends StatelessWidget {
  const _LocationPickerCard({required this.controller});

  final PrayerTimesController controller;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Konum seçimi',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<int>(
            key: ValueKey('country-$_validCountryValue'),
            initialValue: _validCountryValue,
            isExpanded: true,
            decoration: const InputDecoration(
              labelText: 'Ülke',
              border: OutlineInputBorder(),
            ),
            items: [
              for (final country in controller.countries)
                DropdownMenuItem(
                  value: country.id,
                  child: Text(country.name),
                ),
            ],
            onChanged: controller.countriesLoading
                ? null
                : (value) => controller.selectCountry(value),
          ),
          if (controller.countriesLoading) ...[
            const SizedBox(height: 8),
            const LinearProgressIndicator(),
          ],
          const SizedBox(height: 12),
          DropdownButtonFormField<int>(
            key: ValueKey(
                'state-${controller.selectedCountryId}-$_validStateValue'),
            initialValue: _validStateValue,
            isExpanded: true,
            decoration: const InputDecoration(
              labelText: 'Eyalet / İl',
              border: OutlineInputBorder(),
            ),
            items: [
              for (final state in controller.states)
                DropdownMenuItem(
                  value: state.id,
                  child: Text(state.name),
                ),
            ],
            onChanged:
                controller.selectedCountryId == null || controller.statesLoading
                    ? null
                    : (value) => controller.selectState(value),
          ),
          if (controller.statesLoading) ...[
            const SizedBox(height: 8),
            const LinearProgressIndicator(),
          ],
          const SizedBox(height: 12),
          DropdownButtonFormField<int>(
            key:
                ValueKey('city-${controller.selectedStateId}-$_validCityValue'),
            initialValue: _validCityValue,
            isExpanded: true,
            decoration: const InputDecoration(
              labelText: 'Şehir / İlçe',
              border: OutlineInputBorder(),
            ),
            items: [
              for (final city in controller.cities)
                DropdownMenuItem(
                  value: city.id,
                  child: Text(city.name),
                ),
            ],
            onChanged:
                controller.selectedStateId == null || controller.citiesLoading
                    ? null
                    : (value) => controller.selectCity(value),
          ),
          if (controller.citiesLoading) ...[
            const SizedBox(height: 8),
            const LinearProgressIndicator(),
          ],
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: controller.canSaveLocation
                ? controller.saveSelectedLocation
                : null,
            icon: controller.savingLocation
                ? const SizedBox.square(
                    dimension: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.location_city_rounded),
            label: const Text('Konumu uygula'),
          ),
        ],
      ),
    );
  }

  int? get _validCountryValue {
    final selected = controller.selectedCountryId;
    if (selected == null) {
      return null;
    }
    return controller.countries.any((country) => country.id == selected)
        ? selected
        : null;
  }

  int? get _validStateValue {
    final selected = controller.selectedStateId;
    if (selected == null) {
      return null;
    }
    return controller.states.any((state) => state.id == selected)
        ? selected
        : null;
  }

  int? get _validCityValue {
    final selected = controller.selectedCityId;
    if (selected == null) {
      return null;
    }
    return controller.cities.any((city) => city.id == selected)
        ? selected
        : null;
  }
}

class _PrayerErrorDebugCard extends StatelessWidget {
  const _PrayerErrorDebugCard({required this.controller});

  final PrayerTimesController controller;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: DefaultTextStyle.merge(
        style: Theme.of(context).textTheme.bodySmall,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'DIYANET ERROR DEBUG',
              style: TextStyle(fontWeight: FontWeight.bold),
            ),
            Text(
              'Login status: ${controller.debugLoginStatusCode ?? '-'}',
            ),
            Text(
              'Prayer status: ${controller.debugPrayerStatusCode ?? '-'}',
            ),
            Text('Source: ${controller.debugSource}'),
            Text('Selected country name: ${controller.selectedCountryName}'),
            Text('Selected state name: ${controller.selectedStateName}'),
            Text('Selected city name: ${controller.selectedCityName}'),
            Text('Selected city id: ${controller.selectedCityId ?? '-'}'),
            Text(
              'Prayer endpoint URL: ${controller.debugPrayerEndpointUrl ?? '-'}',
            ),
            Text(
              'NEW CITY SELECTED: ${controller.debugNewCitySelectedId ?? '-'} ${controller.debugNewCitySelectedName}',
            ),
            Text(
              'NEW PRAYER ENDPOINT: ${controller.debugPrayerEndpointUrl ?? '-'}',
            ),
            const SizedBox(height: 8),
            Text('Raw error: ${controller.debugErrorMessage ?? '-'}'),
          ],
        ),
      ),
    );
  }
}

class _PrayerTimesContent extends StatelessWidget {
  const _PrayerTimesContent({required this.controller});

  final PrayerTimesController controller;

  @override
  Widget build(BuildContext context) {
    final times = controller.prayerTimes!;
    final effectiveNow = controller.effectiveNow;

    return Column(
      children: [
        AppCard(
          child: Row(
            children: [
              const Icon(Icons.place_outlined),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  controller.selectedLocationLabel,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        AppCard(
          child: Row(
            children: [
              Expanded(
                child: Text(
                  'Şu an',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              Text(
                DateFormat(kDebugMode ? 'HH:mm:ss' : 'HH:mm')
                    .format(effectiveNow),
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        AppCard(
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Sonraki vakit',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 6),
                    Text(
                      times.nextPrayerName,
                      style:
                          Theme.of(context).textTheme.headlineSmall?.copyWith(
                                fontWeight: FontWeight.w800,
                              ),
                    ),
                  ],
                ),
              ),
              Text(
                DateFormat('HH:mm').format(times.nextPrayerTime),
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                      color: Theme.of(context).colorScheme.primary,
                    ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        AppCard(
          child: Row(
            children: [
              Expanded(
                child: Text(
                  'Ezanına Kalan Süre',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              Text(
                times.formattedRemainingDuration,
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                      color: Theme.of(context).colorScheme.primary,
                    ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${times.city}, ${times.country} · ${DateFormat('dd.MM.yyyy').format(times.gregorianDate)}',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
              ),
              const SizedBox(height: 4),
              Text(
                times.hijriDateFormatted,
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: 6),
              Text(
                'Location: ${controller.selectedCountryName} / ${controller.selectedStateName} / ${controller.selectedCityName}',
              ),
              Text(
                'Gregorian: ${DateFormat('dd.MM.yyyy').format(times.gregorianDate)}',
              ),
              Text('Hijri: ${times.hijriDateFormatted}'),
              Text('Source: ${times.source}'),
              const SizedBox(height: 12),
              for (final entry in times.prayers.entries)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          entry.key,
                          style: TextStyle(
                            fontWeight: entry.key == times.nextPrayerName
                                ? FontWeight.w800
                                : FontWeight.w400,
                            color: entry.key == times.nextPrayerName
                                ? Theme.of(context).colorScheme.primary
                                : null,
                          ),
                        ),
                      ),
                      Text(
                        DateFormat('HH:mm').format(entry.value),
                        style: TextStyle(
                          fontWeight: FontWeight.w800,
                          color: entry.key == times.nextPrayerName
                              ? Theme.of(context).colorScheme.primary
                              : null,
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
        if (kDebugMode) ...[
          const SizedBox(height: 14),
          _PrayerDebugPanel(controller: controller),
        ],
      ],
    );
  }
}

class _PrayerDebugPanel extends StatelessWidget {
  const _PrayerDebugPanel({required this.controller});

  final PrayerTimesController controller;

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat('yyyy-MM-dd HH:mm:ss');
    final nextDateTime = controller.nextPrayerDateTime;

    return AppCard(
      child: DefaultTextStyle.merge(
        style: Theme.of(context).textTheme.bodySmall,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'DEBUG MODE',
              style: TextStyle(fontWeight: FontWeight.bold),
            ),
            Text(
              'Device local now: ${dateFormat.format(controller.deviceLocalNow)}',
            ),
            Text('UTC now: ${dateFormat.format(controller.utcNow)}'),
            Text(
              'Effective now: ${dateFormat.format(controller.effectiveNow)}',
            ),
            Text('Device timezone offset: ${controller.timezoneOffset}'),
            Text(
              'greenwichMeanTimeZone: ${controller.greenwichMeanTimeZone ?? '-'}',
            ),
            Text('Timezone source: ${controller.timezoneSource}'),
            Text('Selected country id: ${controller.selectedCountryId ?? '-'}'),
            Text('Selected country name: ${controller.selectedCountryName}'),
            Text('Selected state id: ${controller.selectedStateId ?? '-'}'),
            Text('Selected state name: ${controller.selectedStateName}'),
            Text('Selected city id: ${controller.selectedCityId ?? '-'}'),
            Text('Selected city name: ${controller.selectedCityName}'),
            Text(
              'Prayer endpoint URL: ${controller.debugPrayerEndpointUrl ?? '-'}',
            ),
            Text(
              'NEW CITY SELECTED: ${controller.debugNewCitySelectedId ?? '-'} ${controller.debugNewCitySelectedName}',
            ),
            Text(
              'NEW PRAYER ENDPOINT: ${controller.debugPrayerEndpointUrl ?? '-'}',
            ),
            Text('Source: ${controller.sourceType}'),
            const SizedBox(height: 8),
            const Text('API raw prayer strings:'),
            for (final entry in controller.rawPrayerTimeStrings.entries)
              Text('${entry.key}: ${entry.value}'),
            const SizedBox(height: 8),
            const Text('Parsed effective prayer DateTimes:'),
            for (final entry in controller.parsedPrayerDateTimes.entries)
              Text('${entry.key}: ${dateFormat.format(entry.value)}'),
            const SizedBox(height: 8),
            Text('Next prayer name: ${controller.nextPrayerName}'),
            Text(
              'Next prayer time: ${nextDateTime == null ? '-' : dateFormat.format(nextDateTime)}',
            ),
            Text(
              'remainingDurationRaw: ${controller.remainingDuration ?? '-'}',
            ),
          ],
        ),
      ),
    );
  }
}
