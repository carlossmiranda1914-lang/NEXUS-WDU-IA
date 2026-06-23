import React, { useState, useMemo } from 'react';
import { 
  ClipboardCheck, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Filter, 
  User, 
  Calendar, 
  Building2, 
  Play, 
  Plus, 
  Search, 
  Trash2, 
  SlidersHorizontal, 
  Sparkles, 
  Briefcase, 
  ArrowRight, 
  FileText, 
  Check, 
  FileWarning,
  UserCheck,
  Zap,
  Info
} from 'lucide-react';
import { SchoolTask, TaskPriority, TaskState, UserRole } from '../types';

interface TasksCenterProps {
  tasks: SchoolTask[];
  setTasks: React.Dispatch<React.SetStateAction<SchoolTask[]>>;
  currentUserRole: UserRole;
  theme: 'light' | 'dark';
}

const PRIORITIES: TaskPriority[] = ['Baixa', 'Normal', 'Alta', 'Urgente', 'Crítica'];
const STATUSES: TaskState[] = ['Pendente', 'Em Curso', 'Aguardando Aprovação', 'Concluída', 'Cancelada', 'Atrasada'];
const DEPARTMENTS = ['Secretaria', 'Financeiro', 'Professor', 'Direção', 'Administrador'] as const;

export default function TasksCenter({ tasks, setTasks, currentUserRole, theme }: TasksCenterProps) {
  // Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDept, setFilterDept] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterAssigned, setFilterAssigned] = useState<string>('all');
  const [filterDeadline, setFilterDeadline] = useState<string>('all'); // 'all', 'today', 'overdue', 'week'

  // Modal / New Task State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newAssigned, setNewAssigned] = useState('');
  const [newDept, setNewDept] = useState<SchoolTask['department']>('Secretaria');
  const [newPriority, setNewPriority] = useState<TaskPriority>('Normal');
  const [newStatus, setNewStatus] = useState<TaskState>('Pendente');
  const [newDueDate, setNewDueDate] = useState(() => {
    return new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  });
  const [newLimitDate, setNewLimitDate] = useState(() => {
    return new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  });

  // Selected task detail
  const [selectedTask, setSelectedTask] = useState<SchoolTask | null>(null);

  // Quick Stats computation
  const stats = useMemo(() => {
    let pending = 0;
    let inProgress = 0;
    let overdue = 0;
    let completed = 0;

    tasks.forEach(t => {
      if (t.status === 'Concluída') completed++;
      else if (t.status === 'Atrasada') overdue++;
      else if (t.status === 'Em Curso') inProgress++;
      else if (t.status === 'Pendente') pending++;
    });

    return { pending, inProgress, overdue, completed };
  }, [tasks]);

  // Determine current user's functional department mapping
  const currentDept: SchoolTask['department'] = useMemo(() => {
    switch (currentUserRole) {
      case 'teacher': return 'Professor';
      case 'financial': return 'Financeiro';
      case 'secretariat': return 'Secretaria';
      case 'director': return 'Direção';
      case 'admin': return 'Administrador';
      default: return 'Todos';
    }
  }, [currentUserRole]);

  // Personal user name simulation
  const currentUserName = useMemo(() => {
    switch (currentUserRole) {
      case 'teacher': return 'Prof. João Silva';
      case 'financial': return 'Financeiro Executivo';
      case 'secretariat': return 'Secretaria Executiva';
      case 'director': return 'Direção Executiva';
      case 'admin': return 'Administrador do Sistema';
      default: return 'Colaborador';
    }
  }, [currentUserRole]);

  // Inbox Tasks (specific to user's assigned role/department)
  const personalInboxTasks = useMemo(() => {
    return tasks.filter(t => {
      // Completed are not in inbox unless very recent
      if (t.status === 'Concluída' || t.status === 'Cancelada') return false;
      
      if (currentUserRole === 'admin') return true; // sees all active
      
      // Matches department OR is explicitly assigned to this persona's simulated name
      return t.department === currentDept || t.assignedTo === currentUserName;
    });
  }, [tasks, currentDept, currentUserRole, currentUserName]);

  // General Filtered Tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      // 1. Text Search
      if (searchTerm) {
        const text = `${t.id} ${t.title} ${t.description} ${t.assignedTo}`.toLowerCase();
        if (!text.includes(searchTerm.toLowerCase())) return false;
      }

      // 2. Department
      if (filterDept !== 'all' && t.department !== filterDept) return false;

      // 3. Priority
      if (filterPriority !== 'all' && t.priority !== filterPriority) return false;

      // 4. Status
      if (filterStatus !== 'all' && t.status !== filterStatus) return false;

      // 5. Assigned
      if (filterAssigned !== 'all') {
        if (filterAssigned === 'me' && t.assignedTo !== currentUserName) return false;
        if (filterAssigned === 'unassigned' && t.assignedTo !== 'Não atribuído' && t.assignedTo !== '') return false;
      }

      // 6. Deadline
      if (filterDeadline !== 'all') {
        const todayStr = new Date().toISOString().split('T')[0];
        if (filterDeadline === 'today' && t.dueDate !== todayStr) return false;
        if (filterDeadline === 'overdue') {
          return t.status === 'Atrasada' || (t.dueDate < todayStr && t.status !== 'Concluída');
        }
        if (filterDeadline === 'week') {
          const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          return t.dueDate >= todayStr && t.dueDate <= nextWeek && t.status !== 'Concluída';
        }
      }

      return true;
    });
  }, [tasks, searchTerm, filterDept, filterPriority, filterStatus, filterAssigned, filterDeadline, currentUserName]);

  // Action: Create Task manually
  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newTask: SchoolTask = {
      id: `TSK-${Math.floor(100 + Math.random() * 899)}`,
      title: newTitle,
      description: newDescription,
      assignedTo: newAssigned || 'Não atribuído',
      department: newDept,
      priority: newPriority,
      status: newStatus,
      createdAt: new Date().toISOString().split('T')[0],
      dueDate: newDueDate,
      limitDate: newLimitDate || newDueDate,
    };

    setTasks(prev => [newTask, ...prev]);
    setIsCreateModalOpen(false);

    // Reset Form
    setNewTitle('');
    setNewDescription('');
    setNewAssigned('');
    setNewDept('Secretaria');
    setNewPriority('Normal');
    setNewStatus('Pendente');
  };

  // Action: Complete Task
  const handleCompleteTask = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'Concluída' } : t));
    if (selectedTask?.id === id) {
      setSelectedTask(prev => prev ? { ...prev, status: 'Concluída' } : null);
    }
  };

  // Action: Change Status
  const handleChangeStatus = (id: string, status: TaskState) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    if (selectedTask?.id === id) {
      setSelectedTask(prev => prev ? { ...prev, status } : null);
    }
  };

  // Action: Change Priority
  const handleChangePriority = (id: string, priority: TaskPriority) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, priority } : t));
    if (selectedTask?.id === id) {
      setSelectedTask(prev => prev ? { ...prev, priority } : null);
    }
  };

  // Action: Delete Task
  const handleDeleteTask = (id: string) => {
    if (confirm('Tem a certeza que deseja eliminar esta tarefa operacional?')) {
      setTasks(prev => prev.filter(t => t.id !== id));
      setSelectedTask(null);
    }
  };

  // Automated Trigger simulation helpers
  const triggerNewMatricula = () => {
    const studentName = prompt('Introduza o nome do aluno inscrito para simulação:', 'Maria Leonor Correia');
    if (!studentName) return;

    const stdId = `ALU-${Math.floor(400 + Math.random() * 100)}`;
    
    const docTask: SchoolTask = {
      id: `TSK-${Math.floor(2000 + Math.random() * 8000)}`,
      title: `Verificar documentos - ${studentName}`,
      description: `Validar documentação académica e comprovativo de residência para a matrícula recém-criada (${stdId}).`,
      assignedTo: 'Secretaria Executiva',
      department: 'Secretaria',
      priority: 'Alta',
      status: 'Pendente',
      createdAt: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().split('T')[0],
      limitDate: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString().split('T')[0],
      createdAutomatically: true,
      referenceId: stdId,
      referenceType: 'matricula'
    };

    const finTask: SchoolTask = {
      id: `TSK-${Math.floor(2000 + Math.random() * 8000)}`,
      title: `Criar plano financeiro - ${studentName}`,
      description: `Definir regime de propinas, descontos elegíveis e plano de parcelamento para o aluno (${stdId}).`,
      assignedTo: 'Financeiro Executivo',
      department: 'Financeiro',
      priority: 'Normal',
      status: 'Pendente',
      createdAt: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      limitDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      createdAutomatically: true,
      referenceId: stdId,
      referenceType: 'matricula'
    };

    const contractTask: SchoolTask = {
      id: `TSK-${Math.floor(2000 + Math.random() * 8000)}`,
      title: `Gerar contrato de prestação de serviços - ${studentName}`,
      description: `Emitir o contrato oficial assinado digitalmente pelo encarregado de educação e diretor escolar.`,
      assignedTo: 'Secretaria Executiva',
      department: 'Secretaria',
      priority: 'Alta',
      status: 'Pendente',
      createdAt: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      limitDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      createdAutomatically: true,
      referenceId: stdId,
      referenceType: 'matricula'
    };

    setTasks(prev => [docTask, finTask, contractTask, ...prev]);
    alert(`3 tarefas operacionais automáticas criadas com sucesso para o aluno ${studentName}!`);
  };

  const triggerNewDocument = () => {
    const docName = prompt('Introduza o nome do documento submetido:', 'Boletim de Vacinas_Novo.pdf');
    if (!docName) return;

    const docId = `DOC-${Math.floor(300 + Math.random() * 200)}`;

    const valTask: SchoolTask = {
      id: `TSK-${Math.floor(2000 + Math.random() * 8000)}`,
      title: `Validar documento - ${docName}`,
      description: `Verificar integridade digital e autenticidade da assinatura ou carimbo do ficheiro recém-carregado (${docId}).`,
      assignedTo: 'Secretaria Executiva',
      department: 'Secretaria',
      priority: 'Normal',
      status: 'Pendente',
      createdAt: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      limitDate: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().split('T')[0],
      createdAutomatically: true,
      referenceId: docId,
      referenceType: 'documento'
    };

    const classTask: SchoolTask = {
      id: `TSK-${Math.floor(2000 + Math.random() * 8000)}`,
      title: `Classificar documento - ${docName}`,
      description: `Arquivar e indexar o documento nos dossiers adequados com as devidas tags de pesquisa escolares.`,
      assignedTo: 'Secretaria Executiva',
      department: 'Secretaria',
      priority: 'Baixa',
      status: 'Pendente',
      createdAt: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().split('T')[0],
      limitDate: new Date(Date.now() + 96 * 60 * 60 * 1000).toISOString().split('T')[0],
      createdAutomatically: true,
      referenceId: docId,
      referenceType: 'documento'
    };

    const appTask: SchoolTask = {
      id: `TSK-${Math.floor(2000 + Math.random() * 8000)}`,
      title: `Aprovar documento - ${docName}`,
      description: `Homologação formal do documento para arquivamento definitivo na nuvem académica pela direção.`,
      assignedTo: 'Direção Executiva',
      department: 'Direção',
      priority: 'Normal',
      status: 'Pendente',
      createdAt: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString().split('T')[0],
      limitDate: new Date(Date.now() + 120 * 60 * 60 * 1000).toISOString().split('T')[0],
      createdAutomatically: true,
      referenceId: docId,
      referenceType: 'documento'
    };

    setTasks(prev => [valTask, classTask, appTask, ...prev]);
    alert(`3 tarefas operacionais automáticas criadas com sucesso para o documento: ${docName}!`);
  };

  const triggerLatePayment = () => {
    const parentName = prompt('Introduza o nome do encarregado de educação com faturas em atraso:', 'Sandra Medeiros');
    if (!parentName) return;

    const invId = `FAT-${Math.floor(9000 + Math.random() * 500)}`;

    const lateTask: SchoolTask = {
      id: `TSK-${Math.floor(2000 + Math.random() * 8000)}`,
      title: `Cobrar propinas em atraso - Enc. ${parentName}`,
      description: `A mensalidade vinculada ao registo ${invId} encontra-se vencida e com juros em acumulação. Proceder com a chamada telefónica de cobrança direta.`,
      assignedTo: 'Financeiro Executivo',
      department: 'Financeiro',
      priority: 'Crítica',
      status: 'Atrasada',
      createdAt: new Date().toISOString().split('T')[0],
      dueDate: new Date().toISOString().split('T')[0],
      limitDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      createdAutomatically: true,
      referenceId: invId,
      referenceType: 'financeiro'
    };

    setTasks(prev => [lateTask, ...prev]);
    alert(`Nova tarefa operacional crítica criada automaticamente para o departamento financeiro!`);
  };

  // Status and Priority CSS badges helpers
  const getPriorityBadge = (p: TaskPriority) => {
    switch (p) {
      case 'Baixa': return 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700';
      case 'Normal': return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-850';
      case 'Alta': return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-850';
      case 'Urgente': return 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-850';
      case 'Crítica': return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-850 animate-pulse';
    }
  };

  const getStatusBadge = (s: TaskState) => {
    switch (s) {
      case 'Pendente': return 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700';
      case 'Em Curso': return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-850';
      case 'Aguardando Aprovação': return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-850';
      case 'Concluída': return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-850';
      case 'Atrasada': return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-850';
      case 'Cancelada': return 'bg-zinc-100 text-zinc-400 line-through border-zinc-200 dark:bg-zinc-850 dark:text-zinc-500 dark:border-zinc-800';
    }
  };

  return (
    <div className="space-y-6">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-5 border-zinc-200 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-indigo-500" />
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 font-display">
              Centro de Tarefas Operacionais
            </h1>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Gestão de trabalho institucional inteligente e central de automações para evitar esquecimentos.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            Criar Nova Tarefa
          </button>
        </div>
      </div>

      {/* BENTO PAINEL PRINCIPAL DE INDICADORES (Métricas em Tempo Real) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        
        <div 
          onClick={() => setFilterStatus(filterStatus === 'Pendente' ? 'all' : 'Pendente')}
          className={`p-4 rounded-xl border transition-all cursor-pointer select-none relative overflow-hidden group ${
            filterStatus === 'Pendente' 
              ? 'bg-zinc-100 border-zinc-400 dark:bg-zinc-800 dark:border-zinc-600' 
              : 'bg-white border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-750 shadow-sm'
          }`}
        >
          <div className="absolute top-0 left-0 w-1.5 h-full bg-zinc-400"></div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 dark:text-zinc-450 font-mono">
              Pendentes
            </span>
            <Clock className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-zinc-800 dark:text-zinc-100">{stats.pending}</span>
            <span className="text-[10px] text-zinc-400">tarefas aguardando</span>
          </div>
          {filterStatus === 'Pendente' && (
            <div className="text-[9px] text-indigo-500 dark:text-indigo-400 font-semibold mt-1 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping"></span>
              Filtro ativo
            </div>
          )}
        </div>

        <div 
          onClick={() => setFilterStatus(filterStatus === 'Em Curso' ? 'all' : 'Em Curso')}
          className={`p-4 rounded-xl border transition-all cursor-pointer select-none relative overflow-hidden group ${
            filterStatus === 'Em Curso' 
              ? 'bg-indigo-50/50 border-indigo-300 dark:bg-indigo-900/10 dark:border-indigo-800' 
              : 'bg-white border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-750 shadow-sm'
          }`}
        >
          <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-550"></div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-550 dark:text-indigo-400 font-mono">
              Em Curso
            </span>
            <Play className="w-4 h-4 text-indigo-550 dark:text-indigo-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-indigo-650 dark:text-indigo-300">{stats.inProgress}</span>
            <span className="text-[10px] text-zinc-400">sendo executadas</span>
          </div>
          {filterStatus === 'Em Curso' && (
            <div className="text-[9px] text-indigo-500 dark:text-indigo-400 font-semibold mt-1 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping"></span>
              Filtro ativo
            </div>
          )}
        </div>

        <div 
          onClick={() => setFilterStatus(filterStatus === 'Atrasada' ? 'all' : 'Atrasada')}
          className={`p-4 rounded-xl border transition-all cursor-pointer select-none relative overflow-hidden group ${
            filterStatus === 'Atrasada' 
              ? 'bg-rose-50/50 border-rose-300 dark:bg-rose-900/10 dark:border-rose-800' 
              : 'bg-white border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-750 shadow-sm'
          }`}
        >
          <div className="absolute top-0 left-0 w-1.5 h-full bg-rose-500"></div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider text-rose-600 dark:text-rose-450 font-mono">
              Atrasadas
            </span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400">{stats.overdue}</span>
            <span className="text-[10px] text-zinc-400">prazo expirado</span>
          </div>
          {filterStatus === 'Atrasada' && (
            <div className="text-[9px] text-rose-500 dark:text-rose-400 font-semibold mt-1 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"></span>
              Filtro ativo
            </div>
          )}
        </div>

        <div 
          onClick={() => setFilterStatus(filterStatus === 'Concluída' ? 'all' : 'Concluída')}
          className={`p-4 rounded-xl border transition-all cursor-pointer select-none relative overflow-hidden group ${
            filterStatus === 'Concluída' 
              ? 'bg-emerald-50/50 border-emerald-300 dark:bg-emerald-900/10 dark:border-emerald-800' 
              : 'bg-white border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-750 shadow-sm'
          }`}
        >
          <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500"></div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-650 dark:text-emerald-400 font-mono">
              Concluídas
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-emerald-650 dark:text-emerald-300">{stats.completed}</span>
            <span className="text-[10px] text-zinc-400">arquivadas com sucesso</span>
          </div>
          {filterStatus === 'Concluída' && (
            <div className="text-[9px] text-emerald-500 dark:text-emerald-400 font-semibold mt-1 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
              Filtro ativo
            </div>
          )}
        </div>

      </div>

      {/* AUTOMATION SIMULATOR TRIGGER DECK */}
      <div className="bg-gradient-to-r from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-indigo-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200 font-mono">
              Simulador de Gatilhos Operacionais (Automação de Tarefas)
            </h3>
          </div>
          <span className="text-[9px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500 font-bold border border-indigo-500/20">
            Nexus Workflow Engine
          </span>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-450 mb-4">
          Comprove o funcionamento automático. Ao disparar qualquer evento abaixo, o sistema cria em lote as tarefas necessárias no departamento correto sem intervenção humana.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            onClick={triggerNewMatricula}
            className="flex items-center justify-between px-3.5 py-2.5 bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 hover:border-indigo-400 dark:hover:border-indigo-800 rounded-lg text-xs font-bold text-zinc-800 dark:text-zinc-200 transition-all text-left shadow-sm cursor-pointer group"
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
              <div>
                <span>Nova Matrícula</span>
                <span className="block text-[9px] font-normal text-zinc-500 mt-0.5">3 tarefas (Documentos, Finanças, Contrato)</span>
              </div>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-zinc-400 group-hover:text-indigo-500 transition-colors" />
          </button>

          <button
            onClick={triggerNewDocument}
            className="flex items-center justify-between px-3.5 py-2.5 bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 hover:border-emerald-400 dark:hover:border-emerald-800 rounded-lg text-xs font-bold text-zinc-800 dark:text-zinc-200 transition-all text-left shadow-sm cursor-pointer group"
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <div>
                <span>Novo Documento Uploaded</span>
                <span className="block text-[9px] font-normal text-zinc-500 mt-0.5">3 tarefas (Validar, Classificar, Aprovar)</span>
              </div>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-zinc-400 group-hover:text-emerald-500 transition-colors" />
          </button>

          <button
            onClick={triggerLatePayment}
            className="flex items-center justify-between px-3.5 py-2.5 bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 hover:border-red-400 dark:hover:border-red-800 rounded-lg text-xs font-bold text-zinc-800 dark:text-zinc-200 transition-all text-left shadow-sm cursor-pointer group"
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-rose-500"></div>
              <div>
                <span>Pagamento em Atraso (Vencido)</span>
                <span className="block text-[9px] font-normal text-zinc-500 mt-0.5">1 tarefa crítica no Financeiro</span>
              </div>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-zinc-400 group-hover:text-red-500 transition-colors" />
          </button>
        </div>
      </div>

      {/* MAIN TWO-COLUMN SPLIT LAYOUT: LEFT SIDEBAR INDICES & RIGHT EXPANDED CONTROLS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN (FILTERS AND PERSONAL INBOX) */}
        <div className="lg:col-span-4 space-y-4">
          
          {/* PERSONAL INBOX (Caixa de Entrada Pessoal) */}
          <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b pb-2.5 border-zinc-150 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200 font-mono">
                  Caixa de Entrada Pessoal
                </h2>
              </div>
              <span className="text-[10px] font-mono font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400 px-2 py-0.5 rounded">
                {currentUserRole.toUpperCase()}
              </span>
            </div>
            
            <div className="flex items-center gap-2 p-2 bg-zinc-50 dark:bg-zinc-950 rounded-lg border border-zinc-150 dark:border-zinc-850">
              <UserCheck className="w-4 h-4 text-indigo-500 shrink-0" />
              <div className="text-[11px] leading-tight text-zinc-600 dark:text-zinc-400">
                Olá <strong className="text-zinc-800 dark:text-zinc-200 font-medium">{currentUserName}</strong>. Abaixo estão as suas tarefas do departamento <strong className="text-zinc-800 dark:text-zinc-200 font-mono">{currentDept}</strong>.
              </div>
            </div>

            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {personalInboxTasks.length === 0 ? (
                <div className="text-center py-6 text-zinc-450 text-xs">
                  Não possui tarefas operacionais pendentes para o seu departamento. Bom trabalho!
                </div>
              ) : (
                personalInboxTasks.map(t => (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTask(t)}
                    className={`p-2.5 rounded-lg border transition-all text-left cursor-pointer ${
                      selectedTask?.id === t.id
                        ? 'bg-indigo-50/50 border-indigo-400 dark:bg-indigo-900/10 dark:border-indigo-850'
                        : 'bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-950 dark:hover:bg-zinc-900 border-zinc-200 dark:border-zinc-850'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-1">
                      <span className="text-[9px] font-mono text-zinc-450">{t.id}</span>
                      <span className={`text-[8px] font-mono font-bold px-1 rounded ${getPriorityBadge(t.priority)}`}>
                        {t.priority}
                      </span>
                    </div>
                    <h4 className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 mt-1 line-clamp-1">
                      {t.title}
                    </h4>
                    <div className="flex items-center justify-between text-[9px] text-zinc-500 mt-2">
                      <span className="flex items-center gap-1 font-medium text-indigo-500">
                        {t.status}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Calendar className="w-2.5 h-2.5" />
                        {t.dueDate}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* FILTERS PANEL */}
          <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-3">
            <div className="flex items-center gap-2 border-b pb-2.5 border-zinc-150 dark:border-zinc-800">
              <SlidersHorizontal className="w-4 h-4 text-zinc-500" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200 font-mono">
                Filtros e Parâmetros
              </h2>
            </div>

            <div className="space-y-2 text-xs">
              
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Responsável</label>
                <select
                  value={filterAssigned}
                  onChange={(e) => setFilterAssigned(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded px-2 py-1 text-xs text-zinc-700 dark:text-zinc-300"
                >
                  <option value="all">Qualquer Responsável</option>
                  <option value="me">Atribuídas a mim</option>
                  <option value="unassigned">Sem Responsável (Não atribuído)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Departamento</label>
                <select
                  value={filterDept}
                  onChange={(e) => setFilterDept(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded px-2 py-1 text-xs text-zinc-700 dark:text-zinc-300"
                >
                  <option value="all">Todos os Departamentos</option>
                  {DEPARTMENTS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Estado</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded px-2 py-1 text-xs text-zinc-700 dark:text-zinc-300"
                >
                  <option value="all">Todos os Estados</option>
                  {STATUSES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Prioridade</label>
                <select
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded px-2 py-1 text-xs text-zinc-700 dark:text-zinc-300"
                >
                  <option value="all">Todas as Prioridades</option>
                  {PRIORITIES.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Prazo</label>
                <select
                  value={filterDeadline}
                  onChange={(e) => setFilterDeadline(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded px-2 py-1 text-xs text-zinc-700 dark:text-zinc-300"
                >
                  <option value="all">Qualquer Prazo</option>
                  <option value="today">Vence Hoje</option>
                  <option value="overdue">Em Atraso / Excedido</option>
                  <option value="week">Vence esta semana</option>
                </select>
              </div>

              <button
                onClick={() => {
                  setSearchTerm('');
                  setFilterDept('all');
                  setFilterPriority('all');
                  setFilterStatus('all');
                  setFilterAssigned('all');
                  setFilterDeadline('all');
                }}
                className="w-full py-1.5 mt-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-[10px] font-bold uppercase text-zinc-600 dark:text-zinc-300 rounded transition-colors text-center cursor-pointer"
              >
                Limpar Todos os Filtros
              </button>

            </div>
          </div>

        </div>

        {/* RIGHT COLUMN (TASK LIST & DETAILED CONTROLS) */}
        <div className="lg:col-span-8 space-y-4">
          
          {/* SEARCH BAR */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Pesquisar tarefas por título, descrição, ID ou responsável..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* ACTIVE TASK VIEW & ACTIONS SPLIT */}
          {selectedTask && (
            <div className="bg-white dark:bg-zinc-900 border border-indigo-400/30 dark:border-indigo-800/50 p-5 rounded-xl shadow-md space-y-4 animate-fadeIn relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-indigo-650"></div>
              
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 border-b pb-3 border-zinc-150 dark:border-zinc-850">
                <div>
                  <span className="text-[10px] font-mono text-zinc-450 tracking-wider font-bold block">
                    DETALHES DA TAREFA OPERACIONAL
                  </span>
                  <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-150 mt-0.5 flex items-center gap-1.5">
                    <span className="font-mono text-indigo-500 bg-indigo-500/10 px-1.5 py-0.5 rounded text-[10px]">{selectedTask.id}</span>
                    {selectedTask.title}
                  </h3>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] border px-2 py-0.5 rounded font-medium ${getStatusBadge(selectedTask.status)}`}>
                    {selectedTask.status}
                  </span>
                  <span className={`text-[10px] border px-2 py-0.5 rounded font-medium ${getPriorityBadge(selectedTask.priority)}`}>
                    {selectedTask.priority}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                
                <div className="space-y-1">
                  <span className="text-[10px] text-zinc-400 block font-mono uppercase">Departamento</span>
                  <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300 font-medium">
                    <Building2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    {selectedTask.department}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-zinc-400 block font-mono uppercase">Responsável Designado</span>
                  <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300 font-medium">
                    <User className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    {selectedTask.assignedTo || <span className="text-zinc-400 italic">Não atribuído</span>}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-zinc-400 block font-mono uppercase">Data de Criação</span>
                  <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300 font-medium">
                    <Calendar className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    {selectedTask.createdAt}
                  </div>
                </div>

              </div>

              <div className="p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-lg text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                <span className="text-[10px] text-zinc-450 font-bold block mb-1">Descrição / Instruções Operativas:</span>
                {selectedTask.description}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs pt-2 border-t border-zinc-150 dark:border-zinc-850">
                <div>
                  <span className="text-[10px] text-zinc-400 block font-mono uppercase">Prazo de Entrega</span>
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">{selectedTask.dueDate}</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 block font-mono uppercase">Data Limite Máxima</span>
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">{selectedTask.limitDate}</span>
                </div>
                {selectedTask.createdAutomatically && (
                  <div className="col-span-2">
                    <span className="text-[10px] text-indigo-400 block font-mono uppercase">Gatilho Automático</span>
                    <span className="text-[10px] bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400 px-2 py-0.5 rounded font-mono font-bold border border-indigo-200/40">
                      Nexus Engine Auto
                    </span>
                  </div>
                )}
              </div>

              {/* ACTION BUTTONS FOR THE SELECTED TASK */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3.5 border-zinc-150 dark:border-zinc-850">
                
                <div className="flex items-center gap-2">
                  {selectedTask.status !== 'Concluída' && (
                    <button
                      onClick={() => handleCompleteTask(selectedTask.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold cursor-pointer transition-all"
                    >
                      <Check className="w-4 h-4" />
                      Marcar como Concluída
                    </button>
                  )}
                  {selectedTask.status === 'Pendente' && (
                    <button
                      onClick={() => handleChangeStatus(selectedTask.id, 'Em Curso')}
                      className="px-3 py-1.5 bg-indigo-650 hover:bg-indigo-600 text-white rounded-lg text-xs font-semibold cursor-pointer transition-all"
                    >
                      Iniciar Trabalho
                    </button>
                  )}
                  {selectedTask.status === 'Em Curso' && (
                    <button
                      onClick={() => handleChangeStatus(selectedTask.id, 'Aguardando Aprovação')}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-white rounded-lg text-xs font-semibold cursor-pointer transition-all"
                    >
                      Submeter para Aprovação
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <select
                    value={selectedTask.status}
                    onChange={(e) => handleChangeStatus(selectedTask.id, e.target.value as TaskState)}
                    className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer"
                  >
                    {STATUSES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>

                  <select
                    value={selectedTask.priority}
                    onChange={(e) => handleChangePriority(selectedTask.id, e.target.value as TaskPriority)}
                    className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer"
                  >
                    {PRIORITIES.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>

                  <button
                    onClick={() => handleDeleteTask(selectedTask.id)}
                    className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded border border-transparent hover:border-red-200/50 transition-all cursor-pointer"
                    title="Eliminar Tarefa"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

              </div>

            </div>
          )}

          {/* MAIN TASK GRID / LIST */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-zinc-150 dark:border-zinc-800 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200 font-mono">
                Quadro de Operações ({filteredTasks.length} de {tasks.length} Tarefas)
              </h3>
              <span className="text-[10px] text-zinc-500 font-mono">
                Actualizado em tempo real
              </span>
            </div>

            {filteredTasks.length === 0 ? (
              <div className="p-10 text-center text-zinc-450 text-xs">
                Nenhuma tarefa corresponde aos filtros aplicados. Tente ajustar os critérios de pesquisa.
              </div>
            ) : (
              <div className="divide-y divide-zinc-150 dark:divide-zinc-850">
                {filteredTasks.map(t => (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTask(t)}
                    className={`p-4 transition-all hover:bg-zinc-50 dark:hover:bg-zinc-850 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs ${
                      selectedTask?.id === t.id ? 'bg-indigo-50/20 dark:bg-indigo-900/5' : ''
                    }`}
                  >
                    <div className="space-y-1.5 max-w-xl">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[10px] text-indigo-500 bg-indigo-500/10 px-1.5 py-0.5 rounded font-bold">
                          {t.id}
                        </span>
                        <span className={`text-[9px] border px-1.5 rounded font-mono font-bold uppercase ${
                          t.department === 'Secretaria' ? 'border-zinc-300 text-zinc-650' :
                          t.department === 'Financeiro' ? 'border-emerald-300 text-emerald-600' :
                          t.department === 'Professor' ? 'border-indigo-300 text-indigo-650' :
                          t.department === 'Direção' ? 'border-amber-300 text-amber-600' :
                          'border-zinc-300 text-zinc-600'
                        }`}>
                          {t.department}
                        </span>
                        <span className={`text-[9px] px-1.5 py-0.5 border rounded-full font-semibold ${getPriorityBadge(t.priority)}`}>
                          {t.priority}
                        </span>
                        <span className={`text-[9px] px-1.5 py-0.5 border rounded font-semibold ${getStatusBadge(t.status)}`}>
                          {t.status}
                        </span>
                      </div>
                      
                      <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-150">
                        {t.title}
                      </h4>
                      <p className="text-[11px] text-zinc-500 line-clamp-1">
                        {t.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 text-[10px] text-zinc-450 shrink-0 justify-between md:justify-end">
                      <div className="space-y-0.5 text-left md:text-right">
                        <span className="text-zinc-400 block font-mono uppercase text-[8px]">Responsável</span>
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">{t.assignedTo || 'Não atribuído'}</span>
                      </div>
                      
                      <div className="space-y-0.5 text-left md:text-right">
                        <span className="text-zinc-400 block font-mono uppercase text-[8px]">Prazo</span>
                        <span className={`font-mono font-bold ${
                          t.status === 'Atrasada' ? 'text-rose-500' : 'text-zinc-600 dark:text-zinc-400'
                        }`}>{t.dueDate}</span>
                      </div>
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* CREATE MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[1000] p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl w-full max-w-lg p-5 shadow-2xl space-y-4 animate-scaleUp">
            
            <div className="flex items-center justify-between border-b pb-2 border-zinc-150 dark:border-zinc-800">
              <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                <ClipboardCheck className="w-5 h-5 text-indigo-500" />
                Criar Nova Tarefa Operacional
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg cursor-pointer font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-3 text-xs">
              
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Título da Tarefa *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Lançar pauta sumativa - Turma 10B"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Descrição / Notas Operativas</label>
                <textarea
                  placeholder="Ex: Detalhar notas de avaliação continua e sumativa dos alunos antes do dia 28..."
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Colaborador Atribuído</label>
                  <input
                    type="text"
                    placeholder="Ex: Prof. João Silva"
                    value={newAssigned}
                    onChange={(e) => setNewAssigned(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Departamento Destinatário</label>
                  <select
                    value={newDept}
                    onChange={(e) => setNewDept(e.target.value as SchoolTask['department'])}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300"
                  >
                    {DEPARTMENTS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                    <option value="Todos">Todos (Público)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Prioridade</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300"
                  >
                    {PRIORITIES.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Estado Inicial</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as TaskState)}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300"
                  >
                    {STATUSES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Prazo de Conclusão</label>
                  <input
                    type="date"
                    required
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Data Limite Máxima</label>
                  <input
                    type="date"
                    required
                    value={newLimitDate}
                    onChange={(e) => setNewLimitDate(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-150 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-350 rounded font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-semibold cursor-pointer shadow-sm"
                >
                  Gravar Tarefa
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
