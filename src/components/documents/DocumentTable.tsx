import React from 'react';
import {
  FileText,
  Eye,
  Download,
  ChevronRight,
  Lock,
  MoreVertical,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  Clock,
  Trash2,
  Upload,
} from 'lucide-react';
import type { Theme, DocumentDto, DocumentOperationalAvailability } from './types.ts';
import {
  formatByteSize,
  formatDate,
  formatDateTime,
  getCategoryLabel,
  getClassificationLabel,
  getTechnicalStatusPresentation,
  getRetentionStatusPresentation,
  getBadgeClasses,
} from './utils.ts';

interface DocumentTableProps {
  documents: DocumentDto[];
  loading: boolean;
  theme: Theme;
  selectedDocumentId: string | null;
  operationalAvailability?: DocumentOperationalAvailability;
  onSelectDocument: (doc: DocumentDto) => void;
  onOpenAccessViewer: (doc: DocumentDto, action: 'open' | 'download') => void;
  onOpenUploadVersion: (doc: DocumentDto) => void;
  onOpenHoldModal: (doc: DocumentDto, mode: 'place' | 'release') => void;
  onOpenDeletionModal: (doc: DocumentDto) => void;
  onOpenUploadModal?: () => void;
}

export default function DocumentTable({
  documents,
  loading,
  theme,
  selectedDocumentId,
  operationalAvailability,
  onSelectDocument,
  onOpenAccessViewer,
  onOpenUploadVersion,
  onOpenHoldModal,
  onOpenDeletionModal,
  onOpenUploadModal,
}: DocumentTableProps) {
  const isLight = theme === 'light';

  if (loading && documents.length === 0) {
    return (
      <div className="space-y-3 py-6">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`h-16 w-full rounded-xl border animate-pulse ${
              isLight ? 'bg-zinc-100 border-zinc-200' : 'bg-zinc-900 border-white/5'
            }`}
          />
        ))}
      </div>
    );
  }

  if (!loading && documents.length === 0) {
    const canUpload = operationalAvailability?.canUpload ?? false;

    return (
      <div
        className={`p-10 text-center rounded-2xl border space-y-4 my-6 ${
          isLight
            ? 'bg-white border-zinc-200 text-zinc-600 shadow-sm'
            : 'bg-zinc-900 border-white/5 text-zinc-400'
        }`}
      >
        <div
          className={`w-14 h-14 mx-auto rounded-2xl flex items-center justify-center ${
            isLight ? 'bg-emerald-50 text-emerald-700' : 'bg-emerald-500/10 text-emerald-400'
          }`}
        >
          <FileText className="w-7 h-7" />
        </div>
        <div className="space-y-1.5 max-w-md mx-auto">
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
            Repositório Documental Institucional
          </h3>
          <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            Área centralizada para gestão de documentos com integridade criptográfica, políticas de retenção e rastreabilidade total.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          {canUpload && onOpenUploadModal ? (
            <button
              type="button"
              onClick={onOpenUploadModal}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-600 text-white shadow-sm transition-all cursor-pointer"
            >
              <Upload className="w-4 h-4" /> Carregar Documento
            </button>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Carregamento documental não configurado nesta instalação.</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* DESKTOP TABLE VIEW */}
      <div
        className={`hidden md:block overflow-hidden rounded-2xl border ${
          isLight ? 'bg-white border-zinc-200 shadow-sm' : 'bg-zinc-900 border-white/10'
        }`}
      >
        <table className="w-full text-left border-collapse">
          <thead>
            <tr
              className={`border-b text-[11px] font-bold uppercase tracking-wider ${
                isLight ? 'border-zinc-200 bg-slate-50/80 text-zinc-500' : 'border-white/5 bg-zinc-950/40 text-zinc-400'
              }`}
            >
              <th scope="col" className="py-3.5 px-4 font-semibold">Documento</th>
              <th scope="col" className="py-3.5 px-4 font-semibold">Categoria</th>
              <th scope="col" className="py-3.5 px-4 font-semibold">Estado Técnico</th>
              <th scope="col" className="py-3.5 px-4 font-semibold">Retenção</th>
              <th scope="col" className="py-3.5 px-4 font-semibold">Associação</th>
              <th scope="col" className="py-3.5 px-4 font-semibold">Tamanho / Versão</th>
              <th scope="col" className="py-3.5 px-4 font-semibold">Atualizado em</th>
              <th scope="col" className="py-3.5 px-4 font-semibold text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200/50 dark:divide-white/5 text-xs">
            {documents.map((doc) => {
              const techStatus = getTechnicalStatusPresentation(
                doc.currentVersion?.status ?? doc.status,
              );
              const retStatus = getRetentionStatusPresentation(
                doc.retention?.retentionStatus,
                doc.retention?.retainUntil,
              );
              const isSelected = selectedDocumentId === doc.id;
              const hasActiveHolds = doc.activeHolds.length > 0;
              const isDeleted = doc.currentVersion?.status === 'deleted' || (doc.status as string) === 'deleted';
              const isQuarantined = doc.currentVersion?.status === 'quarantined';

              const displayName = doc.originalFilename || doc.currentVersion?.declaredFilename || doc.title || getCategoryLabel(doc.category);

              return (
                <tr
                  key={doc.id}
                  onClick={() => onSelectDocument(doc)}
                  className={`transition-colors cursor-pointer ${
                    isSelected
                      ? isLight
                        ? 'bg-emerald-50/60'
                        : 'bg-emerald-500/10'
                      : isLight
                      ? 'hover:bg-slate-50'
                      : 'hover:bg-white/5'
                  }`}
                >
                  {/* Document Name & Original Filename */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2.5 rounded-xl shrink-0 ${
                          isLight ? 'bg-emerald-50 text-emerald-700' : 'bg-emerald-500/10 text-emerald-400'
                        }`}
                      >
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 max-w-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold truncate text-sm text-zinc-900 dark:text-zinc-100" title={displayName}>
                            {displayName}
                          </span>
                          {hasActiveHolds && (
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center gap-1 font-bold shrink-0"
                              title="Possui bloqueio de retenção ativo"
                            >
                              <Lock className="w-3 h-3" /> Bloqueio
                            </span>
                          )}
                        </div>
                        <span className={`text-[11px] font-mono ${isLight ? 'text-zinc-400' : 'text-zinc-500'} truncate block`}>
                          ID: {doc.id.slice(0, 14)}...
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Category & Classification */}
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-white/5">
                      {getCategoryLabel(doc.category)}
                    </span>
                    {doc.classification && (
                      <span className="block text-[10px] text-zinc-500 mt-0.5">
                        {getClassificationLabel(doc.classification)}
                      </span>
                    )}
                  </td>

                  {/* Technical Status */}
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase border ${getBadgeClasses(
                        techStatus.tone,
                        theme,
                      )}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        techStatus.tone === 'emerald' ? 'bg-emerald-500' :
                        techStatus.tone === 'amber' ? 'bg-amber-500' :
                        techStatus.tone === 'rose' ? 'bg-rose-500' : 'bg-zinc-400'
                      }`} />
                      {techStatus.label}
                    </span>
                  </td>

                  {/* Retention Status */}
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${getBadgeClasses(
                        retStatus.tone,
                        theme,
                      )}`}
                    >
                      {retStatus.label}
                    </span>
                  </td>

                  {/* Associations */}
                  <td className="py-3.5 px-4">
                    {doc.associations.length > 0 ? (
                      <div className="flex flex-wrap gap-1 max-w-[180px]">
                        {doc.associations.map((a) => (
                          <span
                            key={a.id}
                            className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 truncate"
                            title={`${a.targetDomain}: ${a.targetEntityName || a.targetResourceId}`}
                          >
                            {a.targetEntityName ? (
                              <strong className="font-semibold">{a.targetEntityName}</strong>
                            ) : (
                              <span>{a.targetDomain === 'student' ? 'Aluno' : a.targetDomain === 'enrollment' ? 'Matrícula' : a.targetDomain}</span>
                            )}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-zinc-400 text-[11px] italic">Sem associação</span>
                    )}
                  </td>

                  {/* Size and Version */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-1.5">
                      {doc.currentVersion && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-zinc-200/60 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                          v{doc.currentVersion.versionNumber}
                        </span>
                      )}
                      <span className="text-xs text-zinc-600 dark:text-zinc-400">
                        {formatByteSize(doc.currentVersion?.byteSize)}
                      </span>
                    </div>
                  </td>

                  {/* Updated At */}
                  <td className="py-3.5 px-4 text-zinc-500 whitespace-nowrap">
                    {formatDate(doc.updatedAt)}
                  </td>

                  {/* Actions Column */}
                  <td className="py-3.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={!doc.capabilities.canOpen || operationalAvailability?.canAccess === false || isDeleted || isQuarantined}
                        onClick={() => onOpenAccessViewer(doc, 'open')}
                        className={`p-2 rounded-lg border transition-all cursor-pointer ${
                          isLight
                            ? 'border-zinc-200 hover:bg-zinc-100 text-zinc-700'
                            : 'border-white/10 hover:bg-white/5 text-zinc-300'
                        } disabled:opacity-30 disabled:cursor-not-allowed`}
                        title={
                          operationalAvailability?.canAccess === false
                            ? 'Acesso/visualização ainda não configurado nesta instalação'
                            : !doc.capabilities.canOpen
                            ? 'Acesso não autorizado pela política'
                            : 'Visualizar Documento (Leitor Institucional)'
                        }
                        aria-label="Visualizar Documento"
                      >
                        <Eye className="w-4 h-4 text-emerald-600" />
                      </button>

                      <button
                        type="button"
                        disabled={!doc.capabilities.canDownload || operationalAvailability?.canAccess === false || isDeleted || isQuarantined}
                        onClick={() => onOpenAccessViewer(doc, 'download')}
                        className={`p-2 rounded-lg border transition-all cursor-pointer ${
                          isLight
                            ? 'border-zinc-200 hover:bg-zinc-100 text-zinc-700'
                            : 'border-white/10 hover:bg-white/5 text-zinc-300'
                        } disabled:opacity-30 disabled:cursor-not-allowed`}
                        title={
                          operationalAvailability?.canAccess === false
                            ? 'Download ainda não configurado nesta instalação'
                            : !doc.capabilities.canDownload
                            ? 'Download não autorizado pela política'
                            : 'Descarregar Documento'
                        }
                        aria-label="Descarregar Documento"
                      >
                        <Download className="w-4 h-4 text-emerald-600" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onSelectDocument(doc)}
                        className={`p-2 rounded-lg border transition-all cursor-pointer ${
                          isLight
                            ? 'border-zinc-200 hover:bg-zinc-100 text-zinc-700'
                            : 'border-white/10 hover:bg-white/5 text-zinc-300'
                        }`}
                        title="Ver Detalhes"
                        aria-label="Ver Detalhes do Documento"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* MOBILE / TABLET CARD VIEW */}
      <div className="md:hidden space-y-3">
        {documents.map((doc) => {
          const techStatus = getTechnicalStatusPresentation(
            doc.currentVersion?.status ?? doc.status,
          );
          const retStatus = getRetentionStatusPresentation(
            doc.retention?.retentionStatus,
            doc.retention?.retainUntil,
          );
          const isSelected = selectedDocumentId === doc.id;
          const hasActiveHolds = doc.activeHolds.length > 0;
          const isDeleted = doc.currentVersion?.status === 'deleted' || (doc.status as string) === 'deleted';
          const isQuarantined = doc.currentVersion?.status === 'quarantined';
          const displayName = doc.originalFilename || doc.currentVersion?.declaredFilename || doc.title || getCategoryLabel(doc.category);

          return (
            <div
              key={doc.id}
              onClick={() => onSelectDocument(doc)}
              className={`p-4 rounded-2xl border space-y-3 transition-all cursor-pointer ${
                isSelected
                  ? isLight
                    ? 'bg-emerald-50/60 border-emerald-500/40'
                    : 'bg-emerald-500/10 border-emerald-500/30'
                  : isLight
                  ? 'bg-white border-zinc-200'
                  : 'bg-zinc-900 border-white/10'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div
                    className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                      isLight ? 'bg-emerald-50 text-emerald-700' : 'bg-emerald-500/10 text-emerald-400'
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm truncate text-zinc-900 dark:text-zinc-100">{displayName}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                        {getCategoryLabel(doc.category)}
                      </span>
                      {hasActiveHolds && (
                        <span className="px-1 py-0.2 rounded text-[9px] bg-amber-500/10 text-amber-500 font-bold border border-amber-500/20">
                          Bloqueio
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border shrink-0 ${getBadgeClasses(
                    techStatus.tone,
                    theme,
                  )}`}
                >
                  {techStatus.label}
                </span>
              </div>

              {/* Associations info if any */}
              {doc.associations.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {doc.associations.map((a) => (
                    <span
                      key={a.id}
                      className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 truncate"
                    >
                      {a.targetEntityName ? a.targetEntityName : a.targetDomain === 'student' ? 'Aluno' : 'Matrícula'}
                    </span>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-xs text-zinc-500 pt-1">
                <div>
                  <span>Retenção:</span>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200 block truncate">
                    {retStatus.label}
                  </span>
                </div>
                <div>
                  <span>Versão & Tamanho:</span>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200 block">
                    v{doc.currentVersion?.versionNumber || 1} ({formatByteSize(doc.currentVersion?.byteSize)})
                  </span>
                </div>
              </div>

              {/* Mobile Action Bar */}
              <div
                className="flex items-center justify-between pt-2 border-t border-zinc-200/50 dark:border-white/5"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!doc.capabilities.canOpen || isDeleted || isQuarantined}
                    onClick={() => onOpenAccessViewer(doc, 'open')}
                    className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center p-2 rounded-lg border border-zinc-200 dark:border-white/10 text-emerald-600 disabled:opacity-30 cursor-pointer"
                    aria-label="Visualizar Documento"
                  >
                    <Eye className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    disabled={!doc.capabilities.canDownload || isDeleted || isQuarantined}
                    onClick={() => onOpenAccessViewer(doc, 'download')}
                    className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center p-2 rounded-lg border border-zinc-200 dark:border-white/10 text-emerald-600 disabled:opacity-30 cursor-pointer"
                    aria-label="Descarregar Documento"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => onSelectDocument(doc)}
                  className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-emerald-700 hover:bg-emerald-600 text-white cursor-pointer transition-colors"
                >
                  Ver Detalhes <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
