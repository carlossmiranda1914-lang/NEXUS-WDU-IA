import { getLiveLogs, getHeaders } from '../../../supabaseClient';
import { LogRecord, TodoTask } from '../types/dashboard.types';

export async function fetchLogsService(): Promise<LogRecord[]> {
  const records = await getLiveLogs();
  if (records && Array.isArray(records)) {
    return records.slice(0, 10); // Grab the 10 most recent entries
  }
  return [];
}

export async function fetchTasksService(): Promise<TodoTask[]> {
  try {
    const headers = await getHeaders();
    const response = await fetch('/api/school-tasks', { headers });
    if (response.ok) {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      }
    }
  } catch (err) {
    console.warn('fetchTasksService error:', err);
  }
  return [];
}

export async function toggleTaskService(taskId: string, currentStatus: string): Promise<boolean> {
  try {
    const newStatus = currentStatus === 'Concluída' ? 'Pendente' : 'Concluída';
    const response = await fetch(`/api/school-tasks/${taskId}`, {
      method: 'PUT',
      headers: await getHeaders(),
      body: JSON.stringify({ status: newStatus })
    });
    return response.ok;
  } catch (err) {
    console.warn('toggleTaskService error:', err);
    return false;
  }
}

export interface DeleteTaskResult {
  success: boolean;
  status: number;
  dependents?: any[];
  error?: string;
}

export async function deleteTaskService(taskId: string): Promise<DeleteTaskResult> {
  const response = await fetch(`/api/school-tasks/${taskId}`, {
    method: 'DELETE',
    headers: await getHeaders()
  });
  
  if (response.ok) {
    return { success: true, status: response.status };
  } else {
    const errData = await response.json().catch(() => ({}));
    return { 
      success: false, 
      status: response.status, 
      dependents: errData.dependents, 
      error: errData.error 
    };
  }
}
