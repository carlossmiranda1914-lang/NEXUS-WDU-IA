import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, AlertCircle, Bookmark, DollarSign, Calendar, CreditCard, ChevronRight, User } from 'lucide-react';
import { Invoice, Student } from '../types';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null; // If null, we are registering a NEW payment. If set, we are editing / cancelling.
  students: Student[];
  onRegister: (data: { studentId: string; studentName: string; amount: number; dueDate: string; method: string; comment?: string }) => void;
  onEdit: (id: string, updates: { amount: number; status: 'paid' | 'pending' | 'overdue'; method: string; comment?: string }) => void;
  onCancelPay: (id: string) => void;
}

export default function PaymentModal({
  isOpen,
  onClose,
  invoice,
  students,
  onRegister,
  onEdit,
  onCancelPay
}: PaymentModalProps) {
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [amount, setAmount] = useState<number>(450);
  const [dueDate, setDueDate] = useState('2026-06-10');
  const [method, setMethod] = useState('Multibanco');
  const [comment, setComment] = useState('');
  const [status, setStatus] = useState<'paid' | 'pending' | 'overdue'>('paid');

  // Load active values on edit
  useEffect(() => {
    if (invoice) {
      setSelectedStudentId(invoice.studentId);
      setAmount(invoice.amount);
      setDueDate(invoice.dueDate);
      setStatus(invoice.status);
      setMethod('Multibanco'); // Default or saved in metadata
    } else {
      setSelectedStudentId('');
      setAmount(450);
      setDueDate('2026-06-10');
      setComment('');
      setStatus('paid');
    }
  }, [invoice, isOpen]);

  if (!isOpen) return null;

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.id.toLowerCase().includes(studentSearch.toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (invoice) {
      // Edit payment
      onEdit(invoice.id, {
        amount,
        status,
        method,
        comment
      });
    } else {
      // Register payment
      const student = students.find(s => s.id === selectedStudentId);
      if (!student) {
        alert('Selecione um aluno válido.');
        return;
      }
      onRegister({
        studentId: selectedStudentId,
        studentName: student.name,
        amount,
        dueDate,
        method,
        comment
      });
    }
    onClose();
  };

  const handleCancel = () => {
    if (invoice) {
      onCancelPay(invoice.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl relative animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="px-5 py-4 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-400" />
            <span className="text-sm font-bold text-white">
              {invoice ? `Gestão de Cobrança / Editar Registo` : `Registar Nova Fatura / Pagamento`}
            </span>
          </div>
          <button 
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs text-left">
          
          {/* Student selection field */}
          {!invoice ? (
            <div className="space-y-1.5">
              <label className="text-zinc-400 font-medium">Pesquisar e Selecionar Aluno</label>
              <input
                type="text"
                placeholder="Ex: Alice Siqueira ou ALU-101..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2 px-3 text-white placeholder-zinc-550 outline-none focus:border-indigo-500 text-xs"
              />

              <div className="max-h-24 overflow-y-auto border border-zinc-900 bg-zinc-900/30 rounded-lg p-1 space-y-0.5 mt-1">
                {filteredStudents.length > 0 ? (
                  filteredStudents.map(s => (
                    <div
                      key={s.id}
                      onClick={() => {
                        setSelectedStudentId(s.id);
                        setStudentSearch(s.name);
                      }}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer hover:bg-zinc-800/80 transition ${selectedStudentId === s.id ? 'bg-indigo-500/10 border-l-2 border-indigo-400' : ''}`}
                    >
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-zinc-400" />
                        <span className="text-zinc-200 text-xs">{s.name}</span>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-500">{s.id} • {s.class}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-[10px] text-zinc-650 p-2 text-center">Nenhum aluno encontrado</p>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-zinc-900/45 p-3 rounded-xl border border-zinc-900 flex justify-between items-center mb-2">
              <div>
                <p className="text-[10px] uppercase font-mono tracking-widest text-zinc-500">Beneficiário</p>
                <p className="text-sm font-semibold text-white mt-1">{invoice.studentName}</p>
                <p className="text-[10px] text-zinc-400 font-mono mt-0.5">{invoice.studentId}</p>
              </div>
              <span className="text-xs bg-zinc-800 border border-zinc-700 px-2.5 py-1 rounded text-zinc-300 font-mono">
                {invoice.id}
              </span>
            </div>
          )}

          {/* Amount and Due date dual columns */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-zinc-400 font-medium">Valor Mensalidade (€)</label>
              <div className="relative flex items-center">
                <input
                  type="number"
                  required
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2 pl-7 pr-3 text-white outline-none focus:border-indigo-500 text-xs font-mono"
                />
                <span className="absolute left-3 text-zinc-500 font-mono">€</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-zinc-400 font-medium">Data Vencimento</label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2 px-3 text-white outline-none focus:border-indigo-500 text-xs font-mono"
              />
            </div>
          </div>

          {/* Payment Method and Status dual columns */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-zinc-400 font-medium">Método de Liquidação</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2 px-2.5 text-white outline-none focus:border-indigo-500 text-xs"
              >
                <option value="Multibanco">Multibanco</option>
                <option value="Transferência">Transferência Bancária</option>
                <option value="MB Way">MB Way</option>
                <option value="Cartão">Cartão de Crédito</option>
                <option value="Dinheiro">Dinheiro Físico</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-zinc-400 font-medium">Estado da Cobrança</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2 px-2.5 text-white outline-none focus:border-indigo-500 text-xs"
              >
                <option value="paid">Pago / Liquidado</option>
                <option value="pending">Pendente / Aberto</option>
                <option value="overdue">Atrasado / Vencido</option>
              </select>
            </div>
          </div>

          {/* Comments / Observações */}
          <div className="space-y-1.5">
            <label className="text-zinc-400 font-medium">Observações Administrativas (Interno)</label>
            <textarea
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Ex: Pagamento parcial aprovado, desconto concedido pela direção, etc."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2 px-3 text-white placeholder-zinc-550 outline-none focus:border-indigo-500 text-xs resize-none"
            />
          </div>

          {/* Invoice Warning details if overdue */}
          {status === 'overdue' && (
            <div className="flex gap-2 p-2.5 rounded-xl border border-rose-500/10 bg-rose-500/5 text-rose-400">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="text-[10px] leading-relaxed">
                A marcar como <strong>Atrasado / Vencido</strong>. Isto irá disparar alertas automáticos na área de notificações do encarregado de educação e influenciará a taxa global de inadimplência da escola.
              </p>
            </div>
          )}

          {/* Action Row */}
          <div className="pt-3 border-t border-zinc-900 flex justify-between gap-3">
            <div>
              {invoice && (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="bg-zinc-900 border border-rose-500/20 text-rose-400 hover:bg-rose-500/10 font-bold px-4 py-2.5 rounded-xl hover:border-rose-500/40 cursor-pointer transition text-xs"
                >
                  Cancelar Pagamento (Unpay)
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="bg-zinc-850 hover:bg-zinc-800 text-zinc-300 font-semibold px-4 py-2.5 rounded-xl cursor-pointer transition text-xs"
              >
                Fechar
              </button>
              <button
                type="submit"
                className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer transition text-xs"
              >
                <CheckCircle2 className="w-4 h-4" />
                {invoice ? 'Salvar Edição' : 'Registar Fatura'}
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
}
