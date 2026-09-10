import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workspace = readFileSync(resolve('src/components/finance/FinanceWorkspace.tsx'), 'utf8');

assert.match(workspace, /aria-label="Navegação de Finanças e Contas"/, 'Finance must expose a named workspace navigation landmark');
assert.match(workspace, /Visão Geral[\s\S]*Situação Financeira/, 'overview must remain a hierarchy, not an unnamed peer tab');
assert.match(workspace, /Operação[\s\S]*Recebimentos[\s\S]*Documentos/, 'operational destinations must remain grouped');
assert.match(workspace, /Configuração[\s\S]*Emolumentos[\s\S]*Configuração Financeira/, 'configuration destinations must remain grouped');
assert.match(workspace, /aria-current/, 'the current destination must be explicit to assistive technology');
assert.doesNotMatch(workspace, /flex flex-wrap items-center gap-x-4/, 'Aurora workspace navigation must not remain a horizontal peer strip');
assert.match(workspace, /md:grid-cols-\[15rem_minmax\(0,1fr\)\]/, 'desktop workspace must reserve little space for hierarchy and most space for work');

console.log('FINANCE_AURORA_WORKSPACE_NAVIGATION=PASS');
