import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/components/EnrollmentOperationsWorkspace.tsx';
let source = await readFile(path, 'utf8');

const callAnchor = "{selected && <ProcessDrawer record={selected} light={light} onClose={() => setSelected(null)} />}";
const callReplacement = "{selected && <ProcessDrawer record={selected} light={light} onClose={() => setSelected(null)} onTransition={async (toStatus) => { await request(`/api/enrollments/${selected.id}/transitions`, { method: 'POST', body: JSON.stringify({ toStatus }) }); setSelected(null); setNotice('Estado da matrícula atualizado.'); await load(); }} />}";
if (source.includes(callAnchor)) source = source.replace(callAnchor, callReplacement);
else if (!source.includes('onTransition={async (toStatus) =>')) throw new Error('S02.2 drawer call anchor not found.');

const signatureAnchor = "function ProcessDrawer({ record, light, onClose }: { record: EnrollmentOperationalRecord; light: boolean; onClose: () => void }) {";
const signatureReplacement = "function ProcessDrawer({ record, light, onClose, onTransition }: { record: EnrollmentOperationalRecord; light: boolean; onClose: () => void; onTransition: (toStatus: EnrollmentOperationalStatus) => Promise<void> }) {";
if (source.includes(signatureAnchor)) source = source.replace(signatureAnchor, signatureReplacement);
else if (!source.includes('onTransition: (toStatus: EnrollmentOperationalStatus) => Promise<void>')) throw new Error('S02.2 drawer signature anchor not found.');

const drawerStart = source.indexOf('function ProcessDrawer(');
const drawerEnd = source.indexOf('\nfunction Detail(', drawerStart);
if (drawerStart === -1 || drawerEnd === -1) throw new Error('S02.2 process drawer bounds not found.');
const drawer = source.slice(drawerStart, drawerEnd);
const actionMarkup = '<EnrollmentLifecycleActions status={record.status} light={light} onTransition={onTransition} />';
if (!drawer.includes(actionMarkup)) {
  const detailsAnchor = '<dl className="mt-6 grid gap-4 sm:grid-cols-2">';
  const detailsIndex = drawer.indexOf(detailsAnchor);
  if (detailsIndex === -1) throw new Error('S02.2 action insertion anchor not found.');
  const updatedDrawer = drawer.slice(0, detailsIndex) + actionMarkup + drawer.slice(detailsIndex);
  source = source.slice(0, drawerStart) + updatedDrawer + source.slice(drawerEnd);
}

await writeFile(path, source, 'utf8');
console.log('[S02.2] lifecycle drawer integration ready.');
