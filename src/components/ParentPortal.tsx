import React, { useState, useMemo } from 'react';
import { 
  User, Calendar, Clock, BookOpen, Award, FileText, Download, Upload, 
  Phone, Mail, CheckCircle2, AlertTriangle, CreditCard, ChevronRight, 
  Bell, FileSpreadsheet, Lock, Sparkles, Send, ShieldCheck, MapPin, 
  HelpCircle, Trash2, Printer
} from 'lucide-react';
import { Student, Invoice, Announcement, ChatMessage, UserRole } from '../types';

interface ParentPortalProps {
  students: Student[];
  invoices: Invoice[];
  announcements: Announcement[];
  messages: ChatMessage[];
  onUpdateStudent: (id: string, updatedFields: Partial<Student>) => void;
  onUpdateInvoiceStatus?: (id: string, newStatus: 'paid' | 'pending' | 'overdue' | 'cancelled') => void;
  theme: 'light' | 'dark';
}

export default function ParentPortal({
  students,
  invoices,
  announcements,
  messages,
  onUpdateStudent,
  onUpdateInvoiceStatus,
  theme
}: ParentPortalProps) {
  // 1. STRONGLY ENFORCE SECURITY & ACCESS BOUNDARY:
  // Find the exact student associated with this parent. Under GDPR/School privacy,
  // the parent role MUST NOT access or query any students other than those associated with them.
  // In our simulated session, Marcos Siqueira is the parent of Alice Siqueira (ALU-101).
  const myStudents = useMemo(() => {
    return students.filter(s => s.id === 'ALU-101' || s.guardiansName === 'Marcos Siqueira');
  }, [students]);

  // Current selected pupil (under multi-child extensible scheme, defaulting to first associated)
  const [activeStudentId, setActiveStudentId] = useState<string>(myStudents[0]?.id || 'ALU-101');
  const activeStudent = useMemo(() => {
    return myStudents.find(s => s.id === activeStudentId) || myStudents[0];
  }, [myStudents, activeStudentId]);

  // Filters state for sub-modules
  const [activeSubTab, setActiveSubTab] = useState<'dashboard' | 'academic' | 'schedule' | 'financial' | 'documents' | 'chat'>('dashboard');
  
  // States of contacts update form
  const [guardianContact, setGuardianContact] = useState(activeStudent?.guardiansContact || '+351 912 345 678');
  const [guardianEmail, setGuardianEmail] = useState('marcos.siqueira@gmail.com');
  const [guardianAddress, setGuardianAddress] = useState('Rua da Escola Nova, nº 45, Ponta Delgada');
  const [showContactToast, setShowContactToast] = useState(false);

  // Absence justification form state
  const [absenceDate, setAbsenceDate] = useState('');
  const [absenceReason, setAbsenceReason] = useState('');
  const [absenceSubject, setAbsenceSubject] = useState('Outro');
  const [justificationFile, setJustificationFile] = useState<string | null>(null);
  const [justificationList, setJustificationList] = useState<Array<{ id: string; date: string; subject: string; reason: string; status: 'Análise' | 'Aprovado' | 'Rejeitado' }>>([
    { id: 'JUS-01', date: '2026-05-18', subject: 'Consulta Médica', reason: 'Consulta de rotina no pediatra', status: 'Aprovado' },
    { id: 'JUS-02', date: '2026-06-12', subject: 'Doença', reason: 'Falta por gastroenterite viral', status: 'Análise' }
  ]);
  const [showAbsenceToast, setShowAbsenceToast] = useState(false);

  // State of local uploaded student documents (Dossier)
  const [uploadedStudentDocs, setUploadedStudentDocs] = useState<Array<{ name: string; date: string; status: string; size: string; category: string }>>([
    { name: 'CC_Encarregado_Assinado.pdf', date: '2026-01-12', status: 'Homologado', size: '1.4 MB', category: 'Identificação' },
    { name: 'Atestado_Medico_Clube.pdf', date: '2026-02-15', status: 'Em Análise', size: '840 KB', category: 'Médico' },
  ]);
  const [newDocCategory, setNewDocCategory] = useState('Outro');
  const [newDocName, setNewDocName] = useState('');
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);

  // States for interactive financial operations
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [cardHolder, setCardHolder] = useState('MARCOS SIQUEIRA');
  const [cardNumber, setCardNumber] = useState('4321 5678 9012 3456');
  const [cardExpiry, setCardExpiry] = useState('11/29');
  const [cardCVV, setCardCVV] = useState('888');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false);
  
  // Printable Invoice/Receipt Modal State
  const [receiptToPrint, setReceiptToPrint] = useState<Invoice | null>(null);

  // Personal message state
  const [chatDraft, setChatDraft] = useState('');
  const [chatLog, setChatLog] = useState<Array<{ sender: string; time: string; text: string; isParent: boolean }>>([
    { sender: 'Professor Alberto (Tutor)', time: '09:12', text: 'Bom dia Sr. Marcos, recordo que a reunião geral de encarregados decorre esta quinta-feira às 18h30 na sala de artes.', isParent: false },
    { sender: 'Eu', time: '10:05', text: 'Muito obrigado pelo lembrete Professor Alberto, estarei presente com certeza.', isParent: true },
    { sender: 'Professor Alberto (Tutor)', time: '10:07', text: 'Excelente! Caso pretenda consultar o dossier pedagógico da Alice com antecedência, já está disponível na aba de Documentos do portal.', isParent: false }
  ]);

  // Local notifications log feeds
  const notificationFeed = useMemo(() => {
    if (!activeStudent) return [];
    return [
      { id: '1', date: 'Hoje às 09:30', title: 'Lançamento de Avaliação', text: 'Nova classificação atribuída em Ciências (Nota: 9.5). Média atual da disciplina: 9.5/10.', type: 'info' },
      { id: '2', date: 'Ontem', title: 'Elogio de Comportamento', text: 'Alice recebeu um elogio formal do Tutor: "Demonstrou liderança exemplar no projeto escolar".', type: 'success' },
      { id: '3', date: '18 Jun 2026', title: 'Circular de Final de Ano', text: 'A direção letiva disponibilizou a circular informativa com o calendário de exames nacionais e matrículas.', type: 'alert' },
      { id: '4', date: '15 Jun 2026', title: 'Fatura Liquidada', text: 'Recebemos o pagamento da propina mensal ref. Junho de 2026 (Valor: €250.00). Obrigado.', type: 'success' }
    ];
  }, [activeStudent]);

  // Schedule Grid Mapping (Demo weekly timetable)
  const fullWeeklySchedule = [
    { hour: '08:30 - 09:15', mon: 'Matemática', tue: 'Português', wed: 'Ciências', thu: 'História', fri: 'Português' },
    { hour: '09:15 - 10:00', mon: 'Matemática', tue: 'Português', wed: 'Ciências', thu: 'História', fri: 'Português' },
    { hour: '10:15 - 11:00', mon: 'Inglês', tue: 'Matemática', wed: 'Educação Física', thu: 'Inglês', fri: 'Geografia' },
    { hour: '11:00 - 11:45', mon: 'Inglês', tue: 'História', wed: 'Educação Física', thu: 'Robótica', fri: 'Geografia' },
    { hour: '12:00 - 12:45', mon: 'Estudo Acompanhado', tue: 'História', wed: 'Artes Visuais', thu: 'Robótica', fri: 'Assembleia Turma' },
    { hour: '14:00 - 14:45', mon: 'Português', tue: 'Educação Física', wed: 'Artes Visuais', thu: 'Português', fri: 'Clube Ciências' },
    { hour: '14:45 - 15:30', mon: 'Ciências', tue: 'Educação Física', wed: 'Inglês', thu: 'Ciências', fri: 'Clube Ciências' },
  ];

  if (!activeStudent) {
    return (
      <div className="p-8 text-center bg-zinc-950 rounded-2xl border border-zinc-850">
        <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2 animate-bounce" />
        <h3 className="text-sm font-bold text-zinc-200">Educando Associado não Encontrado</h3>
        <p className="text-xs text-zinc-400 mt-1">Por favor consulte a secretaria física para associar os seus educandos e ativar as credenciais de encarregado.</p>
      </div>
    );
  }

  // Filter invoices for ALU-101
  const studentInvoices = invoices.filter(i => i.studentId === activeStudent.id);
  
  // Announcements filtered for parents
  const parentsAnnouncements = announcements.filter(a => a.target === 'parents' || a.target === 'all');

  // Submit contact updates
  const handleUpdateContactDetails = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateStudent(activeStudent.id, {
      guardiansContact: guardianContact,
      guardiansName: activeStudent.guardiansName // keep same name
    });
    setShowContactToast(true);
    setTimeout(() => {
      setShowContactToast(false);
    }, 4000);
  };

  // Submit absence justification
  const handleAddJustification = (e: React.FormEvent) => {
    e.preventDefault();
    if (!absenceDate || !absenceReason) return;
    const newJust = {
      id: `JUS-${Date.now().toString().slice(-4)}`,
      date: absenceDate,
      subject: absenceSubject,
      reason: absenceReason,
      status: 'Análise' as const
    };
    setJustificationList(prev => [newJust, ...prev]);
    setAbsenceDate('');
    setAbsenceReason('');
    setShowAbsenceToast(true);
    setTimeout(() => {
      setShowAbsenceToast(false);
    }, 4000);
  };

  // Upload custom document
  const handleDocUploadSimulate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocName) return;
    setIsUploadingDoc(true);
    setTimeout(() => {
      const isPdf = newDocName.toLowerCase().endsWith('.pdf') ? newDocName : `${newDocName}.pdf`;
      setUploadedStudentDocs(prev => [
        { name: isPdf, date: new Date().toISOString().split('T')[0], status: 'Análise Pública', size: '1.2 MB', category: newDocCategory },
        ...prev
      ]);
      setNewDocName('');
      setIsUploadingDoc(false);
    }, 1500);
  };

  // Execute payment gateway simulation
  const handleProcessPayment = () => {
    if (!selectedInvoice) return;
    setIsProcessingPayment(true);
    setTimeout(() => {
      setIsProcessingPayment(false);
      setShowPaymentSuccess(true);
      if (onUpdateInvoiceStatus) {
        onUpdateInvoiceStatus(selectedInvoice.id, 'paid');
      }
      setTimeout(() => {
        setShowPaymentSuccess(false);
        setSelectedInvoice(null);
      }, 2500);
    }, 2000);
  };

  // Chat message send
  const handleSendMessage = () => {
    if (!chatDraft.trim()) return;
    setChatLog(prev => [
      ...prev,
      { sender: 'Eu', time: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }), text: chatDraft, isParent: true }
    ]);
    setChatDraft('');
    // Simulate auto-reply from tutor 5 seconds later
    setTimeout(() => {
      setChatLog(prev => [
        ...prev,
        { sender: 'Professor Alberto (Tutor)', time: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }), text: 'Mensagem recebida com sucesso. Responderei com a máxima brevidade. Cumprimentos.', isParent: false }
      ]);
    }, 3000);
  };

  return (
    <div className="space-y-6 w-full text-left" id="parent_portal_view_root">
      
      {/* 1. SEPARATE GUARDIAN PORTAL JUMBOTRON HEADER CARD */}
      <div className={`p-6 rounded-2xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all duration-300 ${
        theme === 'light' 
          ? 'bg-gradient-to-r from-indigo-50 via-sky-50 to-white border-indigo-150' 
          : 'bg-zinc-900 border-zinc-800'
      }`}>
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-600/10 text-indigo-500 rounded-2xl border border-indigo-500/10">
            <ShieldCheck className="w-8 h-8 text-indigo-500" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[9.5px] uppercase font-bold tracking-widest font-mono px-2 py-0.5 rounded-md ${
                theme === 'light' ? 'bg-indigo-100 text-indigo-700' : 'bg-indigo-500/10 text-indigo-400'
              }`}>
                Área Encarregado de Educação
              </span>
              <span className="text-[10px] text-zinc-500 font-mono flex items-center gap-1">
                <Lock className="w-3 h-3 text-zinc-400" /> Sessão Segura Encriptada
              </span>
            </div>
            <h1 className={`text-xl font-bold font-display tracking-tight mt-1 ${theme === 'light' ? 'text-zinc-900' : 'text-zinc-100'}`}>
              Encarregado: {activeStudent.guardiansName}
            </h1>
            <p className="text-zinc-450 text-xs mt-0.5">
              Acesso exclusivo aos dados escolares da sua educanda: <strong>{activeStudent.name}</strong> (Identificação: {activeStudent.id})
            </p>
          </div>
        </div>

        {/* Pupiles switcher (if multiple kids, currently demonstrating security constraint) */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-450 font-bold hidden sm:inline">Educando Ativo:</span>
          <select
            value={activeStudentId}
            onChange={(e) => setActiveStudentId(e.target.value)}
            disabled // Locked down because Marcos only has Alice (ALU-101) associated under strict privacy boundary
            className={`text-xs font-semibold px-3.5 py-1.5 rounded-xl border outline-none cursor-not-allowed ${
              theme === 'light' 
                ? 'bg-white border-zinc-200 text-zinc-800' 
                : 'bg-zinc-950 border-zinc-800 text-zinc-200'
            }`}
          >
            <option value="ALU-101">{activeStudent.name} ({activeStudent.class})</option>
          </select>
        </div>
      </div>

      {/* 2. PORTAL SPECIFIC TAB SYSTEM BAR */}
      <div className="flex items-center gap-1 px-1 overflow-x-auto py-1 scrollbar-none border-b border-zinc-800">
        <button
          onClick={() => setActiveSubTab('dashboard')}
          className={`px-4 py-2 text-xs font-semibold rounded-t-xl border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeSubTab === 'dashboard'
              ? 'border-indigo-500 text-indigo-400 font-bold bg-indigo-500/5'
              : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          Painel Geral
        </button>
        <button
          onClick={() => setActiveSubTab('academic')}
          className={`px-4 py-2 text-xs font-semibold rounded-t-xl border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeSubTab === 'academic'
              ? 'border-indigo-500 text-indigo-400 font-bold bg-indigo-500/5'
              : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50'
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          Aproveitamento & Notas
        </button>
        <button
          onClick={() => setActiveSubTab('schedule')}
          className={`px-4 py-2 text-xs font-semibold rounded-t-xl border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeSubTab === 'schedule'
              ? 'border-indigo-500 text-indigo-400 font-bold bg-indigo-500/5'
              : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          Horário & Presenças
        </button>
        <button
          onClick={() => setActiveSubTab('financial')}
          className={`px-4 py-2 text-xs font-semibold rounded-t-xl border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeSubTab === 'financial'
              ? 'border-indigo-500 text-indigo-400 font-bold bg-indigo-500/5'
              : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          Mensalidades & Recibos
        </button>
        <button
          onClick={() => setActiveSubTab('documents')}
          className={`px-4 py-2 text-xs font-semibold rounded-t-xl border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeSubTab === 'documents'
              ? 'border-indigo-500 text-indigo-400 font-bold bg-indigo-500/5'
              : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          Secretaria & Submissão
        </button>
        <button
          onClick={() => setActiveSubTab('chat')}
          className={`px-4 py-2 text-xs font-semibold rounded-t-xl border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeSubTab === 'chat'
              ? 'border-indigo-500 text-indigo-400 font-bold bg-indigo-500/5'
              : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50'
          }`}
        >
          <Send className="w-3.5 h-3.5 animate-pulse" />
          Contactar Diretor de Turma
        </button>
      </div>

      {/* 3. SUBTAB CHANNELS OUTLET VIEWPORTS */}
      <div className="mt-4 font-sans">
        
        {/* SUBTAB: DASHBOARD AND SUMMARY FEED OVERVIEW */}
        {activeSubTab === 'dashboard' && (
          <div className="space-y-6">
            
            {/* Bento statistics grids */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Pupil details widget */}
              <div className={`p-4 rounded-xl border shadow-sm ${
                theme === 'light' ? 'bg-white border-zinc-200' : 'bg-zinc-900/50 border-zinc-800'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase text-zinc-400 tracking-wider">Educanda</span>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase bg-emerald-500/10 text-emerald-400">Ativa</span>
                </div>
                <div className="mt-3">
                  <h4 className={`text-base font-bold truncate ${theme === 'light' ? 'text-zinc-900' : 'text-zinc-200'}`}>
                    {activeStudent.name}
                  </h4>
                  <p className="text-xs text-zinc-450 mt-0.5">Turma: <strong>{activeStudent.class}</strong></p>
                  <p className="text-[10px] text-zinc-500 font-mono mt-1">ID: {activeStudent.id}</p>
                </div>
              </div>

              {/* Attendance widget */}
              <div className={`p-4 rounded-xl border shadow-sm ${
                theme === 'light' ? 'bg-white border-zinc-200' : 'bg-zinc-900/50 border-zinc-800'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase text-zinc-400 tracking-wider">Assiduidade</span>
                  <Calendar className="w-4 h-4 text-sky-400" />
                </div>
                <div className="mt-3">
                  <h4 className={`text-2xl font-black ${theme === 'light' ? 'text-zinc-900' : 'text-sky-400'}`}>
                    {activeStudent.attendanceRate}%
                  </h4>
                  <p className="text-xs text-zinc-450 mt-0.5">Frequência Letiva Exigida: &gt;90%</p>
                  <span className="inline-flex items-center gap-1 font-mono text-[9.5px] text-emerald-400 uppercase font-semibold mt-1">
                    <CheckCircle2 className="w-3 h-3" /> Excelente Presença
                  </span>
                </div>
              </div>

              {/* Average Academic grade widget */}
              <div className={`p-4 rounded-xl border shadow-sm ${
                theme === 'light' ? 'bg-white border-zinc-200' : 'bg-zinc-900/50 border-zinc-800'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase text-zinc-400 tracking-wider">Aproveitamento</span>
                  <Award className="w-4 h-4 text-yellow-400" />
                </div>
                <div className="mt-3">
                  <h4 className={`text-2xl font-black ${theme === 'light' ? 'text-zinc-900' : 'text-yellow-400'}`}>
                    {activeStudent.averageGrade} <span className="text-xs text-zinc-500">/10</span>
                  </h4>
                  <p className="text-xs text-zinc-450 mt-0.5">Média Escolar Geral Atual</p>
                  <span className="inline-flex items-center gap-1 font-mono text-[9.5px] text-orange-400 uppercase font-semibold mt-1">
                    <Sparkles className="w-3 h-3" /> Quadro de Mérito
                  </span>
                </div>
              </div>

              {/* Financial/Tuition Outstanding widget */}
              <div className={`p-4 rounded-xl border shadow-sm ${
                theme === 'light' ? 'bg-white border-zinc-200' : 'bg-zinc-900/50 border-zinc-800'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase text-zinc-400 tracking-wider">Estado Financeiro</span>
                  <CreditCard className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="mt-3">
                  <h4 className={`text-2xl font-black ${theme === 'light' ? 'text-zinc-900' : activeStudent.outstandingFees > 0 ? 'text-rose-450' : 'text-emerald-400'}`}>
                    {activeStudent.outstandingFees === 0 ? '€ 0,00' : `€ ${activeStudent.outstandingFees},00`}
                  </h4>
                  <p className="text-xs text-zinc-450 mt-0.5">Propinas / Mensalidades</p>
                  <span className={`inline-flex items-center gap-1 font-mono text-[9.5px] uppercase font-semibold mt-1 ${
                    activeStudent.outstandingFees === 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {activeStudent.outstandingFees === 0 ? (
                      <>
                        <CheckCircle2 className="w-3 h-3" /> Contas Regularizadas
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-3 h-3 text-rose-450" /> Mensalidade em Falta
                      </>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Split feed content: Notifications panel & Quick documents panel */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Column: Communications, announcements & Feed */}
              <div className="lg:col-span-8 space-y-6">
                
                {/* School Announcements bulletin for parent */}
                <div className={`p-5 rounded-xl border ${
                  theme === 'light' ? 'bg-white border-zinc-200 animate-fadeIn' : 'bg-zinc-900/30 border-zinc-800'
                }`}>
                  <h3 className={`text-sm font-bold uppercase tracking-wider font-display flex items-center gap-2 mb-4 ${
                    theme === 'light' ? 'text-zinc-800' : 'text-zinc-200'
                  }`}>
                    <Bell className="w-4 h-4 text-indigo-400" /> Comunicações e Circulares Úteis
                  </h3>
                  <div className="space-y-4">
                    {parentsAnnouncements.map((ann, idx) => (
                      <div key={ann.id || idx} className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-850">
                        <div className="flex items-center justify-between text-[11px] font-mono text-zinc-450 mb-1.5 flex-wrap gap-2">
                          <span className="bg-indigo-500/10 text-indigo-400 font-bold px-2 py-0.5 rounded border border-indigo-500/10">
                            Circular {ann.role.toUpperCase()}
                          </span>
                          <span>{ann.date}</span>
                        </div>
                        <h4 className="text-xs font-bold text-zinc-200 font-sans">{ann.title}</h4>
                        <p className="text-xs text-zinc-400 mt-1 lines-clamp-3 leading-relaxed font-sans">{ann.content}</p>
                        <div className="mt-2 text-[10px] text-zinc-500 block italic font-mono text-right">— Autor: {ann.author} ({ann.role})</div>
                      </div>
                    ))}
                    {parentsAnnouncements.length === 0 && (
                      <p className="text-xs text-zinc-500 italic">Sem comunicados pendentes na central.</p>
                    )}
                  </div>
                </div>

                {/* Academic historical overview / behavior degree log */}
                <div className={`p-5 rounded-xl border ${
                  theme === 'light' ? 'bg-white border-zinc-200' : 'bg-zinc-900/30 border-zinc-800'
                }`}>
                  <h3 className={`text-sm font-bold uppercase tracking-wider font-display flex items-center gap-2 mb-4 ${
                    theme === 'light' ? 'text-zinc-800' : 'text-zinc-200'
                  }`}>
                    <Award className="w-4 h-4 text-indigo-400" /> Qualificação Comportamental & Elogios
                  </h3>
                  <div className="space-y-3.5">
                    <div className="p-4 bg-zinc-950 border border-zinc-850 rounded-xl flex items-start gap-3">
                      <div className="p-2.5 bg-yellow-450/10 text-yellow-500 rounded-xl border border-yellow-450/20">
                        <Sparkles className="w-5 h-5 text-yellow-400" />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-zinc-200 font-sans">Estatuto de Mérito: {activeStudent.behaviorDegree}</h4>
                          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-mono font-bold px-1.5 rounded-full">Excelente</span>
                        </div>
                        <p className="text-xs text-zinc-450 mt-1 leading-relaxed">
                          Este é o grau comportamental corporativo mais elevado. Alice tem demonstrado excelente cumprimento dos regulamentos disciplinares e forte empatia cooperativa entre os colegas.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2 text-left">
                      <span className="text-[10px] font-mono font-bold text-zinc-500 block">Histórico de Ocorrências & Elogios</span>
                      {activeStudent.behaviorHistory.map((bh, idx) => (
                        <div key={idx} className="p-3 bg-zinc-950/50 border border-zinc-850/50 rounded-lg text-xs leading-relaxed text-zinc-350 flex items-start gap-2.5">
                          <span className="text-[10.5px] font-mono text-zinc-500 select-none">{bh.date}</span>
                          <div className="flex-1">
                            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest font-mono select-none">[{bh.categoryDefault}]</span>
                            <p className="mt-0.5 text-zinc-400 font-sans">{bh.note}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

              </div>

              {/* Right Column: Interactive Notification Feed Center & Quick Contacts */}
              <div className="lg:col-span-4 space-y-6">
                
                {/* Notification Feed Center */}
                <div className={`p-5 rounded-xl border ${
                  theme === 'light' ? 'bg-white border-zinc-200' : 'bg-zinc-900/30 border-zinc-800'
                }`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className={`text-sm font-bold uppercase tracking-wider font-display flex items-center gap-2 ${
                      theme === 'light' ? 'text-zinc-800' : 'text-zinc-200'
                    }`}>
                      <Bell className="w-4 h-4 text-indigo-400" /> Histórico de Alertas
                    </h3>
                    <span className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-ping" />
                  </div>
                  
                  <div className="space-y-3">
                    {notificationFeed.map((feed) => (
                      <div 
                        key={feed.id} 
                        className={`p-3 rounded-xl text-left text-xs leading-relaxed transition-all hover:bg-zinc-950/80 border ${
                          feed.type === 'success' ? 'bg-zinc-950/20 border-emerald-500/10' :
                          feed.type === 'alert' ? 'bg-zinc-950/20 border-indigo-500/10' : 'bg-zinc-950/20 border-zinc-850'
                        }`}
                      >
                        <div className="flex items-center justify-between font-mono text-[9.5px] text-zinc-500 mb-1 select-none">
                          <span className="font-bold text-zinc-450">{feed.title}</span>
                          <span>{feed.date}</span>
                        </div>
                        <p className="text-zinc-400 font-sans">{feed.text}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick Profile update shortcut */}
                <div className={`p-5 rounded-xl border text-left space-y-4 ${
                  theme === 'light' ? 'bg-white border-zinc-200' : 'bg-zinc-900/30 border-zinc-800'
                }`}>
                  <div>
                    <h3 className={`text-sm font-bold uppercase tracking-wider font-display ${
                      theme === 'light' ? 'text-zinc-800' : 'text-zinc-200'
                    }`}>
                      Atalhos Rápidos
                    </h3>
                    <p className="text-xs text-zinc-500">Contactos e informações gerais urgentes do tutor.</p>
                  </div>

                  <div className="space-y-2">
                    <button 
                      onClick={() => setActiveSubTab('schedule')}
                      className="w-full text-left p-2.5 bg-zinc-950 border border-zinc-850 rounded-xl hover:bg-zinc-900/50 flex items-center justify-between text-xs cursor-pointer"
                    >
                      <span className="font-semibold text-zinc-350">Pedir Justificação de Faltas</span>
                      <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
                    </button>
                    <button 
                      onClick={() => setActiveSubTab('documents')}
                      className="w-full text-left p-2.5 bg-zinc-950 border border-zinc-850 rounded-xl hover:bg-zinc-900/50 flex items-center justify-between text-xs cursor-pointer"
                    >
                      <span className="font-semibold text-zinc-350">Enviar Relatório / CC à Secretaria</span>
                      <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
                    </button>
                    <button 
                      onClick={() => {
                        const target = document.getElementById('guardian_form_input_contact');
                        setActiveSubTab('documents');
                        setTimeout(() => {
                          target?.scrollIntoView({ behavior: 'smooth' });
                        }, 200);
                      }}
                      className="w-full text-left p-2.5 bg-zinc-950 border border-zinc-850 rounded-xl hover:bg-zinc-900/50 flex items-center justify-between text-xs cursor-pointer"
                    >
                      <span className="font-semibold text-zinc-350">Atualizar Telefone / Endereço</span>
                      <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
                    </button>
                  </div>
                </div>

              </div>

            </div>

          </div>
        )}

        {/* SUBTAB: ACADEMIC HISTORY AND DETAILED GRADES */}
        {activeSubTab === 'academic' && (
          <div className="space-y-6 animate-fadeIn text-left">
            
            {/* Header / Intro */}
            <div className="p-4 bg-zinc-950 border border-zinc-850 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-zinc-200">Aproveitamento Escolar Integrado</h3>
                <p className="text-xs text-zinc-450 mt-0.5">Notas oficiais em tempo real lançadas pelo Diretor e Professores de Turma.</p>
              </div>
              <div className="flex items-center gap-3 font-mono text-xs">
                <div className="text-right">
                  <span className="text-[10px] text-zinc-500 block">Quarto Período</span>
                  <span className="text-indigo-400 font-bold">2025/2026</span>
                </div>
                <span className="p-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg font-bold">3º Período</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Detailed Grades display lists (Left Column) */}
              <div className="lg:col-span-8 space-y-4">
                
                <div className="bg-zinc-950 border border-zinc-855 rounded-xl overflow-hidden">
                  <div className="p-3 bg-zinc-900 border-b border-zinc-850 text-[10px] font-mono uppercase tracking-widest font-bold text-zinc-400 flex items-center justify-between">
                    <span>Disciplina</span>
                    <div className="flex items-center gap-12">
                      <span>Avaliação Final</span>
                      <span>Estado</span>
                    </div>
                  </div>

                  <div className="divide-y divide-zinc-850">
                    {activeStudent.grades.map((grade, idx) => {
                      const isPassing = grade.score >= 5.0; // Assuming 0-10 scale where 5.0 is passing in Portugal
                      return (
                        <div key={idx} className="p-3.5 flex items-center justify-between text-xs transition-hover hover:bg-zinc-900/50">
                          <div className="flex items-center gap-3">
                            <span className="p-2 bg-indigo-500/5 text-indigo-400 border border-indigo-500/10 rounded-lg">
                              <BookOpen className="w-3.5 h-3.5" />
                            </span>
                            <div>
                              <h4 className="font-bold text-zinc-200">{grade.subject}</h4>
                              <p className="text-[10px] text-zinc-500 font-mono mt-0.5">Professor responsável • 9º Ano A</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-14">
                            <span className={`text-sm font-black font-mono ${isPassing ? 'text-emerald-450' : 'text-rose-400'}`}>
                              {grade.score.toFixed(1)} <span className="text-[10px] text-zinc-500 font-normal">/ 10</span>
                            </span>
                            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                              isPassing ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-450'
                            }`}>
                              {isPassing ? 'Aprovado' : 'Atenção'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Historical records of previous quarters */}
                <div className="bg-zinc-950 border border-zinc-850 rounded-xl p-5 space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-450 font-mono">Histórico de Módulos (Períodos Anteriores)</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    
                    <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-850/50">
                      <div className="flex items-center justify-between font-mono text-[10px] text-zinc-500">
                        <span>1º Período (Out/Dez 2025)</span>
                        <span className="text-emerald-450 font-bold">Média: 9.1</span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-1 leading-relaxed font-sans">
                        Frequência de 100%. Comportamento exemplar e aprovação unânime em todas as metas curriculares.
                      </p>
                    </div>

                    <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-850/50">
                      <div className="flex items-center justify-between font-mono text-[10px] text-zinc-500">
                        <span>2º Período (Jan/Mar 2026)</span>
                        <span className="text-emerald-450 font-bold">Média: 9.4</span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-1 leading-relaxed font-sans">
                        Excelente participação nas aulas de ciências e robótica aplicada. Recompor metas de Português.
                      </p>
                    </div>

                  </div>
                </div>

              </div>

              {/* Progress and tips column (Right Column) */}
              <div className="lg:col-span-4 space-y-4">
                
                <div className="p-4 bg-zinc-950 border border-zinc-850 rounded-xl space-y-4 text-left">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 font-mono">Análise de Progresso por IA</h3>
                  
                  <div className="p-3 rounded-lg bg-indigo-500/5 border border-indigo-500/10 space-y-2.5">
                    <div className="flex items-center gap-1.5 font-sans font-bold text-xs text-indigo-300">
                      <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span>Recomendações Nexus Copilot</span>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed font-sans">
                      Com base nas classificações de <strong>9.5 em Matemática</strong> e <strong>8.8 em Português</strong>, a sua educanda Alice apresenta um rendimento bastante estável e superior à média nacional de 9º ano.
                    </p>
                    <p className="text-xs text-zinc-450 leading-relaxed font-sans">
                      💡 <strong>Dica Pedagógica:</strong> Manter a rotina atual de Robótica e focar no próximo exame experimental de Português no dia 25 de Junho.
                    </p>
                  </div>

                  {/* Summary progress status list */}
                  <div className="space-y-2 text-xs font-sans">
                    <div className="flex items-center justify-between p-2 rounded bg-zinc-900 text-zinc-300">
                      <span>Tarefas de Casa Entregues</span>
                      <span className="font-mono font-bold text-emerald-400">100% (24/24)</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded bg-zinc-900 text-zinc-300">
                      <span>Provas Escritas Realizadas</span>
                      <span className="font-mono font-bold text-indigo-455">8 / 8</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded bg-zinc-900 text-zinc-300">
                      <span>Cadernos de Campo Classificados</span>
                      <span className="font-mono font-bold text-sky-400">Excelente</span>
                    </div>
                  </div>
                </div>

              </div>

            </div>

          </div>
        )}

        {/* SUBTAB: TIMETABLE SCHEDULE AND ATTENDANCE MANAGEMENT */}
        {activeSubTab === 'schedule' && (
          <div className="space-y-6 animate-fadeIn text-left">
            
            {/* Header Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              
              <div className="p-4 bg-zinc-950 border border-zinc-850 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest block">Presenças Atribuídas</span>
                  <span className="text-xl font-bold text-zinc-200 mt-1 block">98 Unidades</span>
                </div>
                <div className="p-1 px-2.5 bg-emerald-500/10 text-emerald-400 font-mono font-bold text-xs rounded border border-emerald-500/10">
                  98%
                </div>
              </div>

              <div className="p-4 bg-zinc-950 border border-zinc-850 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest block">Faltas por Justificar</span>
                  <span className="text-xl font-bold text-rose-400 mt-1 block">1 Período</span>
                </div>
                <div className="p-1 px-2.5 bg-rose-500/10 text-rose-400 font-mono font-bold text-xs rounded border border-rose-500/10">
                  Por Resolver
                </div>
              </div>

              <div className="p-4 bg-zinc-950 border border-zinc-850 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest block">Faltas Justificadas</span>
                  <span className="text-xl font-bold text-emerald-400 mt-1 block">2 Períodos</span>
                </div>
                <span className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                </span>
              </div>
            </div>

            {/* Interactive Schedule Timetable Display Grid */}
            <div className="bg-zinc-950 border border-zinc-850 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 font-mono">Horário Letivo Oficial — Alice Siqueira</h3>
                  <p className="text-xs text-zinc-450 mt-0.5">Classes de Segunda a Sexta-feira, Sala de Estudos, Gabinete de Artes.</p>
                </div>
                <span className="p-1.5 px-3 bg-zinc-900 text-zinc-300 rounded-lg text-xs font-mono font-medium border border-zinc-800">9º Ano A — Escola Central</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-sans min-w-[700px]">
                  <thead>
                    <tr className="bg-zinc-900 text-zinc-400 border-b border-zinc-800 font-mono uppercase tracking-widest text-[9px]">
                      <th className="p-3 font-semibold">Hora / Tempos</th>
                      <th className="p-3 font-semibold">Segunda-feira</th>
                      <th className="p-3 font-semibold">Terça-feira</th>
                      <th className="p-3 font-semibold">Quarta-feira</th>
                      <th className="p-3 font-semibold">Quinta-feira</th>
                      <th className="p-3 font-semibold">Sexta-feira</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-850">
                    {fullWeeklySchedule.map((row, idx) => (
                      <tr key={idx} className="hover:bg-zinc-900/50">
                        <td className="p-3 font-mono font-medium text-zinc-450">{row.hour}</td>
                        <td className="p-3 text-zinc-200 font-semibold">{row.mon}</td>
                        <td className="p-3 text-zinc-200 font-semibold">{row.tue}</td>
                        <td className="p-3 text-zinc-200 font-semibold">{row.wed}</td>
                        <td className="p-3 text-zinc-200 font-semibold">{row.thu}</td>
                        <td className="p-3 text-zinc-200 font-semibold">{row.fri}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ABSENCE RECOGNITION & INTERACTIVE JUSTIFICATION MODULE */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Submission Form Justification (Left Side) */}
              <div className="lg:col-span-6 bg-zinc-950 border border-zinc-850 rounded-xl p-5 space-y-4">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 font-mono">Secretaria Virtual: Justificar Falta Letiva</h3>
                  <p className="text-xs text-zinc-450 mt-0.5">Envie imediatamente os dados e justificação médica/familiar para evitar registos de faltas injustificadas.</p>
                </div>

                <form onSubmit={handleAddJustification} className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5 text-left">
                      <label className="text-zinc-400 font-bold block">Data da Falta</label>
                      <input 
                        type="date" 
                        value={absenceDate}
                        onChange={(e) => setAbsenceDate(e.target.value)}
                        required
                        className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-lg px-3 py-2 outline-none focus:border-indigo-500 font-mono"
                      />
                    </div>
                    
                    <div className="space-y-1.5 text-left">
                      <label className="text-zinc-400 font-bold block">Motivo da Falta</label>
                      <select 
                        value={absenceSubject}
                        onChange={(e) => setAbsenceSubject(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-lg px-3 py-2 outline-none focus:border-indigo-500"
                      >
                        <option value="Consulta Médica">Consulta Médica / Pediatria</option>
                        <option value="Doença">Estado de Doença</option>
                        <option value="Assuntos Familiares">Impedimento Familiar de Força Maior</option>
                        <option value="Outro">Outros Motivos Legais</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-left">
                    <label className="text-zinc-400 font-bold block">Justificação Pormenorizada (Texto explicativo para a secretaria)</label>
                    <textarea 
                      placeholder="Indique os pormenores, sintomas ou o nome do estabelecimento sanitário que acompanhou a consulta para efeitos de compliance..."
                      value={absenceReason}
                      onChange={(e) => setAbsenceReason(e.target.value)}
                      required
                      rows={3}
                      className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-lg p-3 outline-none focus:border-indigo-500 font-sans leading-relaxed"
                    />
                  </div>

                  {/* Mock File selector */}
                  <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl space-y-1.5 text-left">
                    <span className="text-[11px] font-bold text-zinc-400 block">Digitalização de Justificativo Oficial (Anexo Opcional)</span>
                    <div className="flex items-center gap-3">
                      <button 
                        type="button"
                        onClick={() => setJustificationFile('justificativo_medico_alice_siqueira.pdf')}
                        className="px-3.5 py-1.5 bg-zinc-950 border border-zinc-700 text-zinc-300 rounded-lg font-medium hover:text-white cursor-pointer hover:bg-zinc-900 flex items-center gap-2"
                      >
                        <Upload className="w-3.5 h-3.5" /> 
                        {justificationFile ? 'Anexo Carregado ✓' : 'Escolher Arquivo (PDF, JPG)'}
                      </button>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {justificationFile || 'Nenhum documento selecionado'}
                      </span>
                    </div>
                  </div>

                  <button 
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-550 text-white font-bold py-2.5 rounded-xl cursor-pointer text-xs flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95"
                  >
                    <Send className="w-4 h-4" /> Enviar Justificação de Falta
                  </button>
                </form>

                {showAbsenceToast && (
                  <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 animate-fadeIn text-left flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-450 shrink-0 select-none" />
                    <div>
                      <strong>Justificação Enviada!</strong>
                      <p className="text-[10.5px] text-zinc-400 mt-0.5">O processo foi numerado e está pendente de homologação pela Secretaria Escolar da Direção de Turma.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Justifications History logs table (Right Side) */}
              <div className="lg:col-span-6 bg-zinc-950 border border-zinc-850 rounded-xl p-5 space-y-4">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-450 font-mono">Histórico de Justificações de Falta</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">Monitorize o estado de verificação das comunicações entregues à escola.</p>
                </div>

                <div className="space-y-2.5 max-h-[360px] overflow-y-auto">
                  {justificationList.map((j) => (
                    <div key={j.id} className="p-3.5 bg-zinc-900/60 border border-zinc-850 rounded-xl text-left select-none text-xs">
                      <div className="flex items-center justify-between font-mono text-[10px] text-zinc-500 mb-1">
                        <span className="font-bold text-zinc-400">{j.id} • Falta a: {j.date}</span>
                        <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[9px] ${
                          j.status === 'Aprovado' ? 'bg-emerald-500/10 text-emerald-400' :
                          j.status === 'Rejeitado' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400 animate-pulse'
                        }`}>
                          {j.status}
                        </span>
                      </div>
                      <h4 className="font-bold text-zinc-200 mt-1">{j.subject}</h4>
                      <p className="text-zinc-450 leading-relaxed text-[11px] mt-0.5">"{j.reason}"</p>
                    </div>
                  ))}
                  {justificationList.length === 0 && (
                    <p className="text-xs text-zinc-500 italic text-center py-6">Nenhum processo de justificação de falta foi submetido.</p>
                  )}
                </div>
              </div>

            </div>

          </div>
        )}

        {/* SUBTAB: FINANCES AND DETAILED TUITIONS */}
        {activeSubTab === 'financial' && (
          <div className="space-y-6 animate-fadeIn text-left">
            
            {/* Payment history header widget and payment methods */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left: Monthly bills listings */}
              <div className="lg:col-span-7 space-y-4">
                
                <div className="p-4 bg-zinc-950 border border-zinc-850 rounded-2xl">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 font-mono mb-3">Mensalidades Letivas e Propina Escolar</h3>
                  
                  <div className="space-y-3">
                    {studentInvoices.map((inv) => (
                      <div key={inv.id} className="p-4 bg-zinc-900 border border-zinc-850 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <span className={`p-2.5 rounded-xl border ${
                            inv.status === 'paid' ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/10' :
                            inv.status === 'overdue' ? 'bg-rose-500/5 text-rose-400 border-rose-500/10' : 'bg-amber-500/5 text-amber-400 border-amber-500/10'
                          }`}>
                            <CreditCard className="w-5 h-5" />
                          </span>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-xs font-bold text-zinc-100">€{inv.amount.toFixed(2)} - {inv.category === 'tuition' ? 'Mensalidade Letiva' : inv.category === 'material' ? 'Material Didático' : 'Mensalidade Componente de Apoio'}</h4>
                              <span className={`text-[9px] uppercase font-bold font-mono px-1.5 py-0.2 rounded-full ${
                                inv.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400' :
                                inv.status === 'pending' ? 'bg-amber-500/10 text-amber-400' : 'bg-rose-500/10 text-rose-400'
                              }`}>
                                {inv.status}
                              </span>
                            </div>
                            <p className="text-[10px] text-zinc-500 font-mono mt-1">Fatura ID: {inv.id} • Limite: {inv.dueDate}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-stretch sm:self-auto shrink-0">
                          {inv.status !== 'paid' ? (
                            <button
                              onClick={() => setSelectedInvoice(inv)}
                              className="flex-1 sm:flex-none px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-550 text-white font-bold rounded-lg cursor-pointer text-2xs uppercase tracking-wider shadow"
                            >
                              Pagar Agora
                            </button>
                          ) : (
                            <button
                              onClick={() => setReceiptToPrint(inv)}
                              className="flex-1 sm:flex-none px-2.5 py-1.5 bg-zinc-950 border border-zinc-700 text-zinc-300 hover:text-white rounded-lg cursor-pointer text-2xs uppercase tracking-wider flex items-center justify-center gap-1.5"
                            >
                              <Download className="w-3 h-3" /> Ver Recibo
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {studentInvoices.length === 0 && (
                      <p className="text-xs text-zinc-500 italic py-6">Nenhuma cobrança financeira emitida.</p>
                    )}
                  </div>
                </div>

                {/* Historic of financial payouts transactions logs */}
                <div className="bg-zinc-950 border border-zinc-850 p-5 rounded-2xl text-left space-y-4">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-450 font-mono">Histórico de Transações e Pagamentos</h3>
                    <p className="text-xs text-zinc-500 mt-0.5">Listagem das últimas propinas liquidadas que servem como declaração de IRS de Encargos Escolares.</p>
                  </div>

                  <div className="divide-y divide-zinc-850 bg-zinc-900/40 border border-zinc-850 rounded-xl overflow-hidden">
                    <div className="p-3 flex items-center justify-between text-xs transition-colors hover:bg-zinc-900/10">
                      <div>
                        <h4 className="font-bold text-zinc-200">Mensalidade — Maio de 2026</h4>
                        <p className="text-[10px] text-zinc-500 font-mono mt-0.5">Liquidada em 10/05/2026 via Cartão de Crédito</p>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-black font-mono text-emerald-400">€ 250,00</span>
                        <span className="text-[9.5px] text-zinc-500 block uppercase font-bold font-mono">CC Ref: #8432</span>
                      </div>
                    </div>

                    <div className="p-3 flex items-center justify-between text-xs transition-colors hover:bg-zinc-900/10">
                      <div>
                        <h4 className="font-bold text-zinc-200">Seguro Académico Escolar Anual</h4>
                        <p className="text-[10px] text-zinc-500 font-mono mt-0.5">Liquidada em 12/01/2026 via Transferência Bancária</p>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-black font-mono text-emerald-400">€ 50,00</span>
                        <span className="text-[9.5px] text-zinc-500 block uppercase font-bold font-mono">Ref Bank Tran</span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Right: Payment simulator wrapper or guidelines */}
              <div className="lg:col-span-5 space-y-4">
                
                {/* Simulated payment Gateway frame when user clicks Pagar */}
                {selectedInvoice ? (
                  <div className="p-5 bg-zinc-950 border border-indigo-500/30 rounded-2xl space-y-4 animate-fadeIn relative">
                    <span className="absolute top-3 right-3 text-indigo-400 bg-indigo-500/10 text-[9px] font-bold font-mono px-2 py-0.5 rounded uppercase">
                      Portal Ativo
                    </span>
                    
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-300 font-mono">Pagamento Seguro Integrado</h3>
                      <p className="text-xs text-zinc-400 mt-1">Insira os seus dados de crédito para liquidar instantaneamente:</p>
                    </div>

                    <div className="p-3 bg-zinc-900 rounded-xl space-y-1.5 text-xs">
                      <div className="flex items-center justify-between font-mono">
                        <span className="text-zinc-500">Valor a Liquidar:</span>
                        <span className="text-base font-black text-indigo-450">€ {selectedInvoice.amount.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between font-mono">
                        <span className="text-zinc-500">Ref Fatura:</span>
                        <span className="text-zinc-300">{selectedInvoice.id}</span>
                      </div>
                    </div>

                    <div className="space-y-3.5 text-xs">
                      <div className="space-y-1 text-left">
                        <label className="text-zinc-450 font-bold block select-none">Titular do Cartão</label>
                        <input 
                          type="text" 
                          value={cardHolder}
                          onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
                          className="w-full bg-zinc-900 border border-zinc-800 text-zinc-150 rounded-lg px-3 py-2 outline-none font-mono"
                        />
                      </div>

                      <div className="space-y-1 text-left">
                        <label className="text-zinc-450 font-bold block select-none">Número do Cartão de Crédito</label>
                        <input 
                          type="text" 
                          value={cardNumber}
                          onChange={(e) => setCardNumber(e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-800 text-zinc-150 rounded-lg px-3 py-2 outline-none font-mono"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1 text-left">
                          <label className="text-zinc-450 font-bold block select-none">Validade</label>
                          <input 
                            type="text" 
                            value={cardExpiry}
                            onChange={(e) => setCardExpiry(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 text-zinc-150 rounded-lg px-3 py-2 outline-none font-mono text-center"
                          />
                        </div>

                        <div className="space-y-1 text-left">
                          <label className="text-zinc-450 font-bold block select-none">Código CVC/CVV</label>
                          <input 
                            type="password" 
                            maxLength={3}
                            value={cardCVV}
                            onChange={(e) => setCardCVV(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 text-zinc-150 rounded-lg px-3 py-2 outline-none font-mono text-center"
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleProcessPayment}
                      disabled={isProcessingPayment}
                      className="w-full bg-emerald-600 hover:bg-emerald-550 text-white font-bold py-3 rounded-xl cursor-pointer text-xs flex items-center justify-center gap-2 shadow"
                    >
                      {isProcessingPayment ? (
                        <>
                          <Clock className="w-4 h-4 animate-spin" /> Processando Segurança...
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-4 h-4" /> Autorizar e Pagar Propina
                        </>
                      )}
                    </button>

                    {showPaymentSuccess && (
                      <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-450 animate-fadeIn text-left">
                        ✓ <strong>Pagamento Confirmado!</strong> A propina foi liquidada e o seu recibo de quitação já está disponível para download imediato.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-5 bg-zinc-950 border border-zinc-850 rounded-2xl text-left space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 font-mono">Dossier de Descontos e Acordos</h3>
                    
                    <div className="space-y-2 text-xs">
                      <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-850">
                        <span className="text-[10px] text-indigo-400 font-mono uppercase font-bold tracking-widest block">Metodologia Fiscal</span>
                        <p className="text-zinc-350 mt-1 leading-relaxed font-sans">
                          Emissão de faturas simplificadas ao dia 1 de cada mês letivo. Dispõe de um período gracioso de 10 dias de bonificação sem juros de mora.
                        </p>
                      </div>

                      <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-850">
                        <span className="text-[10px] text-emerald-400 font-mono uppercase font-bold tracking-widest block">Benefício / Apoio de Bolsa</span>
                        <p className="text-zinc-350 mt-1 leading-relaxed font-sans">
                          Educanda Alice enquadrada no escalão ordinário letivo. Sem descontos suplementares reportados.
                        </p>
                      </div>
                    </div>

                    <div className="p-3 text-[10.5px] rounded bg-indigo-500/5 text-indigo-400 font-mono leading-relaxed">
                      💡 <strong>Deduzir no IRS:</strong> Todas as faturas liquidadas neste portal são registadas e transferidas automaticamente para o e-fatura sob a categoria de "Despesas de Educação".
                    </div>
                  </div>
                )}

              </div>

            </div>

          </div>
        )}

        {/* SUBTAB: DOCUMENTS AND SECRETARIAT SUBMISSIONS */}
        {activeSubTab === 'documents' && (
          <div className="space-y-6 animate-fadeIn text-left">
            
            {/* Split layout: Download public forms (Left) VS Upload Pupil documents (Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Side: Standard Institution documents school can offer to download */}
              <div className="lg:col-span-6 bg-zinc-950 border border-zinc-850 rounded-2xl p-5 space-y-4">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 font-mono">Dossier Académico Útil: Descarregar Ficheiros</h3>
                  <p className="text-xs text-zinc-450 mt-0.5">Formulários e declarações padrão da instituição para assinatura e consulta rápida.</p>
                </div>

                <div className="space-y-2.5">
                  <div className="p-3 bg-zinc-900 border border-zinc-850 rounded-xl flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <span className="p-2.5 bg-zinc-950 rounded-lg text-rose-500">
                        <FileText className="w-5 h-5" />
                      </span>
                      <div>
                        <h4 className="font-bold text-zinc-150">Calendário Escolar Oficial 2025/2026</h4>
                        <p className="text-[10px] text-zinc-500 font-mono mt-0.5">PDF • 1.4 MB • Versão Homologada</p>
                      </div>
                    </div>
                    <a 
                      href="#" 
                      onClick={(e) => e.preventDefault()}
                      className="p-2 bg-zinc-950 border border-zinc-800 rounded-lg hover:text-white hover:border-zinc-700 text-zinc-450 cursor-pointer"
                      title="Descarregar Formulário"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </div>

                  <div className="p-3 bg-zinc-900 border border-zinc-850 rounded-xl flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <span className="p-2.5 bg-zinc-950 rounded-lg text-rose-500">
                        <FileText className="w-5 h-5" />
                      </span>
                      <div>
                        <h4 className="font-bold text-zinc-150">Regulamento Interno & Direitos do Estudante</h4>
                        <p className="text-[10px] text-zinc-500 font-mono mt-0.5">PDF • 3.1 MB • Versão Atualizada Junho</p>
                      </div>
                    </div>
                    <a 
                      href="#" 
                      onClick={(e) => e.preventDefault()}
                      className="p-2 bg-zinc-950 border border-zinc-800 rounded-lg hover:text-white hover:border-zinc-700 text-zinc-450 cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </div>

                  <div className="p-3 bg-zinc-900 border border-zinc-850 rounded-xl flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <span className="p-2.5 bg-zinc-950 rounded-lg text-rose-500">
                        <FileText className="w-5 h-5" />
                      </span>
                      <div>
                        <h4 className="font-bold text-zinc-150">Formulário para Consentimento de Visita de Estudo</h4>
                        <p className="text-[10px] text-zinc-500 font-mono mt-0.5">PDF • 450 KB • Obrigatório preenchimento</p>
                      </div>
                    </div>
                    <a 
                      href="#" 
                      onClick={(e) => e.preventDefault()}
                      className="p-2 bg-zinc-950 border border-zinc-800 rounded-lg hover:text-white hover:border-zinc-700 text-zinc-450 cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </div>

                  <div className="p-3 bg-zinc-900 border border-zinc-850 rounded-xl flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <span className="p-2.5 bg-zinc-950 rounded-lg text-rose-500">
                        <FileText className="w-5 h-5" />
                      </span>
                      <div>
                        <h4 className="font-bold text-zinc-150">Cartilha de Cobertura de Seguro Escolar 2026</h4>
                        <p className="text-[10px] text-zinc-500 font-mono mt-0.5">PDF • 800 KB • Apólice n-8432-N</p>
                      </div>
                    </div>
                    <a 
                      href="#" 
                      onClick={(e) => e.preventDefault()}
                      className="p-2 bg-zinc-950 border border-zinc-800 rounded-lg hover:text-white hover:border-zinc-700 text-zinc-450 cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </div>
                </div>

                {/* Submited items tracker log log */}
                <div className="p-4 bg-zinc-900 border border-zinc-850 rounded-xl space-y-3.5">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#9CA3AF] block">Dossier Entregue pelo Encarregado</span>
                  <div className="space-y-2">
                    {uploadedStudentDocs.map((ud, index) => (
                      <div key={index} className="p-2.5 bg-zinc-950 rounded-lg flex items-center justify-between text-2xs font-mono">
                        <div className="min-w-0">
                          <span className="text-zinc-200 block truncate">{ud.name}</span>
                          <span className="text-zinc-500 block text-[9px]">Enviado: {ud.date} • Categoria: {ud.category}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[8.5px] shrink-0 ${
                          ud.status === 'Homologado' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                        }`}>
                          {ud.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Right Side: Upload and digital submission for administrative compliance */}
              <div className="lg:col-span-6 bg-zinc-950 border border-zinc-850 rounded-2xl p-5 space-y-4">
                
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 font-mono">Submeter Atas ou Justificações Médicas</h3>
                  <p className="text-xs text-zinc-450 mt-0.5">Envie fotocópias de cartões, relatórios ou cartas à secretaria. Reduza as visitas desnecessárias à escola.</p>
                </div>

                <form onSubmit={handleDocUploadSimulate} className="space-y-4 text-xs">
                  <div className="space-y-1 text-left">
                    <label className="text-zinc-450 font-bold block">Categoria do Documento</label>
                    <select 
                      value={newDocCategory}
                      onChange={(e) => setNewDocCategory(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-855 text-zinc-150 rounded-lg px-3 py-2 outline-none focus:border-indigo-500"
                    >
                      <option value="Declaração de Vacinas">Boletim de Vacinas Atualizado</option>
                      <option value="Relatório de Aptidão Física">Atestado / Aptidão Física</option>
                      <option value="Justificação de Assinaturas">Identificação Oficial do Responsável</option>
                      <option value="Outro">Outras Submissões Gerais</option>
                    </select>
                  </div>

                  <div className="space-y-1 text-left">
                    <label className="text-zinc-450 font-bold block">Nome do Arquivo (Ficha descritiva)</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Boletim_Vacinas_2026"
                      value={newDocName}
                      onChange={(e) => setNewDocName(e.target.value)}
                      required
                      className="w-full bg-zinc-900 border border-zinc-855 text-zinc-150 rounded-lg px-3 py-2 outline-none focus:border-indigo-500 font-sans"
                    />
                  </div>

                  {/* Drag and Drop Mock Interface Area */}
                  <div className="p-6 border border-zinc-800 border-dashed bg-zinc-900/50 rounded-xl text-center space-y-2.5">
                    <span className="p-2.5 bg-zinc-950 rounded-xl border border-zinc-800 inline-block text-zinc-450">
                      <Upload className="w-6 h-6 animate-pulse" />
                    </span>
                    <div>
                      <span className="text-zinc-300 font-bold block">Arraste e solte o ficheiro ou clique para selecionar</span>
                      <p className="text-[10.5px] text-zinc-500 mt-1">Limite máximo de tamanho: 15MB. Formato: PDF, PNG, JPG.</p>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isUploadingDoc || !newDocName}
                    className="w-full bg-indigo-600 hover:bg-indigo-550 text-white font-bold py-2.5 rounded-xl cursor-pointer text-xs flex items-center justify-center gap-2 shadow"
                  >
                    {isUploadingDoc ? (
                      <>
                        <Clock className="w-4 h-4 animate-spin" /> Processando Ficheiro Criptografado...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" /> Confirmar & Enviar à Secretaria
                      </>
                    )}
                  </button>
                </form>

                {/* Form to update home address and contact details */}
                <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl space-y-4">
                  <div className="border-b border-zinc-800 pb-2.5">
                    <h4 className="text-xs font-bold text-zinc-200" id="guardian_form_input_contact">Atualização Cadastral e Contacto de Emergência</h4>
                    <p className="text-[10px] text-zinc-500 mt-0.5">Assegure que os contactos para alertas automáticos SMS de notas e comportamento estão operacionais.</p>
                  </div>

                  <form onSubmit={handleUpdateContactDetails} className="space-y-4 text-xs">
                    <div className="space-y-1 text-left">
                      <label className="text-zinc-450 font-bold block">Contacto do Encarregado</label>
                      <input 
                        type="text" 
                        value={guardianContact}
                        onChange={(e) => setGuardianContact(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-850 text-indigo-400 font-mono font-bold rounded-lg px-3 py-2 outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1 text-left">
                        <label className="text-zinc-450 font-bold block">E-mail de Notificações</label>
                        <input 
                          type="email" 
                          value={guardianEmail}
                          onChange={(e) => setGuardianEmail(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-850 text-zinc-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div className="space-y-1 text-left">
                        <label className="text-zinc-450 font-bold block">Endereço Residencial Habitual</label>
                        <input 
                          type="text" 
                          value={guardianAddress}
                          onChange={(e) => setGuardianAddress(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-850 text-zinc-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    <button 
                      type="submit" 
                      className="w-full bg-zinc-950 border border-zinc-700 hover:border-indigo-500 text-zinc-350 hover:text-indigo-400 font-bold py-2 rounded-xl cursor-pointer transition-colors"
                    >
                      Gravar Alterações Cadastrais
                    </button>
                  </form>

                  {showContactToast && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 animate-fadeIn text-left">
                      ✓ <strong>Ficha Atualizada!</strong> Os novos contactos de segurança de Marcos Siqueira foram guardados na base de dados Nexus e comunicados à secretaria.
                    </div>
                  )}
                </div>

              </div>

            </div>

          </div>
        )}

        {/* SUBTAB: CHAT MESSAGE DIRECT TO TEACHER */}
        {activeSubTab === 'chat' && (
          <div className="space-y-6 animate-fadeIn text-left">
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Column: Tutor Profile Info */}
              <div className="lg:col-span-4 space-y-4">
                
                <div className="p-5 bg-zinc-950 border border-zinc-850 rounded-2xl space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
                      <User className="w-6 h-6 text-indigo-400" />
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-zinc-150">Professor Alberto Ramos</h3>
                      <p className="text-xs text-zinc-500 mt-0.5">Diretor de Turma (9º Ano A)</p>
                    </div>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div className="flex items-center justify-between p-2 rounded bg-zinc-900 border border-zinc-850 text-zinc-350">
                      <span>Correio Eletrónico:</span>
                      <strong className="font-mono text-zinc-400">alberto@nexus.edu</strong>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded bg-zinc-900 border border-zinc-850 text-zinc-350">
                      <span>Dias de Atendimento:</span>
                      <strong className="text-zinc-400 text-right">Quinta-feira 14:00 - 15:30</strong>
                    </div>
                  </div>

                  <div className="p-3 text-[10.5px] rounded bg-indigo-500/5 text-indigo-400 font-mono leading-relaxed">
                    💬 Prezado encarregado, utilize este canal seguro de chat regulamentado pela direção escolar para reportar de forma privada e em tempo real justificações, dúvidas disciplinares ou solicitar marcação de reuniões individuais.
                  </div>
                </div>

              </div>

              {/* Right Column: Dynamic Interactive messaging box */}
              <div className="lg:col-span-8 bg-zinc-950 border border-zinc-850 rounded-2xl flex flex-col h-[500px]">
                
                {/* Chat header status */}
                <div className="p-4 bg-zinc-900 border-b border-zinc-850 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-bold text-zinc-200">Canal Tutor Permanente de Alice Siqueira</span>
                  </div>
                  <span className="text-[10px] text-zinc-500 font-mono">ID Conversa: #CHAT-TDR9104</span>
                </div>

                {/* Log messages view box */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {chatLog.map((chat, idx) => (
                    <div 
                      key={idx} 
                      className={`flex flex-col max-w-[85%] ${chat.isParent ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                    >
                      <span className="text-[10px] text-zinc-500 font-mono mb-1">{chat.sender} • {chat.time}</span>
                      <div className={`p-3 rounded-2xl text-xs leading-relaxed ${
                        chat.isParent 
                          ? 'bg-indigo-600 text-white rounded-tr-none' 
                          : 'bg-zinc-905 bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-tl-none'
                      }`}>
                        {chat.text}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Sender actions tools */}
                <div className="p-3 border-t border-zinc-850 bg-zinc-900 flex items-center gap-2">
                  <input 
                    type="text" 
                    value={chatDraft}
                    onChange={(e) => setChatDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSendMessage();
                    }}
                    placeholder="Escreva uma mensagem privada e segura para o Professor Alberto..."
                    className="flex-1 bg-zinc-950 border border-zinc-800 focus:border-indigo-500 outline-none px-3.5 py-2 rounded-xl text-xs text-zinc-200 font-sans"
                  />
                  <button
                    onClick={handleSendMessage}
                    className="p-2 bg-indigo-600 hover:bg-indigo-550 text-white rounded-xl shadow cursor-pointer text-xs flex items-center gap-1.5 font-bold transition-all"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>

              </div>

            </div>

          </div>
        )}

      </div>

      {/* 4. MODAL PRINTABLE / EXCEL VIEW FOR RECEIPT QUITATION */}
      {receiptToPrint && (
        <div className="fixed inset-0 z-[11000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white text-zinc-900 rounded-2xl shadow-2xl overflow-hidden p-6 relative border border-zinc-200 font-mono text-xs">
            
            {/* Close button */}
            <button 
              onClick={() => setReceiptToPrint(null)}
              className="absolute right-4 top-4 p-2 bg-zinc-100 hover:bg-zinc-200 rounded-full text-zinc-650 cursor-pointer"
            >
              <Trash2 className="w-4 h-4 text-zinc-650" />
            </button>

            {/* Receipt headers */}
            <div className="text-center space-y-1.5 border-b border-zinc-250 pb-5">
              <h2 className="text-indigo-700 font-black tracking-wider text-base uppercase">NEXUS EDU — INSTITUTO ACADÉMICO</h2>
              <p className="text-[10px] text-zinc-550">NIF Geral: 504 321 888 • Ponta Delgada, Açores</p>
              <p className="text-[10px] text-zinc-550">Telefone Administr.: +351 296 321 000</p>
              <div className="mt-3.5 p-1 px-4 bg-emerald-100 text-emerald-800 font-bold rounded-full inline-block text-[11px] uppercase">
                Recibo de Quitação Oficial
              </div>
            </div>

            {/* Receipt table metadata details details */}
            <div className="py-4 space-y-2 border-b border-dashed border-zinc-300 text-left">
              <div className="flex justify-between">
                <span className="text-zinc-500">Número da Fatura:</span>
                <span className="font-bold text-zinc-800">{receiptToPrint.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Educando Sujeito:</span>
                <span className="font-bold text-zinc-800">{receiptToPrint.studentName} ({receiptToPrint.studentId})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Encarregado de Educação:</span>
                <span className="font-bold text-zinc-800">Marcos Siqueira</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Data de Liquidação:</span>
                <span className="font-bold text-zinc-800">2026-06-15</span>
              </div>
            </div>

            {/* Line description of item */}
            <div className="py-4 space-y-3 border-b border-zinc-250 text-left text-xs">
              <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Item Descrição</span>
              <div className="flex justify-between text-zinc-800 font-bold">
                <span>Mensalidade Componente Curricular - Propinas 9º Ano A (Ref: Junho 2026)</span>
                <span>€ {receiptToPrint.amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[10.5px] text-zinc-500 italic">
                <span>Isento de IVA nos termos do artigo 9.º do CIVA</span>
                <span>-</span>
              </div>
            </div>

            {/* Grand Total */}
            <div className="py-4 flex justify-between items-center bg-zinc-50 p-3 rounded-lg mt-3">
              <span className="font-black text-zinc-650 text-xs">TOTAL RECEBIDO</span>
              <span className="text-base font-black text-emerald-700">€ {receiptToPrint.amount.toFixed(2)}</span>
            </div>

            <div className="p-3 text-[9px] text-zinc-500 leading-relaxed text-center mt-3 bg-zinc-50 border border-zinc-200 rounded">
              Este recibo de pagamento é emitido de forma automatizada pelo servidor Nexus Edu e serve de comprovativo fiscal legal para deduções de despesas de educação em IRS.
            </div>

            {/* Actions: Print and close */}
            <div className="mt-5 flex items-center justify-between gap-3 font-sans">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-550 text-white font-bold rounded-xl cursor-pointer text-xs flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" /> Imprimir Documento
              </button>
              <button
                onClick={() => setReceiptToPrint(null)}
                className="flex-1 py-2.5 bg-zinc-205 bg-zinc-150 border border-zinc-300 text-zinc-800 font-semibold rounded-xl hover:bg-zinc-200 cursor-pointer text-xs text-center"
              >
                Fechar Recibo
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
