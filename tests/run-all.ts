import { runPaymentSecurityTests } from './security-tests.ts';
import { runIntegrationTests } from './integration-tests.ts';

async function main() {
  console.log('\n======================================================');
  console.log('🚀 OpenUPI Gateway: Executing Full Automated Test Suite');
  console.log('======================================================\n');

  const secResults = await runPaymentSecurityTests();
  const intResults = await runIntegrationTests();

  const total = secResults.totalScenarios + intResults.totalTests;
  const passed = secResults.passedCount + intResults.passedCount;
  const failed = secResults.failedCount + intResults.failedCount;

  console.log('\n======================================================');
  console.log(`📊 MASTER TEST SUMMARY:`);
  console.log(`   - Payment Security Scenarios: ${secResults.passedCount}/${secResults.totalScenarios} Passed`);
  console.log(`   - Core Integration Tests:     ${intResults.passedCount}/${intResults.totalTests} Passed`);
  console.log(`   - Total Executed:             ${passed}/${total} Passed (${failed} Failed)`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
