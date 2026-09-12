import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  FolderOpen,
  Search,
  Filter,
  RefreshCw,
  Plus,
  ChevronLeft,
  ChevronRight,
  Shield,
  Layers,
  FileCheck,
  AlertCircle,
  X,
  SlidersHorizontal,
} from 'lucide-react';
import type { Theme, DocumentDto, DocumentListFilterState } from './types.ts';
import { fetchDocuments, fetchDocumentDetail } from './api.ts';
import DocumentTable from './DocumentTable.tsx';
import DocumentDetailDrawer from './DocumentDetailDrawer.tsx';
import DocumentUploadModal from './DocumentUploadModal.tsx';
import DocumentHoldModal from './DocumentHoldModal.tsx';
import DocumentDeletionModal from './DocumentDeletionModal.tsx';
import DocumentAccessViewer from './DocumentAccessViewer.tsx';
import { getCategoryLabel } from './utils.ts';

interface DocumentsWorkspaceProps {
  theme?: Theme;
}

export default function DocumentsWorkspace({ theme = 'dark' }: DocumentsWorkspaceProps) {
  const isLight = theme === 'light';

  // Filters State
  const [filters, setFilters] = useState<DocumentListFilterState>({
    search: '',
    category: 'all',
    technicalStatus: 'all',
    retentionStatus: 'all',
    holdStatus: 'all',
    associationDomain: 'all',
    updatedFrom: '',
    updatedTo: '',
    page: 1,
    limit: 20,
  });

  const [documents, setDocuments] = useState<DocumentDto[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active Document / Drawer State
  const [selectedDocument, setSelectedDocument] = useState<DocumentDto | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Modals State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadTargetDoc, setUploadTargetDoc] = useState<DocumentDto | null>(null);

  const [isHoldModalOpen, setIsHoldModalOpen] = useState(false);
  const [holdModalMode, setHoldModalMode] = useState<'place' | 'release'>('place');

  const [isDeletionModalOpen, setIsDeletionModalOpen] = useState(false);

  const [isAccessViewerOpen, setIsAccessViewerOpen] = useState(false);
  const [accessViewerAction, setAccessViewerAction] = useState<'open' | 'download'>('open');

  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const selectedDocumentIdRef = useRef<string | null>(null);
  selectedDocumentIdRef.current = selectedDocument?.id ?? null;

  const loadData = useCallback(async () => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const response = await fetchDocuments(filters, controller.signal);
      setDocuments(response.items);
      setTotalCount(response.total);

      // Re-sync selected document if open, without retriggering loadData
      const currentSelectedId = selectedDocumentIdRef.current;
      if (currentSelectedId) {
        const updatedSelected = response.items.find((d) => d.id === currentSelectedId);
        if (updatedSelected) {
          setSelectedDocument((prev) => (prev?.id === currentSelectedId ? updatedSelected : prev));
        }
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : 'Não foi possível carregar os documentos.');
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [filters]);

  useEffect(() => {
    void loadData();
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [loadData]);

  const handleSelectCategoryTab = (cat: string) => {
    setFilters((prev) => ({
      ...prev,
      category: cat,
      page: 1,
    }));
  };

  const handleSearchChange = (val: string) => {
    setFilters((prev) => ({
      ...prev,
      search: val,
      page: 1,
    }));
  };

  const handleResetFilters = () => {
    setFilters({
      search: '',
      category: 'all',
      technicalStatus: 'all',
      retentionStatus: 'all',
      holdStatus: 'all',
      associationDomain: 'all',
      updatedFrom: '',
      updatedTo: '',
      page: 1,
      limit: 20,
    });
  };

  const handleOpenUploadNew = () => {
    setUploadTargetDoc(null);
    setIsUploadModalOpen(true);
  };

  const handleOpenUploadVersion = (doc: DocumentDto) => {
    setUploadTargetDoc(doc);
    setIsUploadModalOpen(true);
  };

  const handleSelectDocument = (doc: DocumentDto) => {
    setSelectedDocument(doc);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
  };

  const handleOpenAccessViewer = (doc: DocumentDto, action: 'open' | 'download') => {
    setSelectedDocument(doc);
    setAccessViewerAction(action);
    setIsAccessViewerOpen(true);
  };

  const handleOpenHoldModal = (doc: DocumentDto, mode: 'place' | 'release') => {
    setSelectedDocument(doc);
    setHoldModalMode(mode);
    setIsHoldModalOpen(true);
  };

  const handleOpenDeletionModal = (doc: DocumentDto) => {
    setSelectedDocument(doc);
    setIsDeletionModalOpen(true);
  };

  const dynamicCategoryTabs = useMemo(() => {
    const set = new Set<string>();
    for (const doc of documents) {
      if (doc.category) {
        set.add(doc.category);
      }
    }
    if (filters.category && filters.category !== 'all') {
      set.add(filters.category);
    }
    const list = Array.from(set).map((cat) => ({
      id: cat,
      label: getCategoryLabel(cat),
    }));
    return [{ id: 'all', label: 'Todos os Documentos' }, ...list];
  }, [documents, filters.category]);

  const totalPages = Math.max(1, Math.ceil(totalCount / filters.limit));

  return (
    <div
      className="min-w-0 max-w-full space-y-6 pb-12"
      aria-label="Workspace institucional de Documentos"
    >
      {/* 1. WORKSPACE HEADER */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-[11px] font-semibold ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
              Início &gt; <strong className={isLight ? 'text-zinc-800' : 'text-zinc-200'}>Documentos</strong>
            </span>
            <span className="text-zinc-400">•</span>
            <span className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
              NEXUS EDU IA
            </span>
          </div>
          <h1
            className={`text-2xl lg:text-3xl font-bold tracking-tight ${
              isLight ? 'text-zinc-900' : 'text-zinc-100'
            }`}
          >
            Documentos
          </h1>
          <p className={`max-w-3xl text-xs sm:text-sm leading-relaxed ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
            Gerencie, consulte e compartilhe documentos institucionais com segurança.
          </p>
        </div>

        {/* Global Header Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
              isLight
                ? 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                : 'border-white/10 bg-zinc-900 text-zinc-300 hover:bg-white/5'
            } disabled:opacity-50`}
            title="Atualizar lista de documentos"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>

          <button
            type="button"
            onClick={handleOpenUploadNew}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-700/20 active:scale-[0.98] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Carregar Documento</span>
          </button>
        </div>
      </header>

      {/* 2. CATEGORY TABS (DYNAMICALLY DISCOVERED) */}
      <nav
        className={`flex max-w-full gap-1 overflow-x-auto border-b pb-2.5 ${
          isLight ? 'border-zinc-200' : 'border-white/10'
        }`}
        aria-label="Categorias de documentos"
      >
        {dynamicCategoryTabs.map((tab) => {
          const isActive = filters.category === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleSelectCategoryTab(tab.id)}
              className={`min-h-[40px] whitespace-nowrap rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
                isActive
                  ? isLight
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-sm'
                    : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : isLight
                  ? 'text-zinc-600 hover:bg-zinc-100'
                  : 'text-zinc-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* 3. SEARCH & FILTERS BAR */}
      <section
        className={`p-4 rounded-2xl border space-y-3 ${
          isLight ? 'bg-white border-zinc-200 shadow-sm' : 'bg-zinc-900 border-white/10'
        }`}
        aria-label="Filtros de pesquisa documental"
      >
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Pesquisar por categoria, classificação ou identificador..."
              className={`w-full h-11 pl-10 pr-4 rounded-xl border text-xs outline-none transition-all ${
                isLight
                  ? 'bg-slate-50 border-zinc-200 text-zinc-900 focus:bg-white focus:border-emerald-600'
                  : 'bg-zinc-950 border-white/10 text-zinc-100 focus:border-emerald-500'
              }`}
            />
          </div>

          {/* Filter Selects (Desktop) */}
          <div className="hidden lg:flex items-center gap-2.5">
            {/* Technical Status Filter */}
            <select
              value={filters.technicalStatus}
              onChange={(e) => setFilters((p) => ({ ...p, technicalStatus: e.target.value, page: 1 }))}
              className={`h-11 px-3 rounded-xl border text-xs outline-none cursor-pointer ${
                isLight
                  ? 'bg-slate-50 border-zinc-200 text-zinc-900'
                  : 'bg-zinc-950 border-white/10 text-zinc-100'
              }`}
            >
              <option value="all">Estado: Todos</option>
              <option value="available">Disponível</option>
              <option value="pending_verification">Verificação pendente</option>
              <option value="quarantined">Em quarentena</option>
              <option value="deleted">Eliminado</option>
            </select>

            {/* Retention Status Filter */}
            <select
              value={filters.retentionStatus}
              onChange={(e) => setFilters((p) => ({ ...p, retentionStatus: e.target.value, page: 1 }))}
              className={`h-11 px-3 rounded-xl border text-xs outline-none cursor-pointer ${
                isLight
                  ? 'bg-slate-50 border-zinc-200 text-zinc-900'
                  : 'bg-zinc-950 border-white/10 text-zinc-100'
              }`}
            >
              <option value="all">Retenção: Todas</option>
              <option value="active">Retenção Ativa</option>
              <option value="expired">Prazo Expirado</option>
              <option value="permanent">Conservação Permanente</option>
            </select>

            {/* Hold Status Filter */}
            <select
              value={filters.holdStatus}
              onChange={(e) => setFilters((p) => ({ ...p, holdStatus: e.target.value as any, page: 1 }))}
              className={`h-11 px-3 rounded-xl border text-xs outline-none cursor-pointer ${
                isLight
                  ? 'bg-slate-50 border-zinc-200 text-zinc-900'
                  : 'bg-zinc-950 border-white/10 text-zinc-100'
              }`}
            >
              <option value="all">Bloqueios: Todos</option>
              <option value="active">Com Bloqueio Ativo</option>
              <option value="released">Com Bloqueio Libertado</option>
              <option value="none">Sem Bloqueios</option>
            </select>

            {/* Reset Filters */}
            <button
              type="button"
              onClick={handleResetFilters}
              className={`h-11 px-3.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                isLight
                  ? 'border-zinc-200 hover:bg-zinc-100 text-zinc-600'
                  : 'border-white/10 hover:bg-white/5 text-zinc-400'
              }`}
              title="Limpar todos os filtros"
            >
              Limpar
            </button>
          </div>

          {/* Mobile Filters Toggle Button */}
          <div className="lg:hidden flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              className={`flex-1 h-11 inline-flex items-center justify-center gap-2 rounded-xl border text-xs font-semibold ${
                isLight
                  ? 'border-zinc-200 bg-slate-50 text-zinc-800'
                  : 'border-white/10 bg-zinc-950 text-zinc-200'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>{showMobileFilters ? 'Ocultar Filtros' : 'Filtros Avançados'}</span>
            </button>
            <button
              type="button"
              onClick={handleResetFilters}
              className="h-11 px-3 rounded-xl border border-zinc-200 dark:border-white/10 text-xs font-semibold text-zinc-500"
            >
              Limpar
            </button>
          </div>
        </div>

        {/* Mobile Filters Drawer Expansion */}
        {showMobileFilters && (
          <div className="lg:hidden grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-3 border-t border-zinc-200/50 dark:border-white/5">
            <div>
              <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Estado Técnico</label>
              <select
                value={filters.technicalStatus}
                onChange={(e) => setFilters((p) => ({ ...p, technicalStatus: e.target.value, page: 1 }))}
                className="w-full h-10 px-2.5 rounded-lg border text-xs bg-zinc-100 dark:bg-zinc-950 border-zinc-200 dark:border-white/10"
              >
                <option value="all">Todos</option>
                <option value="available">Disponível</option>
                <option value="pending_verification">Aguardando Verificação</option>
                <option value="quarantined">Em Quarentena</option>
                <option value="deleted">Eliminado</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Retenção</label>
              <select
                value={filters.retentionStatus}
                onChange={(e) => setFilters((p) => ({ ...p, retentionStatus: e.target.value, page: 1 }))}
                className="w-full h-10 px-2.5 rounded-lg border text-xs bg-zinc-100 dark:bg-zinc-950 border-zinc-200 dark:border-white/10"
              >
                <option value="all">Todas</option>
                <option value="active">Retenção Ativa</option>
                <option value="expired">Prazo Expirado</option>
                <option value="permanent">Conservação Permanente</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Bloqueios</label>
              <select
                value={filters.holdStatus}
                onChange={(e) => setFilters((p) => ({ ...p, holdStatus: e.target.value as any, page: 1 }))}
                className="w-full h-10 px-2.5 rounded-lg border text-xs bg-zinc-100 dark:bg-zinc-950 border-zinc-200 dark:border-white/10"
              >
                <option value="all">Todos</option>
                <option value="active">Com Bloqueio Ativo</option>
                <option value="released">Com Bloqueio Libertado</option>
                <option value="none">Sem Bloqueios</option>
              </select>
            </div>
          </div>
        )}
      </section>

      {/* ERROR BANNER */}
      {error && (
        <div className="p-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="font-semibold">{error}</span>
          </div>
          <button
            type="button"
            onClick={() => void loadData()}
            className="px-3 py-1 rounded-lg border border-rose-500/30 font-bold hover:bg-rose-500/20 transition-all cursor-pointer"
          >
            Tentar Novamente
          </button>
        </div>
      )}

      {/* 4. DOCUMENT TABLE */}
      <DocumentTable
        documents={documents}
        loading={loading}
        theme={theme}
        selectedDocumentId={selectedDocument?.id ?? null}
        onSelectDocument={handleSelectDocument}
        onOpenAccessViewer={handleOpenAccessViewer}
        onOpenUploadVersion={handleOpenUploadVersion}
        onOpenHoldModal={handleOpenHoldModal}
        onOpenDeletionModal={handleOpenDeletionModal}
      />

      {/* 5. PAGINATION */}
      {totalCount > 0 && (
        <div
          className={`flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl border ${
            isLight ? 'bg-white border-zinc-200' : 'bg-zinc-900 border-white/10'
          }`}
        >
          <div className="text-xs text-zinc-500">
            A apresentar <span className="font-semibold text-zinc-800 dark:text-zinc-200">{documents.length}</span> de{' '}
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">{totalCount}</span> documentos
            {totalPages > 1 && ` (Página ${filters.page} de ${totalPages})`}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={filters.page <= 1 || loading}
              onClick={() => setFilters((p) => ({ ...p, page: Math.max(1, p.page - 1) }))}
              className={`inline-flex items-center gap-1 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                isLight
                  ? 'border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700'
                  : 'border-white/10 bg-zinc-800 hover:bg-white/5 text-zinc-300'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <ChevronLeft className="w-4 h-4" /> Anterior
            </button>

            <span className="text-xs font-mono font-bold px-2">
              {filters.page} / {totalPages}
            </span>

            <button
              type="button"
              disabled={filters.page >= totalPages || loading}
              onClick={() => setFilters((p) => ({ ...p, page: p.page + 1 }))}
              className={`inline-flex items-center gap-1 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                isLight
                  ? 'border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700'
                  : 'border-white/10 bg-zinc-800 hover:bg-white/5 text-zinc-300'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              Próximo <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 6. RIGHT DETAIL DRAWER */}
      <DocumentDetailDrawer
        isOpen={isDrawerOpen}
        theme={theme}
        document={selectedDocument}
        onClose={handleCloseDrawer}
        onOpenUploadVersion={handleOpenUploadVersion}
        onOpenAccessViewer={handleOpenAccessViewer}
        onOpenHoldModal={handleOpenHoldModal}
        onOpenDeletionModal={handleOpenDeletionModal}
        onRefreshDocument={() => void loadData()}
      />

      {/* 7. UPLOAD MODAL */}
      <DocumentUploadModal
        isOpen={isUploadModalOpen}
        theme={theme}
        targetDocument={uploadTargetDoc}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={(docId) => {
          void loadData();
          if (docId) {
            void fetchDocumentDetail(docId).then((doc) => {
              setSelectedDocument(doc);
              setIsDrawerOpen(true);
            });
          }
        }}
      />

      {/* 8. RETENTION HOLD MODAL */}
      {selectedDocument && (
        <DocumentHoldModal
          isOpen={isHoldModalOpen}
          theme={theme}
          document={selectedDocument}
          mode={holdModalMode}
          targetHold={selectedDocument.activeHolds[0] || null}
          onClose={() => setIsHoldModalOpen(false)}
          onSuccess={() => void loadData()}
        />
      )}

      {/* 9. DELETION MODAL */}
      {selectedDocument && (
        <DocumentDeletionModal
          isOpen={isDeletionModalOpen}
          theme={theme}
          document={selectedDocument}
          onClose={() => setIsDeletionModalOpen(false)}
          onSuccess={() => {
            handleCloseDrawer();
            void loadData();
          }}
        />
      )}

      {/* 10. SECURE ACCESS VIEWER / DOWNLOADER */}
      {selectedDocument && (
        <DocumentAccessViewer
          isOpen={isAccessViewerOpen}
          theme={theme}
          document={selectedDocument}
          action={accessViewerAction}
          onClose={() => setIsAccessViewerOpen(false)}
        />
      )}
    </div>
  );
}
