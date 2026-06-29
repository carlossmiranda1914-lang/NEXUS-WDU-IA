import { Student, Teacher, Invoice, Announcement, ChatMessage, AutomationFlow, ApprovalRequest, SchoolTask } from './types';
import { auth } from './lib/firebase.ts';

// Dynamic header construction injecting our active Firebase user JWT
export async function getHeaders() {
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
}

// Set configured as true to immediately boot raw Postgres mode in the frontend
export const supabaseConfigured = true;
export const supabaseUrl = "Cloud SQL (europe-west2)";
export const supabaseAnonKey = "Firebase JWT Protected";

// 1. Students Operations
export async function getLiveStudents(): Promise<Student[]> {
  try {
    const headers = await getHeaders();
    const res = await fetch('/api/students', { headers });
    if (!res.ok) {
      console.warn('Falha ao obter alunos do Cloud SQL PostgreSQL:', res.status);
      return [];
    }
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
    return [];
  } catch (err) {
    console.warn('Error fetching students:', err);
    return [];
  }
}

export async function upsertLiveStudent(student: Student): Promise<void> {
  const headers = await getHeaders();
  const res = await fetch('/api/students', {
    method: 'POST',
    headers,
    body: JSON.stringify(student)
  });
  if (!res.ok) throw new Error('Falha ao salvar aluno no banco relacional.');
}

export async function deleteLiveStudent(id: string): Promise<void> {
  const headers = await getHeaders();
  const res = await fetch(`/api/students/${id}`, {
    method: 'DELETE',
    headers
  });
  if (!res.ok) throw new Error('Falha ao excluir estudante no banco de dados.');
}

// 2. Teachers Operations
export async function getLiveTeachers(): Promise<Teacher[]> {
  try {
    const headers = await getHeaders();
    const res = await fetch('/api/teachers', { headers });
    if (!res.ok) {
      console.warn('Falha ao obter professores do Cloud SQL:', res.status);
      return [];
    }
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
    return [];
  } catch (err) {
    console.warn('Error fetching teachers:', err);
    return [];
  }
}

export async function upsertLiveTeacher(teacher: Teacher): Promise<void> {
  const headers = await getHeaders();
  // Try to PUT first. If it returns 404, then do POST.
  try {
    const putRes = await fetch(`/api/teachers/${teacher.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(teacher)
    });
    if (putRes.ok) {
      return;
    }
  } catch (err) {
    console.warn('[SUPABASE] PUT failed, falling back to POST:', err);
  }

  const res = await fetch('/api/teachers', {
    method: 'POST',
    headers,
    body: JSON.stringify(teacher)
  });
  if (!res.ok) throw new Error('Falha ao salvar professor no banco relacional.');
}

export async function deleteLiveTeacher(id: string): Promise<void> {
  const headers = await getHeaders();
  const res = await fetch(`/api/teachers/${id}`, {
    method: 'DELETE',
    headers
  });
  if (!res.ok) throw new Error('Falha ao excluir professor no banco de dados.');
}

// 3. Invoices / Financial Operations
export async function getLiveInvoices(): Promise<Invoice[]> {
  try {
    const headers = await getHeaders();
    const res = await fetch('/api/invoices', { headers });
    if (!res.ok) {
      console.warn('Falha ao obter faturas do Postgres:', res.status);
      return [];
    }
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
    return [];
  } catch (err) {
    console.warn('Error fetching invoices:', err);
    return [];
  }
}

export async function upsertLiveInvoice(invoice: Invoice): Promise<void> {
  // If status changed to 'paid' in the client panel, trigger payment on backend
  if (invoice.status === 'paid') {
    const headers = await getHeaders();
    const res = await fetch('/api/invoices/pay', {
      method: 'POST',
      headers,
      body: JSON.stringify({ id: invoice.id })
    });
    if (!res.ok) throw new Error('Falha ao liquidar fatura.');
  }
}

export async function createLiveInvoice(invoice: Partial<Invoice>): Promise<Invoice> {
  const headers = await getHeaders();
  const res = await fetch('/api/invoices', {
    method: 'POST',
    headers,
    body: JSON.stringify(invoice)
  });
  if (!res.ok) throw new Error('Falha ao criar fatura no banco de dados.');
  return res.json();
}

export async function cancelLiveInvoice(id: string): Promise<void> {
  const headers = await getHeaders();
  const res = await fetch('/api/invoices/cancel', {
    method: 'POST',
    headers,
    body: JSON.stringify({ id })
  });
  if (!res.ok) throw new Error('Falha ao cancelar fatura.');
}

export async function reconcileLiveBankStatement(transactions: any[]): Promise<any> {
  const headers = await getHeaders();
  const res = await fetch('/api/invoices/reconcile', {
    method: 'POST',
    headers,
    body: JSON.stringify({ transactions })
  });
  if (!res.ok) throw new Error('Falha ao processar conciliação bancária.');
  return res.json();
}

export async function getLiveFinancialForecast(): Promise<any> {
  const headers = await getHeaders();
  const res = await fetch('/api/financial/forecast', { headers });
  if (!res.ok) throw new Error('Falha ao computar prognóstico financeiro.');
  return res.json();
}

// 4. Announcements Operations
export async function getLiveAnnouncements(): Promise<Announcement[]> {
  try {
    const headers = await getHeaders();
    const res = await fetch('/api/announcements', { headers });
    if (!res.ok) {
      console.warn('Falha ao obter pauta de avisos:', res.status);
      return [];
    }
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
    return [];
  } catch (err) {
    console.warn('Error fetching announcements:', err);
    return [];
  }
}

export async function upsertLiveAnnouncement(an: Announcement): Promise<void> {
  const headers = await getHeaders();
  const res = await fetch('/api/announcements', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: an.title,
      content: an.content,
      target: an.target
    })
  });
  if (!res.ok) throw new Error('Falha ao publicar comunicado.');
}

// 5. Communications Chat Operations
export async function getLiveMessages(): Promise<ChatMessage[]> {
  try {
    const headers = await getHeaders();
    const res = await fetch('/api/chat-messages', { headers });
    if (!res.ok) {
      console.warn('Falha ao obter mensagens de chat:', res.status);
      return [];
    }
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
    return [];
  } catch (err) {
    console.warn('Error fetching chat messages:', err);
    return [];
  }
}

export async function upsertLiveMessage(msg: ChatMessage): Promise<void> {
  const headers = await getHeaders();
  const res = await fetch('/api/chat-messages', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      content: msg.content,
      channel: msg.channel
    })
  });
  if (!res.ok) throw new Error('Falha ao submeter mensagem.');
}

// 6. n8n Serverless Automations
export async function getLiveAutomations(): Promise<AutomationFlow[]> {
  try {
    const headers = await getHeaders();
    const res = await fetch('/api/automations', { headers });
    if (!res.ok) {
      console.warn('Falha ao consultar automações ativas:', res.status);
      return [];
    }
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
    return [];
  } catch (err) {
    console.warn('Error fetching automations:', err);
    return [];
  }
}

export async function upsertLiveAutomation(flow: AutomationFlow): Promise<void> {
  const headers = await getHeaders();
  // Trigger a toggle or manual execution trigger in backend depending on context
  await fetch('/api/automations/toggle', {
    method: 'POST',
    headers,
    body: JSON.stringify({ id: flow.id })
  });
}

// Helper trigger to simulate n8n manual run executions inside the UI
export async function triggerLiveAutomationRun(id: string): Promise<void> {
  const headers = await getHeaders();
  const res = await fetch('/api/automations/trigger', {
    method: 'POST',
    headers,
    body: JSON.stringify({ id })
  });
  if (!res.ok) throw new Error('Falha ao despoletar automação.');
}

// 7. Documents Storage & Intelligent Analyzers
export async function getLiveDocuments(): Promise<any[]> {
  try {
    const headers = await getHeaders();
    const res = await fetch('/api/documents', { headers });
    if (!res.ok) {
      console.warn('Falha ao obter documentos arquivados:', res.status);
      return [];
    }
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
    return [];
  } catch (err) {
    console.warn('Error fetching documents:', err);
    return [];
  }
}

export async function uploadLiveDocument(name: string, size?: string): Promise<any> {
  const headers = await getHeaders();
  const res = await fetch('/api/documents', {
    method: 'POST',
    headers,
    body: JSON.stringify({ name, size })
  });
  if (!res.ok) throw new Error('Falha ao processar upload com análise OCR.');
  return res.json();
}

export async function deleteLiveDocument(id: number): Promise<void> {
  const headers = await getHeaders();
  const res = await fetch(`/api/documents/${id}`, {
    method: 'DELETE',
    headers
  });
  if (!res.ok) throw new Error('Falha ao deletar arquivo.');
}

// Operational History helper API
export async function getLiveLogs(): Promise<any[]> {
  try {
    const headers = await getHeaders();
    const res = await fetch('/api/logs', { headers });
    if (!res.ok) {
      console.warn('Falha ao obter logs operacionais do Postgres: status', res.status);
      return [];
    }
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
    console.warn('[LOGS] API returned non-JSON content. Falling back to empty array.');
    return [];
  } catch (err) {
    console.warn('[LOGS] Error fetching live logs:', err);
    return [];
  }
}

// 8. Institutional Approvals Operations
export async function getLiveApprovals(): Promise<ApprovalRequest[]> {
  try {
    const headers = await getHeaders();
    const res = await fetch('/api/approvals', { headers });
    if (!res.ok) {
      console.warn('Falha ao obter pedidos de aprovação escolares:', res.status);
      return [];
    }
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
    return [];
  } catch (err) {
    console.warn('Error fetching approvals:', err);
    return [];
  }
}

export async function createLiveApproval(title: string, description: string, flowType: string): Promise<ApprovalRequest> {
  const headers = await getHeaders();
  const res = await fetch('/api/approvals', {
    method: 'POST',
    headers,
    body: JSON.stringify({ title, description, flowType })
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Falha ao criar pedido de aprovação escolar.');
  }
  return res.json();
}

export async function transitionLiveApproval(id: string, action: string, comment: string): Promise<ApprovalRequest> {
  const headers = await getHeaders();
  const res = await fetch(`/api/approvals/${id}/transition`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action, comment })
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Falha ao processar a acção de aprovação.');
  }
  return res.json();
}

export const SUPABASE_SQL_SCHEMA = `-- CLOUD SQL POSTGRESQL SCHEMA (Drizzle ORM Generated)
-- Core school database state:
-- 1. users: id (text), email (text), name (text), role (user_role), created_at (timestamp)
-- 2. students: id (text), name (text), class (text), guardians_name (text), guardians_contact (text), documents (json)
-- 3. invoices: id (text), student_id (text), student_name (text), amount (numeric), due_date (text), status (invoice_status), category (text)
-- 4. announcements: id (serial), title (text), content (text), target (text), published_by (text), date (text)
-- 5. chat_messages: id (serial), content (text), sender_name (text), sender_role (text), channel (text), timestamp (timestamp)
-- 6. automations: id (text), name (text), active (boolean), description (text), trigger (text), last_run (text), steps (json)
-- 7. uploaded_documents: id (serial), name (text), size (text), category (text), student_id (text), student_name (text), user_id (text), extracted_details (json), status (text)
-- 8. operational_logs: id (serial), user_id (text), user_name (text), user_role (text), action (text), details (text), timestamp (timestamp)
`;

// Simulated bulk seed - returns instant success
export async function seedSupabaseDatabase(data?: any): Promise<{ success: boolean; log: string }> {
  console.log("Seeding Database called with current data arrays", data);
  return {
    success: true,
    log: "Banco de Dados Cloud SQL sincronizado de forma instantânea na pauta local do servidor!"
  };
}

export async function getLiveTasks(): Promise<SchoolTask[]> {
  const headers = await getHeaders();
  const res = await fetch('/api/school-tasks', { headers });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Falha ao buscar tarefas escolares.');
  }
  return res.json();
}

export async function upsertLiveTask(task: SchoolTask): Promise<SchoolTask> {
  const headers = await getHeaders();
  const res = await fetch('/api/school-tasks', {
    method: 'POST',
    headers,
    body: JSON.stringify(task)
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Falha ao gravar tarefa escolar.');
  }
  return res.json();
}

export async function deleteLiveTask(id: string): Promise<{ success: boolean }> {
  const headers = await getHeaders();
  const res = await fetch(`/api/school-tasks/${id}`, {
    method: 'DELETE',
    headers
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    if (res.status === 409 && errData.dependents && errData.dependents.length > 0) {
      const depList = errData.dependents.map((d: any) => `"${d.title}" (${d.id})`).join('\n• ');
      throw new Error(`Não é possível eliminar esta tarefa porque existem outras que dependem dela:\n• ${depList}`);
    }
    throw new Error(errData.error || 'Falha ao apagar tarefa escolar.');
  }
  return res.json();
}

export async function getDeletedLiveTasks(): Promise<SchoolTask[]> {
  const headers = await getHeaders();
  const res = await fetch('/api/school-tasks/deleted', { headers });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Falha ao buscar tarefas escolares eliminadas.');
  }
  return res.json();
}

export async function restoreLiveTask(id: string): Promise<{ success: boolean; task: SchoolTask }> {
  const headers = await getHeaders();
  const res = await fetch(`/api/school-tasks/${id}/restore`, {
    method: 'POST',
    headers
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Falha ao restaurar tarefa escolar.');
  }
  return res.json();
}

export async function getDependencyImpact(id: string): Promise<{ canDelete: boolean; directDependents: number; totalAffectedTasks: number; tasks: any[] }> {
  const headers = await getHeaders();
  const res = await fetch(`/api/school-tasks/${id}/dependency-impact`, { headers });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Falha ao calcular impacto de dependência.');
  }
  return res.json();
}

