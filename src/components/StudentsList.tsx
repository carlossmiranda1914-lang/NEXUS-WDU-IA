import React, { useState, useEffect } from 'react';
import { Search, Filter, Plus, FileText, CheckCircle2, AlertCircle, Edit, User, Mail, DollarSign, Calendar, ArrowLeft, Trash2, Heart } from 'lucide-react';
import { Student, UserRole, Invoice } from '../types';
import { upsertLiveInvoice, cancelLiveInvoice } from '../supabaseClient';

function fuzzyMatches(text: string, query: string): boolean {
  if (!query) return true;
  const normText = text.toLowerCase();
  const normQuery = query.toLowerCase();
  if (normText.includes(normQuery)) return true;
  let qIdx = 0;
  let tIdx = 0;
  while (tIdx < normText.length && qIdx < normQuery.length) {
    if (normText[tIdx] === normQuery[qIdx]) qIdx++;
    tIdx++;
  }
  return qIdx === normQuery.length;
}

interface StudentsListProps {
  students: Student[];
  currentUserRole?: UserRole;
  onAddStudent: (student: Omit<Student, 'id'>) => void;
  onUpdateStudent: (id: string, updated: Partial<Student>) => void;
  onDeleteStudent: (id: string) => void;
  globalSearchTerm?: string;
  invoices?: Invoice[];
}

export default function StudentsList({ students, currentUserRole, onAddStudent, onUpdateStudent, onDeleteStudent, globalSearchTerm, invoices = [] }: StudentsListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');
  const [selectedBehavior, setSelectedBehavior] = useState('all');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Sorting and Pagination State
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [sortField, setSortField] = useState<keyof Student | 'outstandingFees'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Resizable columns for Students list
  const [stdColWidths, setStdColWidths] = useState<Record<string, number>>({
    name: 240,
    class: 130,
    grade: 140,
    attendance: 140,
    balance: 150,
    card: 110
  });

  const startStdResize = (field: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = stdColWidths[field] || 150;

    const doResize = (moveEvent: MouseEvent) => {
      const currentX = moveEvent.clientX;
      const newWidth = Math.max(75, startWidth + (currentX - startX));
      setStdColWidths(prev => ({ ...prev, [field]: newWidth }));
    };

    const stopResize = () => {
      document.removeEventListener('mousemove', doResize);
      document.removeEventListener('mouseup', stopResize);
    };

    document.addEventListener('mousemove', doResize);
    document.addEventListener('mouseup', stopResize);
  };

  // Financial temporary hooks
  const [tempPlan, setTempPlan] = useState('Mensal');
  const [tempScholarship, setTempScholarship] = useState('Nenhuma');
  const [tempNotes, setTempNotes] = useState('');

  const getFinancialFicha = (student: Student) => {
    const docs = Array.isArray(student.documents) ? student.documents : [];
    const ficha = docs.find(d => d.name === 'Ficha Financeira');
    return {
      paymentPlan: ficha?.paymentPlan || 'Mensal',
      scholarship: ficha?.scholarship || 'Nenhuma',
      discount: ficha?.discount || 0,
      financialNotes: ficha?.financialNotes || 'Perfil financeiro ativado automaticamente no ato da matrícula.',
      financialHistory: ficha?.financialHistory || []
    };
  };

  const handleSaveStudentFinancials = (paymentPlan: string, scholarship: string, discount: number, financialNotes: string) => {
    if (!selectedStudent) return;
    const originalDocs = Array.isArray(selectedStudent.documents) ? selectedStudent.documents : [];
    let exists = false;
    const updatedDocs = originalDocs.map(doc => {
      if (doc.name === 'Ficha Financeira') {
        exists = true;
        return {
          ...doc,
          paymentPlan,
          scholarship,
          discount,
          financialNotes
        };
      }
      return doc;
    });

    if (!exists) {
      updatedDocs.push({
        name: 'Ficha Financeira',
        submitted: true,
        date: new Date().toISOString().split('T')[0],
        paymentPlan,
        scholarship,
        discount,
        financialNotes,
        financialHistory: []
      });
    }

    // Update locally and save to Postgres
    onUpdateStudent(selectedStudent.id, { documents: updatedDocs });
    setSelectedStudent(prev => {
      if (!prev) return prev;
      return { ...prev, documents: updatedDocs };
    });
  };

  // Synchronize financial temp values when matching student profile is activated
  useEffect(() => {
    if (selectedStudent) {
      const ficha = getFinancialFicha(selectedStudent);
      setTempPlan(ficha.paymentPlan);
      setTempScholarship(ficha.scholarship);
      setTempNotes(ficha.financialNotes);
    }
  }, [selectedStudent?.id]);

  // Edit Profile form state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editClass, setEditClass] = useState('');
  const [editStatus, setEditStatus] = useState<'active' | 'inactive'>('active');
  const [editGuardiansName, setEditGuardiansName] = useState('');
  const [editGuardiansContact, setEditGuardiansContact] = useState('');

  // Form State
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newClass, setNewClass] = useState('9º Ano A');
  const [newGuardiansName, setNewGuardiansName] = useState('');
  const [newGuardiansContact, setNewGuardiansContact] = useState('');
  const [newFees, setNewFees] = useState(0);
  const [uploadedEnrollmentFiles, setUploadedEnrollmentFiles] = useState<{name: string, submitted: boolean, date: string}[]>([]);
  const [newPaymentPlan, setNewPaymentPlan] = useState('Mensal');
  const [newScholarship, setNewScholarship] = useState('Nenhuma');
  const [newFinancialNotes, setNewFinancialNotes] = useState('');

  // Filter students
  const filteredStudents = students.filter(student => {
    const activeSearch = globalSearchTerm || searchTerm;
    const matchesSearch = !activeSearch ? true : (
      fuzzyMatches(student.name, activeSearch) || 
      fuzzyMatches(student.id, activeSearch) ||
      fuzzyMatches(student.guardiansName, activeSearch) ||
      fuzzyMatches(student.class, activeSearch)
    );
    
    const matchesClass = selectedClass === 'all' || student.class === selectedClass;
    const matchesBehavior = selectedBehavior === 'all' || student.behaviorDegree === selectedBehavior;

    return matchesSearch && matchesClass && matchesBehavior;
  });

  // Calculate sorting & pagination
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedClass, selectedBehavior, globalSearchTerm]);

  const sortedStudents = [...filteredStudents].sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];

    if (valA === undefined) valA = '';
    if (valB === undefined) valB = '';

    if (typeof valA === 'string' && typeof valB === 'string') {
      return sortDirection === 'asc' 
        ? valA.localeCompare(valB, 'pt') 
        : valB.localeCompare(valA, 'pt');
    }
    
    // Sort numbers
    return sortDirection === 'asc'
      ? Number(valA) - Number(valB)
      : Number(valB) - Number(valA);
  });

  const totalPages = Math.ceil(sortedStudents.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedStudents = sortedStudents.slice(startIndex, startIndex + itemsPerPage);

  const handleSort = (field: keyof Student | 'outstandingFees') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleAddNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newGuardiansName.trim()) return;

    const hasCC = uploadedEnrollmentFiles.some(f => f.name.toLowerCase().includes('cc') || f.name.toLowerCase().includes('cartao') || f.name.toLowerCase().includes('id') || f.name.toLowerCase().includes('bilhete'));
    const hasVacina = uploadedEnrollmentFiles.some(f => f.name.toLowerCase().includes('vacina') || f.name.toLowerCase().includes('boletim') || f.name.toLowerCase().includes('saude'));
    const hasContrato = uploadedEnrollmentFiles.some(f => f.name.toLowerCase().includes('contrato') || f.name.toLowerCase().includes('doc') || f.name.toLowerCase().includes('matricula'));

    onAddStudent({
      name: newName,
      class: newClass,
      attendanceRate: 100,
      averageGrade: 8.0,
      status: 'active',
      outstandingFees: 0,
      guardiansName: newGuardiansName,
      guardiansContact: newGuardiansContact,
      behaviorDegree: 'Excelente',
      documents: [
        { name: 'Contrato de Matrícula', submitted: hasContrato, date: hasContrato ? new Date().toISOString().split('T')[0] : 'Pendente' },
        { name: 'CC do Aluno', submitted: hasCC, date: hasCC ? new Date().toISOString().split('T')[0] : 'Pendente' },
        { name: 'Boletim de Vacinas', submitted: hasVacina, date: hasVacina ? new Date().toISOString().split('T')[0] : 'Pendente' },
        { name: 'CC do Responsável', submitted: true, date: new Date().toISOString().split('T')[0] },
        ...uploadedEnrollmentFiles.filter(item => {
          const nameLower = item.name.toLowerCase();
          return !((nameLower.includes('cc') || nameLower.includes('cartao')) || nameLower.includes('vacina') || nameLower.includes('contrato'));
        }).map(item => ({ name: item.name, submitted: true, date: item.date }))
      ],
      behaviorHistory: [],
      grades: [
        { subject: 'Matemática', score: 8.0 },
        { subject: 'Português', score: 8.0 },
        { subject: 'História', score: 8.0 }
      ],
      paymentPlan: newPaymentPlan,
      scholarship: newScholarship,
      discount: newScholarship.includes('50%') ? 50 : (newScholarship.includes('10%') ? 10 : 0),
      financialNotes: newFinancialNotes
    } as any);

    // Reset Form
    setNewName('');
    setNewGuardiansName('');
    setNewGuardiansContact('');
    setNewFees(0);
    setNewPaymentPlan('Mensal');
    setNewScholarship('Nenhuma');
    setNewFinancialNotes('');
    setUploadedEnrollmentFiles([]);
    setIsAdding(false);
  };

  const handleToggleDocument = (studentId: string, docName: string) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    const currentDocs = Array.isArray(student.documents) ? student.documents : [];
    const updatedDocs = currentDocs.map(doc => {
      if (doc.name === docName) {
        return { ...doc, submitted: !doc.submitted, date: !doc.submitted ? '2026-06-12' : 'Pendente' };
      }
      return doc;
    });

    onUpdateStudent(studentId, { documents: updatedDocs });
    if (selectedStudent && selectedStudent.id === studentId) {
      setSelectedStudent({ ...selectedStudent, documents: updatedDocs });
    }
  };

  const handleAddBehaviorNote = (studentId: string, noteText: string, category: string) => {
    if (!noteText.trim()) return;
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    const newNote = {
      date: new Date().toISOString().split('T')[0],
      note: noteText,
      categoryDefault: category
    };

    const updatedHistory = [newNote, ...student.behaviorHistory];
    
    // Auto adjust behavior degree depending on warning/praise categories
    let newDegree = student.behaviorDegree;
    if (category === 'Advertência') {
      newDegree = 'Atenção';
    } else if (category === 'Elogio' && student.behaviorDegree === 'Atenção') {
      newDegree = 'Bom';
    }

    onUpdateStudent(studentId, { 
      behaviorHistory: updatedHistory,
      behaviorDegree: newDegree
    });

    if (selectedStudent && selectedStudent.id === studentId) {
      setSelectedStudent({ 
        ...selectedStudent, 
        behaviorHistory: updatedHistory,
        behaviorDegree: newDegree
      });
    }
  };

  return (
    <div id="student_management_section" className="space-y-6">
      {selectedStudent ? (
        /* VISTA DETALHADA DO ALUNO */
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
            <button
              onClick={() => {
                setSelectedStudent(null);
                setIsEditingProfile(false);
              }}
              className="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 text-xs font-semibold cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar à lista de alunos
            </button>
            <div className="flex items-center gap-2">
              {/* Profile Edit Trigger with Permission Lock */}
              {(currentUserRole === 'admin' || currentUserRole === 'director') ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (isEditingProfile) {
                        // Save
                        onUpdateStudent(selectedStudent.id, {
                          name: editName,
                          class: editClass,
                          status: editStatus,
                          guardiansName: editGuardiansName,
                          guardiansContact: editGuardiansContact
                        });
                        setSelectedStudent({
                          ...selectedStudent,
                          name: editName,
                          class: editClass,
                          status: editStatus,
                          guardiansName: editGuardiansName,
                          guardiansContact: editGuardiansContact
                        });
                        setIsEditingProfile(false);
                      } else {
                        // Enter Edit Mode
                        setEditName(selectedStudent.name);
                        setEditClass(selectedStudent.class);
                        setEditStatus(selectedStudent.status);
                        setEditGuardiansName(selectedStudent.guardiansName);
                        setEditGuardiansContact(selectedStudent.guardiansContact);
                        setIsEditingProfile(true);
                      }
                    }}
                    className={`text-xs flex items-center gap-1.5 px-3 py-1.5 rounded transition-all cursor-pointer border ${
                      isEditingProfile 
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950 border-emerald-400 font-bold' 
                        : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/20'
                    }`}
                  >
                    <Edit className="w-3.5 h-3.5" />
                    {isEditingProfile ? 'Salvar Perfil' : 'Editar Perfil'}
                  </button>
                  {isEditingProfile && (
                    <button
                      onClick={() => setIsEditingProfile(false)}
                      className="text-xs text-zinc-400 hover:text-zinc-200 border border-zinc-800 bg-zinc-950 px-3 py-1.5 rounded cursor-pointer"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              ) : (
                <div 
                  className="flex items-center gap-1.5 text-[11px] text-zinc-500 font-mono bg-zinc-950 px-3 py-1.5 rounded border border-zinc-850"
                  title="Apenas Órgãos Superiores (Direção/Admin) têm permissão para editar perfis."
                >
                  <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full mr-1"></span>
                  Perfil Protegido (Apenas Leitura)
                </div>
              )}

              <button
                onClick={() => {
                  if(confirm(`Tem a certeza que deseja remover ${selectedStudent.name}?`)) {
                    onDeleteStudent(selectedStudent.id);
                    setSelectedStudent(null);
                  }
                }}
                className="text-xs text-rose-400 hover:text-rose-350 flex items-center gap-1.5 px-3 py-1.5 rounded bg-rose-500/10 border border-rose-500/20 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Excluir Registro
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Perfil Principal */}
            <div className="space-y-4">
              {!isEditingProfile ? (
                <>
                  <div className="bg-zinc-950 p-5 rounded-lg border border-zinc-800 flex flex-col items-center text-center">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-3 text-emerald-400 font-bold text-xl">
                      {selectedStudent.name.charAt(0)}
                    </div>
                    <h2 className="text-sm font-semibold text-zinc-100">{selectedStudent.name}</h2>
                    <p className="text-[11px] text-zinc-400 mt-0.5">{selectedStudent.id} • {selectedStudent.class}</p>

                    <div className="inline-flex items-center gap-1.5 mt-3 text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2.5 py-0.5 rounded font-mono font-medium">
                      {selectedStudent.status.toUpperCase()}
                    </div>
                  </div>

                  {/* Informações de Responsáveis */}
                  <div className="bg-zinc-950 p-5 rounded-lg border border-zinc-800 space-y-3">
                    <h3 className="text-xs font-semibold text-zinc-350 tracking-wider uppercase">Contactos do Responsável</h3>
                    <div className="space-y-2 text-xs text-zinc-300">
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Nome:</span>
                        <span className="font-medium">{selectedStudent.guardiansName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Contacto:</span>
                        <span className="font-medium font-mono">{selectedStudent.guardiansContact}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Inadimplência:</span>
                        <span className={`font-mono font-semibold ${selectedStudent.outstandingFees > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                          €{selectedStudent.outstandingFees}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-zinc-950 p-5 rounded-lg border border-indigo-500/40 flex flex-col items-center space-y-3">
                    <div className="w-16 h-16 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-xl">
                      {(editName && editName.charAt(0)) || '?'}
                    </div>
                    <div className="w-full space-y-1 text-left">
                      <label className="text-[9px] uppercase font-mono text-zinc-500 block">Nome do Aluno</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 outline-none focus:border-indigo-500"
                        placeholder="Nome do Aluno"
                      />
                    </div>
                    <div className="w-full space-y-1 text-left">
                      <label className="text-[9px] uppercase font-mono text-zinc-500 block">Turma</label>
                      <select
                        value={editClass}
                        onChange={(e) => setEditClass(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 outline-none"
                      >
                        <option value="8º Ano B">8º Ano B</option>
                        <option value="9º Ano A">9º Ano A</option>
                        <option value="10º Ano A">10º Ano A</option>
                      </select>
                    </div>
                    <div className="w-full space-y-1 text-left">
                      <label className="text-[9px] uppercase font-mono text-zinc-500 block">Estado</label>
                      <select
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value as 'active' | 'inactive')}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 outline-none"
                      >
                        <option value="active">Active (Ativo)</option>
                        <option value="inactive">Inactive (Inativo)</option>
                      </select>
                    </div>
                  </div>

                  {/* Informações de Responsáveis editável */}
                  <div className="bg-zinc-950 p-5 rounded-lg border border-indigo-500/40 space-y-3">
                    <h3 className="text-xs font-semibold text-indigo-400 tracking-wider uppercase">Editar Encarregados</h3>
                    <div className="space-y-3 text-xs text-zinc-300 text-left">
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase font-mono text-zinc-500 block">Encarregado de Educação</label>
                        <input
                          type="text"
                          value={editGuardiansName}
                          onChange={(e) => setEditGuardiansName(e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 outline-none"
                          placeholder="Nome do Encarregado"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase font-mono text-zinc-500 block">Contacto (Telf.)</label>
                        <input
                          type="text"
                          value={editGuardiansContact}
                          onChange={(e) => setEditGuardiansContact(e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 outline-none font-mono"
                          placeholder="Ex: +351 9xx xxx xxx"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase font-mono text-zinc-500 block">Mensalidade Pendente (€) (Regulado pelo Ledger)</label>
                        <input
                          type="number"
                          value={selectedStudent.outstandingFees}
                          disabled
                          readOnly
                          className="w-full bg-zinc-900/50 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-400 outline-none font-mono cursor-not-allowed"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Ficha de Notas e Frequência */}
            <div className="space-y-6 md:col-span-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-zinc-950/40 p-4 border border-zinc-805 rounded-lg">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Aproveitamento Médio</span>
                  <div className="text-2xl font-bold text-zinc-100 mt-2">{selectedStudent.averageGrade}</div>
                  <p className="text-[10px] text-zinc-450 mt-1">Escala regulamentar integrada</p>
                </div>
                <div className="bg-zinc-950/40 p-4 border border-zinc-805 rounded-lg">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Assiduidade Geral</span>
                  <div className="text-2xl font-bold text-zinc-100 mt-2">{selectedStudent.attendanceRate}%</div>
                  <p className="text-[10px] text-rose-450 mt-1">{selectedStudent.attendanceRate < 85 ? 'Assiduidade crítica sob risco pedagógico' : 'Dentro do padrão estabelecido'}</p>
                </div>
              </div>

              {/* Disciplinas e Notas directas */}
              <div className="bg-zinc-950/30 p-5 border border-zinc-800 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-zinc-355 tracking-wider uppercase">Pautas Individuais</h3>
                  <span className="text-[9px] text-zinc-500 font-mono">Último Fecho</span>
                </div>
                <div className="space-y-2">
                  {selectedStudent.grades.map(g => (
                    <div key={g.subject} className="flex items-center justify-between py-1.5 border-b border-zinc-850 text-xs">
                      <span className="text-zinc-300 font-medium">{g.subject}</span>
                      <div className="flex items-center gap-3">
                        {/* Interactive Grade Adjuster */}
                        <input
                          type="number"
                          max={10}
                          min={0}
                          step={0.1}
                          defaultValue={g.score}
                          onChange={(e) => {
                            const newScore = parseFloat(e.target.value);
                            if (newScore >= 0 && newScore <= 10) {
                              const updatedGrades = selectedStudent.grades.map(gItem => 
                                gItem.subject === g.subject ? { ...gItem, score: newScore } : gItem
                              );
                              const newAvg = Number((updatedGrades.reduce((sum, current) => sum + current.score, 0) / updatedGrades.length).toFixed(1));
                              onUpdateStudent(selectedStudent.id, { grades: updatedGrades, averageGrade: newAvg });
                            }
                          }}
                          className="w-12 bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 text-center font-mono font-semibold text-zinc-200"
                        />
                        <span className={`w-8 text-right font-mono font-semibold py-0.5 rounded px-1 text-[11px] ${
                          g.score >= 8.5 ? 'text-emerald-400 bg-emerald-500/10' : g.score >= 7.0 ? 'text-blue-400 bg-blue-500/10' : 'text-rose-400 bg-rose-500/10'
                        }`}>
                          {g.score.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Documentos Regulatórios */}
              <div className="bg-zinc-950/30 p-5 border border-zinc-800 rounded-lg space-y-3">
                <h3 className="text-xs font-semibold text-zinc-350 tracking-wider uppercase">Documentação do Estudante</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(Array.isArray(selectedStudent.documents) ? selectedStudent.documents : []).map(doc => (
                    <div key={doc.name} className="flex items-center justify-between p-2.5 bg-zinc-900/50 border border-zinc-800 rounded-md">
                      <div className="flex items-center gap-2 text-xs">
                        {doc.submitted ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        )}
                        <span className="text-zinc-200 font-medium">{doc.name}</span>
                      </div>
                      <button
                        onClick={() => handleToggleDocument(selectedStudent.id, doc.name)}
                        className={`text-[10px] font-semibold px-2 py-1 rounded cursor-pointer ${
                          doc.submitted ? 'bg-zinc-800 hover:bg-zinc-750 text-zinc-400' : 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950'
                        }`}
                      >
                        {doc.submitted ? 'Pendente' : 'Validar'}
                      </button>
                    </div>
                  ))}
                </div>

                {/* Drag and Drop / Local File Picker Input for student documentation */}
                <div className="mt-4 border border-dashed border-zinc-800 hover:border-emerald-500/40 rounded-lg p-5 bg-zinc-950/40 hover:bg-zinc-950/65 flex flex-col items-center justify-center text-center group transition-all relative">
                  <input
                    type="file"
                    multiple
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        const fileList = Array.from(e.target.files) as File[];
                        const newDocs = fileList.map((file: File) => ({
                          name: file.name,
                          submitted: true,
                          date: new Date().toISOString().split('T')[0]
                        }));
                        
                        let updatedDocs = [...(Array.isArray(selectedStudent.documents) ? selectedStudent.documents : [])];
                        newDocs.forEach(newD => {
                          const lowerName = newD.name.toLowerCase();
                          let matched = false;
                          
                          updatedDocs = updatedDocs.map(exDoc => {
                            const exLower = exDoc.name.toLowerCase();
                            if (
                              (lowerName.includes('cc') && exLower.includes('cc')) ||
                              (lowerName.includes('vacina') && exLower.includes('vacina')) ||
                              (lowerName.includes('contrato') && exLower.includes('contrato'))
                            ) {
                              matched = true;
                              return { ...exDoc, submitted: true, date: newD.date };
                            }
                            return exDoc;
                          });
                          
                          if (!matched) {
                            updatedDocs.push(newD);
                          }
                        });

                        onUpdateStudent(selectedStudent.id, { documents: updatedDocs });
                        setSelectedStudent({ ...selectedStudent, documents: updatedDocs });
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="text-zinc-400 group-hover:text-zinc-200 transition-colors">
                    <FileText className="w-8 h-8 mx-auto mb-2 text-zinc-555 group-hover:text-emerald-400 transition-all duration-300" />
                    <p className="text-xs font-semibold text-zinc-300">Carregar Documentos de Matrícula (CC, Vacinas, Contrato)</p>
                    <p className="text-[10px] text-zinc-500 mt-1">Arraste os ficheiros locais ou clique para selecionar</p>
                  </div>
                </div>
              </div>

              {/* Registo de Comportamento */}
              <div className="bg-zinc-950/30 p-5 border border-zinc-800 rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-zinc-350 tracking-wider uppercase">Histórico Comportamental</h3>
                  <span className={`text-[10px] uppercase px-2 py-0.5 rounded font-mono font-medium ${
                    selectedStudent.behaviorDegree === 'Excelente' ? 'bg-emerald-500/10 text-emerald-400' :
                    selectedStudent.behaviorDegree === 'Bom' ? 'bg-blue-500/10 text-blue-400' :
                    selectedStudent.behaviorDegree === 'Regular' ? 'bg-amber-500/10 text-amber-400' :
                    'bg-rose-500/10 text-rose-400'
                  }`}>
                    {selectedStudent.behaviorDegree}
                  </span>
                </div>

                {/* Direct insertion behavior note */}
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.target as HTMLFormElement;
                    const textInput = form.elements.namedItem('behaviour_note') as HTMLInputElement;
                    const catInput = form.elements.namedItem('behaviour_category') as HTMLSelectElement;
                    handleAddBehaviorNote(selectedStudent.id, textInput.value, catInput.value);
                    form.reset();
                  }}
                  className="flex gap-2"
                >
                  <input
                    name="behaviour_note"
                    placeholder="Registar nova observação comportamental..."
                    className="flex-1 bg-zinc-950 border border-zinc-800 px-3 py-1.5 rounded text-xs text-zinc-100 outline-none focus:border-emerald-500"
                    required
                  />
                  <select
                    name="behaviour_category"
                    className="bg-zinc-950 border border-zinc-800 px-2 py-1.5 rounded text-xs text-zinc-300 pointer-events-auto"
                  >
                    <option value="Observação">Observação</option>
                    <option value="Elogio">Elogio</option>
                    <option value="Advertência">Advertência</option>
                  </select>
                  <button type="submit" className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold px-3 py-1.5 rounded cursor-pointer shrink-0">
                    Registar
                  </button>
                </form>

                <div className="space-y-2">
                  {selectedStudent.behaviorHistory.length === 0 ? (
                    <p className="text-xs text-zinc-500 italic p-2">Sem registros comportamentais para este estudante.</p>
                  ) : (
                    selectedStudent.behaviorHistory.map((bh, idx) => (
                      <div key={idx} className="p-3 bg-zinc-900/40 border border-zinc-850 rounded text-xs space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-zinc-500">
                          <span className={`font-mono uppercase ${
                            bh.categoryDefault === 'Elogio' ? 'text-emerald-400' : bh.categoryDefault === 'Advertência' ? 'text-rose-400' : 'text-zinc-400'
                          }`}>{bh.categoryDefault}</span>
                          <span>{bh.date}</span>
                        </div>
                        <p className="text-zinc-200">{bh.note}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Ficha Financeira Integral do Aluno (Ligação Alunos) */}
              <div className="bg-zinc-950/30 p-5 border border-zinc-800 rounded-lg space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-850 pb-3">
                  <div>
                    <h3 className="text-xs font-bold text-zinc-100 tracking-wider uppercase flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-emerald-400" /> Ficha Financeira Integral
                    </h3>
                    <p className="text-[10px] text-zinc-500 mt-0.5">Gestão de propinas, planos de pagamento, descontos ativos e histórico de cobranças.</p>
                  </div>
                  <span className="text-[10px] font-mono font-semibold bg-emerald-500/15 text-emerald-400 px-2.5 py-0.5 rounded">
                    Perfil Financeiro Ativo
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-zinc-900/50 p-3 border border-zinc-850 rounded-md">
                    <span className="text-[9px] uppercase font-mono text-zinc-500 block">Plano Associado</span>
                    <span className="text-xs font-semibold text-zinc-200 mt-1 block">
                      {getFinancialFicha(selectedStudent).paymentPlan}
                    </span>
                  </div>
                  <div className="bg-zinc-900/50 p-3 border border-zinc-850 rounded-md">
                    <span className="text-[9px] uppercase font-mono text-zinc-500 block">Bolsa / Protocolo</span>
                    <span className="text-xs font-semibold text-emerald-400 mt-1 block">
                      {getFinancialFicha(selectedStudent).scholarship}
                    </span>
                  </div>
                  <div className="bg-zinc-900/50 p-3 border border-zinc-850 rounded-md">
                    <span className="text-[9px] uppercase font-mono text-zinc-500 block">Dívida Total</span>
                    <span className={`text-xs font-semibold mt-1 block ${selectedStudent.outstandingFees > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      €{selectedStudent.outstandingFees}
                    </span>
                  </div>
                </div>

                <div className="bg-zinc-900/30 p-3 border border-zinc-850 rounded-md space-y-3">
                  <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Ajustar Plano & Bolsas</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-mono text-zinc-500">Plano de Pagamento</label>
                      <select
                        value={tempPlan}
                        onChange={(e) => setTempPlan(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-805 rounded px-2.5 py-1 text-xs text-zinc-200 outline-none"
                      >
                        <option value="Mensal">Mensal (10 Prestações)</option>
                        <option value="Trimestral">Trimestral (3 Prestações)</option>
                        <option value="Anual">Anual (Taxa Única)</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-mono text-zinc-500">Bolsa Aplicada</label>
                      <select
                        value={tempScholarship}
                        onChange={(e) => setTempScholarship(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-805 rounded px-2.5 py-1 text-xs text-zinc-200 outline-none"
                      >
                        <option value="Nenhuma">Nenhuma Isenção</option>
                        <option value="Bolsa de Mérito Académico (50% Desconto)">Bolsa Mérito (50% Desconto)</option>
                        <option value="Protocolo Familiar (10% Desconto)">Protocolo Familiar (10% Desconto)</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-mono text-zinc-500 block">Notas Administrativas Financeiras</label>
                    <textarea
                      value={tempNotes}
                      onChange={(e) => setTempNotes(e.target.value)}
                      placeholder="Indique preferências, acordos, acordos por escrito..."
                      rows={2}
                      className="w-full bg-zinc-950 border border-zinc-805 rounded px-2.5 py-1.5 text-xs text-zinc-100 outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        let computedDiscount = 0;
                        if (tempScholarship.includes('50%')) computedDiscount = 50;
                        else if (tempScholarship.includes('10%')) computedDiscount = 10;
                        handleSaveStudentFinancials(tempPlan, tempScholarship, computedDiscount, tempNotes);
                      }}
                      className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-[10px] font-bold px-3 py-1.5 rounded transition-all cursor-pointer"
                    >
                      Salvar Alterações Financeiras
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center justify-between">
                    <span>Mensalidades & Cobranças</span>
                    <span className="text-[9px] font-mono text-zinc-500 font-normal">Faturas em Sistema</span>
                  </h4>

                  {invoices.filter(inv => inv.studentId === selectedStudent.id).length === 0 ? (
                    <div className="p-4 bg-zinc-900/20 border border-zinc-850 rounded text-center text-xs text-zinc-500 italic font-mono">
                      Nenhuma transação financeira registada para {selectedStudent.name}.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {invoices.filter(inv => inv.studentId === selectedStudent.id).map(inv => (
                        <div key={inv.id} className="p-3 bg-zinc-900/40 border border-zinc-850 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-indigo-400 font-bold">{inv.id}</span>
                              <span className={`text-[9px] uppercase px-1.5 py-0.5 font-semibold rounded ${
                                inv.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400' :
                                inv.status === 'overdue' ? 'bg-rose-500/10 text-rose-400' :
                                inv.status === 'cancelled' ? 'bg-zinc-850 text-zinc-450' :
                                'bg-amber-500/10 text-amber-400'
                              }`}>
                                {inv.status === 'paid' ? 'paga' : inv.status === 'overdue' ? 'atrasada' : inv.status === 'cancelled' ? 'cancelada' : 'pendente'}
                              </span>
                            </div>
                            <div className="text-zinc-300 font-medium font-mono text-[11px]">
                              Categoria: <span className="text-zinc-205 capitalize">{inv.category === 'tuition' ? 'mensalidade' : inv.category === 'material' ? 'material' : 'extracurricular'}</span>
                            </div>
                            <div className="text-[10px] text-zinc-500">
                              Vencimento: <span className="font-mono">{inv.dueDate}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 sm:text-right shrink-0">
                            <div>
                              <span className="text-[9px] text-zinc-500 block">VALOR</span>
                              <span className="font-bold text-sm text-zinc-105 font-mono">€{inv.amount}</span>
                            </div>

                            <div className="flex items-center gap-2">
                              {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                                <>
                                  <button
                                    onClick={async () => {
                                      try {
                                        await upsertLiveInvoice({ ...inv, status: 'paid' });
                                      } catch (err: any) {
                                        alert(err.message);
                                      }
                                    }}
                                    className="bg-emerald-500 hover:bg-emerald-450 text-zinc-950 font-bold px-2 py-1 rounded text-[10px] transition-colors cursor-pointer"
                                  >
                                    Baixa Pago
                                  </button>
                                  <button
                                    onClick={async () => {
                                      try {
                                        await cancelLiveInvoice(inv.id);
                                      } catch (err: any) {
                                        alert(err.message);
                                      }
                                    }}
                                    className="bg-zinc-800 hover:bg-zinc-750 text-zinc-400 px-2 py-1 rounded text-[10px] transition-colors cursor-pointer"
                                  >
                                    Anular
                                  </button>
                                </>
                              )}

                              {inv.status === 'paid' && (
                                <button
                                  onClick={() => {
                                    const receiptWindow = window.open("", "_blank");
                                    if (receiptWindow) {
                                      receiptWindow.document.write(`
                                        <html>
                                          <head>
                                            <title>Recibo Provisório ${inv.id}</title>
                                            <style>
                                              body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; color: #181c1c; line-height: 1.5; background: #fff; }
                                              .badge { background: #dcfce7; color: #166534; padding: 4px 10px; border-radius: 6px; font-weight: bold; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; display: inline-block; }
                                              .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; border-top: 1px solid #e4e4e7; padding-top: 24px; margin-top:24px;}
                                              .invoice-header { font-size: 26px; font-weight: 800; letter-spacing: -0.025em; margin-bottom: 5px; color: #181c1c; }
                                              .total { font-size: 22px; font-weight: 800; color: #10b981; }
                                              .info-title { font-size: 11px; text-transform: uppercase; color: #71717a; font-weight: 700; margin-bottom: 4px; letter-spacing: 0.05em; }
                                            </style>
                                          </head>
                                          <body>
                                              <div style="display: flex; justify-content: space-between; align-items: start;">
                                                <div>
                                                  <div class="invoice-header">RECIBO DE QUITAÇÃO</div>
                                                  <div style="color: #71717a; font-size: 14px;">Comprovativo Oficial de Recebimento Académico</div>
                                                </div>
                                                <div>
                                                  <span class="badge">PAGO & AUTENTICADO</span>
                                                </div>
                                              </div>
                                              <hr style="border: 0; border-top: 1px solid #e4e4e7; margin: 24px 0;"/>
                                              <div class="grid">
                                                <div>
                                                  <div class="info-title">Entidade Emissora:</div>
                                                  <strong style="font-size: 15px; color: #181c1c;">Nexus Instituto Escolar</strong><br/>
                                                  Inscrita sob Certificação de Ensino do Porto<br/>
                                                  Regência Fiscal: PT-9031853-A<br/>
                                                  Porto, Portugal
                                                </div>
                                                <div>
                                                  <div class="info-title">Estudante Beneficiário:</div>
                                                  <strong style="font-size: 15px; color: #181c1c;">${selectedStudent.name}</strong><br/>
                                                  Encarregado: ${selectedStudent.guardiansName}<br/>
                                                  Turma: ${selectedStudent.class}<br/>
                                                  ID Estudante: ${selectedStudent.id}
                                                </div>
                                              </div>
                                              <div class="grid" style="border-bottom: 1px solid #e4e4e7; padding-bottom: 24px;">
                                                <div>
                                                  <div class="info-title">Especificação da Fatura:</div>
                                                  Serviço de Cobrança: ${inv.category === 'tuition' ? 'Mensalidade Letiva Provisória' : inv.category === 'material' ? 'Material Didático Escolar' : 'Atividades Extracurriculares'}<br/>
                                                  Referência Interna: ${inv.id}<br/>
                                                  Data de Liquidação: ${new Date().toISOString().split('T')[0]}
                                                </div>
                                                <div>
                                                  <div class="info-title">Total Recebido:</div>
                                                  <span class="total">€${inv.amount}</span><br/>
                                                  <span style="font-size: 11px; color: #71717a;">Liquidação direta efetuada via reconciliação bancária integradora.</span>
                                                </div>
                                              </div>
                                              <div style="margin-top: 40px; text-align: center; font-size: 11px; color: #a1a1aa;">
                                                Este recibo serve de documento comprovativo administrativo de quitação emitido pelo sistema integrado Nexus Escolar.
                                              </div>
                                            </body>
                                          </html>
                                        `);
                                        receiptWindow.document.close();
                                      }
                                    }}
                                    className="border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 px-2.5 py-1 rounded text-[10px] cursor-pointer"
                                  >
                                    Ver Recibo
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
      ) : (
        /* LISTA COMPLETA DOS ALUNOS */
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-zinc-100">Fichas de Alunos</h2>
              <p className="text-xs text-zinc-400 mt-1">Pesquise, filtre e audite toda a documentação, pautas e finanças dos estudantes.</p>
            </div>
            <button
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold px-4 py-2.5 rounded-lg transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Matricular Estudante
            </button>
          </div>

          {/* Form Modal adding student */}
          {isAdding && (
            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-xl space-y-4">
              <h3 className="text-sm font-semibold text-zinc-150">Nova Matrícula e Ficha Operacional</h3>
              <form onSubmit={handleAddNew} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono text-zinc-400">Nome do Aluno</label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Nome completo do aluno"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs text-zinc-100 outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono text-zinc-400">Turma Designada</label>
                  <select
                    value={newClass}
                    onChange={(e) => setNewClass(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs text-zinc-350 outline-none"
                  >
                    <option value="8º Ano B">8º Ano B</option>
                    <option value="9º Ano A">9º Ano A</option>
                    <option value="10º Ano A">10º Ano A</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono text-zinc-400">Mensalidade Matrícula (€)</label>
                  <input
                    type="number"
                    value={newFees}
                    onChange={(e) => setNewFees(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs text-zinc-100 outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono text-zinc-400">Nome do Responsável</label>
                  <input
                    type="text"
                    required
                    value={newGuardiansName}
                    onChange={(e) => setNewGuardiansName(e.target.value)}
                    placeholder="Nome do Encarregado de Educação"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs text-zinc-100 outline-none"
                  />
                </div>
                 <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono text-zinc-400">Contacto do Responsável</label>
                  <input
                    type="text"
                    required
                    value={newGuardiansContact}
                    onChange={(e) => setNewGuardiansContact(e.target.value)}
                    placeholder="+351 9xx xxx xxx"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs text-zinc-100 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono text-zinc-400">Plano de Pagamento</label>
                  <select
                    value={newPaymentPlan}
                    onChange={(e) => setNewPaymentPlan(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs text-zinc-350 outline-none"
                  >
                    <option value="Mensal">Mensal (10 Prestações)</option>
                    <option value="Trimestral">Trimestral (3 Prestações)</option>
                    <option value="Anual">Anual (Taxa Única)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono text-zinc-400">Bolsa / Protocolo</label>
                  <select
                    value={newScholarship}
                    onChange={(e) => setNewScholarship(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs text-zinc-350 outline-none"
                  >
                    <option value="Nenhuma">Sem Bolsa de Isenção</option>
                    <option value="Bolsa de Mérito Académico (50% Desconto)">Bolsa Mérito (50% Desconto)</option>
                    <option value="Protocolo Familiar (10% Desconto)">Protocolo Familiar (10% Desconto)</option>
                  </select>
                </div>

                <div className="space-y-1 sm:col-span-2 lg:col-span-3">
                  <label className="text-[10px] uppercase font-mono text-zinc-400">Observações Financeiras Iniciais</label>
                  <input
                    type="text"
                    value={newFinancialNotes}
                    onChange={(e) => setNewFinancialNotes(e.target.value)}
                    placeholder="Ex: Pagamento acordado por comissão até o dia 8 de cada mês"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs text-zinc-100 outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Upload Section */}
                <div className="space-y-2 sm:col-span-2 lg:col-span-3 border-t border-zinc-800 pt-3 mt-1">
                  <label className="text-[10px] uppercase font-mono text-zinc-400 block mb-1">Ficheiros de Suporte à Matrícula (CC, Vacinas, Contrato)</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border border-dashed border-zinc-800 hover:border-emerald-500/40 rounded-lg p-4 bg-zinc-950/20 text-center relative group transition-colors flex flex-col justify-center items-center">
                      <input
                        type="file"
                        multiple
                        onChange={(e) => {
                          if (e.target.files) {
                            const list = (Array.from(e.target.files) as File[]).map((file: File) => ({
                              name: file.name,
                              submitted: true,
                              date: new Date().toISOString().split('T')[0]
                            }));
                            setUploadedEnrollmentFiles(prev => [...prev, ...list]);
                          }
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <FileText className="w-6 h-6 text-zinc-500 group-hover:text-emerald-400 transition-colors mb-1" />
                      <span className="text-[11px] font-semibold text-zinc-300">Anexar Ficheiros de Matrícula</span>
                      <span className="text-[9px] text-zinc-500 leading-tight">Arraste manuais, certidões ou CCs</span>
                    </div>
                    
                    <div className="bg-zinc-950/40 border border-zinc-850 rounded-lg p-3 min-h-[70px]">
                      <span className="text-[9px] font-mono uppercase text-zinc-500 block mb-1 font-semibold">Documentos em Anexo ({uploadedEnrollmentFiles.length})</span>
                      {uploadedEnrollmentFiles.length === 0 ? (
                        <p className="text-[10px] text-zinc-650 italic mt-1.5">Nenhum ficheiro carregado.</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {uploadedEnrollmentFiles.map((file, idx) => (
                            <span key={idx} className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded flex items-center gap-1.5 font-mono">
                              {file.name}
                              <button 
                                type="button" 
                                onClick={() => setUploadedEnrollmentFiles(prev => prev.filter((_, i) => i !== idx))} 
                                className="text-zinc-400 hover:text-white font-bold cursor-pointer"
                              >
                                &times;
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-end justify-end gap-2 sm:col-span-2 lg:col-span-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold px-4 py-2 rounded cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold px-4 py-2 rounded cursor-pointer"
                  >
                    Finalizar Matrícula
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Filtros e Barra de Pesquisa */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col lg:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Pesquise por nome, ID ou contacto familiar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-zinc-700"
              />
            </div>
            
            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto self-stretch">
              <div className="flex items-center gap-1.5 bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 shrink-0">
                <Filter className="w-3.5 h-3.5 text-zinc-550" />
                <span className="text-[10px] text-zinc-500 uppercase font-mono">Turma:</span>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="bg-transparent border-none text-xs text-zinc-300 outline-none cursor-pointer p-0"
                >
                  <option value="all">Todas</option>
                  <option value="8º Ano B">8º Ano B</option>
                  <option value="9º Ano A">9º Ano A</option>
                  <option value="10º Ano A">10º Ano A</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 shrink-0">
                <span className="text-[10px] text-zinc-500 uppercase font-mono">Comportamento:</span>
                <select
                  value={selectedBehavior}
                  onChange={(e) => setSelectedBehavior(e.target.value)}
                  className="bg-transparent border-none text-xs text-zinc-300 outline-none cursor-pointer p-0"
                >
                  <option value="all">Todos</option>
                  <option value="Excelente">Excelente</option>
                  <option value="Bom">Bom</option>
                  <option value="Regular">Regular</option>
                  <option value="Atenção">Atenção</option>
                </select>
              </div>

              {/* Seletor de Tipo de Visualização (UX Premium) */}
              <div className="flex bg-zinc-950 border border-zinc-800 rounded-lg p-0.5 shrink-0 items-center">
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`text-[10px] uppercase font-mono px-3 py-1 rounded transition-all ${
                    viewMode === 'table'
                      ? 'bg-indigo-600 text-white font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                  style={{ height: '28px' }}
                >
                  Tabela
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`text-[10px] uppercase font-mono px-3 py-1 rounded transition-all ${
                    viewMode === 'grid'
                      ? 'bg-indigo-600 text-white font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                  style={{ height: '28px' }}
                >
                  Grelha
                </button>
              </div>
            </div>
          </div>

          {/* Renderização condicional de Tabela ou Grelha de Cartões */}
          {viewMode === 'table' ? (
            <div className="overflow-x-auto w-full border border-zinc-800 rounded-xl bg-zinc-900/10 scrollbar-thin" id="student-table-container">
              <table className="w-full text-left font-sans text-xs border-collapse" style={{ tableLayout: 'fixed' }}>
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-950/40 text-zinc-400 font-mono text-[10.5px] uppercase">
                    {[
                      { key: 'name', label: 'Nome', sortable: true, field: 'name' },
                      { key: 'class', label: 'Turma', sortable: true, field: 'class' },
                      { key: 'grade', label: 'Média Escolar', align: 'center', sortable: true, field: 'averageGrade' },
                      { key: 'attendance', label: 'Assiduidade', align: 'center', sortable: true, field: 'attendanceRate' },
                      { key: 'balance', label: 'Saldo Regulado', align: 'right', sortable: true, field: 'outstandingFees' },
                      { key: 'card', label: 'Ficha', align: 'center' }
                    ].map(h => {
                      const width = stdColWidths[h.key] || 150;
                      return (
                        <th 
                          key={h.key}
                          style={{ width, minWidth: width, maxWidth: width }}
                          className={`p-3.5 relative group select-none hover:bg-zinc-800/30 transition-colors ${
                            h.align === 'right' ? 'text-right' : h.align === 'center' ? 'text-center' : 'text-left'
                          } ${h.sortable ? 'cursor-pointer hover:text-indigo-400' : ''}`}
                          onClick={() => h.sortable && h.field && handleSort(h.field as any)}
                        >
                          <span title={h.label} className="truncate block">
                            {h.label} {h.sortable && h.field && sortField === h.field ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                          </span>
                          {h.key !== 'card' && (
                            <div 
                              className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-indigo-500 bg-zinc-800/30 z-20 transition-colors"
                              onMouseDown={(e) => startStdResize(h.key, e)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          )}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/45">
                  {paginatedStudents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-zinc-500 italic bg-zinc-900">
                        Nenhum estudante encontrado nos critérios definidos.
                      </td>
                    </tr>
                  ) : (
                    paginatedStudents.map(student => {
                      const studentDocs = Array.isArray(student.documents) ? student.documents : [];
                      const missingDocs = studentDocs.filter(d => !d.submitted).length;
                      return (
                        <tr
                          key={student.id}
                          onClick={() => setSelectedStudent(student)}
                          className="hover:bg-zinc-850/30 cursor-pointer transition-all border-b border-zinc-800/40"
                        >
                          <td 
                            style={{ width: stdColWidths['name'], minWidth: stdColWidths['name'], maxWidth: stdColWidths['name'] }}
                            className="p-4 truncate"
                            title={`${student.name} (${student.id})`}
                          >
                            <div className="flex items-center gap-3 truncate">
                              <div className="w-8 h-8 rounded bg-zinc-950 border border-zinc-800 flex items-center justify-center text-emerald-400 font-bold text-xs shrink-0 font-mono">
                                {student.name.charAt(0)}
                              </div>
                              <div className="truncate">
                                <span className="font-semibold text-zinc-200 block text-xs truncate">{student.name}</span>
                                <span className="text-[9px] text-zinc-500 font-mono uppercase block truncate">{student.id}</span>
                              </div>
                            </div>
                          </td>
                          <td 
                            style={{ width: stdColWidths['class'], minWidth: stdColWidths['class'], maxWidth: stdColWidths['class'] }}
                            className="p-4 text-xs text-zinc-300 truncate"
                            title={student.class}
                          >
                            {student.class}
                          </td>
                          <td 
                            style={{ width: stdColWidths['grade'], minWidth: stdColWidths['grade'], maxWidth: stdColWidths['grade'] }}
                            className="p-4 text-center text-xs truncate"
                            title={`${student.averageGrade}/10`}
                          >
                            <span className="font-semibold text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 px-2 py-0.5 rounded font-mono">
                              {student.averageGrade}/10
                            </span>
                          </td>
                          <td 
                            style={{ width: stdColWidths['attendance'], minWidth: stdColWidths['attendance'], maxWidth: stdColWidths['attendance'] }}
                            className="p-4 text-center text-xs truncate"
                            title={`${student.attendanceRate}%`}
                          >
                            <span className={`font-semibold font-mono ${student.attendanceRate < 85 ? 'text-rose-400' : 'text-zinc-300'}`}>
                              {student.attendanceRate}%
                            </span>
                          </td>
                          <td 
                            style={{ width: stdColWidths['balance'], minWidth: stdColWidths['balance'], maxWidth: stdColWidths['balance'] }}
                            className="p-4 text-right text-xs font-mono font-medium truncate"
                            title={student.outstandingFees > 0 ? `€${student.outstandingFees}` : 'Liquidado'}
                          >
                            {student.outstandingFees > 0 ? (
                              <span className="text-rose-400 bg-rose-500/5 px-2 py-1 border border-rose-500/10 rounded inline-block">
                                €{student.outstandingFees}
                              </span>
                            ) : (
                              <span className="text-emerald-400 bg-emerald-500/5 px-2 py-1 border border-emerald-500/10 rounded inline-block">
                                Liquidado
                              </span>
                            )}
                          </td>
                          <td 
                            style={{ width: stdColWidths['card'], minWidth: stdColWidths['card'], maxWidth: stdColWidths['card'] }}
                            className="p-4 text-center" 
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              className="bg-indigo-600/15 hover:bg-indigo-600/25 text-indigo-400 text-[10px] font-semibold px-2 py-1 rounded border border-indigo-500/25 cursor-pointer btn-sm"
                              onClick={() => setSelectedStudent(student)}
                            >
                              Ver Dossiê
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedStudents.length === 0 ? (
                <div className="col-span-full bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center text-zinc-500 italic">
                  Nenhum estudante encontrado nos critérios definidos.
                </div>
              ) : (
                paginatedStudents.map(student => {
                  const studentDocs = Array.isArray(student.documents) ? student.documents : [];
                  const missingDocs = studentDocs.filter(d => !d.submitted).length;

                  return (
                    <div
                      key={student.id}
                      onClick={() => setSelectedStudent(student)}
                      className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700/80 rounded-xl p-5 hover:shadow-md cursor-pointer transition-colors duration-150 relative overflow-hidden group animate-fade-in"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-center text-emerald-400 font-bold">
                            {student.name.charAt(0)}
                          </div>
                          <div>
                            <h3 className="text-xs font-semibold text-zinc-200 group-hover:text-emerald-400 transition-colors">{student.name}</h3>
                            <p className="text-[10px] text-zinc-450 font-mono mt-0.5">{student.id} • {student.class}</p>
                          </div>
                        </div>
                        <span className={`text-[9px] uppercase font-mono font-semibold px-2 py-0.5 rounded ${
                          student.behaviorDegree === 'Excelente' ? 'bg-emerald-500/10 text-emerald-400' :
                          student.behaviorDegree === 'Bom' ? 'bg-blue-500/10 text-blue-400' :
                          student.behaviorDegree === 'Regular' ? 'bg-amber-500/10 text-amber-400' :
                          'bg-rose-500/10 text-rose-400'
                        }`}>
                          {student.behaviorDegree}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mt-4 border-t border-b border-zinc-850 py-3 text-xs">
                        <div>
                          <span className="text-zinc-500 text-[10px] uppercase font-mono block">Aproveitamento</span>
                          <span className="font-semibold text-zinc-200 mt-1 block">{student.averageGrade}/10</span>
                        </div>
                        <div>
                          <span className="text-zinc-500 text-[10px] uppercase font-mono block">Assiduidade</span>
                          <span className={`font-semibold mt-1 block ${student.attendanceRate < 85 ? 'text-rose-400' : 'text-zinc-200'}`}>
                            {student.attendanceRate}%
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[10px] mt-4 text-zinc-450">
                        {missingDocs > 0 ? (
                          <span className="flex items-center gap-1 text-rose-400 font-medium">
                            <AlertCircle className="w-3.5 h-3.5" />
                            {missingDocs} documento{missingDocs > 1 ? 's' : ''} em falta
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-emerald-400/80 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Documentos OK
                          </span>
                        )}

                        {student.outstandingFees > 0 && (
                          <span className="text-rose-400 font-mono font-medium">
                            Pendente: €{student.outstandingFees}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Controle de Paginação (UX Fluida e Polida) */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between border-t border-zinc-800/60 pt-4 mt-6 text-xs text-zinc-400 gap-3">
              <span>
                A mostrar <strong className="text-zinc-200">{startIndex + 1}</strong> a{' '}
                <strong className="text-zinc-200">
                  {Math.min(startIndex + itemsPerPage, sortedStudents.length)}
                </strong>{' '}
                de <strong className="text-zinc-200">{sortedStudents.length}</strong> estudantes registrados
              </span>
              <div className="flex items-center gap-1 shrink-0" id="students-paginator">
                <button
                  type="button"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-1 px-3 border border-zinc-800 rounded bg-zinc-900 text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-800 text-[11px] font-mono btn-sm"
                  style={{ height: '30px' }}
                >
                  Anterior
                </button>
                {[...Array(totalPages)].map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setCurrentPage(i + 1)}
                    className={`w-7 h-7 rounded text-center border p-0 text-[11px] font-mono flex items-center justify-center shrink-0 ${
                      currentPage === i + 1
                        ? 'bg-indigo-600 border-indigo-500 text-white font-semibold'
                        : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
                    }`}
                    style={{ width: '30px', height: '30px' }}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="p-1 px-3 border border-zinc-800 rounded bg-zinc-900 text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-800 text-[11px] font-mono btn-sm"
                  style={{ height: '30px' }}
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
