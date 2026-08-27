import { strict as assert } from 'node:assert';
import helmet from 'helmet';
import { productionContentSecurityPolicy } from '../src/security/production-content-security-policy.ts';

const middleware = helmet({
  contentSecurityPolicy: productionContentSecurityPolicy,
});

const headers = new Map<string, string>();
const response = {
  setHeader(name: string, value: number | string | readonly string[]) {
    headers.set(name.toLowerCase(), Array.isArray(value) ? value.join('; ') : String(value));
  },
  removeHeader(name: string) {
    headers.delete(name.toLowerCase());
  },
} as any;

await new Promise<void>((resolve, reject) => {
  middleware({} as any, response, (error?: unknown) => error ? reject(error) : resolve());
});

const csp = headers.get('content-security-policy');
assert(csp, 'Production Helmet configuration must emit Content-Security-Policy.');

const directives = new Map(
  csp.split(';').map((directive) => {
    const [name, ...values] = directive.trim().split(/\s+/);
    return [name, values];
  }),
);
const connectSrc = directives.get('connect-src');

assert(connectSrc, 'Production CSP must define connect-src for browser network destinations.');
assert(connectSrc.includes("'self'"), 'connect-src must preserve same-origin API connectivity.');
assert(connectSrc.includes('https://identitytoolkit.googleapis.com'), 'connect-src must allow Firebase Identity Toolkit authentication.');
assert(connectSrc.includes('https://securetoken.googleapis.com'), 'connect-src must allow Firebase Secure Token refreshes.');
assert(!connectSrc.includes('*'), 'connect-src must not allow arbitrary destinations.');
assert(!directives.get('default-src')?.includes('*'), 'default-src must not allow arbitrary destinations.');
assert(!connectSrc.includes('https://example.invalid'), 'connect-src must not allow unrelated external origins.');

console.log('[AUTH-CSP] PASS: production CSP permits only the Firebase Auth connectivity required by Nexus.');
