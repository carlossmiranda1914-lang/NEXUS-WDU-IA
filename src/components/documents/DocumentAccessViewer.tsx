import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Eye,
  Download,
  X,
  AlertCircle,
  ShieldAlert,
  Loader2,
  FileText,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCw,
} from 'lucide-react';
import type { Theme, DocumentDto } from './types.ts';
import { authorizeAccess, exchangeAccessForBlob, revokeAccess, generateIdempotencyKey } from './api.ts';
import { getTechnicalStatusPresentation, getBadgeClasses, formatByteSize } from './utils.ts';

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
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  const idempotencyKeyRef = useRef<string>(generateIdempotencyKey('access'));

  const handleRevoke = useCallback(async () => {
    if (grantId) {
      try {
        await revokeAccess(grantId, 'Sessão de visualização concluída', generateIdempotencyKey('rev-grant'));
      } catch {
        // Safe fail-closed cleanup
      }
    }
    onClose();
  }, [grantId, onClose]);

  // Escape key closes and revokes access grant
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        void handleRevoke();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleRevoke]);

  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;

    async function executeFlow() {
      if (!isOpen) return;

      setLoading(true);
      setErrorMessage(null);
      setGrantId(null);
      setObjectUrl(null);
      setZoomLevel(100);
      idempotencyKeyRef.current = generateIdempotencyKey('access');

      try {
        if (!document.currentVersion) {
          throw new Error('O documento não possui versão disponível para consulta.');
        }

        if (document.currentVersion.status === 'quarantined') {
          throw new Error('Acesso recusado: o documento está retido em quarentena.');
        }
        if (document.currentVersion.status === 'deleted') {
          throw new Error('Acesso recusado: esta versão do documento foi eliminada.');
        }

        // 1. Authorize Access
        const authRes = await authorizeAccess(
          document.id,
          document.currentVersion.id,
          action,
          idempotencyKeyRef.current,
        );

        if (!active) return;
        setGrantId(authRes.grantId);

        // 2. Exchange grant token for content stream (pass original filename)
        const preferredFilename =
          document.originalFilename || document.declaredFilename || undefined;

        const streamRes = await exchangeAccessForBlob(
          authRes.rawAccessToken,
          preferredFilename,
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

  const isImage = mimeType.startsWith('image/');
  const isPdf = mimeType === 'application/pdf';
  const techStatus = getTechnicalStatusPresentation(document.currentVersion?.status ?? document.status);
  const displayTitle = filename || document.originalFilename || document.title || 'Documento';

  const handleDownloadDirect = () => {
    if (objectUrl && filename) {
      const a = window.document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reader-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          void handleRevoke();
        }
      }}
    >
      <div
        className={`w-[96vw] h-[94vh] max-w-[1700px] max-h-[96vh] flex flex-col rounded-3xl border shadow-2xl transition-all overflow-hidden ${
          isLight
            ? 'bg-zinc-100 border-zinc-300 text-zinc-900 shadow-zinc-950/20'
            : 'bg-[#0b100d] border-emerald-950/50 text-zinc-100 shadow-2xl'
        }`}
      >
        {/* LARGE READER HEADER */}
        <header
          className={`px-6 py-3.5 border-b flex items-center justify-between gap-4 shrink-0 ${
            isLight ? 'bg-white border-zinc-200' : 'bg-[#121915] border-white/5'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`p-2.5 rounded-xl shrink-0 ${
                isLight
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              }`}
            >
              <FileText className="w-5 h-5" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 id="reader-modal-title" className="text-sm sm:text-base font-bold truncate max-w-xl">
                  {displayTitle}
                </h2>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-zinc-200/80 dark:bg-white/10 text-zinc-700 dark:text-zinc-300">
                  v{document.currentVersion?.versionNumber ?? 1}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${getBadgeClasses(
                    techStatus.tone,
                    theme,
                  )}`}
                >
                  {techStatus.label}
                </span>
              </div>
              <p className={`text-xs truncate ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                {document.category.toUpperCase()} • {formatByteSize(document.currentVersion?.byteSize ?? 0)}
              </p>
            </div>
          </div>

          {/* Reader Controls & Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Zoom Controls for Image */}
            {isImage && !loading && (
              <div
                className={`hidden sm:flex items-center rounded-xl border p-0.5 ${
                  isLight ? 'border-zinc-200 bg-zinc-50' : 'border-white/10 bg-white/5'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.max(50, z - 25))}
                  className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                  title="Diminuir Zoom"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="px-2 text-xs font-mono font-bold">{zoomLevel}%</span>
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.min(300, z + 25))}
                  className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                  title="Aumentar Zoom"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {objectUrl && (
              <button
                type="button"
                onClick={handleDownloadDirect}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer ${
                  isLight
                    ? 'bg-white border border-zinc-200 text-zinc-800 hover:bg-zinc-50'
                    : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25'
                }`}
                title="Descarregar ficheiro original"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descarregar</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => void handleRevoke()}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                isLight
                  ? 'border-zinc-200 hover:bg-zinc-100 text-zinc-600'
                  : 'border-white/10 hover:bg-white/5 text-zinc-400 hover:text-white'
              }`}
              aria-label="Fechar leitor"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* LARGE READER CANVAS BODY */}
        <div className="flex-1 overflow-hidden relative flex items-center justify-center p-2 sm:p-4">
          {loading ? (
            <div className="text-center space-y-3 p-8 animate-fadeIn">
              <Loader2 className="w-10 h-10 animate-spin text-emerald-500 mx-auto" />
              <p className="text-sm font-bold">A preparar visualização institucional...</p>
              <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                A obter fluxo seguro do documento.
              </p>
            </div>
          ) : errorMessage ? (
            <div className="max-w-md p-8 text-center space-y-4 rounded-2xl border border-red-500/20 bg-red-500/5">
              <ShieldAlert className="w-12 h-12 text-red-500 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-base font-bold text-red-600 dark:text-red-400">
                  Não foi possível abrir o documento
                </h3>
                <p className={`text-xs leading-relaxed ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>
                  {errorMessage}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleRevoke()}
                className="px-5 py-2 rounded-xl bg-zinc-800 text-white text-xs font-bold cursor-pointer hover:bg-zinc-700"
              >
                Fechar
              </button>
            </div>
          ) : isPdf && objectUrl ? (
            <div className="w-full h-full rounded-2xl overflow-hidden shadow-inner border border-black/10 dark:border-white/5 bg-zinc-800">
              <object
                data={objectUrl}
                type="application/pdf"
                className="w-full h-full"
                aria-label="Visualizador PDF do documento"
              >
                <div className="p-8 text-center space-y-4">
                  <p className="text-sm">O seu navegador não suporta visualização nativa de PDF.</p>
                  <button
                    type="button"
                    onClick={handleDownloadDirect}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold"
                  >
                    Descarregar PDF para Visualizar
                  </button>
                </div>
              </object>
            </div>
          ) : isImage && objectUrl ? (
            <div className="w-full h-full overflow-auto flex items-center justify-center p-4">
              <img
                src={objectUrl}
                alt={displayTitle}
                className="max-w-full max-h-full object-contain rounded-xl shadow-lg transition-transform duration-200"
                style={{ transform: `scale(${zoomLevel / 100})` }}
              />
            </div>
          ) : (
            <div
              className={`max-w-lg p-10 text-center space-y-5 rounded-3xl border ${
                isLight ? 'bg-white border-zinc-200 shadow-lg' : 'bg-zinc-900/90 border-white/10'
              }`}
            >
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
                <FileText className="w-8 h-8" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold break-all">{displayTitle}</h3>
                <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  Tipo: {mimeType || 'Documento institucional'} • {formatByteSize(document.currentVersion?.byteSize ?? 0)}
                </p>
                <p className={`text-xs leading-relaxed max-w-sm mx-auto pt-1 ${isLight ? 'text-zinc-600' : 'text-zinc-300'}`}>
                  Este formato de ficheiro está armazenado e governado com segurança. Descarregue para abrir na sua aplicação habitual.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadDirect}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Descarregar Ficheiro</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
