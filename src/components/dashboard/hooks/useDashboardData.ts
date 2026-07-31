import { useState, useEffect, useCallback } from 'react';
import { LogRecord, TodoTask } from '../types/dashboard.types';
import { 
  fetchLogsService, 
  fetchTasksService, 
  toggleTaskService, 
  deleteTaskService 
} from '../services/dashboard.services';
import { Student, Invoice, Announcement } from '../../../types';

interface UseDashboardDataProps {
  students: Student[];
  invoices: Invoice[];
  announcements: Announcement[];
}

export function useDashboardData({ students, invoices, announcements }: UseDashboardDataProps) {
  const [logs, setLogs] = useState<LogRecord[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [todoTasks, setTodoTasks] = useState<TodoTask[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);

  const fetchLiveLogs = useCallback(async () => {
    setIsLoadingLogs(true);
    try {
      const records = await fetchLogsService();
      setLogs(records);
    } catch (err) {
      console.error('Erro ao buscar logs:', err);
    } finally {
      setIsLoadingLogs(false);
    }
  }, []);

  const fetchTodoTasks = useCallback(async () => {
    setIsLoadingTasks(true);
    try {
      const tasks = await fetchTasksService();
      setTodoTasks(tasks);
    } catch (err) {
      console.error('Erro ao buscar tarefas:', err);
    } finally {
      setIsLoadingTasks(false);
    }
  }, []);

  const handleToggleTaskStatus = useCallback(async (taskId: string, currentStatus: string) => {
    try {
      const success = await toggleTaskService(taskId, currentStatus);
      if (success) {
        fetchTodoTasks();
        window.dispatchEvent(new CustomEvent('nexus-realtime-update'));
      }
    } catch (err) {
      console.error('Erro ao alternar status da tarefa:', err);
    }
  }, [fetchTodoTasks]);

  const handleDeleteTask = useCallback(async (taskId: string) => {
    try {
      const result = await deleteTaskService(taskId);
      if (result.success) {
        fetchTodoTasks();
        window.dispatchEvent(new CustomEvent('nexus-realtime-update'));
      } else {
        if (result.status === 409 && result.dependents && result.dependents.length > 0) {
          const depList = result.dependents.map((d: any) => `"${d.title}" (${d.id})`).join('\n• ');
          alert(`Não é possível eliminar esta tarefa porque existem outras que dependem dela:\n• ${depList}`);
        } else {
          alert(`Erro ao eliminar tarefa: ${result.error || 'Falha desconhecida'}`);
        }
      }
    } catch (err: any) {
      console.error('Erro ao eliminar tarefa:', err);
      alert(`Erro de rede ao eliminar tarefa: ${err.message}`);
    }
  }, [fetchTodoTasks]);

  // Fetch data on inputs update
  useEffect(() => {
    fetchLiveLogs();
    fetchTodoTasks();
  }, [students, invoices, announcements, fetchLiveLogs, fetchTodoTasks]);

  // Event listener for global realtime updates
  useEffect(() => {
    const handleRealtimeUpdate = () => {
      fetchLiveLogs();
      fetchTodoTasks();
    };
    window.addEventListener('nexus-realtime-update', handleRealtimeUpdate);
    return () => window.removeEventListener('nexus-realtime-update', handleRealtimeUpdate);
  }, [fetchLiveLogs, fetchTodoTasks]);

  return {
    logs,
    isLoadingLogs,
    todoTasks,
    isLoadingTasks,
    fetchLiveLogs,
    fetchTodoTasks,
    handleToggleTaskStatus,
    handleDeleteTask,
  };
}
