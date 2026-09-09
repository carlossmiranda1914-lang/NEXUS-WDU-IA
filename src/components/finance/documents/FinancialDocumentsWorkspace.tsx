import React, { useEffect, useRef, useState } from 'react';
import { financialDocumentClient, type FinancialDocumentCapabilities, type FinancialDocumentDetail, type FinancialDocumentProjection, type FinancialDocumentArtifactProjection } from '../../../modules/finance/financial-document-client.ts';

export function FinancialDocumentsWorkspace({ theme = 'light' }: { theme?: string }) {
  const [items, setItems] = useState<FinancialDocumentProjection[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<FinancialDocumentProjection | null>(null);
  const [detail, setDetail] = useState<FinancialDocumentDetail | null>(null);
  const [artifacts, setArtifacts] = useState<FinancialDocumentArtifactProjection[]>([]);
  const [capabilities, setCapabilities] = useState<FinancialDocumentCapabilities>({ issue: false, correct: false });
  const correctionKeys = useRef(new Map<string, string>());
  useEffect(() => { Promise.all([financialDocumentClient.list(), financialDocumentClient.capabilities()]).then(([documents, permissions]) => { setItems(documents); setCapabilities(permissions); }).catch((loadError: unknown) => {
    const code = loadError instanceof Error ? loadError.message : '';
    setError(code === 'FINANCIAL_DOCUMENT_AUTH_REQUIRED'
      ? 'A sessão autenticada não foi reconhecida pelo servidor. Termine sessão e entre novamente na conta UAT autorizada.'
      : code === 'FINANCIAL_DOCUMENT_INSTITUTION_SELECTION_REQUIRED'
        ? 'É necessário selecionar a instituição antes de consultar documentos financeiros.'
        : code === 'FINANCIAL_DOCUMENT_FORBIDDEN'
          ? 'A sua associação institucional não possui autorização para consultar documentos financeiros.'
          : 'Não foi possível carregar documentos financeiros autorizados.');
  }); }, []);
  const light = theme === 'light';
  const generateArtifact = async () => { if (!selected) return; try { await financialDocumentClient.generateArtifact(selected.id); setArtifacts(await financialDocumentClient.listArtifacts(selected.id)); } catch { setError('Não foi possível gerar o PDF oficial. O documento emitido permanece inalterado.'); } };
  const openArtifact = async (artifact: FinancialDocumentArtifactProjection, print = false) => { try { const bytes = await financialDocumentClient.artifactContent(artifact.id); const url = URL.createObjectURL(bytes); const page = window.open(url, '_blank', 'noopener'); if (print && page) page.addEventListener('load', () => page.print(), { once: true }); } catch { setError('Não foi possível recuperar o PDF oficial autorizado.'); } };
  const createCorrection = async () => { if (!selected) return; try { const series = await financialDocumentClient.listActiveCorrectionSeries(); const selectedSeries = series[0]; if (!selectedSeries) throw new Error('Não existe uma série de notas de crédito efetiva configurada.'); const key = correctionKeys.current.get(selected.id) ?? `document-correction-${crypto.randomUUID()}`; correctionKeys.current.set(selected.id, key); await financialDocumentClient.issueCorrection({ originalDocumentId: selected.id, seriesId: selectedSeries.id, idempotencyKey: key }); setDetail(await financialDocumentClient.detail(selected.id)); setItems(await financialDocumentClient.list()); } catch (error: any) { setError(error?.message || 'Não foi possível criar a correção autorizada. Tente novamente para recuperar a operação.'); } };
  return <section data-testid="financial-documents-workspace" className={`rounded-xl border p-6 ${light ? 'bg-white border-zinc-200' : 'bg-zinc-900 border-zinc-800'}`}>
    <h2 className="text-xl font-bold">Documentos Financeiros</h2>
    <p className="mt-1 text-sm text-zinc-500">Histórico oficial somente leitura. Os valores e números emitidos não são editáveis.</p>
    {error && <p role="alert" className="mt-4 text-sm text-rose-600">{error}</p>}
    <div className="mt-5 space-y-2">{items.map(document => <article key={document.id} className="flex items-center justify-between rounded-lg border p-3" data-testid={`financial-document-${document.id}`}>
      <div><strong>{document.seriesCode}/{document.sequenceNumber}</strong><span className="ml-2 text-sm text-zinc-500">{document.type} · {document.status}</span><p className="text-xs text-zinc-500">Data de emissão: {new Date(document.issuedAt).toLocaleString('pt-PT')} · Moeda: {String(document.sourceSnapshot.currency ?? 'não registada')}</p></div>
      <button type="button" onClick={() => { setSelected(document); setDetail(null); setArtifacts([]); Promise.all([financialDocumentClient.detail(document.id), financialDocumentClient.listArtifacts(document.id)]).then(([nextDetail, nextArtifacts]) => { setDetail(nextDetail); setArtifacts(nextArtifacts); }).catch(() => setError('Não foi possível carregar a proveniência autorizada do documento.')); }} className="rounded-md border px-3 py-1 text-sm">Visualizar</button>
    </article>)}</div>
    {selected && <aside data-testid="financial-document-preview" className="mt-5 rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800"><h3 className="font-semibold">Pré-visualização oficial</h3><p>{selected.seriesCode}/{selected.sequenceNumber} · {selected.type}</p><p className="text-xs text-zinc-500">Data de emissão: {new Date(selected.issuedAt).toLocaleString('pt-PT')} · Moeda: {String(selected.sourceSnapshot.currency ?? 'não registada')}</p><h4 className="mt-3 font-semibold">Proveniência</h4><ul className="text-sm">{detail?.sources.map(source => <li key={source.id}>{source.type}: {source.id}</li>)}</ul><h4 className="mt-3 font-semibold">Correções</h4><ul className="text-sm">{detail?.corrections.map(correction => <li key={correction.id}>{correction.seriesCode}/{correction.sequenceNumber}</li>)}</ul>{capabilities.correct && <button type="button" onClick={createCorrection} className="mt-3 mr-2 rounded-md border px-3 py-1 text-sm">Criar correção autorizada</button>}{capabilities.issue && <button type="button" onClick={generateArtifact} className="mt-3 mr-2 rounded-md border px-3 py-1 text-sm">Gerar PDF oficial</button>}{artifacts.map(artifact => <React.Fragment key={artifact.id}><button type="button" onClick={() => openArtifact(artifact)} className="mt-3 mr-2 rounded-md border px-3 py-1 text-sm">Visualizar PDF · {artifact.render_version}</button><button type="button" onClick={() => openArtifact(artifact, true)} className="mt-3 mr-2 rounded-md border px-3 py-1 text-sm">Imprimir</button></React.Fragment>)}</aside>}
  </section>;
}
