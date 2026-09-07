import { spawnSync } from 'node:child_process';
const suites=['tests/finance-obligation-financial-position.test.ts','tests/finance-adjustment-schema-postgres.test.ts','tests/finance-adjustment-postgres.test.ts','tests/finance-adjustment-concurrency-postgres.test.ts','tests/finance-allocation-postgres.test.ts','tests/finance-allocation-concurrency-postgres.test.ts'];
for(const suite of suites){const result=spawnSync(process.platform==='win32'?'npm.cmd':'npm',['exec','--','tsx',suite],{stdio:'inherit'});if(result.status!==0)process.exit(result.status??1)}
console.log('FINANCE_F5_01_AGGREGATE=PASS');
