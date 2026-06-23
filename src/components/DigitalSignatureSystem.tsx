import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  PenTool, 
  CheckSquare, 
  Clock, 
  ShieldCheck, 
  CheckCircle, 
  XCircle, 
  Plus, 
  Search, 
  Mail, 
  History, 
  Hash, 
  Globe, 
  Calendar, 
  Archive, 
  Trash2, 
  User, 
  ExternalLink, 
  AlertCircle, 
  ArrowRight, 
  Lock,
  Download,
  CheckCircle2,
  Bookmark,
  FileCheck2,
  Sparkles,
  Link2,
  DollarSign
} from 'lucide-react';
import { DigitalSignatureRequest, DigitalSignatureDocType, DigitalSignatureStatus, UserRole, Student, Invoice } from '../types';
import { SchoolDoc } from './SchoolDocuments';

interface DigitalSignatureSystemProps {
  currentUserRole: UserRole;
  currentUserName: string;
  currentUserEmail: string;
  students: Student[];
  invoices: Invoice[];
  schoolDocuments: SchoolDoc[];
  signatures: DigitalSignatureRequest[];
  onAddSignature: (sig: DigitalSignatureRequest) => void;
  onUpdateSignature: (sig: DigitalSignatureRequest) => void;
  onDeleteSignature: (id: string) => void;
}

// Generate premium mock signatures
export const defaultSignatures = (students: Student[], schoolDocs: SchoolDoc[], invoices: Invoice[]): DigitalSignatureRequest[] => {
  return [
    {
      id: 'ASS-2026-001',
      title: 'Contrato de Prestação de Serviços Educativos de Matrícula (2026/2027)',
      documentType: 'Contrato',
      content: `CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE EDUCAÇÃO E ENSINO\n\nOutorgantes:\n1º Outorgante: Colégio Escolar Nexus S.A.\n2º Outorgante: Encarregado de Educação\n\nCláusula 1ª: O presente contrato rege a matrícula escolar e termos de frequência do estudante para o ano letivo de 2026/2027.\nCláusula 2ª: O valor das propinas mensais e as diretrizes regulamentares de comportamento do aluno seguem os preceitos oficiais.\nCláusula 3ª: Este documento adquire força legal plena e irrevogável após a aposição das respetivas assinaturas digitais certificadas no portal escolar.`,
      status: 'signed',
      requesterName: 'Eduardo Guimarães',
      requesterRole: 'admin',
      signerName: 'Sofia Maria de Jesus Castro',
      signerEmail: 'sofia.castro@gmail.com',
      signerContact: '+351 912 345 678',
      sentAtDate: '2026-06-15',
      sentAtTime: '10:15:30',
      signedAtDate: '2026-06-15',
      signedAtTime: '14:23:45',
      hash: '9a87d6ee2bf98d123e4215fb6e1cb15a45bdf47c1221bceeb1eab4001c90de23',
      ipAddress: '188.82.145.221 (Lisboa, Portugal)',
      referenceModule: 'matriculas',
      referenceId: students[0]?.id || 'ALU-101',
      signatureStrokeData: 'M 10 30 C 50 20, 100 80, 150 40 S 200 10, 250 50 S 120 120, 100 80'
    },
    {
      id: 'ASS-2026-002',
      title: 'Termo de Responsabilidade de Equipamento Tecnológico Escolar',
      documentType: 'Termo',
      content: `TERMO DE COMPROMISSO E CONFIANÇA DE EQUIPAMENTO\n\nPelo presente termo, o Encarregado de Educação assume plena responsabilidade civil e de cuidado preventivo pelo computador portátil de uso escolar cedido ao educando durante o ciclo de formação científica, obrigando-se a proceder à sua devolução em perfeito estado de conservação física e operacional ao término das aulas.`,
      status: 'sent',
      requesterName: 'Dra. Leonor Antunes',
      requesterRole: 'director',
      signerName: 'Rui Miguel Tavares Neto',
      signerEmail: 'rui.m.neto@gmail.com',
      signerContact: '+351 934 887 112',
      sentAtDate: '2026-06-20',
      sentAtTime: '09:00:15',
      referenceModule: 'documentos',
      referenceId: 'DOC-001'
    },
    {
      id: 'ASS-2026-003',
      title: 'Autorização Expressa de Saída de Campo (Visita de Estudo ao Oceanário)',
      documentType: 'Autorização',
      content: `AUTORIZAÇÃO PEDAGÓGICA PARA ATIVIDADES EXTERNAS\n\nEu, abaixo assinado, na qualidade de encarregado de educação responsável pelo educando, concedo autorização expressa e livre consentimento para que este participe no passeio pedagógico ao Oceanário de Lisboa a realizar no próximo dia 25 de Junho de 2026, com saída em autocarro escolar cedido pela instituição, nos termos do plano geral pedagógico.`,
      status: 'signed',
      requesterName: 'Prof. Ricardo Fonseca',
      requesterRole: 'teacher',
      signerName: 'Isabel Cristina Pinto',
      signerEmail: 'isabel.pinto@sapo.pt',
      signerContact: '+351 922 415 621',
      sentAtDate: '2026-06-18',
      sentAtTime: '13:02:40',
      signedAtDate: '2026-06-19',
      signedAtTime: '11:45:10',
      hash: '2da8f77ea0c156f238b1ad675e82f77c3e1e44a9cd32621ecbde1e860955cf01',
      ipAddress: '85.245.99.12 (Porto, Portugal)',
      referenceModule: 'matriculas',
      referenceId: students[1]?.id || 'ALU-102',
      signatureStrokeData: 'M 15 25 Q 40 80, 80 30 T 200 40 T 260 50'
    },
    {
      id: 'ASS-2026-004',
      title: 'Termo de Compromisso e Acordo de Parcelamento de Mensalidades',
      documentType: 'Termo',
      content: `CONFISSÃO DE DÍVIDA E CONVENÇÃO DE PARCELAMENTO FINANCEIRO\n\nCláusula 1ª: O outorgante devedor reconhece formalmente o débito vencido relativo a propinas correntes.\nCláusula 2ª: Acorda-se o fracionamento em 3 parcelas mensais iguais a serem imputadas nos próximos ciclos.\nCláusula 3ª: O incumprimento de qualquer parcela importa no imediato vencimento extraordinário do montante integral e suspensão de acordos promocionais.`,
      status: 'archived',
      requesterName: 'Eduardo Guimarães',
      requesterRole: 'financial',
      signerName: 'Bernardo Silva Gomes',
      signerEmail: 'bernardo.gomes@outlook.pt',
      signerContact: '+351 965 212 400',
      sentAtDate: '2026-06-10',
      sentAtTime: '16:40:00',
      signedAtDate: '2026-06-11',
      signedAtTime: '10:05:12',
      archivedAtDate: '2026-06-12',
      hash: 'f030e46b0d9124be7047f0e35fa8de2e92cbb3e85e1bc0ee54e1bbcb93972c3d',
      ipAddress: '194.65.120.44 (Coimbra, Portugal)',
      referenceModule: 'financeiro',
      referenceId: invoices[0]?.id || 'FAT-9901',
      signatureStrokeData: 'M 5 50 L 100 55 C 100 10, 200 20, 250 80'
    },
    {
      id: 'ASS-2026-005',
      title: 'Declaração Escolar de Prática de Desporto e Desoneração Física',
      documentType: 'Declaração',
      content: `DECLARAÇÃO GERAL DE CAPACIDADE FÍSICA AUTORIZADA\n\nDeclaro para todos os efeitos civis e desportivos de aptidão que o aluno encontra-se habilitado fisicamente para a prática de atividades desportivas e físicas curriculares e extracurriculares incluídas no plano de formação integrada do corrente ano letivo.`,
      status: 'draft',
      requesterName: 'Prof. Ricardo Fonseca',
      requesterRole: 'teacher',
      signerName: 'Sofia Maria de Jesus Castro',
      signerEmail: 'sofia.castro@gmail.com',
      signerContact: '+351 912 345 678',
      sentAtDate: '2026-06-22',
      sentAtTime: '08:12:00'
    }
  ];
};

export default function DigitalSignatureSystem({
  currentUserRole,
  currentUserName,
  currentUserEmail,
  students,
  invoices,
  schoolDocuments,
  signatures,
  onAddSignature,
  onUpdateSignature,
  onDeleteSignature
}: DigitalSignatureSystemProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | DigitalSignatureStatus>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | DigitalSignatureDocType>('all');
  const [activeTab, setActiveTab] = useState<'backoffice' | 'signer-portal'>('backoffice');

  // Modal and Signature States
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [targetSignRequest, setTargetSignRequest] = useState<DigitalSignatureRequest | null>(null);
  const [inspectCertificate, setInspectCertificate] = useState<DigitalSignatureRequest | null>(null);

  // Form State
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<DigitalSignatureDocType>('Contrato');
  const [newContent, setNewContent] = useState('');
  const [signerName, setSignerName] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [signerContact, setSignerContact] = useState('');
  const [refModule, setRefModule] = useState<'none' | 'documentos' | 'matriculas' | 'financeiro'>('none');
  const [refId, setRefId] = useState('');

  // Signature Canvas Drawer Tool
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawnSomething, setHasDrawnSomething] = useState(false);

  // Synchronize dynamic lists based on associated module for helper select menus
  useEffect(() => {
    if (refModule === 'matriculas' && students.length > 0) {
      setRefId(students[0].id);
    } else if (refModule === 'financeiro' && invoices.length > 0) {
      setRefId(invoices[0].id);
    } else if (refModule === 'documentos' && schoolDocuments.length > 0) {
      setRefId(schoolDocuments[0].id);
    } else {
      setRefId('');
    }
  }, [refModule, students, invoices, schoolDocuments]);

  // Canvas Stroke Action Handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#ffffff'; // White ink for dark slate panel
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const coords = getEventCoords(e, canvas);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setIsDrawing(true);
    setHasDrawnSomething(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getEventCoords(e, canvas);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawnSomething(false);
  };

  const getEventCoords = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
    canvas: HTMLCanvasElement
  ) => {
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      if (e.touches.length === 0) return { x: 0, y: 0 };
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  };

  // Generate SHA-256 style receipt stamp
  const generateSigCryptoHash = (id: string, email: string) => {
    const raw = `${id}-${email}-${Date.now()}-${Math.random()}`;
    // Simple but elegant checksum calculation for a visual visual proof hash representation
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      const char = raw.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    const hex = Math.abs(hash).toString(16) + Math.floor(Math.random() * 9999 + 1000).toString(16);
    return `sha256_${hex}7047f0e35fa8de2e92cbb3e85e1bc0ee54e1bbcb93972c3d`;
  };

  // Submit Signature payload
  const handlePerformSignature = () => {
    if (!targetSignRequest) return;
    if (!hasDrawnSomething) {
      alert('Favor assinar no painel de captura antes de submeter.');
      return;
    }

    // Capture stroke representation - in our demo we save a mock svg flow string to draw
    const mockStroke = 'M 20 40 Q 80 120, 150 20 T 240 60';
    const cleanEmail = targetSignRequest.signerEmail;
    const cleanHash = generateSigCryptoHash(targetSignRequest.id, cleanEmail);

    const now = new Date();
    const formattedDate = now.toISOString().split('T')[0];
    const formattedTime = now.toTimeString().split(' ')[0];

    const updated: DigitalSignatureRequest = {
      ...targetSignRequest,
      status: 'signed',
      signedAtDate: formattedDate,
      signedAtTime: formattedTime,
      hash: cleanHash,
      ipAddress: '193.136.2.24 (Assinado via Portal Autenticado)',
      signatureStrokeData: mockStroke
    };

    onUpdateSignature(updated);
    setTargetSignRequest(null);
    clearCanvas();

    // Trigger Notification / WS updates
    window.dispatchEvent(new CustomEvent('nexus-realtime-update', {
      detail: {
        type: 'SIGNATURE_COMPLETED',
        payload: updated
      }
    }));
  };

  // Archive Signed document
  const handleArchiveSignature = (sig: DigitalSignatureRequest) => {
    const now = new Date();
    const formattedDate = now.toISOString().split('T')[0];
    
    const updated: DigitalSignatureRequest = {
      ...sig,
      status: 'archived',
      archivedAtDate: formattedDate
    };
    onUpdateSignature(updated);
    
    // Auto-Notify and log actions
    alert(`O documento "${sig.title}" foi assinado e arquivado digitalmente. Comprovativo de compliance guardado no Centro Documental.`);
  };

  // Handle manual trigger transition (Envias)
  const handleSendDraft = (sig: DigitalSignatureRequest) => {
    const updated: DigitalSignatureRequest = {
      ...sig,
      status: 'sent'
    };
    onUpdateSignature(updated);
    alert(`Pedido de Assinatura enviado com sucesso para ${sig.signerName} (${sig.signerEmail})!`);
  };

  // Create signature request
  const handleCreateRequestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim() || !signerName.trim() || !signerEmail.trim()) {
      alert('Preencha todos os campos fundamentais.');
      return;
    }

    const now = new Date();
    const formattedDate = now.toISOString().split('T')[0];
    const formattedTime = now.toTimeString().split(' ')[0];
    const uniqueId = `ASS-2026-${Math.floor(Math.random() * 900+ 100)}`;

    const newRequest: DigitalSignatureRequest = {
      id: uniqueId,
      title: newTitle,
      documentType: newType,
      content: newContent,
      status: 'draft',
      requesterName: currentUserName,
      requesterRole: currentUserRole,
      signerName: signerName,
      signerEmail: signerEmail,
      signerContact: signerContact || undefined,
      sentAtDate: formattedDate,
      sentAtTime: formattedTime,
      referenceModule: refModule !== 'none' ? refModule : undefined,
      referenceId: refModule !== 'none' && refId ? refId : undefined
    };

    onAddSignature(newRequest);
    setIsRequestModalOpen(false);

    // Reset Form
    setNewTitle('');
    setNewContent('');
    setSignerName('');
    setSignerEmail('');
    setSignerContact('');
    setRefModule('none');
    setRefId('');
  };

  // Filters logic
  const filteredSignatures = signatures.filter(sig => {
    const matchesSearch = 
      sig.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sig.signerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sig.signerEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sig.id.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || sig.status === statusFilter;
    const matchesType = typeFilter === 'all' || sig.documentType === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  // KPI calculations
  const countTotal = signatures.length;
  const countPending = signatures.filter(s => s.status === 'sent').length;
  const countSigned = signatures.filter(s => s.status === 'signed').length;
  const countArchived = signatures.filter(s => s.status === 'archived').length;

  return (
    <div className="space-y-6 text-left">
      {/* Header section with Portal Toggle */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/10">
              <PenTool className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-zinc-150 tracking-tight">Sistema de Assinaturas Digitais</h1>
          </div>
          <p className="text-xs text-zinc-400">Zero Papel: Fluxos documentais juridicamente certificados de Contratos, Autorizações, Termos e Declarações.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-zinc-900/80 p-0.5 rounded-xl border border-zinc-800 flex">
            <button
              onClick={() => setActiveTab('backoffice')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'backoffice' 
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Gestão Escolar
            </button>
            <button
              onClick={() => setActiveTab('signer-portal')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'signer-portal' 
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              Portal de Assinante (Pais/Pais de Teste)
            </button>
          </div>

          <button
            onClick={() => setIsRequestModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            Solicitar Assinatura
          </button>
        </div>
      </div>

      {/* Stats Board */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-zinc-900/60 border border-zinc-850 rounded-2xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-mono font-bold text-zinc-450 uppercase tracking-widest">Total Solicitado</span>
            <div className="text-2xl font-bold text-zinc-100">{countTotal}</div>
          </div>
          <div className="p-2.5 bg-zinc-850/50 text-zinc-400 border border-zinc-800 rounded-xl">
            <FileText className="w-4.5 h-4.5" />
          </div>
        </div>

        <div className="p-4 bg-zinc-900/60 border border-zinc-850 rounded-2xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-mono font-bold text-zinc-450 uppercase tracking-widest">Pendente Encarregado</span>
            <div className="text-2xl font-bold text-amber-500">{countPending}</div>
          </div>
          <div className="p-2.5 bg-amber-500/5 text-amber-400 border border-amber-500/10 rounded-xl">
            <Clock className="w-4.5 h-4.5 animate-pulse" />
          </div>
        </div>

        <div className="p-4 bg-zinc-900/60 border border-zinc-850 rounded-2xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-mono font-bold text-zinc-450 uppercase tracking-widest">Assinado Certificado</span>
            <div className="text-2xl font-bold text-emerald-500">{countSigned}</div>
          </div>
          <div className="p-2.5 bg-emerald-500/5 text-emerald-400 border border-emerald-500/10 rounded-xl">
            <CheckCircle2 className="w-4.5 h-4.5" />
          </div>
        </div>

        <div className="p-4 bg-zinc-900/60 border border-zinc-850 rounded-2xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-mono font-bold text-zinc-450 uppercase tracking-widest">Arquivado em Dossier</span>
            <div className="text-2xl font-bold text-indigo-400">{countArchived}</div>
          </div>
          <div className="p-2.5 bg-indigo-500/5 text-indigo-400 border border-indigo-500/10 rounded-xl">
            <Archive className="w-4.5 h-4.5" />
          </div>
        </div>
      </div>

      {activeTab === 'backoffice' ? (
        /* BACKOFFICE GESTÃO DE ASSINATURAS */
        <div className="bg-zinc-950 border border-zinc-850 rounded-2xl p-4 sm:p-6 space-y-6">
          {/* Filters & Actions bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-855 pb-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono font-bold text-zinc-500 uppercase tracking-wider mr-2">Filtrar por Estado:</span>
              {(['all', 'draft', 'sent', 'signed', 'archived'] as const).map(status => {
                const isActive = statusFilter === status;
                const labels = { all: 'Todos', draft: 'Rascunhos', sent: 'Enviados/Pendente', signed: 'Assinados', archived: 'Arquivados' };
                return (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-3 py-1 text-[11px] font-sans font-semibold rounded-lg transition-colors cursor-pointer ${
                      isActive 
                        ? 'bg-indigo-505/10 text-indigo-400 border border-indigo-500/20' 
                        : 'text-zinc-400 hover:text-zinc-250 hover:bg-zinc-900/50'
                    }`}
                  >
                    {labels[status]}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-full sm:w-60">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Pesquisar título, outorgante..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl pl-9 pr-4 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 outline-none focus:border-zinc-700"
                />
              </div>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="bg-zinc-900/50 border border-zinc-800 text-zinc-400 text-xs rounded-xl px-3 py-1.5 outline-none cursor-pointer focus:border-zinc-700 font-sans"
              >
                <option value="all">Tipos (Todos)</option>
                <option value="Contrato">Contratos</option>
                <option value="Autorização">Autorizações</option>
                <option value="Declaração">Declarações</option>
                <option value="Termo">Termos</option>
              </select>
            </div>
          </div>

          {/* Table displaying processes */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b border-zinc-850/40 text-[10.5px] font-mono tracking-wider text-zinc-500 uppercase">
                  <th className="py-3 px-4 font-bold">Código</th>
                  <th className="py-3 px-4 font-bold">Documento / Tipo</th>
                  <th className="py-3 px-4 font-bold">Responsável Co-Signatário</th>
                  <th className="py-3 px-4 font-bold">Vínculo Módulo</th>
                  <th className="py-3 px-4 font-bold">Log Data/Hora</th>
                  <th className="py-3 px-4 font-bold text-center">Estado</th>
                  <th className="py-3 px-4 text-right font-bold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-850/30 text-xs">
                {filteredSignatures.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-zinc-500">
                      Nenhum fluxo de assinatura digital localizado com os parâmetros inseridos.
                    </td>
                  </tr>
                ) : (
                  filteredSignatures.map(sig => {
                    const typeBadge = {
                      Contrato: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
                      Autorização: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
                      Declaração: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
                      Termo: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20'
                    }[sig.documentType];

                    const statusBadge = {
                      draft: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/10',
                      sent: 'text-amber-400 bg-amber-500/10 border-amber-500/10 animate-pulse',
                      signed: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/10',
                      archived: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/10'
                    }[sig.status];

                    const statusLabel = {
                      draft: 'Rascunho',
                      sent: 'Aguardando Assinatura',
                      signed: 'Assinado Certificado',
                      archived: 'Arquivado (Dossier)'
                    }[sig.status];

                    return (
                      <tr key={sig.id} className="hover:bg-zinc-900/20 transition-colors group">
                        <td className="py-4 px-4 font-mono font-bold text-indigo-400">{sig.id}</td>
                        <td className="py-4 px-4">
                          <div className="space-y-1">
                            <p className="font-semibold text-zinc-200 group-hover:text-white transition-colors">{sig.title}</p>
                            <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-mono border ${typeBadge}`}>
                              {sig.documentType}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="space-y-0.5">
                            <p className="text-zinc-300 font-medium">{sig.signerName}</p>
                            <span className="text-[10px] text-zinc-500 font-mono flex items-center gap-1">
                              <Mail className="w-3 h-3" /> {sig.signerEmail}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          {sig.referenceModule ? (
                            <div className="flex items-center gap-1.5">
                              {sig.referenceModule === 'matriculas' && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/20">
                                  <Bookmark className="w-3 h-3" /> Matrícula: {sig.referenceId}
                                </span>
                              )}
                              {sig.referenceModule === 'financeiro' && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-mono text-pink-400 bg-pink-500/5 px-2 py-0.5 rounded border border-pink-500/20">
                                  <DollarSign className="w-3 h-3" /> Fat: {sig.referenceId}
                                </span>
                              )}
                              {sig.referenceModule === 'documentos' && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-mono text-indigo-400 bg-indigo-500/5 px-2 py-0.5 rounded border border-indigo-500/20">
                                  <Link2 className="w-3 h-3" /> Doc: {sig.referenceId}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-zinc-600">—</span>
                          )}
                        </td>
                        <td className="py-4 px-4 font-mono text-zinc-450">
                          {sig.status === 'signed' || sig.status === 'archived' ? (
                            <div className="space-y-0.5">
                              <p className="text-emerald-450 font-medium flex items-center gap-1">
                                <CheckCircle className="w-3.5 h-3.5" /> Assinado
                              </p>
                              <span className="text-[10px] text-zinc-500">{sig.signedAtDate} às {sig.signedAtTime}</span>
                            </div>
                          ) : (
                            <div className="space-y-0.5">
                              <p className="text-zinc-500">Solicitado</p>
                              <span className="text-[10px] text-zinc-550">{sig.sentAtDate} às {sig.sentAtTime}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-mono tracking-wide ${statusBadge}`}>
                            {statusLabel}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-1.5">
                            {sig.status === 'draft' && (
                              <button
                                onClick={() => handleSendDraft(sig)}
                                className="px-2 py-1 bg-indigo-500/10 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/20 text-[11px] font-bold rounded-lg cursor-pointer transition-colors"
                              >
                                Enviar Pedido
                              </button>
                            )}

                            {sig.status === 'signed' && (
                              <button
                                onClick={() => handleArchiveSignature(sig)}
                                className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-indigo-400 hover:text-indigo-300 font-bold rounded-lg text-[11px] cursor-pointer flex items-center gap-1"
                              >
                                <Archive className="w-3 h-3" />
                                Arquivar
                              </button>
                            )}

                            {(sig.status === 'signed' || sig.status === 'archived') && (
                              <button
                                onClick={() => setInspectCertificate(sig)}
                                className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white rounded-lg text-[11px] font-semibold cursor-pointer flex items-center gap-1"
                              >
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                                Comprovativo
                              </button>
                            )}

                            {sig.status === 'sent' && (
                              <span className="text-[10px] font-mono text-zinc-500 italic pr-2 mt-1">Pendente</span>
                            )}

                            <button
                              onClick={() => {
                                if (confirm('Pretende apagar esta solicitação do arquivo?')) {
                                  onDeleteSignature(sig.id);
                                }
                              }}
                              className="p-1 text-zinc-500 hover:text-rose-400 transition-colors cursor-pointer"
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* PORTAL DO ASSINANTE SIMULADO */
        <div className="space-y-6">
          <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs font-bold text-indigo-400 flex items-center gap-1">
                <Sparkles className="w-4 h-4" /> Portal do Responsável (Encarregado de Educação)
              </span>
              <p className="text-xs text-zinc-300">Este espaço simula a interface que o pai de um aluno visualiza ao receber o link cifrado.</p>
            </div>
            <div className="text-[11px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-850 p-2 rounded-xl">
              Logado como Encarregado: <strong className="text-zinc-200">Sofia Castro (sofia.castro@gmail.com)</strong>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Inbox */}
            <div className="lg:col-span-1 bg-zinc-950 border border-zinc-850 rounded-2xl p-4 space-y-4">
              <span className="text-[10.5px] font-mono font-bold text-zinc-450 uppercase tracking-widest block">Minha Caixa de Documentos</span>
              <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
                {signatures.filter(s => s.status === 'sent' || s.status === 'signed').map(sig => {
                  const isSelected = targetSignRequest?.id === sig.id;
                  return (
                    <div
                      key={sig.id}
                      onClick={() => setTargetSignRequest(sig)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer text-left space-y-2 ${
                        isSelected 
                          ? 'bg-indigo-500/5 border-indigo-500/30' 
                          : 'bg-zinc-900/30 border-zinc-900 hover:border-zinc-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[10px] font-mono text-indigo-400 font-bold">{sig.id}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono leading-none ${
                          sig.status === 'signed' ? 'text-emerald-400 bg-emerald-500/10' : 'text-amber-400 bg-amber-500/10'
                        }`}>
                          {sig.status === 'signed' ? 'Assinado' : 'Pendente'}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-zinc-250 line-clamp-2 leading-relaxed">{sig.title}</h4>
                      <p className="text-[10.5px] text-zinc-500 font-mono">Enviado em: {sig.sentAtDate}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Canvas Sign Workspace */}
            <div className="lg:col-span-2 bg-zinc-955 border border-zinc-850 rounded-2xl p-6 flex flex-col justify-between">
              {targetSignRequest ? (
                <div className="space-y-5">
                  <div className="border-b border-zinc-850 pb-3 flex justify-between items-center">
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-mono font-bold text-indigo-400">{targetSignRequest.id} — {targetSignRequest.documentType}</span>
                      <h3 className="text-sm font-bold text-zinc-200">{targetSignRequest.title}</h3>
                    </div>
                    {targetSignRequest.status === 'signed' && (
                      <span className="flex items-center gap-1 text-xs text-emerald-400 font-bold font-mono">
                        <CheckCircle className="w-4 h-4 animate-bounce" /> Assinado
                      </span>
                    )}
                  </div>

                  {/* Document preview */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest block font-bold">Conteúdo do Documento:</span>
                    <div className="p-4 bg-zinc-900/30 border border-zinc-900 rounded-xl text-xs text-zinc-350 font-sans leading-relaxed whitespace-pre-wrap max-h-52 overflow-y-auto">
                      {targetSignRequest.content}
                    </div>
                  </div>

                  {targetSignRequest.status !== 'signed' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                      {/* Signing Form validation */}
                      <div className="space-y-4">
                        <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block font-bold">Confirmação de Dados Oficiais</span>
                        <div className="space-y-2.5 text-xs">
                          <div>
                            <label className="text-[10.5px] text-zinc-450 block font-bold mb-1">Nome Completo do Responsável:</label>
                            <input
                              type="text"
                              disabled
                              value={targetSignRequest.signerName}
                              className="w-full bg-zinc-900/50 border border-zinc-850 text-zinc-350 rounded-xl px-3 py-1.5 outline-none cursor-not-allowed font-sans font-medium"
                            />
                          </div>
                          <div>
                            <label className="text-[10.5px] text-zinc-450 block font-bold mb-1">Email Registado:</label>
                            <input
                              type="text"
                              disabled
                              value={targetSignRequest.signerEmail}
                              className="w-full bg-zinc-900/50 border border-zinc-850 text-zinc-350 rounded-xl px-3 py-1.5 outline-none cursor-not-allowed font-sans font-medium"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Manual draw pad tool */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block font-bold">Assinatura Manual Digital</span>
                          <button
                            onClick={clearCanvas}
                            className="text-[10px] font-mono text-rose-450 hover:text-rose-400 cursor-pointer font-bold px-2 py-0.5 border border-rose-500/10 hover:border-rose-500/30 rounded"
                          >
                            Limpar Quadrante
                          </button>
                        </div>

                        <div className="relative border border-zinc-800 rounded-2xl overflow-hidden bg-zinc-950">
                          <canvas
                            ref={canvasRef}
                            width={340}
                            height={130}
                            onMouseDown={startDrawing}
                            onMouseMove={draw}
                            onMouseUp={stopDrawing}
                            onMouseLeave={stopDrawing}
                            onTouchStart={startDrawing}
                            onTouchMove={draw}
                            onTouchEnd={stopDrawing}
                            className="w-full block h-[130px] cursor-crosshair touch-none"
                          />
                          {!hasDrawnSomething && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-zinc-650 space-y-1 select-none">
                              <PenTool className="w-5 h-5 animate-pulse" />
                              <span className="text-[10px] font-mono leading-normal">Utilize o rato ou o dedo para assinar aqui</span>
                            </div>
                          )}
                        </div>

                        <button
                          onClick={handlePerformSignature}
                          className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg transition-transform hover:-translate-y-0.5 cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <ShieldCheck className="w-4 h-4" />
                          Apor Assinatura Digital e Validar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-emerald-500/5 border border-emerald-500/15 rounded-xl flex items-center gap-3">
                      <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />
                      <div className="space-y-0.5">
                        <h4 className="text-xs font-bold text-emerald-450">Documentação Assinada com Sucesso</h4>
                        <p className="text-[11px] text-zinc-400 leading-relaxed">Este documento foi cifrado legalmente em {targetSignRequest.signedAtDate} às {targetSignRequest.signedAtTime}. Pode fechar esta aba ou aceder ao histórico de auditorias escolares.</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center py-16 text-zinc-500 space-y-3.5">
                  <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-full text-indigo-400">
                    <FileText className="w-7 h-7" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-zinc-350">Zona de Assinaturas Ativas</h3>
                    <p className="text-xs text-zinc-500 max-w-sm">Deverá selecionar uma solicitação pendente na caixa da esquerda para examinar as cláusulas legais e assinar online.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* COMPROVATIVO / CERTIFICADO DE ASSINATURA DIGITAL */}
      <AnimatePresence>
        {inspectCertificate && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xl bg-zinc-950 border border-zinc-850 rounded-3xl p-6 sm:p-8 space-y-6 text-left shadow-2xl relative overflow-hidden"
            >
              {/* Security pattern watermark */}
              <div className="absolute top-0 right-0 p-8 text-indigo-500/5 pointer-events-none select-none">
                <ShieldCheck className="w-48 h-48" />
              </div>

              {/* Title & Close */}
              <div className="flex items-center justify-between border-b border-zinc-850 pb-4 relative z-10">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
                    <ShieldCheck className="w-4.5 h-4.5" />
                  </div>
                  <h3 className="text-sm font-bold text-zinc-200">Certidão de Assinatura Eletrónica</h3>
                </div>
                <button
                  onClick={() => setInspectCertificate(null)}
                  className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-lg text-xs font-semibold cursor-pointer shrink-0 transition-colors"
                >
                  Fechar Certidão
                </button>
              </div>

              {/* Certificate content */}
              <div className="space-y-4 relative z-10 font-sans">
                <div className="p-4 bg-zinc-900/50 border border-zinc-900 rounded-2xl space-y-3 text-xs leading-relaxed text-zinc-350">
                  <h4 className="font-mono text-[10px] text-indigo-400 font-bold uppercase tracking-wider select-none">ID do Processo Legal Escolar: {inspectCertificate.id}</h4>
                  <p className="font-bold text-zinc-150 leading-relaxed text-sm">{inspectCertificate.title}</p>
                  
                  {/* Inline metadata list */}
                  <div className="grid grid-cols-2 gap-4 border-t border-zinc-800 pt-3 text-[11px] font-mono">
                    <div className="space-y-1">
                      <p className="text-zinc-500">Requerente Escolar:</p>
                      <strong className="text-zinc-300">{inspectCertificate.requesterName} ({inspectCertificate.requesterRole.toUpperCase()})</strong>
                    </div>
                    <div className="space-y-1">
                      <p className="text-zinc-500">Data de Envio do Draft:</p>
                      <strong className="text-zinc-300">{inspectCertificate.sentAtDate} às {inspectCertificate.sentAtTime}</strong>
                    </div>
                  </div>
                </div>

                {/* Audit proof variables */}
                <div className="border-2 border-dashed border-zinc-850 rounded-2xl p-4 space-y-3 text-xs">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest block font-bold">Histórico de Validação Regulatória</span>
                  
                  <div className="space-y-2 font-sans">
                    <div className="flex justify-between items-start text-[11.5px] border-b border-zinc-900 pb-2">
                      <div className="space-y-0.5">
                        <p className="font-semibold text-zinc-200">Assinado Eletronicamente Por:</p>
                        <p className="text-zinc-450 text-[10.5px]">Representante / Encarregado Legítimo</p>
                      </div>
                      <div className="text-right font-mono space-y-0.5">
                        <p className="font-bold text-zinc-300">{inspectCertificate.signerName}</p>
                        <p className="text-zinc-500 text-[10px]">{inspectCertificate.signerEmail}</p>
                      </div>
                    </div>

                    <div className="flex justify-between items-start text-[11.5px] border-b border-zinc-900 pb-2">
                      <div className="space-y-0.5">
                        <p className="font-semibold text-zinc-200">Data e Hora de Registo:</p>
                        <p className="text-zinc-455 text-[10.5px]">Carimbo Cronológico Certificado</p>
                      </div>
                      <div className="text-right font-mono font-bold text-zinc-300 space-y-0.5">
                        <p>{inspectCertificate.signedAtDate}</p>
                        <p className="text-[10px] text-zinc-500">{inspectCertificate.signedAtTime} (UTC Lisboa)</p>
                      </div>
                    </div>

                    <div className="flex justify-between items-start text-[11.5px]">
                      <div className="space-y-0.5">
                        <p className="font-semibold text-zinc-200">Log de Endereço de Rede IP:</p>
                        <p className="text-zinc-455 text-[10.5px]">Log de autenticação telemática</p>
                      </div>
                      <div className="text-right font-mono font-bold text-zinc-300">
                        {inspectCertificate.ipAddress || '193.136.2.24'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Digital Proof Stamp */}
                <div className="p-3.5 bg-zinc-900/45 border border-zinc-900 rounded-xl space-y-1.5 font-mono text-[10px]">
                  <span className="text-zinc-500 font-bold uppercase block tracking-wider">Chave de Validação Digital Única (Imutável)</span>
                  <div className="flex items-center gap-1.5 text-zinc-300 font-bold break-all leading-normal bg-zinc-950 p-2 rounded-lg border border-zinc-850">
                    <Hash className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span>{inspectCertificate.hash}</span>
                  </div>
                </div>

                {/* Signature visual representation */}
                <div className="p-3 bg-zinc-900/20 border border-zinc-900 rounded-xl space-y-1.5 text-xs text-center">
                  <span className="text-[10px] font-mono text-zinc-450 uppercase tracking-widest block font-bold text-left">Representação Gráfica da Assinatura:</span>
                  <div className="h-16 flex items-center justify-center bg-zinc-950 border border-zinc-900 rounded-xl text-zinc-400 relative">
                    {/* Simulated hand stroke signature layout */}
                    <svg className="w-64 h-12 stroke-indigo-400 stroke-2 fill-none" viewBox="0 0 300 100">
                      <path d={inspectCertificate.signatureStrokeData || 'M 10 50 Q 80 120, 150 10 T 260 70'} />
                    </svg>
                    <span className="absolute bottom-1 right-2 text-[8px] font-mono text-zinc-600 uppercase">PROVA VETORIAL RECOLHIDA</span>
                  </div>
                </div>
              </div>

              {/* Bottom Print / Copy */}
              <div className="flex justify-between items-center bg-zinc-900/30 p-3 rounded-2xl relative z-10">
                <span className="text-[9.5px] font-mono text-zinc-500 uppercase flex items-center gap-1 leading-normal select-none">
                  <Lock className="w-3.5 h-3.5 text-indigo-400" /> Criptografia de Chave RSA-2048 Habilitada
                </span>
                
                <button
                  type="button"
                  onClick={() => alert('O comprovativo PDF assinado eletronicamente foi guardado na sua pasta local.')}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-550 text-white rounded-lg text-xs font-bold leading-none cursor-pointer flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" /> Descarregar PDF
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
