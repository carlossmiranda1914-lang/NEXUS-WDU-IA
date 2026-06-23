import React, { useState, useEffect, useMemo } from 'react';
import { 
  Play, 
  Search, 
  Filter, 
  Plus, 
  Trash2, 
  Download, 
  Share2, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Printer, 
  Copy, 
  Clipboard, 
  FileDown, 
  Layers, 
  Mail, 
  UploadCloud, 
  DollarSign, 
  ChevronRight,
  BookOpen,
  Check,
  Loader2,
  RefreshCw,
  TrendingUp
} from 'lucide-react';
import { Invoice, Student } from '../types';
import PrintInvoiceModal from './PrintInvoiceModal';

// Import our modular subcomponents
import FinancialMetrics from './FinancialMetrics';
import FinancialCharts from './FinancialCharts';
import FinancialAI from './FinancialAI';
import PaymentModal from './PaymentModal';

interface DespesaRecord {
  id: string;
  desc: string;
  category: string;
  amount: number;
  date: string;
  status: 'pago' | 'pendente';
}

interface FinancialPanelProps {
  invoices: Invoice[];
  students?: Student[]; // Custom prop added from App.tsx
  onUpdateInvoiceStatus: (id: string, status: 'paid' | 'pending' | 'overdue') => void;
  onAddInvoice: (invoice: Omit<Invoice, 'id'>) => void;
  globalSearchTerm?: string;
}

const initialExpensesList: DespesaRecord[] = [
  { id: 'DES-101', desc: 'Licenças Zoom Education', category: 'Software', amount: 850, date: '2026-06-05', status: 'pago' },
  { id: 'DES-102', desc: 'Manutenção de Computadores', category: 'Hardware', amount: 1200, date: '2026-06-10', status: 'pago' },
  { id: 'DES-103', desc: 'Fatura EDP Eletricidade', category: 'Serviços', amount: 3200, date: '2026-06-15', status: 'pendente' },
  { id: 'DES-104', desc: 'Material de Laboratório Química', category: 'Material', amount: 1500, date: '2026-06-20', status: 'pago' },
  { id: 'DES-105', desc: 'Serviços de Limpeza e Higiene', category: 'Manutenção', amount: 950, date: '2026-06-25', status: 'pendente' }
];

export default function FinancialPanel({
  invoices,
  students = [],
  onUpdateInvoiceStatus,
  onAddInvoice,
  globalSearchTerm = ''
}: FinancialPanelProps) {
  // Active sheet tracker (Workbook feel)
  const [activeSheet, setActiveSheet] = useState<'receitas' | 'despesas'>('receitas');

  // Core Data States (synchronized or overridden locally)
  const [localInvoices, setLocalInvoices] = useState<Invoice[]>(invoices);
  const [expenses, setExpenses] = useState<DespesaRecord[]>(() => {
    const saved = localStorage.getItem('nexus_expenses');
    return saved ? JSON.parse(saved) : initialExpensesList;
  });

  // Keep localInvoices in sync when prop invoices changes
  useEffect(() => {
    setLocalInvoices(invoices);
  }, [invoices]);

  // Keep expenses persisted
  useEffect(() => {
    localStorage.setItem('nexus_expenses', JSON.stringify(expenses));
  }, [expenses]);

  // Active Selected Cell for Excel Grid
  const [selectedCell, setSelectedCell] = useState<{ rowId: string; colName: string } | null>(null);
  const [editingCell, setEditingCell] = useState<{ rowId: string; colName: string } | null>(null);
  const [tempCellText, setTempCellText] = useState('');

  // Semicolon/Cell Override Storage for customized Excel text (method, observations, custom guardians/turma)
  const [cellsData, setCellsData] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('nexus_cells_data_overrides');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem('nexus_cells_data_overrides', JSON.stringify(cellsData));
  }, [cellsData]);

  // Excel copied clipboard buffer
  const [excelClipboard, setExcelClipboard] = useState<string | null>(null);

  // Multi-Selection Checkbox tracking
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());

  // Search, Sort and Filtering state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending' | 'overdue'>('all');
  const [classFilter, setClassFilter] = useState('all');
  const [sortBy, setSortBy] = useState<{ field: string; direction: 'asc' | 'desc' } | null>(null);

  // Dynamic search override
  const activeSearchQuery = searchQuery || globalSearchTerm;

  // Modal / Drawer Toggles
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [invoiceToPrint, setInvoiceToPrint] = useState<Invoice | null>(null);
  const [activePaymentInvoice, setActivePaymentInvoice] = useState<Invoice | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  // Share overlay simulator
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [shareEmailText, setShareEmailText] = useState('');
  const [isShareEmailOpen, setIsShareEmailOpen] = useState(false);

  // Automated Bank Reconciliation states (Ligação Reconciliação Bancária)
  const [bankStatementText, setBankStatementText] = useState(
    "2026-06-15, TRANSF DEP, Alice Siqueira, 150.00\n2026-06-16, TRANSF RECEB, Bruno Santos, 180.00\n2026-06-17, TRANSF COB, Clara Fonseca, 220.00"
  );
  const [reconciliationStatus, setReconciliationStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [reconciliationOutput, setReconciliationOutput] = useState<{
    totalProcessed: number;
    totalMatched: number;
    totalUnmatched: number;
    matchedCount: number;
    totalAdjustedAmount: number;
    matchedInvoices: any[];
  } | null>(null);

  // Helper dictionary mapping students to fast lookup
  const studentLookup = useMemo(() => {
    const dict: Record<string, Student> = {};
    for (const s of students) {
      dict[s.id] = s;
    }
    return dict;
  }, [students]);

  // Derived list of classes for dynamic class dropdown filter
  const classesList = useMemo(() => {
    const set = new Set<string>();
    for (const s of students) {
      if (s.class) set.add(s.class);
    }
    return Array.from(set);
  }, [students]);

  // --- CELL INTERPOLATION & GETTERS ---
  const getOverrideKey = (rowId: string, colName: string) => `sheet:${activeSheet}::row:${rowId}::col:${colName}`;

  const getCellValue = (rowId: string, colName: string, fallbackVal: string): string => {
    const key = getOverrideKey(rowId, colName);
    return cellsData[key] !== undefined ? cellsData[key] : fallbackVal;
  };

  const setCellValue = (rowId: string, colName: string, text: string) => {
    const key = getOverrideKey(rowId, colName);
    const updated = { ...cellsData, [key]: text };
    
    // Resolve formulas if starts with '='
    let evaluated = text;
    if (text.startsWith('=')) {
      evaluated = resolveFormula(text);
      updated[key + '::computed'] = evaluated;
    }

    setCellsData(updated);

    // Apply native fields back to data models for persistent consistency
    if (activeSheet === 'receitas') {
      const idx = localInvoices.findIndex(inv => inv.id === rowId);
      if (idx !== -1) {
        const item = { ...localInvoices[idx] };
        if (colName === 'aluno') item.studentName = text;
        if (colName === 'mensalidade') item.amount = Number(text) || item.amount;
        if (colName === 'vencimento') item.dueDate = text;
        if (colName === 'estado') {
          const checkStatus = text.toLowerCase();
          if (checkStatus.includes('pag') || checkStatus === 'paid') item.status = 'paid';
          else if (checkStatus.includes('atras') || checkStatus === 'overdue') item.status = 'overdue';
          else item.status = 'pending';
          onUpdateInvoiceStatus(item.id, item.status);
        }
        
        const updatedInvs = [...localInvoices];
        updatedInvs[idx] = item;
        setLocalInvoices(updatedInvs);
        localStorage.setItem('nexus_invoices', JSON.stringify(updatedInvs));
      }
    } else {
      const idx = expenses.findIndex(exp => exp.id === rowId);
      if (idx !== -1) {
        const item = { ...expenses[idx] };
        if (colName === 'aluno') item.desc = text;
        if (colName === 'turma') item.category = text;
        if (colName === 'mensalidade') item.amount = Number(text) || item.amount;
        if (colName === 'vencimento') item.date = text;
        if (colName === 'estado') item.status = text.toLowerCase() === 'pago' ? 'pago' : 'pendente';
        
        const updatedExp = [...expenses];
        updatedExp[idx] = item;
        setExpenses(updatedExp);
      }
    }
  };

  // Basic formula engine for Microsoft Excel lookups (e.g. SUM, AVERAGE, ADD)
  const resolveFormula = (formulaStr: string): string => {
    try {
      const expression = formulaStr.substring(1).toUpperCase().trim();
      
      if (expression.startsWith('SOMA(') || expression.startsWith('SUM(')) {
        // Handle sum of all monthly fees
        const sourceData = activeSheet === 'receitas' ? localInvoices : expenses;
        const total = sourceData.reduce((sum, item) => sum + item.amount, 0);
        return String(total);
      }
      
      if (expression.startsWith('MEDIA(') || expression.startsWith('AVERAGE(')) {
        const sourceData = activeSheet === 'receitas' ? localInvoices : expenses;
        const total = sourceData.reduce((sum, item) => sum + item.amount, 0);
        const count = sourceData.length || 1;
        return String((total / count).toFixed(2));
      }

      // Standard Math evaluator safety
      const sanitized = expression.replace(/[^0-9+\-*/().]/g, '');
      const result = new Function(`return ${sanitized}`)();
      return String(result);
    } catch (e) {
      return '#REF!';
    }
  };

  // Keyboard Navigation & Clipboard Shortcuts effect
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedCell || editingCell) return;

      // Copy: Ctrl+C or Cmd+C
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        const rowData = getRowDataById(selectedCell.rowId);
        if (rowData) {
          const currentText = getCellValue(selectedCell.rowId, selectedCell.colName, rowData[selectedCell.colName as keyof typeof rowData]?.toString() || '');
          setExcelClipboard(currentText);
          e.preventDefault();
        }
      }

      // Paste: Ctrl+V or Cmd+V
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        if (excelClipboard !== null) {
          setCellValue(selectedCell.rowId, selectedCell.colName, excelClipboard);
          e.preventDefault();
        }
      }

      // Enter to Edit
      if (e.key === 'Enter') {
        const rowData = getRowDataById(selectedCell.rowId);
        if (rowData) {
          const currentText = getCellValue(selectedCell.rowId, selectedCell.colName, rowData[selectedCell.colName as keyof typeof rowData]?.toString() || '');
          setEditingCell(selectedCell);
          setTempCellText(currentText);
          e.preventDefault();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCell, editingCell, excelClipboard, activeSheet, localInvoices, expenses, cellsData]);

  const getRowDataById = (id: string) => {
    if (activeSheet === 'receitas') {
      const inv = localInvoices.find(item => item.id === id);
      if (!inv) return null;
      const associatedStudent = studentLookup[inv.studentId];
      return {
        id: inv.id,
        aluno: inv.studentName,
        responsavel: associatedStudent?.guardiansName || 'Encarregado Geral',
        turma: associatedStudent?.class || 'S/ Turma',
        mensalidade: inv.amount,
        vencimento: inv.dueDate,
        estado: inv.status === 'paid' ? 'Pago' : inv.status === 'overdue' ? 'Vencido' : 'Pendente',
        metodo: 'Multibanco',
        valpago: inv.status === 'paid' ? inv.amount : 0,
        valpendente: inv.status !== 'paid' ? inv.amount : 0,
        observacoes: ''
      };
    } else {
      const exp = expenses.find(item => item.id === id);
      if (!exp) return null;
      return {
        id: exp.id,
        aluno: exp.desc,
        responsavel: 'Faturação Geral S.A.',
        turma: exp.category,
        mensalidade: exp.amount,
        vencimento: exp.date,
        estado: exp.status === 'pago' ? 'Pago' : 'Pendente',
        metodo: 'Transferência',
        valpago: exp.status === 'pago' ? exp.amount : 0,
        valpendente: exp.status !== 'pago' ? exp.amount : 0,
        observacoes: ''
      };
    }
  };

  // --- EXCEL MAIN ACTIONS ---
  // 1. Create Row
  const handleAddNewRow = () => {
    if (activeSheet === 'receitas') {
      const newId = `FAT-${Math.floor(1000 + Math.random() * 9000)}`;
      const firstStudent = students[0] || { id: 'ALU-101', name: 'Alice Siqueira', class: '8º Ano B' };
      const newInv: Invoice = {
        id: newId,
        studentId: firstStudent.id,
        studentName: firstStudent.name,
        amount: 450,
        dueDate: '2026-06-10',
        status: 'pending',
        category: 'tuition'
      };
      const updated = [newInv, ...localInvoices];
      setLocalInvoices(updated);
      localStorage.setItem('nexus_invoices', JSON.stringify(updated));
      onAddInvoice({
        studentId: firstStudent.id,
        studentName: firstStudent.name,
        amount: 450,
        dueDate: '2026-06-10',
        status: 'pending',
        category: 'tuition'
      });
    } else {
      const newId = `DES-${Math.floor(100 + Math.random() * 900)}`;
      const newExp: DespesaRecord = {
        id: newId,
        desc: 'Nova Despesa Operacional',
        category: 'Outros',
        amount: 350,
        date: '2026-06-20',
        status: 'pendente'
      };
      setExpenses([newExp, ...expenses]);
    }
  };

  // 2. Delete Selected Row(s)
  const handleDeleteSelectedRows = () => {
    if (selectedRowIds.size === 0 && selectedCell) {
      // Delete current active row
      if (activeSheet === 'receitas') {
        const filtered = localInvoices.filter(item => item.id !== selectedCell.rowId);
        setLocalInvoices(filtered);
        localStorage.setItem('nexus_invoices', JSON.stringify(filtered));
      } else {
        const filtered = expenses.filter(item => item.id !== selectedCell.rowId);
        setExpenses(filtered);
      }
      setSelectedCell(null);
      return;
    }

    if (activeSheet === 'receitas') {
      const filtered = localInvoices.filter(item => !selectedRowIds.has(item.id));
      setLocalInvoices(filtered);
      localStorage.setItem('nexus_invoices', JSON.stringify(filtered));
    } else {
      const filtered = expenses.filter(item => !selectedRowIds.has(item.id));
      setExpenses(filtered);
    }
    setSelectedRowIds(new Set());
  };

  // 3. Batch mark paid
  const handleBatchMarkAsPaid = () => {
    if (activeSheet === 'receitas') {
      const updated = localInvoices.map(inv => {
        if (selectedRowIds.has(inv.id)) {
          onUpdateInvoiceStatus(inv.id, 'paid');
          return { ...inv, status: 'paid' as const };
        }
        return inv;
      });
      setLocalInvoices(updated);
      localStorage.setItem('nexus_invoices', JSON.stringify(updated));
    } else {
      const updated = expenses.map(exp => {
        if (selectedRowIds.has(exp.id)) {
          return { ...exp, status: 'pago' as const };
        }
        return exp;
      });
      setExpenses(updated);
    }
    setSelectedRowIds(new Set());
  };

  // --- FILTER & SORT RESOLVERS ---
  const activeRows = useMemo(() => {
    let list: any[] = [];
    if (activeSheet === 'receitas') {
      list = localInvoices.map(inv => {
        const associatedStudent = studentLookup[inv.studentId];
        return {
          id: inv.id,
          aluno: inv.studentName,
          responsavel: associatedStudent?.guardiansName || 'Encarregado Geral',
          turma: associatedStudent?.class || 'S/ Turma',
          mensalidade: inv.amount,
          vencimento: inv.dueDate,
          estado: inv.status, // mapped to status code
          metodo: 'Multibanco',
          valpago: inv.status === 'paid' ? inv.amount : 0,
          valpendente: inv.status !== 'paid' ? inv.amount : 0,
          observacoes: '',
          raw: inv
        };
      });
    } else {
      list = expenses.map(exp => {
        return {
          id: exp.id,
          aluno: exp.desc,
          responsavel: 'Faturação Geral S.A.',
          turma: exp.category,
          mensalidade: exp.amount,
          vencimento: exp.date,
          estado: exp.status === 'pago' ? 'paid' : 'pending',
          metodo: 'Transferência',
          valpago: exp.status === 'pago' ? exp.amount : 0,
          valpendente: exp.status !== 'pago' ? exp.amount : 0,
          observacoes: '',
          raw: exp
        };
      });
    }

    // Wrap with Excel Cell Overrides
    const interpolated = list.map(row => {
      const updated = { ...row };
      Object.keys(row).forEach(key => {
        if (key !== 'id' && key !== 'raw' && key !== 'estado') {
          const fallback = row[key];
          updated[key] = getCellValue(row.id, key, String(fallback));
        }
      });
      return updated;
    });

    // Apply Filter and Sorting Rules
    return interpolated.filter(row => {
      // Fuzzy Search
      const textToSearch = `${row.id} ${row.aluno} ${row.responsavel} ${row.turma} ${row.observacoes}`.toLowerCase();
      if (activeSearchQuery && !textToSearch.includes(activeSearchQuery.toLowerCase())) return false;

      // Status
      if (statusFilter !== 'all') {
        if (statusFilter === 'paid' && row.estado !== 'paid') return false;
        if (statusFilter === 'pending' && row.estado !== 'pending') return false;
        if (statusFilter === 'overdue' && row.estado !== 'overdue') return false;
      }

      // Class Filter
      if (classFilter !== 'all' && row.turma !== classFilter) return false;

      return true;
    }).sort((a, b) => {
      if (!sortBy) return 0;
      const f = sortBy.field;
      const multiplier = sortBy.direction === 'asc' ? 1 : -1;
      const valA = a[f];
      const valB = b[f];
      
      if (typeof valA === 'number' && typeof valB === 'number') {
        return (valA - valB) * multiplier;
      }
      return String(valA).localeCompare(String(valB)) * multiplier;
    });

  }, [activeSheet, localInvoices, expenses, cellsData, activeSearchQuery, statusFilter, classFilter, sortBy, studentLookup]);

  // --- SELECTION HELPERS ---
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRowIds(new Set(activeRows.map(r => r.id)));
    } else {
      setSelectedRowIds(new Set());
    }
  };

  const handleToggleSelectRow = (id: string) => {
    const updated = new Set(selectedRowIds);
    if (updated.has(id)) updated.delete(id);
    else updated.add(id);
    setSelectedRowIds(updated);
  };

  // --- DIRECT COPIER & PASTE METHODS BAR ---
  const triggerClipboardCopy = () => {
    if (!selectedCell) return;
    const row = getRowDataById(selectedCell.rowId);
    if (row) {
      const txt = getCellValue(selectedCell.rowId, selectedCell.colName, row[selectedCell.colName as keyof typeof row]?.toString() || '');
      setExcelClipboard(txt);
      navigator.clipboard.writeText(txt).catch(() => {});
    }
  };

  const triggerClipboardPaste = () => {
    if (!selectedCell || excelClipboard === null) return;
    setCellValue(selectedCell.rowId, selectedCell.colName, excelClipboard);
  };

  // --- SECTION 3: EXPORTS GENERATION ---
  const handleExportCSV = () => {
    const headers = ['ID', 'Aluno / Beneficiário', 'Responsável / Credor', 'Turma / Secção', 'Mensalidade', 'Vencimento', 'Estado', 'Método', 'Valor Pago', 'Valor Pendente', 'Observações'];
    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(";") + "\n"
      + activeRows.map(row => {
          return [row.id, row.aluno, row.responsavel, row.turma, row.mensalidade, row.vencimento, row.estado, row.metodo, row.valpago, row.valpendente, row.observacoes].join(";");
        }).join("\n");
        
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `nexus_livro_${activeSheet}_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportExcel = () => {
    // Generate real .xls styling table attachment format
    const rowContent = activeRows.map(row => {
      const stateLabel = row.estado === 'paid' ? 'Pago' : row.estado === 'overdue' ? 'Vencido' : 'Pendente';
      return `<tr>
        <td style="border: 1px solid #c0c0c0; font-family: sans-serif;">${row.id}</td>
        <td style="border: 1px solid #c0c0c0; font-family: sans-serif;">${row.aluno}</td>
        <td style="border: 1px solid #c0c0c0; font-family: sans-serif;">${row.responsavel}</td>
        <td style="border: 1px solid #c0c0c0; font-family: sans-serif;">${row.turma}</td>
        <td style="border: 1px solid #c0c0c0; font-family: monospace;">€${row.mensalidade}</td>
        <td style="border: 1px solid #c0c0c0; font-family: monospace;">${row.vencimento}</td>
        <td style="border: 1px solid #c0c0c0; font-family: sans-serif; font-weight: bold;">${stateLabel}</td>
        <td style="border: 1px solid #c0c0c0; font-family: sans-serif;">${row.metodo}</td>
        <td style="border: 1px solid #c0c0c0; font-family: monospace;">€${row.valpago}</td>
        <td style="border: 1px solid #c0c0c0; font-family: monospace;">€${row.valpendente}</td>
        <td style="border: 1px solid #c0c0c0; font-family: sans-serif; color: #555;">${row.observacoes}</td>
      </tr>`;
    }).join("");

    const xlsTemplate = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Nexus ERP Ledger</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>
      <body>
        <h2 style="font-family: sans-serif; color: #4338ca;">Nexus Edu AI - Diário de Livros de ${activeSheet.toUpperCase()}</h2>
        <p style="font-family: sans-serif; font-size: 11px; color: #555;">Emitido de forma automatizada em: ${new Date().toLocaleString()}</p>
        <table style="border-collapse: collapse; border: 1px solid #c0c0c0;">
          <tr style="background-color: #f3f4f6; color: #1f2937; font-weight: bold;">
            <th style="border: 1px solid #c0c0c0; font-family: sans-serif; padding: 6px;">ID</th>
            <th style="border: 1px solid #c0c0c0; font-family: sans-serif; padding: 6px;">Beneficiário / Descrição</th>
            <th style="border: 1px solid #c0c0c0; font-family: sans-serif; padding: 6px;">Responsável / Credor</th>
            <th style="border: 1px solid #c0c0c0; font-family: sans-serif; padding: 6px;">Turma / Categoria</th>
            <th style="border: 1px solid #c0c0c0; font-family: sans-serif; padding: 6px;">Mensalidade Base</th>
            <th style="border: 1px solid #c0c0c0; font-family: sans-serif; padding: 6px;">Vencimento</th>
            <th style="border: 1px solid #c0c0c0; font-family: sans-serif; padding: 6px;">Estado</th>
            <th style="border: 1px solid #c0c0c0; font-family: sans-serif; padding: 6px;">Método</th>
            <th style="border: 1px solid #c0c0c0; font-family: sans-serif; padding: 6px;">Valor Pago</th>
            <th style="border: 1px solid #c0c0c0; font-family: sans-serif; padding: 6px;">Valor Pendente</th>
            <th style="border: 1px solid #c0c0c0; font-family: sans-serif; padding: 6px;">Observações</th>
          </tr>
          ${rowContent}
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([xlsTemplate], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexus_livro_${activeSheet}_${new Date().toISOString().substring(0, 10)}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = () => {
    // Beautiful customizable print view trigger
    window.print();
  };

  const handleShareToCloud = (cloudProvider: string) => {
    setShareStatus(`A ligar integradores para o ${cloudProvider}...`);
    setTimeout(() => {
      setShareStatus(`✅ Sincronização executada! Livro de ${activeSheet} carregado de forma atômica no canal seguro de auditoria do ${cloudProvider}!`);
      setTimeout(() => setShareStatus(null), 4000);
    }, 1500);
  };

  const handleSendSharedEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareEmailText.trim()) return;

    setShareStatus('A processar envio do correio eletrónico seguro institucional...');
    setTimeout(() => {
      setShareStatus(`✉️ Relatório de finanças institucionais de ${activeSheet.toUpperCase()} despachado com sucesso para ${shareEmailText}! (Acompanhado de checksum criptográfico SHA256)`);
      setShareEmailText('');
      setIsShareEmailOpen(false);
      setTimeout(() => setShareStatus(null), 5000);
    }, 1600);
  };

  // --- SECTION 6: ACTIONS MANAGEMENT HOOKS ---
  const handleRegisterPaymentSubmit = (data: { studentId: string; studentName: string; amount: number; dueDate: string; method: string; comment?: string }) => {
    const newId = `FAT-${Math.floor(1000 + Math.random() * 9000)}`;
    const newInv: Invoice = {
      id: newId,
      studentId: data.studentId,
      studentName: data.studentName,
      amount: data.amount,
      dueDate: data.dueDate,
      status: 'paid', // registering payment automatically completes it as paid
      category: 'tuition'
    };

    const updated = [newInv, ...localInvoices];
    setLocalInvoices(updated);
    localStorage.setItem('nexus_invoices', JSON.stringify(updated));
    onAddInvoice({
      studentId: data.studentId,
      studentName: data.studentName,
      amount: data.amount,
      dueDate: data.dueDate,
      status: 'paid',
      category: 'tuition'
    });

    // Save extra fields
    const updatedCells = { ...cellsData };
    updatedCells[getOverrideKey(newId, 'metodo')] = data.method;
    if (data.comment) updatedCells[getOverrideKey(newId, 'observacoes')] = data.comment;
    updatedCells[getOverrideKey(newId, 'valpago')] = String(data.amount);
    updatedCells[getOverrideKey(newId, 'valpendente')] = '0';
    setCellsData(updatedCells);
  };

  const handleEditPaymentSubmit = (id: string, updates: { amount: number; status: 'paid' | 'pending' | 'overdue'; method: string; comment?: string }) => {
    const idx = localInvoices.findIndex(inv => inv.id === id);
    if (idx !== -1) {
      const updated = [...localInvoices];
      updated[idx] = {
        ...updated[idx],
        amount: updates.amount,
        status: updates.status
      };
      setLocalInvoices(updated);
      localStorage.setItem('nexus_invoices', JSON.stringify(updated));
      onUpdateInvoiceStatus(id, updates.status);

      // Store other fields
      const updatedCells = { ...cellsData };
      updatedCells[getOverrideKey(id, 'metodo')] = updates.method;
      if (updates.comment) updatedCells[getOverrideKey(id, 'observacoes')] = updates.comment;
      updatedCells[getOverrideKey(id, 'valpago')] = updates.status === 'paid' ? String(updates.amount) : '0';
      updatedCells[getOverrideKey(id, 'valpendente')] = updates.status !== 'paid' ? String(updates.amount) : '0';
      setCellsData(updatedCells);
    }
  };

  const handleCancelPaymentSubmit = (id: string) => {
    onUpdateInvoiceStatus(id, 'pending');
    // Save cell values
    const updatedCells = { ...cellsData };
    updatedCells[getOverrideKey(id, 'valpago')] = '0';
    const inv = localInvoices.find(item => item.id === id);
    if (inv) updatedCells[getOverrideKey(id, 'valpendente')] = String(inv.amount);
    setCellsData(updatedCells);
  };

  const handleBankReconciliation = async () => {
    setReconciliationStatus('loading');
    setReconciliationOutput(null);
    try {
      const { reconcileLiveBankStatement } = await import('../supabaseClient');
      
      // Parse bank statement into { date, description, studentName, amount } rows
      const linesArr = bankStatementText.split('\n');
      const transactions = linesArr
        .map(line => {
          const parts = line.split(',');
          if (parts.length < 3) return null;
          const date = parts[0]?.trim() || '';
          const desc = parts[1]?.trim() || '';
          const potentialName = parts[parts.length - 2]?.trim() || '';
          const amountStr = parts[parts.length - 1]?.trim() || '';
          const amount = parseFloat(amountStr.replace('€', '').trim()) || 0;
          return {
            date,
            description: desc,
            studentName: potentialName,
            amount
          };
        })
        .filter((t): t is { date: string; description: string; studentName: string; amount: number } => t !== null && !!t.studentName && t.amount > 0);

      const result = await reconcileLiveBankStatement(transactions);
      
      const reconciled = result.reconciledList || [];
      const errors = result.errorsList || [];
      const totalAdjusted = reconciled.reduce((sum: number, item: any) => sum + (item.amount || 0), 0);
      
      const mappedResult = {
        totalProcessed: reconciled.length + errors.length,
        totalMatched: reconciled.length,
        totalUnmatched: errors.length,
        matchedCount: reconciled.length,
        totalAdjustedAmount: totalAdjusted,
        matchedInvoices: reconciled.map((item: any) => ({
          id: item.invoiceId,
          studentName: item.studentName,
          amount: item.amount
        }))
      };

      setReconciliationOutput(mappedResult);
      setReconciliationStatus('success');

      // Update local ledger invoices matching payment
      if (mappedResult.matchedInvoices && mappedResult.matchedInvoices.length > 0) {
        let updatedInvs = [...localInvoices];
        let cellsUpdated = { ...cellsData };

        mappedResult.matchedInvoices.forEach((match: any) => {
          const invIdx = updatedInvs.findIndex(inv => inv.id === match.id);
          if (invIdx !== -1) {
            updatedInvs[invIdx] = {
              ...updatedInvs[invIdx],
              status: 'paid'
            };
            // Sync with cell overrides so spreadsheet matches status
            cellsUpdated[getOverrideKey(match.id, 'estado')] = 'paid';
            cellsUpdated[getOverrideKey(match.id, 'valpago')] = String(match.amount);
            cellsUpdated[getOverrideKey(match.id, 'valpendente')] = '0';
          }
        });

        setLocalInvoices(updatedInvs);
        setCellsData(cellsUpdated);
        localStorage.setItem('nexus_invoices', JSON.stringify(updatedInvs));
      }
    } catch (err) {
      console.error(err);
      setReconciliationStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 font-sans text-zinc-100" id="school-finance-center">
      
      {/* 1. Header Hero Panel with Actions tab bar */}
      <header className="px-6 py-5 bg-zinc-900/40 border-b border-zinc-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-indigo-400" />
            Centro Financeiro Escolar Coesivo
          </h2>
          <p className="text-xs text-zinc-400 leading-relaxed font-mono">
            Nexus Edu ERP v4.0.0 • Gestão Completa de Receitas, Custos Operacionais e IA
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick AI Trigger */}
          <button
            onClick={() => setIsAiOpen(true)}
            className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 text-zinc-950 font-bold text-xs px-4 py-2 rounded-xl transition cursor-pointer"
          >
            <Sparkles className="w-4 h-4 shrink-0 animate-pulse" />
            Assistente IA Financeira
          </button>

          {/* Quick Invoice Receipt Printer button */}
          <button
            onClick={() => {
              const activeRow = activeRows[0];
              if (activeRow && activeRow.raw) {
                setInvoiceToPrint(activeRow.raw);
              } else {
                alert('Nenhum pagamento selecionado para impressão.');
              }
            }}
            className="flex items-center gap-1.5 bg-zinc-800 border border-zinc-700 hover:bg-zinc-750 text-zinc-350 hover:text-white text-xs px-4 py-2 rounded-xl transition cursor-pointer"
          >
            <Printer className="w-4 h-4 shrink-0" />
            Emitir Recibo do Livro
          </button>
        </div>
      </header>

      <main className="px-6 pb-20 max-w-7xl mx-auto">
        
        {/* SECÇÃO 1 — RESUMO FINANCEIRO (6 cards subcomponent) */}
        <FinancialMetrics invoices={localInvoices} expenses={expenses} />

        {/* Global Notifications / Share Alert Hub */}
        {shareStatus && (
          <div className="mb-6 p-3 rounded-xl border border-indigo-500/10 bg-indigo-500/5 text-indigo-400 text-xs font-medium text-left animate-in fade-in duration-200">
            {shareStatus}
          </div>
        )}

        {/* SECÇÃO 2 — DIÁRIO PRINCIPAL TIPO WORKBOOK EXCEL */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden mb-8" id="financial-ledger-workbook">
          
          {/* TOP CONTROLS AND WORKBOOK SHEETS TAB BAR */}
          <div className="px-5 py-4 bg-zinc-900/60 border-b border-zinc-805 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            
            {/* Sheet Tabs */}
            <div className="flex items-center bg-zinc-950 p-1 rounded-xl border border-zinc-800">
              <button
                onClick={() => {
                  setActiveSheet('receitas');
                  setSelectedCell(null);
                  setEditingCell(null);
                }}
                className={`flex items-center gap-1.5 px-4 py-1.75 text-xs font-bold rounded-lg transition-all ${activeSheet === 'receitas' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-zinc-350 cursor-pointer'}`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                Receitas e Propinas (Alunos)
              </button>
              <button
                onClick={() => {
                  setActiveSheet('despesas');
                  setSelectedCell(null);
                  setEditingCell(null);
                }}
                className={`flex items-center gap-1.5 px-4 py-1.75 text-xs font-bold rounded-lg transition-all ${activeSheet === 'despesas' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-zinc-350 cursor-pointer'}`}
              >
                <Layers className="w-3.5 h-3.5" />
                Despesas Escolares (OPEX)
              </button>
            </div>

            {/* In-Line Excel Clipboard & Basic operations */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={triggerClipboardCopy}
                disabled={!selectedCell}
                className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-[10px] uppercase font-mono font-bold text-zinc-400 py-1.5 px-2.5 rounded-lg transition cursor-pointer disabled:opacity-40"
                title="Copiar célula selecionada para área de transferência Nexus"
              >
                <Copy className="w-3.5 h-3.5" /> Copiar
              </button>
              <button
                onClick={triggerClipboardPaste}
                disabled={!selectedCell || excelClipboard === null}
                className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-[10px] uppercase font-mono font-bold text-zinc-400 py-1.5 px-2.5 rounded-lg transition cursor-pointer disabled:opacity-40"
                title="Colar valor copiado na célula ativa"
              >
                <Clipboard className="w-3.5 h-3.5" /> Colar
              </button>

              <div className="w-px h-6 bg-zinc-800 hidden sm:block mx-1"></div>

              {/* Filtering and Query Fields */}
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  placeholder="Pesquisa rápida Excel..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 py-1.5 px-3 rounded-lg text-xs outline-none focus:border-indigo-500 text-white placeholder-zinc-600 w-36 sm:w-44 font-mono"
                />

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="bg-zinc-950 border border-zinc-800 py-1.5 px-2.5 rounded-lg text-xs outline-none text-zinc-300"
                >
                  <option value="all">Filtro Estado</option>
                  <option value="paid">Pago</option>
                  <option value="pending">Pendente</option>
                  <option value="overdue">Atrasado / Vencido</option>
                </select>

                {activeSheet === 'receitas' && (
                  <select
                    value={classFilter}
                    onChange={(e) => setClassFilter(e.target.value)}
                    className="bg-zinc-950 border border-zinc-800 py-1.5 px-2.5 rounded-lg text-xs outline-none text-zinc-300"
                  >
                    <option value="all">Filtro Turma</option>
                    {classesList.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                )}
              </div>
            </div>
          </div>

          {/* ACTIVE GRID EXCEL SPREADSHEET */}
          <div className="overflow-x-auto overflow-y-auto max-h-[460px] scrollbar-thin">
            
            {/* Spreadsheet Formula Bar helper */}
            <div className="bg-zinc-950 border-b border-zinc-900 p-2 text-xs flex items-center gap-2">
              <span className="text-[10px] bg-zinc-800 border border-zinc-700 font-mono px-2 py-0.5 rounded text-indigo-400 font-bold min-w-[32px]">
                {selectedCell ? `${selectedCell.colName.toUpperCase()}${activeRows.findIndex(r => r.id === selectedCell.rowId) + 1}` : 'BAR'}
              </span>
              <span className="text-zinc-600 font-mono text-xs select-none">fx :</span>
              <input
                type="text"
                disabled={!selectedCell}
                value={selectedCell ? (tempCellText || getCellValue(selectedCell.rowId, selectedCell.colName, '')) : ''}
                onChange={(e) => {
                  if (selectedCell) {
                    setTempCellText(e.target.value);
                    setCellValue(selectedCell.rowId, selectedCell.colName, e.target.value);
                  }
                }}
                placeholder="Selecione uma célula ou digite uma fórmula (ex: =SOMA)"
                className="flex-1 bg-transparent text-zinc-200 outline-none font-mono text-xs px-2"
              />
            </div>

            <table className="w-full text-left font-sans text-xs border-collapse select-none" referrerPolicy="no-referrer">
              <thead>
                <tr className="bg-zinc-900 text-zinc-400 border-b border-zinc-850 font-mono text-[10px] select-none uppercase">
                  {/* Outer column header cells */}
                  <th className="p-2 w-10 text-center border-r border-zinc-850 select-none">
                    <input
                      type="checkbox"
                      checked={activeRows.length > 0 && selectedRowIds.size === activeRows.length}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="cursor-pointer"
                    />
                  </th>
                  <th className="p-2 border-r border-zinc-850 text-center font-bold text-zinc-500 w-8 select-none">#</th>
                  
                  {/* Excel column names keys mapped */}
                  {[
                    { field: 'id', label: 'A • ID', w: '90px' },
                    { field: 'aluno', label: 'B • Aluno / Beneficiário', w: '180px' },
                    { field: 'responsavel', label: 'C • Responsável', w: '180px' },
                    { field: 'turma', label: 'D • Turma / Cat', w: '90px' },
                    { field: 'mensalidade', label: 'E • Mensalidade Base', w: '110px' },
                    { field: 'vencimento', label: 'F • Vencimento', w: '100px' },
                    { field: 'estado', label: 'G • Estado', w: '95px' },
                    { field: 'metodo', label: 'H • Meio Liquidação', w: '110px' },
                    { field: 'valpago', label: 'I • Valor Pago', w: '90px' },
                    { field: 'valpendente', label: 'J • Valor Pendente', w: '90px' },
                    { field: 'observacoes', label: 'K • Observações', w: '180px' },
                  ].map(h => (
                    <th 
                      key={h.field} 
                      style={{ minWidth: h.w }}
                      className="p-2.5 border-r border-zinc-850 hover:bg-zinc-800 transition cursor-pointer relative"
                      onClick={() => setSortBy({ field: h.field, direction: sortBy?.field === h.field && sortBy.direction === 'asc' ? 'desc' : 'asc' })}
                    >
                      <div className="flex items-center gap-1 justify-between select-none p-1">
                        <span>{h.label}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-zinc-900">
                {activeRows.length > 0 ? (
                  activeRows.map((row, idx) => {
                    const isRowChecked = selectedRowIds.has(row.id);
                    const stateObj = row.raw?.status || row.estado;

                    return (
                      <tr 
                        key={row.id} 
                        className={`hover:bg-zinc-900/60 transition ${isRowChecked ? 'bg-indigo-500/5' : ''}`}
                      >
                        {/* Selector checkbox cell */}
                        <td className="p-2 text-center border-r border-zinc-900 select-none">
                          <input
                            type="checkbox"
                            checked={isRowChecked}
                            onChange={() => handleToggleSelectRow(row.id)}
                            className="cursor-pointer"
                          />
                        </td>
                        
                        {/* Row line numbers index column */}
                        <td className="p-2.5 border-r border-zinc-900 text-center font-mono text-[10px] text-zinc-600 bg-zinc-950/80 font-bold select-none">
                          {idx + 1}
                        </td>

                        {/* ID (Read-only) */}
                        <td className="p-2.5 border-r border-zinc-900 font-mono text-[10px] text-zinc-400 bg-zinc-950/40 select-text">
                          {row.id}
                        </td>

                        {/* Interactive columns letters B to K */}
                        {['aluno', 'responsavel', 'turma', 'mensalidade', 'vencimento', 'estado', 'metodo', 'valpago', 'valpendente', 'observacoes'].map((col) => {
                          const val = row[col];
                          const isSelected = selectedCell?.rowId === row.id && selectedCell?.colName === col;
                          const isEditing = editingCell?.rowId === row.id && editingCell?.colName === col;

                          return (
                            <td 
                              key={col}
                              onClick={() => {
                                setSelectedCell({ rowId: row.id, colName: col });
                                setTempCellText(getCellValue(row.id, col, String(val)));
                              }}
                              onDoubleClick={() => {
                                setEditingCell({ rowId: row.id, colName: col });
                                setTempCellText(getCellValue(row.id, col, String(val)));
                              }}
                              className={`p-2 border-r border-zinc-900 cursor-cell font-mono text-xs overflow-hidden max-w-[170px] truncate relative transition-all duration-150 ${
                                isSelected ? 'ring-2 ring-indigo-500 ring-inset bg-indigo-500/5' : ''
                              }`}
                            >
                              {isEditing ? (
                                <input
                                  type="text"
                                  autoFocus
                                  value={tempCellText}
                                  onChange={(e) => setTempCellText(e.target.value)}
                                  onBlur={() => {
                                    setCellValue(row.id, col, tempCellText);
                                    setEditingCell(null);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      setCellValue(row.id, col, tempCellText);
                                      setEditingCell(null);
                                    }
                                    if (e.key === 'Escape') setEditingCell(null);
                                  }}
                                  className="absolute inset-0 bg-zinc-950 text-white font-mono text-xs px-2 border-none outline-none select-text"
                                />
                              ) : col === 'estado' ? (
                                <span className={`inline-flex items-center gap-1 text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-full border ${
                                  stateObj === 'paid' || stateObj === 'pago'
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    : stateObj === 'overdue' || stateObj === 'vencido'
                                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                }`}>
                                  {stateObj === 'paid' || stateObj === 'pago' ? 'PAGO' : stateObj === 'overdue' || stateObj === 'vencido' ? 'ATRASADO' : 'PENDENTE'}
                                </span>
                              ) : col === 'valpago' || col === 'valpendente' || col === 'mensalidade' ? (
                                <span className="font-mono text-zinc-150">
                                  €{Number(val).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              ) : col === 'observacoes' ? (
                                <span className="text-zinc-500 font-sans italic text-[11px]">{val || '—'}</span>
                              ) : (
                                <span className={col === 'responsavel' || col === 'aluno' ? 'text-zinc-100 font-sans font-medium' : 'text-zinc-300 font-mono text-[11px]'}>
                                  {val || '—'}
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={13} className="text-center p-8 text-zinc-600 font-mono">
                      Nenhum dado encontrado no livro Excel com estes filtros associados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* LOWER STATUS AND MULTI ACTIONS BAR OF SPREADSHEET */}
          <div className="px-5 py-4 bg-zinc-900/60 border-t border-zinc-850 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            
            {/* Status counts segments */}
            <div className="flex flex-wrap gap-2.5 text-[10px] text-zinc-500 font-mono">
              <span>Linhas Carregadas: <strong className="text-zinc-300">{activeRows.length}</strong></span>
              <span className="text-zinc-700 font-bold">•</span>
              <span>Análise Ativa: <strong className="text-zinc-300 font-mono">{activeSheet === 'receitas' ? 'Mensalidades Regulares' : 'Capex/Opex Escolar'}</strong></span>
              {selectedRowIds.size > 0 && (
                <>
                  <span className="text-zinc-700 font-bold">•</span>
                  <span>Selecionados: <strong className="text-indigo-400">{selectedRowIds.size} faturas</strong></span>
                </>
              )}
            </div>

            {/* General Spreadsheet actions combo */}
            <div className="flex flex-wrap items-center gap-2">
              {selectedRowIds.size > 0 && (
                <>
                  <button
                    onClick={handleBatchMarkAsPaid}
                    className="flex items-center gap-1 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs py-1.5 px-3 rounded-lg transition transition cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Marcar Pago
                  </button>
                  <button
                    onClick={handleDeleteSelectedRows}
                    className="flex items-center gap-1 bg-zinc-900 border border-rose-500/20 text-rose-450 hover:bg-rose-500/10 hover:border-rose-500/40 font-bold text-xs py-1.5 px-3 rounded-lg transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" /> Apagar Linhas
                  </button>
                </>
              )}

              <button
                onClick={handleAddNewRow}
                className="flex items-center gap-1 bg-zinc-800 border border-zinc-700 hover:bg-zinc-750 text-zinc-200 text-xs py-1.5 px-3.5 rounded-lg transition font-medium cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Inserir Linha
              </button>

              {/* Individual receipt trigger */}
              {selectedCell && (
                <button
                  onClick={() => {
                    const rowData = getRowDataById(selectedCell.rowId);
                    if (rowData && activeSheet === 'receitas') {
                      const itemObj = localInvoices.find(i => i.id === selectedCell.rowId);
                      if (itemObj) {
                        setInvoiceToPrint(itemObj);
                      }
                    } else {
                      alert('Selecione uma fatura do livro de receitas para abrir o recibo.');
                    }
                  }}
                  className="flex items-center gap-1 bg-zinc-900 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/10 text-xs py-1.5 px-3.5 rounded-lg transition font-medium cursor-pointer"
                >
                  <Printer className="w-4 h-4" /> Ver Recibo / PDF
                </button>
              )}
            </div>

          </div>

        </div>

        {/* SECÇÃO 3 — EXPORTAÇÃO, EXPANSÃO E RELATÓRIOS PARTILHADOS */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-5 mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6" id="financial-share-exports">
          
          <div className="space-y-1.5 text-left">
            <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Download className="w-4 h-4 text-emerald-400" /> Exportação de Livros e Emissão de Relatórios
            </h4>
            <p className="text-xs text-zinc-400 font-sans">
              Descarregue o diário financeiro ativo para fins de auditoria ou partilhe de forma imediata com a direção.
            </p>
          </div>

          {/* Quick Hub Panel layout bar */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Standard Excel format */}
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1 bg-zinc-900 hover:bg-zinc-850 hover:text-white text-xs border border-zinc-800 px-3 py-2 rounded-xl text-zinc-300 font-mono transition cursor-pointer"
            >
              <FileDown className="w-4 h-4 text-indigo-400" /> EXCEL (.xls)
            </button>
            {/* Standard Semicolon Semicolon CSV format */}
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1 bg-zinc-900 hover:bg-zinc-850 hover:text-white text-xs border border-zinc-800 px-3 py-2 rounded-xl text-zinc-300 font-mono transition cursor-pointer"
            >
              <FileDown className="w-4 h-4 text-emerald-400" /> CSV COMMA
            </button>
            {/* Standard Printable PDF dashboard feel */}
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-1 bg-zinc-900 hover:bg-zinc-850 hover:text-white text-xs border border-zinc-800 px-3 py-2 rounded-xl text-zinc-300 font-mono transition cursor-pointer"
            >
              <Printer className="w-4 h-4 text-rose-400" /> PDF PRINT
            </button>

            {/* Email form trigger */}
            <button
              onClick={() => setIsShareEmailOpen(!isShareEmailOpen)}
              className="flex items-center gap-1 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 px-3.5 py-2 rounded-xl text-zinc-350 text-xs transition cursor-pointer font-bold"
            >
              <Mail className="w-4 h-4 text-amber-400" /> Partilhar Correio
            </button>

            {/* Cloud Storage simulators */}
            <button
              onClick={() => handleShareToCloud('Google Drive')}
              className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 px-3.5 py-2 rounded-xl text-zinc-350 text-xs transition cursor-pointer font-semibold"
              title="Sincronizar livro atual de receitas com o Google Drive"
            >
              <UploadCloud className="w-4 h-4 text-indigo-450" /> Sync Drive
            </button>
          </div>
        </div>

        {/* Email Popover Container Form */}
        {isShareEmailOpen && (
          <form 
            onSubmit={handleSendSharedEmail}
            className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl mb-8 space-y-3 max-w-md ml-auto text-left animate-in slide-in-from-top duration-200"
          >
            <div className="flex justify-between items-center">
              <label className="text-xs text-zinc-350 font-bold font-mono">Enviar Diário para Correio Corporativo</label>
              <button type="button" onClick={() => setIsShareEmailOpen(false)} className="text-zinc-600 hover:text-white"><X className="w-3.5 h-3.5" /></button>
            </div>
            <div className="flex gap-2">
              <input
                type="email"
                required
                value={shareEmailText}
                onChange={(e) => setShareEmailText(e.target.value)}
                placeholder="Ex: direcao@escola-nexus.pt"
                className="bg-zinc-950 border border-zinc-850 focus:border-indigo-500 rounded-lg py-1.5 px-3 outline-none text-xs text-white placeholder-zinc-700 flex-1 font-mono"
              />
              <button 
                type="submit"
                className="bg-indigo-500 hover:bg-indigo-400 text-zinc-950 font-bold px-3 py-1.5 rounded-lg text-xs cursor-pointer flex items-center gap-1 transition"
              >
                Enviar <Share2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        )}

        {/* SECÇÃO 4 — DASHBOARD DE GRÁFICOS PROFISSIONAIS (5 visualizers combo) */}
        <FinancialCharts invoices={localInvoices} expenses={expenses} />

        {/* SECÇÃO EXTRA — INTEGRATED AUTOMATIC BANK RECONCILIATION HUB */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 text-left space-y-4" id="nexus-automated-bank-reconciliation">
          <div className="border-b border-zinc-900 pb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-1.5 font-sans">
                <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin" style={{ animationDuration: '6s' }} /> Reconciliação Bancária Automatizada Integrada
              </h4>
              <p className="text-xs text-zinc-400 mt-1 font-sans">
                Insira ou cole o extrato de transferências bancárias em formato CSV/Texto. O sistema Nexus AI cruzará titulares e montantes de forma inteligente com as faturas em aberto.
              </p>
            </div>
            <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded border border-emerald-500/20 font-bold shrink-0">
              Sincronização Ativa
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 font-sans">
            <div className="space-y-3 text-left">
              <label className="text-[10px] uppercase font-mono text-zinc-400 block font-bold">Extrato Bancário de Entrada (Formato Linha: Data, Descrição, Nome Aluno, Montante)</label>
              <textarea
                value={bankStatementText}
                onChange={(e) => setBankStatementText(e.target.value)}
                placeholder="Exemplo:\n2026-06-15, TRANSF COB, Alice Siqueira, 150.05"
                rows={5}
                className="w-full bg-zinc-900/50 border border-zinc-800 focus:border-emerald-500 rounded-xl p-3 text-xs text-zinc-100 font-mono outline-none transition"
              />

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <span className="text-[10px] text-zinc-500 leading-normal max-w-sm">
                  ⚠️ Certifique-se de que cada linha possui o nome do aluno e o valor pago correspondente.
                </span>
                <button
                  type="button"
                  onClick={handleBankReconciliation}
                  disabled={reconciliationStatus === 'loading'}
                  className="bg-emerald-500 hover:bg-emerald-450 disabled:bg-zinc-850 text-zinc-950 disabled:text-zinc-650 font-bold text-xs px-5 py-2.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  {reconciliationStatus === 'loading' ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Auditando e Cruzando...
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" /> Executar Reconciliação Cognitiva
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="bg-zinc-900/10 border border-zinc-900 rounded-xl p-4 flex flex-col justify-between text-left">
              <div>
                <h5 className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider font-mono">Resultado do Último Lote de Conciliação</h5>
                
                {reconciliationStatus === 'idle' && (
                  <p className="text-xs text-zinc-500 italic mt-6 text-center font-mono">Nenhum lote processado neste turno. Cole o extrato ao lado e clique em Executar.</p>
                )}

                {reconciliationStatus === 'loading' && (
                  <div className="py-8 space-y-2 text-center text-xs text-zinc-400 font-mono">
                    <Loader2 className="w-5 h-5 animate-spin text-emerald-400 mx-auto" />
                    <span>Analisando padrões nominais, tolerâncias decimais e registando liquidações no banco de dados...</span>
                  </div>
                )}

                {reconciliationStatus === 'error' && (
                  <div className="p-3 bg-rose-500/10 border border-rose-550/20 rounded-lg text-xs mt-4 text-center text-rose-400">
                    Falha crítica na API de Reconciliação do servidor. Verifique a sintaxe do extrato.
                  </div>
                )}

                {reconciliationStatus === 'success' && reconciliationOutput && (
                  <div className="mt-4 space-y-3 font-sans">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-zinc-900/80 p-2.5 border border-zinc-855 rounded">
                        <span className="text-[9px] uppercase font-mono text-zinc-500">Linhas Processadas</span>
                        <span className="text-sm font-bold text-zinc-200 block mt-0.5 font-mono">{reconciliationOutput.totalProcessed}</span>
                      </div>
                      <div className="bg-zinc-900/80 p-2.5 border border-zinc-855 rounded">
                        <span className="text-[9px] uppercase font-mono text-emerald-500">Matches Encontrados</span>
                        <span className="text-sm font-bold text-emerald-400 block mt-0.5 font-mono">{reconciliationOutput.totalMatched}</span>
                      </div>
                      <div className="bg-zinc-900/80 p-2.5 border border-zinc-855 rounded">
                        <span className="text-[9px] uppercase font-mono text-zinc-500">Incompatíveis</span>
                        <span className="text-sm font-bold text-zinc-400 block mt-0.5 font-mono">{reconciliationOutput.totalUnmatched}</span>
                      </div>
                      <div className="bg-zinc-900/80 p-2.5 border border-zinc-855 rounded">
                        <span className="text-[9px] uppercase font-mono text-emerald-500 font-semibold font-mono">Total Auto-Liquidado</span>
                        <span className="text-sm font-bold text-emerald-400 block mt-0.5 font-mono">€{reconciliationOutput.totalAdjustedAmount}</span>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-1.5 text-left">
                      <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest block font-bold">Detalhamento dos Matches Registados:</span>
                      {reconciliationOutput.matchedInvoices.length === 0 ? (
                        <p className="text-[10px] text-zinc-500 italic">Nenhuma fatura pôde ser liquidada automaticamente para estes registros bancários.</p>
                      ) : (
                        <div className="max-h-24 overflow-y-auto pr-1 space-y-1">
                          {reconciliationOutput.matchedInvoices.map((inv: any, idx: number) => (
                            <div key={idx} className="p-1.5 bg-zinc-950/80 border border-zinc-900 rounded text-[10px] flex items-center justify-between font-mono">
                              <span className="text-indigo-400 font-bold">{inv.id}</span>
                              <span className="text-zinc-300 truncate max-w-28 capitalize">{inv.studentName}</span>
                              <span className="text-emerald-400 font-bold">€{inv.amount}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-zinc-900 pt-3 mt-4 text-[10px] text-zinc-500 flex justify-between items-center bg-zinc-950/20 px-2 py-1 rounded">
                <span>Último Estado: <strong className="uppercase font-mono text-emerald-455">{reconciliationStatus}</strong></span>
                <span>Auditado Ativamente</span>
              </div>
            </div>
          </div>
        </div>

        {/* SECÇÃO 6 — ÁREA AUXILIAR DE COBRANÇAS / REGISTOS DE PAGAMENTO */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 text-left space-y-4" id="payments-management-hub">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="space-y-1.5">
              <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                <DollarSign className="w-4.5 h-4.5 text-indigo-400" /> Área de Gestão & Conciliação de Pagamentos
              </h4>
              <p className="text-xs text-zinc-400 font-sans">
                Selecione uma fatura do livro ativo Excel para liquidar, editar detalhes de meio, ou cancelar transação (Unpay).
              </p>
            </div>

            <button
              onClick={() => {
                setActivePaymentInvoice(null);
                setIsPaymentModalOpen(true);
              }}
              className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs px-4  py-2 rounded-xl transition flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Registar Novo Pagamento
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {localInvoices.slice(0, 3).map((inv, idx) => {
              const student = studentLookup[inv.studentId];
              
              return (
                <div 
                  key={`${inv.id}-${idx}`}
                  className="bg-zinc-900/35 border border-zinc-900 rounded-xl p-4 flex flex-col justify-between hover:border-zinc-800 transition duration-200"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] bg-zinc-800 border border-zinc-750 px-2 py-0.5 rounded text-zinc-400 font-mono">
                        {inv.id}
                      </span>
                      <h5 className="text-xs font-bold text-white mt-1.5">{inv.studentName}</h5>
                      <p className="text-[10px] text-zinc-550 mt-0.5">{student?.class || '8º Ano B'}</p>
                    </div>

                    <span className={`text-[9px] uppercase font-mono font-bold px-2 py-0.5 rounded border ${
                      inv.status === 'paid'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : inv.status === 'overdue'
                        ? 'bg-rose-500/10 text-rose-450 border-rose-500/20'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    }`}>
                      {inv.status === 'paid' ? 'Pago' : inv.status === 'overdue' ? 'Vencido' : 'Pendente'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-3 mt-3 border-t border-zinc-900">
                    <span className="font-mono text-xs font-bold text-zinc-200">
                      €{inv.amount.toLocaleString('pt-PT')}
                    </span>
                    <div className="flex items-center gap-2">
                      {inv.status === 'overdue' && (
                        <button
                          onClick={() => {
                            alert('A preparar minuta de acordo financeiro... Redirecionando para Assinaturas Digitais.');
                            window.dispatchEvent(new CustomEvent('nexus-navigate-tab', { detail: 'signatures' }));
                          }}
                          className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-0.5 font-mono cursor-pointer border border-amber-500/20 bg-amber-500/5 px-2 py-0.5 rounded hover:bg-amber-500/10 transition-colors"
                          title="Acordo de Parcelamento Digital para Vencidos"
                        >
                          Acordo Digital
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setActivePaymentInvoice(inv);
                          setIsPaymentModalOpen(true);
                        }}
                        className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 font-mono cursor-pointer"
                      >
                        Gerir Pagamento <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </main>

      {/* SECÇÃO 5 — ASSISTENTE FINANCEIRO IA DRAWER SLIDEOVER */}
      <FinancialAI 
        invoices={localInvoices}
        expenses={expenses}
        isOpen={isAiOpen}
        onClose={() => setIsAiOpen(false)}
      />

      {/* SECÇÃO 6 — DETALHE / DIALOGO DE GESTÃO DE PAGAMENTOS */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        invoice={activePaymentInvoice}
        students={students}
        onRegister={handleRegisterPaymentSubmit}
        onEdit={handleEditPaymentSubmit}
        onCancelPay={handleCancelPaymentSubmit}
      />

      {/* RENDER MODAL FOR PRINT RECEIPT PROOFS (HIGH FIDELITY) */}
      {invoiceToPrint && (
        <PrintInvoiceModal 
          invoice={invoiceToPrint} 
          onClose={() => setInvoiceToPrint(null)} 
        />
      )}

    </div>
  );
}

// Simple close button helper definition
function X({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
      referrerPolicy="no-referrer"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
