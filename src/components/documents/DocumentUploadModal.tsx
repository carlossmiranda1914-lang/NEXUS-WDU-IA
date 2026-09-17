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
  ArrowLeft,
  Search,
  User,
  GraduationCap,
  Sparkles,
  Shield,
} from 'lucide-react';
import type {
  Theme,
  DocumentDto,
  DocumentOperationalAvailability,
  DocumentTaxonomyDto,
  AssociationTarget,
} from './types.ts';
import {
  createUploadSession,
  transferSessionBytes,
  completeUploadSession,
  fetchDocumentDetail,
  generateIdempotencyKey,
  fetchDocumentTaxonomy,
  searchAssociationTargets,
  createDocumentAssociation,
  type CreateUploadSessionInput,
} from './api.ts';
import {
  formatByteSize,
  getCategoryLabel,
  getClassificationLabel,
} from './utils.ts';

interface DocumentUploadModalProps {
  isOpen: boolean;
  theme: Theme;
  targetDocument?: DocumentDto | null;
  operationalAvailability?: DocumentOperationalAvailability;
  onClose: () => void;
  onSuccess: (documentId: string) => void;
}

type StepIndex = 1 | 2 | 3 | 4 | 5;

type UploadExecutionStage =
  | 'idle'
  | 'authorizing'
  | 'uploading'
  | 'completing'
  | 'associating'
  | 'verifying'
  | 'verified'
  | 'quarantined'
  | 'verification_pending_timeout'
  | 'verification_status_unavailable'
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

  const [step, setStep] = useState<StepIndex>(1);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [category, setCategory] = useState<string>(targetDocument?.category || 'academic');
  const [classification, setClassification] = useState<string>(targetDocument?.classification || 'internal');
  const [taxonomy, setTaxonomy] = useState<DocumentTaxonomyDto | null>(null);

  // Step 3: Association
  const [associationDomain, setAssociationDomain] = useState<'enrollment' | 'academic'>('enrollment');
  const [associationSearch, setAssociationSearch] = useState('');
  const [associationTargets, setAssociationTargets] = useState<AssociationTarget[]>([]);
  const [loadingTargets, setLoadingTargets] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<AssociationTarget | null>(null);
  const [associationPurpose, setAssociationPurpose] = useState('Identificação institucional');
  const [associationWarning, setAssociationWarning] = useState<string | null>(null);

  // Step 5: Execution
  const [executionStage, setExecutionStage] = useState<UploadExecutionStage>('idle');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadedDocId, setUploadedDocId] = useState<string | null>(null);

  const idempotencyKeyRef = useRef<string>(generateIdempotencyKey('upload'));
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Prevent escape when actively transferring/processing
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const isBusy =
        executionStage === 'authorizing' ||
        executionStage === 'uploading' ||
        executionStage === 'completing' ||
        executionStage === 'associating';
      if (e.key === 'Escape' && isOpen && !isBusy) {
        onClose();
      }
    },
    [isOpen, executionStage, onClose],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSelectedFile(null);
      setCategory(targetDocument?.category || 'academic');
      setClassification(targetDocument?.classification || 'internal');
      setSelectedTarget(null);
      setAssociationSearch('');
      setAssociationPurpose('Identificação institucional');
      setAssociationWarning(null);
      setExecutionStage('idle');
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
        .catch(() => undefined);
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [isOpen, targetDocument]);

  // Search association targets on query or domain change
  useEffect(() => {
    if (step !== 3) return;

    let active = true;
    setLoadingTargets(true);

    const timer = setTimeout(() => {
      searchAssociationTargets(associationDomain, associationSearch)
        .then((targets) => {
          if (active) {
            setAssociationTargets(targets);
            setLoadingTargets(false);
          }
        })
        .catch(() => {
          if (active) {
            setAssociationTargets([]);
            setLoadingTargets(false);
          }
        });
    }, 200);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [step, associationDomain, associationSearch]);

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
    const maxAttempts = 20;
    let consecutiveErrors = 0;

    pollIntervalRef.current = setInterval(async () => {
      attempts++;
      try {
        const detail = await fetchDocumentDetail(docId);
        consecutiveErrors = 0;
        const versionStatus = detail.currentVersion?.status;

        if (versionStatus === 'available') {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setExecutionStage('verified');
        } else if (versionStatus === 'quarantined') {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setExecutionStage('quarantined');
        } else if (attempts >= maxAttempts) {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          // Do NOT claim verified if backend has not confirmed available
          setExecutionStage('verification_pending_timeout');
        }
      } catch (err) {
        consecutiveErrors++;
        if (consecutiveErrors >= 3 || attempts >= maxAttempts) {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setExecutionStage('verification_status_unavailable');
        }
      }
    }, 1200);
  };

  const executeUploadWorkflow = async () => {
    if (!selectedFile) return;

    setStep(5);
    setExecutionStage('authorizing');
    setErrorMessage(null);
    setAssociationWarning(null);
    setUploadProgress(0);

    try {
      // 1. Create Upload Session
      const sessionInput: CreateUploadSessionInput = {
        declaredFilename: selectedFile.name,
        declaredMimeType: selectedFile.type || 'application/octet-stream',
        declaredByteSize: selectedFile.size,
        category,
        classification,
        documentId: targetDocument?.id,
      };

      const sessionResponse = await createUploadSession(sessionInput, idempotencyKeyRef.current);
      const { session, rawToken } = sessionResponse;

      // 2. Transfer Bytes
      setExecutionStage('uploading');
      await transferSessionBytes(session.id, rawToken, selectedFile, undefined, (loaded, total) => {
        if (total > 0) {
          setUploadProgress(Math.round((loaded / total) * 100));
        }
      });

      // 3. Complete Session
      setExecutionStage('completing');
      const completeRes = await completeUploadSession(
        session.id,
        rawToken,
        generateIdempotencyKey('comp'),
      );

      const docId = session.documentId;
      setUploadedDocId(docId);

      // 4. Create Association if selected
      if (selectedTarget) {
        setExecutionStage('associating');
        try {
          await createDocumentAssociation(
            docId,
            {
              targetDomain: selectedTarget.domain,
              targetResourceType: selectedTarget.resourceType,
              targetResourceId: selectedTarget.id,
              purpose: associationPurpose || 'Documentação institucional',
              pinnedVersionId: completeRes.versionId || null,
            },
            generateIdempotencyKey('assoc'),
          );
        } catch (assocErr) {
          console.warn('[UPLOAD-ASSOCIATION] Association error:', assocErr);
          setAssociationWarning('Documento carregado, mas não foi possível concluir a associação selecionada.');
        }
      }

      // 5. Verification Progression
      setExecutionStage('verifying');
      pollVerificationStatus(docId);
    } catch (err) {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      setExecutionStage('error');
      setErrorMessage(
        err instanceof Error ? err.message : 'Falha ao processar o carregamento do documento.',
      );
    }
  };

  if (!isOpen) return null;

  const isNewVersion = Boolean(targetDocument);

  const stepsList = [
    { num: 1, label: 'Documento' },
    { num: 2, label: 'Classificação' },
    { num: 3, label: 'Associação' },
    { num: 4, label: 'Confirmação' },
    { num: 5, label: 'Verificação' },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget && executionStage !== 'uploading' && executionStage !== 'completing') {
          onClose();
        }
      }}
    >
      <div
        className={`w-full max-w-3xl max-h-[92vh] flex flex-col rounded-3xl border shadow-2xl transition-all overflow-hidden ${
          isLight
            ? 'bg-white border-zinc-200/90 text-zinc-900 shadow-zinc-900/15'
            : 'bg-[#0e1411] border-emerald-950/40 text-zinc-100 shadow-2xl'
        }`}
      >
        {/* MODAL HEADER */}
        <div
          className={`px-6 py-4 border-b flex items-center justify-between shrink-0 ${
            isLight ? 'border-zinc-200/80 bg-zinc-50/70' : 'border-white/5 bg-white/[0.02]'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-xl shrink-0 ${
                isLight
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              }`}
            >
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 id="upload-modal-title" className="text-base font-bold tracking-tight">
                {isNewVersion
                  ? `Carregar Nova Versão (v${(targetDocument?.currentVersion?.versionNumber || 1) + 1})`
                  : 'Carregar Documento Institucional'}
              </h2>
              <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                Fluxo institucional governado de ingestão documental
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={executionStage === 'uploading' || executionStage === 'completing'}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${
              isLight
                ? 'border-zinc-200 hover:bg-zinc-100 text-zinc-600'
                : 'border-white/10 hover:bg-white/5 text-zinc-400 hover:text-white'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
            aria-label="Fechar modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* STEPPER PROGRESS HEADER */}
        <div
          className={`px-6 py-3 border-b flex items-center justify-between gap-2 overflow-x-auto ${
            isLight ? 'border-zinc-200/70 bg-zinc-100/40' : 'border-white/5 bg-black/20'
          }`}
        >
          {stepsList.map((s, idx) => {
            const isCompleted = step > s.num || executionStage === 'verified';
            const isCurrent = step === s.num && executionStage !== 'verified';
            return (
              <div key={s.num} className="flex items-center gap-2 shrink-0">
                <div
                  className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold transition-all ${
                    isCurrent
                      ? isLight
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-emerald-500 text-zinc-950 font-extrabold shadow-sm'
                      : isCompleted
                      ? isLight
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40'
                      : isLight
                      ? 'bg-zinc-200/60 text-zinc-500'
                      : 'bg-white/5 text-zinc-500'
                  }`}
                >
                  <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px]">
                    {isCompleted ? '✓' : s.num}
                  </span>
                  <span>{s.label}</span>
                </div>
                {idx < stepsList.length - 1 && (
                  <span className={`text-xs ${isLight ? 'text-zinc-300' : 'text-zinc-700'}`}>•</span>
                )}
              </div>
            );
          })}
        </div>

        {/* MODAL BODY */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* STEP 1: DOCUMENTO (FILE SELECTION) */}
          {step === 1 && (
            <div className="space-y-5 animate-fadeIn">
              <div className="space-y-1">
                <h3 className="text-sm font-bold">1. Selecione o ficheiro do documento</h3>
                <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  São suportados ficheiros PDF, imagens (PNG, JPEG, WebP) e documentos Office até 50 MB.
                </p>
              </div>

              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3.5 ${
                  selectedFile
                    ? isLight
                      ? 'border-emerald-500 bg-emerald-50/40'
                      : 'border-emerald-500/60 bg-emerald-950/15'
                    : isLight
                    ? 'border-zinc-300 hover:border-emerald-500 hover:bg-zinc-50/80 bg-zinc-50/40'
                    : 'border-zinc-700/80 hover:border-emerald-500/60 hover:bg-emerald-950/10 bg-zinc-900/30'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileChange}
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx"
                />

                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ${
                    selectedFile
                      ? 'bg-emerald-600 text-white'
                      : isLight
                      ? 'bg-zinc-100 text-zinc-600'
                      : 'bg-zinc-800 text-zinc-300'
                  }`}
                >
                  <FileText className="w-7 h-7" />
                </div>

                {selectedFile ? (
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 break-all">
                      {selectedFile.name}
                    </p>
                    <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                      {formatByteSize(selectedFile.size)} • {selectedFile.type || 'Ficheiro selecionado'}
                    </p>
                    <span className="inline-block mt-1 text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold underline">
                      Clique para escolher outro ficheiro
                    </span>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-sm font-bold">
                      Arraste e solte o seu documento aqui, ou{' '}
                      <span className="text-emerald-600 dark:text-emerald-400 underline">procure no dispositivo</span>
                    </p>
                    <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                      O nome original e extensão do ficheiro serão integralmente preservados.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: CLASSIFICAÇÃO */}
          {step === 2 && (
            <div className="space-y-5 animate-fadeIn">
              <div className="space-y-1">
                <h3 className="text-sm font-bold">2. Classificação e Categoria Institucional</h3>
                <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  Defina o enquadramento do documento para efeitos de retenção, acesso e governação.
                </p>
              </div>

              {/* Category Options */}
              <div className="space-y-2">
                <label className="text-xs font-bold block">Categoria Documental</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {(taxonomy?.categories || [
                    { id: 'academic', label: 'Académico' },
                    { id: 'enrollment', label: 'Matrícula' },
                    { id: 'identification', label: 'Identificação' },
                    { id: 'financial', label: 'Financeiro' },
                    { id: 'administrative', label: 'Administrativo' },
                    { id: 'general', label: 'Geral' },
                  ]).map((cat) => {
                    const isSelected = category === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setCategory(cat.id)}
                        className={`p-3 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                          isSelected
                            ? isLight
                              ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold shadow-sm'
                              : 'border-emerald-500 bg-emerald-500/15 text-emerald-300 font-bold'
                            : isLight
                            ? 'border-zinc-200 hover:bg-zinc-50 text-zinc-700'
                            : 'border-white/10 hover:bg-white/5 text-zinc-300'
                        }`}
                      >
                        <Tag className="w-3.5 h-3.5 mb-1 text-emerald-600 dark:text-emerald-400" />
                        <div className="truncate">{cat.label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Classification Options */}
              <div className="space-y-2 pt-2">
                <label className="text-xs font-bold block">Nível de Confidencialidade</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {(taxonomy?.classifications || [
                    { id: 'public', label: 'Público' },
                    { id: 'internal', label: 'Interno' },
                    { id: 'confidential', label: 'Confidencial' },
                    { id: 'restricted', label: 'Restrito' },
                  ]).map((cls) => {
                    const isSelected = classification === cls.id;
                    return (
                      <button
                        key={cls.id}
                        type="button"
                        onClick={() => setClassification(cls.id)}
                        className={`p-3 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                          isSelected
                            ? isLight
                              ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold shadow-sm'
                              : 'border-emerald-500 bg-emerald-500/15 text-emerald-300 font-bold'
                            : isLight
                            ? 'border-zinc-200 hover:bg-zinc-50 text-zinc-700'
                            : 'border-white/10 hover:bg-white/5 text-zinc-300'
                        }`}
                      >
                        <Shield className="w-3.5 h-3.5 mb-1 text-emerald-600 dark:text-emerald-400" />
                        <div className="truncate">{cls.label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: ASSOCIAÇÃO */}
          {step === 3 && (
            <div className="space-y-5 animate-fadeIn">
              <div className="space-y-1">
                <h3 className="text-sm font-bold">3. Associação a Entidade Escolar (Opcional)</h3>
                <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  Ligue este documento diretamente ao registo de um Aluno / Matrícula ou Ano Letivo. Pode associar agora ou mais tarde.
                </p>
              </div>

              {/* Domain Switcher */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAssociationDomain('enrollment');
                    setSelectedTarget(null);
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    associationDomain === 'enrollment'
                      ? isLight
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-950 shadow-sm'
                        : 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                      : isLight
                      ? 'border-zinc-200 hover:bg-zinc-50 text-zinc-600'
                      : 'border-white/10 hover:bg-white/5 text-zinc-400'
                  }`}
                >
                  <GraduationCap className="w-4 h-4" />
                  <span>Aluno / Matrícula</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAssociationDomain('academic');
                    setSelectedTarget(null);
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    associationDomain === 'academic'
                      ? isLight
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-950 shadow-sm'
                        : 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                      : isLight
                      ? 'border-zinc-200 hover:bg-zinc-50 text-zinc-600'
                      : 'border-white/10 hover:bg-white/5 text-zinc-400'
                  }`}
                >
                  <User className="w-4 h-4" />
                  <span>Ano Letivo</span>
                </button>
              </div>

              {/* Target Search Box */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    value={associationSearch}
                    onChange={(e) => setAssociationSearch(e.target.value)}
                    placeholder={
                      associationDomain === 'enrollment'
                        ? 'Pesquisar aluno por nome ou NIF/BI...'
                        : 'Pesquisar ano letivo...'
                    }
                    className={`w-full pl-9 pr-4 py-2.5 text-xs rounded-xl border outline-none transition-all ${
                      isLight
                        ? 'bg-zinc-50 border-zinc-200 text-zinc-900 focus:bg-white focus:border-emerald-500'
                        : 'bg-zinc-900/80 border-white/10 text-zinc-100 focus:border-emerald-500/50'
                    }`}
                  />
                </div>

                {/* Targets List */}
                <div
                  className={`max-h-48 overflow-y-auto rounded-xl border divide-y ${
                    isLight ? 'border-zinc-200 divide-zinc-100 bg-white' : 'border-white/10 divide-white/5 bg-zinc-900/50'
                  }`}
                >
                  {loadingTargets ? (
                    <div className="p-4 text-center text-xs text-zinc-400 flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> A carregar entidades...
                    </div>
                  ) : associationTargets.length === 0 ? (
                    <div className="p-4 text-center text-xs text-zinc-400">
                      Nenhuma entidade encontrada para os termos pesquisados.
                    </div>
                  ) : (
                    associationTargets.map((target) => {
                      const isSelected = selectedTarget?.id === target.id;
                      return (
                        <button
                          key={target.id}
                          type="button"
                          onClick={() => setSelectedTarget(target)}
                          className={`w-full p-3 text-left flex items-center justify-between transition-all cursor-pointer ${
                            isSelected
                              ? isLight
                                ? 'bg-emerald-50 text-emerald-950 font-bold'
                                : 'bg-emerald-500/20 text-emerald-300 font-bold'
                              : isLight
                              ? 'hover:bg-zinc-50 text-zinc-800'
                              : 'hover:bg-white/5 text-zinc-200'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-xs truncate font-semibold">{target.name}</div>
                            {target.detail && (
                              <div className={`text-[11px] truncate ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                                {target.detail}
                              </div>
                            )}
                          </div>
                          {isSelected && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 ml-2" />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {selectedTarget && (
                <div className="space-y-2 pt-2">
                  <label className="text-xs font-bold block">Finalidade da Associação</label>
                  <input
                    type="text"
                    value={associationPurpose}
                    onChange={(e) => setAssociationPurpose(e.target.value)}
                    placeholder="Ex: Documento de identificação, Comprovativo de matrícula..."
                    className={`w-full px-3.5 py-2.5 text-xs rounded-xl border outline-none ${
                      isLight
                        ? 'bg-zinc-50 border-zinc-200 text-zinc-900 focus:bg-white focus:border-emerald-500'
                        : 'bg-zinc-900/80 border-white/10 text-zinc-100 focus:border-emerald-500/50'
                    }`}
                  />
                </div>
              )}
            </div>
          )}

          {/* STEP 4: CONFIRMAÇÃO (SUMMARY) */}
          {step === 4 && (
            <div className="space-y-5 animate-fadeIn">
              <div className="space-y-1">
                <h3 className="text-sm font-bold">4. Confirmação do Carregamento</h3>
                <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  Reveja o resumo do documento e confirme para iniciar a ingestão segura.
                </p>
              </div>

              <div
                className={`p-5 rounded-2xl border space-y-4 ${
                  isLight ? 'bg-zinc-50/70 border-zinc-200' : 'bg-zinc-900/40 border-white/10'
                }`}
              >
                <div className="flex items-start gap-3.5 pb-3 border-b border-zinc-200/50 dark:border-white/5">
                  <div className="p-2.5 rounded-xl bg-emerald-600 text-white shrink-0">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold break-all">{selectedFile?.name}</div>
                    <div className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                      {selectedFile ? formatByteSize(selectedFile.size) : ''} • {selectedFile?.type || 'Ficheiro'}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className={`block text-[11px] ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                      Categoria
                    </span>
                    <span className="font-bold">{getCategoryLabel(category)}</span>
                  </div>

                  <div>
                    <span className={`block text-[11px] ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                      Classificação
                    </span>
                    <span className="font-bold">{getClassificationLabel(classification)}</span>
                  </div>

                  <div className="col-span-2">
                    <span className={`block text-[11px] ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                      Associação Escolar
                    </span>
                    <span className="font-bold">
                      {selectedTarget
                        ? `${selectedTarget.domain === 'enrollment' ? 'Aluno / Matrícula: ' : selectedTarget.domain === 'academic' ? 'Ano Letivo: ' : ''}${selectedTarget.name}`
                        : 'Sem associação imediata (Associar mais tarde)'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: CARREGAMENTO E VERIFICAÇÃO (LIVE PROGRESSION) */}
          {step === 5 && (
            <div className="py-6 space-y-6 text-center animate-fadeIn">
              {executionStage === 'authorizing' && (
                <div className="space-y-3">
                  <Loader2 className="w-10 h-10 animate-spin text-emerald-500 mx-auto" />
                  <h3 className="text-sm font-bold">A autorizar sessão de carregamento...</h3>
                  <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                    A preparar o canal governado com o servidor institucional.
                  </p>
                </div>
              )}

              {executionStage === 'uploading' && (
                <div className="space-y-4 max-w-md mx-auto">
                  <Upload className="w-10 h-10 text-emerald-500 mx-auto animate-bounce" />
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold">A transferir documento...</h3>
                    <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                      {selectedFile?.name} ({uploadProgress ?? 0}%)
                    </p>
                  </div>
                  <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${uploadProgress ?? 10}%` }}
                    />
                  </div>
                </div>
              )}

              {executionStage === 'completing' && (
                <div className="space-y-3">
                  <Loader2 className="w-10 h-10 animate-spin text-emerald-500 mx-auto" />
                  <h3 className="text-sm font-bold">A registar versão documental...</h3>
                  <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                    A guardar metadados e registar no catálogo institucional.
                  </p>
                </div>
              )}

              {executionStage === 'associating' && (
                <div className="space-y-3">
                  <Loader2 className="w-10 h-10 animate-spin text-emerald-500 mx-auto" />
                  <h3 className="text-sm font-bold">A criar associação com {selectedTarget?.name}...</h3>
                  <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                    A registar a ligação canónica na base de dados.
                  </p>
                </div>
              )}

              {executionStage === 'verifying' && (
                <div className="space-y-3">
                  <ShieldCheck className="w-10 h-10 text-emerald-500 mx-auto animate-pulse" />
                  <h3 className="text-sm font-bold">A verificar conformidade e segurança...</h3>
                  <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                    Validação técnica em curso. O documento transitará automaticamente para o estado Disponível.
                  </p>
                </div>
              )}

              {executionStage === 'verified' && (
                <div className="space-y-4">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                      Documento Carregado e Disponível!
                    </h3>
                    <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                      O ficheiro foi verificado com sucesso e está acessível no arquivo institucional.
                    </p>
                  </div>

                  {associationWarning && (
                    <div className="max-w-md mx-auto p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs text-left flex items-start gap-2.5">
                      <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                      <div>
                        <div className="font-bold">Aviso de Associação</div>
                        <div className="text-[11px] opacity-90">{associationWarning} Pode associar o documento a qualquer momento no painel de detalhes.</div>
                      </div>
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (uploadedDocId) onSuccess(uploadedDocId);
                        onClose();
                      }}
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-xs shadow-md hover:from-emerald-500 hover:to-teal-500 cursor-pointer"
                    >
                      Concluir e Ver no Arquivo
                    </button>
                  </div>
                </div>
              )}

              {executionStage === 'verification_pending_timeout' && (
                <div className="space-y-4">
                  <div className="w-14 h-14 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center mx-auto">
                    <Clock className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-blue-600 dark:text-blue-400">
                      Verificação em Curso
                    </h3>
                    <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                      O documento foi recebido e continua em verificação. Pode aceder ao arquivo enquanto a análise técnica conclui.
                    </p>
                  </div>

                  {associationWarning && (
                    <div className="max-w-md mx-auto p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs text-left flex items-start gap-2.5">
                      <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                      <div>
                        <div className="font-bold">Aviso de Associação</div>
                        <div className="text-[11px] opacity-90">{associationWarning}</div>
                      </div>
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (uploadedDocId) onSuccess(uploadedDocId);
                        onClose();
                      }}
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-xs shadow-md hover:from-emerald-500 hover:to-teal-500 cursor-pointer"
                    >
                      Concluir e Ver no Arquivo
                    </button>
                  </div>
                </div>
              )}

              {executionStage === 'verification_status_unavailable' && (
                <div className="space-y-4">
                  <div className="w-14 h-14 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center mx-auto">
                    <AlertCircle className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-amber-600 dark:text-amber-400">
                      Estado de Verificação Indisponível
                    </h3>
                    <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                      Não foi possível atualizar o estado da verificação neste momento. O documento foi recebido pelo sistema.
                    </p>
                  </div>

                  {associationWarning && (
                    <div className="max-w-md mx-auto p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs text-left flex items-start gap-2.5">
                      <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                      <div>
                        <div className="font-bold">Aviso de Associação</div>
                        <div className="text-[11px] opacity-90">{associationWarning}</div>
                      </div>
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (uploadedDocId) onSuccess(uploadedDocId);
                        onClose();
                      }}
                      className="px-6 py-2.5 rounded-xl bg-zinc-800 text-white font-bold text-xs cursor-pointer"
                    >
                      Concluir e Ver no Arquivo
                    </button>
                  </div>
                </div>
              )}

              {executionStage === 'quarantined' && (
                <div className="space-y-4">
                  <div className="w-14 h-14 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center mx-auto">
                    <ShieldAlert className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-amber-500">Documento em Quarentena</h3>
                    <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                      O ficheiro foi retido por motivos de segurança e requer análise técnica.
                    </p>
                  </div>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (uploadedDocId) onSuccess(uploadedDocId);
                        onClose();
                      }}
                      className="px-6 py-2.5 rounded-xl bg-zinc-800 text-white font-bold text-xs cursor-pointer"
                    >
                      Fechar
                    </button>
                  </div>
                </div>
              )}

              {executionStage === 'error' && (
                <div className="space-y-4">
                  <div className="w-14 h-14 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center mx-auto">
                    <AlertCircle className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-red-500">Erro no Carregamento</h3>
                    <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                      {errorMessage || 'Ocorreu um erro ao processar o carregamento do documento.'}
                    </p>
                  </div>
                  <div className="flex justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="px-5 py-2 rounded-xl border border-zinc-300 dark:border-white/10 text-xs font-semibold cursor-pointer"
                    >
                      Tentar Novamente
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-5 py-2 rounded-xl bg-zinc-800 text-white text-xs font-semibold cursor-pointer"
                    >
                      Fechar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        {step < 5 && (
          <div
            className={`px-6 py-4 border-t flex items-center justify-between shrink-0 ${
              isLight ? 'border-zinc-200/80 bg-zinc-50/70' : 'border-white/5 bg-white/[0.02]'
            }`}
          >
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((prev) => Math.max(1, prev - 1) as StepIndex)}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  isLight
                    ? 'border-zinc-300 hover:bg-zinc-100 text-zinc-700'
                    : 'border-white/10 hover:bg-white/5 text-zinc-300'
                }`}
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Anterior
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2.5">
              {step === 3 && !selectedTarget && (
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isLight ? 'text-zinc-600 hover:text-zinc-900' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Associar mais tarde
                </button>
              )}

              {step < 4 ? (
                <button
                  type="button"
                  disabled={step === 1 && !selectedFile}
                  onClick={() => setStep((prev) => Math.min(4, prev + 1) as StepIndex)}
                  className={`inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md active:scale-[0.98] ${
                    step === 1 && !selectedFile
                      ? 'bg-zinc-300 dark:bg-zinc-800 text-zinc-500 cursor-not-allowed shadow-none'
                      : 'bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white cursor-pointer shadow-emerald-900/20'
                  }`}
                >
                  <span>Seguinte</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void executeUploadWorkflow()}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md cursor-pointer active:scale-[0.98]"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Confirmar e Carregar</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
