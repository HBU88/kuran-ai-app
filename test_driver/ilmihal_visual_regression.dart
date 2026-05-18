import 'dart:io';

import 'package:integration_test/integration_test_driver_extended.dart';

Future<void> main() async {
  final screenshotsDir = Directory('test_artifacts/screenshots');
  final logsDir = Directory('test_artifacts/logs');
  await screenshotsDir.create(recursive: true);
  await logsDir.create(recursive: true);

  await integrationDriver(
    writeResponseOnFailure: true,
    responseDataCallback: (data) async {
      await writeResponseData(
        data,
        testOutputFilename: 'ilmihal_visual_regression_results',
        destinationDirectory: logsDir.path,
      );
    },
    onScreenshot: (String name, List<int> image,
        [Map<String, Object?>? args]) async {
      final safeName = name.replaceAll(RegExp(r'[^A-Za-z0-9._-]+'), '_');
      final file = File(
        '${screenshotsDir.path}${Platform.pathSeparator}$safeName.png',
      );
      await file.writeAsBytes(image, flush: true);
      return true;
    },
  );
}
