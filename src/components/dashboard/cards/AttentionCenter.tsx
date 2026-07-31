import React, { memo, useMemo } from 'react';
import { 
  ClipboardCheck, UserCheck, FileWarning, DollarSign, PenTool, CheckCircle2, AlertTriangle, ArrowRight 
} from 'lucide-react';
import { Student, Invoice, ApprovalRequest, DigitalSignatureRequest } from '../../../types';

interface AttentionCenterProps {
  students: Student[];
  invoices: Invoice[];
  approvals: ApprovalRequest[];
  signatures: DigitalSignatureRequest[];
  setCurrentTab: (tab: string) => void;
  theme: string;
}

function AttentionCenter({
  students,
  invoices,
  approvals,
  signatures,
  setCurrentTab,
  theme
}: AttentionCenterProps) {
  // 1. Pending Approvals
  const pendingApprovalsCount = useMemo(() => approvals.filter(
    a => a.status === 'pending' || a.status === 'analyzing' || a.status === 'revision_requested'
  ).length, [approvals]);

  // 2. Incomplete Registrations (Status is pending or missing mandatory docs)
  const incompleteRegistrationsCount = useMemo(() => students.filter(s => {
    const hasMissingDocs = s.documents && s.documents.some(d => !d.submitted);
    return s.status !== 'active' || hasMissingDocs;
  }).length, [students]);

  // 3. Expirations / Missing Administrative Dossiers
  const totalMissingDocs = useMemo(() => {
    let count = 0;
    students.forEach(s => {
      if (s.documents) {
        count += s.documents.filter(d => !d.submitted).length;
      }
    });
    return count;
  }, [students]);

  // 4. Overdue Payments
  const overdueInfo = useMemo(() => {
    const filtered = invoices.filter(i => i.status === 'overdue');
    return {
      count: filtered.length,
      amount: filtered.reduce((acc, i) => acc + i.amount, 0)
    };
  }, [invoices]);

  const overduePaymentsCount = overdueInfo.count;
  const overdueAmount = overdueInfo.amount;

  // 5. Pending Signatures
  const pendingSignaturesCount = useMemo(() => signatures.filter(s => s.status === 'sent').length, [signatures]);

  const totalAlerts = useMemo(() => 
    pendingApprovalsCount + 
    incompleteRegistrationsCount + 
    totalMissingDocs + 
    overduePaymentsCount + 
    pendingSignaturesCount,
    [pendingApprovalsCount, incompleteRegistrationsCount, totalMissingDocs, overduePaymentsCount, pendingSignaturesCount]
  );

  const isLight = theme === 'light';

  const alertItems = useMemo(() => [
    {
      id: 'approvals',
      title: 'Aprovações Pendentes',
      value: pendingApprovalsCount,
      desc: 'Fluxos aguardando parecer ou revisão da direção.',
      tab: 'approvals',
      icon: ClipboardCheck,
      color: 'amber',
      show: pendingApprovalsCount > 0
    },
    {
      id: 'registrations',
      title: 'Matrículas Incompletas',
      value: incompleteRegistrationsCount,
      desc: 'Alunos com processos de admissão pendentes.',
      tab: 'students',
      icon: UserCheck,
      color: 'indigo',
      show: incompleteRegistrationsCount > 0
    },
    {
      id: 'documents',
      title: 'Documentos em Falta',
      value: totalMissingDocs,
      desc: `${totalMissingDocs} arquivos ausentes nos dossiês de alunos.`,
      tab: 'documents',
      icon: FileWarning,
      color: 'rose',
      show: totalMissingDocs > 0
    },
    {
      id: 'payments',
      title: 'Pagamentos Vencidos',
      value: overduePaymentsCount,
      desc: `€${overdueAmount.toLocaleString('pt-PT', { minimumFractionDigits: 2 })} em propinas em atraso.`,
      tab: 'financials',
      icon: DollarSign,
      color: 'red',
      show: overduePaymentsCount > 0
    },
    {
      id: 'signatures',
      title: 'Assinaturas Pendentes',
      value: pendingSignaturesCount,
      desc: 'Contratos e autorizações pendentes de assinatura.',
      tab: 'signatures',
      icon: PenTool,
      color: 'purple',
      show: pendingSignaturesCount > 0
    }
  ].filter(item => item.show), [
    pendingApprovalsCount, 
    incompleteRegistrationsCount, 
    totalMissingDocs, 
    overduePaymentsCount, 
    overdueAmount, 
    pendingSignaturesCount
  ]);

  if (totalAlerts === 0) {
    return (
      <div 
        id="attention_center_compliance"
        className={`p-6 rounded-2xl border flex flex-col md:flex-row items-center gap-4 ${
          isLight 
            ? 'bg-emerald-50/50 border-emerald-200 text-emerald-800' 
            : 'bg-emerald-950/20 border-emerald-500/20 text-emerald-300'
        }`}
      >
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
          isLight ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-500/10 text-emerald-400'
        }`}>
          <CheckCircle2 className="w-6 h-6 animate-pulse" />
        </div>
        <div className="flex-1 space-y-1">
          <h3 className="font-bold text-sm tracking-tight">Painel de Conformidade Operacional Total</h3>
          <p className="text-xs opacity-90 leading-relaxed">
            Todas as métricas institucionais estão regulares. Zero faturas vencidas, nenhuma assinatura em atraso e todos os dossiês de alunos em perfeita conformidade académica.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div id="attention_center_dashboard" className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-rose-500 animate-pulse" />
          <h2 className={`text-base font-bold tracking-tight font-display ${isLight ? 'text-zinc-900' : 'text-white'}`}>
            Centro de Atenção Crítica
          </h2>
        </div>
        <span className={`text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${
          isLight ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
        }`}>
          {totalAlerts} Incidências de Auditoria
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {alertItems.map((item) => {
          const Icon = item.icon;
          let colorClass = '';
          let hoverClass = '';

          if (item.color === 'amber') {
            colorClass = isLight ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-amber-500/10 border-amber-500/10 text-amber-400';
            hoverClass = isLight ? 'hover:border-amber-400 hover:bg-amber-100/50' : 'hover:border-amber-500/30 hover:bg-amber-500/5';
          } else if (item.color === 'indigo') {
            colorClass = isLight ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-indigo-500/10 border-indigo-500/10 text-indigo-400';
            hoverClass = isLight ? 'hover:border-indigo-400 hover:bg-indigo-100/50' : 'hover:border-indigo-500/30 hover:bg-indigo-500/5';
          } else if (item.color === 'rose') {
            colorClass = isLight ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-rose-500/10 border-rose-500/10 text-rose-400';
            hoverClass = isLight ? 'hover:border-rose-400 hover:bg-rose-100/50' : 'hover:border-rose-500/30 hover:bg-rose-500/5';
          } else if (item.color === 'red') {
            colorClass = isLight ? 'bg-rose-100 border-rose-350 text-rose-800 animate-pulse' : 'bg-red-500/15 border-red-500/20 text-red-400 animate-pulse';
            hoverClass = isLight ? 'hover:border-red-400 hover:bg-red-50/55' : 'hover:border-red-500/30 hover:bg-red-500/5';
          } else {
            colorClass = isLight ? 'bg-purple-50 border-purple-200 text-purple-700' : 'bg-purple-500/10 border-purple-500/10 text-purple-400';
            hoverClass = isLight ? 'hover:border-purple-400 hover:bg-purple-100/50' : 'hover:border-purple-500/30 hover:bg-purple-500/5';
          }

          return (
            <div 
              key={item.id}
              onClick={() => setCurrentTab(item.tab)}
              className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 group flex flex-col justify-between ${
                isLight ? 'bg-white border-zinc-200 shadow-sm' : 'bg-zinc-900 border-white/5'
              } ${hoverClass}`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${colorClass}`}>
                    <Icon className="w-5 h-5" />
                  </span>
                  <span className={`text-xl font-bold font-mono ${isLight ? 'text-zinc-900' : 'text-white'}`}>
                    {item.value}
                  </span>
                </div>
                <div>
                  <h4 className={`text-xs font-bold font-display ${isLight ? 'text-zinc-800' : 'text-zinc-200'}`}>
                    {item.title}
                  </h4>
                  <p className={`text-[10px] mt-1 leading-relaxed ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                    {item.desc}
                  </p>
                </div>
              </div>

              <div className="pt-3 mt-3 border-t border-dashed border-zinc-200 dark:border-zinc-800/60 flex items-center justify-between text-[9px] font-mono font-bold uppercase tracking-wider text-indigo-500 dark:text-indigo-400 opacity-80 group-hover:opacity-100 transition-opacity">
                <span>Resolver Pendência</span>
                <ArrowRight className="w-3 h-3 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default memo(AttentionCenter);
