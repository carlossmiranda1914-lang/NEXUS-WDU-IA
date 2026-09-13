import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Upload,
  X,
  FileText,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
  Loader2,
  RefreshCw,
  Clock,
  ShieldCheck,
  FileCheck,
  Tag,
  Layers,
  ArrowRight,
} from 'lucide-react';
import type { Theme, DocumentDto, DocumentOperationalAvailability, DocumentTaxonomyDto } from './types.ts';
import {
  createUploadSession,
  transferSessionBytes,
  completeUploadSession,
  fetchDocumentDetail,
  generateIdempotencyKey,
  fetchDocumentTaxonomy,
  type CreateUploadSessionInput,
} from './api.ts';
import { formatByteSize, getCategoryLabel, getClassificationLabel } from './utils.ts';

interface DocumentUploadModalProps {
  isOpen: boolean;
  theme: Theme;
  targetDocument?: DocumentDto | null;
  operationalAvailability?: DocumentOperationalAvailability;
  onClose: () => void;
  onSuccess: (documentId: string) => void;
}

type UploadStage =
  | 'select'
  | 'authorizing'
  | 'uploading'
  | 'completing'
  | 'verifying'
  | 'verified'
  | 'quarantined'
  | 'error';

export default function DocumentUploadModal({
  isOpen,
  theme,
  targetDocument,
  operationalAvailability,
  onClose,
  onSuccess,
}: DocumentUploadModalProps) {
  const isLight = theme === 'light';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [category, setCategory] = useState<string>(targetDocument?.category || 'academic');
  const [classification, setClassification] = useState<string>('internal');
  const [taxonomy, setTaxonomy] = useState<DocumentTaxonomyDto | null>(null);
  const [stage, setStage] = useState<UploadStage>('select');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadedDocId, setUploadedDocId] = useState<string | null>(null);

  const idempotencyKeyRef = useRef<string>(generateIdempotencyKey('upload'));
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Escape key closes modal (only when not actively uploading)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const isBusy = stage === 'authorizing' || stage === 'uploading' || stage === 'completing';
      if (e.key === 'Escape' && isOpen && !isBusy) {
        onClose();
      }
    },
    [isOpen, stage, onClose],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (isOpen) {
      setSelectedFile(null);
      setCategory(targetDocument?.category || 'academic');
      setClassification(targetDocument?.classification || 'internal');
      setStage('select');
      setUploadProgress(null);
      setErrorMessage(null);
      setUploadedDocId(null);
      idempotencyKeyRef.current = generateIdempotencyKey('upload');

      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }

      void fetchDocumentTaxonomy()
        .then((tax) => {
          setTaxonomy(tax);
          if (!targetDocument && tax.categories.length > 0) {
            setCategory((prev) => prev || tax.categories[0].id);
          }
        })
        .catch(() => {
          // Graceful fallback
        });
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [isOpen, targetDocument]);

  const isUploadUnavailable =
    operationalAvailability?.canUpload === false ||
    taxonomy?.operationalAvailability?.canUpload === false;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isUploadUnavailable) return;
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setErrorMessage(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (isUploadUnavailable) return;
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
      setErrorMessage(null);
    }
  };

  const pollVerificationStatus = (docId: string) => {
    let attempts = 0;
    const maxAttempts = 15; // Poll up to 22.5s

    pollIntervalRef.current = setInterval(async () => {
      attempts++;
      try {
        const detail = await fetchDocumentDetail(docId);
        const versionStatus = detail.currentVersion?.status;

        if (versionStatus === 'available') {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setStage('verified');
        } else if (versionStatus === 'quarantined') {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setStage('quarantined');
        } else if (attempts >= maxAttempts) {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          // Keep in verifying stage with option to finish
        }
      } catch {
        // Continue polling silently
        if (attempts >= maxAttempts && pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
      }
    }, 1500);
  };

  const handleStartUpload = async () => {
    if (isUploadUnavailable) {
      setErrorMessage('Carregamento documental ainda não está configurado nesta instalação.');
      return;
    }
    if (!selectedFile) {
      setErrorMessage('Por favor selecione um ficheiro.');
      return;
    }

    if (!targetDocument && (!category || category.trim().length < 2 || category.trim().length > 64)) {
      setErrorMessage('A categoria documental é obrigatória (entre 2 e 64 caracteres).');
      return;
    }

    try {
      setErrorMessage(null);
      setStage('authorizing');

      const sessionInput: CreateUploadSessionInput = {
        documentId: targetDocument ? targetDocument.id : undefined,
        category: targetDocument ? undefined : category.trim(),
        classification: targetDocument ? undefined : classification?.trim() || null,
        declaredFilename: selectedFile.name,
        declaredMimeType: selectedFile.type || 'application/octet-stream',
        declaredByteSize: selectedFile.size,
      };

      // 1. Authorize session
      const sessionResult = await createUploadSession(sessionInput, idempotencyKeyRef.current);
      const docId = sessionResult.documentId;
      setUploadedDocId(docId);

      // 2. Transfer payload
      setStage('uploading');
      setUploadProgress(0);

      await transferSessionBytes(
        sessionResult.sessionId,
        sessionResult.rawToken,
        selectedFile,
        undefined,
        (loaded, total) => {
          if (total > 0) {
            setUploadProgress(Math.round((loaded / total) * 100));
          }
        },
      );

      // 3. Complete session
      setStage('completing');

      const completeResult = await completeUploadSession(
        sessionResult.sessionId,
        sessionResult.rawToken,
        idempotencyKeyRef.current,
      );

      // 4. Evaluate outcome / start autonomous verification polling
      if (completeResult.version.status === 'quarantined') {
        setStage('quarantined');
      } else if (completeResult.version.status === 'available') {
        setStage('verified');
      } else {
        setStage('verifying');
        pollVerificationStatus(docId);
      }
    } catch (err) {
      setStage('error');
      setErrorMessage(err instanceof Error ? err.message : 'Falha ao processar upload do documento.');
    }
  };

  const isUploading = stage === 'authorizing' || stage === 'uploading' || stage === 'completing';

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isUploading) {
          onClose();
        }
      }}
    >
      <div
        className={`w-full max-w-xl rounded-2xl border p-6 shadow-2xl transition-all ${
          isLight ? 'bg-white border-zinc-200 text-zinc-900' : 'bg-zinc-900 border-white/10 text-zinc-100'
        }`}
      >
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-200/60 dark:border-white/5">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl ${
                isLight ? 'bg-emerald-50 text-emerald-700' : 'bg-emerald-500/10 text-emerald-400'
              }`}
            >
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 id="upload-modal-title" className="text-base font-bold">
                {targetDocument ? 'Carregar Nova Versão' : 'Carregar Documento'}
              </h2>
              <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                {targetDocument
                  ? `Criar versão v${targetDocument.versionCount + 1} para DOC-${targetDocument.id.slice(0, 8).toUpperCase()}`
                  : 'Ingestão institucional segura com integridade criptográfica'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
              isLight
                ? 'border-zinc-200 hover:bg-zinc-100 text-zinc-600'
                : 'border-white/10 hover:bg-white/5 text-zinc-400'
            } disabled:opacity-40`}
            aria-label="Fechar modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="mt-5 space-y-4">
          {isUploadUnavailable && (
            <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Aviso de Configuração:</p>
                <p className="mt-0.5 leading-relaxed">
                  Carregamento documental ainda não está configurado nesta instalação.
                </p>
              </div>
            </div>
          )}

          {/* Step 1 & 2: Selection & Metadata */}
          {stage === 'select' && (
            <>
              {/* Drag-and-drop file target area */}
              <div
                onDragOver={(e) => !isUploadUnavailable && e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => !isUploadUnavailable && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-7 text-center transition-all ${
                  isUploadUnavailable
                    ? 'border-zinc-300/40 bg-zinc-100/40 dark:bg-zinc-900/40 opacity-60 cursor-not-allowed'
                    : isLight
                    ? 'border-zinc-300 hover:border-emerald-600 bg-slate-50/70 cursor-pointer'
                    : 'border-white/10 hover:border-emerald-500 bg-zinc-950/40 cursor-pointer'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  disabled={isUploadUnavailable}
                  onChange={handleFileChange}
                  className="hidden"
                />
                <FileText className="w-10 h-10 mx-auto text-emerald-600 mb-2.5 opacity-80" />
                {selectedFile ? (
                  <div className="space-y-1">
                    <p className="text-sm font-bold truncate max-w-sm mx-auto text-zinc-900 dark:text-zinc-100">
                      {selectedFile.name}
                    </p>
                    <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                      {formatByteSize(selectedFile.size)} • {selectedFile.type || 'Tipo não especificado'}
                    </p>
                    <span className="inline-block mt-2 text-xs font-semibold text-emerald-600 hover:underline">
                      Clique para alterar o ficheiro
                    </span>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                      Arraste o ficheiro ou clique para selecionar
                    </p>
                    <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                      Formatos suportados: PDF, PNG, JPG, DOCX (Verificação automática de integridade)
                    </p>
                  </div>
                )}
              </div>

              {/* Classification Controls */}
              {!targetDocument && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                  <div>
                    <label className={`block text-xs font-semibold mb-1.5 ${isLight ? 'text-zinc-700' : 'text-zinc-300'}`}>
                      Categoria institucional *
                    </label>
                    {taxonomy && taxonomy.categories.length > 0 ? (
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className={`w-full h-11 px-3 rounded-xl border text-xs outline-none cursor-pointer ${
                          isLight
                            ? 'bg-slate-50 border-zinc-200 text-zinc-900 focus:bg-white focus:border-emerald-600'
                            : 'bg-zinc-950 border-white/10 text-zinc-100 focus:border-emerald-500'
                        }`}
                      >
                        {taxonomy.categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {getCategoryLabel(cat.id)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        placeholder="Ex: Académico, Administrativo..."
                        className={`w-full h-11 px-3 rounded-xl border text-xs outline-none ${
                          isLight
                            ? 'bg-slate-50 border-zinc-200 text-zinc-900 focus:border-emerald-600'
                            : 'bg-zinc-950 border-white/10 text-zinc-100 focus:border-emerald-500'
                        }`}
                      />
                    )}
                  </div>

                  <div>
                    <label className={`block text-xs font-semibold mb-1.5 ${isLight ? 'text-zinc-700' : 'text-zinc-300'}`}>
                      Classificação de Acesso
                    </label>
                    {taxonomy && taxonomy.classifications.length > 0 ? (
                      <select
                        value={classification}
                        onChange={(e) => setClassification(e.target.value)}
                        className={`w-full h-11 px-3 rounded-xl border text-xs outline-none cursor-pointer ${
                          isLight
                            ? 'bg-slate-50 border-zinc-200 text-zinc-900 focus:bg-white focus:border-emerald-600'
                            : 'bg-zinc-950 border-white/10 text-zinc-100 focus:border-emerald-500'
                        }`}
                      >
                        {taxonomy.classifications.map((cls) => (
                          <option key={cls.id} value={cls.id}>
                            {getClassificationLabel(cls.id)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={classification}
                        onChange={(e) => setClassification(e.target.value)}
                        placeholder="Ex: Uso interno, Confidencial..."
                        className={`w-full h-11 px-3 rounded-xl border text-xs outline-none ${
                          isLight
                            ? 'bg-slate-50 border-zinc-200 text-zinc-900 focus:border-emerald-600'
                            : 'bg-zinc-950 border-white/10 text-zinc-100 focus:border-emerald-500'
                        }`}
                      />
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Active Uploading Stage */}
          {isUploading && (
            <div className="py-8 text-center space-y-4">
              <Loader2 className="w-10 h-10 mx-auto text-emerald-600 animate-spin" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                  {stage === 'authorizing' && 'A autorizar sessão segura de upload...'}
                  {stage === 'uploading' && 'A transferir ficheiro...'}
                  {stage === 'completing' && 'A validar integridade e regras de retenção...'}
                </p>
                {uploadProgress !== null ? (
                  <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                    Progresso da transferência: {uploadProgress}%
                  </p>
                ) : (
                  <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>Em processamento...</p>
                )}
              </div>
              {uploadProgress !== null && (
                <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-2 rounded-full overflow-hidden max-w-xs mx-auto">
                  <div
                    className="bg-emerald-600 h-full transition-all duration-300 rounded-full"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Verifying Stage (Post-upload reconciliation) */}
          {stage === 'verifying' && (
            <div className="py-7 text-center space-y-3.5">
              <div className="w-12 h-12 mx-auto rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <Clock className="w-7 h-7 animate-pulse" />
              </div>
              <div className="space-y-1">
                <p className="text-base font-bold text-amber-600 dark:text-amber-400">
                  Documento recebido. Verificação de segurança em curso.
                </p>
                <p className={`text-xs max-w-md mx-auto leading-relaxed ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  O conteúdo físico foi transferido com sucesso. Os motores de análise técnica, antivírus e integridade criptográfica estão em execução autónoma.
                </p>
              </div>
            </div>
          )}

          {/* Verified Stage */}
          {stage === 'verified' && (
            <div className="py-7 text-center space-y-3.5">
              <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                  Documento verificado e disponível.
                </p>
                <p className={`text-xs max-w-md mx-auto leading-relaxed ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  A integridade técnica foi validada e o documento está disponível no arquivo institucional com rastreabilidade garantida.
                </p>
              </div>
            </div>
          )}

          {/* Quarantined Stage */}
          {stage === 'quarantined' && (
            <div className="py-7 text-center space-y-3.5">
              <div className="w-12 h-12 mx-auto rounded-full bg-rose-500/10 text-rose-600 flex items-center justify-center">
                <ShieldAlert className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <p className="text-base font-bold text-rose-600 dark:text-rose-400">
                  Documento colocado em quarentena.
                </p>
                <p className={`text-xs max-w-md mx-auto leading-relaxed ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  O documento foi isolado para proteção institucional e não está acessível no circuito ativo.
                </p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Erro no processamento:</p>
                <p className="mt-0.5 leading-relaxed">{errorMessage}</p>
              </div>
            </div>
          )}
        </div>

        {/* MODAL ACTIONS */}
        <div className="mt-6 pt-4 border-t border-zinc-200/60 dark:border-white/5 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              isLight
                ? 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                : 'border-white/10 bg-zinc-800 text-zinc-300 hover:bg-white/5'
            } disabled:opacity-40`}
          >
            Cancelar
          </button>

          {stage === 'select' && (
            <button
              type="button"
              onClick={handleStartUpload}
              disabled={!selectedFile || isUploadUnavailable}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <span>Carregar documento</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {stage === 'error' && (
            <button
              type="button"
              onClick={handleStartUpload}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Tentar Novamente
            </button>
          )}

          {(stage === 'quarantined' || stage === 'verified' || stage === 'verifying') && (
            <button
              type="button"
              onClick={() => {
                onSuccess(uploadedDocId || targetDocument?.id || '');
                onClose();
              }}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-zinc-800 text-white hover:bg-zinc-700 transition-all cursor-pointer"
            >
              Concluir
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
