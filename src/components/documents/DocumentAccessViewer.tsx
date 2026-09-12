import React, { useState, useEffect, useRef } from 'react';
import { Eye, Download, X, AlertCircle, ShieldAlert, Loader2, ShieldCheck, Lock } from 'lucide-react';
import type { Theme, DocumentDto } from './types.ts';
import { authorizeAccess, exchangeAccessForBlob, revokeAccess, generateIdempotencyKey } from './api.ts';

interface DocumentAccessViewerProps {
  isOpen: boolean;
  theme: Theme;
  document: DocumentDto;
  action: 'open' | 'download';
  onClose: () => void;
}

export default function DocumentAccessViewer({
  isOpen,
  theme,
  document,
  action,
  onClose,
}: DocumentAccessViewerProps) {
  const isLight = theme === 'light';

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [grantId, setGrantId] = useState<string | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('');
  const [filename, setFilename] = useState<string>('');

  const idempotencyKeyRef = useRef<string>(generateIdempotencyKey('access'));

  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;

    async function executeFlow() {
      if (!isOpen) return;

      setLoading(true);
      setErrorMessage(null);
      setGrantId(null);
      setObjectUrl(null);
      idempotencyKeyRef.current = generateIdempotencyKey('access');

      try {
        if (!document.currentVersion) {
          throw new Error('O documento não possui versão disponível para acesso.');
        }

        if (document.currentVersion.status === 'quarantined') {
          throw new Error('Acesso recusado: o documento está retido em quarentena.');
        }
        if (document.currentVersion.status === 'deleted') {
          throw new Error('Acesso recusado: esta versão do documento foi eliminada.');
        }

        // 1. Authorize Access (Stage 1)
        const authRes = await authorizeAccess(
          document.id,
          document.currentVersion.id,
          action,
          idempotencyKeyRef.current,
        );

        if (!active) return;
        setGrantId(authRes.grantId);

        // 2. Exchange grant token for content stream (Stage 2)
        const defaultFilename = `${document.category}_${document.id.slice(0, 8)}`;
        const streamRes = await exchangeAccessForBlob(
          authRes.rawAccessToken,
          defaultFilename,
        );

        if (!active) return;
        setMimeType(streamRes.mimeType);
        setFilename(streamRes.filename);

        createdUrl = URL.createObjectURL(streamRes.blob);
        setObjectUrl(createdUrl);

        if (action === 'download') {
          const a = window.document.createElement('a');
          a.href = createdUrl;
          a.download = streamRes.filename;
          window.document.body.appendChild(a);
          a.click();
          window.document.body.removeChild(a);
          setLoading(false);
        } else {
          setLoading(false);
        }
      } catch (err) {
        if (!active) return;
        setErrorMessage(err instanceof Error ? err.message : 'Falha ao aceder ao documento.');
        setLoading(false);
      }
    }

    void executeFlow();

    return () => {
      active = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [isOpen, document, action]);

  if (!isOpen) return null;

  const handleRevoke = async () => {
    if (!grantId) return;
    try {
      await revokeAccess(grantId, 'Sessão de visualização terminada pelo utilizador', generateIdempotencyKey('rev-grant'));
      onClose();
    } catch {
      onClose();
    }
  };

  const isImage = mimeType.startsWith('image/');
  const isPdf = mimeType === 'application/pdf';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="access-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn"
    >
      <div
        className={`w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl transition-all ${
          isLight
            ? 'bg-white border-zinc-200 text-zinc-900'
            : 'bg-zinc-900 border-white/10 text-zinc-100'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-zinc-200/50 dark:border-white/5">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-lg ${
                isLight ? 'bg-emerald-50 text-emerald-700' : 'bg-emerald-500/10 text-emerald-400'
              }`}
            >
              {action === 'open' ? <Eye className="w-5 h-5" /> : <Download className="w-5 h-5" />}
            </div>
            <div>
              <h2 id="access-modal-title" className="text-base font-bold flex items-center gap-2">
                {action === 'open' ? 'Visualizador Seguro de Documento' : 'Download Seguro de Documento'}
                <span className="text-[10px] px-2 py-0.5 rounded-md font-mono bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  STREAM SEGURO
                </span>
              </h2>
              <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                {document.category} (v{document.currentVersion?.versionNumber || 1}) • {filename || 'A carregar...'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRevoke}
              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                isLight
                  ? 'border-zinc-200 hover:bg-zinc-100 text-zinc-600'
                  : 'border-white/10 hover:bg-white/5 text-zinc-400'
              }`}
              aria-label="Fechar e revogar grant"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 p-6 overflow-y-auto min-h-[300px] flex items-center justify-center">
          {loading && (
            <div className="text-center space-y-3">
              <Loader2 className="w-10 h-10 mx-auto text-emerald-600 animate-spin" />
              <p className="text-sm font-semibold">
                A estabelecer túnel de streaming seguro e a validar autorizações...
              </p>
              <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                As credenciais de armazenamento permanecem estritamente isoladas no servidor.
              </p>
            </div>
          )}

          {errorMessage && (
            <div className="max-w-md p-5 rounded-2xl border border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-center space-y-3">
              <ShieldAlert className="w-10 h-10 mx-auto text-rose-600" />
              <div>
                <h3 className="text-sm font-bold">Acesso Bloqueado ou Falhado</h3>
                <p className="text-xs mt-1 leading-relaxed">{errorMessage}</p>
              </div>
            </div>
          )}

          {!loading && !errorMessage && objectUrl && (
            <div className="w-full h-full flex flex-col items-center justify-center">
              {action === 'download' ? (
                <div className="py-10 text-center space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                    <ShieldCheck className="w-8 h-8" />
                  </div>
                  <p className="text-base font-bold text-emerald-600">Download Concluído com Sucesso</p>
                  <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                    O ficheiro foi transferido com integridade verificada através de streaming governado.
                  </p>
                </div>
              ) : isImage ? (
                <img
                  src={objectUrl}
                  alt="Pré-visualização do Documento"
                  className="max-h-[60vh] max-w-full rounded-lg object-contain border border-zinc-200/40"
                />
              ) : isPdf ? (
                <iframe
                  src={objectUrl}
                  title="Document Preview"
                  className="w-full h-[65vh] rounded-lg border border-zinc-200/40"
                />
              ) : (
                <div className="text-center space-y-4 py-8">
                  <Lock className="w-12 h-12 mx-auto text-emerald-600" />
                  <div>
                    <p className="text-base font-bold">Conteúdo Disponível</p>
                    <p className={`text-xs mt-1 ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                      O formato ({mimeType}) requer download para visualização externa na aplicação local.
                    </p>
                  </div>
                  <a
                    href={objectUrl}
                    download={filename}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold bg-emerald-700 hover:bg-emerald-600 text-white transition-all"
                  >
                    <Download className="w-4 h-4" /> Descarregar Ficheiro
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-zinc-200/50 dark:border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] text-zinc-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Acesso temporário e rastreado por auditoria institucional</span>
          </div>
          <button
            type="button"
            onClick={handleRevoke}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-white transition-all cursor-pointer"
          >
            Fechar Visualizador
          </button>
        </div>
      </div>
    </div>
  );
}
