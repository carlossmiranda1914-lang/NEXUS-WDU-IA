import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const path = resolve(process.cwd(), 'src/components/EnrollmentOperationsWorkspace.tsx');
const rawSource = await readFile(path, 'utf8');
const originalEol = rawSource.includes('\r\n') ? '\r\n' : '\n';
let source = rawSource.replace(/\r\n/g, '\n');

function replaceOnce(label: string, pattern: string, replacement: string) {
  const before = source;
  source = source.replace(pattern, replacement);
  if (source === before) {
    throw new Error(`[ENROLLMENT-VNEXT] ${label}: expected component pattern was not found. No partial patch was written.`);
  }
}

replaceOnce(
  'ReactNode type import',
  "import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';",
  "import { FormEvent, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';",
);

replaceOnce(
  'attention ProcessRow key handling',
  "{attention.slice(0, 8).map((record) => <ProcessRow key={record.id} record={record} light={light} onOpen={() => setSelected(record)} />)}",
  "{attention.slice(0, 8).map((record) => <li key={record.id}><ProcessRow record={record} light={light} onOpen={() => setSelected(record)} /></li>)}",
);

replaceOnce(
  'visible ProcessRow key handling',
  "{visible.map((record) => <ProcessRow key={record.id} record={record} light={light} onOpen={() => setSelected(record)} />)}",
  "{visible.map((record) => <li key={record.id}><ProcessRow record={record} light={light} onOpen={() => setSelected(record)} /></li>)}",
);

replaceOnce(
  'ProcessRow list item ownership',
  "function ProcessRow({ record, light, onOpen }: { record: EnrollmentOperationalRecord; light: boolean; onOpen: () => void }) {\n  return <li><button type=\"button\" onClick={onOpen}",
  "function ProcessRow({ record, light, onOpen }: { record: EnrollmentOperationalRecord; light: boolean; onOpen: () => void }) {\n  return <button type=\"button\" onClick={onOpen}",
);

replaceOnce(
  'ProcessRow closing list item',
  "<ChevronRight className=\"h-4 w-4\" /></div></button></li>;\n}",
  "<ChevronRight className=\"h-4 w-4\" /></div></button>;\n}",
);

replaceOnce(
  'OperationalNote ReactNode type',
  "function OperationalNote({ icon, title, body, light }: { icon: React.ReactNode; title: string; body: string; light: boolean }) {",
  "function OperationalNote({ icon, title, body, light }: { icon: ReactNode; title: string; body: string; light: boolean }) {",
);

if (source.includes('<ProcessRow key=')) {
  throw new Error('[ENROLLMENT-VNEXT] component key must be owned by the surrounding list item.');
}
if (source.includes('React.ReactNode')) {
  throw new Error('[ENROLLMENT-VNEXT] React namespace type reference remained after patch.');
}

const output = originalEol === '\r\n' ? source.replace(/\n/g, '\r\n') : source;
await writeFile(path, output, 'utf8');
console.log('[ENROLLMENT-VNEXT] PASS: Layer 1 TypeScript fixes applied through asserted component patterns.');
