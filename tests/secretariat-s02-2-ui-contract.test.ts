import { readFile } from 'node:fs/promises';

const workspace = await readFile('src/components/EnrollmentOperationsWorkspace.tsx', 'utf8');
const actions = await readFile('src/components/EnrollmentLifecycleActions.tsx', 'utf8');
const failures: string[] = [];

if (!workspace.includes('EnrollmentLifecycleActions')) failures.push('workspace must render lifecycle actions');
if (!workspace.includes('onTransition={async (toStatus) =>')) failures.push('workspace must wire lifecycle callback');
if (!workspace.includes("setNotice('Estado da matrícula atualizado.')")) failures.push('workspace must refresh user feedback');
if (!actions.includes("allowedOperationalTransitions('secretariat', status)")) failures.push('actions must derive from policy model');
if (!actions.includes("target !== 'active'")) failures.push('secretariat actions must exclude activation');
if (!actions.includes('Administração ou Direção')) failures.push('validated state must explain activation authority');
if (actions.includes('>Ativar<')) failures.push('secretariat UI must not expose activation button');

if (failures.length) throw new Error(failures.join('\n'));
console.log('Secretariat S02.2 UI contract passed (7 assertions).');
