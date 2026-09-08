import { spawnSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

const envTestLocal = path.resolve(process.cwd(), '.env.test.local');
if (existsSync(envTestLocal)) {
  dotenv.config({ path: envTestLocal, override: true });
}

const files = [
  'tests/finance-payment-model.test.ts',
  'tests/finance-payment-schema-postgres.test.ts',
  'tests/finance-payment-postgres.test.ts',
  'tests/finance-payment-concurrency-postgres.test.ts',
  'tests/finance-payment-provider-config-postgres.test.ts',
  'tests/finance-payment-http.test.ts',
  'tests/finance-payment-emis-contract.test.ts',
  'tests/finance-payment-adyen-adapter.test.ts',
  'tests/finance-payment-adyen-webhook-postgres.test.ts',
  'tests/finance-payment-webhook-http.test.ts',
  'tests/finance-payment-secret-resolver.test.ts',
  'tests/finance-payment-client.test.ts',
  'tests/finance-payment-ui.test.ts',
  'tests/finance-payment-runtime-parity.test.ts',
];
const resultIndex=process.argv.indexOf('--result-file');const resultFile=resultIndex<0?null:process.argv[resultIndex+1];if(resultIndex>=0&&!resultFile)throw new Error('--result-file requires a path');const publish=result=>{if(resultFile)writeFileSync(resultFile,`${JSON.stringify(result)}\n`);};

for (const file of files) {
  const result = spawnSync('npx', ['tsx', file], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  });
  if (result.status !== 0) {
    publish({status:'FAIL',suite:file,exitCode:result.status??1,suitesTotal:files.length});
    process.exit(result.status ?? 1);
  }
}

console.log('\n[FINANCE-F3-01] All Payment Core & Provider Adapter Foundation tests passed successfully.');
publish({status:'PASS',exitCode:0,suitesTotal:files.length,suitesPass:files.length,suitesFail:0});
