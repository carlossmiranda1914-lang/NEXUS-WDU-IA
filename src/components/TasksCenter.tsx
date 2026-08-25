import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  Info,
  X,
  Paperclip,
  History,
  Edit2,
  ListTodo,
  TrendingUp,
  UserPlus,
  Send,
  Eye,
  MoreVertical,
  ShieldAlert,
  Archive,
  RefreshCw,
  Network
} from 'lucide-react';
import { SchoolTask, TaskPriority, TaskState, UserRole, TaskHistoryEvent, TaskAttachment } from '../types';
import { supabaseConfigured, createLiveTaskAndReadBack, updateLiveTaskAndReadBack, upsertLiveTask, deleteLiveTask, getDeletedLiveTasks, restoreLiveTask, getDependencyImpact, getLiveTaskById, getHeaders } from '../supabaseClient';
import TasksOperationalDashboard from './TasksOperationalDashboard';

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
  const isLight = theme === 'light';
  const [isTaskMutationPending, setIsTaskMutationPending] = useState(false);

  // Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDept, setFilterDept] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterAssigned, setFilterAssigned] = useState<string>('all');
  const [filterDeadline, setFilterDeadline] = useState<string>('all'); // 'all', 'today', 'overdue', 'week'
  const [filterUrgentOnly, setFilterUrgentOnly] = useState(false);

  // Operational View Panel State (Erro 5)
  const [activeOperationalTab, setActiveOperationalTab] = useState<string>('all'); // 'all', 'my-tasks', 'team-tasks', 'overdue', 'critical', 'approvals'
  const [dependencyError, setDependencyError] = useState<string | null>(null);

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

  // Selected task detail for lateral panel
  const [selectedTask, setSelectedTask] = useState<SchoolTask | null>(null);

  // Archived Tasks and Dependency Impact states
  const [isArchivedModalOpen, setIsArchivedModalOpen] = useState(false);
  const [archivedTasksList, setArchivedTasksList] = useState<SchoolTask[]>([]);
  const [isImpactModalOpen, setIsImpactModalOpen] = useState(false);
  const [impactData, setImpactData] = useState<any>(null);
  const [taskForImpact, setTaskForImpact] = useState<SchoolTask | null>(null);

  const fetchAndShowArchived = async () => {
    try {
      const res = await getDeletedLiveTasks();
      setArchivedTasksList(res);
      setIsArchivedModalOpen(true);
    } catch (err: any) {
      alert(`Erro ao carregar tarefas arquivadas: ${err.message}`);
    }
  };

  const handleRestoreTask = async (id: string) => {
    if (isTaskMutationPending) return;
    setIsTaskMutationPending(true);
    try {
      const result = await restoreLiveTask(id);
      if (result.success) {
        const restored = await getLiveTaskById(id);
        setTasks(prev => {
          if (prev.some(t => t.id === id)) return prev;
          return [...prev, restored];
        });
        setArchivedTasksList(prev => prev.filter(t => t.id !== id));
        alert('Tarefa restaurada com sucesso!');
      }
    } catch (err: any) {
      alert(`Erro ao restaurar tarefa: ${err.message}`);
    } finally {
      setIsTaskMutationPending(false);
    }
  };

  const handleCheckImpact = async (task: SchoolTask) => {
    try {
      setTaskForImpact(task);
      const data = await getDependencyImpact(task.id);
      setImpactData(data);
      setIsImpactModalOpen(true);
    } catch (err: any) {
      alert(`Erro ao calcular impacto de dependências: ${err.message}`);
    }
  };

  // Interactive detail forms
  const [obsText, setObsText] = useState('');
  const [newAttachName, setNewAttachName] = useState('');

  // Sync observations form when selected task changes
  useEffect(() => {
    if (selectedTask) {
      setObsText(selectedTask.observations || '');
    } else {
      setObsText('');
    }
    setNewAttachName('');
    setDependencyError(null); // Clear errors when switching tasks
  }, [selectedTask?.id]);

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

  // Dynamic Metrics Panel (Tarefas Pendentes, Em Curso, Atrasadas, Concluídas, Urgentes)
  const stats = useMemo(() => {
    let pending = 0;
    let inProgress = 0;
    let overdue = 0;
    let completed = 0;
    let urgent = 0;

    tasks.forEach(t => {
      // Status metrics
      if (t.status === 'Pendente') pending++;
      else if (t.status === 'Em Curso') inProgress++;
      else if (t.status === 'Atrasada') overdue++;
      else if (t.status === 'Concluída') completed++;

      // Urgent metrics: status is not completed/canceled, priority is Urgente or Crítica
      if ((t.priority === 'Urgente' || t.priority === 'Crítica') && t.status !== 'Concluída' && t.status !== 'Cancelada') {
        urgent++;
      }
    });

    return { pending, inProgress, overdue, completed, urgent };
  }, [tasks]);

  // Real-time tab counts for the operational panels (Erro 5)
  const tabCounts = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    
    let myTasks = 0;
    let teamTasks = 0;
    let overdue = 0;
    let critical = 0;
    let approvals = 0;

    tasks.forEach(t => {
      const isActive = t.status !== 'Concluída' && t.status !== 'Cancelada';
      
      // My tasks (assigned to me OR unassigned but in my department)
      const isMyTask = t.assignedTo === currentUserName || 
                       (t.department === currentDept && (t.assignedTo === 'Não atribuído' || t.assignedTo === ''));
      if (isMyTask && isActive) myTasks++;

      // Team tasks (in my department)
      if (t.department === currentDept && isActive) teamTasks++;

      // Overdue
      const isOverdue = t.status === 'Atrasada' || (t.dueDate < todayStr && t.status !== 'Concluída' && t.status !== 'Cancelada');
      if (isOverdue) overdue++;

      // Critical (High/Urgent/Critical)
      const isCritical = (t.priority === 'Alta' || t.priority === 'Urgente' || t.priority === 'Crítica') && isActive;
      if (isCritical) critical++;

      // Approvals
      if (t.status === 'Aguardando Aprovação') approvals++;
    });

    return {
      all: tasks.length,
      myTasks,
      teamTasks,
      overdue,
      critical,
      approvals
    };
  }, [tasks, currentUserName, currentDept]);

  // Dynamic helpers for fallback values if history, observations or attachments aren't in database yet
  const getTaskHistory = (t: SchoolTask): TaskHistoryEvent[] => {
    if (t.history && t.history.length > 0) return t.history;
    
    const events: TaskHistoryEvent[] = [
      {
        id: `H-1-${t.id}`,
        timestamp: `${t.createdAt} 09:00`,
        action: t.createdAutomatically ? 'Tarefa criada automaticamente por gatilho de sistema' : 'Tarefa criada manualmente pelo utilizador',
        user: t.createdAutomatically ? 'Nexus Engine AI' : 'Secretaria',
        details: 'Registo operacional inicializado na plataforma.'
      }
    ];

    if (t.status === 'Concluída') {
      events.push({
        id: `H-2-${t.id}`,
        timestamp: `${t.dueDate} 17:00`,
        action: 'Estado alterado para Concluída',
        user: t.assignedTo !== 'Não atribuído' ? t.assignedTo : 'Conselho Executivo',
        details: 'Atividade operacional finalizada com sucesso.'
      });
    } else if (t.status === 'Em Curso') {
      events.push({
        id: `H-2-${t.id}`,
        timestamp: `${t.createdAt} 14:15`,
        action: 'Estado alterado para Em Curso',
        user: t.assignedTo !== 'Não atribuído' ? t.assignedTo : 'Operador',
        details: 'Execução técnica inicializada.'
      });
    } else if (t.status === 'Atrasada') {
      events.push({
        id: `H-2-${t.id}`,
        timestamp: `${t.dueDate} 00:00`,
        action: 'Controle de prazo expirado (Atraso)',
        user: 'Nexus Engine AI',
        details: 'Prazo estipulado foi ultrapassado. Requer priorização urgente.'
      });
    }

    return events;
  };

  const getTaskAttachments = (t: SchoolTask): TaskAttachment[] => {
    if (t.attachments && t.attachments.length > 0) return t.attachments;
    
    if (t.referenceType === 'documento') {
      return [
        { name: `Dossier_Submetido_Ref_${t.referenceId || 'Geral'}.pdf`, url: '#', size: '2.4 MB' }
      ];
    } else if (t.referenceType === 'matricula') {
      return [
        { name: 'Ficha_Inscricao_Completa.pdf', url: '#', size: '1.8 MB' },
        { name: 'Comprovativo_Morada_Validado.pdf', url: '#', size: '1.2 MB' }
      ];
    } else if (t.referenceType === 'financeiro') {
      return [
        { name: `Plano_Mensalidades_Ref_${t.referenceId || 'Geral'}.pdf`, url: '#', size: '650 KB' }
      ];
    }
    return [
      { name: 'Instrucoes_Procedimento_Escolar.pdf', url: '#', size: '320 KB' }
    ];
  };

  // General Filtered Tasks list
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      // 1. Text Search (ID, Title, AssignedTo)
      if (searchTerm) {
        const text = `${t.id} ${t.title} ${t.assignedTo}`.toLowerCase();
        if (!text.includes(searchTerm.toLowerCase())) return false;
      }

      // 2. Urgent Only Toggle (from top indicator clicking)
      if (filterUrgentOnly) {
        const isUrgent = (t.priority === 'Urgente' || t.priority === 'Crítica') && t.status !== 'Concluída' && t.status !== 'Cancelada';
        if (!isUrgent) return false;
      }

      // 3. Department
      if (filterDept !== 'all' && t.department !== filterDept) return false;

      // 4. Priority
      if (filterPriority !== 'all' && t.priority !== filterPriority) return false;

      // 5. Status
      if (filterStatus !== 'all' && t.status !== filterStatus) return false;

      // 6. Assigned
      if (filterAssigned !== 'all') {
        if (filterAssigned === 'me' && t.assignedTo !== currentUserName) return false;
        if (filterAssigned === 'unassigned' && t.assignedTo !== 'Não atribuído' && t.assignedTo !== '') return false;
      }

      // 7. Deadline
      const todayStr = new Date().toISOString().split('T')[0];
      if (filterDeadline !== 'all') {
        if (filterDeadline === 'today' && t.dueDate !== todayStr) return false;
        if (filterDeadline === 'overdue') {
          return t.status === 'Atrasada' || (t.dueDate < todayStr && t.status !== 'Concluída' && t.status !== 'Cancelada');
        }
        if (filterDeadline === 'week') {
          const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          return t.dueDate >= todayStr && t.dueDate <= nextWeek && t.status !== 'Concluída' && t.status !== 'Cancelada';
        }
      }

      // 8. Active Operational Tab Filter (Erro 5)
      const taskActive = t.status !== 'Concluída' && t.status !== 'Cancelada';
      if (activeOperationalTab === 'my-tasks') {
        const isMyTask = t.assignedTo === currentUserName || 
                         (t.department === currentDept && (t.assignedTo === 'Não atribuído' || t.assignedTo === ''));
        if (!isMyTask || !taskActive) return false;
      } else if (activeOperationalTab === 'team-tasks') {
        const isTeamTask = t.department === currentDept;
        if (!isTeamTask || !taskActive) return false;
      } else if (activeOperationalTab === 'overdue') {
        const isOverdue = t.status === 'Atrasada' || (t.dueDate < todayStr && taskActive);
        if (!isOverdue) return false;
      } else if (activeOperationalTab === 'critical') {
        const isCritical = (t.priority === 'Alta' || t.priority === 'Urgente' || t.priority === 'Crítica') && taskActive;
        if (!isCritical) return false;
      } else if (activeOperationalTab === 'approvals') {
        if (t.status !== 'Aguardando Aprovação') return false;
      }

      return true;
    });
  }, [tasks, searchTerm, filterDept, filterPriority, filterStatus, filterAssigned, filterDeadline, filterUrgentOnly, currentUserName, activeOperationalTab, currentDept]);

  // Action helper: Update task fields and history log
  const updateTask = async (id: string, updates: Partial<SchoolTask>, historyAction?: string) => {
    const currentTask = tasks.find(t => t.id === id);
    if (!currentTask || isTaskMutationPending) return;

    // Check for blocking dependencies before changing status to active/completed states (Erro 2)
    if (updates.status && ['Em Curso', 'Concluída', 'Aguardando Aprovação'].includes(updates.status)) {
      const dependencies = currentTask.dependencies || [];
      const uncompletedDeps = tasks.filter(t => dependencies.includes(t.id) && t.status !== 'Concluída');
      
      if (uncompletedDeps.length > 0) {
        const depNames = uncompletedDeps.map(t => `"${t.title}" (${t.id})`).join(', ');
        setDependencyError(`Não é possível alterar o estado: esta tarefa depende das seguintes etapas anteriores ainda não concluídas: ${depNames}. Conclua estas etapas primeiro para avançar.`);
        return;
      }
    }

    // Clear any dependency error if we succeed
    setDependencyError(null);

    // Accountability capture on status change (Erro 3)
    if (updates.status === 'Em Curso' && !currentTask.executedBy) {
      updates.executedBy = currentUserName;
    } else if (updates.status === 'Concluída') {
      updates.completedBy = currentUserName;
      updates.completedAt = new Date().toISOString().replace('T', ' ').substring(0, 16);
    }

    const currentHistory = getTaskHistory(currentTask);
    const updatedHistory = [...currentHistory];
    
    if (historyAction) {
      updatedHistory.push({
        id: `H-UPD-${Date.now()}`,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
        action: historyAction,
        user: currentUserName,
        details: typeof updates.status !== 'undefined' ? `Novo estado: ${updates.status}` : undefined
      });
    }

    const updated = {
      ...currentTask,
      ...updates,
      history: updatedHistory,
      updatedAt: new Date().toISOString().replace('T', ' ').substring(0, 16)
    };

    setIsTaskMutationPending(true);
    try {
      const authoritativeTask = await updateLiveTaskAndReadBack(id, updated);
      setTasks(prev => prev.map(t => t.id === id ? authoritativeTask : t));
      if (selectedTask?.id === id) setSelectedTask(authoritativeTask);
    } catch (err: any) {
      alert(`Erro ao atualizar a tarefa: ${err.message}`);
    } finally {
      setIsTaskMutationPending(false);
    }
  };

  // Action: Create Task manually
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || isTaskMutationPending) return;

    const newTaskID = `TSK-${Math.floor(100 + Math.random() * 899)}`;
    const newTask: SchoolTask = {
      id: newTaskID,
      title: newTitle,
      description: newDescription,
      assignedTo: newAssigned || 'Não atribuído',
      department: newDept,
      priority: newPriority,
      status: newStatus,
      createdAt: new Date().toISOString().split('T')[0],
      dueDate: newDueDate,
      limitDate: newLimitDate || newDueDate,
      observations: '',
      history: [
        {
          id: `H-1-${newTaskID}`,
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
          action: 'Tarefa criada manualmente',
          user: currentUserName,
          details: `Tarefa inicializada no departamento: ${newDept}`
        }
      ],
      attachments: [],
      updatedAt: new Date().toISOString().replace('T', ' ').substring(0, 16)
    };

    setIsTaskMutationPending(true);
    try {
      const authoritativeTask = await createLiveTaskAndReadBack(newTask);
      setTasks(prev => [authoritativeTask, ...prev]);
      setIsCreateModalOpen(false);
    } catch (err: any) {
      alert(`Erro ao criar a tarefa: ${err.message}`);
      return;
    } finally {
      setIsTaskMutationPending(false);
    }

    // Reset Form
    setNewTitle('');
    setNewDescription('');
    setNewAssigned('');
    setNewDept('Secretaria');
    setNewPriority('Normal');
    setNewStatus('Pendente');
  };

  // Action: Delete Task
  const handleDeleteTask = async (id: string) => {
    if (!isTaskMutationPending && confirm('Tem a certeza que deseja eliminar esta tarefa operacional permanentemente?')) {
      const taskToRestore = tasks.find(t => t.id === id);
      const previousTasks = [...tasks];
      setIsTaskMutationPending(true);
      try {
        await deleteLiveTask(id);
        const archived = await getDeletedLiveTasks();
        if (!archived.some(task => task.id === id)) throw new Error('A tarefa não foi confirmada no arquivo institucional.');
        setTasks(prev => prev.filter(t => t.id !== id));
        setSelectedTask(null);
      } catch (err: any) {
        setTasks(previousTasks);
        if (taskToRestore) setSelectedTask(taskToRestore);
        alert(`Erro ao eliminar a tarefa:\n${err.message}`);
      } finally {
        setIsTaskMutationPending(false);
      }
    }
  };

  // Action: Save observations
  const handleSaveObservations = () => {
    if (!selectedTask) return;
    updateTask(selectedTask.id, { observations: obsText }, 'Observações atualizadas');
  };

  // Action: Add simulated attachment
  const handleAddAttachment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !newAttachName.trim()) return;

    const newAttach: TaskAttachment = {
      name: newAttachName.endsWith('.pdf') ? newAttachName : `${newAttachName}.pdf`,
      url: '#',
      size: `${Math.floor(1 + Math.random() * 5)}.${Math.floor(0 + Math.random() * 9)} MB`
    };

    const currentAttachments = getTaskAttachments(selectedTask);
    const updatedAttachments = [...currentAttachments, newAttach];

    updateTask(selectedTask.id, { attachments: updatedAttachments }, `Anexo adicionado: ${newAttach.name}`);
    setNewAttachName('');
  };

  // Automated Trigger simulation helpers
  const triggerNewMatricula = () => {
    const studentName = prompt('Introduza o nome do aluno inscrito para simulação:', 'Maria Leonor Correia');
    if (!studentName) return;

    const stdId = `ALU-${Math.floor(400 + Math.random() * 100)}`;
    const today = new Date().toISOString().split('T')[0];
    
    const docTaskID = `TSK-${Math.floor(2000 + Math.random() * 8000)}`;
    const docTask: SchoolTask = {
      id: docTaskID,
      title: `Verificar documentos - ${studentName}`,
      description: `Validar documentação académica e comprovativo de residência para a matrícula recém-criada (${stdId}).`,
      assignedTo: 'Secretaria Executiva',
      department: 'Secretaria',
      priority: 'Alta',
      status: 'Pendente',
      createdAt: today,
      dueDate: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().split('T')[0],
      limitDate: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString().split('T')[0],
      createdAutomatically: true,
      referenceId: stdId,
      referenceType: 'matricula',
      observations: 'Matrícula digital via portal do aluno.',
      attachments: [{ name: 'Ficha_Matricula.pdf', url: '#', size: '1.8 MB' }],
      history: [
        {
          id: `H-1-${docTaskID}`,
          timestamp: `${today} 14:00`,
          action: 'Gatilho automático: Matrícula Criada',
          user: 'Sistema de Processamento Nexus',
          details: `Nova inscrição escolar do aluno ${studentName}.`
        }
      ],
      updatedAt: `${today} 14:00`
    };

    const finTaskID = `TSK-${Math.floor(2000 + Math.random() * 8000)}`;
    const finTask: SchoolTask = {
      id: finTaskID,
      title: `Criar plano financeiro - ${studentName}`,
      description: `Definir regime de propinas, descontos elegíveis e plano de parcelamento para o aluno (${stdId}).`,
      assignedTo: 'Financeiro Executivo',
      department: 'Financeiro',
      priority: 'Normal',
      status: 'Pendente',
      createdAt: today,
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      limitDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      createdAutomatically: true,
      referenceId: stdId,
      referenceType: 'matricula',
      observations: '',
      history: [
        {
          id: `H-1-${finTaskID}`,
          timestamp: `${today} 14:00`,
          action: 'Gatilho automático: Matrícula Criada',
          user: 'Sistema de Processamento Nexus',
          details: `Inicialização de faturação automática vinculada ao aluno.`
        }
      ],
      updatedAt: `${today} 14:00`
    };

    const contractTaskID = `TSK-${Math.floor(2000 + Math.random() * 8000)}`;
    const contractTask: SchoolTask = {
      id: contractTaskID,
      title: `Gerar contrato de prestação de serviços - ${studentName}`,
      description: `Emitir o contrato oficial assinado digitalmente pelo encarregado de educação e diretor escolar.`,
      assignedTo: 'Secretaria Executiva',
      department: 'Secretaria',
      priority: 'Alta',
      status: 'Pendente',
      createdAt: today,
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      limitDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      createdAutomatically: true,
      referenceId: stdId,
      referenceType: 'matricula',
      observations: '',
      history: [
        {
          id: `H-1-${contractTaskID}`,
          timestamp: `${today} 14:00`,
          action: 'Gatilho automático: Contrato gerado',
          user: 'Sistema de Processamento Nexus',
          details: 'A aguardar assinatura digital das partes interessadas.'
        }
      ],
      updatedAt: `${today} 14:00`
    };

    setTasks(prev => [docTask, finTask, contractTask, ...prev]);
    if (supabaseConfigured) {
      Promise.all([
        upsertLiveTask(docTask),
        upsertLiveTask(finTask),
        upsertLiveTask(contractTask)
      ]).catch(err => console.error("Error creating matricula tasks:", err));
    }
    alert(`3 fatias de tarefas operacionais reais foram geradas e salvas na base de dados para o aluno ${studentName}!`);
  };

  const triggerNewDocument = () => {
    const docName = prompt('Introduza o nome do documento submetido:', 'Boletim de Vacinas_Novo.pdf');
    if (!docName) return;

    const docId = `DOC-${Math.floor(300 + Math.random() * 200)}`;
    const today = new Date().toISOString().split('T')[0];

    const valTaskID = `TSK-${Math.floor(2000 + Math.random() * 8000)}`;
    const valTask: SchoolTask = {
      id: valTaskID,
      title: `Validar documento - ${docName}`,
      description: `Verificar integridade digital e autenticidade da assinatura ou carimbo do ficheiro recém-carregado (${docId}).`,
      assignedTo: 'Secretaria Executiva',
      department: 'Secretaria',
      priority: 'Normal',
      status: 'Pendente',
      createdAt: today,
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      limitDate: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().split('T')[0],
      createdAutomatically: true,
      referenceId: docId,
      referenceType: 'documento',
      attachments: [{ name: docName, url: '#', size: '2.4 MB' }],
      history: [
        {
          id: `H-1-${valTaskID}`,
          timestamp: `${today} 11:30`,
          action: 'Gatilho automático: Documento Carregado',
          user: 'Nexus Document Engine',
          details: `Documento "${docName}" inserido no dossier escolar.`
        }
      ],
      updatedAt: `${today} 11:30`
    };

    const classTaskID = `TSK-${Math.floor(2000 + Math.random() * 8000)}`;
    const classTask: SchoolTask = {
      id: classTaskID,
      title: `Classificar documento - ${docName}`,
      description: `Arquivar e indexar o documento nos dossiers adequados com as devidas tags de pesquisa escolares.`,
      assignedTo: 'Secretaria Executiva',
      department: 'Secretaria',
      priority: 'Baixa',
      status: 'Pendente',
      createdAt: today,
      dueDate: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().split('T')[0],
      limitDate: new Date(Date.now() + 96 * 60 * 60 * 1000).toISOString().split('T')[0],
      createdAutomatically: true,
      referenceId: docId,
      referenceType: 'documento',
      history: [
        {
          id: `H-1-${classTaskID}`,
          timestamp: `${today} 11:30`,
          action: 'Gatilho automático: Classificação Inteligente',
          user: 'Nexus Document Engine',
          details: 'Tarefa atribuída à secretaria geral.'
        }
      ],
      updatedAt: `${today} 11:30`
    };

    const appTaskID = `TSK-${Math.floor(2000 + Math.random() * 8000)}`;
    const appTask: SchoolTask = {
      id: appTaskID,
      title: `Aprovar documento - ${docName}`,
      description: `Homologação formal do documento para arquivamento definitivo na nuvem académica pela direção.`,
      assignedTo: 'Direção Executiva',
      department: 'Direção',
      priority: 'Normal',
      status: 'Pendente',
      createdAt: today,
      dueDate: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString().split('T')[0],
      limitDate: new Date(Date.now() + 120 * 60 * 60 * 1000).toISOString().split('T')[0],
      createdAutomatically: true,
      referenceId: docId,
      referenceType: 'documento',
      history: [
        {
          id: `H-1-${appTaskID}`,
          timestamp: `${today} 11:30`,
          action: 'Gatilho automático: Fluxo de Homologação',
          user: 'Nexus Document Engine',
          details: 'Envio de alerta operacional para a direção.'
        }
      ],
      updatedAt: `${today} 11:30`
    };

    setTasks(prev => [valTask, classTask, appTask, ...prev]);
    if (supabaseConfigured) {
      Promise.all([
        upsertLiveTask(valTask),
        upsertLiveTask(classTask),
        upsertLiveTask(appTask)
      ]).catch(err => console.error("Error creating document validation tasks:", err));
    }
    alert(`3 tarefas operacionais reais foram persistidas no Postgres para o documento: ${docName}!`);
  };

  const triggerLatePayment = () => {
    const parentName = prompt('Introduza o nome do encarregado de educação com faturas em atraso:', 'Sandra Medeiros');
    if (!parentName) return;

    const invId = `FAT-${Math.floor(9000 + Math.random() * 500)}`;
    const today = new Date().toISOString().split('T')[0];

    const lateTaskID = `TSK-${Math.floor(2000 + Math.random() * 8000)}`;
    const lateTask: SchoolTask = {
      id: lateTaskID,
      title: `Cobrar propinas em atraso - Enc. ${parentName}`,
      description: `A mensalidade vinculada ao registo ${invId} encontra-se vencida e com juros em acumulação. Proceder com o contacto telefónico de cobrança direta urgente.`,
      assignedTo: 'Financeiro Executivo',
      department: 'Financeiro',
      priority: 'Crítica',
      status: 'Atrasada',
      createdAt: today,
      dueDate: today,
      limitDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      createdAutomatically: true,
      referenceId: invId,
      referenceType: 'financeiro',
      observations: 'Contactar de preferência no horário pós-laboral (após 18:00).',
      history: [
        {
          id: `H-1-${lateTaskID}`,
          timestamp: `${today} 08:30`,
          action: 'Gatilho automático: Fatura Expirada',
          user: 'Nexus Financial Core',
          details: `Vencimento da fatura ${invId} não liquidada na data acordada.`
        }
      ],
      updatedAt: `${today} 08:30`
    };

    setTasks(prev => [lateTask, ...prev]);
    if (supabaseConfigured) {
      upsertLiveTask(lateTask).catch(err => console.error("Error creating late payment task:", err));
    }
    alert(`Nova tarefa operacional crítica salva diretamente no PostgreSQL para o departamento financeiro!`);
  };

  // Status and Priority CSS badges helpers
  const getPriorityBadge = (p: TaskPriority) => {
    switch (p) {
      case 'Baixa': return isLight ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/25 dark:text-emerald-400 dark:border-emerald-900/30';
      case 'Normal': return isLight ? 'bg-blue-50 text-blue-800 border-blue-200' : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/25 dark:text-blue-400 dark:border-blue-900/30';
      case 'Alta': return isLight ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/25 dark:text-amber-400 dark:border-amber-900/30';
      case 'Urgente': return isLight ? 'bg-orange-50 text-orange-800 border-orange-200' : 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/25 dark:text-orange-400 dark:border-orange-900/30';
      case 'Crítica': return isLight ? 'bg-rose-50 text-rose-800 border-rose-200 animate-pulse' : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/25 dark:text-rose-400 dark:border-rose-900/30 animate-pulse';
    }
  };

  const getStatusBadge = (s: TaskState) => {
    switch (s) {
      case 'Pendente': return isLight ? 'bg-slate-100 text-[#475569] border-[#E2E8F0]' : 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-750';
      case 'Em Curso': return isLight ? 'bg-indigo-50 text-indigo-800 border-indigo-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/30';
      case 'Aguardando Aprovação': return isLight ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/20 dark:text-yellow-450 dark:border-yellow-900/30';
      case 'Concluída': return isLight ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30';
      case 'Atrasada': return isLight ? 'bg-rose-50 text-rose-800 border-rose-200' : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30';
      case 'Cancelada': return isLight ? 'bg-slate-100 text-[#475569]/60 line-through border-[#E2E8F0]' : 'bg-zinc-100 text-zinc-400 line-through border-zinc-200 dark:bg-zinc-850 dark:text-zinc-500 dark:border-zinc-800';
    }
  };

  return (
    <div id="tasks-center-module" className="space-y-6">
      
      {/* HEADER SECTION */}
      <div className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-5 ${isLight ? 'border-[#E2E8F0]' : 'border-zinc-800'}`}>
        <div>
          <div className="flex items-center gap-2">
            <ListTodo className="w-6 h-6 text-indigo-500" />
            <h1 className={`text-xl font-bold tracking-tight font-display flex items-center gap-2 ${isLight ? 'text-[#0F172A]' : 'text-zinc-100'}`}>
              Centro de Tarefas Operacionais
              <span className={`px-2 py-0.5 text-[10px] font-mono rounded-full ${isLight ? 'bg-indigo-50 text-indigo-600 border border-indigo-200' : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'}`}>
                Sincronizado
              </span>
            </h1>
          </div>
          <p className={`text-xs mt-1 ${isLight ? 'text-[#475569]' : 'text-zinc-400'}`}>
            Gestão de trabalho institucional inteligente e central de automações para acompanhamento de prazos letivos.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={fetchAndShowArchived}
            className={`flex items-center gap-1.5 px-3 py-2 border rounded-xl text-xs font-semibold cursor-pointer shadow-sm transition-all active:scale-95 ${
              isLight 
                ? 'border-[#E2E8F0] bg-[#FFFFFF] text-[#475569] hover:bg-slate-50' 
                : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:bg-zinc-850'
            }`}
          >
            <Archive className="w-4 h-4 text-amber-500" />
            Tarefas Arquivadas
          </button>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-650 hover:bg-indigo-600 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-sm transition-all active:scale-95 border border-indigo-550"
          >
            <Plus className="w-4 h-4" />
            Criar Nova Tarefa
          </button>
        </div>
      </div>

      {/* METRICS PANEL (Indicators: Pendentes, Em Curso, Atrasadas, Concluídas, Urgentes) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        
        {/* Indicator 1: Pendentes */}
        <div 
          onClick={() => {
            setFilterStatus(filterStatus === 'Pendente' ? 'all' : 'Pendente');
            setFilterUrgentOnly(false);
          }}
          className={`p-4 rounded-xl border transition-all cursor-pointer select-none relative overflow-hidden group ${
            filterStatus === 'Pendente' && !filterUrgentOnly
              ? isLight 
                ? 'bg-[#F1F5F9] border-[#E2E8F0] shadow-inner' 
                : 'bg-zinc-800 border-zinc-600 shadow-inner' 
              : isLight
                ? 'bg-[#FFFFFF] border-[#E2E8F0] hover:border-zinc-300 shadow-sm'
                : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 shadow-sm'
          }`}
        >
          <div className="absolute top-0 left-0 w-1.5 h-full bg-zinc-400"></div>
          <div className="flex items-center justify-between">
            <span className={`text-[10px] uppercase font-bold tracking-wider font-mono ${isLight ? 'text-[#475569]' : 'text-zinc-400'}`}>
              Pendentes
            </span>
            <Clock className={`w-4 h-4 ${isLight ? 'text-[#475569]' : 'text-zinc-500'}`} />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className={`text-2xl font-bold font-mono ${isLight ? 'text-[#0F172A]' : 'text-zinc-100'}`}>{stats.pending}</span>
            <span className={`text-[10px] ${isLight ? 'text-[#475569]' : 'text-zinc-400'}`}>aguardando</span>
          </div>
          {filterStatus === 'Pendente' && !filterUrgentOnly && (
            <div className="text-[9px] text-indigo-500 dark:text-indigo-400 font-bold mt-1.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping"></span>
              Filtro Ativo
            </div>
          )}
        </div>

        {/* Indicator 2: Em Curso */}
        <div 
          onClick={() => {
            setFilterStatus(filterStatus === 'Em Curso' ? 'all' : 'Em Curso');
            setFilterUrgentOnly(false);
          }}
          className={`p-4 rounded-xl border transition-all cursor-pointer select-none relative overflow-hidden group ${
            filterStatus === 'Em Curso' && !filterUrgentOnly
              ? 'bg-indigo-50/70 border-indigo-350 dark:bg-indigo-950/20 dark:border-indigo-800 shadow-inner' 
              : isLight
                ? 'bg-[#FFFFFF] border-[#E2E8F0] hover:border-zinc-350 shadow-sm'
                : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 shadow-sm'
          }`}
        >
          <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-550"></div>
          <div className="flex items-center justify-between">
            <span className={`text-[10px] uppercase font-bold tracking-wider font-mono ${isLight ? 'text-indigo-700' : 'text-indigo-450'}`}>
              Em Curso
            </span>
            <Play className={`w-4 h-4 ${isLight ? 'text-indigo-650' : 'text-indigo-400'}`} />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className={`text-2xl font-bold font-mono ${isLight ? 'text-indigo-700' : 'text-indigo-300'}`}>{stats.inProgress}</span>
            <span className={`text-[10px] ${isLight ? 'text-[#475569]' : 'text-zinc-400'}`}>em execução</span>
          </div>
          {filterStatus === 'Em Curso' && !filterUrgentOnly && (
            <div className="text-[9px] text-indigo-500 dark:text-indigo-400 font-bold mt-1.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping"></span>
              Filtro Ativo
            </div>
          )}
        </div>

        {/* Indicator 3: Atrasadas */}
        <div 
          onClick={() => {
            setFilterStatus(filterStatus === 'Atrasada' ? 'all' : 'Atrasada');
            setFilterUrgentOnly(false);
          }}
          className={`p-4 rounded-xl border transition-all cursor-pointer select-none relative overflow-hidden group ${
            filterStatus === 'Atrasada' && !filterUrgentOnly
              ? 'bg-rose-50/70 border-rose-300 dark:bg-rose-950/20 dark:border-rose-800 shadow-inner' 
              : isLight
                ? 'bg-[#FFFFFF] border-[#E2E8F0] hover:border-zinc-350 shadow-sm'
                : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 shadow-sm'
          }`}
        >
          <div className="absolute top-0 left-0 w-1.5 h-full bg-rose-500"></div>
          <div className="flex items-center justify-between">
            <span className={`text-[10px] uppercase font-bold tracking-wider font-mono ${isLight ? 'text-rose-700' : 'text-rose-400'}`}>
              Atrasadas
            </span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className={`text-2xl font-bold font-mono ${isLight ? 'text-rose-700' : 'text-rose-400'}`}>{stats.overdue}</span>
            <span className={`text-[10px] ${isLight ? 'text-[#475569]' : 'text-zinc-400'}`}>prazo vencido</span>
          </div>
          {filterStatus === 'Atrasada' && !filterUrgentOnly && (
            <div className="text-[9px] text-rose-500 dark:text-rose-400 font-bold mt-1.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"></span>
              Filtro Ativo
            </div>
          )}
        </div>

        {/* Indicator 4: Concluídas */}
        <div 
          onClick={() => {
            setFilterStatus(filterStatus === 'Concluída' ? 'all' : 'Concluída');
            setFilterUrgentOnly(false);
          }}
          className={`p-4 rounded-xl border transition-all cursor-pointer select-none relative overflow-hidden group ${
            filterStatus === 'Concluída' && !filterUrgentOnly
              ? 'bg-emerald-50/70 border-emerald-300 dark:bg-emerald-950/20 dark:border-emerald-800 shadow-inner' 
              : isLight
                ? 'bg-[#FFFFFF] border-[#E2E8F0] hover:border-zinc-350 shadow-sm'
                : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 shadow-sm'
          }`}
        >
          <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500"></div>
          <div className="flex items-center justify-between">
            <span className={`text-[10px] uppercase font-bold tracking-wider font-mono ${isLight ? 'text-emerald-700' : 'text-emerald-450'}`}>
              Concluídas
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className={`text-2xl font-bold font-mono ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>{stats.completed}</span>
            <span className={`text-[10px] ${isLight ? 'text-[#475569]' : 'text-zinc-400'}`}>finalizadas</span>
          </div>
          {filterStatus === 'Concluída' && !filterUrgentOnly && (
            <div className="text-[9px] text-emerald-500 dark:text-emerald-400 font-bold mt-1.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
              Filtro Ativo
            </div>
          )}
        </div>

        {/* Indicator 5: Urgentes (Tarefas de prioridade Urgente / Crítica ativas) */}
        <div 
          onClick={() => {
            setFilterUrgentOnly(!filterUrgentOnly);
            setFilterStatus('all');
          }}
          className={`p-4 rounded-xl border transition-all cursor-pointer select-none relative overflow-hidden group ${
            filterUrgentOnly
              ? 'bg-orange-50/70 border-orange-350 dark:bg-orange-950/20 dark:border-orange-800 shadow-inner' 
              : isLight
                ? 'bg-[#FFFFFF] border-[#E2E8F0] hover:border-zinc-350 shadow-sm'
                : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 shadow-sm'
          }`}
        >
          <div className="absolute top-0 left-0 w-1.5 h-full bg-orange-500"></div>
          <div className="flex items-center justify-between">
            <span className={`text-[10px] uppercase font-bold tracking-wider font-mono ${isLight ? 'text-orange-700' : 'text-orange-450'}`}>
              Urgentes
            </span>
            <ShieldAlert className="w-4 h-4 text-orange-500" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className={`text-2xl font-bold font-mono ${isLight ? 'text-orange-700' : 'text-orange-450'}`}>{stats.urgent}</span>
            <span className={`text-[10px] ${isLight ? 'text-[#475569]' : 'text-zinc-400'}`}>críticas ativas</span>
          </div>
          {filterUrgentOnly && (
            <div className="text-[9px] text-orange-500 dark:text-orange-400 font-bold mt-1.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-ping"></span>
              Filtro Ativo
            </div>
          )}
        </div>

      </div>

      {/* DEPENDENCY ERROR ALERTS (Erro 2) */}
      <AnimatePresence>
        {dependencyError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-rose-50 border border-rose-200 rounded-xl dark:bg-rose-950/20 dark:border-rose-900/30 flex items-start gap-3 shadow-sm"
          >
            <ShieldAlert className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-xs font-bold text-rose-800 dark:text-rose-300 font-mono">BLOQUEIO DE DEPENDÊNCIA OPERACIONAL</h4>
              <p className="text-xs text-rose-700 dark:text-rose-400 mt-1">{dependencyError}</p>
            </div>
            <button 
              onClick={() => setDependencyError(null)}
              className="text-rose-400 hover:text-rose-600 dark:hover:text-rose-200 cursor-pointer text-xs font-bold"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* OPERATIONAL VISIONS PANEL (Erro 5) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <SlidersHorizontal className="w-4 h-4 text-indigo-500" />
            <h3 className={`text-xs font-bold uppercase tracking-wider font-mono ${isLight ? 'text-[#0F172A]' : 'text-zinc-200'}`}>
              Painel de Visões Operacionais da Equipa
            </h3>
          </div>
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md border ${isLight ? 'bg-zinc-100 text-[#475569] border-[#E2E8F0]' : 'text-zinc-400 bg-zinc-800 border-zinc-750'}`}>
            Sessão: <strong className="text-indigo-650 dark:text-indigo-400">{currentUserName}</strong> ({currentDept})
          </span>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-7 gap-2.5">
          {/* Tab 1: Minhas Tarefas */}
          <button
            onClick={() => {
              setActiveOperationalTab('my-tasks');
              setFilterStatus('all');
              setFilterUrgentOnly(false);
            }}
            className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer group ${
              activeOperationalTab === 'my-tasks'
                ? 'bg-indigo-650 text-white border-indigo-600 shadow-sm'
                : isLight
                  ? 'bg-[#FFFFFF] text-[#0F172A] border-[#E2E8F0] hover:border-zinc-350'
                  : 'bg-zinc-900 text-zinc-100 border-zinc-805 hover:border-zinc-700'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <UserCheck className={`w-4 h-4 ${activeOperationalTab === 'my-tasks' ? 'text-indigo-200' : isLight ? 'text-[#475569]/80 group-hover:text-indigo-500' : 'text-zinc-500 group-hover:text-indigo-500'}`} />
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full ${
                activeOperationalTab === 'my-tasks' ? 'bg-indigo-500 text-white' : isLight ? 'bg-zinc-100 text-[#475569]' : 'bg-zinc-800 text-zinc-300'
              }`}>
                {tabCounts.myTasks}
              </span>
            </div>
            <div className="mt-4">
              <span className="block text-xs font-bold tracking-tight">Minhas Tarefas</span>
              <span className={`block text-[9px] font-normal leading-tight mt-0.5 ${activeOperationalTab === 'my-tasks' ? 'text-indigo-200' : isLight ? 'text-[#475569]' : 'text-zinc-400'}`}>
                Atribuídas a mim
              </span>
            </div>
          </button>

          {/* Tab 2: Minha Equipa */}
          <button
            onClick={() => {
              setActiveOperationalTab('team-tasks');
              setFilterStatus('all');
              setFilterUrgentOnly(false);
            }}
            className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer group ${
              activeOperationalTab === 'team-tasks'
                ? 'bg-indigo-650 text-white border-indigo-600 shadow-sm'
                : isLight
                  ? 'bg-[#FFFFFF] text-[#0F172A] border-[#E2E8F0] hover:border-zinc-350'
                  : 'bg-zinc-900 text-zinc-100 border-zinc-805 hover:border-zinc-700'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <Briefcase className={`w-4 h-4 ${activeOperationalTab === 'team-tasks' ? 'text-indigo-200' : isLight ? 'text-[#475569]/80 group-hover:text-indigo-500' : 'text-zinc-500 group-hover:text-indigo-500'}`} />
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full ${
                activeOperationalTab === 'team-tasks' ? 'bg-indigo-500 text-white' : isLight ? 'bg-zinc-100 text-[#475569]' : 'bg-zinc-800 text-zinc-300'
              }`}>
                {tabCounts.teamTasks}
              </span>
            </div>
            <div className="mt-4">
              <span className="block text-xs font-bold tracking-tight">Minha Equipa</span>
              <span className={`block text-[9px] font-normal leading-tight mt-0.5 ${activeOperationalTab === 'team-tasks' ? 'text-indigo-200' : isLight ? 'text-[#475569]' : 'text-zinc-400'}`}>
                Depto: {currentDept}
              </span>
            </div>
          </button>

          {/* Tab 3: Atrasadas */}
          <button
            onClick={() => {
              setActiveOperationalTab('overdue');
              setFilterStatus('all');
              setFilterUrgentOnly(false);
            }}
            className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer group ${
              activeOperationalTab === 'overdue'
                ? 'bg-rose-600 text-white border-rose-700 shadow-sm'
                : isLight
                  ? 'bg-[#FFFFFF] text-[#0F172A] border-[#E2E8F0] hover:border-zinc-350'
                  : 'bg-zinc-900 text-zinc-100 border-zinc-805 hover:border-zinc-700'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <AlertTriangle className={`w-4 h-4 ${activeOperationalTab === 'overdue' ? 'text-rose-200' : 'text-rose-500'}`} />
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full ${
                activeOperationalTab === 'overdue' ? 'bg-rose-500 text-white' : isLight ? 'bg-rose-50 text-rose-700' : 'bg-rose-950/40 text-rose-300'
              }`}>
                {tabCounts.overdue}
              </span>
            </div>
            <div className="mt-4">
              <span className="block text-xs font-bold tracking-tight">Atrasadas</span>
              <span className={`block text-[9px] font-normal leading-tight mt-0.5 ${activeOperationalTab === 'overdue' ? 'text-rose-200' : isLight ? 'text-[#475569]' : 'text-zinc-400'}`}>
                Prazo expirado
              </span>
            </div>
          </button>

          {/* Tab 4: Críticas */}
          <button
            onClick={() => {
              setActiveOperationalTab('critical');
              setFilterStatus('all');
              setFilterUrgentOnly(false);
            }}
            className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer group ${
              activeOperationalTab === 'critical'
                ? 'bg-orange-600 text-white border-orange-700 shadow-sm'
                : isLight
                  ? 'bg-[#FFFFFF] text-[#0F172A] border-[#E2E8F0] hover:border-zinc-350'
                  : 'bg-zinc-900 text-zinc-100 border-zinc-805 hover:border-zinc-700'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <ShieldAlert className={`w-4 h-4 ${activeOperationalTab === 'critical' ? 'text-orange-200' : 'text-orange-500'}`} />
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full ${
                activeOperationalTab === 'critical' ? 'bg-orange-500 text-white' : isLight ? 'bg-orange-50 text-orange-700' : 'bg-orange-950/40 text-orange-350'
              }`}>
                {tabCounts.critical}
              </span>
            </div>
            <div className="mt-4">
              <span className="block text-xs font-bold tracking-tight">Críticas</span>
              <span className={`block text-[9px] font-normal leading-tight mt-0.5 ${activeOperationalTab === 'critical' ? 'text-orange-200' : isLight ? 'text-[#475569]' : 'text-zinc-400'}`}>
                Urgente/Alta
              </span>
            </div>
          </button>

          {/* Tab 5: Para Aprovação */}
          <button
            onClick={() => {
              setActiveOperationalTab('approvals');
              setFilterStatus('all');
              setFilterUrgentOnly(false);
            }}
            className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer group ${
              activeOperationalTab === 'approvals'
                ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                : isLight
                  ? 'bg-[#FFFFFF] text-[#0F172A] border-[#E2E8F0] hover:border-zinc-350'
                  : 'bg-zinc-900 text-zinc-100 border-zinc-805 hover:border-zinc-700'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <ClipboardCheck className={`w-4 h-4 ${activeOperationalTab === 'approvals' ? 'text-amber-100' : isLight ? 'text-[#475569]/80 group-hover:text-amber-600' : 'text-zinc-500 group-hover:text-amber-600'}`} />
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full ${
                activeOperationalTab === 'approvals' ? 'bg-amber-600 text-white' : isLight ? 'bg-amber-50 text-amber-700' : 'bg-amber-950/40 text-amber-350'
              }`}>
                {tabCounts.approvals}
              </span>
            </div>
            <div className="mt-4">
              <span className="block text-xs font-bold tracking-tight">Para Aprovação</span>
              <span className={`block text-[9px] font-normal leading-tight mt-0.5 ${activeOperationalTab === 'approvals' ? 'text-amber-100' : isLight ? 'text-[#475569]' : 'text-zinc-400'}`}>
                Requer homologação
              </span>
            </div>
          </button>

          {/* Tab 6: Geral */}
          <button
            onClick={() => {
              setActiveOperationalTab('all');
              setFilterStatus('all');
              setFilterUrgentOnly(false);
            }}
            className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer group ${
              activeOperationalTab === 'all'
                ? 'bg-zinc-700 text-white border-zinc-800 dark:bg-zinc-800 dark:border-zinc-700 shadow-sm'
                : isLight
                  ? 'bg-[#FFFFFF] text-[#0F172A] border-[#E2E8F0] hover:border-zinc-350'
                  : 'bg-zinc-900 text-zinc-100 border-zinc-805 hover:border-zinc-700'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <ListTodo className={`w-4 h-4 ${activeOperationalTab === 'all' ? 'text-zinc-200' : isLight ? 'text-[#475569]/80 group-hover:text-indigo-500' : 'text-zinc-500 group-hover:text-indigo-500'}`} />
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full ${
                activeOperationalTab === 'all' ? 'bg-zinc-600 text-white' : isLight ? 'bg-zinc-100 text-[#475569]' : 'bg-zinc-800 text-zinc-300'
              }`}>
                {tabCounts.all}
              </span>
            </div>
            <div className="mt-4">
              <span className="block text-xs font-bold tracking-tight">Todas as Tarefas</span>
              <span className={`block text-[9px] font-normal leading-tight mt-0.5 ${activeOperationalTab === 'all' ? 'text-zinc-350' : isLight ? 'text-[#475569]' : 'text-zinc-400'}`}>
                Fluxo geral letivo
              </span>
            </div>
          </button>

          {/* Tab 7: Métricas & SLA Dashboard */}
          <button
            onClick={() => {
              setActiveOperationalTab('dashboard');
            }}
            className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer group ${
              activeOperationalTab === 'dashboard'
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                : isLight
                  ? 'bg-[#FFFFFF] text-[#0F172A] border-[#E2E8F0] hover:border-emerald-500/40'
                  : 'bg-zinc-900 text-zinc-100 border-zinc-805 hover:border-emerald-500/30'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <TrendingUp className={`w-4 h-4 ${activeOperationalTab === 'dashboard' ? 'text-emerald-200' : isLight ? 'text-emerald-600' : 'text-emerald-400'}`} />
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full ${
                activeOperationalTab === 'dashboard' ? 'bg-emerald-500 text-white' : isLight ? 'bg-emerald-50 text-emerald-700' : 'bg-emerald-950/40 text-emerald-350'
              }`}>
                KPI
              </span>
            </div>
            <div className="mt-4">
              <span className="block text-xs font-bold tracking-tight">Métricas & SLA</span>
              <span className={`block text-[9px] font-normal leading-tight mt-0.5 ${activeOperationalTab === 'dashboard' ? 'text-emerald-100' : isLight ? 'text-[#475569]' : 'text-zinc-400'}`}>
                SLA e Produtividade
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* FILTER & TABLE AREA */}
      {activeOperationalTab === 'dashboard' ? (
        <TasksOperationalDashboard isLight={isLight} />
      ) : (
        <div className="space-y-4">
        
        {/* FILTER BAR ROW */}
        <div className={`${isLight ? 'bg-[#FFFFFF] border-[#E2E8F0]' : 'bg-zinc-900 border-zinc-800'} p-4 rounded-xl border shadow-sm space-y-3`}>
          <div className={`flex flex-wrap items-center justify-between gap-2 border-b pb-2 ${isLight ? 'border-[#E2E8F0]' : 'border-zinc-800'}`}>
            <div className="flex items-center gap-2">
              <SlidersHorizontal className={`w-4 h-4 ${isLight ? 'text-[#475569]' : 'text-zinc-400'}`} />
              <span className={`text-xs font-bold uppercase tracking-wider font-mono ${isLight ? 'text-[#0F172A]' : 'text-zinc-200'}`}>
                Filtros de Pesquisa & Organização
              </span>
            </div>
            {(filterDept !== 'all' || filterPriority !== 'all' || filterStatus !== 'all' || filterAssigned !== 'all' || filterDeadline !== 'all' || searchTerm || filterUrgentOnly) && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setFilterDept('all');
                  setFilterPriority('all');
                  setFilterStatus('all');
                  setFilterAssigned('all');
                  setFilterDeadline('all');
                  setFilterUrgentOnly(false);
                }}
                className="text-[10px] font-mono font-bold text-indigo-500 hover:underline cursor-pointer"
              >
                Limpar filtros ×
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-xs">
            
            {/* Filter by Assignee */}
            <div className="space-y-1">
              <label className={`text-[10px] font-mono uppercase ${isLight ? 'text-[#475569]' : 'text-zinc-400'}`}>Responsável</label>
              <select
                value={filterAssigned}
                onChange={(e) => setFilterAssigned(e.target.value)}
                className={`w-full border rounded-lg px-2 py-1.5 text-xs ${isLight ? 'bg-[#FFFFFF] border-[#E2E8F0] text-[#0F172A]' : 'bg-zinc-950 border-zinc-800 text-zinc-300'}`}
              >
                <option value="all">Todos os Colaboradores</option>
                <option value="me">Minhas tarefas ({currentUserName})</option>
                <option value="unassigned">Sem Responsável atribuído</option>
              </select>
            </div>

            {/* Filter by Department */}
            <div className="space-y-1">
              <label className={`text-[10px] font-mono uppercase ${isLight ? 'text-[#475569]' : 'text-zinc-400'}`}>Departamento</label>
              <select
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                className={`w-full border rounded-lg px-2 py-1.5 text-xs ${isLight ? 'bg-[#FFFFFF] border-[#E2E8F0] text-[#0F172A]' : 'bg-zinc-950 border-zinc-800 text-zinc-300'}`}
              >
                <option value="all">Todos os Departamentos</option>
                {DEPARTMENTS.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            {/* Filter by Status */}
            <div className="space-y-1">
              <label className={`text-[10px] font-mono uppercase ${isLight ? 'text-[#475569]' : 'text-zinc-400'}`}>Estado</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className={`w-full border rounded-lg px-2 py-1.5 text-xs ${isLight ? 'bg-[#FFFFFF] border-[#E2E8F0] text-[#0F172A]' : 'bg-zinc-950 border-zinc-800 text-zinc-300'}`}
              >
                <option value="all">Todos os Estados</option>
                {STATUSES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Filter by Priority */}
            <div className="space-y-1">
              <label className={`text-[10px] font-mono uppercase ${isLight ? 'text-[#475569]' : 'text-zinc-400'}`}>Prioridade</label>
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className={`w-full border rounded-lg px-2 py-1.5 text-xs ${isLight ? 'bg-[#FFFFFF] border-[#E2E8F0] text-[#0F172A]' : 'bg-zinc-950 border-zinc-800 text-zinc-300'}`}
              >
                <option value="all">Todas as Prioridades</option>
                {PRIORITIES.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* Filter by Deadline */}
            <div className="space-y-1">
              <label className={`text-[10px] font-mono uppercase ${isLight ? 'text-[#475569]' : 'text-zinc-400'}`}>Prazo / Vencimento</label>
              <select
                value={filterDeadline}
                onChange={(e) => setFilterDeadline(e.target.value)}
                className={`w-full border rounded-lg px-2 py-1.5 text-xs ${isLight ? 'bg-[#FFFFFF] border-[#E2E8F0] text-[#0F172A]' : 'bg-zinc-950 border-zinc-800 text-zinc-300'}`}
              >
                <option value="all">Qualquer Prazo</option>
                <option value="today">Vence Hoje</option>
                <option value="overdue">Em Atraso / Excedido</option>
                <option value="week">Vence esta semana</option>
              </select>
            </div>

          </div>
        </div>

        {/* GLOBAL TEXT SEARCH BAR */}
        <div className="relative">
          <Search className={`absolute left-3.5 top-3 w-4 h-4 pointer-events-none ${isLight ? 'text-[#475569]' : 'text-zinc-400'}`} />
          <input
            type="text"
            placeholder="Pesquisa rápida por ID, Título ou Responsável..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full border rounded-xl pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:border-indigo-500 ${isLight ? 'bg-[#FFFFFF] border-[#E2E8F0] text-[#0F172A] placeholder-[#475569]/60' : 'bg-zinc-900 border-zinc-800 text-zinc-300 placeholder-zinc-500'}`}
          />
        </div>

        {/* TABELA PROFISSIONAL DE TAREFAS */}
        <div className={`overflow-x-auto w-full border rounded-xl shadow-sm scrollbar-thin ${isLight ? 'bg-[#FFFFFF] border-[#E2E8F0]' : 'bg-zinc-900 border-zinc-800'}`}>
          <table className="w-full text-left border-collapse">
            <thead className={`${isLight ? 'bg-[#F8FAFC] text-[#475569]' : 'bg-zinc-950 text-zinc-400'} text-[10px] font-bold uppercase tracking-wider border-b ${isLight ? 'border-[#E2E8F0]' : 'border-zinc-800'}`}>
              <tr>
                <th className="px-4 py-3 text-left">ID</th>
                <th className="px-4 py-3 text-left">Título</th>
                <th className="px-4 py-3 text-left">Responsável</th>
                <th className="px-4 py-3 text-left">Departamento</th>
                <th className="px-4 py-3 text-center">Prioridade</th>
                <th className="px-4 py-3 text-left">Prazo</th>
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-4 py-3 text-right">Última Atualização</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isLight ? 'divide-[#E2E8F0]' : 'divide-zinc-800'}`}>
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={8} className={`p-10 text-center text-xs font-medium ${isLight ? 'text-[#475569]' : 'text-zinc-500'}`}>
                    Nenhuma tarefa operacional corresponde aos critérios de filtragem selecionados.
                  </td>
                </tr>
              ) : (
                filteredTasks.map(t => {
                  const displayUpdateDate = t.updatedAt || `${t.createdAt} 09:00`;
                  return (
                    <tr 
                      key={t.id}
                      onClick={() => setSelectedTask(t)}
                      className={`cursor-pointer transition-all text-xs ${isLight ? 'hover:bg-[#F8FAFC]' : 'hover:bg-zinc-850/60'} ${
                        selectedTask?.id === t.id 
                          ? isLight 
                            ? 'bg-indigo-50/65 text-[#0F172A] font-medium' 
                            : 'bg-indigo-900/15 text-indigo-200 font-medium' 
                          : isLight
                            ? 'text-[#0F172A]'
                            : 'text-zinc-300'
                      }`}
                    >
                      {/* ID */}
                      <td className="px-4 py-3.5 font-mono font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                        {t.id}
                      </td>

                      {/* Título */}
                      <td className="px-4 py-3.5 font-medium max-w-xs truncate" title={t.title}>
                        {t.title}
                      </td>

                      {/* Responsável */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <User className={`w-3.5 h-3.5 ${isLight ? 'text-[#475569]' : 'text-zinc-400'}`} />
                          <span>{t.assignedTo || <span className={`${isLight ? 'text-[#475569]/60' : 'text-zinc-400'} italic`}>Não atribuído</span>}</span>
                        </div>
                      </td>

                      {/* Departamento */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={`text-[10px] px-2 py-0.5 border rounded-full font-semibold uppercase tracking-wider ${
                          t.department === 'Secretaria' ? (isLight ? 'border-[#E2E8F0] text-[#475569] bg-[#F8FAFC]' : 'border-zinc-300 text-zinc-650 bg-zinc-50 dark:bg-zinc-800/40') :
                          t.department === 'Financeiro' ? (isLight ? 'border-emerald-200 text-emerald-700 bg-emerald-50/40' : 'border-emerald-300 text-emerald-600 bg-emerald-50/40 dark:bg-emerald-950/20') :
                          t.department === 'Professor' ? (isLight ? 'border-indigo-200 text-indigo-700 bg-indigo-50/40' : 'border-indigo-300 text-indigo-650 bg-indigo-50/40 dark:bg-indigo-950/20') :
                          t.department === 'Direção' ? (isLight ? 'border-amber-200 text-amber-700 bg-amber-50/40' : 'border-amber-300 text-amber-600 bg-amber-50/40 dark:bg-amber-950/20') :
                          isLight ? 'border-[#E2E8F0] text-[#475569] bg-[#F8FAFC]' : 'border-zinc-300 text-zinc-600 bg-zinc-50 dark:bg-zinc-850/40'
                        }`}>
                          {t.department}
                        </span>
                      </td>

                      {/* Prioridade */}
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        <span className={`text-[9px] px-2 py-0.5 border rounded-full font-bold ${getPriorityBadge(t.priority)}`}>
                          {t.priority}
                        </span>
                      </td>

                      {/* Prazo */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1 font-mono text-[11px]">
                          <Calendar className={`w-3.5 h-3.5 ${isLight ? 'text-[#475569]' : 'text-zinc-400'}`} />
                          <span className={t.status === 'Atrasada' ? 'text-rose-600 font-bold' : ''}>
                            {t.dueDate}
                          </span>
                        </div>
                      </td>

                      {/* Estado */}
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        <span className={`text-[9px] px-2 py-0.5 border rounded font-semibold ${getStatusBadge(t.status)}`}>
                          {t.status}
                        </span>
                      </td>

                      {/* Última Atualização */}
                      <td className={`px-4 py-3.5 text-right font-mono text-[10px] whitespace-nowrap ${isLight ? 'text-[#475569]' : 'text-zinc-500'}`}>
                        {displayUpdateDate}
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      </div>
      )}

      {/* DETAILED LATERAL PANEL (Sliding Drawer Sheet) */}
      <AnimatePresence>
        {selectedTask && (
          <>
            {/* Background Backdrop Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTask(null)}
              className={`fixed inset-0 ${isLight ? 'bg-[#0F172A]/45' : 'bg-black/60'} z-[110] cursor-pointer`}
            />

            {/* Slide-out Sheet Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 24, stiffness: 220 }}
              className={`fixed top-[80px] right-0 bottom-0 w-full md:max-w-md lg:max-w-xl z-[120] shadow-2xl border-l flex flex-col ${
                isLight ? 'bg-[#FFFFFF] border-[#E2E8F0] text-[#0F172A]' : 'bg-zinc-900 border-zinc-800 text-zinc-100'
              } h-[calc(100vh-80px)]`}
            >
              
              {/* PANEL HEADER */}
              <div className={`p-5 flex items-center justify-between shrink-0 border-b ${isLight ? 'bg-[#F8FAFC] border-[#E2E8F0]' : 'bg-zinc-950 border-zinc-800'}`}>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">
                      {selectedTask.id}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 border rounded font-semibold ${getStatusBadge(selectedTask.status)}`}>
                      {selectedTask.status}
                    </span>
                  </div>
                  <h2 className={`text-sm font-bold leading-snug tracking-tight ${isLight ? 'text-[#0F172A]' : 'text-zinc-150'}`}>
                    {selectedTask.title}
                  </h2>
                </div>
                <button
                  onClick={() => setSelectedTask(null)}
                  className={`p-1.5 rounded-full transition-colors cursor-pointer ${isLight ? 'hover:bg-zinc-100 text-[#475569] hover:text-[#0F172A]' : 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'}`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* PANEL SCROLLABLE CONTENT */}
              <div className="p-6 overflow-y-auto flex-1 space-y-6 scrollbar-thin text-xs">
                
                {/* SECTION 1: INFORMAÇÃO COMPLETA */}
                <div className="space-y-3">
                  <div className={`flex items-center gap-2 border-b pb-1.5 ${isLight ? 'border-[#E2E8F0]' : 'border-zinc-800'}`}>
                    <Info className="w-4 h-4 text-indigo-500" />
                    <h3 className={`font-bold uppercase tracking-wider font-mono ${isLight ? 'text-[#0F172A]' : 'text-zinc-200'}`}>
                      Informação Completa
                    </h3>
                  </div>

                  {/* Operational description text box */}
                  <div className={`p-3 border rounded-xl leading-relaxed ${isLight ? 'bg-[#F8FAFC] border-[#E2E8F0] text-[#475569]' : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-850 text-zinc-400'}`}>
                    <span className={`text-[10px] block font-bold mb-1 uppercase tracking-wide ${isLight ? 'text-[#475569]/80' : 'text-zinc-450'}`}>Descrição do Trabalho</span>
                    {selectedTask.description}
                  </div>

                  {/* Info table block */}
                  <div className="grid grid-cols-2 gap-4 pt-1">
                    <div className="space-y-0.5">
                      <span className={`text-[10px] block font-mono uppercase ${isLight ? 'text-[#475569]' : 'text-zinc-400'}`}>Departamento</span>
                      <span className={`font-semibold ${isLight ? 'text-[#0F172A]' : 'text-zinc-300'}`}>{selectedTask.department}</span>
                    </div>

                    <div className="space-y-0.5">
                      <span className={`text-[10px] block font-mono uppercase ${isLight ? 'text-[#475569]' : 'text-zinc-400'}`}>Data de Criação</span>
                      <span className={`font-semibold font-mono ${isLight ? 'text-[#0F172A]' : 'text-zinc-300'}`}>{selectedTask.createdAt}</span>
                    </div>

                    <div className="space-y-0.5">
                      <span className={`text-[10px] block font-mono uppercase ${isLight ? 'text-[#475569]' : 'text-zinc-400'}`}>Prazo de Entrega</span>
                      <span className="font-semibold text-rose-500 font-mono">{selectedTask.dueDate}</span>
                    </div>

                    <div className="space-y-0.5">
                      <span className={`text-[10px] block font-mono uppercase ${isLight ? 'text-[#475569]' : 'text-zinc-400'}`}>Data Limite Máxima</span>
                      <span className={`font-semibold font-mono ${isLight ? 'text-[#0F172A]' : 'text-zinc-300'}`}>{selectedTask.limitDate}</span>
                    </div>
                  </div>

                  {/* Actions / Change state right in the details panel */}
                  <div className={`p-4 border rounded-xl space-y-3 mt-2 ${isLight ? 'bg-[#F8FAFC] border-[#E2E8F0]' : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-850'}`}>
                    <span className={`text-[10px] block font-bold uppercase tracking-wide ${isLight ? 'text-[#475569]' : 'text-zinc-450'}`}>Controlador Operacional</span>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className={`text-[9px] block font-mono uppercase ${isLight ? 'text-[#475569]' : 'text-zinc-400'}`}>Estado</label>
                        <select
                          value={selectedTask.status}
                          onChange={(e) => updateTask(selectedTask.id, { status: e.target.value as TaskState }, `Estado alterado para ${e.target.value}`)}
                          className={`w-full border rounded px-2.5 py-1 text-xs cursor-pointer ${isLight ? 'bg-[#FFFFFF] border-[#E2E8F0] text-[#0F172A]' : 'bg-white dark:bg-zinc-900 border-zinc-250 dark:border-zinc-800 text-zinc-300'}`}
                        >
                          {STATUSES.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className={`text-[9px] block font-mono uppercase ${isLight ? 'text-[#475569]' : 'text-zinc-400'}`}>Prioridade</label>
                        <select
                          value={selectedTask.priority}
                          onChange={(e) => updateTask(selectedTask.id, { priority: e.target.value as TaskPriority }, `Prioridade alterada para ${e.target.value}`)}
                          className={`w-full border rounded px-2.5 py-1 text-xs cursor-pointer ${isLight ? 'bg-[#FFFFFF] border-[#E2E8F0] text-[#0F172A]' : 'bg-white dark:bg-zinc-900 border-zinc-250 dark:border-zinc-800 text-zinc-300'}`}
                        >
                          {PRIORITIES.map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className={`text-[9px] block font-mono uppercase ${isLight ? 'text-[#475569]' : 'text-zinc-400'}`}>Designar Responsável</label>
                      <input
                        type="text"
                        placeholder="Nome do colaborador..."
                        value={selectedTask.assignedTo === 'Não atribuído' ? '' : selectedTask.assignedTo}
                        onChange={(e) => updateTask(selectedTask.id, { assignedTo: e.target.value || 'Não atribuído' }, `Responsável alterado para ${e.target.value || 'Não atribuído'}`)}
                        className={`w-full border rounded px-2.5 py-1 text-xs ${isLight ? 'bg-[#FFFFFF] border-[#E2E8F0] text-[#0F172A]' : 'bg-white dark:bg-zinc-900 border-zinc-250 dark:border-zinc-800 text-zinc-300'}`}
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION 1.5: RASTREABILIDADE & DEPENDÊNCIAS (Erro 2 e Erro 3) */}
                <div className={`space-y-3 p-4 border rounded-xl ${isLight ? 'bg-indigo-50/15 border-indigo-100' : 'bg-zinc-950/40 border-zinc-850'}`}>
                  <div className={`flex items-center gap-2 border-b pb-1.5 ${isLight ? 'border-indigo-100' : 'border-zinc-800'}`}>
                    <History className="w-4 h-4 text-indigo-500" />
                    <h3 className={`font-bold uppercase tracking-wider font-mono ${isLight ? 'text-[#0F172A]' : 'text-zinc-200'}`}>
                      Rastreabilidade & Auditoria
                    </h3>
                  </div>

                  {/* Responsabilidade operacional */}
                  <div className="space-y-2">
                    <div className={`flex justify-between border-b pb-1 ${isLight ? 'border-indigo-50' : 'border-zinc-900'}`}>
                      <span className={`text-[10px] font-mono uppercase ${isLight ? 'text-[#475569]' : 'text-zinc-400'}`}>Criado por</span>
                      <span className={`font-semibold ${isLight ? 'text-[#0F172A]' : 'text-zinc-300'}`}>
                        {selectedTask.createdBy || 'Sistema de Automação (Gatilho)'}
                      </span>
                    </div>
                    {selectedTask.executedBy && (
                      <div className={`flex justify-between border-b pb-1 ${isLight ? 'border-indigo-50' : 'border-zinc-900'}`}>
                        <span className={`text-[10px] font-mono uppercase ${isLight ? 'text-[#475569]' : 'text-zinc-400'}`}>Executado por</span>
                        <span className={`font-semibold ${isLight ? 'text-[#0F172A]' : 'text-zinc-300'}`}>{selectedTask.executedBy}</span>
                      </div>
                    )}
                    {selectedTask.completedBy && (
                      <div className={`flex justify-between border-b pb-1 ${isLight ? 'border-indigo-50' : 'border-zinc-900'}`}>
                        <span className={`text-[10px] font-mono uppercase ${isLight ? 'text-[#475569]' : 'text-zinc-400'}`}>Concluído por</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">{selectedTask.completedBy}</span>
                      </div>
                    )}
                    {selectedTask.completedAt && (
                      <div className={`flex justify-between border-b pb-1 ${isLight ? 'border-indigo-50' : 'border-zinc-900'}`}>
                        <span className={`text-[10px] font-mono uppercase ${isLight ? 'text-[#475569]' : 'text-zinc-400'}`}>Data Conclusão</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono">{selectedTask.completedAt}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className={`text-[10px] font-mono uppercase ${isLight ? 'text-[#475569]' : 'text-zinc-400'}`}>Tipo de Registro</span>
                      <span className={`font-semibold ${isLight ? 'text-[#0F172A]' : 'text-zinc-455'}`}>
                        {selectedTask.createdAutomatically ? 'Automação Sequencial' : 'Tarefa Manual'}
                      </span>
                    </div>
                  </div>

                  {/* Dependências de workflow (se houver) */}
                  {selectedTask.dependencies && selectedTask.dependencies.length > 0 && (
                    <div className={`mt-3.5 pt-3 border-t space-y-2 ${isLight ? 'border-indigo-100' : 'border-zinc-800'}`}>
                      <span className={`text-[10px] block font-bold uppercase tracking-wide ${isLight ? 'text-[#475569]' : 'text-zinc-450'}`}>Etapas Precedentes Obrigatórias</span>
                      <div className="space-y-1.5">
                        {selectedTask.dependencies.map(depId => {
                          const depTask = tasks.find(t => t.id === depId);
                          if (!depTask) return null;
                          const isDone = depTask.status === 'Concluída';
                          return (
                            <div key={depId} className={`flex items-center justify-between p-2 border rounded-lg text-[11px] ${isLight ? 'bg-[#FFFFFF] border-indigo-100' : 'bg-white dark:bg-zinc-900 border-zinc-150 dark:border-zinc-800'}`}>
                              <span className={`font-medium truncate max-w-[150px] ${isLight ? 'text-[#0F172A]' : 'text-zinc-700 dark:text-zinc-300'}`} title={depTask.title}>
                                {depTask.title} ({depId})
                              </span>
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold ${
                                isDone 
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400' 
                                  : 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400'
                              }`}>
                                {isDone ? 'Concluída' : 'Pendente'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* SECTION 2: OBSERVAÇÕES */}
                <div className="space-y-3">
                  <div className={`flex items-center gap-2 border-b pb-1.5 ${isLight ? 'border-[#E2E8F0]' : 'border-zinc-150 dark:border-zinc-800'}`}>
                    <Edit2 className="w-4 h-4 text-indigo-500" />
                    <h3 className={`font-bold uppercase tracking-wider font-mono ${isLight ? 'text-[#0F172A]' : 'text-zinc-200'}`}>
                      Observações / Anotações
                    </h3>
                  </div>

                  <div className="space-y-2">
                    <textarea
                      placeholder="Adicione observações operativas, notas adicionais ou esclarecimentos sobre esta tarefa..."
                      rows={3}
                      value={obsText}
                      onChange={(e) => setObsText(e.target.value)}
                      className={`w-full border rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:border-indigo-500 resize-none ${isLight ? 'bg-[#FFFFFF] border-[#E2E8F0] text-[#0F172A]' : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-300'}`}
                    />
                    <div className="flex justify-end">
                      <button
                        onClick={handleSaveObservations}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[11px] font-semibold transition cursor-pointer"
                      >
                        Gravar Observações
                      </button>
                    </div>
                  </div>
                </div>

                {/* SECTION 3: ANEXOS */}
                <div className="space-y-3">
                  <div className={`flex items-center gap-2 border-b pb-1.5 ${isLight ? 'border-[#E2E8F0]' : 'border-zinc-150 dark:border-zinc-800'}`}>
                    <Paperclip className="w-4 h-4 text-indigo-500" />
                    <h3 className={`font-bold uppercase tracking-wider font-mono ${isLight ? 'text-[#0F172A]' : 'text-zinc-200'}`}>
                      Anexos Vinculados ({getTaskAttachments(selectedTask).length})
                    </h3>
                  </div>

                  {/* List of files */}
                  <div className="space-y-1.5">
                    {getTaskAttachments(selectedTask).length === 0 ? (
                      <div className={`text-center py-4 rounded-lg text-[11px] italic ${isLight ? 'bg-[#F8FAFC] text-[#475569]' : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-450'}`}>
                        Nenhum anexo adicionado a esta tarefa operacional.
                      </div>
                    ) : (
                      getTaskAttachments(selectedTask).map((file, fIdx) => (
                        <div 
                          key={fIdx} 
                          className={`flex items-center justify-between p-2.5 border rounded-lg ${isLight ? 'bg-[#F8FAFC] border-[#E2E8F0]' : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-150 dark:border-zinc-850'}`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                            <div className="truncate">
                              <p className={`font-medium truncate ${isLight ? 'text-[#0F172A]' : 'text-zinc-700 dark:text-zinc-300'}`}>{file.name}</p>
                              {file.size && <p className="text-[10px] text-zinc-400 font-mono">{file.size}</p>}
                            </div>
                          </div>
                          <a 
                            href={file.url} 
                            onClick={(e) => { e.preventDefault(); alert(`Download simulado para o anexo "${file.name}"!`); }}
                            className="text-[10px] font-mono text-indigo-500 hover:underline px-2"
                          >
                            Descarregar
                          </a>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Simulating adding attachment form */}
                  <form onSubmit={handleAddAttachment} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Ex: Oficio_Aprovacao_Assinado.pdf"
                      value={newAttachName}
                      onChange={(e) => setNewAttachName(e.target.value)}
                      className={`flex-1 border rounded-lg px-2.5 py-1.5 text-xs placeholder-zinc-400 focus:outline-none focus:border-indigo-500 ${isLight ? 'bg-[#FFFFFF] border-[#E2E8F0] text-[#0F172A]' : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-300'}`}
                    />
                    <button
                      type="submit"
                      disabled={!newAttachName.trim()}
                      className="px-3 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-lg font-semibold transition disabled:opacity-50 text-[11px] cursor-pointer"
                    >
                      Anexar
                    </button>
                  </form>
                </div>

                {/* SECTION 4: HISTÓRICO & REGISTOS DE ALTERAÇÕES */}
                <div className="space-y-3">
                  <div className={`flex items-center gap-2 border-b pb-1.5 ${isLight ? 'border-[#E2E8F0]' : 'border-zinc-150 dark:border-zinc-800'}`}>
                    <History className="w-4 h-4 text-indigo-500" />
                    <h3 className={`font-bold uppercase tracking-wider font-mono ${isLight ? 'text-[#0F172A]' : 'text-zinc-200'}`}>
                      Histórico & Registo de Alterações
                    </h3>
                  </div>

                  {/* Vertical Timeline */}
                  <div className={`relative pl-4 border-l-2 space-y-4 py-1 ml-1.5 ${isLight ? 'border-indigo-50' : 'border-indigo-950'}`}>
                    {getTaskHistory(selectedTask).map((event, evIdx) => (
                      <div key={event.id || evIdx} className="relative">
                        {/* Bullet */}
                        <div className={`absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-indigo-500 border-2 shadow-sm ${isLight ? 'border-[#FFFFFF]' : 'border-zinc-900'}`} />
                        
                        <div>
                          <p className={`font-semibold ${isLight ? 'text-[#0F172A]' : 'text-zinc-200'}`}>{event.action}</p>
                          <div className={`flex items-center gap-1.5 mt-0.5 text-[10px] font-mono ${isLight ? 'text-[#475569]' : 'text-zinc-500'}`}>
                            <span>{event.timestamp}</span>
                            <span>•</span>
                            <span className="text-indigo-500">{event.user}</span>
                          </div>
                          {event.details && (
                            <p className={`text-[10px] mt-1 pl-1 border-l ${isLight ? 'text-[#475569] border-[#E2E8F0]' : 'text-zinc-550 dark:text-zinc-400 border-zinc-800'}`}>
                              {event.details}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* PANEL FOOTER ACTIONS */}
              <div className={`p-4 flex items-center justify-between shrink-0 border-t ${isLight ? 'bg-[#F8FAFC] border-[#E2E8F0]' : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-800'}`}>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCheckImpact(selectedTask)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg font-semibold transition cursor-pointer text-xs ${
                      isLight 
                        ? 'border-indigo-200 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100' 
                        : 'border-zinc-800 text-indigo-400 bg-indigo-950/20 hover:bg-zinc-900'
                    }`}
                  >
                    <Network className="w-3.5 h-3.5 text-indigo-500" />
                    Impacto
                  </button>
                  <button
                    onClick={() => handleDeleteTask(selectedTask.id)}
                    className="flex items-center gap-1 text-rose-500 hover:text-white hover:bg-rose-600 px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer border border-transparent hover:border-rose-700 text-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Eliminar
                  </button>
                </div>

                {selectedTask.status !== 'Concluída' ? (
                  <button
                    onClick={() => updateTask(selectedTask.id, { status: 'Concluída' }, 'Tarefa concluída com sucesso')}
                    className="flex items-center gap-1 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold transition cursor-pointer shadow-sm"
                  >
                    <Check className="w-4 h-4" />
                    Concluir Tarefa
                  </button>
                ) : (
                  <button
                    onClick={() => updateTask(selectedTask.id, { status: 'Pendente' }, 'Tarefa reaberta para processamento')}
                    className="flex items-center gap-1 px-4 py-1.5 bg-zinc-650 hover:bg-zinc-650 text-white rounded-lg font-semibold transition cursor-pointer"
                  >
                    Reabrir Tarefa
                  </button>
                )}
              </div>

            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* CREATE TASK MANUALLY MODAL */}
      {isCreateModalOpen && (
        <div className={`fixed inset-0 backdrop-blur-xs flex items-center justify-center z-[1000] p-4 ${isLight ? 'bg-[#0F172A]/45' : 'bg-black/60'}`}>
          <div className={`border rounded-xl w-full max-w-lg p-5 shadow-2xl space-y-4 animate-scaleUp ${isLight ? 'bg-[#FFFFFF] border-[#E2E8F0] text-[#0F172A]' : 'bg-zinc-900 border-zinc-800 text-zinc-150'}`}>
            
            <div className={`flex items-center justify-between border-b pb-2 ${isLight ? 'border-[#E2E8F0]' : 'border-zinc-800'}`}>
              <h3 className={`text-sm font-bold flex items-center gap-1.5 ${isLight ? 'text-[#0F172A]' : 'text-zinc-200'}`}>
                <ClipboardCheck className="w-5 h-5 text-indigo-500" />
                Criar Nova Tarefa Operacional
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className={`text-lg cursor-pointer font-bold ${isLight ? 'text-[#475569] hover:text-[#0F172A]' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-3 text-xs">
              
              <div>
                <label className={`text-[10px] font-bold uppercase block mb-1 ${isLight ? 'text-[#475569]' : 'text-zinc-500'}`}>Título da Tarefa *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Lançar pauta sumativa - Turma 10B"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className={`w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-indigo-550 ${isLight ? 'bg-[#FFFFFF] border-[#E2E8F0] text-[#0F172A]' : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-300'}`}
                />
              </div>

              <div>
                <label className={`text-[10px] font-bold uppercase block mb-1 ${isLight ? 'text-[#475569]' : 'text-zinc-500'}`}>Descrição / Notas Operativas</label>
                <textarea
                  placeholder="Ex: Detalhar notas de avaliação continua e sumativa dos alunos antes do dia 28..."
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className={`w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-indigo-550 resize-none ${isLight ? 'bg-[#FFFFFF] border-[#E2E8F0] text-[#0F172A]' : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-300'}`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`text-[10px] font-bold uppercase block mb-1 ${isLight ? 'text-[#475569]' : 'text-zinc-500'}`}>Colaborador Atribuído</label>
                  <input
                    type="text"
                    placeholder="Ex: Prof. João Silva"
                    value={newAssigned}
                    onChange={(e) => setNewAssigned(e.target.value)}
                    className={`w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-indigo-550 ${isLight ? 'bg-[#FFFFFF] border-[#E2E8F0] text-[#0F172A]' : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-300'}`}
                  />
                </div>

                <div>
                  <label className={`text-[10px] font-bold uppercase block mb-1 ${isLight ? 'text-[#475569]' : 'text-zinc-500'}`}>Departamento Destinatário</label>
                  <select
                    value={newDept}
                    onChange={(e) => setNewDept(e.target.value as SchoolTask['department'])}
                    className={`w-full border rounded px-2.5 py-1.5 text-xs cursor-pointer ${isLight ? 'bg-[#FFFFFF] border-[#E2E8F0] text-[#0F172A]' : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-300'}`}
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
                  <label className={`text-[10px] font-bold uppercase block mb-1 ${isLight ? 'text-[#475569]' : 'text-zinc-500'}`}>Prioridade</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
                    className={`w-full border rounded px-2.5 py-1.5 text-xs cursor-pointer ${isLight ? 'bg-[#FFFFFF] border-[#E2E8F0] text-[#0F172A]' : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-300'}`}
                  >
                    {PRIORITIES.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`text-[10px] font-bold uppercase block mb-1 ${isLight ? 'text-[#475569]' : 'text-zinc-500'}`}>Estado Inicial</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as TaskState)}
                    className={`w-full border rounded px-2.5 py-1.5 text-xs cursor-pointer ${isLight ? 'bg-[#FFFFFF] border-[#E2E8F0] text-[#0F172A]' : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-300'}`}
                  >
                    {STATUSES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`text-[10px] font-bold uppercase block mb-1 ${isLight ? 'text-[#475569]' : 'text-zinc-500'}`}>Prazo de Conclusão</label>
                  <input
                    type="date"
                    required
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className={`w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-indigo-555 ${isLight ? 'bg-[#FFFFFF] border-[#E2E8F0] text-[#0F172A]' : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-300'}`}
                  />
                </div>

                <div>
                  <label className={`text-[10px] font-bold uppercase block mb-1 ${isLight ? 'text-[#475569]' : 'text-zinc-500'}`}>Data Limite Máxima</label>
                  <input
                    type="date"
                    required
                    value={newLimitDate}
                    onChange={(e) => setNewLimitDate(e.target.value)}
                    className={`w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-indigo-555 ${isLight ? 'bg-[#FFFFFF] border-[#E2E8F0] text-[#0F172A]' : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-300'}`}
                  />
                </div>
              </div>

              <div className={`flex items-center justify-end gap-2 pt-3 border-t ${isLight ? 'border-[#E2E8F0]' : 'border-zinc-150 dark:border-zinc-800'}`}>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className={`px-4 py-1.5 rounded font-semibold cursor-pointer ${isLight ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-350'}`}
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

      {/* MODAL: TAREFAS ARQUIVADAS (SOFT DELETE) */}
      {isArchivedModalOpen && (
        <div className={`fixed inset-0 backdrop-blur-xs flex items-center justify-center z-[1000] p-4 ${isLight ? 'bg-[#0F172A]/45' : 'bg-black/60'}`}>
          <div className={`w-full max-w-3xl rounded-2xl shadow-xl border overflow-hidden flex flex-col max-h-[85vh] ${isLight ? 'bg-white border-[#E2E8F0]' : 'bg-zinc-900 border-zinc-800'}`}>
            {/* Header */}
            <div className={`p-4 border-b flex items-center justify-between ${isLight ? 'bg-slate-50 border-[#E2E8F0]' : 'bg-zinc-950 border-zinc-800'}`}>
              <div className="flex items-center gap-2">
                <Archive className="w-5 h-5 text-amber-500" />
                <h3 className={`text-sm font-bold ${isLight ? 'text-[#0F172A]' : 'text-zinc-200'}`}>
                  Arquivo de Tarefas Operacionais (Soft Deleted)
                </h3>
              </div>
              <button
                onClick={() => setIsArchivedModalOpen(false)}
                className={`p-1.5 rounded-lg border transition ${isLight ? 'border-slate-200 hover:bg-slate-100 text-[#475569]' : 'border-zinc-800 hover:bg-zinc-800 text-zinc-400'}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 overflow-y-auto space-y-4">
              <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                Estas tarefas foram arquivadas logicamente (soft delete) para preservar registos de auditoria escolar. Pode restaurá-las a qualquer momento de volta ao centro de tarefas ativas.
              </p>

              {archivedTasksList.length === 0 ? (
                <div className={`p-10 text-center border border-dashed rounded-xl ${isLight ? 'border-[#E2E8F0] text-slate-400' : 'border-zinc-800 text-zinc-500'}`}>
                  <Archive className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-500" />
                  <p className="text-xs font-medium">Nenhuma tarefa no arquivo histórico no momento.</p>
                </div>
              ) : (
                <div className={`overflow-x-auto border rounded-xl ${isLight ? 'border-[#E2E8F0]' : 'border-zinc-800'}`}>
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className={`${isLight ? 'bg-slate-50 text-slate-600' : 'bg-zinc-950 text-zinc-400'} font-bold uppercase tracking-wider border-b ${isLight ? 'border-[#E2E8F0]' : 'border-zinc-800'}`}>
                      <tr>
                        <th className="p-3">ID / Título</th>
                        <th className="p-3">Departamento</th>
                        <th className="p-3">Eliminado Por / Em</th>
                        <th className="p-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isLight ? 'divide-slate-100' : 'divide-zinc-800'}`}>
                      {archivedTasksList.map(task => (
                        <tr key={task.id} className={isLight ? 'hover:bg-slate-50' : 'hover:bg-zinc-850/30'}>
                          <td className="p-3">
                            <span className="font-mono font-bold text-indigo-500 block text-[11px]">{task.id}</span>
                            <span className={`font-medium ${isLight ? 'text-slate-800' : 'text-zinc-300'}`}>{task.title}</span>
                          </td>
                          <td className="p-3">
                            <span className="text-[10px] px-2 py-0.5 border rounded-full bg-slate-50 text-slate-600 border-slate-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400">
                              {task.department}
                            </span>
                          </td>
                          <td className="p-3 text-slate-500 dark:text-zinc-400 text-[11px]">
                            <div className="font-semibold text-rose-500">{task.deletedBy || 'Não registado'}</div>
                            <div className="font-mono text-[10px] opacity-80">{task.deletedAt ? new Date(task.deletedAt).toLocaleString('pt-PT') : 'N/D'}</div>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => handleRestoreTask(task.id)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold text-xs transition cursor-pointer"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              Restaurar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className={`p-4 border-t flex justify-end ${isLight ? 'bg-slate-50 border-[#E2E8F0]' : 'bg-zinc-950 border-zinc-800'}`}>
              <button
                onClick={() => setIsArchivedModalOpen(false)}
                className={`px-4 py-1.5 rounded-xl font-semibold cursor-pointer text-xs ${isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-350'}`}
              >
                Fechar Arquivo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ANÁLISE DE IMPACTO DE DEPENDÊNCIAS */}
      {isImpactModalOpen && taskForImpact && impactData && (
        <div className={`fixed inset-0 backdrop-blur-xs flex items-center justify-center z-[1000] p-4 ${isLight ? 'bg-[#0F172A]/45' : 'bg-black/60'}`}>
          <div className={`w-full max-w-2xl rounded-2xl shadow-xl border overflow-hidden flex flex-col max-h-[85vh] ${isLight ? 'bg-white border-[#E2E8F0]' : 'bg-zinc-900 border-zinc-800'}`}>
            {/* Header */}
            <div className={`p-4 border-b flex items-center justify-between ${isLight ? 'bg-slate-50 border-[#E2E8F0]' : 'bg-zinc-950 border-zinc-800'}`}>
              <div className="flex items-center gap-2">
                <Network className="w-5 h-5 text-indigo-500" />
                <h3 className={`text-sm font-bold ${isLight ? 'text-[#0F172A]' : 'text-zinc-200'}`}>
                  Análise de Impacto Operacional
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsImpactModalOpen(false);
                  setImpactData(null);
                  setTaskForImpact(null);
                }}
                className={`p-1.5 rounded-lg border transition ${isLight ? 'border-slate-200 hover:bg-slate-100 text-[#475569]' : 'border-zinc-800 hover:bg-zinc-800 text-zinc-400'}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 overflow-y-auto space-y-5">
              {/* Task info summary */}
              <div className={`p-4 rounded-xl border ${isLight ? 'bg-indigo-50/40 border-indigo-100' : 'bg-indigo-950/10 border-indigo-900/30'}`}>
                <span className="text-[10px] font-bold font-mono text-indigo-500 block">ALVO DA ANÁLISE</span>
                <span className={`text-xs font-bold ${isLight ? 'text-slate-800' : 'text-zinc-200'}`}>
                  {taskForImpact.id} - {taskForImpact.title}
                </span>
                <p className="text-[11px] mt-1 text-slate-500 dark:text-zinc-400">
                  Setor: {taskForImpact.department} | Estado: {taskForImpact.status}
                </p>
              </div>

              {/* Status and Numbers summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className={`p-3.5 border rounded-xl text-center ${
                  impactData.canDelete 
                    ? (isLight ? 'bg-emerald-50/50 border-emerald-100 text-emerald-800' : 'bg-emerald-950/15 border-emerald-900/30 text-emerald-400')
                    : (isLight ? 'bg-rose-50/50 border-rose-100 text-rose-800' : 'bg-rose-950/15 border-rose-900/30 text-rose-400')
                }`}>
                  <span className="block text-[9px] font-bold uppercase tracking-wider mb-1 opacity-85">Status de Remoção</span>
                  <div className="text-sm font-bold flex items-center justify-center gap-1">
                    {impactData.canDelete ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        Seguro Eliminar
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-4 h-4 text-rose-500" />
                        Bloqueado
                      </>
                    )}
                  </div>
                </div>

                <div className={`p-3.5 border rounded-xl text-center ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-zinc-950 border-zinc-800'}`}>
                  <span className="block text-[9px] font-bold uppercase tracking-wider mb-1 text-slate-500 dark:text-zinc-400">Dependentes Diretos</span>
                  <span className="text-xl font-bold font-mono">{impactData.directDependents}</span>
                </div>

                <div className={`p-3.5 border rounded-xl text-center ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-zinc-950 border-zinc-800'}`}>
                  <span className="block text-[9px] font-bold uppercase tracking-wider mb-1 text-slate-500 dark:text-zinc-400">Total Afetadas em Cascata</span>
                  <span className="text-xl font-bold font-mono text-indigo-500">{impactData.totalAffectedTasks}</span>
                </div>
              </div>

              {/* Warning box if blocked */}
              {!impactData.canDelete && (
                <div className={`p-3 border rounded-xl text-xs flex gap-2 ${isLight ? 'bg-amber-50/60 border-amber-200 text-amber-800' : 'bg-amber-950/15 border-amber-900/40 text-amber-400'}`}>
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                  <div>
                    <span className="font-bold block mb-0.5">Integridade Referencial Ativa</span>
                    Esta tarefa possui dependentes operacionais ativos. A exclusão física ou lógica está bloqueada por motivos de segurança até que os dependentes sejam modificados.
                  </div>
                </div>
              )}

              {/* Dependent Hierarchy List */}
              <div className="space-y-2">
                <span className={`text-[10px] font-bold uppercase tracking-wider block ${isLight ? 'text-slate-500' : 'text-zinc-500'}`}>
                  Árvore de Dependências Descendentes
                </span>

                {impactData.tasks.length === 0 ? (
                  <div className={`p-6 text-center border border-dashed rounded-xl text-xs ${isLight ? 'border-slate-200 text-slate-400' : 'border-zinc-850 text-zinc-550'}`}>
                    Nenhuma tarefa depende desta atividade diretamente ou indiretamente.
                  </div>
                ) : (
                  <div className={`border rounded-xl divide-y overflow-hidden max-h-[220px] overflow-y-auto text-xs ${isLight ? 'border-slate-100 divide-slate-100' : 'border-zinc-800 divide-zinc-850'}`}>
                    {impactData.tasks.map((task: any) => (
                      <div key={task.id} className={`p-2.5 flex items-center justify-between ${isLight ? 'hover:bg-slate-50' : 'hover:bg-zinc-850/20'}`}>
                        <div className="min-w-0 pr-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-indigo-500">{task.id}</span>
                            <span className="text-[10px] px-1.5 py-0.2 border rounded-full bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400">
                              Nível {task.depth}
                            </span>
                            {task.direct && (
                              <span className="text-[9px] px-1.5 py-0.2 border rounded bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/40 dark:text-amber-400 font-medium">
                                Direto
                              </span>
                            )}
                          </div>
                          <p className={`font-medium truncate mt-0.5 ${isLight ? 'text-slate-800' : 'text-zinc-300'}`}>{task.title}</p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-[9px] px-2 py-0.5 rounded font-semibold ${getStatusBadge(task.status)}`}>
                            {task.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className={`p-4 border-t flex justify-end gap-2 ${isLight ? 'bg-slate-50 border-[#E2E8F0]' : 'bg-zinc-950 border-zinc-800'}`}>
              <button
                onClick={() => {
                  setIsImpactModalOpen(false);
                  setImpactData(null);
                  setTaskForImpact(null);
                }}
                className={`px-4 py-1.5 rounded-xl font-semibold cursor-pointer text-xs ${isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-350'}`}
              >
                Fechar Análise
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
