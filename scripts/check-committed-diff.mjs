import { execFileSync } from 'node:child_process';
const index = process.argv.indexOf('--base');
const requested = index >= 0 ? process.argv[index + 1] : null;
if (!requested || process.argv.length !== 4) throw new Error('A resolvable --base ref is required for committed diff checking.');
try { execFileSync('git', ['rev-parse', '--verify', `${requested}^{commit}`], { stdio: 'ignore' }); } catch { throw new Error('Committed diff base is missing or unresolvable.'); }
try { execFileSync('git', ['merge-base', '--is-ancestor', requested, 'HEAD'], { stdio: 'ignore' }); } catch { throw new Error('Committed diff base is not an ancestor of HEAD.'); }
try { execFileSync('git', ['diff', '--check', `${requested}...HEAD`], { stdio: 'inherit' }); } catch { process.exit(1); }
console.log('committed-diff: PASS.');
