import React, { useState } from 'react';
import { Mail, Calendar, Search, Users, Sparkles, AlertCircle, Plus, GraduationCap, Clock, CheckCircle, FileText, CheckCircle2, Edit, X, Trash2 } from 'lucide-react';
import { Teacher, UserRole } from '../types';

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

interface TeachersListProps {
  teachers: Teacher[];
  currentUserRole?: UserRole;
  onAddTeacher: (teacher: Omit<Teacher, 'id'>) => void;
  onUpdateTeacher?: (id: string, updated: Partial<Teacher>) => void;
  onDeleteTeacher?: (id: string) => void;
  onSelectTeacherForChat: (teacherName: string) => void;
  globalSearchTerm?: string;
}

export default function TeachersList({ teachers, currentUserRole, onAddTeacher, onUpdateTeacher, onDeleteTeacher, onSelectTeacherForChat, globalSearchTerm }: TeachersListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [cardTab, setCardTab] = useState<Record<string, 'schedule' | 'documents'>>({});
  const [uploadedTeacherFiles, setUploadedTeacherFiles] = useState<{name: string, submitted: boolean, date: string}[]>([]);

  // Teacher Profile editing state
  const [editingTeacherId, setEditingTeacherId] = useState<string | null>(null);
  const [editTeacherName, setEditTeacherName] = useState('');
  const [editTeacherEmail, setEditTeacherEmail] = useState('');
  const [editTeacherPhone, setEditTeacherPhone] = useState('');
  const [editTeacherSubjects, setEditTeacherSubjects] = useState('');
  const [editTeacherClasses, setEditTeacherClasses] = useState('');
  const [editTeacherProductivity, setEditTeacherProductivity] = useState(90);
  const [editTeacherStatus, setEditTeacherStatus] = useState<'active' | 'inactive'>('active');

  // Form State
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newSubjects, setNewSubjects] = useState('');
  const [newClasses, setNewClasses] = useState('');
  const [newSchedule, setNewSchedule] = useState('');

  // Sorting, Pagination, and View States for Corpo Docente
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [sortField, setSortField] = useState<keyof Teacher>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Resizable columns state for Teachers
  const [teachColWidths, setTeachColWidths] = useState<Record<string, number>>({
    teacher: 240,
    subjects: 180,
    classes: 180,
    productivity: 150,
    status: 120,
    actions: 110
  });

  const startTeachResize = (field: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = teachColWidths[field] || 150;

    const doResize = (moveEvent: MouseEvent) => {
      const currentX = moveEvent.clientX;
      const newWidth = Math.max(75, startWidth + (currentX - startX));
      setTeachColWidths(prev => ({ ...prev, [field]: newWidth }));
    };

    const stopResize = () => {
      document.removeEventListener('mousemove', doResize);
      document.removeEventListener('mouseup', stopResize);
    };

    document.addEventListener('mousemove', doResize);
    document.addEventListener('mouseup', stopResize);
  };

  const filteredTeachers = teachers.filter(teacher => {
    const activeSearch = globalSearchTerm || searchTerm;
    if (!activeSearch) return true;
    return (
      fuzzyMatches(teacher.name, activeSearch) ||
      fuzzyMatches(teacher.id || '', activeSearch) ||
      fuzzyMatches(teacher.email, activeSearch) ||
      teacher.subjects.some(s => fuzzyMatches(s, activeSearch)) ||
      teacher.classes.some(c => fuzzyMatches(c, activeSearch))
    );
  });

  // Calculate sorting and pagination
  const sortedTeachers = [...filteredTeachers].sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];

    if (valA === undefined) valA = '';
    if (valB === undefined) valB = '';

    if (typeof valA === 'string' && typeof valB === 'string') {
      return sortDirection === 'asc'
        ? valA.localeCompare(valB, 'pt')
        : valB.localeCompare(valA, 'pt');
    }

    return sortDirection === 'asc'
      ? Number(valA) - Number(valB)
      : Number(valB) - Number(valA);
  });

  const totalPages = Math.ceil(sortedTeachers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedTeachers = sortedTeachers.slice(startIndex, startIndex + itemsPerPage);

  const handleSort = (field: keyof Teacher) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim()) return;

    const hasContrato = uploadedTeacherFiles.some(f => f.name.toLowerCase().includes('contrato') || f.name.toLowerCase().includes('trabalho'));
    const hasCriminal = uploadedTeacherFiles.some(f => f.name.toLowerCase().includes('criminal') || f.name.toLowerCase().includes('cadastro') || f.name.toLowerCase().includes('antecedentes'));
    const hasDiploma = uploadedTeacherFiles.some(f => f.name.toLowerCase().includes('diploma') || f.name.toLowerCase().includes('habilitaca') || f.name.toLowerCase().includes('curso') || f.name.toLowerCase().includes('grau'));

    onAddTeacher({
      name: newName,
      email: newEmail,
      subjects: newSubjects.split(',').map(s => s.trim()),
      classes: newClasses.split(',').map(c => c.trim()),
      productivityScore: 90,
      schedule: newSchedule ? newSchedule.split(';').map(s => s.trim()) : ['2ª Feira: 09:00 - 13:00'],
      status: 'active',
      documents: [
        { name: 'Contrato de Trabalho', submitted: hasContrato, date: hasContrato ? new Date().toISOString().split('T')[0] : 'Pendente' },
        { name: 'Registo Criminal de Portugal', submitted: hasCriminal, date: hasCriminal ? new Date().toISOString().split('T')[0] : 'Pendente' },
        { name: 'Diploma de Habilitações Literárias', submitted: hasDiploma, date: hasDiploma ? new Date().toISOString().split('T')[0] : 'Pendente' },
        { name: 'CC / Cédula Profissional', submitted: true, date: new Date().toISOString().split('T')[0] },
        ...uploadedTeacherFiles.filter(item => {
          const nameLower = item.name.toLowerCase();
          return !(nameLower.includes('contrato') || nameLower.includes('criminal') || nameLower.includes('diploma'));
        }).map(item => ({ name: item.name, submitted: true, date: item.date }))
      ]
    });

    setNewName('');
    setNewEmail('');
    setNewSubjects('');
    setNewClasses('');
    setNewSchedule('');
    setUploadedTeacherFiles([]);
    setIsAdding(false);
  };

  return (
    <div id="teacher_management_panel" className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-100">Corpo Docente</h2>
          <p className="text-xs text-zinc-400 mt-1">Gestão, horários, alocação de turmas e avaliação de produtividade dos professores.</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold px-4 py-2.5 rounded-lg cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Cadastrar Professor
        </button>
      </div>

      {isAdding && (
        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-xl space-y-4">
          <h3 className="text-sm font-semibold text-zinc-100">Registo de Novo Docente</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-mono text-zinc-400">Nome Oficial</label>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex: Prof. Pedro Santos"
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs text-zinc-100 outline-none focus:border-emerald-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-mono text-zinc-400">E-mail Institucional</label>
              <input
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Ex: pedro.santos@nexus-edu.com"
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs text-zinc-100 outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-mono text-zinc-400">Disciplinas (Separadas por vírgula)</label>
              <input
                type="text"
                required
                value={newSubjects}
                onChange={(e) => setNewSubjects(e.target.value)}
                placeholder="Ex: Física, Química"
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs text-zinc-100 outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-mono text-zinc-400">Turmas Atribuídas (Separadas por vírgula)</label>
              <input
                type="text"
                required
                value={newClasses}
                onChange={(e) => setNewClasses(e.target.value)}
                placeholder="Ex: 9º Ano A, 10º Ano A"
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs text-zinc-100 outline-none"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-[10px] uppercase font-mono text-zinc-400">Horários Operacionais (Separados por ponto e vírgula)</label>
              <input
                type="text"
                value={newSchedule}
                onChange={(e) => setNewSchedule(e.target.value)}
                placeholder="Ex: 2ª Feira: 09:00 - 13:00; 4ª Feira: 14:00 - 18:05"
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs text-zinc-100 outline-none"
              />
            </div>

            {/* Teacher Document upload during enrollment */}
            <div className="space-y-2 sm:col-span-2 border-t border-zinc-800 pt-3 mt-1">
              <label className="text-[10px] uppercase font-mono text-zinc-400 block mb-1">Documentos de Contratação do Docente (Opcional)</label>
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
                        setUploadedTeacherFiles(prev => [...prev, ...list]);
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <FileText className="w-6 h-6 text-zinc-550 group-hover:text-emerald-400 transition-colors mb-1" />
                  <span className="text-[11px] font-semibold text-zinc-300">Anexar Ficheiros do Professor</span>
                  <span className="text-[9px] text-zinc-500 leading-tight">Envie Contrato Assinado, Cadastro Criminal ou Diploma</span>
                </div>
                
                <div className="bg-zinc-950/40 border border-zinc-855 rounded-lg p-3 min-h-[70px]">
                  <span className="text-[9px] font-mono uppercase text-zinc-500 block mb-1 font-semibold">Documentos Anexados ({uploadedTeacherFiles.length})</span>
                  {uploadedTeacherFiles.length === 0 ? (
                    <p className="text-[10px] text-zinc-650 italic mt-1.5">Nenhum documento carregado.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {uploadedTeacherFiles.map((file, idx) => (
                        <span key={idx} className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded flex items-center gap-1.5 font-mono">
                          {file.name}
                          <button 
                            type="button" 
                            onClick={() => setUploadedTeacherFiles(prev => prev.filter((_, i) => i !== idx))} 
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

            <div className="flex justify-end gap-2 sm:col-span-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="bg-zinc-850 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold px-4 py-2 rounded cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold px-4 py-2 rounded cursor-pointer"
              >
                Registar Professor
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Pesquisa e Modo de Visualização */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Pesquise por nome do professor, disciplina ou turmas..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-zinc-700"
          />
        </div>

        {/* View Mode Toggle */}
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

      {/* Grid de Professores ou Tabela de Professores with sticky headers, horizontal scroll, and resizable columns */}
      {viewMode === 'table' ? (
        <div className="overflow-x-auto w-full border border-zinc-800 rounded-xl bg-zinc-900/10 scrollbar-thin" id="teachers-table-container">
          <table className="w-full text-left font-sans text-xs border-collapse" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/40 text-zinc-400 font-mono text-[10.5px] uppercase">
                {[
                  { key: 'teacher', label: 'Professor', sortable: true, field: 'name' },
                  { key: 'subjects', label: 'Disciplinas' },
                  { key: 'classes', label: 'Turmas Alocadas' },
                  { key: 'productivity', label: 'Rendimento Letivo', align: 'center', sortable: true, field: 'productivityScore' },
                  { key: 'status', label: 'Estado', align: 'center' },
                  { key: 'actions', label: 'Ações', align: 'right' }
                ].map(h => {
                  const width = teachColWidths[h.key] || 150;
                  return (
                    <th 
                      key={h.key}
                      style={{ width, minWidth: width, maxWidth: width }}
                      className={`py-3.5 px-4 relative group select-none hover:bg-zinc-800/30 transition-colors ${
                        h.align === 'right' ? 'text-right' : h.align === 'center' ? 'text-center' : 'text-left'
                      } ${h.sortable ? 'cursor-pointer hover:text-indigo-400' : ''}`}
                      onClick={() => h.sortable && h.field && handleSort(h.field as any)}
                    >
                      <span title={h.label} className="truncate block">
                        {h.label} {h.sortable && h.field && sortField === h.field ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                      </span>
                      {h.key !== 'actions' && (
                        <div 
                          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-indigo-500 bg-zinc-800/30 z-20 transition-colors"
                          onMouseDown={(e) => startTeachResize(h.key, e)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/40">
              {paginatedTeachers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-zinc-500 italic bg-zinc-900 font-sans">
                    Nenhum professor encontrado nos critérios definidos.
                  </td>
                </tr>
              ) : (
                paginatedTeachers.map(teacher => {
                  const isEditing = editingTeacherId === teacher.id;
                  if (isEditing) {
                    return (
                      <tr key={teacher.id} className="bg-zinc-950/40 border-b border-zinc-850">
                        <td colSpan={6} className="p-4">
                          <div className="space-y-4 max-w-4xl mx-auto">
                            <div className="flex items-center justify-between">
                              <h4 className="text-xs font-bold text-indigo-400 font-mono uppercase">Editar Perfil do Docente ({teacher.id})</h4>
                              <button 
                                onClick={() => setEditingTeacherId(null)}
                                className="text-zinc-500 hover:text-zinc-300 p-1 cursor-pointer"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                              <div className="space-y-1">
                                <label className="text-[9px] uppercase font-mono text-zinc-500 block">Nome do Professor</label>
                                <input
                                  type="text"
                                  value={editTeacherName}
                                  onChange={(e) => setEditTeacherName(e.target.value)}
                                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 outline-none focus:border-indigo-500 font-sans"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] uppercase font-mono text-zinc-500 block">E-mail Institucional</label>
                                <input
                                  type="email"
                                  value={editTeacherEmail}
                                  onChange={(e) => setEditTeacherEmail(e.target.value)}
                                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 outline-none focus:border-indigo-500 font-sans"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] uppercase font-mono text-zinc-500 block">Número de Telefone</label>
                                <input
                                  type="text"
                                  value={editTeacherPhone}
                                  onChange={(e) => setEditTeacherPhone(e.target.value)}
                                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 outline-none font-mono focus:border-indigo-500"
                                  placeholder="+351 9xx xxx xxx"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] uppercase font-mono text-zinc-500 block">Rendimento Letivo (%)</label>
                                <input
                                  type="number"
                                  value={editTeacherProductivity}
                                  onChange={(e) => setEditTeacherProductivity(Number(e.target.value))}
                                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 outline-none font-mono focus:border-indigo-500"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] uppercase font-mono text-zinc-500 block">Disciplinas (Separadas por vírgula)</label>
                                <input
                                  type="text"
                                  value={editTeacherSubjects}
                                  onChange={(e) => setEditTeacherSubjects(e.target.value)}
                                  className="w-full bg-zinc-955 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 outline-none focus:border-indigo-500 font-sans"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] uppercase font-mono text-zinc-500 block">Turmas (Separadas por vírgula)</label>
                                <input
                                  type="text"
                                  value={editTeacherClasses}
                                  onChange={(e) => setEditTeacherClasses(e.target.value)}
                                  className="w-full bg-zinc-955 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 outline-none focus:border-indigo-505 font-sans"
                                />
                              </div>
                              <div className="space-y-1 sm:col-span-2 lg:col-span-3">
                                <label className="text-[9px] uppercase font-mono text-zinc-500 block">Estado Operacional</label>
                                <select
                                  value={editTeacherStatus}
                                  onChange={(e) => setEditTeacherStatus(e.target.value as 'active' | 'inactive')}
                                  className="w-full bg-zinc-955 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-305 outline-none cursor-pointer font-sans"
                                >
                                  <option value="active">Active (No Ativo)</option>
                                  <option value="inactive">Inactive (Inativo)</option>
                                </select>
                              </div>
                            </div>
                            <div className="pt-3 border-t border-zinc-850 flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingTeacherId(null)}
                                className="bg-zinc-850 hover:bg-zinc-800 text-zinc-400 px-3 py-1.5 rounded text-xs cursor-pointer font-sans"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (onUpdateTeacher) {
                                    onUpdateTeacher(teacher.id, {
                                      name: editTeacherName,
                                      email: editTeacherEmail,
                                      phone: editTeacherPhone,
                                      productivityScore: Number(editTeacherProductivity),
                                      subjects: editTeacherSubjects.split(',').map(s => s.trim()).filter(Boolean),
                                      classes: editTeacherClasses.split(',').map(c => c.trim()).filter(Boolean),
                                      status: editTeacherStatus
                                    });
                                  }
                                  setEditingTeacherId(null);
                                }}
                                className="bg-indigo-500 hover:bg-indigo-400 text-white px-4 py-1.5 rounded text-xs font-bold cursor-pointer font-sans"
                              >
                                Salvar Alterações
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={teacher.id} className="hover:bg-zinc-855/35 transition-all border-b border-zinc-800/40">
                      <td 
                        style={{ width: teachColWidths['teacher'], minWidth: teachColWidths['teacher'], maxWidth: teachColWidths['teacher'] }}
                        className="p-4 truncate"
                        title={`${teacher.name} (${teacher.email})`}
                      >
                        <div className="flex items-center gap-3 truncate">
                          <div className="w-8 h-8 rounded bg-zinc-950 border border-zinc-800 flex items-center justify-center text-indigo-400 font-bold shrink-0 font-mono">
                            {teacher.name.charAt(0)}
                          </div>
                          <div className="truncate">
                            <span className="font-semibold text-zinc-200 block text-xs truncate">{teacher.name}</span>
                            <span className="text-[10px] text-zinc-500 font-mono block truncate">{teacher.email}</span>
                          </div>
                        </div>
                      </td>
                      <td 
                        style={{ width: teachColWidths['subjects'], minWidth: teachColWidths['subjects'], maxWidth: teachColWidths['subjects'] }}
                        className="p-4 truncate"
                        title={teacher.subjects.join(', ')}
                      >
                        <div className="flex flex-wrap gap-1 truncate max-w-full">
                          {teacher.subjects.map(item => (
                            <span key={item} className="text-[9px] font-mono bg-zinc-955 text-zinc-300 border border-zinc-800 px-1.5 py-0.5 rounded truncate">
                              {item}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td 
                        style={{ width: teachColWidths['classes'], minWidth: teachColWidths['classes'], maxWidth: teachColWidths['classes'] }}
                        className="p-4 truncate"
                        title={teacher.classes.join(', ')}
                      >
                        <div className="flex flex-wrap gap-1 truncate max-w-full">
                          {teacher.classes.map(item => (
                            <span key={item} className="text-[9px] font-mono bg-zinc-955 text-emerald-400/80 border border-emerald-500/10 px-1.5 py-0.5 rounded truncate">
                              {item}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td 
                        style={{ width: teachColWidths['productivity'], minWidth: teachColWidths['productivity'], maxWidth: teachColWidths['productivity'] }}
                        className="p-4 text-center truncate"
                        title={`${teacher.productivityScore}%`}
                      >
                        <span className="font-semibold text-emerald-400 font-mono bg-emerald-500/5 px-2 py-0.5 border border-emerald-500/10 rounded">
                          {teacher.productivityScore}%
                        </span>
                      </td>
                      <td 
                        style={{ width: teachColWidths['status'], minWidth: teachColWidths['status'], maxWidth: teachColWidths['status'] }}
                        className="p-4 text-center truncate"
                        title={teacher.status === 'active' ? 'Ativo' : 'Inativo'}
                      >
                        <span className={`text-[9px] uppercase font-mono font-semibold px-2 py-0.5 rounded ${
                          teacher.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-400'
                        }`}>
                          {teacher.status === 'active' ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td 
                        style={{ width: teachColWidths['actions'], minWidth: teachColWidths['actions'], maxWidth: teachColWidths['actions'] }}
                        className="p-4 text-right"
                      >
                        <div className="flex items-center justify-end gap-2">
                          {(currentUserRole === 'admin' || currentUserRole === 'director') && (
                            <button
                              onClick={() => {
                                setEditTeacherName(teacher.name);
                                setEditTeacherEmail(teacher.email);
                                setEditTeacherPhone(teacher.phone || '');
                                setEditTeacherSubjects(teacher.subjects.join(', '));
                                setEditTeacherClasses(teacher.classes.join(', '));
                                setEditTeacherProductivity(teacher.productivityScore);
                                setEditTeacherStatus(teacher.status);
                                setEditingTeacherId(teacher.id);
                              }}
                              className="text-[10px] text-indigo-400 bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/20 px-2 py-1 rounded transition-colors cursor-pointer font-sans"
                            >
                              Editar
                            </button>
                          )}
                          <button
                            onClick={() => onSelectTeacherForChat(teacher.name)}
                            className="text-[10px] text-zinc-100 bg-zinc-800 hover:bg-zinc-700 hover:text-white px-2 py-1 rounded transition-colors cursor-pointer border border-zinc-755 font-sans"
                          >
                            Comunicar
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
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {paginatedTeachers.map(teacher => {
          const isEditing = editingTeacherId === teacher.id;

          if (isEditing) {
            return (
              <div key={teacher.id} className="bg-zinc-900 border border-indigo-500/40 rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-indigo-400 font-mono uppercase">Editar Perfil do Docente ({teacher.id})</h4>
                  <button 
                    onClick={() => setEditingTeacherId(null)}
                    className="text-zinc-500 hover:text-zinc-300 p-1 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-mono text-zinc-500 block">Nome do Professor</label>
                    <input
                      type="text"
                      value={editTeacherName}
                      onChange={(e) => setEditTeacherName(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-mono text-zinc-500 block">E-mail Institucional</label>
                    <input
                      type="email"
                      value={editTeacherEmail}
                      onChange={(e) => setEditTeacherEmail(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-mono text-zinc-500 block">Número de Telefone</label>
                    <input
                      type="text"
                      value={editTeacherPhone}
                      onChange={(e) => setEditTeacherPhone(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 outline-none font-mono focus:border-indigo-500"
                      placeholder="+351 9xx xxx xxx"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-mono text-zinc-500 block">Avaliação/Rendimento letivo (%)</label>
                    <input
                      type="number"
                      value={editTeacherProductivity}
                      onChange={(e) => setEditTeacherProductivity(Number(e.target.value))}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 outline-none font-mono focus:border-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-mono text-zinc-500 block">Disciplinas (separadas por vírgula)</label>
                    <input
                      type="text"
                      value={editTeacherSubjects}
                      onChange={(e) => setEditTeacherSubjects(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-mono text-zinc-500 block">Turmas (separadas por vírgula)</label>
                    <input
                      type="text"
                      value={editTeacherClasses}
                      onChange={(e) => setEditTeacherClasses(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-100 outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[9px] uppercase font-mono text-zinc-500 block">Estado Operacional</label>
                    <select
                      value={editTeacherStatus}
                      onChange={(e) => setEditTeacherStatus(e.target.value as 'active' | 'inactive')}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-300 outline-none"
                    >
                      <option value="active">Active (No Ativo)</option>
                      <option value="inactive">Inactive (Inativo)</option>
                    </select>
                  </div>
                </div>
                <div className="pt-3 border-t border-zinc-850 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingTeacherId(null)}
                    className="bg-zinc-850 hover:bg-zinc-800 text-zinc-400 px-3 py-1.5 rounded text-xs cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (onUpdateTeacher) {
                        onUpdateTeacher(teacher.id, {
                          name: editTeacherName,
                          email: editTeacherEmail,
                          phone: editTeacherPhone,
                          productivityScore: Number(editTeacherProductivity),
                          subjects: editTeacherSubjects.split(',').map(s => s.trim()).filter(Boolean),
                          classes: editTeacherClasses.split(',').map(c => c.trim()).filter(Boolean),
                          status: editTeacherStatus
                        });
                      }
                      setEditingTeacherId(null);
                    }}
                    className="bg-indigo-500 hover:bg-indigo-400 text-white px-4 py-1.5 rounded text-xs font-bold cursor-pointer"
                  >
                    Salvar Alterações
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div key={teacher.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-400 flex items-center justify-center">
                    <GraduationCap className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-105">{teacher.name}</h3>
                    <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{teacher.id} • {teacher.status.toUpperCase()}</p>
                  </div>
                </div>

                {/* Produtividade */}
                <div className="text-right">
                  <span className="text-[9px] uppercase font-mono text-zinc-500 block">Rendimento Letivo</span>
                  <span className="text-sm font-semibold text-emerald-400 font-mono mt-1 block">
                    {teacher.productivityScore}%
                  </span>
                </div>
              </div>

              {/* Barras de Disciplina e Turmas */}
              <div className="grid grid-cols-2 gap-4 py-3 border-t border-b border-zinc-850">
                <div>
                  <span className="text-[9px] uppercase font-mono text-zinc-500 block">Disciplinas</span>
                  <div className="flex flex-wrap gap-1 mt-1.5 animate-none">
                    {teacher.subjects.map(item => (
                      <span key={item} className="text-[9px] font-mono bg-zinc-955 text-zinc-300 border border-zinc-800 px-1.5 py-0.5 rounded">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-mono text-zinc-500 block">Turmas Alocadas</span>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {teacher.classes.map(item => (
                      <span key={item} className="text-[9px] font-mono bg-zinc-955 text-emerald-400/80 border border-emerald-500/10 px-1.5 py-0.5 rounded">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tab Selector for Schedule vs Documents */}
              <div className="flex items-center gap-2 border-b border-zinc-800 pb-1 text-[11px] font-mono">
                <button
                  type="button"
                  onClick={() => setCardTab(prev => ({ ...prev, [teacher.id]: 'schedule' }))}
                  className={`pb-1 px-1 transition-all border-b-2 cursor-pointer ${
                    (cardTab[teacher.id] || 'schedule') === 'schedule' 
                      ? 'border-emerald-500 text-emerald-400 font-semibold' 
                      : 'border-transparent text-zinc-450 hover:text-zinc-300'
                  }`}
                >
                  Agenda Horária
                </button>
                <button
                  type="button"
                  onClick={() => setCardTab(prev => ({ ...prev, [teacher.id]: 'documents' }))}
                  className={`pb-1 px-1 transition-all border-b-2 cursor-pointer ${
                    cardTab[teacher.id] === 'documents' 
                      ? 'border-emerald-500 text-emerald-400 font-semibold' 
                      : 'border-transparent text-zinc-450 hover:text-zinc-300'
                  }`}
                >
                  Documentos ({teacher.documents?.length || 0})
                </button>
              </div>

              {/* Tab Contents */}
              {(cardTab[teacher.id] || 'schedule') === 'schedule' ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px]">
                    {teacher.schedule.map((sch, idx) => (
                      <div key={idx} className="bg-zinc-950/50 p-2 border border-zinc-850 rounded font-mono text-zinc-400 leading-tight">
                        {sch}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
                    {(teacher.documents && teacher.documents.length > 0) ? (
                      teacher.documents.map((doc, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-zinc-950/55 border border-zinc-855 rounded">
                          <div className="flex items-center gap-1.5 truncate">
                            {doc.submitted ? (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                            ) : (
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-455 shrink-0 animate-ping" />
                            )}
                            <span className={`truncate ${doc.submitted ? 'text-zinc-300' : 'text-zinc-500'}`} title={doc.name}>
                              {doc.name}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (!onUpdateTeacher) return;
                              const updatedDocs = (teacher.documents || []).map((d, i) => 
                                i === idx ? { ...d, submitted: !d.submitted, date: d.submitted ? 'Pendente' : new Date().toISOString().split('T')[0] } : d
                              );
                              onUpdateTeacher(teacher.id, { documents: updatedDocs });
                            }}
                            className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-bold cursor-pointer transition-all ${
                              doc.submitted ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700' : 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400'
                            }`}
                          >
                            {doc.submitted ? 'Pendente' : 'Validar'}
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="col-span-2 text-[10px] text-zinc-550 italic">Nenhum documento registado ainda.</p>
                    )}
                  </div>

                  {/* File Dropzone/Selector inside Teacher card */}
                  <div className="border border-dashed border-zinc-800 hover:border-emerald-500/40 rounded p-2 bg-zinc-950/45 text-center relative group transition-colors flex flex-col justify-center items-center">
                    <input
                      type="file"
                      multiple
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          const files = (Array.from(e.target.files) as File[]).map((file: File) => ({
                            name: file.name,
                            submitted: true,
                            date: new Date().toISOString().split('T')[0]
                          }));
                          const updatedDocs = [...(teacher.documents || []), ...files];
                          onUpdateTeacher?.(teacher.id, { documents: updatedDocs });
                        }
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <FileText className="w-4 h-4 text-zinc-500 group-hover:text-emerald-400 transition-colors mb-1" />
                    <span className="text-[10px] font-semibold text-zinc-350">Anexar Novo Ficheiro do Docente</span>
                  </div>
                </div>
              )}

              {/* Ações Rápidas */}
              <div className="pt-3 border-t border-zinc-850 flex items-center justify-between text-xs">
                <span className="text-zinc-550 font-mono flex flex-col gap-0.5">
                  <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-zinc-600" /> {teacher.email}</span>
                  {teacher.phone && <span className="text-[10px] text-zinc-500">TLF: {teacher.phone}</span>}
                </span>
                <div className="flex items-center gap-2">
                  {/* Permissões do Corpo Docente */}
                  {(currentUserRole === 'admin' || currentUserRole === 'director') ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditTeacherName(teacher.name);
                          setEditTeacherEmail(teacher.email);
                          setEditTeacherPhone(teacher.phone || '');
                          setEditTeacherSubjects(teacher.subjects.join(', '));
                          setEditTeacherClasses(teacher.classes.join(', '));
                          setEditTeacherProductivity(teacher.productivityScore);
                          setEditTeacherStatus(teacher.status);
                          setEditingTeacherId(teacher.id);
                        }}
                        className="text-xs text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 px-3 py-1.5 rounded transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <Edit className="w-3 h-3" /> Editar
                      </button>
                      {onDeleteTeacher && (
                        <button
                          onClick={() => onDeleteTeacher(teacher.id)}
                          className="text-xs text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 px-3 py-1.5 rounded transition-colors cursor-pointer flex items-center gap-1.5"
                          title="Eliminar Professor"
                        >
                          <Trash2 className="w-3 h-3" /> Eliminar
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className="text-[10px] text-zinc-500 font-mono border border-zinc-800/80 bg-zinc-950 px-2.5 py-1.5 rounded flex items-center gap-1.5" title="Apenas Órgãos Superiores (Direção/Admin) podem editar perfis.">
                      Restrito (Leitura)
                    </span>
                  )}
                  <button
                    onClick={() => onSelectTeacherForChat(teacher.name)}
                    className="text-xs text-zinc-100 bg-zinc-800 hover:bg-zinc-700 hover:text-white px-3 py-1.5 rounded transition-colors cursor-pointer border border-zinc-750"
                  >
                    Comunicar
                  </button>
                </div>
              </div>
            </div>
          );
          })}
        </div>
      )}

      {/* Controle de Paginação de Professores */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between border-t border-zinc-800/60 pt-4 mt-6 text-xs text-zinc-400 gap-3" id="teachers-paginator">
          <span>
            A mostrar <strong className="text-zinc-200">{startIndex + 1}</strong> a{' '}
            <strong className="text-zinc-200">
              {Math.min(startIndex + itemsPerPage, sortedTeachers.length)}
            </strong>{' '}
            de <strong className="text-zinc-200">{sortedTeachers.length}</strong> professores registados
          </span>
          <div className="flex items-center gap-1 shrink-0">
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
  );
}
