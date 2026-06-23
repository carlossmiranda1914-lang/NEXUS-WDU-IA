import React from 'react';
import { X, Printer, CheckCircle, Clock, AlertTriangle, GraduationCap, Building, Receipt } from 'lucide-react';
import { Invoice } from '../types';

interface PrintInvoiceModalProps {
  invoice: Invoice;
  onClose: () => void;
}

export default function PrintInvoiceModal({ invoice, onClose }: PrintInvoiceModalProps) {
  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'tuition': return 'Mensalidade Escolar Regulamentar';
      case 'material': return 'Livros e Manuais Didáticos Obrigatórios';
      case 'extracurricular': return 'Atividade Extra-Curricular / Workshops';
      default: return 'Taxas Administrativas Adicionais';
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'paid':
        return {
          bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
          text: 'PAGO / LIQUIDADO',
          badge: 'bg-emerald-600 text-white',
          textColor: 'text-emerald-500'
        };
      case 'pending':
        return {
          bg: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
          text: 'PENDENTE / EMITIDO',
          badge: 'bg-amber-500 text-black',
          textColor: 'text-amber-500'
        };
      default:
        return {
          bg: 'bg-rose-500/15 text-rose-400 border-rose-500/20',
          text: 'VENCIDO / EM ATRASO',
          badge: 'bg-rose-600 text-white',
          textColor: 'text-rose-500'
        };
    }
  };

  const statusStyle = getStatusStyle(invoice.status);
  const currentYear = new Date().getFullYear();

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto no-print">
      {/* Inject custom print-media styling so the print dialogue captures ONLY the invoice card */}
      <style>{`
        @media print {
          /* Hide everything first */
          body * {
            visibility: hidden;
            background-color: white !important;
            color: black !important;
          }
          /* Show only the invoice paper area */
          #printable-invoice-area, #printable-invoice-area * {
            visibility: visible;
          }
          #printable-invoice-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: auto;
            margin: 0;
            padding: 20px !important;
            background-color: white !important;
            color: #18181b !important;
            box-shadow: none !important;
          }
          /* Custom overrides to make elements print beautifully in black/white */
          .print-border-black {
            border-color: #3f3f46 !important;
          }
          .print-bg-gray {
            background-color: #f4f4f5 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Modal Container */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl relative animate-in fade-in zoom-in duration-200">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-emerald-400" />
            <span className="text-zinc-105 font-semibold text-sm">Visualizar Recibo de Fatura</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs px-3.5 py-2 rounded-lg transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4 shrink-0" />
              Imprimir Recibo
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Invoice Body (Targeted for high-fidelity printing) */}
        <div id="printable-invoice-area" className="p-8 bg-zinc-950 font-sans text-zinc-200 space-y-6">
          
          {/* Brand & Reference Info Group */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b border-zinc-800 pb-6 print-border-black">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center print-bg-gray">
                  <GraduationCap className="w-5 h-5 text-emerald-400" />
                </div>
                <span className="text-lg font-bold tracking-tight text-white font-sans">NEXUS <span className="text-emerald-400">EDU AI</span></span>
              </div>
              <p className="text-[10px] text-zinc-400 leading-relaxed font-mono max-w-xs">
                Colégio Internacional Nexus S.A.<br />
                NIF: 501 202 607 • Reg. CRC Lisboa nº 4410<br />
                Avenida da Liberdade 110A, 1250-140 Lisboa • Portugal
              </p>
            </div>
            <div className="sm:text-right space-y-1">
              <div className="inline-block px-3 py-1 rounded-full text-[10px] uppercase font-mono font-bold tracking-wider mb-2 bg-emerald-500/5 text-emerald-400 border border-emerald-500/10">
                Fatura Simplificada
              </div>
              <h2 className="text-xs text-zinc-400 font-mono">DOC REF: <span className="text-white font-bold">{invoice.id}</span></h2>
              <p className="text-[10px] text-zinc-400 font-mono">Emissão: <span className="text-zinc-200">12 Junho 2026</span></p>
              <p className="text-[10px] text-zinc-400 font-mono">Vencimento: <span className="text-zinc-200">{invoice.dueDate}</span></p>
            </div>
          </div>

          {/* Client Info and Payment Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 border-b border-zinc-800 pb-6 print-border-black">
            <div className="space-y-2">
              <h3 className="text-zinc-500 text-[9px] uppercase font-mono tracking-widest">Destinatário / Aluno</h3>
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-white">{invoice.studentName}</p>
                <p className="text-xs text-zinc-400 font-mono">Inscrição ID: {invoice.studentId}</p>
                <p className="text-[11px] text-zinc-400">Encarregado: Registro Associado Nexus Geral</p>
              </div>
            </div>
            
            <div className="space-y-2 sm:text-right">
              <h3 className="text-zinc-500 text-[9px] uppercase font-mono tracking-widest">Estado da Cobrança</h3>
              <div className="space-y-1 sm:flex sm:flex-col sm:items-end">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono font-bold border ${statusStyle.bg}`}>
                  {invoice.status === 'paid' && <CheckCircle className="w-3.5 h-3.5" />}
                  {invoice.status === 'pending' && <Clock className="w-3.5 h-3.5" />}
                  {invoice.status === 'overdue' && <AlertTriangle className="w-3.5 h-3.5" />}
                  {statusStyle.text}
                </span>
                <p className="text-[10px] text-zinc-450 mt-1 max-w-xs">
                  {invoice.status === 'paid' 
                    ? 'Liquidação efetuada via transferência bancária direta / Débito Direto Securitário.' 
                    : 'Aguardando compensação financeira regulamentar.'}
                </p>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="space-y-3">
            <h3 className="text-zinc-500 text-[9px] uppercase font-mono tracking-widest">Discriminação das Prestações de Serviço</h3>
            
            <div className="border border-zinc-800 rounded-xl overflow-hidden print-border-black">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-zinc-900 border-b border-zinc-800 font-mono text-[10px] text-zinc-400 print-bg-gray print-border-black">
                    <th className="p-3.5 font-normal">Descrição do Item</th>
                    <th className="p-3.5 font-normal text-center">Unidades</th>
                    <th className="p-3.5 font-normal text-right">Taxa IVA</th>
                    <th className="p-3.5 font-normal text-right">Preço Unitário</th>
                    <th className="p-3.5 font-normal text-right">Total Liquido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-850">
                  <tr className="align-middle">
                    <td className="p-4">
                      <p className="font-semibold text-white">{getCategoryLabel(invoice.category)}</p>
                      <p className="text-[10px] text-zinc-500 mt-0.5">Ano Letivo {currentYear}/{currentYear + 1} - Referência Periódica</p>
                    </td>
                    <td className="p-4 text-center font-mono">1</td>
                    <td className="p-4 text-right font-mono">Inento Art.º 9 CP</td>
                    <td className="p-4 text-right font-mono">€{invoice.amount.toFixed(2)}</td>
                    <td className="p-4 text-right font-mono text-white font-medium">€{invoice.amount.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Sum / Totals breakdown block */}
          <div className="flex justify-end pt-2">
            <div className="w-full max-w-xs space-y-2 text-xs">
              <div className="flex justify-between text-zinc-400">
                <span>Subtotal Real:</span>
                <span className="font-mono">€{invoice.amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-zinc-400 border-b border-zinc-850 pb-2 print-border-black">
                <span>IVA Aplicável (0%):</span>
                <span className="font-mono">€0.00</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-white pt-1">
                <span>Total de Cobrança:</span>
                <span className="font-mono text-emerald-400">€{invoice.amount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Bottom regulatory note / Footer */}
          <div className="border-t border-zinc-850 pt-6 mt-6 print-border-black text-[10px] text-zinc-500 space-y-2 leading-relaxed">
            <div className="flex items-center gap-1.5 text-zinc-400">
              <Building className="w-3.5 h-3.5" />
              <span className="font-semibold uppercase tracking-wider text-[9px]">Notas Regulatórias e Garantias</span>
            </div>
            <p>
              Este recibo de cobrança atesta a transação pedagógica executada em conformidade com as regras impostas pelo Ministério da Educação de Portugal e a Autoridade Tributária. Isento de IVA ao abrigo do Artigo 9º do Código do Imposto sobre o Valor Acrescentado (CIVA) para estabelecimentos oficiais de ensino.
            </p>
            <p className="text-center pt-4 border-t border-zinc-900 font-mono text-[9px] print-border-black">
              Autenticado digitalmente por Nexus Core Database S.A. • Obrigado pela sua preferência!
            </p>
          </div>

        </div>

        {/* Modal Action Controls footer */}
        <div className="px-6 py-4 bg-zinc-900 border-t border-zinc-800 flex justify-end gap-3 no-print">
          <button
            onClick={onClose}
            className="bg-zinc-800 hover:bg-zinc-750 text-zinc-300 font-semibold text-xs px-4 py-2 rounded-lg transition-colors cursor-pointer"
          >
            Fechar
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs px-4  py-2 rounded-lg transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Imprimir Recibo
          </button>
        </div>

      </div>
    </div>
  );
}
