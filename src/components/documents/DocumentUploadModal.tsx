import React, { useState, useRef, useEffect } from 'react';
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
} from 'lucide-react';
import type { Theme, DocumentDto } from './types.ts';
import {
  createUploadSession,
  transferSessionBytes,
  completeUploadSession,
  generateIdempotencyKey,
  type CreateUploadSessionInput,
} from './api.ts';
import { formatByteSize, getCategoryLabel } from './utils.ts';

interface DocumentUploadModalProps {
  isOpen: boolean;
  theme: Theme;
  targetDocument?: DocumentDto | null;
  onClose: () => void;
  onSuccess: (documentId: string) => void;
}

type UploadStep =
  | 'select'
  | 'authorizing'
  | 'uploading'
  | 'completing'
  | 'content_received'
  | 'verified'
  | 'quarantined'
  | 'error';

export default function DocumentUploadModal({
  isOpen,
  theme,
  targetDocument,
  onClose,
  onSuccess,
}: DocumentUploadModalProps) {
  const isLight = theme === 'light';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [category, setCategory] = useState<string>(targetDocument?.category || 'academic');
  const [classification, setClassification] = useState<string>('internal');
  const [step, setStep] = useState<UploadStep>('select');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadedDocId, setUploadedDocId] = useState<string | null>(null);

  // Store idempotency key per upload intent
  const idempotencyKeyRef = useRef<string>(generateIdempotencyKey('upload'));

  useEffect(() => {
    if (isOpen) {
      setSelectedFile(null);
      setCategory(targetDocument?.category || 'academic');
      setClassification(targetDocument?.classification || 'internal');
      setStep('select');
      setUploadProgress(null);
      setErrorMessage(null);
      setUploadedDocId(null);
      idempotencyKeyRef.current = generateIdempotencyKey('upload');
    }
  }, [isOpen, targetDocument]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setErrorMessage(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
      setErrorMessage(null);
    }
  };

  const handleStartUpload = async () => {
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
      setStep('authorizing');

      const sessionInput: CreateUploadSessionInput = {
        documentId: targetDocument ? targetDocument.id : undefined,
        category: targetDocument ? undefined : category.trim(),
        classification: targetDocument ? undefined : (classification?.trim() || null),
        declaredFilename: selectedFile.name,
        declaredMimeType: selectedFile.type || 'application/octet-stream',
        declaredByteSize: selectedFile.size,
      };

      // 1. Authorize session
      const sessionResult = await createUploadSession(
        sessionInput,
        idempotencyKeyRef.current,
      );

      setUploadedDocId(sessionResult.documentId);

      // 2. Transfer payload — Fail-closed invariant: NO completion if byte transfer fails
      setStep('uploading');
      setUploadProgress(null);

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

      // 3. Complete session (backend handles verification and storage finalization)
      setStep('completing');

      const completeResult = await completeUploadSession(
        sessionResult.sessionId,
        sessionResult.rawToken,
        idempotencyKeyRef.current,
      );

      // Factual state evaluation - no false success
      if (completeResult.version.status === 'quarantined') {
        setStep('quarantined');
      } else if (completeResult.version.status === 'available') {
        setStep('verified');
      } else {
        // Canonical state after upload completion is 'content_received' (pending technical verification)
        setStep('content_received');
      }
    } catch (err) {
      setStep('error');
      setErrorMessage(err instanceof Error ? err.message : 'Falha ao processar upload do documento.');
    }
  };

  const isUploading =
    step === 'authorizing' || step === 'uploading' || step === 'completing';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
    >
      <div
        className={`w-full max-w-lg rounded-2xl border p-6 shadow-2xl transition-all ${
          isLight
            ? 'bg-white border-zinc-200 text-zinc-900'
            : 'bg-zinc-900 border-white/10 text-zinc-100'
        }`}
      >
        <div className="flex items-center justify-between pb-4 border-b border-zinc-200/50 dark:border-white/5">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-lg ${
                isLight ? 'bg-emerald-50 text-emerald-700' : 'bg-emerald-500/10 text-emerald-400'
              }`}
            >
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 id="upload-modal-title" className="text-lg font-bold">
                {targetDocument ? 'Carregar Nova Versão' : 'Carregar Documento'}
              </h2>
              <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                {targetDocument
                  ? `Criar versão v${targetDocument.versionCount + 1} para o documento existente`
                  : 'Ingestão institucional segura no repositório de documentos'}
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

        <div className="mt-5 space-y-4">
          {/* File Picker Area */}
          {step === 'select' && (
            <>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                  isLight
                    ? 'border-zinc-300 hover:border-emerald-600 bg-slate-50'
                    : 'border-white/10 hover:border-emerald-500 bg-zinc-950/50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <FileText className="w-10 h-10 mx-auto text-emerald-600 mb-2 opacity-80" />
                {selectedFile ? (
                  <div>
                    <p className="text-sm font-semibold truncate">{selectedFile.name}</p>
                    <p className={`text-xs mt-1 ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                      {formatByteSize(selectedFile.size)} • {selectedFile.type || 'Tipo não especificado'}
                    </p>
                    <span className="inline-block mt-2 text-xs font-semibold text-emerald-600 hover:underline">
                      Clique para alterar o ficheiro
                    </span>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-semibold">
                      Arraste o ficheiro ou clique para selecionar
                    </p>
                    <p className={`text-xs mt-1 ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                      PDF, PNG, JPG, DOCX (Tamanho gerido por política institucional)
                    </p>
                  </div>
                )}
              </div>

              {!targetDocument && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-xs font-semibold mb-1.5 ${isLight ? 'text-zinc-700' : 'text-zinc-300'}`}>
                      Categoria Documental *
                    </label>
                    <input
                      type="text"
                      list="category-suggestions"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder="Ex: academic, enrollment, administrative..."
                      className={`w-full h-11 px-3 rounded-lg border text-sm outline-none ${
                        isLight
                          ? 'bg-white border-zinc-200 text-zinc-900 focus:border-emerald-600'
                          : 'bg-zinc-800 border-white/10 text-zinc-100 focus:border-emerald-500'
                      }`}
                    />
                    <datalist id="category-suggestions">
                      <option value="academic" />
                      <option value="enrollment" />
                      <option value="identity_enrollment" />
                      <option value="administrative" />
                      <option value="administrative_financial" />
                      <option value="financial" />
                      <option value="identification" />
                      <option value="absence_justification" />
                      <option value="general" />
                    </datalist>
                  </div>

                  <div>
                    <label className={`block text-xs font-semibold mb-1.5 ${isLight ? 'text-zinc-700' : 'text-zinc-300'}`}>
                      Classificação (Opcional)
                    </label>
                    <input
                      type="text"
                      list="classification-suggestions"
                      value={classification}
                      onChange={(e) => setClassification(e.target.value)}
                      placeholder="Ex: internal, confidential, restricted..."
                      className={`w-full h-11 px-3 rounded-lg border text-sm outline-none ${
                        isLight
                          ? 'bg-white border-zinc-200 text-zinc-900 focus:border-emerald-600'
                          : 'bg-zinc-800 border-white/10 text-zinc-100 focus:border-emerald-500'
                      }`}
                    />
                    <datalist id="classification-suggestions">
                      <option value="internal" />
                      <option value="confidential" />
                      <option value="restricted" />
                      <option value="standard" />
                      <option value="public" />
                    </datalist>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Progress / State View */}
          {isUploading && (
            <div className="py-8 text-center space-y-4">
              <Loader2 className="w-10 h-10 mx-auto text-emerald-600 animate-spin" />
              <div className="space-y-1">
                <p className="text-sm font-semibold">
                  {step === 'authorizing' && 'A autorizar sessão segura de upload...'}
                  {step === 'uploading' && 'A transferir ficheiro...'}
                  {step === 'completing' && 'A validar integridade e regras de retenção...'}
                </p>
                {uploadProgress !== null ? (
                  <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                    Progresso da transferência: {uploadProgress}%
                  </p>
                ) : (
                  <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                    Em processamento...
                  </p>
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

          {/* Content Received (Verification Pending) View */}
          {step === 'content_received' && (
            <div className="py-6 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <Clock className="w-8 h-8" />
              </div>
              <div>
                <p className="text-base font-bold text-amber-600">
                  Upload concluído. Verificação técnica pendente.
                </p>
                <p className={`text-xs mt-1 ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  O conteúdo foi recebido com sucesso no repositório. O processo de verificação e auditoria técnica está em curso.
                </p>
              </div>
            </div>
          )}

          {/* Verified View */}
          {step === 'verified' && (
            <div className="py-6 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <p className="text-base font-bold text-emerald-600">
                  Documento Carregado e Verificado
                </p>
                <p className={`text-xs mt-1 ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  A integridade técnica foi validada e o documento está disponível no arquivo.
                </p>
              </div>
            </div>
          )}

          {/* Quarantined View */}
          {step === 'quarantined' && (
            <div className="py-6 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-rose-500/10 text-rose-600 flex items-center justify-center">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <div>
                <p className="text-base font-bold text-rose-600">Documento Colocado em Quarentena</p>
                <p className={`text-xs mt-1 ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  O documento não pode ser disponibilizado neste momento e requer verificação técnica adicional.
                </p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Erro no processamento:</p>
                <p className="mt-0.5 leading-relaxed">{errorMessage}</p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="mt-6 pt-4 border-t border-zinc-200/50 dark:border-white/5 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            className={`px-4 py-2.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
              isLight
                ? 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                : 'border-white/10 bg-zinc-800 text-zinc-300 hover:bg-white/5'
            } disabled:opacity-40`}
          >
            Cancelar
          </button>

          {step === 'select' && (
            <button
              type="button"
              onClick={handleStartUpload}
              disabled={!selectedFile}
              className="px-5 py-2.5 rounded-lg text-xs font-bold bg-emerald-700 hover:bg-emerald-600 text-white transition-all cursor-pointer disabled:opacity-40"
            >
              Iniciar Upload
            </button>
          )}

          {step === 'error' && (
            <button
              type="button"
              onClick={handleStartUpload}
              className="px-5 py-2.5 rounded-lg text-xs font-bold bg-emerald-700 hover:bg-emerald-600 text-white transition-all cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Tentar Novamente
            </button>
          )}

          {(step === 'quarantined' || step === 'verified' || step === 'content_received') && (
            <button
              type="button"
              onClick={() => {
                onSuccess(uploadedDocId || targetDocument?.id || '');
                onClose();
              }}
              className="px-5 py-2.5 rounded-lg text-xs font-bold bg-zinc-800 text-white hover:bg-zinc-700 transition-all cursor-pointer"
            >
              Concluir
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
