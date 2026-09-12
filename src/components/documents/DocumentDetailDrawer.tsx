import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import type { Theme, DocumentDto, ActivityDto, DetailDrawerTab, DocumentVersionDto } from './types.ts';
import { fetchDocumentActivity, fetchDocumentDetail, fetchDocumentVersions } from './api.ts';
import {
  formatByteSize,
  formatDate,
  formatDateTime,
  getCategoryLabel,
  getTechnicalStatusPresentation,
  getRetentionStatusPresentation,
  getBadgeClasses,
} from './utils.ts';

interface DocumentDetailDrawerProps {
  isOpen: boolean;
  theme: Theme;
  document: DocumentDto | null;
  onClose: () => void;
  onOpenUploadVersion: (doc: DocumentDto) => void;
  onOpenAccessViewer: (doc: DocumentDto, action: 'open' | 'download') => void;
  onOpenHoldModal: (doc: DocumentDto, mode: 'place' | 'release') => void;
  onOpenDeletionModal: (doc: DocumentDto) => void;
  onRefreshDocument: () => void;
}

export default function DocumentDetailDrawer({
  isOpen,
  theme,
  document: initialDoc,
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

  useEffect(() => {
    setDocDetail(initialDoc);
    if (initialDoc && isOpen) {
      void loadActivity(initialDoc.id);
      void loadVersions(initialDoc.id);
    }
  }, [initialDoc, isOpen]);

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
    } catch (err) {
      // Fallback to currentVersion if standalone endpoint is unavailable
      if (initialDoc?.currentVersion) {
        setVersions([initialDoc.currentVersion]);
      }
    } finally {
      setLoadingVersions(false);
    }
  };

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
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

  return (
    <aside
      aria-label="Painel de detalhe do documento"
      className={`fixed inset-y-0 right-0 z-40 w-full sm:w-[390px] lg:w-[410px] shadow-2xl border-l flex flex-col transition-all duration-300 ${
        isLight
          ? 'bg-white border-zinc-200 text-zinc-900'
          : 'bg-zinc-900 border-white/10 text-zinc-100'
      }`}
    >
      {/* DRAWER HEADER */}
      <div className="p-5 border-b border-zinc-200/50 dark:border-white/5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border ${getBadgeClasses(
                techStatus.tone,
                theme,
              )}`}
            >
              {techStatus.label}
            </span>
            {hasActiveHolds && (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center gap-1">
                <Lock className="w-3 h-3" /> Bloqueio Ativo
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
              isLight
                ? 'border-zinc-200 hover:bg-zinc-100 text-zinc-600'
                : 'border-white/10 hover:bg-white/5 text-zinc-400'
            }`}
            aria-label="Fechar gaveta de detalhe"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>
          <h2 className="text-lg font-bold truncate">
            {getCategoryLabel(docDetail.category)}
          </h2>
          <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'} font-mono mt-0.5`}>
            ID: {docDetail.id}
          </p>
        </div>

        {/* Quick Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            disabled={!docDetail.capabilities.canOpen || isDeleted || isQuarantined}
            onClick={() => onOpenAccessViewer(docDetail, 'open')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
              isLight
                ? 'border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-800'
                : 'border-white/10 bg-zinc-800 hover:bg-white/5 text-zinc-200'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
            title={!docDetail.capabilities.canOpen ? 'Visualização não autorizada pela política' : 'Visualizar documento'}
          >
            <Eye className="w-3.5 h-3.5 text-emerald-600" /> Visualizar
          </button>

          <button
            type="button"
            disabled={!docDetail.capabilities.canDownload || isDeleted || isQuarantined}
            onClick={() => onOpenAccessViewer(docDetail, 'download')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
              isLight
                ? 'border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-800'
                : 'border-white/10 bg-zinc-800 hover:bg-white/5 text-zinc-200'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
            title={!docDetail.capabilities.canDownload ? 'Download não autorizado pela política' : 'Download seguro'}
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" /> Descarregar
          </button>

          <button
            type="button"
            disabled={!docDetail.capabilities.canUploadVersion || isDeleted || isQuarantined}
            onClick={() => onOpenUploadVersion(docDetail)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
              isLight
                ? 'border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-800'
                : 'border-white/10 bg-zinc-800 hover:bg-white/5 text-zinc-200'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
            title={!docDetail.capabilities.canUploadVersion ? 'Sem autorização para carregar nova versão' : 'Carregar Nova Versão'}
          >
            <Upload className="w-3.5 h-3.5 text-blue-500" /> Nova Versão
          </button>

          <button
            type="button"
            disabled={hasActiveHolds ? !docDetail.capabilities.canReleaseHold : !docDetail.capabilities.canPlaceHold || isDeleted}
            onClick={() => onOpenHoldModal(docDetail, hasActiveHolds ? 'release' : 'place')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
              hasActiveHolds
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20'
                : isLight
                ? 'border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-800'
                : 'border-white/10 bg-zinc-800 hover:bg-white/5 text-zinc-200'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
            title={
              hasActiveHolds
                ? !docDetail.capabilities.canReleaseHold
                  ? 'Sem autoridade para libertar bloqueio'
                  : 'Libertar Bloqueio de Retenção'
                : !docDetail.capabilities.canPlaceHold
                ? 'Sem autoridade para aplicar bloqueio'
                : 'Bloquear Documento'
            }
          >
            {hasActiveHolds ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
            {hasActiveHolds ? 'Libertar Bloqueio' : 'Bloquear'}
          </button>

          <button
            type="button"
            disabled={!(docDetail.capabilities.canAuthorizeDeletion || docDetail.capabilities.canExecuteDeletion) || hasActiveHolds || isDeleted}
            onClick={() => onOpenDeletionModal(docDetail)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-rose-500/20 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title={
              hasActiveHolds
                ? 'Eliminação bloqueada: documento possui bloqueio de retenção ativo'
                : isDeleted
                ? 'Documento já eliminado'
                : !(docDetail.capabilities.canAuthorizeDeletion || docDetail.capabilities.canExecuteDeletion)
                ? 'Sem autoridade de eliminação'
                : 'Eliminar Documento'
            }
          >
            <Trash2 className="w-3.5 h-3.5" /> Eliminar
          </button>
        </div>
      </div>

      {/* DRAWER TABS NAVIGATION */}
      <nav className={`flex border-b px-5 ${isLight ? 'border-zinc-200 bg-slate-50/50' : 'border-white/5 bg-zinc-950/40'}`}>
        <button
          type="button"
          onClick={() => setActiveTab('info')}
          className={`flex items-center gap-1.5 py-3 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'info'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
          }`}
        >
          <FileText className="w-3.5 h-3.5" /> Informações
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('versions')}
          className={`flex items-center gap-1.5 py-3 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'versions'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
          }`}
        >
          <Layers className="w-3.5 h-3.5" /> Versões ({docDetail.versionCount})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('associations')}
          className={`flex items-center gap-1.5 py-3 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'associations'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
          }`}
        >
          <Link2 className="w-3.5 h-3.5" /> Associações ({docDetail.associations.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('activity')}
          className={`flex items-center gap-1.5 py-3 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'activity'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
          }`}
        >
          <Activity className="w-3.5 h-3.5" /> Atividade
        </button>
      </nav>

      {/* DRAWER CONTENT */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* TAB 1: INFORMACAO */}
        {activeTab === 'info' && (
          <div className="space-y-5">
            {/* Status alerts */}
            {isQuarantined && (
              <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2.5">
                <ShieldAlert className="w-5 h-5 shrink-0" />
                <div>
                  <p className="font-bold">Documento em Quarentena</p>
                  <p className="mt-0.5 leading-relaxed">
                    O documento não pode ser disponibilizado neste momento e requer verificação técnica adicional.
                  </p>
                </div>
              </div>
            )}

            {isDeleted && (
              <div className="p-4 rounded-xl border border-zinc-500/20 bg-zinc-500/10 text-zinc-400 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <div>
                  <p className="font-bold">Versão Eliminada</p>
                  <p className="mt-0.5 leading-relaxed">
                    Este documento foi eliminado e o conteúdo físico foi destruído com integridade governada.
                  </p>
                </div>
              </div>
            )}

            {/* General Metadata Section */}
            <div className={`p-4 rounded-xl border space-y-3 ${
              isLight ? 'bg-slate-50/70 border-zinc-200' : 'bg-zinc-950/60 border-white/5'
            }`}>
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" /> Metadados Gerais
              </h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-zinc-500 block">Categoria</span>
                  <span className="font-semibold">{getCategoryLabel(docDetail.category)}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block">Classificação</span>
                  <span className="font-semibold uppercase">{docDetail.classification || 'Uso Geral'}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block">Criado em</span>
                  <span>{formatDateTime(docDetail.createdAt)}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block">Atualizado em</span>
                  <span>{formatDateTime(docDetail.updatedAt)}</span>
                </div>
              </div>
            </div>

            {/* Current Version Card */}
            {docDetail.currentVersion && (
              <div className={`p-4 rounded-xl border space-y-3 ${
                isLight ? 'bg-slate-50/70 border-zinc-200' : 'bg-zinc-950/60 border-white/5'
              }`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" /> Versão Atual (v{docDetail.currentVersion.versionNumber})
                  </h3>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getBadgeClasses(
                    techStatus.tone,
                    theme,
                  )}`}>
                    {techStatus.label}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-zinc-500 block">Tamanho</span>
                    <span className="font-semibold">{formatByteSize(docDetail.currentVersion.byteSize)}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Formato MIME</span>
                    <span className="font-mono">{docDetail.currentVersion.mimeType}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-200/50 dark:border-white/5">
                  <span className="text-zinc-500 text-xs block mb-1">Hash SHA-256 (Integridade Criptográfica)</span>
                  <div className="flex items-center gap-2">
                    <code className="text-[11px] font-mono p-1.5 rounded bg-zinc-200/60 dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 flex-1 truncate">
                      {docDetail.currentVersion.sha256Hash}
                    </code>
                    <button
                      type="button"
                      onClick={() => handleCopyHash(docDetail.currentVersion!.sha256Hash)}
                      className="p-1.5 rounded border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all cursor-pointer"
                      title="Copiar Hash"
                    >
                      {copiedHash ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Retention & Governance Section */}
            <div className={`p-4 rounded-xl border space-y-3 ${
              isLight ? 'bg-slate-50/70 border-zinc-200' : 'bg-zinc-950/60 border-white/5'
            }`}>
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" /> Governança de Retenção
                </h3>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getBadgeClasses(
                  retentionStatus.tone,
                  theme,
                )}`}>
                  {retentionStatus.label}
                </span>
              </div>

              {docDetail.retention ? (
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-zinc-500 block">Política</span>
                    <span className="font-semibold">{docDetail.retention.policyId} (v{docDetail.retention.policyVersion})</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Perfil Jurisdição</span>
                    <span className="font-semibold">{docDetail.retention.jurisdictionProfileId}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Gatilho Temporal</span>
                    <span>{docDetail.retention.clockTriggerType} ({formatDate(docDetail.retention.clockTriggerEventAt)})</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Data Limite Retenção</span>
                    <span className="font-semibold text-emerald-600">{formatDate(docDetail.retention.retainUntil)}</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-zinc-500">
                  Nenhuma política de retenção governada configurada para esta categoria.
                </p>
              )}
            </div>

            {/* Active Holds Card */}
            {hasActiveHolds && (
              <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/10 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" /> Bloqueios de Retenção Ativos ({docDetail.activeHolds.length})
                </h3>
                <div className="space-y-2">
                  {docDetail.activeHolds.map((hold) => (
                    <div key={hold.id} className="p-2.5 rounded-lg bg-black/20 text-xs space-y-1">
                      <div className="flex items-center justify-between font-bold">
                        <span>{hold.authority}</span>
                        <span className="uppercase text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                          {hold.holdType}
                        </span>
                      </div>
                      <p className="text-zinc-300">{hold.reason}</p>
                      <p className="text-[10px] text-zinc-500">Efetivo desde: {formatDateTime(hold.effectiveAt)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: VERSOES */}
        {activeTab === 'versions' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                Histórico de Versões ({versions.length || docDetail.versionCount})
              </span>
              <button
                type="button"
                disabled={!docDetail.capabilities.canUploadVersion || isDeleted || isQuarantined}
                onClick={() => onOpenUploadVersion(docDetail)}
                className="text-xs font-bold text-emerald-600 hover:underline flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed disabled:no-underline cursor-pointer"
                title={!docDetail.capabilities.canUploadVersion ? 'Sem autorização para carregar nova versão' : 'Carregar Nova Versão'}
              >
                <Upload className="w-3.5 h-3.5" /> Carregar Nova Versão
              </button>
            </div>

            {loadingVersions && versions.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-500 space-y-2">
                <RefreshCw className="w-5 h-5 mx-auto animate-spin text-emerald-600" />
                <p>A carregar versões...</p>
              </div>
            ) : versions.length > 0 ? (
              <div className="space-y-3">
                {versions.map((v) => {
                  const vTechStatus = getTechnicalStatusPresentation(v.status);
                  const isLatest = v.versionNumber === docDetail.currentVersion?.versionNumber;
                  return (
                    <div
                      key={v.id}
                      className={`p-4 rounded-xl border ${
                        isLight ? 'bg-slate-50 border-zinc-200' : 'bg-zinc-950 border-white/5'
                      } space-y-2`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm">Versão v{v.versionNumber}</span>
                          {isLatest && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                              Mais recente
                            </span>
                          )}
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getBadgeClasses(
                          vTechStatus.tone,
                          theme,
                        )}`}>
                          {vTechStatus.label}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs text-zinc-500">
                        <p>Tamanho: <strong className="text-zinc-800 dark:text-zinc-200">{formatByteSize(v.byteSize)}</strong></p>
                        <p>Tipo: <strong className="text-zinc-800 dark:text-zinc-200">{v.mimeType}</strong></p>
                        <p className="col-span-2">Criado em: {formatDateTime(v.createdAt)}</p>
                      </div>

                      <div className="pt-2 border-t border-zinc-200/50 dark:border-white/5 flex items-center justify-between gap-2">
                        <code className="text-[10px] font-mono text-zinc-400 truncate flex-1">
                          SHA: {v.sha256Hash}
                        </code>
                        <button
                          type="button"
                          onClick={() => handleCopyHash(v.sha256Hash)}
                          className="p-1 rounded border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-all cursor-pointer shrink-0"
                          title="Copiar Hash"
                        >
                          {copiedHash === v.sha256Hash ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-zinc-500 py-6 text-center">Nenhuma versão registada.</p>
            )}
          </div>
        )}

        {/* TAB 3: ASSOCIACOES */}
        {activeTab === 'associations' && (
          <div className="space-y-4">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider block">
              Processos e Domínios Vinculados
            </span>

            {docDetail.associations.length > 0 ? (
              <div className="space-y-3">
                {docDetail.associations.map((assoc) => (
                  <div
                    key={assoc.id}
                    className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                      isLight ? 'bg-slate-50 border-zinc-200' : 'bg-zinc-950 border-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-emerald-600 uppercase">{assoc.targetDomain}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] bg-zinc-200 dark:bg-zinc-800">
                        {assoc.status}
                      </span>
                    </div>
                    <p><span className="text-zinc-500">Recurso:</span> {assoc.targetResourceType} ({assoc.targetResourceId})</p>
                    <p><span className="text-zinc-500">Objetivo:</span> {assoc.purpose}</p>
                    <p className="text-[10px] text-zinc-500">Vinculado em: {formatDateTime(assoc.createdAt)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-zinc-500 text-xs space-y-2">
                <Link2 className="w-8 h-8 mx-auto opacity-40" />
                <p>Este documento não possui processos associados atualmente.</p>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: ATIVIDADE */}
        {activeTab === 'activity' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                Trilha de Auditoria e Eventos Fatuais
              </span>
              <button
                type="button"
                onClick={() => void loadActivity(docDetail.id)}
                disabled={loadingActivity}
                className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-all cursor-pointer p-1"
                title="Atualizar atividade"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingActivity ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {loadingActivity && (
              <div className="py-8 text-center text-xs text-zinc-500 space-y-2">
                <RefreshCw className="w-5 h-5 mx-auto animate-spin text-emerald-600" />
                <p>A carregar histórico...</p>
              </div>
            )}

            {activityError && (
              <div className="p-3 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-500 text-xs">
                {activityError}
              </div>
            )}

            {!loadingActivity && !activityError && activities.length > 0 && (
              <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-200 dark:before:bg-zinc-800">
                {activities.map((act) => (
                  <div key={act.id} className="relative text-xs space-y-1">
                    <div className="absolute -left-6 top-0.5 w-4 h-4 rounded-full bg-emerald-600/20 border-2 border-emerald-600" />
                    <div className="flex items-center justify-between">
                      <span className="font-bold">{act.title}</span>
                      <span className="text-[10px] text-zinc-500">{formatDateTime(act.occurredAt)}</span>
                    </div>
                    <p className="text-zinc-400 leading-relaxed">{act.description}</p>
                    <p className="text-[10px] text-zinc-500">
                      Ator: {act.actorName || (act.actorKind === 'system' ? 'Sistema Automático' : 'Utilizador Institucional')}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {!loadingActivity && !activityError && activities.length === 0 && (
              <p className="text-xs text-zinc-500 py-8 text-center">Nenhuma atividade registada ainda.</p>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
