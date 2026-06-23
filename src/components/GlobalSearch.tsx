import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, X, Filter, Calendar, Layers, CheckCircle2, User, Users, 
  DollarSign, FileText, Award, Layers2, Bell, ShieldCheck, Mail, ArrowRight, 
  ExternalLink, CreditCard, ChevronRight, Hash, Eye, Sparkles, MessageSquare, Clock
} from 'lucide-react';
import { Student, Teacher, Invoice, Announcement, ChatMessage, UserRole } from '../types';

interface GlobalSearchProps {
  students: Student[];
  teachers: Teacher[];
  invoices: Invoice[];
  announcements: Announcement[];
  messages: ChatMessage[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
  theme: 'dark' | 'light';
  // Selected hooks to allow editing the student directly from search
  onUpdateStudent?: (id: string, updatedFields: Partial<Student>) => void;
  // External triggers
  onOpenStudentDetail?: (student: Student) => void;
  onOpenTeacherDetail?: (teacher: Teacher) => void;
}

export default function GlobalSearch({
  students,
  teachers,
  invoices,
  announcements,
  messages,
  activeTab,
  setActiveTab,
  theme,
  onUpdateStudent,
  onOpenStudentDetail,
  onOpenTeacherDetail
}: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  
  // Fitler states
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('any');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Selected item detail state
  const [selectedStudentDetail, setSelectedStudentDetail] = useState<Student | null>(null);
  const [selectedTeacherDetail, setSelectedTeacherDetail] = useState<Teacher | null>(null);
  const [selectedInvoiceDetail, setSelectedInvoiceDetail] = useState<Invoice | null>(null);
  const [selectedGeneralDocDetail, setSelectedGeneralDocDetail] = useState<any | null>(null);

  // Keybindings for search box (Ctrl+K or Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      } else if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Soft fuzzy search match helper
  const matchesText = (text: string | undefined, searchTerm: string) => {
    if (!text) return false;
    return text.toLowerCase().includes(searchTerm.toLowerCase());
  };

  // Run the institutional multi-entity indexing 
  const indexedData = useMemo(() => {
    const term = query.trim();
    if (!term) return { 
      students: [], teachers: [], guardians: [], invoices: [], contracts: [], 
      documents: [], certificates: [], registrations: [], classes: [], notifications: [],
      totalCount: 0 
    };

    // 1. ALUNOS
    const matchedStudents = students.filter(s => 
      matchesText(s.name, term) || 
      matchesText(s.id, term) || 
      matchesText(s.class, term)
    );

    // 2. PROFESSORES
    const matchedTeachers = teachers.filter(t => 
      matchesText(t.name, term) || 
      matchesText(t.id, term) || 
      matchesText(t.email, term) ||
      t.subjects.some(sub => matchesText(sub, term))
    );

    // 3. RESPONSÁVEIS
    const matchedGuardians = students
      .filter(s => matchesText(s.guardiansName, term) || matchesText(s.guardiansContact, term))
      .map(s => ({
        id: `RESP-${s.id}`,
        name: s.guardiansName,
        contact: s.guardiansContact,
        studentId: s.id,
        studentName: s.name,
        class: s.class
      }));

    // 4. PAGAMENTOS (Invoices)
    const matchedInvoices = invoices.filter(i => 
      matchesText(i.id, term) || 
      matchesText(i.studentName, term) || 
      matchesText(i.studentId, term) ||
      matchesText(i.status, term) ||
      matchesText(i.category, term)
    );

    // 5. CONTRATOS (Documents with contract keyword)
    const matchedContracts: any[] = [];
    students.forEach(s => {
      s.documents.forEach(doc => {
        if (doc.name.toLowerCase().includes('contrato') || doc.name.toLowerCase().includes('prestação')) {
          if (matchesText(doc.name, term) || matchesText(s.name, term) || matchesText(s.id, term)) {
            matchedContracts.push({
              id: `CTR-${s.id}-${doc.name.substring(0,3).toUpperCase()}`,
              name: doc.name,
              studentId: s.id,
              studentName: s.name,
              submitted: doc.submitted,
              date: doc.date || 'Não registada',
              type: 'Contrato Académico'
            });
          }
        }
      });
    });
    // Add teachers employment contracts
    teachers.forEach(t => {
      t.documents?.forEach(doc => {
        if (doc.name.toLowerCase().includes('contrato')) {
          if (matchesText(doc.name, term) || matchesText(t.name, term)) {
            matchedContracts.push({
              id: `CTR-${t.id}-${doc.name.substring(0,3).toUpperCase()}`,
              name: doc.name,
              teacherId: t.id,
              teacherName: t.name,
              submitted: doc.submitted,
              date: doc.date || 'Não registada',
              type: 'Contrato de Trabalho'
            });
          }
        }
      });
    });

    // 6. DOCUMENTOS
    const matchedDocuments: any[] = [];
    students.forEach(s => {
      s.documents.forEach(doc => {
        if (matchesText(doc.name, term) || matchesText(s.name, term)) {
          matchedDocuments.push({
            id: `DOC-${s.id}-${doc.name.replace(/\s+/g,'-').substring(0,10).toUpperCase()}`,
            name: doc.name,
            entityType: 'student',
            entityId: s.id,
            entityName: s.name,
            submitted: doc.submitted,
            date: doc.date || 'Pendente'
          });
        }
      });
    });
    teachers.forEach(t => {
      t.documents?.forEach(doc => {
        if (matchesText(doc.name, term) || matchesText(t.name, term)) {
          matchedDocuments.push({
            id: `DOC-${t.id}-${doc.name.replace(/\s+/g,'-').substring(0,10).toUpperCase()}`,
            name: doc.name,
            entityType: 'teacher',
            entityId: t.id,
            entityName: t.name,
            submitted: doc.submitted,
            date: doc.date || 'Pendente'
          });
        }
      });
    });

    // 7. CERTIFICADOS (Documents match medical lists, diplomas, or declarations)
    const matchedCertificates: any[] = [];
    students.forEach(s => {
      s.documents.forEach(doc => {
        const isCert = ['boletim', 'atestado', 'certificado', 'vacinas', 'diploma', 'habilitações'].some(k => doc.name.toLowerCase().includes(k));
        if (isCert && (matchesText(doc.name, term) || matchesText(s.name, term))) {
          matchedCertificates.push({
            id: `CRT-${s.id}-${doc.name.substring(0,3).toUpperCase()}`,
            name: doc.name,
            studentId: s.id,
            studentName: s.name,
            submitted: doc.submitted,
            date: doc.date || 'Não registado'
          });
        }
      });
    });
    teachers.forEach(t => {
      t.documents?.forEach(doc => {
        const isCert = ['diploma', 'criminal', 'habilitações', 'registro', 'cédula'].some(k => doc.name.toLowerCase().includes(k));
        if (isCert && (matchesText(doc.name, term) || matchesText(t.name, term))) {
          matchedCertificates.push({
            id: `CRT-${t.id}-${doc.name.substring(0,3).toUpperCase()}`,
            name: doc.name,
            teacherId: t.id,
            teacherName: t.name,
            submitted: doc.submitted,
            date: doc.date || 'Não registado'
          });
        }
      });
    });

    // 8. MATRÍCULAS (Registration status / enrollment pipelines)
    const matchedRegistrations = students
      .filter(s => matchesText(s.status, term) || matchesText(s.class, term) || matchesText(s.name, term))
      .map(s => ({
        id: `MAT-${s.id}`,
        studentId: s.id,
        studentName: s.name,
        class: s.class,
        status: s.status === 'active' ? 'Homologada' : 'Pendente',
        date: s.documents.find(d => d.name.includes('Contrato'))?.date || '2026-01-10',
        outstandingFees: s.outstandingFees
      }));

    // 9. TURMAS
    // Extract unique classes/turmas matching search term
    const uniqueClasses = Array.from(new Set([
      ...students.map(s => s.class),
      ...teachers.flatMap(t => t.classes)
    ]));
    const matchedClasses = uniqueClasses
      .filter(c => matchesText(c, term))
      .map(classCode => {
        const classStudents = students.filter(s => s.class === classCode);
        const classTeachers = teachers.filter(t => t.classes.includes(classCode));
        return {
          id: `TRM-${classCode.replace(/\s+/g, '-')}`,
          name: classCode,
          studentsCount: classStudents.length,
          teachersCount: classTeachers.length,
          coordinator: classTeachers[0]?.name || 'Por definir'
        };
      });

    // 10. NOTIFICAÇÕES (Announcements and Messages)
    const matchedAnnouncements = announcements
      .filter(a => matchesText(a.title, term) || matchesText(a.content, term) || matchesText(a.author, term))
      .map(a => ({
        id: a.id,
        type: 'Aviso',
        title: a.title,
        content: a.content,
        author: a.author,
        date: a.date,
        target: a.target
      }));
    const matchedMessages = messages
      .filter(m => matchesText(m.content, term) || matchesText(m.sender, term))
      .map(m => ({
        id: m.id,
        type: 'Mensagem',
        title: `Chat por ${m.sender}`,
        content: m.content,
        author: m.sender,
        date: 'Hoje ' + m.timestamp,
        target: m.channel
      }));
    
    const matchedNotifications = [...matchedAnnouncements, ...matchedMessages];

    // Total Count raw
    const totalCount = 
      matchedStudents.length + matchedTeachers.length + matchedGuardians.length + 
      matchedInvoices.length + matchedContracts.length + matchedDocuments.length + 
      matchedCertificates.length + matchedRegistrations.length + 
      matchedClasses.length + matchedNotifications.length;

    return {
      students: matchedStudents,
      teachers: matchedTeachers,
      guardians: matchedGuardians,
      invoices: matchedInvoices,
      contracts: matchedContracts,
      documents: matchedDocuments,
      certificates: matchedCertificates,
      registrations: matchedRegistrations,
      classes: matchedClasses,
      notifications: matchedNotifications,
      totalCount
    };
  }, [query, students, teachers, invoices, announcements, messages]);

  // Apply visual-interactive filters for Date, Type/Category, Status and Category of result
  const filteredIndexedData = useMemo(() => {
    let result = { ...indexedData };

    // Function to parse the date and evaluate if it matches the data selection criteria
    const matchesDateFilter = (dateStr: string | undefined) => {
      if (!dateStr || selectedDateFilter === 'any') return true;
      const parsedDate = new Date(dateStr);
      if (isNaN(parsedDate.getTime())) return true; // Safe fallback for pending/improper strings
      
      const today = new Date('2026-06-21'); // Consistent local fake time
      const diffTime = Math.abs(today.getTime() - parsedDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (selectedDateFilter === '30days') return diffDays <= 30;
      if (selectedDateFilter === 'thisyear') return parsedDate.getFullYear() === 2026;
      if (selectedDateFilter === 'week') return diffDays <= 7;
      return true;
    };

    // Apply date filter
    result.students = result.students; // Students don't have explicit registration date in primary, keep all
    result.teachers = result.teachers;
    result.guardians = result.guardians;
    result.invoices = result.invoices.filter(i => matchesDateFilter(i.dueDate));
    result.contracts = result.contracts.filter(c => matchesDateFilter(c.date));
    result.documents = result.documents.filter(d => matchesDateFilter(d.date));
    result.certificates = result.certificates.filter(c => matchesDateFilter(c.date));
    result.registrations = result.registrations.filter(r => matchesDateFilter(r.date));
    result.notifications = result.notifications.filter(n => matchesDateFilter(n.date));

    // Apply status filter 
    // State options: 'all', 'active' (active, paid, submitted), 'pending_overdue' (inactive, overdue, pending)
    if (selectedStatusFilter !== 'all') {
      const isFilterActive = selectedStatusFilter === 'active';
      result.students = result.students.filter(s => isFilterActive ? s.status === 'active' : s.status === 'inactive');
      result.teachers = result.teachers.filter(t => isFilterActive ? t.status === 'active' : t.status === 'inactive');
      result.invoices = result.invoices.filter(i => isFilterActive ? i.status === 'paid' : (i.status === 'overdue' || i.status === 'pending'));
      result.contracts = result.contracts.filter(c => isFilterActive ? c.submitted === true : c.submitted === false);
      result.documents = result.documents.filter(d => isFilterActive ? d.submitted === true : d.submitted === false);
      result.certificates = result.certificates.filter(c => isFilterActive ? c.submitted === true : c.submitted === false);
      result.registrations = result.registrations.filter(r => isFilterActive ? r.status === 'Homologada' : r.status === 'Pendente');
    }

    // Apply Type filter
    if (selectedType !== 'all') {
      // Clear anything else
      if (selectedType !== 'alunos') result.students = [];
      if (selectedType !== 'professores') result.teachers = [];
      if (selectedType !== 'responsaveis') result.guardians = [];
      if (selectedType !== 'pagamentos') result.invoices = [];
      if (selectedType !== 'contratos') result.contracts = [];
      if (selectedType !== 'documentos') result.documents = [];
      if (selectedType !== 'certificados') result.certificates = [];
      if (selectedType !== 'matriculas') result.registrations = [];
      if (selectedType !== 'turmas') result.classes = [];
      if (selectedType !== 'notificacoes') result.notifications = [];
    }

    // Recalculate total count for display
    const totalCount = 
      result.students.length + result.teachers.length + result.guardians.length + 
      result.invoices.length + result.contracts.length + result.documents.length + 
      result.certificates.length + result.registrations.length + 
      result.classes.length + result.notifications.length;

    return {
      ...result,
      totalCount
    };
  }, [indexedData, selectedType, selectedDateFilter, selectedStatusFilter]);

  // Handler to view student's massive details overlay
  const handleOpenStudentDetail = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    if (student) {
      setSelectedStudentDetail(student);
      setSelectedTeacherDetail(null);
      setSelectedInvoiceDetail(null);
      setSelectedGeneralDocDetail(null);
    }
  };

  const handleOpenTeacherDetail = (teacherId: string) => {
    const teacher = teachers.find(t => t.id === teacherId);
    if (teacher) {
      setSelectedTeacherDetail(teacher);
      setSelectedStudentDetail(null);
      setSelectedInvoiceDetail(null);
      setSelectedGeneralDocDetail(null);
    }
  };

  const handleOpenInvoiceDetail = (invoiceId: string) => {
    const invoice = invoices.find(i => i.id === invoiceId);
    if (invoice) {
      setSelectedInvoiceDetail(invoice);
      setSelectedStudentDetail(null);
      setSelectedTeacherDetail(null);
      setSelectedGeneralDocDetail(null);
    }
  };

  const handleOpenDocumentDetail = (doc: any) => {
    setSelectedGeneralDocDetail(doc);
    setSelectedStudentDetail(null);
    setSelectedTeacherDetail(null);
    setSelectedInvoiceDetail(null);
  };

  const handleNavigateToModule = (tab: string) => {
    setActiveTab(tab);
    setIsOpen(false);
  };

  return (
    <>
      {/* FIXED TOP TRIGGER BAR (Always accessible in place) */}
      <div className="relative w-full max-w-sm" id="global_search_trigger_wrapper">
        <button
          onClick={() => setIsOpen(true)}
          className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-left border transition-all cursor-pointer group ${
            theme === 'light' 
              ? 'bg-zinc-50 border-zinc-200 text-zinc-500 hover:bg-white hover:border-zinc-300' 
              : 'bg-zinc-900 border-white/5 text-zinc-400 hover:bg-zinc-900/80 hover:border-white/10'
          }`}
          title="Abrir Pesquisa Global Institucional (Ctrl+K)"
        >
          <div className="flex items-center gap-2.5">
            <Search className="w-4 h-4 text-zinc-400 group-hover:text-indigo-400 transition-colors" />
            <span className="text-xs font-medium">Buscador Institucional Global...</span>
          </div>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 text-[9px] font-bold font-mono text-zinc-400 bg-zinc-950 border border-zinc-850 rounded-md">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* FULL SCREEN SEARCH OVERLAY OVERLAY MODAL */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-zinc-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div 
            id="global_search_panel_modal" 
            className="w-full max-w-5xl h-[85vh] bg-zinc-900 border border-zinc-800 rounded-2xl flex flex-col overflow-hidden shadow-2xl relative"
          >
            
            {/* Header / Search input */}
            <div className="p-4 border-b border-zinc-805 bg-zinc-950 flex items-center gap-3">
              <span className="p-1.5 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/20">
                <Search className="w-5 h-5" />
              </span>
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Pesquisar por Alunos, Professores, Responsáveis, Contratos, Certificados, Mensalidades..."
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-indigo-500 text-zinc-200 text-sm outline-none px-4 py-2.5 rounded-xl font-sans"
                  autoFocus
                />
                {query && (
                  <button 
                    onClick={() => setQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white p-1 rounded cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-2 border border-zinc-855 bg-zinc-900 text-zinc-400 hover:text-white rounded-xl transition-all cursor-pointer font-mono font-bold"
              >
                ESC
              </button>
            </div>

            {/* Quick Informational Label */}
            <div className="bg-zinc-950/40 px-5 py-2 border-b border-zinc-800 flex flex-wrap items-center justify-between text-[10.5px] text-zinc-400 mt-0 font-mono gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                <span>Encontre registos centralizados e visualize a ficha integrada instantaneamente</span>
              </div>
              <div>
                <strong>{filteredIndexedData.totalCount}</strong> resultados filtrados de <strong>{indexedData.totalCount}</strong> totais
              </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-zinc-900 p-3 border-b border-zinc-800 flex flex-wrap items-center gap-4 text-xs font-sans text-zinc-300">
              
              {/* Type selector */}
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                <span className="font-semibold text-zinc-400">Canal:</span>
                <select 
                  value={selectedType} 
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 text-zinc-300 px-2 py-1 rounded-lg outline-none text-xs cursor-pointer focus:border-indigo-500"
                >
                  <option value="all">Sectores (Todos)</option>
                  <option value="alunos">Alunos</option>
                  <option value="professores">Professores</option>
                  <option value="responsaveis">Responsáveis</option>
                  <option value="pagamentos">Pagamentos / Faturas</option>
                  <option value="contratos">Contratos</option>
                  <option value="documentos">Todos os Documentos</option>
                  <option value="certificados">Certificados / Diplomas</option>
                  <option value="matriculas">Matrículas</option>
                  <option value="turmas">Turmas / Classes</option>
                  <option value="notificacoes">Notificações / Chat</option>
                </select>
              </div>

              {/* Date Selector */}
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                <span className="font-semibold text-zinc-400">Prazo:</span>
                <select 
                  value={selectedDateFilter} 
                  onChange={(e) => setSelectedDateFilter(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 text-zinc-300 px-2 py-1 rounded-lg outline-none text-xs cursor-pointer focus:border-indigo-500"
                >
                  <option value="any">Qualquer Data</option>
                  <option value="30days">Últimos 30 dias</option>
                  <option value="thisyear">Este Ano (2026)</option>
                  <option value="week">Última semana</option>
                </select>
              </div>

              {/* Status Selector */}
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
                <span className="font-semibold text-zinc-400">Estado:</span>
                <select 
                  value={selectedStatusFilter} 
                  onChange={(e) => setSelectedStatusFilter(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 text-zinc-300 px-2 py-1 rounded-lg outline-none text-xs cursor-pointer focus:border-indigo-500"
                >
                  <option value="all">Todos os Estados</option>
                  <option value="active">Activo / Pago / Entregue</option>
                  <option value="pending_overdue">Pendente / Em Falta / Atrasado</option>
                </select>
              </div>
            </div>

            {/* Main content grid: results vs details panel */}
            <div className="flex-1 flex overflow-hidden">
              
              {/* RESULTS LIST PANEL (LEFT) */}
              <div className="w-full md:w-1/2 border-r border-zinc-800 overflow-y-auto p-4 space-y-5 flex flex-col justify-between">
                
                {/* Search guide instruction if query is blank */}
                {!query.trim() && (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
                    <div className="p-4 bg-indigo-500/5 text-indigo-400 rounded-full border border-indigo-500/10 animate-bounce">
                      <Search className="w-8 h-8" />
                    </div>
                    <div className="space-y-1 max-w-sm">
                      <h3 className="text-zinc-200 text-xs font-bold font-sans uppercase tracking-wider">Centro de Indexação Nexus</h3>
                      <p className="text-zinc-500 text-[11px] leading-relaxed">
                        Digite um termo para pesquisar instantaneamente em toda a base da escola: alunos, professores, responsáveis, pagamentos, contratos, certificados, turmas e notificações.
                      </p>
                    </div>
                    <div className="w-full max-w-xs p-3 bg-zinc-950 border border-zinc-850 rounded-xl text-left space-y-1.5 font-mono text-[10px]">
                      <span className="text-indigo-400 font-bold block">Experimente digitar:</span>
                      <button onClick={() => setQuery('Alice')} className="block text-zinc-450 hover:text-white cursor-pointer hover:underline text-left">→ "Alice" (Ver Aluno, Documentos, Contratos, Média)</button>
                      <button onClick={() => setQuery('Bruno')} className="block text-zinc-450 hover:text-white cursor-pointer hover:underline text-left">→ "Bruno" (Ver Pendências, Responsável Sandra)</button>
                      <button onClick={() => setQuery('9º Ano')} className="block text-zinc-450 hover:text-white cursor-pointer hover:underline text-left">→ "9º Ano" (Filtro por Turma / Classes)</button>
                      <button onClick={() => setQuery('Contrato')} className="block text-zinc-450 hover:text-white cursor-pointer hover:underline text-left">→ "Contrato" (Ver Contratos Escolares)</button>
                    </div>
                  </div>
                )}

                {/* Grouped results output */}
                {query.trim() && filteredIndexedData.totalCount === 0 && (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-2">
                    <span className="text-3xl">🧩</span>
                    <h3 className="text-zinc-200 text-xs font-bold">Nenhum registo localizado</h3>
                    <p className="text-[11px] text-zinc-500 max-w-xs leading-relaxed">
                      Lamentamos, mas não foi possível localizar dados para "{query}". Tente ajustar os filtros selecionados ou digite um termo diferente.
                    </p>
                  </div>
                )}

                {query.trim() && filteredIndexedData.totalCount > 0 && (
                  <div className="space-y-5 text-left">
                    
                    {/* Category: 1. ALUNOS */}
                    {filteredIndexedData.students.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[9.5px] font-mono font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/5 px-2 py-0.5 rounded border border-indigo-550/10 inline-flex items-center gap-1">
                          <Users className="w-3 h-3" /> Alunos ({filteredIndexedData.students.length})
                        </span>
                        <div className="space-y-1">
                          {filteredIndexedData.students.map(s => (
                            <button
                              key={s.id}
                              onClick={() => handleOpenStudentDetail(s.id)}
                              className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                                selectedStudentDetail?.id === s.id 
                                  ? 'bg-indigo-500/10 border-indigo-500 text-white' 
                                  : 'bg-zinc-950 border-zinc-850 hover:border-zinc-700 text-zinc-300'
                              }`}
                            >
                              <div>
                                <h4 className="text-xs font-bold font-sans">{s.name}</h4>
                                <p className="text-[10px] text-zinc-500 font-mono mt-0.5">ID: {s.id} • {s.class} • Média: {s.averageGrade}/10</p>
                              </div>
                              <ChevronRight className="w-4 h-4 text-zinc-500" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Category: 2. PROFESSORES */}
                    {filteredIndexedData.teachers.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[9.5px] font-mono font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-550/10 inline-flex items-center gap-1">
                          <User className="w-3 h-3" /> Professores ({filteredIndexedData.teachers.length})
                        </span>
                        <div className="space-y-1">
                          {filteredIndexedData.teachers.map(t => (
                            <button
                              key={t.id}
                              onClick={() => handleOpenTeacherDetail(t.id)}
                              className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                                selectedTeacherDetail?.id === t.id 
                                  ? 'bg-emerald-500/10 border-emerald-500 text-white' 
                                  : 'bg-zinc-950 border-zinc-850 hover:border-zinc-700 text-zinc-300'
                              }`}
                            >
                              <div>
                                <h4 className="text-xs font-bold font-sans">{t.name}</h4>
                                <p className="text-[10px] text-zinc-500 font-mono mt-0.5">ID: {t.id} • {t.subjects.join(', ')} • Score: {t.productivityScore}%</p>
                              </div>
                              <ChevronRight className="w-4 h-4 text-zinc-500" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Category: 3. RESPONSÁVEIS */}
                    {filteredIndexedData.guardians.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[9.5px] font-mono font-bold uppercase tracking-wider text-sky-450 bg-sky-500/5 px-2 py-0.5 rounded border border-sky-550/10 inline-flex items-center gap-1">
                          <Users className="w-3 h-3" /> Encarregados / Responsáveis ({filteredIndexedData.guardians.length})
                        </span>
                        <div className="space-y-1">
                          {filteredIndexedData.guardians.map(g => (
                            <button
                              key={g.id}
                              onClick={() => handleOpenStudentDetail(g.studentId)}
                              className="w-full text-left p-2.5 rounded-xl border border-zinc-850 bg-zinc-950 hover:border-zinc-700 text-zinc-300 transition-all cursor-pointer flex items-center justify-between"
                            >
                              <div>
                                <h4 className="text-xs font-bold font-display">{g.name}</h4>
                                <p className="text-[10px] text-zinc-500 font-mono mt-0.5">Telefone: {g.contact} • Vinculado a: {g.studentName} ({g.class})</p>
                              </div>
                              <div className="flex items-center gap-1 font-mono text-[9px] text-indigo-400">
                                <span>Ver Aluno</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Category: 4. PAGAMENTOS */}
                    {filteredIndexedData.invoices.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[9.5px] font-mono font-bold uppercase tracking-wider text-amber-500 bg-amber-500/5 px-2 py-0.5 rounded border border-amber-550/10 inline-flex items-center gap-1">
                          <DollarSign className="w-3 h-3" /> Cobranças & Propinas ({filteredIndexedData.invoices.length})
                        </span>
                        <div className="space-y-1">
                          {filteredIndexedData.invoices.map(i => (
                            <button
                              key={i.id}
                              onClick={() => handleOpenInvoiceDetail(i.id)}
                              className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                                selectedInvoiceDetail?.id === i.id 
                                  ? 'bg-amber-550/10 border-amber-500 text-white' 
                                  : 'bg-zinc-950 border-zinc-850 hover:border-zinc-700 text-zinc-300'
                              }`}
                            >
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <h4 className="text-xs font-bold font-sans">€{i.amount} - {i.studentName}</h4>
                                  <span className={`text-[8.5px] uppercase font-bold font-mono px-1.5 rounded-full ${
                                    i.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400' :
                                    i.status === 'pending' ? 'bg-amber-500/10 text-amber-400' : 'bg-rose-500/10 text-rose-450'
                                  }`}>
                                    {i.status}
                                  </span>
                                </div>
                                <p className="text-[10px] text-zinc-500 font-mono mt-0.5">ID: {i.id} • Vencimento: {i.dueDate} • Categoria: {i.category}</p>
                              </div>
                              <ChevronRight className="w-4 h-4 text-zinc-500" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Category: 5. CONTRATOS */}
                    {filteredIndexedData.contracts.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[9.5px] font-mono font-bold uppercase tracking-wider text-violet-400 bg-violet-500/5 px-2 py-0.5 rounded border border-violet-550/10 inline-flex items-center gap-1">
                          <FileText className="w-3 h-3" /> Contratos de Frequência ({filteredIndexedData.contracts.length})
                        </span>
                        <div className="space-y-1">
                          {filteredIndexedData.contracts.map((c, idx) => (
                            <button
                              key={idx}
                              onClick={() => {
                                if (c.studentId) {
                                  handleOpenStudentDetail(c.studentId);
                                } else if (c.teacherId) {
                                  handleOpenTeacherDetail(c.teacherId);
                                }
                              }}
                              className="w-full text-left p-2.5 rounded-xl border border-zinc-850 bg-zinc-950 hover:border-zinc-700 text-zinc-300 transition-all cursor-pointer flex items-center justify-between"
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="text-xs font-bold font-sans">{c.name}</h4>
                                  <span className={`text-[9.5px] font-mono px-1.5 py-0.1 rounded ${
                                    c.submitted ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                                  }`}>
                                    {c.submitted ? 'Assinado' : 'Pendente'}
                                  </span>
                                </div>
                                <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                                  {c.studentName ? `Estudante: ${c.studentName}` : `Docente: ${c.teacherName}`} • Emissão: {c.date}
                                </p>
                              </div>
                              <ChevronRight className="w-4 h-4 text-zinc-500" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Category: 6. TODOS OS DOCUMENTOS */}
                    {filteredIndexedData.documents.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[9.5px] font-mono font-bold uppercase tracking-wider text-teal-400 bg-teal-500/5 px-2 py-0.5 rounded border border-teal-555/10 inline-flex items-center gap-1">
                          <FileText className="w-3 h-3" /> Arquivos & Digitalizações ({filteredIndexedData.documents.length})
                        </span>
                        <div className="space-y-1">
                          {filteredIndexedData.documents.slice(0, 8).map((d, index) => (
                            <button
                              key={index}
                              onClick={() => handleOpenDocumentDetail(d)}
                              className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                                selectedGeneralDocDetail?.id === d.id 
                                  ? 'bg-teal-500/10 border-teal-500 text-white' 
                                  : 'bg-zinc-950 border-zinc-850 hover:border-zinc-700 text-zinc-300'
                              }`}
                            >
                              <div>
                                <h4 className="text-xs font-bold font-sans">{d.name}</h4>
                                <p className="text-[10px] text-zinc-500 font-mono mt-0.5">Dossier: {d.entityName} ({d.entityType === 'student' ? 'Estudante' : 'Docente'}) • Data: {d.date}</p>
                              </div>
                              <span className={`text-[8.5px] font-bold font-mono px-1.5 py-0.5 rounded ${
                                d.submitted ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                              }`}>
                                {d.submitted ? 'OK' : 'FALTA'}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Category: 7. CERTIFICADOS */}
                    {filteredIndexedData.certificates.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[9.5px] font-mono font-bold uppercase tracking-wider text-yellow-450 bg-yellow-500/5 px-2 py-0.5 rounded border border-yellow-544/10 inline-flex items-center gap-1">
                          <Award className="w-3 h-3" /> Diplomas & Certificados ({filteredIndexedData.certificates.length})
                        </span>
                        <div className="space-y-1">
                          {filteredIndexedData.certificates.map((c, index) => (
                            <button
                              key={index}
                              onClick={() => handleOpenDocumentDetail({ name: c.name, entityName: c.studentName || c.teacherName, entityType: c.studentName ? 'student' : 'teacher', date: c.date, submitted: c.submitted, isCert: true })}
                              className="w-full text-left p-2.5 rounded-xl border border-zinc-850 bg-zinc-950 hover:border-zinc-700 text-zinc-300 transition-all cursor-pointer flex items-center justify-between"
                            >
                              <div>
                                <h4 className="text-xs font-bold font-sans">{c.name}</h4>
                                <p className="text-[10px] text-zinc-500 font-mono mt-0.5">Associado: {c.studentName || c.teacherName} • Status: {c.submitted ? 'Homologado' : 'Aguardando Registo'}</p>
                              </div>
                              <ChevronRight className="w-4 h-4 text-zinc-500" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Category: 8. MATRÍCULAS */}
                    {filteredIndexedData.registrations.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[9.5px] font-mono font-bold uppercase tracking-wider text-rose-400 bg-rose-500/5 px-2 py-0.5 rounded border border-rose-555/10 inline-flex items-center gap-1">
                          <Layers2 className="w-3 h-3" /> Ficha de Matrícula ({filteredIndexedData.registrations.length})
                        </span>
                        <div className="space-y-1">
                          {filteredIndexedData.registrations.map(r => (
                            <button
                              key={r.id}
                              onClick={() => handleOpenStudentDetail(r.studentId)}
                              className="w-full text-left p-2.5 rounded-xl border border-zinc-850 bg-zinc-950 hover:border-zinc-700 text-zinc-300 transition-all cursor-pointer flex items-center justify-between"
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="text-xs font-bold font-sans">Matrícula de {r.studentName}</h4>
                                  <span className="text-[8px] bg-sky-500/10 text-sky-400 px-1.5 rounded font-mono font-bold">{r.status}</span>
                                </div>
                                <p className="text-[10px] text-zinc-500 font-mono mt-0.5">Turma Escolar: {r.class} • Ingresso: {r.date} • Dívida Financeira: €{r.outstandingFees}</p>
                              </div>
                              <ChevronRight className="w-4 h-4 text-zinc-500" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Category: 9. TURMAS */}
                    {filteredIndexedData.classes.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[9.5px] font-mono font-bold uppercase tracking-wider text-blue-400 bg-blue-500/5 px-2 py-0.5 rounded border border-blue-550/10 inline-flex items-center gap-1">
                          <Hash className="w-3 h-3" /> Turmas Encontradas ({filteredIndexedData.classes.length})
                        </span>
                        <div className="space-y-1">
                          {filteredIndexedData.classes.map(c => (
                            <button
                              key={c.id}
                              onClick={() => {
                                handleNavigateToModule('students');
                              }}
                              className="w-full text-left p-2.5 rounded-xl border border-zinc-850 bg-zinc-950 hover:border-zinc-700 text-zinc-300 transition-all cursor-pointer flex items-center justify-between"
                            >
                              <div>
                                <h4 className="text-xs font-bold font-sans">Turma: {c.name}</h4>
                                <p className="text-[10px] text-zinc-500 font-mono mt-0.5">Coordenador: {c.coordinator} • Alunos: {c.studentsCount} inscritos • Professores: {c.teachersCount}</p>
                              </div>
                              <div className="flex items-center gap-1 font-mono text-[9px] text-indigo-400">
                                <span>Ver Alunos</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Category: 10. NOTIFICAÇÕES & AVISOS */}
                    {filteredIndexedData.notifications.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[9.5px] font-mono font-bold uppercase tracking-wider text-cyan-450 bg-cyan-500/5 px-2 py-0.5 rounded border border-cyan-533/10 inline-flex items-center gap-1">
                          <Bell className="w-3 h-3" /> Notificações & Comunicação ({filteredIndexedData.notifications.length})
                        </span>
                        <div className="space-y-1">
                          {filteredIndexedData.notifications.map((n, idx) => (
                            <div
                              key={idx}
                              onClick={() => handleNavigateToModule('communications')}
                              className="w-full text-left p-2.5 rounded-xl border border-zinc-850 bg-zinc-950 hover:border-zinc-700 text-zinc-350 transition-all flex items-start justify-between gap-3 cursor-pointer"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={`text-[8.5px] font-mono px-1.5 rounded ${
                                    n.type === 'Aviso' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-pink-500/10 text-pink-400'
                                  }`}>
                                    {n.type}
                                  </span>
                                  <span className="text-[9.5px] text-zinc-500 font-mono">{n.date}</span>
                                </div>
                                <h4 className="text-xs font-bold font-sans text-zinc-200 mt-1 truncate">{n.title}</h4>
                                <p className="text-[10.5px] text-zinc-450 mt-1 line-clamp-2 italic">"{n.content}"</p>
                              </div>
                              <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0 self-center" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                  </div>
                )}
              </div>

              {/* INTEGRATED DETAIL PANELS (RIGHT) */}
              <div className="hidden md:block w-1/2 overflow-y-auto p-5 bg-zinc-950/20">
                
                {/* 1. STUDENT DETAIL CARD - EXTREMELY HIGH FIDELITY SPECIFICATION */}
                {selectedStudentDetail && (
                  <div className="space-y-6">
                    
                    {/* Header profile info */}
                    <div className="p-4 bg-zinc-900 border border-zinc-850 rounded-2xl text-left space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-[9.5px] font-mono font-bold bg-zinc-950 border border-zinc-800 text-indigo-400 px-2 py-0.5 rounded">
                            {selectedStudentDetail.id}
                          </span>
                          <h3 className="text-base font-bold font-sans text-zinc-100 mt-2">
                            {selectedStudentDetail.name}
                          </h3>
                          <p className="text-[11px] text-zinc-450 font-mono mt-0.5">
                            Turma: <strong>{selectedStudentDetail.class}</strong> • Estado: <strong className="text-emerald-400">ATIVO</strong>
                          </p>
                        </div>
                        <div className="p-2.5 bg-indigo-500/10 rounded-full border border-indigo-500/20 text-indigo-400">
                          <User className="w-6 h-6 animate-pulse" />
                        </div>
                      </div>

                      {/* KPI row */}
                      <div className="grid grid-cols-2 shadow-inner bg-zinc-950/40 p-3 rounded-xl border border-zinc-850 text-xs font-mono">
                        <div>
                          <span className="text-[9.5px] text-zinc-500 block">Frequência Letiva</span>
                          <span className="text-xs font-bold text-sky-400">{selectedStudentDetail.attendanceRate}%</span>
                        </div>
                        <div>
                          <span className="text-[9.5px] text-zinc-500 block">Classificação Média</span>
                          <span className="text-xs font-bold text-emerald-400">{selectedStudentDetail.averageGrade} / 10</span>
                        </div>
                      </div>
                      
                      {/* Action buttons */}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => {
                            if (onOpenStudentDetail) onOpenStudentDetail(selectedStudentDetail);
                            handleNavigateToModule('students');
                          }}
                          className="flex-1 flex items-center justify-center gap-1.5 text-[11px] bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold py-2 rounded-xl transition-all cursor-pointer shadow-lg shadow-indigo-500/10"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> Abrir no Módulo Alunos
                        </button>
                      </div>
                    </div>

                    {/* Group of specifications tabs for single query output like "João Silva" */}
                    <div className="space-y-4">
                      
                      {/* SUB-SECTION 1: Responsável */}
                      <div className="p-3.5 bg-zinc-900/40 border border-zinc-850 rounded-xl text-left space-y-2">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-sky-450 block border-b border-zinc-850 pb-1.5">
                          👤 Responsável / Encarregado
                        </span>
                        <div className="font-sans text-xs space-y-1">
                          <p className="text-zinc-200">Encarregado: <strong className="text-white">{selectedStudentDetail.guardiansName}</strong></p>
                          <p className="text-zinc-400 font-mono text-[11px]">Contacto Fiscal: {selectedStudentDetail.guardiansContact}</p>
                          <p className="text-[10.5px] text-zinc-500 italic mt-1 leading-relaxed">
                            O encarregado possui credenciais válidas e acesso ativado para o Portal de Auto-Gestão de Matrículas do Nexus.
                          </p>
                        </div>
                      </div>

                      {/* SUB-SECTION 2: Documentos associados */}
                      <div className="p-3.5 bg-zinc-900/40 border border-zinc-850 rounded-xl text-left space-y-2.5">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-teal-400 block border-b border-zinc-850 pb-1.5">
                          📁 Documentos Associados ao Aluno
                        </span>
                        <div className="space-y-1.5">
                          {selectedStudentDetail.documents.map((doc, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs p-1.5 bg-zinc-950/60 border border-zinc-900 rounded-lg">
                              <span className="text-zinc-300 font-sans">{doc.name}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-[9.5px] text-zinc-500 font-mono">{doc.date || 'Pendente'}</span>
                                <span className={`text-[9px] font-bold px-1.5 rounded font-mono ${
                                  doc.submitted ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-455'
                                }`}>
                                  {doc.submitted ? 'Concluido' : 'Pendente'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* SUB-SECTION 3: Pagamentos (Historial) */}
                      <div className="p-3.5 bg-zinc-900/40 border border-zinc-850 rounded-xl text-left space-y-2">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-500 block border-b border-zinc-850 pb-1.5">
                          💳 Pagamentos & Mensalidades
                        </span>
                        <div className="space-y-1.5">
                          {invoices.filter(i => i.studentId === selectedStudentDetail.id).map(i => (
                            <div key={i.id} className="flex items-center justify-between text-xs p-2 bg-zinc-950/60 border border-zinc-900 rounded-lg">
                              <div>
                                <span className="text-zinc-300 font-bold block">€{i.amount} - {i.category === 'tuition' ? 'Mensalidade Escolar' : i.category === 'material' ? 'Material Didático' : 'Mensalidade Atividade'}</span>
                                <span className="text-[9.5px] text-zinc-500 font-mono">Fatura: {i.id} • Vencimento: {i.dueDate}</span>
                              </div>
                              <span className={`text-[9px] font-bold px-1.5 rounded font-mono ${
                                i.status === 'paid' ? 'bg-emerald-500/15 text-emerald-400' :
                                i.status === 'pending' ? 'bg-amber-500/15 text-amber-400' : 'bg-rose-500/15 text-rose-450'
                              }`}>
                                {i.status === 'paid' ? 'PAGO' : i.status === 'pending' ? 'PENDENTE' : 'EM ATRASO'}
                              </span>
                            </div>
                          ))}
                          
                          {/* Financial overview outstanding fees */}
                          <div className="p-2 bg-zinc-955 border border-zinc-900 rounded-lg flex items-center justify-between text-[11px] font-mono">
                            <span className="text-zinc-500">Saldo Geral devedor:</span>
                            <span className={`font-bold ${selectedStudentDetail.outstandingFees > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                              €{selectedStudentDetail.outstandingFees}.00
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* SUB-SECTION 4: Contratos */}
                      <div className="p-3.5 bg-zinc-900/40 border border-zinc-850 rounded-xl text-left space-y-2">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-violet-400 block border-b border-zinc-850 pb-1.5">
                          📄 Contratos Digitais Homologados
                        </span>
                        <div className="space-y-1 text-xs">
                          {selectedStudentDetail.documents.filter(d => d.name.toLowerCase().includes('contrato')).map((d, index) => (
                            <div key={index} className="p-2.5 bg-zinc-950/60 border border-zinc-900 rounded-lg flex items-center justify-between font-mono">
                              <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-zinc-500" />
                                <div>
                                  <span className="text-zinc-300 text-[11px] block">{d.name}</span>
                                  <span className="text-[9px] text-zinc-500">Emitido em: {d.date || 'Registo Prévio'}</span>
                                </div>
                              </div>
                              <span className="text-[10px] text-emerald-400 font-bold">✓ Homologado</span>
                            </div>
                          ))}
                          {selectedStudentDetail.documents.filter(d => d.name.toLowerCase().includes('contrato')).length === 0 && (
                            <span className="text-[11px] text-zinc-500 italic">Nenhum contrato formal de prestação assinado localizado para este aluno.</span>
                          )}
                        </div>
                      </div>

                      {/* SUB-SECTION 5: Histórico (Grades & Behavior) */}
                      <div className="p-3.5 bg-zinc-900/40 border border-zinc-850 rounded-xl text-left space-y-3">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-teal-400 block border-b border-zinc-850 pb-1.5">
                          📊 Histórico Avaliativo & Comportamental
                        </span>
                        <div className="space-y-2.5 text-xs">
                          {/* Grades */}
                          <div className="space-y-1.5">
                            <span className="text-[9px] uppercase font-mono text-zinc-500 font-bold block">Quadro de Notas Correntes:</span>
                            <div className="grid grid-cols-2 gap-2 font-mono text-[10.5px]">
                              {selectedStudentDetail.grades.map((g, idx) => (
                                <div key={idx} className="p-1.5 bg-zinc-950/40 border border-zinc-900 rounded-lg flex justify-between">
                                  <span className="text-zinc-400 truncate">{g.subject}</span>
                                  <span className="font-bold text-white">{g.score}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Behavior notes */}
                          <div className="space-y-1.5">
                            <span className="text-[9px] uppercase font-mono text-zinc-500 font-bold block">Historial Comportamental Recente ({selectedStudentDetail.behaviorDegree}):</span>
                            {selectedStudentDetail.behaviorHistory.map((bh, idx) => (
                              <div key={idx} className="p-2 bg-zinc-950/40 border border-zinc-900 rounded-lg font-mono text-[10px] text-zinc-400 leading-relaxed border-l-2 border-emerald-500/50">
                                <div className="flex justify-between font-bold text-zinc-500 text-[9px] mb-0.5">
                                  <span>{bh.categoryDefault || 'Anotação'}</span>
                                  <span>{bh.date}</span>
                                </div>
                                <p className="italic">"{bh.note}"</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                )}

                {/* 2. TEACHER DETAIL CARD */}
                {selectedTeacherDetail && (
                  <div className="space-y-6">
                    <div className="p-4 bg-zinc-900 border border-zinc-850 rounded-2xl text-left space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-[9.5px] font-mono font-bold bg-zinc-950 border border-zinc-800 text-emerald-400 px-2 py-0.5 rounded">
                            {selectedTeacherDetail.id}
                          </span>
                          <h3 className="text-base font-bold font-sans text-zinc-100 mt-2">
                            {selectedTeacherDetail.name}
                          </h3>
                          <p className="text-[11px] text-zinc-455 font-mono mt-0.5">
                            E-mail: <strong>{selectedTeacherDetail.email}</strong> • Estado: <strong className="text-emerald-400">ATIVO</strong>
                          </p>
                        </div>
                        <div className="p-2.5 bg-emerald-500/10 rounded-full border border-emerald-500/20 text-emerald-400">
                          <User className="w-6 h-6" />
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => {
                            if (onOpenTeacherDetail) onOpenTeacherDetail(selectedTeacherDetail);
                            handleNavigateToModule('teachers');
                          }}
                          className="flex-1 flex items-center justify-center gap-1.5 text-[11px] bg-emerald-650 hover:bg-emerald-700 text-white font-bold py-2 rounded-xl transition-all cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> Abrir no Módulo Corpo Docente
                        </button>
                      </div>
                    </div>

                    {/* Teacher Specific Lists */}
                    <div className="space-y-4 text-left">
                      <div className="p-3.5 bg-zinc-900/40 border border-zinc-850 rounded-xl space-y-1.5">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400 block border-b border-zinc-850 pb-1">
                          📚 Disciplinas Ministradas
                        </span>
                        <div className="flex flex-wrap gap-1.5 pt-1.5">
                          {selectedTeacherDetail.subjects.map((sub, idx) => (
                            <span key={idx} className="text-[10.5px] font-mono bg-zinc-950 border border-zinc-900 text-zinc-300 px-2 py-0.5 rounded">
                              {sub}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="p-3.5 bg-zinc-900/40 border border-zinc-850 rounded-xl space-y-1.5">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400 block border-b border-zinc-850 pb-1">
                          🏫 Turmas Atribuídas
                        </span>
                        <div className="space-y-1 pt-1 font-mono text-[11px] text-zinc-400">
                          {selectedTeacherDetail.classes.map((cls, idx) => (
                            <div key={idx} className="p-1.5 bg-zinc-950/40 border border-zinc-900 rounded-lg flex items-center gap-2">
                              <Hash className="w-3.5 h-3.5 text-zinc-650" />
                              <span>Turma Escolar: <strong>{cls}</strong></span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Documents matching */}
                      {selectedTeacherDetail.documents && (
                        <div className="p-3.5 bg-zinc-900/40 border border-zinc-850 rounded-xl space-y-1.5">
                          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-teal-400 block border-b border-zinc-850 pb-1.5">
                            📂 Ficha de Documentação de Contratação
                          </span>
                          <div className="space-y-1.5 pt-1">
                            {selectedTeacherDetail.documents.map((d, index) => (
                              <div key={index} className="flex items-center justify-between text-xs p-1.5 bg-zinc-950/60 border border-zinc-900 rounded-lg">
                                <span className="text-zinc-300 font-sans">{d.name}</span>
                                <span className={`text-[8.5px] font-mono px-1.5 rounded ${
                                  d.submitted ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-450'
                                }`}>
                                  {d.submitted ? 'Concluido' : 'Pendente'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 3. INVOICE DETAIL CARD */}
                {selectedInvoiceDetail && (
                  <div className="space-y-6">
                    <div className="p-4 bg-zinc-900 border border-zinc-850 rounded-2xl text-left space-y-4">
                      <div>
                        <span className="text-[9.5px] font-mono font-bold bg-zinc-950 border border-zinc-800 text-amber-500 px-2 py-0.5 rounded">
                          {selectedInvoiceDetail.id}
                        </span>
                        <h3 className="text-base font-bold font-sans text-zinc-100 mt-2">
                          €{selectedInvoiceDetail.amount}
                        </h3>
                        <p className="text-[11px] text-zinc-450 font-mono mt-0.5">
                          Responsável Fiscal: <strong>{selectedInvoiceDetail.studentName}</strong> • ID: {selectedInvoiceDetail.studentId}
                        </p>
                      </div>

                      {/* Status row badge */}
                      <div className="p-3 bg-zinc-950/50 border border-zinc-850 rounded-xl space-y-1 text-xs font-mono">
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Estado de Liquidação:</span>
                          <span className={`font-bold ${
                            selectedInvoiceDetail.status === 'paid' ? 'text-emerald-400' : 'text-rose-400 animate-pulse'
                          }`}>
                            {selectedInvoiceDetail.status.toUpperCase()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500 font-mono">Prazo de Vencimento:</span>
                          <span className="text-zinc-300">{selectedInvoiceDetail.dueDate}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500 font-mono">Categoria de Cobrança:</span>
                          <span className="text-zinc-300 uppercase">{selectedInvoiceDetail.category}</span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => {
                            handleNavigateToModule('financials');
                          }}
                          className="flex-1 flex items-center justify-center gap-1.5 text-[11px] bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/20 text-amber-500 font-bold py-2 rounded-xl transition-all cursor-pointer"
                        >
                          <CreditCard className="w-3.5 h-3.5" /> Abrir no Módulo Financeiro
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. GENERAL DOCUMENT DETAIL CARD */}
                {selectedGeneralDocDetail && (
                  <div className="p-4 bg-zinc-900 border border-zinc-850 rounded-2xl text-left space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[9.5px] font-mono font-bold bg-zinc-950 border border-zinc-800 text-teal-400 px-2 py-0.5 rounded">
                          Ficha Documental
                        </span>
                        <h3 className="text-sm font-bold font-sans text-zinc-100 mt-2">
                          {selectedGeneralDocDetail.name}
                        </h3>
                        <p className="text-[10.5px] text-zinc-500 font-mono mt-0.5">
                          Associado a: {selectedGeneralDocDetail.entityName || selectedGeneralDocDetail.studentName || selectedGeneralDocDetail.teacherName} ({selectedGeneralDocDetail.entityType === 'student' || selectedGeneralDocDetail.studentId ? 'Estudante' : 'Docente'})
                        </p>
                      </div>
                      <div className="p-2 bg-zinc-950 rounded-lg text-emerald-400 border border-zinc-850">
                        <FileText className="w-5 h-5" />
                      </div>
                    </div>

                    <div className="p-3 bg-zinc-950/60 border border-zinc-850 rounded-xl space-y-1.5 text-xs font-mono">
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Emissão / Entrega:</span>
                        <span className="text-zinc-300">{selectedGeneralDocDetail.date || 'Registo Prévio'}</span>
                      </div>
                      <div className="flex justify-between font-bold">
                        <span className="text-zinc-500">Estado de Validação:</span>
                        <span className={selectedGeneralDocDetail.submitted ? 'text-emerald-400' : 'text-rose-455'}>
                          {selectedGeneralDocDetail.submitted ? '✓ REGISTADO' : '✘ EM FALTA'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Assinatura Cert:</span>
                        <span className="text-zinc-550">SHA-256.doc</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-[11px] text-zinc-400 italic leading-relaxed">
                        Este arquivo está arquivado digitalmente sob custódia legal do Nexus na directoria do dossier correspondente.
                      </p>
                      <button
                        onClick={() => {
                          handleNavigateToModule('documents');
                        }}
                        className="w-full flex items-center justify-center gap-1 text-[11px] bg-indigo-650 hover:bg-indigo-700 text-white font-bold py-2 rounded-xl cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" /> Abrir Dossier de Documentos
                      </button>
                    </div>
                  </div>
                )}

                {/* Default Panel if nothing is selected yet */}
                {!selectedStudentDetail && !selectedTeacherDetail && !selectedInvoiceDetail && !selectedGeneralDocDetail && (
                  <div className="flex h-full flex-col items-center justify-center p-8 text-center space-y-3">
                    <span className="text-3xl text-zinc-650">🗄️</span>
                    <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-wider font-sans">Dossier Integrado de Detalhes</h3>
                    <p className="text-zinc-600 text-[10.5px] max-w-xs leading-relaxed font-mono">
                      Selecione um dos resultados de pesquisa do painel à esquerda para abrir a sua respectiva ficha académica, documentos, faturas, turmas, histórico e contratos associados instantaneamente.
                    </p>
                  </div>
                )}

              </div>

            </div>

          </div>
        </div>
      )}
    </>
  );
}
