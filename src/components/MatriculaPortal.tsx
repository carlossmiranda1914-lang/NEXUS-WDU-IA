import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Upload, 
  Search, 
  CheckCircle, 
  AlertCircle, 
  PlusCircle, 
  UserCheck, 
  FileDigit, 
  User, 
  Check, 
  ArrowRight, 
  Sparkles, 
  Trash2, 
  FileCheck,
  Briefcase,
  IdCard,
  ShieldCheck,
  X
} from 'lucide-react';
import { Student } from '../types';

interface MatriculaPortalProps {
  students: Student[];
  onAddStudent: (newStudentData: Omit<Student, 'id'>) => void;
  onUpdateStudent: (id: string, updatedFields: Partial<Student>) => void;
  availableClasses?: string[];
}

interface StagedFile {
  docType: string;
  name: string;
  size: string;
  fileObject?: File;
}

export default function MatriculaPortal({ 
  students, 
  onAddStudent, 
  onUpdateStudent, 
  availableClasses = ['8º Ano A', '8º Ano B', '9º Ano A', '10º Ano A', '11º Ano A', '12º Ano A'] 
}: MatriculaPortalProps) {
  const [activeSubTab, setActiveSubTab] = useState<'new-enrollment' | 'existing-student'>('new-enrollment');
  const [successState, setSuccessState] = useState<{
    show: boolean;
    studentName: string;
    studentId?: string;
    assignedClass: string;
    isNew: boolean;
    documentsSubmitted: string[];
  } | null>(null);

  // --- NEW ENROLLMENT STATE ---
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentClass, setNewStudentClass] = useState(availableClasses[0]);
  const [newGuardianName, setNewGuardianName] = useState('');
  const [newGuardianContact, setNewGuardianContact] = useState('');
  const [birthDate, setBirthDate] = useState('2012-06-12');
  const [initialFees, setNewInitialFees] = useState(240);
  
  // Track staged files for the 4 primary Portuguese school enrollment documents
  const [stagedFiles, setStagedFiles] = useState<Record<string, StagedFile>>({});
  const [dragActiveDocType, setDragActiveDocType] = useState<string | null>(null);

  // --- EXISTING STUDENT STATE ---
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedExistingFiles, setSelectedExistingFiles] = useState<Record<string, StagedFile>>({});

  const selectedStudent = students.find(s => s.id === selectedStudentId);

  // Primary required official documents
  const REQUIRED_DOCS = [
    { key: 'contrato', name: 'Contrato de Matrícula', icon: FileText, desc: 'Contrato assinado pelo Encarregado de Educação.' },
    { key: 'cc_aluno', name: 'CC do Aluno', icon: IdCard, desc: 'Cartão de Cidadão do estudante (Frente/Verso).' },
    { key: 'boletim_vacinas', name: 'Boletim de Vacinas', icon: ShieldCheck, desc: 'Boletim de saúde / vacinas atualizado.' },
    { key: 'cc_responsavel', name: 'CC do Responsável', icon: UserCheck, desc: 'Cartão de Cidadão do Encarregado de Educação.' }
  ];

  // Drag and Drop handlers
  const handleDrag = (e: React.DragEvent, docType: string, isOver: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    if (isOver) {
      setDragActiveDocType(docType);
    } else {
      setDragActiveDocType(null);
    }
  };

  const handleDrop = (e: React.DragEvent, docType: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActiveDocType(null);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const sizeKB = Math.round(file.size / 1024);
      const sizeFormatted = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB} KB`;
      
      if (activeSubTab === 'new-enrollment') {
        setStagedFiles(prev => ({
          ...prev,
          [docType]: { docType, name: file.name, size: sizeFormatted, fileObject: file }
        }));
      } else {
        setSelectedExistingFiles(prev => ({
          ...prev,
          [docType]: { docType, name: file.name, size: sizeFormatted, fileObject: file }
        }));
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, docType: string) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const sizeKB = Math.round(file.size / 1024);
      const sizeFormatted = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB} KB`;

      if (activeSubTab === 'new-enrollment') {
        setStagedFiles(prev => ({
          ...prev,
          [docType]: { docType, name: file.name, size: sizeFormatted, fileObject: file }
        }));
      } else {
        setSelectedExistingFiles(prev => ({
          ...prev,
          [docType]: { docType, name: file.name, size: sizeFormatted, fileObject: file }
        }));
      }
    }
  };

  const removeStagedFile = (docType: string) => {
    if (activeSubTab === 'new-enrollment') {
      setStagedFiles(prev => {
        const next = { ...prev };
        delete next[docType];
        return next;
      });
    } else {
      setSelectedExistingFiles(prev => {
        const next = { ...prev };
        delete next[docType];
        return next;
      });
    }
  };

  // Handle New Enrollment submission
  const handleNewEnrollmentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim() || !newGuardianName.trim()) return;

    // Compile list of documents
    const docList = REQUIRED_DOCS.map(reqDoc => {
      const isUploaded = !!stagedFiles[reqDoc.key];
      return {
        name: reqDoc.name,
        submitted: isUploaded,
        date: isUploaded ? new Date().toISOString().split('T')[0] : 'Pendente'
      };
    });

    const studentToCreate = {
      name: newStudentName,
      class: newStudentClass,
      attendanceRate: 100,
      averageGrade: 8.5, // Standard baseline
      status: 'active' as const,
      outstandingFees: initialFees,
      guardiansName: newGuardianName,
      guardiansContact: newGuardianContact,
      behaviorDegree: 'Excelente' as const,
      documents: docList,
      behaviorHistory: [
        {
          date: new Date().toISOString().split('T')[0],
          note: 'Matrícula efetuada diretamente via Portal Digital de Matrículas.',
          categoryDefault: 'Geral'
        }
      ],
      grades: [
        { subject: 'Português', score: 8.5 },
        { subject: 'Matemática', score: 8.0 },
        { subject: 'Inglês', score: 9.0 }
      ]
    };

    onAddStudent(studentToCreate);

    // Get the newly assigned ID from the list (which will be populated on next updates, for show we generate ALU-xxx)
    const mockCreatedID = `ALU-${Math.floor(106 + Math.random() * 900)}`;

    setSuccessState({
      show: true,
      studentName: newStudentName,
      studentId: mockCreatedID,
      assignedClass: newStudentClass,
      isNew: true,
      documentsSubmitted: docList.filter(d => d.submitted).map(d => d.name)
    });

    // Reset fields
    setNewStudentName('');
    setNewGuardianName('');
    setNewGuardianContact('');
    setStagedFiles({});
  };

  // Handle Updates to an Existing Student
  const handleExistingUpdateSubmit = () => {
    if (!selectedStudent) return;

    // Map existing student sheets and merge with newly uploaded files
    const updatedDocs = (selectedStudent.documents || []).map(existingDoc => {
      // Find matching upload key
      const reqMatch = REQUIRED_DOCS.find(r => r.name === existingDoc.name);
      if (reqMatch && selectedExistingFiles[reqMatch.key]) {
        return {
          ...existingDoc,
          submitted: true,
          date: new Date().toISOString().split('T')[0]
        };
      }
      return existingDoc;
    });

    // Handle any entirely new arbitrary documents uploaded through the existing file triggers
    const newlyAddedKeys = Object.keys(selectedExistingFiles).filter(key => {
      const matchDoc = REQUIRED_DOCS.find(r => r.key === key);
      return matchDoc && !selectedStudent.documents?.some(d => d.name === matchDoc.name);
    });

    newlyAddedKeys.forEach(key => {
      const matchDoc = REQUIRED_DOCS.find(r => r.key === key);
      if (matchDoc) {
        updatedDocs.push({
          name: matchDoc.name,
          submitted: true,
          date: new Date().toISOString().split('T')[0]
        });
      }
    });

    onUpdateStudent(selectedStudent.id, { documents: updatedDocs });

    setSuccessState({
      show: true,
      studentName: selectedStudent.name,
      studentId: selectedStudent.id,
      assignedClass: selectedStudent.class,
      isNew: false,
      documentsSubmitted: Object.keys(selectedExistingFiles).map(k => REQUIRED_DOCS.find(r => r.key === k)?.name || '')
    });

    setSelectedExistingFiles({});
  };

  // Filter existing student list for directory searching
  const searchedStudents = students.filter(student => {
    if (!searchQuery.trim()) return false;
    const normSearch = searchQuery.toLowerCase();
    return (
      student.name.toLowerCase().includes(normSearch) || 
      student.id.toLowerCase().includes(normSearch) ||
      student.class.toLowerCase().includes(normSearch)
    );
  });

  return (
    <div className="space-y-6">
      {/* Intro Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-emerald-400 font-mono tracking-wider uppercase mb-1.5 font-bold">
            <Sparkles className="w-3.5 h-3.5" /> Portal de Serviços Educativos
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-sans">
            Portal Digital de Matrículas <span className="text-emerald-400">Nexus</span>
          </h1>
          <p className="text-xs text-zinc-400 max-w-xl leading-relaxed mt-1">
            Plataforma única e digital para a formalização de novas candidaturas, submissão de documentação de apoio legal (C.C., Boletins) e atualização periódica de dados das fichas do corpo discente.
          </p>
        </div>
        
        {/* Toggle between Sub Tabs */}
        <div className="bg-zinc-900 border border-white/5 rounded-xl p-1 flex gap-1 self-stretch md:self-auto shadow-inner">
          <button
            onClick={() => {
              setActiveSubTab('new-enrollment');
              setSelectedStudentId(null);
            }}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeSubTab === 'new-enrollment'
                ? 'bg-emerald-500 text-zinc-950 shadow-md font-bold'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Nova Matrícula
          </button>
          <button
            onClick={() => {
              setActiveSubTab('existing-student');
              setStagedFiles({});
            }}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeSubTab === 'existing-student'
                ? 'bg-emerald-500 text-zinc-950 shadow-md font-bold'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            Aluno Existente
          </button>
        </div>
      </div>

      {/* SUCCESS SCREEN STATE VIEW */}
      <AnimatePresence mode="wait">
        {successState && successState.show && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-zinc-900 border-2 border-emerald-500/25 rounded-2xl p-8 text-center max-w-xl mx-auto space-y-6 shadow-2xl shadow-emerald-505/5"
          >
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto text-emerald-400">
              <Check className="w-8 h-8 stroke-[3]" />
            </div>

            <div className="space-y-2">
              <span className="text-[10px] font-bold tracking-widest text-emerald-400 uppercase font-mono px-2 py-0.5 bg-emerald-500/10 rounded-full">
                {successState.isNew ? 'Inscrição Inicial Processada' : 'Ficha de Aluno Atualizada'}
              </span>
              <h2 className="text-xl font-bold text-white tracking-tight">
                {successState.isNew ? 'Matrícula Submetida com Sucesso!' : 'Documentos Associados com Sucesso!'}
              </h2>
              <p className="text-xs text-zinc-400 leading-relaxed px-4">
                {successState.isNew 
                  ? 'Os dados do novo estudante foram registados na cache de estado do Nexus e sincronizados com a ficha escolar permanente.' 
                  : 'Os novos documentos digitais foram anexados à ficha do estudante e estão visíveis para aprovação da secretaria escolar.'}
              </p>
            </div>

            {/* Receipt Summary Card */}
            <div className="bg-zinc-950 p-4 border border-zinc-800 rounded-xl text-left space-y-2.5 font-mono text-[11px] text-zinc-400">
              <div className="flex justify-between border-b border-zinc-850 pb-1.5">
                <span>ESTUDANTE:</span>
                <span className="font-bold text-white">{successState.studentName}</span>
              </div>
              <div className="flex justify-between border-b border-zinc-850 pb-1.5">
                <span>ID REGISTRO:</span>
                <span className="text-zinc-200">{successState.studentId || 'A ser gerado pela API'}</span>
              </div>
              <div className="flex justify-between border-b border-zinc-850 pb-1.5">
                <span>TURMA / ANO ATO:</span>
                <span className="text-zinc-200">{successState.assignedClass}</span>
              </div>
              <div className="space-y-1">
                <span>DOCUMENTOS CARREGADOS IN-SITU:</span>
                {successState.documentsSubmitted.length === 0 ? (
                  <p className="text-rose-455 text-[10px] leading-relaxed italic">Nenhum documento anexado (Pendente).</p>
                ) : (
                  <div className="flex flex-wrap gap-1 pt-1.5">
                    {successState.documentsSubmitted.map((docName, idx) => (
                      <span key={idx} className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 px-2 py-0.5 rounded">
                        ✓ {docName}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 justify-center pt-2">
              <button
                onClick={() => setSuccessState(null)}
                className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs px-5 py-2.5 rounded-lg transition-colors cursor-pointer"
              >
                Voltar ao Portal
              </button>
            </div>
          </motion.div>
        )}

        {/* WORKFLOW 1: NEW ENROLLMENT */}
        {(!successState || !successState.show) && activeSubTab === 'new-enrollment' && (
          <motion.form
            onSubmit={handleNewEnrollmentSubmit}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
          >
            {/* Left Column: Form Fields */}
            <div className="lg:col-span-5 bg-zinc-900 border border-white/5 rounded-2xl p-6 space-y-5">
              <div className="border-b border-white/5 pb-3">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <User className="w-4 h-4 text-emerald-400" /> Dados Cadastrais do Estudante
                </h2>
                <p className="text-[11px] text-zinc-500 mt-0.5">Introduza as informações fundamentais para a abertura da ficha letiva.</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono text-zinc-400 font-semibold">Nome Completo do Aluno</label>
                  <input
                    type="text"
                    required
                    value={newStudentName}
                    onChange={(e) => setNewStudentName(e.target.value)}
                    placeholder="Ex: Diogo Antunes de Sousa"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 outline-none focus:border-emerald-500 transition-all font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-mono text-zinc-400 font-semibold">Turma Letiva Pretendida</label>
                    <select
                      value={newStudentClass}
                      onChange={(e) => setNewStudentClass(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 outline-none focus:border-emerald-500 cursor-pointer transition-all font-medium appearance-none"
                    >
                      {availableClasses.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-mono text-zinc-400 font-semibold">Data de Nascimento</label>
                    <input
                      type="date"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 outline-none focus:border-emerald-500 transition-all font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono text-zinc-400 font-semibold">Nome do Encarregado de Educação</label>
                  <input
                    type="text"
                    required
                    value={newGuardianName}
                    onChange={(e) => setNewGuardianName(e.target.value)}
                    placeholder="Ex: Mariana Antunes de Sousa"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 outline-none focus:border-emerald-500 transition-all font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono text-zinc-400 font-semibold">Contacto do Responsável (Telefone/Email)</label>
                  <input
                    type="text"
                    required
                    value={newGuardianContact}
                    onChange={(e) => setNewGuardianContact(e.target.value)}
                    placeholder="Ex: mariana.sousa@gmail.com ou +351 912 345 678"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 outline-none focus:border-emerald-500 transition-all font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono text-zinc-400 font-semibold">Propina / Inscrição Inicial (€)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 font-medium font-mono">€</span>
                    <input
                      type="number"
                      min="0"
                      value={initialFees}
                      onChange={(e) => setNewInitialFees(Number(e.target.value))}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-7 pr-3 py-2 text-xs text-zinc-100 outline-none focus:border-emerald-500 transition-all font-mono"
                    />
                  </div>
                  <p className="text-[9px] text-zinc-500 leading-normal">Fatura simplificada correspondente a emolumentos e taxas iniciais de seguros escolares.</p>
                </div>
              </div>

              <div className="pt-3 border-t border-white/5">
                <button
                  type="submit"
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs py-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  Submeter Matrícula & Criar Aluno
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Right Column: Digital Files Submission */}
            <div className="lg:col-span-7 bg-zinc-900 border border-white/5 rounded-2xl p-6 space-y-6">
              <div className="border-b border-white/5 pb-3">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-400" /> Upload de Documentação Obrigatória
                </h2>
                <p className="text-[11px] text-zinc-500 mt-0.5">Carregue ou arraste os comprovativos requeridos para auditoria legal imediata.</p>
              </div>

              {/* Grid of the 4 key documents */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {REQUIRED_DOCS.map(doc => {
                  const stagedFile = stagedFiles[doc.key];
                  const Icon = doc.icon;
                  const isDragOver = dragActiveDocType === doc.key;

                  return (
                    <div 
                      key={doc.key}
                      onDragOver={(e) => handleDrag(e, doc.key, true)}
                      onDragLeave={(e) => handleDrag(e, doc.key, false)}
                      onDrop={(e) => handleDrop(e, doc.key)}
                      className={`border border-dashed rounded-xl p-4 transition-all relative flex flex-col justify-between min-h-[145px] ${
                        stagedFile 
                          ? 'border-emerald-500/30 bg-emerald-500/5' 
                          : isDragOver
                          ? 'border-emerald-400 bg-emerald-500/10 scale-[1.01]'
                          : 'border-zinc-800 hover:border-zinc-700 bg-zinc-950/20 hover:bg-zinc-950/40'
                      }`}
                    >
                      {/* File input layer */}
                      <input
                        type="file"
                        onChange={(e) => handleFileSelect(e, doc.key)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className={`p-2 rounded-lg border ${
                            stagedFile 
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                              : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                          }`}>
                            <Icon className="w-4 h-4" />
                          </span>
                          
                          {/* Indicator badge */}
                          {stagedFile ? (
                            <span className="text-[9px] bg-emerald-500 text-zinc-950 font-bold px-2 py-0.5 rounded"> Carregado </span>
                          ) : (
                            <span className="text-[9px] bg-zinc-800 text-zinc-500 font-semibold px-2 py-0.5 rounded font-mono">Pendente</span>
                          )}
                        </div>

                        <div>
                          <p className="text-xs font-semibold text-zinc-200">{doc.name}</p>
                          <p className="text-[10px] text-zinc-500 mt-0.5 leading-snug">{doc.desc}</p>
                        </div>
                      </div>

                      {/* Display staged file or help text */}
                      {stagedFile ? (
                        <div className="mt-3 bg-zinc-950 border border-zinc-850 rounded-lg p-2 flex items-center justify-between text-[10px] font-mono shrink-0 relative z-20">
                          <div className="flex items-center gap-2 truncate">
                            <FileCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                            <div className="truncate pr-1">
                              <p className="text-zinc-300 truncate font-semibold leading-tight">{stagedFile.name}</p>
                              <p className="text-zinc-650 text-[9px] leading-tight">{stagedFile.size}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeStagedFile(doc.key)}
                            className="p-1 text-zinc-500 hover:text-rose-400 rounded-md hover:bg-white/5 cursor-pointer shrink-0 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : doc.key === 'contrato' ? (
                        <div className="mt-3 text-[10px] bg-indigo-500/5 text-indigo-400 border border-indigo-500/10 p-2 rounded-lg flex items-center justify-between relative z-20 shrink-0 select-none">
                          <span className="font-semibold flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-indigo-400 shrink-0" /> Assinatura Digital Ativa</span>
                          <button
                            type="button"
                            onClick={() => {
                              alert('A gerir contrato digital... Redirecionando para as Assinaturas Eletrónicas.');
                              window.dispatchEvent(new CustomEvent('nexus-navigate-tab', { detail: 'signatures' }));
                            }}
                            className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-550 text-white rounded text-[9px] font-bold cursor-pointer transition-colors"
                          >
                            Ir Assinar
                          </button>
                        </div>
                      ) : (
                        <div className="mt-3 text-[10px] text-zinc-500 flex items-center gap-1">
                          <Upload className="w-3.5 h-3.5 text-zinc-600" />
                          <span>Clique ou arraste documento aqui</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* General Regulation Warnings */}
              <div className="bg-zinc-950 p-4 border border-zinc-850 rounded-xl space-y-2 flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <div className="text-[10px] text-zinc-500 leading-normal">
                  <p className="font-semibold text-zinc-300 mb-0.5">Segurança & RGPD (Proteção de Dados)</p>
                  <p>
                    A submissão de documentos segue protocolos de encriptação AES-256 e o Regulamento Geral de Proteção de Dados (RGPD). Ficheiros em falta podem comprometer a atribuição de seguros letivos regulamentares e a validação do número de turma institucional.
                  </p>
                </div>
              </div>
            </div>
          </motion.form>
        )}

        {/* WORKFLOW 2: EXISTING STUDENT FILE LINKS */}
        {(!successState || !successState.show) && activeSubTab === 'existing-student' && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="space-y-6"
          >
            {/* Search Top Grid */}
            <div className="bg-zinc-900 border border-white/5 rounded-2xl p-6">
              <div className="max-w-xl space-y-1.5">
                <label className="text-[10px] uppercase font-mono text-zinc-400 font-bold block">Pesquisar Ficha de Estudante Ativo</label>
                <div className="relative">
                  <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Introduza o Nome Inteiro, ID (Ex: ALU-103) ou Ano Escolar..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-9 py-2.5 text-xs text-zinc-100 outline-none focus:border-emerald-500 transition-all font-medium"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-zinc-500">Selecione uma ficha letiva ativa para carregar ou revisar documentos.</p>
              </div>

              {/* Search results picker panel */}
              {searchQuery && (
                <div className="mt-4 border border-zinc-850 rounded-xl divide-y divide-zinc-850 overflow-hidden bg-zinc-950 shadow-lg max-h-[190px] overflow-y-auto">
                  {searchedStudents.length === 0 ? (
                    <p className="p-4 text-xs text-zinc-500 italic text-center">Nenhum aluno encontrado correspondente.</p>
                  ) : (
                    searchedStudents.map(student => (
                      <button
                        key={student.id}
                        onClick={() => {
                          setSelectedStudentId(student.id);
                          setSearchQuery('');
                          setSelectedExistingFiles({});
                        }}
                        className={`w-full p-3.5 text-left text-xs text-zinc-300 hover:bg-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 cursor-pointer transition-colors ${
                          selectedStudentId === student.id ? 'bg-emerald-500/5 hover:bg-emerald-500/10' : ''
                        }`}
                      >
                        <div>
                          <p className="font-semibold text-white">{student.name}</p>
                          <p className="text-[10px] text-zinc-500 font-mono mt-0.5">Estudante ID: {student.id} • Responsável: {student.guardiansName}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] bg-zinc-800 text-zinc-300 font-semibold px-2.5 py-0.5 rounded font-mono">
                            {student.class}
                          </span>
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                            student.documents?.filter(d => d.submitted).length === student.documents?.length
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-rose-500/10 text-rose-400'
                          }`}>
                            Docs: {student.documents?.filter(d => d.submitted).length || 0}/{student.documents?.length || 0}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Split Panel showing current docs and uploader */}
            {selectedStudent ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* Visual Status List of current student records */}
                <div className="lg:col-span-4 bg-zinc-900 border border-white/5 rounded-2xl p-6 space-y-5">
                  <div className="border-b border-white/5 pb-3 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-white">Cadastros Atuais</h3>
                      <p className="text-[11px] text-zinc-500 mt-0.5">Documentação formal registada.</p>
                    </div>
                    <span className="text-[9px] font-mono uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 px-2.5 py-0.5 rounded-full font-bold">
                      {selectedStudent.id}
                    </span>
                  </div>

                  {/* Student Mini Profile Info */}
                  <div className="bg-zinc-950 p-3.5 border border-zinc-850 rounded-xl space-y-2">
                    <p className="text-xs font-semibold text-white">{selectedStudent.name}</p>
                    <div className="grid grid-cols-2 gap-2 text-[10px] text-zinc-500 font-mono leading-relaxed">
                      <div>
                        <span>ANO:</span> <span className="text-zinc-300 font-bold">{selectedStudent.class}</span>
                      </div>
                      <div>
                        <span>MENSALIDADE:</span> <span className="text-zinc-300 font-bold">€{selectedStudent.outstandingFees}</span>
                      </div>
                      <div className="col-span-2">
                        <span>RESPONSÁVEL:</span> <span className="text-zinc-305 truncate block">{selectedStudent.guardiansName}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <h4 className="text-[10px] uppercase font-mono text-zinc-550 font-bold">Estado do Dossiê Individual</h4>
                    
                    <div className="space-y-2">
                      {selectedStudent.documents?.map((doc, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2.5 bg-zinc-950/60 border border-zinc-850 rounded-lg text-xs">
                          <div className="flex items-center gap-2 truncate">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${doc.submitted ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
                            <span className={`truncate ${doc.submitted ? 'text-zinc-300' : 'text-zinc-500 font-medium'}`} title={doc.name}>
                              {doc.name}
                            </span>
                          </div>

                          <div className="text-right shrink-0">
                            {doc.submitted ? (
                              <span className="text-[9px] text-emerald-400 font-semibold font-mono bg-emerald-500/5 px-1.5 py-0.5 rounded border border-emerald-500/10">Valídado</span>
                            ) : (
                              <span className="text-[9px] text-amber-400 font-semibold font-mono bg-amber-500/5 px-1.5 py-0.5 rounded border border-amber-500/10">Falta</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* File Submissions Block for missing student sheets */}
                <div className="lg:col-span-8 bg-zinc-900 border border-white/5 rounded-2xl p-6 space-y-6">
                  <div className="border-b border-white/5 pb-3">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Upload className="w-4 h-4 text-emerald-400" /> Carregamento de Correções e Falhas
                    </h3>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Submeta ficheiros locais para validar itens em falta no dossiê legal.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {REQUIRED_DOCS.map(doc => {
                      const existingMatch = selectedStudent.documents?.find(d => d.name === doc.name);
                      const isStaged = !!selectedExistingFiles[doc.key];
                      const Icon = doc.icon;
                      const isDragOver = dragActiveDocType === doc.key;

                      return (
                        <div
                          key={doc.key}
                          onDragOver={(e) => handleDrag(e, doc.key, true)}
                          onDragLeave={(e) => handleDrag(e, doc.key, false)}
                          onDrop={(e) => handleDrop(e, doc.key)}
                          className={`border rounded-xl p-4 transition-all relative flex flex-col justify-between min-h-[145px] ${
                            existingMatch?.submitted 
                              ? 'border-emerald-500/15 bg-zinc-950/20 opacity-60' 
                              : isStaged 
                              ? 'border-emerald-400 bg-emerald-500/5' 
                              : isDragOver
                              ? 'border-emerald-400 bg-emerald-500/10 scale-[1.01]'
                              : 'border-dashed border-zinc-800 hover:border-zinc-750 bg-zinc-950/20'
                          }`}
                        >
                          {/* File input layer */}
                          {!existingMatch?.submitted && (
                            <input
                              type="file"
                              onChange={(e) => handleFileSelect(e, doc.key)}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                          )}

                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className={`p-2 rounded-lg border ${
                                existingMatch?.submitted 
                                  ? 'bg-zinc-900 border-zinc-800 text-zinc-650' 
                                  : isStaged 
                                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                                  : 'bg-zinc-900 border border-zinc-805 text-zinc-400'
                              }`}>
                                <Icon className="w-4 h-4" />
                              </span>

                              {existingMatch?.submitted ? (
                                <span className="text-[9px] bg-zinc-950 text-zinc-405 font-semibold px-2 py-0.5 rounded border border-zinc-850">Submetido</span>
                              ) : isStaged ? (
                                <span className="text-[9px] bg-emerald-500 text-zinc-955 font-bold px-2 py-0.5 rounded"> Carregado </span>
                              ) : (
                                <span className="text-[9px] bg-rose-500/10 text-rose-400 font-semibold px-2 py-0.5 rounded font-mono">Pendente</span>
                              )}
                            </div>

                            <div>
                              <p className="text-xs font-semibold text-zinc-200">{doc.name}</p>
                              <p className="text-[10px] text-zinc-500 mt-0.5 leading-snug">{doc.desc}</p>
                            </div>
                          </div>

                          {/* Action overlay / state display */}
                          {existingMatch?.submitted ? (
                            <div className="mt-3 text-[10px] text-emerald-400/80 font-mono font-medium flex items-center gap-1">
                              ✓ Documento aprovado em {existingMatch.date}
                            </div>
                          ) : isStaged ? (
                            <div className="mt-3 bg-zinc-950 border border-zinc-850 rounded-lg p-2 flex items-center justify-between text-[10px] font-mono shrink-0 relative z-20">
                              <div className="flex items-center gap-1.5 truncate">
                                <FileCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                <span className="text-zinc-300 truncate font-semibold leading-tight">{selectedExistingFiles[doc.key].name}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeStagedFile(doc.key)}
                                className="p-1 text-zinc-505 hover:text-rose-400 rounded-md hover:bg-white/5 cursor-pointer shrink-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : doc.key === 'contrato' ? (
                            <div className="mt-3 text-[10px] bg-indigo-500/5 text-indigo-400 border border-indigo-500/10 p-2 rounded-lg flex items-center justify-between relative z-20 shrink-0 select-none">
                              <span className="font-semibold flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-indigo-400 shrink-0" /> Assinatura Digital Ativa</span>
                              <button
                                type="button"
                                onClick={() => {
                                  alert('A gerir contrato digital... Redirecionando para as Assinaturas Eletrónicas.');
                                  window.dispatchEvent(new CustomEvent('nexus-navigate-tab', { detail: 'signatures' }));
                                }}
                                className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-550 text-white rounded text-[9px] font-bold cursor-pointer transition-colors"
                              >
                                Ir Assinar
                              </button>
                            </div>
                          ) : (
                            <div className="mt-3 text-[10px] text-zinc-500 flex items-center gap-1">
                              <Upload className="w-3.5 h-3.5 text-zinc-600" />
                              <span>Importar novo comprovativo</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Actions Bar for updates */}
                  <div className="pt-4 border-t border-white/5 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedStudentId(null)}
                      className="bg-zinc-800 hover:bg-zinc-750 text-zinc-300 font-semibold text-xs px-4 py-2.5 rounded-lg transition-colors cursor-pointer"
                    >
                      Alterar Aluno
                    </button>
                    <button
                      type="button"
                      onClick={handleExistingUpdateSubmit}
                      disabled={Object.keys(selectedExistingFiles).length === 0}
                      className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:hover:bg-emerald-500 text-zinc-950 font-bold text-xs px-5 py-2.5 rounded-lg transition-all cursor-pointer flex items-center gap-2"
                    >
                      Gravar Documentos Associados
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                </div>

              </div>
            ) : (
              <div className="bg-zinc-900 border border-white/5 rounded-2xl p-12 text-center text-zinc-400 flex flex-col items-center justify-center space-y-3">
                <div className="w-12 h-12 rounded-full border border-zinc-800 bg-zinc-950/40 flex items-center justify-center text-zinc-500 mb-2">
                  <UserCheck className="w-6 h-6 text-zinc-555" />
                </div>
                <h3 className="text-sm font-semibold text-zinc-350">Nenhum Estudante Selecionado</h3>
                <p className="text-xs text-zinc-500 max-w-sm leading-relaxed">
                  Utilize o campo de pesquisa superior para consultar o corpo letivo e vincular ficheiros comprobatórios a um discente específico.
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
