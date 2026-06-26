import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckSquare, 
  Clock, 
  TrendingUp, 
  ArrowRight, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Plus, 
  Search, 
  Filter, 
  User, 
  Calendar, 
  FileText, 
  MessageSquare, 
  Settings, 
  Send,
  RotateCcw,
  Eye,
  ArrowUpDown,
  CornerDownRight,
  ShieldAlert,
  HelpCircle,
  FileCheck2
} from 'lucide-react';
import { ApprovalRequest, ApprovalStatus, ApprovalFlowType, UserRole, ApprovalHistoryEntry } from '../types';

interface InstitutionalApprovalsProps {
  currentUserRole: UserRole;
  currentUserName: string;
  approvals: ApprovalRequest[];
  onCreateApproval: (title: string, description: string, flowType: ApprovalFlowType) => Promise<void>;
  onTransitionApproval: (id: string, action: 'analyze' | 'approve' | 'reject' | 'request_revision' | 'resubmit', comment: string) => Promise<void>;
  isLoading: boolean;
}

export default function InstitutionalApprovals({
  currentUserRole,
  currentUserName,
  approvals,
  onCreateApproval,
  onTransitionApproval,
  isLoading
}: InstitutionalApprovalsProps) {
  const [activeSubTab, setActiveSubTab] = useState<'all' | 'pending_me' | 'my_requests' | 'history'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [flowFilter, setFlowFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newFlowType, setNewFlowType] = useState<ApprovalFlowType>('secretariat_to_director');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Selected Request detail drawer state
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);
  const [actionComment, setActionComment] = useState('');
  const [isActionSubmitting, setIsActionSubmitting] = useState(false);

  // Column width state for Institutional Approvals
  const [appColWidths, setAppColWidths] = useState<Record<string, number>>({
    id: 110,
    title: 240,
    flow: 180,
    requester: 160,
    date: 150,
    status: 160,
    actions: 110
  });

  const startAppResize = (field: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = appColWidths[field] || 150;

    const doResize = (moveEvent: MouseEvent) => {
      const currentX = moveEvent.clientX;
      const newWidth = Math.max(75, startWidth + (currentX - startX));
      setAppColWidths(prev => ({ ...prev, [field]: newWidth }));
    };

    const stopResize = () => {
      document.removeEventListener('mousemove', doResize);
      document.removeEventListener('mouseup', stopResize);
    };

    document.addEventListener('mousemove', doResize);
    document.addEventListener('mouseup', stopResize);
  };

  // Flow role permissions helper
  // Secretariat -> Director: only Secretariat can create, Director can approve
  // Teacher -> Director: only Teacher can create, Director can approve
  // Financial -> Director: only Financial can create, Director can approve
  const canCreateFlowType = (flow: ApprovalFlowType): boolean => {
    if (currentUserRole === 'admin') return true;
    if (flow === 'secretariat_to_director' && currentUserRole === 'secretariat') return true;
    if (flow === 'teacher_to_director' && currentUserRole === 'teacher') return true;
    if (flow === 'financial_to_director' && currentUserRole === 'financial') return true;
    return false;
  };

  const getFlowTypeBadgeLabel = (flow: ApprovalFlowType) => {
    switch(flow) {
      case 'secretariat_to_director': return 'Secretaria ➔ Direção';
      case 'teacher_to_director': return 'Professor ➔ Direção';
      case 'financial_to_director': return 'Financeiro ➔ Direção';
      default: return flow;
    }
  };

  const getStatusDetails = (status: ApprovalStatus) => {
    switch(status) {
      case 'pending':
        return { label: 'Pendente', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', icon: Clock };
      case 'analyzing':
        return { label: 'Em análise', color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20', icon: Eye };
      case 'approved':
        return { label: 'Aprovado', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle };
      case 'rejected':
        return { label: 'Rejeitado', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20', icon: XCircle };
      case 'revision_requested':
        return { label: 'Correções Solicitadas', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20', icon: RotateCcw };
      default:
        return { label: status, color: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20', icon: HelpCircle };
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'create': return 'Submetido';
      case 'analyze': return 'Marcar como Em Análise';
      case 'approve': return 'Aprovado';
      case 'reject': return 'Rejeitado';
      case 'request_revision': return 'Correção Solicitada';
      case 'resubmit': return 'Re-submetido para Análise';
      default: return action;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'create': return 'text-zinc-450';
      case 'analyze': return 'text-indigo-400';
      case 'approve': return 'text-emerald-400';
      case 'reject': return 'text-rose-400';
      case 'request_revision': return 'text-purple-400';
      case 'resubmit': return 'text-amber-400';
      default: return 'text-zinc-300';
    }
  };

  // Helper: check if current user is the authorized decision maker
  // Flow is typically to 'director' (so Director or Admin can approve)
  const canDecide = (request: ApprovalRequest): boolean => {
    if (currentUserRole === 'admin') return true;
    if (currentUserRole === 'director') return true;
    return false;
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDescription.trim()) {
      setFormError('Por favor preencha o título e a descrição.');
      return;
    }
    setFormError('');
    setIsSubmitting(true);
    try {
      await onCreateApproval(newTitle, newDescription, newFlowType);
      setNewTitle('');
      setNewDescription('');
      setIsCreateOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Erro ao submeter o processo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleActionRun = async (action: 'analyze' | 'approve' | 'reject' | 'request_revision' | 'resubmit') => {
    if (!selectedRequest) return;
    if ((action === 'reject' || action === 'request_revision') && !actionComment.trim()) {
      alert('Favor adicionar um comentário explicando o motivo da rejeição ou correções solicitadas.');
      return;
    }

    setIsActionSubmitting(true);
    try {
      await onTransitionApproval(selectedRequest.id, action, actionComment);
      setActionComment('');
      // Find updated
      const updated = approvals.find(a => a.id === selectedRequest.id);
      if (updated) {
        setSelectedRequest(updated);
      } else {
        setSelectedRequest(null);
      }
    } catch (err: any) {
      alert(err.message || 'Erro ao processar transição.');
    } finally {
      setIsActionSubmitting(false);
    }
  };

  // Filter processes
  const filteredApprovals = approvals.filter(req => {
    // 1. Search term match
    const matchesSearch = 
      req.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.requesterName.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    // 2. Flow Filter
    if (flowFilter !== 'all' && req.flowType !== flowFilter) return false;

    // 3. Status Filter
    if (statusFilter !== 'all' && req.status !== statusFilter) return false;

    // 4. Sub TAB rules
    if (activeSubTab === 'pending_me') {
      // Pending actions for Direção/Admin
      const isPendingDecision = req.status === 'pending' || req.status === 'analyzing';
      if (currentUserRole === 'director' || currentUserRole === 'admin') {
        return isPendingDecision;
      } else {
        // If teacher/secretariat/financial, show their own requests that are pending
        return isPendingDecision && req.requesterName === currentUserName;
      }
    }

    if (activeSubTab === 'my_requests') {
      return req.requesterName === currentUserName;
    }

    if (activeSubTab === 'history') {
      return req.status === 'approved' || req.status === 'rejected';
    }

    return true;
  });

  // Calculate statistics counts
  const countPending = approvals.filter(req => req.status === 'pending' || req.status === 'analyzing').length;
  const countApproved = approvals.filter(req => req.status === 'approved').length;
  const countRejected = approvals.filter(req => req.status === 'rejected').length;

  return (
    <div className="space-y-6 text-left">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/10">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-zinc-100 tracking-tight">Sistema de Aprovações Institucionais</h1>
          </div>
          <p className="text-xs text-zinc-400">Formalização, compliance e rastreabilidade integral de fluxos de processos administrativos e docentes.</p>
        </div>

        {/* Trigger request button */}
        {(currentUserRole === 'admin' || currentUserRole === 'secretariat' || currentUserRole === 'teacher' || currentUserRole === 'financial') && (
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold font-sans shadow-lg transition-all transform hover:-translate-y-0.5 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            Novo Pedido de Aprovação
          </button>
        )}
      </div>

      {/* METRIC CARDS / STATUS CHANNELS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-zinc-900/60 border border-zinc-850 rounded-2xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-mono font-bold text-zinc-450 uppercase tracking-widest">Em Tramitação</span>
            <div className="text-2xl font-bold text-amber-450">{countPending}</div>
          </div>
          <div className="p-3 bg-amber-500/5 text-amber-400 border border-amber-500/10 rounded-xl">
            <Clock className="w-5 h-5 animate-pulse" />
          </div>
        </div>

        <div className="p-4 bg-zinc-900/60 border border-zinc-850 rounded-2xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-mono font-bold text-zinc-450 uppercase tracking-widest">Processos Aprovados</span>
            <div className="text-2xl font-bold text-emerald-450">{countApproved}</div>
          </div>
          <div className="p-3 bg-emerald-500/5 text-emerald-400 border border-emerald-500/10 rounded-xl">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-zinc-900/60 border border-zinc-850 rounded-2xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-mono font-bold text-zinc-450 uppercase tracking-widest">Processos Recusados</span>
            <div className="text-2xl font-bold text-rose-450">{countRejected}</div>
          </div>
          <div className="p-3 bg-rose-500/5 text-rose-400 border border-rose-500/10 rounded-xl">
            <XCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* WORKING SPACE TABS & FILTERS */}
      <div className="bg-zinc-950 border border-zinc-850 rounded-2xl p-4 sm:p-6 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zinc-855 pb-4">
          <div className="flex flex-wrap gap-2">
            {(['all', 'pending_me', 'my_requests', 'history'] as const).map((tab) => {
              const tabLabels = {
                all: 'Todos os Pedidos',
                pending_me: (currentUserRole === 'director' || currentUserRole === 'admin') ? 'Pendente de Ações' : 'Pendentes Próprios',
                my_requests: 'Submetidos por Mim',
                history: 'Histórico Concluído'
              };
              const isActive = activeSubTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveSubTab(tab)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    isActive
                      ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/25 shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-250'
                  }`}
                >
                  {tabLabels[tab]}
                </button>
              );
            })}
          </div>

          {/* Granular searching / Filter selectors */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-60">
              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-zinc-500" />
              <input
                type="text"
                placeholder="Pesquisar ID, título, autor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl pl-9 pr-4 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 outline-none focus:border-zinc-700"
              />
            </div>

            <select
              value={flowFilter}
              onChange={(e) => setFlowFilter(e.target.value)}
              className="bg-zinc-900/50 border border-zinc-800 text-zinc-400 text-xs rounded-xl px-3 py-1.5 outline-none cursor-pointer focus:border-zinc-700 font-sans"
            >
              <option value="all">Todos os Fluxos</option>
              <option value="secretariat_to_director">Secretaria ➔ Direção</option>
              <option value="teacher_to_director">Professor ➔ Direção</option>
              <option value="financial_to_director">Financeiro ➔ Direção</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-zinc-900/50 border border-zinc-800 text-zinc-400 text-xs rounded-xl px-3 py-1.5 outline-none cursor-pointer focus:border-zinc-700 font-sans"
            >
              <option value="all">Todos os Estados</option>
              <option value="pending">Pendente</option>
              <option value="analyzing">Em análise</option>
              <option value="approved">Aprovado</option>
              <option value="rejected">Rejeitado</option>
              <option value="revision_requested">Correções Solicitadas</option>
            </select>
          </div>
        </div>

        {/* LIST TABLE AREA with sticky headers, horizontal scroll, and resizable columns */}
        <div className="overflow-x-auto scrollbar-thin rounded-xl border border-zinc-800 bg-zinc-900/10">
          <table className="w-full text-left border-collapse" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr className="border-b border-zinc-850/45 bg-zinc-950/40 text-[10.5px] font-mono tracking-wider text-zinc-500 uppercase">
                {[
                  { key: 'id', label: 'Processo ID' },
                  { key: 'title', label: 'Título do Pedido' },
                  { key: 'flow', label: 'Fluxo Trâmite' },
                  { key: 'requester', label: 'Requerente' },
                  { key: 'date', label: 'Data Entrada' },
                  { key: 'status', label: 'Estado' },
                  { key: 'actions', label: 'Ações', align: 'right' }
                ].map(h => {
                  const width = appColWidths[h.key] || 150;
                  return (
                    <th 
                      key={h.key}
                      style={{ width, minWidth: width, maxWidth: width }}
                      className={`py-3.5 px-4 font-bold relative group select-none hover:bg-zinc-900/30 transition-colors ${
                        h.align === 'right' ? 'text-right' : h.align === 'center' ? 'text-center' : 'text-left'
                      }`}
                    >
                      <span title={h.label} className="truncate block">{h.label}</span>
                      {h.key !== 'actions' && (
                        <div 
                          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-indigo-500 bg-zinc-800/30 z-20 transition-colors"
                          onMouseDown={(e) => startAppResize(h.key, e)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-850/30">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-zinc-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4.5 h-4.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                      Carregando fluxos de aprovação...
                    </div>
                  </td>
                </tr>
              ) : filteredApprovals.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-zinc-500">
                    Nenhum pedido de aprovação localizado nos parâmetros informados.
                  </td>
                </tr>
              ) : (
                filteredApprovals.map((req) => {
                  const statusInfo = getStatusDetails(req.status);
                  const StatusIcon = statusInfo.icon;
                  return (
                    <tr 
                      key={req.id} 
                      className="hover:bg-zinc-900/20 text-xs transition-colors group cursor-pointer"
                      onClick={() => setSelectedRequest(req)}
                    >
                      <td 
                        style={{ width: appColWidths['id'], minWidth: appColWidths['id'], maxWidth: appColWidths['id'] }}
                        className="py-4 px-4 font-mono font-bold text-indigo-400 truncate"
                        title={req.id}
                      >
                        {req.id}
                      </td>
                      <td 
                        style={{ width: appColWidths['title'], minWidth: appColWidths['title'], maxWidth: appColWidths['title'] }}
                        className="py-4 px-4 truncate"
                        title={`${req.title}\n\n${req.description}`}
                      >
                        <div className="space-y-0.5 truncate">
                          <p className="font-semibold text-zinc-200 group-hover:text-white transition-colors truncate">{req.title}</p>
                          <p className="text-[11px] text-zinc-450 truncate">{req.description}</p>
                        </div>
                      </td>
                      <td 
                        style={{ width: appColWidths['flow'], minWidth: appColWidths['flow'], maxWidth: appColWidths['flow'] }}
                        className="py-4 px-4 truncate"
                        title={getFlowTypeBadgeLabel(req.flowType)}
                      >
                        <span className="px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-400 font-medium text-[10px] inline-block max-w-full truncate">
                          {getFlowTypeBadgeLabel(req.flowType)}
                        </span>
                      </td>
                      <td 
                        style={{ width: appColWidths['requester'], minWidth: appColWidths['requester'], maxWidth: appColWidths['requester'] }}
                        className="py-4 px-4 truncate"
                        title={`${req.requesterName} (${req.requesterRole})`}
                      >
                        <div className="space-y-0.5 truncate">
                          <p className="font-medium text-zinc-300 truncate">{req.requesterName}</p>
                          <p className="text-[10px] font-mono uppercase text-zinc-500 truncate">{req.requesterRole}</p>
                        </div>
                      </td>
                      <td 
                        style={{ width: appColWidths['date'], minWidth: appColWidths['date'], maxWidth: appColWidths['date'] }}
                        className="py-4 px-4 text-zinc-450 font-mono truncate"
                        title={`${req.createdAtDate} às ${req.createdAtTime}`}
                      >
                        <div className="space-y-0.5 truncate">
                          <p className="truncate">{req.createdAtDate}</p>
                          <p className="text-[10px] truncate">{req.createdAtTime}</p>
                        </div>
                      </td>
                      <td 
                        style={{ width: appColWidths['status'], minWidth: appColWidths['status'], maxWidth: appColWidths['status'] }}
                        className="py-4 px-4 text-center truncate"
                        title={statusInfo.label}
                      >
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-mono tracking-wide ${statusInfo.color}`}>
                          <StatusIcon className="w-3 h-3 shrink-0" />
                          {statusInfo.label}
                        </span>
                      </td>
                      <td 
                        style={{ width: appColWidths['actions'], minWidth: appColWidths['actions'], maxWidth: appColWidths['actions'] }}
                        className="py-4 px-4 text-right" 
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => setSelectedRequest(req)}
                          className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white font-semibold rounded-lg text-[11px] cursor-pointer transition-colors"
                        >
                          Analisar
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAIL DRAWER / POPUP WITH HISTORIC LOG TRAIL */}
      <AnimatePresence>
        {selectedRequest && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-end">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-full max-w-xl bg-zinc-950 border-l border-zinc-850 h-screen overflow-y-auto p-6 md:p-8 space-y-6 flex flex-col shadow-2xl text-left"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-zinc-850 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-md border border-indigo-500/20">{selectedRequest.id}</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9.5px] font-mono ${getStatusDetails(selectedRequest.status).color}`}>
                      {getStatusDetails(selectedRequest.status).label}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-zinc-150 leading-snug">{selectedRequest.title}</h3>
                </div>
                <button
                  onClick={() => {
                    setSelectedRequest(null);
                    setActionComment('');
                  }}
                  className="p-1 px-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors rounded-lg text-xs font-bold cursor-pointer"
                >
                  Fechar
                </button>
              </div>

              {/* Flow Path Visualization */}
              <div className="p-4 bg-zinc-900/30 border border-zinc-850 rounded-xl space-y-3">
                <span className="text-[10px] font-mono font-bold text-zinc-450 uppercase tracking-widest block">Vínculo de Transição Institucional</span>
                <div className="flex items-center justify-between items-center text-xs">
                  <div className="p-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-center space-y-0.5 flex-1 max-w-[150px]">
                    <p className="font-bold text-zinc-300">
                      {selectedRequest.flowType === 'secretariat_to_director' ? 'Secretaria' : 
                       selectedRequest.flowType === 'teacher_to_director' ? 'Docente' : 'Financeiro'}
                    </p>
                    <p className="text-[9px] font-mono text-zinc-500">REQUERENTE</p>
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-center relative px-2">
                    <p className="text-[10px] font-mono text-indigo-400/80 mb-1">{getStatusDetails(selectedRequest.status).label}</p>
                    <div className="w-full flex items-center">
                      <div className="h-[2px] bg-zinc-800 flex-1"></div>
                      <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        selectedRequest.status === 'approved' ? 'bg-emerald-500 border-emerald-500 animate-pulse' :
                        selectedRequest.status === 'rejected' ? 'bg-rose-500 border-rose-500' : 'bg-indigo-500 border-indigo-500 animate-pulse'
                      }`}></div>
                      <div className="h-[2px] bg-zinc-800 flex-1"></div>
                    </div>
                  </div>
                  <div className="p-2.5 bg-zinc-950 border border-indigo-500/10 rounded-lg text-center space-y-0.5 flex-1 max-w-[150px]">
                    <p className="font-bold text-zinc-300">Direção Geral</p>
                    <p className="text-[9px] font-mono text-indigo-400">DECISOR</p>
                  </div>
                </div>
              </div>

              {/* Description body */}
              <div className="space-y-1.5 flex-1">
                <span className="text-[10px] font-mono font-bold text-zinc-450 uppercase tracking-widest block">Detalhes do Pedido</span>
                <div className="text-xs text-zinc-300 leading-relaxed font-sans bg-zinc-900/20 border border-zinc-900 p-4 rounded-xl whitespace-pre-wrap">
                  {selectedRequest.description}
                </div>
                <div className="flex items-center gap-4 text-[10.5px] font-mono text-zinc-500 pt-2 px-1">
                  <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> {selectedRequest.requesterName} ({selectedRequest.requesterRole.toUpperCase()})</span>
                  <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {selectedRequest.createdAtDate} {selectedRequest.createdAtTime}</span>
                </div>
              </div>

              {/* ACTIONS CONTROL PANEL */}
              {canDecide(selectedRequest) && (selectedRequest.status === 'pending' || selectedRequest.status === 'analyzing' || selectedRequest.status === 'revision_requested') && (
                <div className="p-4 bg-zinc-900/40 border border-zinc-850 rounded-xl space-y-4">
                  <span className="text-[10px] font-mono font-bold text-zinc-250 uppercase tracking-widest block">Painel Executivo de Decisão</span>
                  
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-mono text-zinc-400 block font-bold">Escreva um parecer ou comentário:</label>
                    <textarea
                      placeholder="Parecer crítico legal, comentários ou directivas de alteração..."
                      value={actionComment}
                      onChange={(e) => setActionComment(e.target.value)}
                      rows={2}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 outline-none focus:border-zinc-700"
                    />
                  </div>

                  {/* Operational button group */}
                  <div className="flex flex-wrap gap-2.5 pt-1.5">
                    {selectedRequest.status === 'pending' && (
                      <button
                        onClick={() => handleCreateSubmit}
                        onMouseDown={() => handleActionRun('analyze')}
                        disabled={isActionSubmitting}
                        className="px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-300 border border-indigo-500/20 text-xs font-bold rounded-lg cursor-pointer transition-colors"
                      >
                        Iniciar Análise
                      </button>
                    )}
                    
                    <button
                      onMouseDown={() => handleActionRun('approve')}
                      disabled={isActionSubmitting || (selectedRequest.status === 'approved')}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-450 hover:text-white border border-emerald-500/20 rounded-lg text-xs font-bold cursor-pointer transition-all"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Aprovar
                    </button>

                    <button
                      onMouseDown={() => handleActionRun('reject')}
                      disabled={isActionSubmitting || (selectedRequest.status === 'rejected')}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500 text-rose-450 hover:text-white border border-rose-500/20 rounded-lg text-xs font-bold cursor-pointer transition-all"
                    >
                      <XCircle className="w-4 h-4" />
                      Recusar
                    </button>

                    <button
                      onMouseDown={() => handleActionRun('request_revision')}
                      disabled={isActionSubmitting || (selectedRequest.status === 'revision_requested')}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500 text-purple-455 hover:text-white border border-purple-500/20 rounded-lg text-xs font-bold cursor-pointer transition-all"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Correções
                    </button>
                  </div>
                </div>
              )}

              {/* Re-submit option if corrections requested */}
              {selectedRequest.status === 'revision_requested' && selectedRequest.requesterName === currentUserName && (
                <div className="p-4 bg-purple-500/5 border border-purple-500/15 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-purple-400 text-xs font-bold">
                    <AlertTriangle className="w-4 h-4 animate-bounce" />
                    Correção Pendente por Si
                  </div>
                  <p className="text-[11px] text-zinc-400">O decisor solicitou revisões. Insira os ajustes solicitados e re-submeta o processo.</p>
                  
                  <textarea
                    placeholder="Parecer de re-submissão explicativo..."
                    value={actionComment}
                    onChange={(e) => setActionComment(e.target.value)}
                    rows={2}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 outline-none focus:border-purple-900"
                  />
                  <button
                    onMouseDown={() => handleActionRun('resubmit')}
                    disabled={isActionSubmitting}
                    className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold cursor-pointer transition-all"
                  >
                    Re-submeter à Direção
                  </button>
                </div>
              )}

              {/* AUDIT LOG PIPELINE (Histórico Completo) */}
              <div className="space-y-4 pt-2">
                <span className="text-[10px] font-mono font-bold text-zinc-450 uppercase tracking-widest block">Histórico Completo de Auditoria Rastreável</span>
                
                <div className="border-l border-zinc-850 pl-4 ml-2 space-y-4 relative">
                  {(selectedRequest.history as ApprovalHistoryEntry[]).map((log, index) => {
                    return (
                      <div key={log.id || index} className="relative space-y-1">
                        {/* Dot indicator */}
                        <div className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 bg-zinc-950 border border-zinc-800 rounded-full flex items-center justify-center">
                          <div className={`w-1.5 h-1.5 rounded-full ${
                            log.action === 'approve' ? 'bg-emerald-450' :
                            log.action === 'reject' ? 'bg-rose-450' :
                            log.action === 'create' ? 'bg-zinc-650' : 'bg-indigo-400'
                          }`}></div>
                        </div>

                        <div className="flex items-center justify-between text-[11px] font-mono text-zinc-450">
                          <span className={`font-bold ${getActionColor(log.action)}`}>
                            {getActionLabel(log.action)}
                          </span>
                          <span className="text-[10px] text-zinc-500">{log.timestamp}</span>
                        </div>

                        <div className="text-[11px] text-zinc-300 font-sans">
                          {log.comment || 'Nenhum comentário associado.'}
                        </div>

                        <div className="text-[9px] font-mono uppercase text-zinc-550">
                          Responsável: <strong className="text-zinc-500">{log.userName}</strong> ({log.userRole})
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CREATE REQUEST MODAL */}
      <AnimatePresence>
        {isCreateOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.form
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onSubmit={handleCreateSubmit}
              className="w-full max-w-lg bg-zinc-950 border border-zinc-850 rounded-2xl p-6 space-y-5 text-left shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-zinc-850 pb-3">
                <h3 className="text-sm font-bold text-zinc-200">Emitir Pedido de Aprovação</h3>
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="p-1 px-2.5 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs font-semibold rounded-lg shrink-0 cursor-pointer"
                >
                  Cancelar
                </button>
              </div>

              {formError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  {formError}
                </div>
              )}

              {/* Form elements */}
              <div className="space-y-4 text-xs font-sans">
                <div className="space-y-1.5">
                  <label className="text-zinc-350 font-bold block">Título do Pedido:</label>
                  <input
                    type="text"
                    required
                    placeholder="ex. Pedido de Verbas para Material Extraordinário, Alteração de Nota do Aluno..."
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 outline-none focus:border-zinc-700 font-sans"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-zinc-350 font-bold block">Tipo de Fluxo Tramitação:</label>
                    <select
                      value={newFlowType}
                      onChange={(e) => setNewFlowType(e.target.value as ApprovalFlowType)}
                      className="w-full bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-xl px-3 py-2 outline-none cursor-pointer focus:border-zinc-700 font-sans"
                    >
                      {(['secretariat_to_director', 'teacher_to_director', 'financial_to_director'] as ApprovalFlowType[]).map((flow) => {
                        return (
                          <option 
                            key={flow} 
                            value={flow} 
                            disabled={!canCreateFlowType(flow) && currentUserRole !== 'admin'}
                          >
                            {getFlowTypeBadgeLabel(flow)} {!canCreateFlowType(flow) && currentUserRole !== 'admin' ? ' (Não Permitido)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-zinc-350 font-bold block">Autor Requerente:</label>
                    <input
                      type="text"
                      disabled
                      value={`${currentUserName} (${currentUserRole.toUpperCase()})`}
                      className="w-full bg-zinc-900/40 border border-zinc-850 rounded-xl px-3 py-2 text-xs text-zinc-500 outline-none font-sans cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-zinc-350 font-bold block">Descrição e Directivas do Processo:</label>
                  <textarea
                    required
                    placeholder="Descreva detalhadamente o seu pedido, datas limites, justificativas de contabilidade, referências a faturas ou alunos impactados..."
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    rows={4}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 outline-none focus:border-zinc-700 font-sans"
                  />
                </div>
              </div>

              {/* Submit panel */}
              <div className="flex justify-end gap-2 border-t border-zinc-850 pt-4">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 font-semibold rounded-xl text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg cursor-pointer"
                >
                  {isSubmitting ? 'Enviando...' : 'Submeter Pedido'}
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
