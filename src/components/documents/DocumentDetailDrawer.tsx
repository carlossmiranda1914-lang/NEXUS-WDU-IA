import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  FileText,
  Shield,
  Layers,
  Activity,
  Link2,
  Lock,
  Unlock,
  Trash2,
  Eye,
  Download,
  Upload,
  Clock,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  Calendar,
  Tag,
  Hash,
  Copy,
  Check,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  FileCode,
  Info,
  Plus,
  User,
  GraduationCap,
  Loader2,
  Search,
} from 'lucide-react';
import type {
  Theme,
  DocumentDto,
  ActivityDto,
  DetailDrawerTab,
  DocumentVersionDto,
  DocumentOperationalAvailability,
  AssociationTarget,
} from './types.ts';
import {
  fetchDocumentActivity,
  fetchDocumentVersions,
  searchAssociationTargets,
  createDocumentAssociation,
  deleteDocumentAssociation,
  generateIdempotencyKey,
} from './api.ts';
import {
  formatByteSize,
  formatDate,
  formatDateTime,
  getCategoryLabel,
  getClassificationLabel,
  getTechnicalStatusPresentation,
  getRetentionStatusPresentation,
  getBadgeClasses,
  getClassificationBadgeClass,
} from './utils.ts';

interface DocumentDetailDrawerProps {
  isOpen: boolean;
  theme: Theme;
  document: DocumentDto | null;
  operationalAvailability?: DocumentOperationalAvailability;
  onClose: () => void;
  onOpenUploadVersion: (doc: DocumentDto) => void;
  onOpenAccessViewer: (doc: DocumentDto, action: 'open' | 'download', versionId?: string) => void;
  onOpenHoldModal: (doc: DocumentDto, mode: 'place' | 'release') => void;
  onOpenDeletionModal: (doc: DocumentDto) => void;
  onRefreshDocument: () => void;
}

export default function DocumentDetailDrawer({
  isOpen,
  theme,
  document: initialDoc,
  operationalAvailability,
  onClose,
  onOpenUploadVersion,
  onOpenAccessViewer,
  onOpenHoldModal,
  onOpenDeletionModal,
  onRefreshDocument,
}: DocumentDetailDrawerProps) {
  const isLight = theme === 'light';

  const [activeTab, setActiveTab] = useState<DetailDrawerTab>('info');
  const [docDetail, setDocDetail] = useState<DocumentDto | null>(initialDoc);
  const [activities, setActivities] = useState<ActivityDto[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [versions, setVersions] = useState<DocumentVersionDto[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  // Association modal / form state inside drawer
  const [isAddingAssociation, setIsAddingAssociation] = useState(false);
  const [assocDomain, setAssocDomain] = useState<'enrollment' | 'academic'>('enrollment');
  const [assocSearch, setAssocSearch] = useState('');
  const [assocTargets, setAssocTargets] = useState<AssociationTarget[]>([]);
  const [loadingAssocTargets, setLoadingAssocTargets] = useState(false);
  const [selectedAssocTarget, setSelectedAssocTarget] = useState<AssociationTarget | null>(null);
  const [assocPurpose, setAssocPurpose] = useState('Identificação institucional');
  const [savingAssoc, setSavingAssoc] = useState(false);
  const [assocError, setAssocError] = useState<string | null>(null);

  // Escape key closes drawer
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isAddingAssociation) {
        onClose();
      }
    },
    [isOpen, isAddingAssociation, onClose],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    setDocDetail(initialDoc);
    setIsAddingAssociation(false);
    if (initialDoc && isOpen) {
      void loadActivity(initialDoc.id);
      void loadVersions(initialDoc.id);
    }
  }, [initialDoc, isOpen]);

  // Search association targets
  useEffect(() => {
    if (!isAddingAssociation) return;

    let active = true;
    setLoadingAssocTargets(true);

    const timer = setTimeout(() => {
      searchAssociationTargets(assocDomain, assocSearch)
        .then((targets) => {
          if (active) {
            setAssocTargets(targets);
            setLoadingAssocTargets(false);
          }
        })
        .catch(() => {
          if (active) {
            setAssocTargets([]);
            setLoadingAssocTargets(false);
          }
        });
    }, 200);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [isAddingAssociation, assocDomain, assocSearch]);

  const loadActivity = async (docId: string) => {
    setLoadingActivity(true);
    setActivityError(null);
    try {
      const items = await fetchDocumentActivity(docId);
      setActivities(items);
    } catch (err) {
      setActivityError(err instanceof Error ? err.message : 'Não foi possível carregar a atividade.');
    } finally {
      setLoadingActivity(false);
    }
  };

  const loadVersions = async (docId: string) => {
    setLoadingVersions(true);
    try {
      const items = await fetchDocumentVersions(docId);
      setVersions(items);
    } catch {
      if (initialDoc?.currentVersion) {
        setVersions([initialDoc.currentVersion]);
      }
    } finally {
      setLoadingVersions(false);
    }
  };

  const handleCopyHash = (hash: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(hash);
      setCopiedHash(hash);
      setTimeout(() => setCopiedHash(null), 2000);
    }
  };

  const handleSaveAssociation = async () => {
    if (!docDetail || !selectedAssocTarget) return;

    setSavingAssoc(true);
    setAssocError(null);

    try {
      await createDocumentAssociation(
        docDetail.id,
        {
          targetDomain: selectedAssocTarget.domain,
          targetResourceType: selectedAssocTarget.resourceType,
          targetResourceId: selectedAssocTarget.id,
          purpose: assocPurpose || 'Documentação escolar',
          pinnedVersionId: docDetail.currentVersion?.id || null,
        },
        generateIdempotencyKey('drawer-assoc'),
      );

      setIsAddingAssociation(false);
      setSelectedAssocTarget(null);
      setAssocSearch('');
      onRefreshDocument();
      void loadActivity(docDetail.id);
    } catch (err) {
      setAssocError(err instanceof Error ? err.message : 'Erro ao guardar associação.');
    } finally {
      setSavingAssoc(false);
    }
  };

  const handleRemoveAssociation = async (assocId: string) => {
    if (!docDetail) return;
    try {
      await deleteDocumentAssociation(
        docDetail.id,
        assocId,
        generateIdempotencyKey('del-assoc'),
        'Associação retirada pelo utilizador',
      );
      onRefreshDocument();
      void loadActivity(docDetail.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao retirar associação.');
    }
  };

  if (!isOpen || !docDetail) return null;

  const techStatus = getTechnicalStatusPresentation(docDetail.currentVersion?.status ?? docDetail.status);
  const retentionStatus = getRetentionStatusPresentation(
    docDetail.retention?.retentionStatus,
    docDetail.retention?.retainUntil,
  );
  const hasActiveHolds = docDetail.activeHolds.length > 0;
  const isDeleted = docDetail.currentVersion?.status === 'deleted' || (docDetail.status as string) === 'deleted';
  const isQuarantined = docDetail.currentVersion?.status === 'quarantined';
  const isAvailable = docDetail.currentVersion?.status === 'available';

  const displayFilename =
    docDetail.originalFilename ||
    docDetail.declaredFilename ||
    docDetail.currentVersion?.originalFilename ||
    docDetail.title ||
    `${docDetail.category.toUpperCase()} - DOC-${docDetail.id.slice(0, 8).toUpperCase()}`;

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] transition-opacity animate-fadeIn"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Painel de detalhe do documento"
        className={`fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] lg:w-[540px] shadow-2xl border-l flex flex-col transition-all duration-300 ${
          isLight ? 'bg-white border-zinc-200 text-zinc-900' : 'bg-[#0e1411] border-emerald-950/40 text-zinc-100'
        }`}
      >
        {/* DRAWER HEADER — Centered on Original Filename / Document Title */}
        <div
          className={`p-5 border-b space-y-3.5 shrink-0 ${
            isLight ? 'border-zinc-200/80 bg-zinc-50/70' : 'border-white/5 bg-white/[0.02]'
          }`}
        >
          {/* Top Row: Badges & Close */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getBadgeClasses(
                  techStatus.tone,
                  theme,
                )}`}
              >
                {techStatus.label}
              </span>

              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getClassificationBadgeClass(
                  docDetail.classification,
                  theme,
                )}`}
              >
                {getClassificationLabel(docDetail.classification)}
              </span>

              {hasActiveHolds && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-500/15 text-amber-500 border border-amber-500/30 flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" /> Bloqueio Ativo
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
                isLight
                  ? 'border-zinc-200 hover:bg-zinc-100 text-zinc-600'
                  : 'border-white/10 hover:bg-white/5 text-zinc-400 hover:text-white'
              }`}
              aria-label="Fechar gaveta de detalhe"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Document Identity Protagonist Title */}
          <div className="flex items-start gap-3">
            <div
              className={`p-2.5 rounded-2xl shrink-0 mt-0.5 ${
                isLight
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              }`}
            >
              <FileText className="w-6 h-6" />
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="text-base sm:text-lg font-bold break-all leading-snug">
                {displayFilename}
              </h2>

              <div className="flex items-center gap-2 mt-1 text-xs flex-wrap">
                <span className={`font-semibold ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                  {getCategoryLabel(docDetail.category)}
                </span>
                <span className="text-zinc-400">•</span>
                <span className="font-mono text-[11px] text-zinc-500">
                  v{docDetail.currentVersion?.versionNumber ?? 1}
                </span>
                <span className="text-zinc-400">•</span>
                <span className={`text-[11px] ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  {formatByteSize(docDetail.currentVersion?.byteSize ?? 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Action Toolbar */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <button
              type="button"
              disabled={
                !docDetail.capabilities.canOpen ||
                operationalAvailability?.canAccess === false ||
                isDeleted ||
                isQuarantined
              }
              onClick={() => onOpenAccessViewer(docDetail, 'open')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                isLight
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 shadow-sm'
                  : 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
              title="Abrir documento no leitor institucional"
            >
              <Eye className="w-3.5 h-3.5" /> Abrir
            </button>

            <button
              type="button"
              disabled={
                !docDetail.capabilities.canDownload ||
                operationalAvailability?.canAccess === false ||
                isDeleted ||
                isQuarantined
              }
              onClick={() => onOpenAccessViewer(docDetail, 'download')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                isLight
                  ? 'border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-800 shadow-sm'
                  : 'border-white/10 bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
              title="Descarregar ficheiro original"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" /> Baixar
            </button>

            <button
              type="button"
              disabled={
                !docDetail.capabilities.canUploadVersion ||
                operationalAvailability?.canUpload === false ||
                isDeleted ||
                isQuarantined
              }
              onClick={() => onOpenUploadVersion(docDetail)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                isLight
                  ? 'border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-800 shadow-sm'
                  : 'border-white/10 bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
              title="Carregar nova versão deste documento"
            >
              <Upload className="w-3.5 h-3.5 text-blue-500" /> Nova versão
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('associations');
                setIsAddingAssociation(true);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                isLight
                  ? 'border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-800 shadow-sm'
                  : 'border-white/10 bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
              }`}
              title="Associar a Aluno ou Matrícula"
            >
              <Link2 className="w-3.5 h-3.5 text-teal-500" /> Associar
            </button>

            <button
              type="button"
              onClick={() => onOpenHoldModal(docDetail, hasActiveHolds ? 'release' : 'place')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                isLight
                  ? 'border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-800 shadow-sm'
                  : 'border-white/10 bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
              }`}
              title={hasActiveHolds ? 'Libertar bloqueio de retenção' : 'Aplicar bloqueio de retenção'}
            >
              {hasActiveHolds ? (
                <>
                  <Unlock className="w-3.5 h-3.5 text-amber-500" /> Libertar hold
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5 text-amber-500" /> Hold
                </>
              )}
            </button>

            <button
              type="button"
              disabled={isDeleted}
              onClick={() => onOpenDeletionModal(docDetail)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                isLight
                  ? 'border-red-200 bg-red-50/50 hover:bg-red-50 text-red-700'
                  : 'border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-400'
              } disabled:opacity-30 disabled:cursor-not-allowed`}
              title="Eliminação governada"
            >
              <Trash2 className="w-3.5 h-3.5" /> Eliminar
            </button>
          </div>
        </div>

        {/* 4 REACHABLE TABS */}
        <nav
          className={`flex max-w-full border-b px-5 shrink-0 ${
            isLight ? 'border-zinc-200 bg-zinc-50/40' : 'border-white/5 bg-black/20'
          }`}
          aria-label="Separadores de detalhe do documento"
        >
          {[
            { id: 'info', label: 'Informações', icon: Info },
            { id: 'versions', label: `Versões (${versions.length || docDetail.versionCount})`, icon: Layers },
            { id: 'associations', label: `Associações (${docDetail.associations.length})`, icon: Link2 },
            { id: 'activity', label: 'Atividade', icon: Activity },
          ].map((t) => {
            const isActive = activeTab === t.id;
            const IconComp = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setActiveTab(t.id as DetailDrawerTab);
                  if (t.id !== 'associations') setIsAddingAssociation(false);
                }}
                className={`flex-1 min-h-[44px] flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  isActive
                    ? isLight
                      ? 'border-emerald-600 text-emerald-800'
                      : 'border-emerald-400 text-emerald-300'
                    : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                <IconComp className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{t.label}</span>
              </button>
            );
          })}
        </nav>

        {/* TAB PANELS */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          {/* TAB 1: INFORMAÇÕES */}
          {activeTab === 'info' && (
            <div className="space-y-5 animate-fadeIn">
              {/* Primary Human Hierarchy */}
              <section className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Dados do Documento
                </h3>

                <div
                  className={`p-4 rounded-2xl border space-y-3 text-xs ${
                    isLight ? 'bg-zinc-50/80 border-zinc-200/80' : 'bg-zinc-900/40 border-white/5'
                  }`}
                >
                  <div className="flex justify-between py-1 border-b border-zinc-200/50 dark:border-white/5">
                    <span className={isLight ? 'text-zinc-500' : 'text-zinc-400'}>Nome Original:</span>
                    <span className="font-bold break-all text-right max-w-[240px]">{displayFilename}</span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-zinc-200/50 dark:border-white/5">
                    <span className={isLight ? 'text-zinc-500' : 'text-zinc-400'}>Categoria:</span>
                    <span className="font-bold">{getCategoryLabel(docDetail.category)}</span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-zinc-200/50 dark:border-white/5">
                    <span className={isLight ? 'text-zinc-500' : 'text-zinc-400'}>Classificação:</span>
                    <span className="font-bold">{getClassificationLabel(docDetail.classification)}</span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-zinc-200/50 dark:border-white/5">
                    <span className={isLight ? 'text-zinc-500' : 'text-zinc-400'}>Estado Técnico:</span>
                    <span className="font-bold">{techStatus.label}</span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-zinc-200/50 dark:border-white/5">
                    <span className={isLight ? 'text-zinc-500' : 'text-zinc-400'}>Criado por:</span>
                    <span className="font-bold">
                      {docDetail.createdByPersonName || docDetail.currentVersion?.createdByPersonName || 'Administrador'}
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-zinc-200/50 dark:border-white/5">
                    <span className={isLight ? 'text-zinc-500' : 'text-zinc-400'}>Data de Registo:</span>
                    <span className="font-medium">{formatDateTime(docDetail.createdAt)}</span>
                  </div>

                  <div className="flex justify-between py-1">
                    <span className={isLight ? 'text-zinc-500' : 'text-zinc-400'}>Última Atualização:</span>
                    <span className="font-medium">{formatDateTime(docDetail.updatedAt)}</span>
                  </div>
                </div>
              </section>

              {/* Secondary Governance Hierarchy: Retention & Holds */}
              <section className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Governação e Retenção
                </h3>

                <div
                  className={`p-4 rounded-2xl border space-y-3 text-xs ${
                    isLight ? 'bg-zinc-50/80 border-zinc-200/80' : 'bg-zinc-900/40 border-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={isLight ? 'text-zinc-500' : 'text-zinc-400'}>Retenção Governança:</span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${getBadgeClasses(
                        retentionStatus.tone,
                        theme,
                      )}`}
                    >
                      {retentionStatus.label}
                    </span>
                  </div>

                  {docDetail.retention?.retainUntil && (
                    <div className="flex justify-between text-[11px]">
                      <span className={isLight ? 'text-zinc-500' : 'text-zinc-400'}>Retido até:</span>
                      <span className="font-semibold">{formatDate(docDetail.retention.retainUntil)}</span>
                    </div>
                  )}

                  {docDetail.activeHolds.length > 0 && (
                    <div className="pt-2 border-t border-zinc-200/50 dark:border-white/5 space-y-2">
                      <span className="font-bold text-amber-500 block">Bloqueios Ativos ({docDetail.activeHolds.length}):</span>
                      {docDetail.activeHolds.map((h, i) => (
                        <div key={i} className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1">
                          <div className="flex justify-between font-bold text-amber-500 text-[11px]">
                            <span>{h.holdType === 'legal' ? 'Bloqueio Jurídico' : 'Bloqueio Administrativo'}</span>
                            <span>{formatDate(h.effectiveAt)}</span>
                          </div>
                          <div className="text-[11px] text-zinc-300">{h.reason}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {/* Collapsed Technical Details */}
              <section className="space-y-2">
                <button
                  type="button"
                  onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                    isLight ? 'border-zinc-200 bg-white hover:bg-zinc-50' : 'border-white/10 bg-zinc-900/60 hover:bg-zinc-900'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-zinc-400" />
                    <span>Detalhes Técnicos e Criptográficos</span>
                  </span>
                  {showTechnicalDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showTechnicalDetails && (
                  <div
                    className={`p-4 rounded-2xl border space-y-3 font-mono text-[11px] break-all ${
                      isLight ? 'bg-zinc-100/70 border-zinc-200' : 'bg-black/40 border-white/5'
                    }`}
                  >
                    <div>
                      <span className="text-zinc-400 block text-[10px] uppercase">ID do Documento:</span>
                      <span>{docDetail.id}</span>
                    </div>

                    <div>
                      <span className="text-zinc-400 block text-[10px] uppercase">MIME Type:</span>
                      <span>{docDetail.currentVersion?.mimeType ?? 'application/octet-stream'}</span>
                    </div>

                    {docDetail.currentVersion?.sha256Hash && (
                      <div>
                        <div className="flex items-center justify-between text-zinc-400 text-[10px] uppercase mb-0.5">
                          <span>SHA-256 Digest:</span>
                          <button
                            type="button"
                            onClick={() => handleCopyHash(docDetail.currentVersion!.sha256Hash)}
                            className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold hover:underline cursor-pointer"
                          >
                            {copiedHash ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedHash ? 'Copiado!' : 'Copiar'}</span>
                          </button>
                        </div>
                        <span className="text-emerald-600 dark:text-emerald-400 text-[10px]">
                          {docDetail.currentVersion.sha256Hash}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </section>
            </div>
          )}

          {/* TAB 2: VERSÕES */}
          {activeTab === 'versions' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Histórico de Versões
                </h3>
                <button
                  type="button"
                  onClick={() => onOpenUploadVersion(docDetail)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-sm hover:bg-emerald-500 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Nova Versão</span>
                </button>
              </div>

              {loadingVersions ? (
                <div className="p-8 text-center text-xs text-zinc-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> A carregar versões...
                </div>
              ) : versions.length === 0 ? (
                <div className="p-6 text-center text-xs text-zinc-400">
                  Nenhuma versão registada.
                </div>
              ) : (
                <div className="space-y-3">
                  {versions.map((v, idx) => {
                    const isCurrent = idx === 0 || v.versionNumber === docDetail.currentVersion?.versionNumber;
                    const vTechStatus = getTechnicalStatusPresentation(v.status);
                    const vName = v.originalFilename || v.declaredFilename || displayFilename;
                    return (
                      <div
                        key={v.id}
                        className={`p-4 rounded-2xl border space-y-2.5 transition-all ${
                          isCurrent
                            ? isLight
                              ? 'bg-emerald-50/50 border-emerald-300 shadow-sm'
                              : 'bg-emerald-950/20 border-emerald-500/30'
                            : isLight
                            ? 'bg-zinc-50 border-zinc-200'
                            : 'bg-zinc-900/40 border-white/5'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-md bg-zinc-200 dark:bg-white/10">
                              v{v.versionNumber}
                            </span>
                            {isCurrent && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500 text-zinc-950 uppercase">
                                Versão Atual
                              </span>
                            )}
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getBadgeClasses(
                                vTechStatus.tone,
                                theme,
                              )}`}
                            >
                              {vTechStatus.label}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => onOpenAccessViewer(docDetail, 'download', v.id)}
                            className={`p-1.5 rounded-lg border text-xs font-semibold cursor-pointer ${
                              isLight ? 'border-zinc-300 hover:bg-zinc-100' : 'border-white/10 hover:bg-white/10'
                            }`}
                            title="Descarregar esta versão específica"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="text-xs font-bold truncate break-all">{vName}</div>

                        <div className="flex items-center justify-between text-[11px] text-zinc-400">
                          <span>{formatByteSize(v.byteSize)} • {v.createdByPersonName || 'Utilizador'}</span>
                          <span>{formatDateTime(v.createdAt)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ASSOCIAÇÕES */}
          {activeTab === 'associations' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Entidades Escolares Associadas
                </h3>
                {!isAddingAssociation && (
                  <button
                    type="button"
                    onClick={() => setIsAddingAssociation(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-sm hover:bg-emerald-500 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar Associação</span>
                  </button>
                )}
              </div>

              {/* Inline Association Creator */}
              {isAddingAssociation && (
                <div
                  className={`p-4 rounded-2xl border space-y-4 ${
                    isLight ? 'bg-zinc-50 border-emerald-300' : 'bg-zinc-900 border-emerald-500/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">Ligar Documento a Entidade</span>
                    <button
                      type="button"
                      onClick={() => setIsAddingAssociation(false)}
                      className="p-1 rounded-lg text-zinc-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Domain Toggle */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setAssocDomain('enrollment');
                        setSelectedAssocTarget(null);
                      }}
                      className={`flex-1 py-2 text-xs font-bold rounded-xl border cursor-pointer ${
                        assocDomain === 'enrollment'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-zinc-800 text-zinc-300 border-white/5'
                      }`}
                    >
                      Aluno / Matrícula
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAssocDomain('academic');
                        setSelectedAssocTarget(null);
                      }}
                      className={`flex-1 py-2 text-xs font-bold rounded-xl border cursor-pointer ${
                        assocDomain === 'academic'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-zinc-800 text-zinc-300 border-white/5'
                      }`}
                    >
                      Ano Letivo
                    </button>
                  </div>

                  {/* Search box */}
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                      <input
                        type="text"
                        value={assocSearch}
                        onChange={(e) => setAssocSearch(e.target.value)}
                        placeholder="Pesquisar por nome..."
                        className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border bg-black/20 border-white/10 outline-none"
                      />
                    </div>

                    <div className="max-h-36 overflow-y-auto rounded-xl border divide-y border-white/10 divide-white/5 bg-black/20">
                      {loadingAssocTargets ? (
                        <div className="p-3 text-center text-xs text-zinc-400 flex items-center justify-center gap-1.5">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> A carregar...
                        </div>
                      ) : assocTargets.length === 0 ? (
                        <div className="p-3 text-center text-xs text-zinc-400">Nenhum resultado encontrado.</div>
                      ) : (
                        assocTargets.map((target) => (
                          <button
                            key={target.id}
                            type="button"
                            onClick={() => setSelectedAssocTarget(target)}
                            className={`w-full p-2.5 text-left text-xs flex items-center justify-between cursor-pointer ${
                              selectedAssocTarget?.id === target.id
                                ? 'bg-emerald-500/20 text-emerald-300 font-bold'
                                : 'hover:bg-white/5 text-zinc-200'
                            }`}
                          >
                            <span className="truncate">{target.name}</span>
                            {selectedAssocTarget?.id === target.id && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 ml-1" />
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  {selectedAssocTarget && (
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold block">Finalidade</label>
                      <input
                        type="text"
                        value={assocPurpose}
                        onChange={(e) => setAssocPurpose(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs rounded-xl border bg-black/20 border-white/10"
                      />
                    </div>
                  )}

                  {assocError && <p className="text-xs text-red-400">{assocError}</p>}

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsAddingAssociation(false)}
                      className="px-3 py-1.5 text-xs rounded-xl border border-white/10"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={!selectedAssocTarget || savingAssoc}
                      onClick={() => void handleSaveAssociation()}
                      className="px-4 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 text-white disabled:opacity-40 cursor-pointer"
                    >
                      {savingAssoc ? 'A guardar...' : 'Confirmar Associação'}
                    </button>
                  </div>
                </div>
              )}

              {/* Associations List */}
              {docDetail.associations.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-400">
                  Nenhuma associação escolar vinculada a este documento.
                </div>
              ) : (
                <div className="space-y-3">
                  {docDetail.associations.map((a) => {
                    const isStudent = a.targetDomain === 'student';
                    return (
                      <div
                        key={a.id}
                        className={`p-4 rounded-2xl border space-y-2 ${
                          isLight ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900/40 border-white/5'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div
                              className={`p-1.5 rounded-lg ${
                                isStudent
                                  ? 'bg-blue-500/15 text-blue-400'
                                  : 'bg-emerald-500/15 text-emerald-400'
                              }`}
                            >
                              {isStudent ? <User className="w-4 h-4" /> : <GraduationCap className="w-4 h-4" />}
                            </div>
                            <div>
                              <div className="text-xs font-bold">
                                {a.targetEntityName || `${isStudent ? 'Aluno' : 'Matrícula'} #${a.targetResourceId.slice(0, 8)}`}
                              </div>
                              <div className="text-[10px] text-zinc-400 uppercase font-semibold">
                                {isStudent ? 'Aluno Registado' : 'Processo de Matrícula'}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => void handleRemoveAssociation(a.id)}
                            className="p-1 rounded-lg text-zinc-500 hover:text-red-400 transition-colors"
                            title="Retirar associação"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="text-xs text-zinc-300">
                          <span className="text-zinc-500">Finalidade: </span>
                          <span className="font-medium">{a.purpose}</span>
                        </div>

                        <div className="text-[11px] text-zinc-500 flex justify-between">
                          <span>Estado: {a.status === 'active' ? 'Ativa' : a.status}</span>
                          <span>{formatDate(a.createdAt)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: ATIVIDADE */}
          {activeTab === 'activity' && (
            <div className="space-y-4 animate-fadeIn">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Registo de Atividade e Auditoria
              </h3>

              {loadingActivity ? (
                <div className="p-8 text-center text-xs text-zinc-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> A carregar histórico de auditoria...
                </div>
              ) : activityError ? (
                <div className="p-4 rounded-xl border border-red-500/20 text-xs text-red-400">
                  {activityError}
                </div>
              ) : activities.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-400">
                  Nenhum registo de atividade disponível.
                </div>
              ) : (
                <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-200 dark:before:bg-zinc-800">
                  {activities.map((act) => (
                    <div key={act.id} className="relative space-y-1 text-xs">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 absolute -left-6 top-1 border-2 border-zinc-900" />
                      <div className="flex items-center justify-between font-bold">
                        <span>{act.title}</span>
                        <span className="text-[10px] font-normal text-zinc-400">
                          {formatDateTime(act.occurredAt)}
                        </span>
                      </div>
                      <p className={`text-[11px] leading-relaxed ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>
                        {act.description}
                      </p>
                      {act.actorName && (
                        <div className="text-[10px] text-zinc-500">
                          Operador: <span className="font-semibold">{act.actorName}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
