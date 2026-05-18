import 'package:integration_test/integration_test.dart';

import 'app_smoke_test_cases.dart' as tests;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  tests.main();
}
