import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('src/components/aurora/AuroraPageHeader.tsx');
assert.ok(existsSync(path), 'Aurora requires a reusable page-header primitive for material workspace surfaces');

const source = readFileSync(path, 'utf8');
assert.match(source, /title: string/, 'page header must require a textual title');
assert.match(source, /description\?: React\.ReactNode/, 'page header must support contextual explanation');
assert.match(source, /actions\?: React\.ReactNode/, 'page header must support legitimate surface actions');
assert.match(source, /--color-text-primary/, 'page header must consume the semantic text token');
assert.match(source, /--color-border-default/, 'page header must consume the semantic border token');
assert.doesNotMatch(source, /#[0-9A-Fa-f]{3,8}/, 'page header must not introduce local physical color values');

console.log('AURORA_PAGE_HEADER_CONTRACT=PASS');
