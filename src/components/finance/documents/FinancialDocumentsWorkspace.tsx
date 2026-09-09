import React, { useEffect, useState } from 'react';
import { financialDocumentClient, type FinancialDocumentProjection } from '../../../modules/finance/financial-document-client.ts';

export function FinancialDocumentsWorkspace({ theme = 'light' }: { theme?: string }) {
  const [items, setItems] = useState<FinancialDocumentProjection[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<FinancialDocumentProjection | null>(null);
  useEffect(() => { financialDocumentClient.list().then(setItems).catch(() => setError('Não foi possível carregar documentos financeiros autorizados.')); }, []);
  const light = theme === 'light';
  return <section data-testid="financial-documents-workspace" className={`rounded-xl border p-6 ${light ? 'bg-white border-zinc-200' : 'bg-zinc-900 border-zinc-800'}`}>
    <h2 className="text-xl font-bold">Documentos Financeiros</h2>
    <p className="mt-1 text-sm text-zinc-500">Histórico oficial somente leitura. Os valores e números emitidos não são editáveis.</p>
    {error && <p role="alert" className="mt-4 text-sm text-rose-600">{error}</p>}
    <div className="mt-5 space-y-2">{items.map(document => <article key={document.id} className="flex items-center justify-between rounded-lg border p-3" data-testid={`financial-document-${document.id}`}>
      <div><strong>{document.seriesCode}/{document.sequenceNumber}</strong><span className="ml-2 text-sm text-zinc-500">{document.type} · {document.status}</span></div>
      <button type="button" onClick={() => setSelected(document)} className="rounded-md border px-3 py-1 text-sm">Visualizar</button>
    </article>)}</div>
    {selected && <aside data-testid="financial-document-preview" className="mt-5 rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800"><h3 className="font-semibold">Pré-visualização oficial</h3><p>{selected.seriesCode}/{selected.sequenceNumber} · {selected.type}</p><p className="text-xs text-zinc-500">Emissão: {new Date(selected.issuedAt).toLocaleString('pt-PT')}</p><button type="button" className="mt-3 rounded-md border px-3 py-1 text-sm">PDF privado</button></aside>}
  </section>;
}
