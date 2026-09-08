import { spawnSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
const envTestLocal=path.resolve(process.cwd(),'.env.test.local');
if(existsSync(envTestLocal))dotenv.config({path:envTestLocal,override:true});
const suites=['tests/finance-obligation-financial-position.test.ts','tests/finance-adjustment-schema-postgres.test.ts','tests/finance-adjustment-postgres.test.ts','tests/finance-adjustment-concurrency-postgres.test.ts','tests/finance-allocation-postgres.test.ts','tests/finance-allocation-concurrency-postgres.test.ts','tests/finance-adjustment-http-postgres.test.ts','tests/finance-adjustment-client.test.ts','tests/finance-adjustment-ui.test.ts'];
const i=process.argv.indexOf('--result-file'), resultFile=i<0?null:process.argv[i+1]; if(i>=0&&!resultFile)throw new Error('--result-file requires a path'); const publish=result=>{if(resultFile)writeFileSync(resultFile,`${JSON.stringify(result)}\n`)};
for(const suite of suites){const result=spawnSync('npx',['tsx',suite],{stdio:'inherit',shell:process.platform==='win32',env:process.env});if(result.status!==0){publish({status:'FAIL',suite,exitCode:result.status??1,suitesTotal:suites.length});console.error(`\n[FINANCE-F5-ADJUSTMENT] Suite failed on ${suite}`);process.exit(result.status??1)}}
console.log('FINANCE_F5_01_AGGREGATE=PASS');
publish({status:'PASS',exitCode:0,suitesTotal:suites.length,suitesPass:suites.length,suitesFail:0});
